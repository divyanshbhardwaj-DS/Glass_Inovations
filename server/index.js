'use strict';

require('dotenv').config();

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const nodemailer = require('nodemailer');
const path = require('path');
const db = require('./db');

// ─── Config ────────────────────────────────────────────────────────────────
const PORT         = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV     = process.env.NODE_ENV || 'development';
const ADMIN_USER   = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS   = process.env.ADMIN_PASS || 'changeme123';
const NOTIFY_TO    = process.env.NOTIFY_TO  || 'info@completeglassinnovations.com.au';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3001');
}

// ─── Mailer ─────────────────────────────────────────────────────────────────
let transporter = null;

async function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[mailer] SMTP credentials not set — emails will be skipped (records safely saved to DB).');
    return null;
  }
  const t = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  try {
    await t.verify();
    console.log('[mailer] SMTP connection verified successfully ✓');
    return t;
  } catch (err) {
    console.warn('[mailer] SMTP verification warning:', err.message, '— continuing without email notifications.');
    return null;
  }
}

async function sendNotificationEmail(enquiry) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: `"CGI Website" <${process.env.SMTP_USER}>`,
      to:   NOTIFY_TO,
      subject: `New Quote Enquiry — ${enquiry.job} (${enquiry.suburb})`,
      text: [
        'NEW QUOTE ENQUIRY',
        '─────────────────────────────────────',
        `Name:    ${enquiry.name}`,
        `Phone:   ${enquiry.phone}`,
        `Suburb:  ${enquiry.suburb}`,
        `Job:     ${enquiry.job}`,
        '',
        enquiry.message || '(no message provided)',
        '',
        `Submitted: ${enquiry.created_at}`,
        `Enquiry ID: #${enquiry.id}`,
        '',
        'Manage enquiries at /admin',
      ].join('\n'),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#0B0C0E;color:#F1F3F6;padding:24px;border-radius:8px;border:1px solid #21242C;">
          <h2 style="color:#C8353A;margin-top:0;">New Quote Enquiry</h2>
          <table style="border-collapse:collapse;width:100%;font-size:15px;color:#F1F3F6;">
            <tr><td style="padding:8px 14px 8px 0;color:#AEB4C0;width:120px;">Name</td><td style="padding:8px 0;font-weight:600;">${validator.escape(enquiry.name)}</td></tr>
            <tr><td style="padding:8px 14px 8px 0;color:#AEB4C0;">Phone</td><td style="padding:8px 0;"><a href="tel:${validator.escape(enquiry.phone)}" style="color:#8FB9C9;text-decoration:none;font-weight:600;">${validator.escape(enquiry.phone)}</a></td></tr>
            <tr><td style="padding:8px 14px 8px 0;color:#AEB4C0;">Suburb</td><td style="padding:8px 0;">${validator.escape(enquiry.suburb)}</td></tr>
            <tr><td style="padding:8px 14px 8px 0;color:#AEB4C0;">Job Type</td><td style="padding:8px 0;color:#F25A54;font-weight:600;">${validator.escape(enquiry.job)}</td></tr>
          </table>
          ${enquiry.message ? `
            <div style="margin-top:16px;background:#14161A;border:1px solid rgba(255,255,255,0.07);padding:14px 16px;border-radius:6px;">
              <div style="font-size:12px;color:#828A96;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Message</div>
              <p style="margin:0;white-space:pre-wrap;font-size:14px;color:#F1F3F6;">${validator.escape(enquiry.message)}</p>
            </div>
          ` : ''}
          <p style="color:#828A96;font-size:12px;margin-top:24px;border-top:1px solid #21242C;padding-top:12px;">Enquiry #${enquiry.id} · ${enquiry.created_at} · Complete Glass Innovations</p>
        </div>
      `,
    });
    console.log(`[mailer] Notification sent for enquiry #${enquiry.id}`);
  } catch (err) {
    console.error('[mailer] Send failed:', err.message);
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────
const app = express();

app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: function(origin, cb) {
    if (!origin || allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // Permissive in fallback to ensure local and external requests work cleanly
  },
  credentials: true,
}));

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// ─── Rate limits ─────────────────────────────────────────────────────────────
const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many requests — please wait a few minutes before trying again or call 0497 470 036.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests.' },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitise(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[\x00-\x1F\x7F]/g, '').slice(0, 2000);
}

function basicAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const b64 = authHeader.replace(/^Basic\s+/i, '');
  if (!b64) {
    res.setHeader('WWW-Authenticate', 'Basic realm="CGI Admin"');
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const [u, p] = Buffer.from(b64, 'base64').toString().split(':');
    if (u === ADMIN_USER && p === ADMIN_PASS) return next();
  } catch {}
  res.setHeader('WWW-Authenticate', 'Basic realm="CGI Admin"');
  return res.status(401).json({ error: 'Invalid credentials.' });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Complete Glass Innovations API',
    time: new Date().toISOString(),
    env: NODE_ENV
  });
});

// POST /api/quote — submit a quote enquiry
app.post('/api/quote', quoteLimiter, (req, res) => {
  try {
    const { name, phone, suburb, job, message } = req.body || {};

    const errors = {};
    const cleanName = sanitise(name);
    const cleanPhone = sanitise(phone);
    const cleanSuburb = sanitise(suburb);
    const cleanJob = sanitise(job);
    const cleanMsg = sanitise(message);

    if (!cleanName || cleanName.length < 2) {
      errors.name = 'Please enter your name.';
    } else if (cleanName.length > 120) {
      errors.name = 'Name is too long.';
    }

    if (!cleanPhone) {
      errors.phone = 'Please enter a contact phone number.';
    } else {
      const digits = cleanPhone.replace(/[\s\-\(\)\+]/g, '');
      if (digits.length < 6 || digits.length > 15) {
        errors.phone = 'Please enter a valid phone number (e.g. 04xx xxx xxx).';
      }
    }

    if (!cleanSuburb || cleanSuburb.length < 2) {
      errors.suburb = 'Please enter your suburb.';
    } else if (cleanSuburb.length > 80) {
      errors.suburb = 'Suburb name is too long.';
    }

    const VALID_JOBS = ['Splashback', 'Shower screen', 'Balustrade', 'Pool fencing', 'Mirror', 'Repair — same day', 'Other'];
    if (!cleanJob || !VALID_JOBS.includes(cleanJob)) {
      errors.job = 'Please select a valid job type.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ error: 'Validation failed.', fields: errors });
    }

    const enquiry = db.insert({
      name: cleanName,
      phone: cleanPhone,
      suburb: cleanSuburb,
      job: cleanJob,
      message: cleanMsg,
      ip: (req.ip || '').slice(0, 60),
      user_agent: (req.headers['user-agent'] || '').slice(0, 300)
    });

    console.log(`[quote] New enquiry #${enquiry.id}: ${enquiry.name} — ${enquiry.job} (${enquiry.suburb})`);

    // Asynchronous background email delivery
    sendNotificationEmail(enquiry).catch(() => {});

    return res.status(201).json({
      success: true,
      id: enquiry.id,
      message: 'Thank you! Your enquiry has been received. We’ll be in touch shortly to arrange a free on-site measure.'
    });

  } catch (err) {
    console.error('[quote] Error creating enquiry:', err);
    return res.status(500).json({ error: 'Something went wrong. Please call us directly on 0497 470 036.' });
  }
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

// GET /admin/api/enquiries — list all enquiries with filters, search, pagination
app.get('/admin/api/enquiries', adminLimiter, basicAuth, (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const status = sanitise(req.query.status || '');
    const search = sanitise(req.query.search || '');

    const result = db.list({ status, page, limit, search });
    return res.json(result);
  } catch (err) {
    console.error('[admin] List error:', err);
    return res.status(500).json({ error: 'Failed to retrieve enquiries.' });
  }
});

// PATCH /admin/api/enquiries/:id — update enquiry status
app.patch('/admin/api/enquiries/:id', adminLimiter, basicAuth, (req, res) => {
  try {
    const id     = parseInt(req.params.id, 10);
    const status = sanitise(req.body.status || '');
    const VALID  = ['new', 'contacted', 'quoted', 'won', 'lost'];
    if (!VALID.includes(status)) {
      return res.status(422).json({ error: 'Invalid status value.' });
    }

    const updated = db.updateStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Enquiry not found.' });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[admin] Update error:', err);
    return res.status(500).json({ error: 'Failed to update enquiry.' });
  }
});

// DELETE /admin/api/enquiries/:id — delete enquiry
app.delete('/admin/api/enquiries/:id', adminLimiter, basicAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = db.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Enquiry not found.' });
    }
    return res.json({ success: true, message: `Enquiry #${id} deleted.` });
  } catch (err) {
    console.error('[admin] Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete enquiry.' });
  }
});

// GET /admin — serve the admin dashboard HTML
app.get('/admin', adminLimiter, basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ─── Static frontend ─────────────────────────────────────────────────────────
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR, {
  index: 'index.html',
  maxAge: NODE_ENV === 'production' ? '1d' : 0,
}));

// SPA fallback for frontend paths
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[app] Server exception:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
async function main() {
  transporter = await createTransporter();
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  COMPLETE GLASS INNOVATIONS — FULL-STACK SERVER`);
    console.log(`======================================================`);
    console.log(`  Frontend: http://localhost:${PORT}`);
    console.log(`  Admin:    http://localhost:${PORT}/admin`);
    console.log(`  API:      http://localhost:${PORT}/api/quote`);
    console.log(`  Health:   http://localhost:${PORT}/api/health`);
    console.log(`  Mode:     ${NODE_ENV}`);
    console.log(`======================================================\n`);
  });
}

main().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});

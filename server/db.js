'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'enquiries.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class DatabaseStore {
  constructor(filepath) {
    this.filepath = filepath;
    this.enquiries = [];
    this.nextId = 1;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filepath)) {
        const raw = fs.readFileSync(this.filepath, 'utf8');
        const data = JSON.parse(raw);
        this.enquiries = Array.isArray(data.enquiries) ? data.enquiries : [];
        this.nextId = typeof data.nextId === 'number' ? data.nextId : (this.enquiries.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1);
      } else {
        this.seedInitialData();
        this.save();
      }
    } catch (err) {
      console.error('[db] Error loading database, initializing new store:', err.message);
      this.enquiries = [];
      this.nextId = 1;
      this.save();
    }
  }

  save() {
    try {
      const data = {
        version: 1,
        nextId: this.nextId,
        enquiries: this.enquiries,
        updatedAt: new Date().toISOString()
      };
      // Atomic write using temp file
      const tempPath = `${this.filepath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filepath);
    } catch (err) {
      console.error('[db] Error saving database:', err.message);
    }
  }

  seedInitialData() {
    // Seed with a couple of sample demonstration records
    this.enquiries = [
      {
        id: 1,
        name: 'David Miller',
        phone: '0412 345 678',
        suburb: 'Williamstown',
        job: 'Balustrade',
        service: 'Balustrade',
        message: 'Looking for a frameless glass balustrade for a 6m second-floor balcony overlooking the bay.',
        ip: '127.0.0.1',
        user_agent: 'Initial Seed',
        status: 'quoted',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 2,
        name: 'Sarah Jenkins',
        phone: '0498 765 432',
        suburb: 'Point Cook',
        job: 'Splashback',
        service: 'Splashback',
        message: 'Kitchen renovation underway. Need metallic sage green toughened splashback measured and fitted.',
        ip: '127.0.0.1',
        user_agent: 'Initial Seed',
        status: 'new',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 4).toISOString()
      }
    ];
    this.nextId = 3;
  }

  insert(item) {
    const now = new Date().toISOString();
    const newRecord = {
      id: this.nextId++,
      name: item.name,
      phone: item.phone,
      suburb: item.suburb,
      job: item.job,
      service: item.service || item.job,
      project_type: item.project_type || null,
      job_location: item.job_location || null,
      preferred_contact: item.preferred_contact || 'call',
      details: item.details || {},
      photo: item.photo || null,
      photo_name: item.photo_name || null,
      message: item.message || null,
      ip: item.ip || null,
      user_agent: item.user_agent || null,
      status: 'new',
      created_at: now,
      updated_at: now
    };
    this.enquiries.unshift(newRecord);
    this.save();
    return newRecord;
  }

  findById(id) {
    const numericId = parseInt(id, 10);
    return this.enquiries.find(e => e.id === numericId) || null;
  }

  list({ status = '', page = 1, limit = 50, search = '' } = {}) {
    let filtered = [...this.enquiries];

    if (status) {
      filtered = filtered.filter(e => e.status.toLowerCase() === status.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(e =>
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.suburb && e.suburb.toLowerCase().includes(q)) ||
        (e.phone && e.phone.toLowerCase().includes(q)) ||
        ((e.job || '') && e.job.toLowerCase().includes(q)) ||
        ((e.service || '') && e.service.toLowerCase().includes(q)) ||
        (e.message && e.message.toLowerCase().includes(q))
      );
    }

    // Sort by created_at DESC
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const rows = filtered.slice(offset, offset + limit);

    return {
      data: rows,
      total,
      page,
      pages: Math.ceil(total / limit) || 1
    };
  }

  updateStatus(id, newStatus) {
    const numericId = parseInt(id, 10);
    const item = this.enquiries.find(e => e.id === numericId);
    if (!item) return null;

    item.status = newStatus;
    item.updated_at = new Date().toISOString();
    this.save();
    return item;
  }

  delete(id) {
    const numericId = parseInt(id, 10);
    const index = this.enquiries.findIndex(e => e.id === numericId);
    if (index === -1) return false;

    this.enquiries.splice(index, 1);
    this.save();
    return true;
  }
}

module.exports = new DatabaseStore(DB_FILE);

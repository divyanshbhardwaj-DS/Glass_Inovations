/* fx.js — interaction layer: custom cursor, magnetic CTAs, card 3D system,
   animated counters, hero scroll bridge for the 3D scene. Pure enhancement;
   everything degrades gracefully. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var coarse = window.matchMedia('(pointer:coarse)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- hero scroll -> 3D bridge ---------- */
  (function () {
    var hero = document.getElementById('home');
    if (!hero) return;
    function update() {
      var r = hero.getBoundingClientRect();
      var p = r.top < 1 ? Math.min(1, Math.max(0, -r.top / Math.max(1, r.height))) : 0;
      if (window.Hero3D) window.Hero3D.setScroll(p);
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    setTimeout(update, 350);
  }());

  /* ---------- custom cursor ---------- */
  if (!coarse && !reduce) {
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    var ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;
    var shown = false, raf = 0;

    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; doc.classList.add('has-cursor'); }
      var t = e.target;
      doc.classList.toggle('cursor-link', !!(t && t.closest && t.closest('a,button,[role=button],input,select,textarea,.about-visual,.deck-card')));
    }, { passive: true });
    window.addEventListener('mousedown', function () { if (shown) doc.classList.add('cursor-pressed'); });
    window.addEventListener('mouseup', function () { if (shown) doc.classList.remove('cursor-pressed'); });

    function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      if (shown) raf = requestAnimationFrame(loop);
    }
    loop();
  }

  /* ---------- magnetic CTAs ---------- */
  if (!coarse) {
    var mags = document.querySelectorAll('.hero-ctas .btn, .big-phone, .quickbar .btn');
    mags.forEach(function (el) {
      el.classList.add('magnet');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.setProperty('--mx', (dx * 0.16).toFixed(1) + 'px');
        el.style.setProperty('--my', (dy * 0.16).toFixed(1) + 'px');
      }, { passive: true });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });
  }

  /* ---------- reusable card 3D interaction system ---------- */
  (function () {
    if (coarse || reduce || window.matchMedia('(hover:none)').matches) return;

    var P = {
      service:  { t: 8,  l: 6,  s: 1.02, dampH: 0.86, dampL: 0.90 },
      gallery:  { t: 7,  l: 8,  s: 1.02, dampH: 0.86, dampL: 0.90 },
      process:  { t: 4,  l: 2,  s: 1.01, dampH: 0.88, dampL: 0.92 },
      about:    { t: 5,  l: 4,  s: 1.02, dampH: 0.86, dampL: 0.90 }
    };
    var cards = document.querySelectorAll('[data-card]');
    if (!cards.length) return;

    var c = [];

    cards.forEach(function (card) {
      var kind = card.getAttribute('data-card') || 'service';
      var p = P[kind] || P.service;
      card.classList.add('card3d', 'card-' + kind);
      var s = { p: p, rx: 0, ry: 0, vx: 0, vy: 0, sc: 1, lyft: 0, mx: 50, my: 50, px: 0, py: 0, active: false };
      c.push({ el: card, s: s });

      card.addEventListener('pointerenter', function () {
        s.active = true;
        card.classList.add('cdr-active');
        ensure();
      });
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        s.px = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
        s.py = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
        s.mx = (s.px + 0.5) * 100;
        s.my = (s.py + 0.5) * 100;
        ensure();
      }, { passive: true });
      card.addEventListener('pointerleave', function () {
        s.active = false;
        s.px = 0; s.py = 0; s.mx = 50; s.my = 50;
      });
    });

    function write(card, s) {
      var st = card.style;
      st.setProperty('--rx', s.rx.toFixed(2) + 'deg');
      st.setProperty('--ry', s.ry.toFixed(2) + 'deg');
      st.setProperty('--lyft', s.lyft.toFixed(1) + 'px');
      st.setProperty('--sc', s.sc.toFixed(3));
      st.setProperty('--mx', s.mx.toFixed(1) + '%');
      st.setProperty('--my', s.my.toFixed(1) + '%');
      st.setProperty('--px', s.px.toFixed(3));
      st.setProperty('--py', s.py.toFixed(3));
    }

    var running = false;
    function tick() {
      var any = false;
      for (var i = 0; i < c.length; i++) {
        var o = c[i], s = o.s, p = s.p;
        if (s.active) {
          s.vx += (p.t * s.py - s.rx) * 0.085;
          s.vy += (-p.t * s.px - s.ry) * 0.085;
          s.vx *= p.dampH; s.vy *= p.dampH;
        } else {
          s.vx += (0 - s.rx) * 0.06;
          s.vy += (0 - s.ry) * 0.06;
          s.vx *= p.dampL; s.vy *= p.dampL;
        }
        s.rx += s.vx; s.ry += s.vy;
        var tSc = s.active ? p.s : 1, tL = s.active ? p.l : 0;
        s.sc  += (tSc - s.sc)  * 0.1;
        s.lyft += (tL - s.lyft) * 0.1;
        write(o.el, s);
        if (s.vx > 0.02 || s.vx < -0.02 || s.vy > 0.02 || s.vy < -0.02 ||
            Math.abs(s.sc - tSc) > 0.001 || Math.abs(s.lyft - tL) > 0.01) {
          any = true;
        }
      }
      if (any) {
        requestAnimationFrame(tick);
      } else {
        for (var k = 0; k < c.length; k++) {
          if (!c[k].s.active) c[k].el.classList.remove('cdr-active');
        }
        running = false;
      }
    }
    function ensure() {
      if (!running) { running = true; requestAnimationFrame(tick); }
    }
    document.addEventListener('mouseleave', function () {
      c.forEach(function (o) { o.s.active = false; o.s.px = 0; o.s.py = 0; o.s.mx = 50; o.s.my = 50; });
      ensure();
    });
  }());

  /* ---------- animated counters ---------- */
  (function () {
    var els = document.querySelectorAll('.counter[data-to]');
    if (!els.length) return;
    els.forEach(function (el) {
      var to = parseInt(el.getAttribute('data-to'), 10) || 0;
      if (reduce || !('IntersectionObserver' in window)) { el.textContent = to; return; }
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var start = null, dur = 1400;
        function step(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(to * eased).toLocaleString('en-AU');
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }, { threshold: 0.6 });
      io.observe(el);
    });
  }());
}());
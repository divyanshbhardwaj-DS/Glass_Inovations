/* deck.js — premium interactive 3D card deck.
   Converts #deck into a physical stack of cards the user can grab, drag,
   swipe and cycle. Runs only when motion is allowed; otherwise the cards
   remain a normal, fully readable grid. */
(function () {
  'use strict';

  var deckEl = document.getElementById('deckStack');
  var stageEl = document.getElementById('deckStage');
  if (!deckEl || !stageEl) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var fine = !coarse;
  var LIGHTBOX = window.GlassLightbox;

  var cards = Array.prototype.slice.call(deckEl.querySelectorAll('.deck-card'));
  var N = cards.length;
  if (!N) return;

  var status = document.getElementById('deckStatus');
  var statusEl = status;

  /* ---------- model ---------- */
  var order = cards.map(function (c, i) { return i; });            /* order[0] = top */
  var st = cards.map(function (c, i) {
    return {
      el: c, kind: c.getAttribute('data-kind'),
      x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, o: 0, bl: 0,
      vx: 0, vy: 0, vr: 0, vrx: 0, vry: 0,
      px: 0, py: 0, smx: 0, smy: 0, hov: 0,
      enterT: -1, reveal: 0
    };
  });

  var stage = { w: 1 };
  var lift = 1;                                   /* cascade scale on narrow screens */
  function measure() {
    stage.w = Math.max(320, stageEl.clientWidth || 1);
    lift = Math.min(1, stage.w / 860);
  }
  measure();
  if (window.ResizeObserver) { new ResizeObserver(measure).observe(stageEl); }
  else { window.addEventListener('resize', measure); }

  var cursor = { in: false, x: 0.5, y: 0.5 };
  var deckRX = 0, deckRY = 0;                     /* container tilt (deg) */
  var deckRx = 0, deckRy = 0;                     /* smoothed */

  var entered = false, enterT0 = 0;
  var drag = null, fly = null;
  var suppressClick = false;
  var running = false, inView = false;
  var tPrev = 0;

  function posOf(i) { return order.indexOf(i); }
  function topSt() { return st[order[0]]; }

  function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }

  /* ---------- stack layout: one source of truth per slot ---------- */
  function stackLayout(pos) {
    var L = lift, o;
    switch (pos) {
      case 0: o = { x: 0, y: 0, z: 64, rz: 0, s: 1, o: 1, bl: 0, ry: -1 }; break;
      case 1: o = { x: 26, y: 15, z: 34, rz: 2.1, s: 0.975, o: 1, bl: 0.35, ry: -3 }; break;
      case 2: o = { x: 50, y: 31, z: 15, rz: 3.5, s: 0.95, o: 0.99, bl: 0.7, ry: -5 }; break;
      case 3: o = { x: 72, y: 46, z: 2, rz: 4.6, s: 0.93, o: 0.95, bl: 1.2, ry: -6.5 }; break;
      default: {
        var d = pos - 3;
        o = {
          x: Math.min(94 + d * 6, 132), y: 58 + d * 5,
          z: -28 - d * 22, rz: 5.3 + d * 0.7,
          s: Math.max(0.93 - d * 0.015, 0.85),
          o: Math.max(0.93 - d * 0.07, 0.28),
          bl: 1.5 + d * 0.35,
          ry: Math.max(-9 - d, -12)
        };
      }
    }
    o.x *= L; o.y *= L;
    return o;
  }

  /* ---------- controls + dots ---------- */
  var btnPrev = document.getElementById('deckPrev');
  var btnNext = document.getElementById('deckNext');
  var dotsWrap = document.getElementById('deckDots');
  if (!reduce && dotsWrap) {
    for (var k = 0; k < N; k++) {
      (function (idx) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'deck-dot';
        d.setAttribute('aria-label', 'Go to card ' + (idx + 1));
        d.addEventListener('click', function () { jump(idx); });
        dotsWrap.appendChild(d);
      }(k));
    }
  }
  if (btnNext) btnNext.addEventListener('click', function () { if (!drag && !fly) eject(order[0], 1); });
  if (btnPrev) btnPrev.addEventListener('click', function () { if (!drag && !fly) prev(); });
  if (statusEl && coarse) { statusEl.textContent = ''; }

  function hintText() {
    var h = document.querySelector('.deck-hint');
    if (h) h.textContent = coarse ? 'swipe to flip · tap a project to open' : 'grab · drag · flip — or use ← →';
  }
  hintText();

  function updateDots() {
    if (!dotsWrap) return;
    var act = order[0];
    var dots = dotsWrap.children;
    for (var i = 0; i < dots.length; i++) {
      var on = i === act;
      dots[i].classList.toggle('active', on);
      if (on) dots[i].setAttribute('aria-current', 'true');
      else dots[i].removeAttribute('aria-current');
    }
  }
  function announce() {
    if (!statusEl) return;
    var h3 = st[order[0]].el.querySelector('h3');
    if (h3) statusEl.textContent = 'Showing — ' + h3.textContent;
  }
  function syncGlobals() {
    var topIdx = order[0];
    for (var i = 0; i < N; i++) {
      cards[i].classList.toggle('is-top', i === topIdx);
      cards[i].tabIndex = i === topIdx ? 0 : -1;
    }
    updateDots();
    announce();
  }

  /* ---------- reordering ---------- */
  function bringToTop(idx) {
    var p = posOf(idx);
    if (p === 0) return;
    var head = order.splice(0, p);
    order.push.apply(order, head);
  }
  function jump(idx) {
    if (drag || fly || reduce) return;
    bringToTop(idx);
    var c = st[order[0]];
    c.reveal = 1;
    syncGlobals();
  }
  function prev() {
    if (drag || fly || reduce) return;
    var last = order.pop();
    order.unshift(last);
    st[last].reveal = 1;
    syncGlobals();
  }
  function eject(i, dir) {
    if (fly || drag || reduce) return;
    var c = st[i];
    var kick = (drag ? Math.abs(drag.vx) * 17 : 0) + 20;
    fly = { i: i, dir: dir, x: c.x, rz: dir * 10, vrz: dir * 5, vx: kick * dir, t: 0 };
    c.smx = 0; c.smy = 0; c.px = 0; c.py = 0;
  }
  function finishEject() {
    if (!fly) return;
    var i = fly.i;
    fly = null;
    order.splice(order.indexOf(i), 1);
    order.push(i);
    var c = st[i];
    c.x = 0; c.y = 0; c.z = -20; c.vx = 0; c.vy = 0; c.rx = 0; c.ry = 0; c.rz = 0; c.vr = 0;
    c.smx = 0; c.smy = 0; c.px = 0; c.py = 0; c.o = 1; c.s = 1; c.bl = 0;
    st[order[0]].reveal = 1;
    syncGlobals();
  }

  window.GlassDeck = {
    next: function () { if (!drag && !fly) eject(order[0], 1); },
    prev: prev,
    jump: jump,
    jumpKind: function (kind) {
      for (var i = 0; i < N; i++) { if (st[i].kind === kind) { jump(i); return; } }
    },
    top: function () { return cards[order[0]]; },
    cards: cards,
    order: order
  };

  /* ---------- pointer interaction (live deck only) ---------- */
  function grabCard(e) {
    if (drag || fly || reduce || !entered) return;
    if (!(e.touches && e.touches.length > 1)) {
      var owner = e.target.closest('.deck-card');
      if (owner && owner !== cards[order[0]]) return;
    }
    if (e.button === 2) return;
    try {
      var r = cards[order[0]].getBoundingClientRect();
      drag = {
        i: order[0], sx: e.clientX, sy: e.clientY,
        gx: e.clientX - (r.left + r.width / 2),
        gy: e.clientY - (r.top + r.height / 2),
        dx: 0, dy: 0, moved: false, px: e.clientX, py: e.clientY,
        t: performance.now(), vx: 0, vy: 0
      };
      cards[order[0]].classList.add('is-dragging');
      if (e.pointerId !== undefined && cards[order[0]].setPointerCapture) {
        cards[order[0]].setPointerCapture(e.pointerId);
      }
      if (fine) { e.preventDefault(); }
    } catch (err) { drag = null; }
  }
  function moveCard(e) {
    if (drag) {
      var dx = e.clientX - drag.sx;
      var dy = e.clientY - drag.sy;
      drag.dx = dx; drag.dy = dy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;
      var now = performance.now();
      var dt = now - drag.t;
      if (dt > 0) {
        var vx = (e.clientX - drag.px) / dt;
        var vy = (e.clientY - drag.py) / dt;
        drag.vx = drag.vx * 0.65 + vx * 0.35;
        drag.vy = drag.vy * 0.65 + vy * 0.35;
      }
      drag.px = e.clientX; drag.py = e.clientY; drag.t = now;
    } else if (fine) {
      updateHover(e);
    }
  }
  function dropCard(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    var c = st[d.i];
    c.el.classList.remove('is-dragging');
    var cca = c.el; /* release capture */
    if (cca.releasePointerCapture && e.pointerId !== undefined) {
      try { cca.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    if (!d.moved) {
      /* plain tap — reset hover tilt; the click event opens the lightbox */
      c.px = 0; c.py = 0; c.smx = 0; c.smy = 0;
      return;
    }
    suppressClick = true;
    var distOK = Math.abs(d.dx) > stage.w * 0.13;
    var velOK = Math.abs(d.vx) > 0.85;
    if ((distOK && Math.abs(d.dx) > 10) || velOK) {
      var dir = d.dx >= 0 ? 1 : -1;
      eject(d.i, dir);
    } else {
      /* spring back with momentum */
      c.vx = Math.max(-26, Math.min(26, d.vx * 16 * 0.45));
      c.vy = Math.max(-18, Math.min(18, d.vy * 16 * 0.45));
      c.smx = 0; c.smy = 0; c.px = 0; c.py = 0;
    }
  }
  function updateHover(e) {
    var c = topSt();
    var r = cards[order[0]].getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    var px = (e.clientX - r.left) / r.width - 0.5;
    var py = (e.clientY - r.top) / r.height - 0.5;
    c.px = Math.max(-0.5, Math.min(0.5, px));
    c.py = Math.max(-0.5, Math.min(0.5, py));
  }
  if (!reduce) {
    deckEl.addEventListener('pointerdown', grabCard);
    deckEl.addEventListener('pointermove', moveCard);
    deckEl.addEventListener('pointerup', dropCard);
    deckEl.addEventListener('pointercancel', dropCard);
    if (fine) {
      stageEl.addEventListener('pointerenter', function () { cursor.in = true; });
      stageEl.addEventListener('pointerleave', function () {
        cursor.in = false; cursor.x = 0.5; cursor.y = 0.5;
        topSt().px = 0; topSt().py = 0;
      });
      stageEl.addEventListener('pointermove', function (e) {
        var r = stageEl.getBoundingClientRect();
        cursor.x = (e.clientX - r.left) / r.width;
        cursor.y = (e.clientY - r.top) / r.height;
        cursor.in = true;
        stageEl.style.setProperty('--lx', (cursor.x * 100).toFixed(1) + '%');
        stageEl.style.setProperty('--ly', (cursor.y * 100).toFixed(1) + '%');
      });
    }
    /* keyboard cycling */
    document.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (document.getElementById('lightbox').classList.contains('open')) return;
      var sec = deckEl.closest('section');
      var r = sec.getBoundingClientRect();
      if (r.top > window.innerHeight || r.bottom < 0) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); eject(order[0], 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });
  }
  /* click (incl. plain tap & static lots) → lightbox for gallery cards */
  deckEl.addEventListener('click', function (e) {
    if (suppressClick) { suppressClick = false; return; }
    var card = e.target.closest('.deck-card');
    if (card && card.getAttribute('data-kind') === 'gallery' && LIGHTBOX) {
      LIGHTBOX.open(card);
    }
  });
  deckEl.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if ((e.key === 'Enter' || e.key === ' ')
        && document.activeElement && document.activeElement.classList &&
        document.activeElement.classList.contains('deck-card')) {
      var k = document.activeElement.getAttribute('data-kind');
      if (k === 'gallery' && LIGHTBOX) { e.preventDefault(); LIGHTBOX.open(document.activeElement); }
    }
  });

  /* ---------- entrance ---------- */
  function startEnter() {
    if (entered) return;
    entered = true;
    enterT0 = performance.now();
    for (var i = 0; i < N; i++) { st[i].enterT = i * 55; }
  }
  if (!reduce) {
    deckEl.classList.add('deck-live');
    measure();
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          inView = en.isIntersecting;
          if (inView) startEnter();
          cycle();
        });
      }, { threshold: 0.05 });
      io.observe(deckEl.closest('section'));
    } else {
      inView = true;
      startEnter();
    }
    syncGlobals();
    cycle();
  } else {
    /* static grid: still wiring clicks + keyboard above, flatten any inline state */
    cards.forEach(function (c, i) { c.tabIndex = 0; });
  }

  /* ---------- animation loop ---------- */
  function render() {
    var ts = performance.now();
    var dt = Math.min(ts - tPrev, 50); tPrev = ts;
    var t = ts * 0.001;
    var i, c, pos, lay;

    /* idle -> entrance progress */
    var eP = entered ? Math.min(1, (ts - enterT0) / 1150) : 0;
    var dash = entered ? easeOutCubic(eP) : 0;      /* 0 → 1 */
    var riseY = (1 - dash) * -90;

    /* container tilt toward cursor (spring) */
    var tx = 0, ty = 0;
    if (cursor.in && fine && !drag) {
      tx = (cursor.x - 0.5) * 6;
      ty = (0.5 - cursor.y) * 4;
    } else if (cursor.in && fine && drag) {
      tx = (cursor.x - 0.5) * 8;
      ty = (0.5 - cursor.y) * 5;
    }
    deckRx += (tx - deckRx) * 0.055;
    deckRy += (ty - deckRy) * 0.055;
    if (!cursor.in) { deckRx *= 0.93; deckRy *= 0.93; }

    var floatY = entered && !drag && !fly ? Math.sin(t * 0.5) * 4 : 0;

    /* fly integration */
    if (fly) {
      var f = fly;
      f.x += f.vx; f.vx *= 0.985; f.rz += f.vrz; f.vrz *= 0.97;
      if (Math.abs(f.x) >= Math.max(stage.w * 0.52, 420)) finishEject();
    }

    for (i = 0; i < N; i++) {
      c = st[i];
      pos = posOf(i);
      lay = stackLayout(pos);
      var isTop = pos === 0;

      /* per-card entrance */
      var eProg = 1;
      if (c.enterT >= 0) {
        var pv = Math.min(1, (ts - enterT0 - c.enterT) / 640);
        eProg = pv <= 0 ? 0 : easeOutCubic(pv);
      }
      var eOff = (1 - eProg) * (130 + pos * 16);
      var eX = isTop ? 0 : (1 - eProg) * (pos * 10);

      if (fly && fly.i === i) {
        c.x = fly.x; c.y = c.y * 0.94 + 6; c.z = 96; c.rx = 0;
        c.ry = (fly.x * 0.12) + fly.dir * 4; c.rz = fly.rz;
        c.s = 1; c.bl = 0;
        var eg = Math.abs(fly.x);
        c.o = Math.max(0.15, 1 - (eg - Math.max(stage.w * 0.52, 420) * 0.45) / (Math.max(stage.w * 0.52, 420) * 0.55));
      } else if (drag && drag.i === i) {
        var dx = Math.max(-stage.w * 0.55, Math.min(stage.w * 0.55, drag.dx - drag.gx));
        c.x = dx; c.y = drag.dy - drag.gy;
        c.z = 104; c.s = 1.02; c.bl = 0; c.o = 1;
        c.rz = Math.max(-18, Math.min(18, drag.dx * 0.055));
        c.rx = Math.max(-6, Math.min(6, drag.dy * -0.05));
        c.ry = drag.dx * 0.08;
      } else {
        var tX = lay.x + (isTop ? c.smx : 0);
        var tY = lay.y + (isTop ? c.smy : 0) + (isTop ? Math.sin(t * 0.6 + i) * 2.4 : Math.sin(t * 0.5 + i * 0.7) * 1.6);
        /* springs */
        c.vx += (tX - c.x) * 0.09; c.vx *= 0.84; c.x += c.vx;
        c.vy += (tY - c.y) * 0.09; c.vy *= 0.84; c.y += c.vy;
        var tZ = isTop ? 64 : lay.z;
        c.z += ((isTop ? 64 : lay.z) - c.z) * 0.12;
        if (isTop) {
          var tRX = c.py * -9, tRY = c.px * 11;
          c.rx += (tRX - c.rx) * 0.1;
          c.ry += (tRY - c.ry) * 0.1;
          c.vr += (0 - c.rz) * 0.09; c.vr *= 0.84; c.rz += c.vr;
        } else {
          c.rx = 0;
          c.ry += (lay.ry - c.ry) * 0.12;
          c.vr += (lay.rz - c.rz) * 0.09; c.vr *= 0.84; c.rz += c.vr;
        }
        var sc = lay.s;
        if (isTop && c.reveal > 0) {
          sc *= (1 + c.reveal * 0.06);
          c.rz += c.reveal * 4;
          c.reveal *= 0.9;
          if (c.reveal < 0.01) c.reveal = 0;
        }
        c.s += (sc - c.s) * 0.12;
        c.o += ((isTop ? 1 : lay.o) - c.o) * 0.12;
        c.bl += (lay.bl - c.bl) * 0.1;
      }

      /* compose */
      var x = c.x + eX;
      var y = c.y + eOff;
      var o = c.o * (eProg < 1 ? eProg : 1);
      var tr = 'translate3d(calc(-50% + ' + x.toFixed(1) + 'px), calc(-50% + ' + y.toFixed(1) + 'px), '
             + c.z.toFixed(1) + 'px) rotateX(' + c.rx.toFixed(2) + 'deg) rotateY(' + c.ry.toFixed(2)
             + 'deg) rotateZ(' + c.rz.toFixed(2) + 'deg) scale(' + c.s.toFixed(3) + ')';
      c.el.style.transform = tr;
      c.el.style.opacity = (o < 0 ? 0 : Math.min(1, o)).toFixed(3);
      c.el.style.zIndex = (isTop ? 200 : 100 - pos);
      c.el.style.filter = c.bl > 0.25 ? 'blur(' + c.bl.toFixed(2) + 'px)' : 'none';
      if (isTop) {
        c.el.style.setProperty('--px', c.px.toFixed(3));
        c.el.style.setProperty('--py', c.py.toFixed(3));
        c.el.style.setProperty('--mx', ((c.px + 0.5) * 100).toFixed(1) + '%');
        c.el.style.setProperty('--my', ((c.py + 0.5) * 100).toFixed(1) + '%');
      }
    }

    var dtr = 'translate3d(0, ' + (riseY + floatY).toFixed(1) + 'px, 0) rotateX('
            + deckRx.toFixed(2) + 'deg) rotateY(' + deckRy.toFixed(2) + 'deg)';
    deckEl.style.transform = dtr;
  }

  /* keep the loop alive while meaningful work remains */
  function busy() {
    if (drag || fly) return true;
    if (!entered) return false;
    if (inView) return true;      /* idle float */
    return false;
  }
  function cycle() {
    if (running) return;
    running = true;
    render();
    var tick = function () {
      render();
      if (busy()) { requestAnimationFrame(tick); } else { running = false; }
    };
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !running) {
      entered = entered;
      if (inView) cycle();
    }
  });
})();
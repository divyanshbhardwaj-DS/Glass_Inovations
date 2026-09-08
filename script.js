(function(){
  "use strict";

  document.documentElement.classList.add('js');
  document.getElementById('year').textContent = new Date().getFullYear();

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- header scroll state + progress bar ---- */
  var header = document.getElementById('siteHeader');
  var ann = document.querySelector('.top-announcement');
  function syncAnnHeight(){
    var h = ann ? ann.offsetHeight : 0;
    document.documentElement.style.setProperty('--ann-h', h + 'px');
  }
  syncAnnHeight();
  window.addEventListener('resize', syncAnnHeight, {passive:true});
  if(document.fonts && document.fonts.ready){ document.fonts.ready.then(syncAnnHeight); }
  var toTop = document.getElementById('toTop');
  var progress = document.getElementById('progressBar');
  var quickbar = document.getElementById('quickbar');
  var footer = document.getElementById('footer');
  function onScroll(){
    var y = window.scrollY;
    header.classList.toggle('scrolled', y > 12);
    toTop.classList.toggle('show', y > 700);
    if(progress){
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    }
    if(quickbar && footer){
      var fr = footer.getBoundingClientRect();
      quickbar.classList.toggle('hide', fr.top < window.innerHeight);
    }
  }
  document.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});
  onScroll();
  toTop.addEventListener('click', function(){ window.scrollTo({top:0, behavior: reduceMotion ? 'auto' : 'smooth'}); });

  /* ---- mobile nav ---- */
  var burger = document.getElementById('burgerBtn');
  var panel = document.getElementById('mobilePanel');
  function closeMenu(){
    burger.setAttribute('aria-expanded','false');
    panel.classList.remove('open');
    document.body.style.overflow = '';
  }
  burger.addEventListener('click', function(){
    var open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    panel.classList.toggle('open', !open);
    document.body.style.overflow = !open ? 'hidden' : '';
  });
  panel.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && panel.classList.contains('open')){ closeMenu(); }
  });

  /* ---- scroll-spy active nav link ---- */
  var navLinks = document.querySelectorAll('nav.primary a');
  var sections = ['home','deck','about','contact']
    .map(function(id){ return document.getElementById(id); })
    .filter(Boolean);
  function spy(){
    var pos = window.scrollY + 140;
    var current = sections[0];
    sections.forEach(function(sec){ if(sec.offsetTop <= pos) current = sec; });
    navLinks.forEach(function(a){
      a.classList.toggle('active', a.getAttribute('href') === '#' + current.id);
    });
  }
  document.addEventListener('scroll', spy, {passive:true});
  spy();

  /* ---- reveal on scroll ---- */
  var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  if(reduceMotion || !('IntersectionObserver' in window)){
    revealEls.forEach(function(el){ el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, {threshold:0.12, rootMargin:'0px 0px -60px 0px'});
    revealEls.forEach(function(el){ io.observe(el); });
  }

  /* ---- hero glass parallax ---- */
  var heroArt = document.getElementById('heroArt');
  if(heroArt && !reduceMotion && window.matchMedia('(pointer:fine)').matches){
    var panes = heroArt.querySelectorAll('.pane');
    heroArt.addEventListener('mousemove', function(e){
      var r = heroArt.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      panes.forEach(function(p, i){
        var depth = (i + 1) * 7;
        p.style.transform = 'translate(' + (px * depth) + 'px,' + (py * depth) + 'px)';
      });
    });
    heroArt.addEventListener('mouseleave', function(){
      panes.forEach(function(p){ p.style.transform = 'translate(0,0)'; });
    });
  }

  /* ---- image fade-ins ---- */
  function fadeIn(el, src){
    if(el.complete && el.naturalWidth){ el.classList.add('loaded'); return; }
    el.addEventListener('load', function(){ el.classList.add('loaded'); });
  }
  [document.getElementById('heroImg'), document.querySelector('.about-photo')].forEach(function(el){
    if(el){ fadeIn(el, el.currentSrc || el.src); }
  });
  function fadeInUrl(el, url){
    var img = new Image();
    img.onload = function(){ el.classList.add('loaded'); };
    img.src = url;
  }

  /* ---- marquee content ---- */
  var specs = [
    '6MM TOUGHENED — <b>CLEAR</b>', '10MM TOUGHENED — <b>LOW IRON</b>', '12MM LAMINATED — <b>FROSTED</b>',
    'DIGITALLY PRINTED SPLASHBACKS', 'MIRROR — POLISHED EDGE', 'SAME-DAY REPAIRS',
    'FRAMELESS SHOWER SCREENS', 'POOL-FENCE COMPLIANT GLASS', 'FREE ON-SITE QUOTES'
  ];
  function buildMarquee(id){
    var el = document.getElementById(id);
    el.innerHTML = specs.map(function(s){ return '<span>' + s + '</span>'; }).join('');
  }
  buildMarquee('marqueeTrack');
  buildMarquee('marqueeTrackDup');

  /* ---- lightbox (shared; opens for any card carrying gallery data) ---- */
  var lightbox = document.getElementById('lightbox');
  var lbClose = document.getElementById('lightboxClose');
  var lastFocused = null;
  function openLightbox(card){
    if (!card || !card.dataset || !card.dataset.img) return;
    lastFocused = document.activeElement;
    var lbPhoto = document.getElementById('lbPhoto');
    lbPhoto.classList.remove('loaded');
    lbPhoto.src = card.dataset.img;
    lbPhoto.alt = card.dataset.title;
    fadeIn(lbPhoto, card.dataset.img);
    document.getElementById('lbId').textContent = card.dataset.id;
    document.getElementById('lbTitle').textContent = card.dataset.title;
    document.getElementById('lbLoc').textContent = card.dataset.loc;
    document.getElementById('lbDesc').textContent = card.dataset.desc;
    document.getElementById('lbTag').textContent = card.dataset.tag;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }
  function closeLightbox(){
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    if(lastFocused){ lastFocused.focus(); }
  }
  window.GlassLightbox = { open: openLightbox, close: closeLightbox };
  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function(e){ if(e.target === lightbox){ closeLightbox(); } });
  lightbox.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && lightbox.classList.contains('open')){ closeLightbox(); }
    if(e.key === 'Tab' && lightbox.classList.contains('open')){
      var focusable = lightbox.querySelectorAll('button, a, [tabindex]:not([tabindex="-1"])');
      if(!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });

  /* ---- contact form ---- */
  var form = document.getElementById('quoteForm');
  var success = document.getElementById('formSuccess');
  var submitBtn = document.getElementById('submitBtn');
  var formError = document.getElementById('formError');
  var submitting = false;

  function setFieldError(name, msg) {
    var field = form.querySelector('[name="' + name + '"]');
    if (!field) return;
    field.classList.toggle('is-invalid', !!msg);
    var err = field.parentElement.querySelector('.field-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      err.setAttribute('role', 'alert');
      field.parentElement.appendChild(err);
    }
    err.textContent = msg || '';
    err.style.display = msg ? 'block' : 'none';
  }
  function clearErrors() {
    form.querySelectorAll('.is-invalid').forEach(function(el){ el.classList.remove('is-invalid'); });
    form.querySelectorAll('.field-error').forEach(function(el){ el.textContent = ''; el.style.display = 'none'; });
    if (formError) { formError.textContent = ''; formError.style.display = 'none'; }
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if (submitting) return;
    clearErrors();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    submitting = true;
    submitBtn.classList.add('is-busy');
    submitBtn.disabled = true;
    var label = submitBtn.querySelector('.btn-label');
    var origLabel = label.textContent;
    label.textContent = 'Sending\u2026';

    var data = new FormData(form);
    var payload = {
      name:    data.get('name'),
      phone:   data.get('phone'),
      suburb:  data.get('suburb'),
      job:     data.get('job'),
      message: data.get('message')
    };

    // Determine API base: same-origin when served by Node, else localhost fallback
    var apiBase = (window.location.port === '3001' || window.location.port === '' || window.location.port === '80' || window.location.port === '443')
      ? ''
      : 'http://localhost:3001';

    fetch(apiBase + '/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      return res.json().then(function(d) { return { ok: res.ok, data: d }; });
    })
    .then(function(result) {
      if (result.ok) {
        // Success
        form.reset();
        form.style.display = 'none';
        success.textContent = result.data.message || 'Thank you \u2014 we\u2019ll be in touch shortly!';
        success.classList.add('show');
        success.focus();
      } else {
        // Validation / server error
        if (result.data.fields) {
          Object.keys(result.data.fields).forEach(function(k) {
            setFieldError(k, result.data.fields[k]);
          });
          // Focus first invalid field
          var first = form.querySelector('.is-invalid');
          if (first) first.focus();
        } else {
          if (formError) {
            formError.textContent = result.data.error || 'Something went wrong. Please try calling us directly.';
            formError.style.display = 'block';
          }
        }
      }
    })
    .catch(function() {
      if (formError) {
        formError.textContent = 'Network error — please check your connection or call us on 0497\u00a0470\u00a0036.';
        formError.style.display = 'block';
      }
    })
    .finally(function() {
      submitting = false;
      submitBtn.classList.remove('is-busy');
      submitBtn.disabled = false;
      label.textContent = origLabel;
    });
  });

  /* ---- Hero Glass Finish Selector ---- */
  var hgsBtns = document.querySelectorAll('.hgs-btn');
  var heroTag = document.getElementById('heroTag');
  var heroChip1 = document.getElementById('heroChip1');
  var heroChip2 = document.getElementById('heroChip2');
  if (hgsBtns.length && heroTag) {
    hgsBtns.forEach(function(btn){
      btn.addEventListener('click', function(){
        hgsBtns.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var tagText = btn.getAttribute('data-tag');
        heroTag.innerHTML = '<i>●</i>&nbsp; ' + tagText;
        if(heroChip1 && heroChip2){
          var grade = btn.getAttribute('data-grade');
          if(grade === 'clear'){
            heroChip1.textContent = '10MM · ULTRA-CLEAR';
            heroChip2.textContent = 'LOW-IRON · TOUGHENED';
          } else if(grade === 'frosted'){
            heroChip1.textContent = '12MM · SATIN FROST';
            heroChip2.textContent = 'ACID-ETCHED · PRIVACY';
          } else if(grade === 'smoked'){
            heroChip1.textContent = '10MM · SMOKED TINT';
            heroChip2.textContent = 'ARCHITECTURAL BRONZE';
          } else if(grade === 'print'){
            heroChip1.textContent = '6MM · CERAMIC UV';
            heroChip2.textContent = 'CUSTOM HIGH-RES PRINT';
          }
        }
      });
    });
  }

  /* ---- Instant Glass Estimator ---- */
  (function(){
    var typeChips = document.querySelectorAll('.est-chip');
    var widthSlider = document.getElementById('estWidth');
    var heightSlider = document.getElementById('estHeight');
    var widthVal = document.getElementById('estWidthVal');
    var heightVal = document.getElementById('estHeightVal');
    var priceDisplay = document.getElementById('estPriceDisplay');
    var areaDisplay = document.getElementById('estAreaDisplay');
    var specDisplay = document.getElementById('estSpecDisplay');
    var gradeRadios = document.querySelectorAll('input[name="estGrade"]');
    var applyBtn = document.getElementById('estApplyBtn');

    if(!widthSlider || !heightSlider || !priceDisplay) return;

    var currentRate = 420;
    var currentType = 'Splashback';
    var currentSpec = '6mm Toughened';

    function calculateEstimate(){
      var w = parseInt(widthSlider.value, 10);
      var h = parseInt(heightSlider.value, 10);
      widthVal.textContent = w + ' mm';
      heightVal.textContent = h + ' mm';

      var areaSqM = (w / 1000) * (h / 1000);
      areaDisplay.textContent = areaSqM.toFixed(2) + ' m²';

      var multiplier = 1;
      var selectedGrade = document.querySelector('input[name="estGrade"]:checked');
      if(selectedGrade){
        if(selectedGrade.value === 'lowiron') multiplier = 1.15;
        else if(selectedGrade.value === 'frosted') multiplier = 1.20;
      }

      var basePrice = areaSqM * currentRate * multiplier;
      var minPrice = Math.round(Math.max(380, basePrice * 0.92));
      var maxPrice = Math.round(Math.max(480, basePrice * 1.15));

      priceDisplay.textContent = '$' + minPrice.toLocaleString('en-AU') + ' – $' + maxPrice.toLocaleString('en-AU');
      specDisplay.textContent = currentSpec;
    }

    typeChips.forEach(function(chip){
      chip.addEventListener('click', function(){
        typeChips.forEach(function(c){ c.classList.remove('active'); });
        chip.classList.add('active');
        currentRate = parseInt(chip.getAttribute('data-rate'), 10) || 420;
        currentType = chip.getAttribute('data-type') || 'Splashback';
        currentSpec = chip.getAttribute('data-thick') || '6mm Toughened';
        calculateEstimate();
      });
    });

    widthSlider.addEventListener('input', calculateEstimate);
    heightSlider.addEventListener('input', calculateEstimate);
    gradeRadios.forEach(function(r){ r.addEventListener('change', calculateEstimate); });

    if(applyBtn){
      applyBtn.addEventListener('click', function(){
        var jobSelect = document.getElementById('fJob');
        var msgArea = document.getElementById('fMsg');
        var contactSec = document.getElementById('contact');

        if(jobSelect){
          for(var i=0; i<jobSelect.options.length; i++){
            if(jobSelect.options[i].value === currentType || jobSelect.options[i].text.includes(currentType)){
              jobSelect.selectedIndex = i;
              break;
            }
          }
        }

        if(msgArea){
          var w = widthSlider.value;
          var h = heightSlider.value;
          var selectedGrade = document.querySelector('input[name="estGrade"]:checked');
          var gradeText = selectedGrade ? selectedGrade.parentElement.textContent.trim() : 'Standard';
          msgArea.value = 'Calculated Quote: ' + currentType + ' (' + w + 'mm × ' + h + 'mm), Grade: ' + gradeText + '. Estimated: ' + priceDisplay.textContent + '.';
        }

        if(contactSec){
          contactSec.scrollIntoView({ behavior: 'smooth' });
          var nameInput = document.getElementById('fName');
          if(nameInput) setTimeout(function(){ nameInput.focus(); }, 600);
        }
      });
    }

    calculateEstimate();
  })();

  /* ---- Before & After Transformation Slider ---- */
  (function(){
    var container = document.getElementById('baContainer');
    var beforeLayer = document.getElementById('baBeforeLayer');
    var handle = document.getElementById('baHandle');
    if(!container || !beforeLayer || !handle) return;

    var dragging = false;

    function setPosition(xPos){
      var rect = container.getBoundingClientRect();
      var offsetX = Math.max(0, Math.min(xPos - rect.left, rect.width));
      var percentage = (offsetX / rect.width) * 100;
      beforeLayer.style.width = percentage + '%';
      handle.style.left = percentage + '%';
    }

    function onPointerMove(e){
      if(!dragging) return;
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setPosition(clientX);
    }

    function onPointerDown(e){
      dragging = true;
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setPosition(clientX);
    }

    function onPointerUp(){
      dragging = false;
    }

    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    container.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
  })();
})();
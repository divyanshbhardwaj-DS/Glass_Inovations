(function(){
  "use strict";

  document.documentElement.classList.add('js');
  document.getElementById('year').textContent = new Date().getFullYear();

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- header scroll state + progress bar ---- */
  var header = document.getElementById('siteHeader');
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
  var submitting = false;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(submitting) return;
    if(!form.checkValidity()){ form.reportValidity(); return; }
    submitting = true;
    submitBtn.classList.add('is-busy');
    var label = submitBtn.querySelector('.btn-label');
    label.textContent = 'Preparing\u2026';
    var data = new FormData(form);
    var body = [
      'Name: ' + data.get('name'),
      'Phone: ' + data.get('phone'),
      'Suburb: ' + data.get('suburb'),
      'Job type: ' + data.get('job'),
      '',
      data.get('message') || ''
    ].join('%0D%0A');
    var subject = encodeURIComponent('Quote request \u2014 ' + data.get('job'));
    window.setTimeout(function(){
      window.location.href = 'mailto:info@completeglassinnovations.com.au?subject=' + subject + '&body=' + body;
      success.classList.add('show');
      success.focus();
      form.reset();
      label.textContent = 'Send enquiry';
      submitBtn.classList.remove('is-busy');
      submitting = false;
    }, 600);
  });
})();
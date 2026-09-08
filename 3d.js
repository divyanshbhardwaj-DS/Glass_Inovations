/* 3d.js — cinematic 3D hero scene (Three.js, vendored UMD build).
   Purposeful, not decorative: the photo panel is the brand imagery, side
   panels read as the frameless glass product, particles give the space depth,
   and lights/camera react to the cursor. Degrades to the static hero art and
   pauses itself off-screen / reduced-motion. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var mount = document.getElementById('hero3d');
  var has3d = false;
  if (!window.THREE || !mount) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer:fine)').matches;
  var coarse = window.matchMedia('(pointer:coarse)').matches;
  var tiny = window.innerWidth < 720;
  var lowCores = (navigator.hardwareConcurrency || 8) <= 4;
  var light = coarse || tiny || lowCores;

  var renderer, scene, camera;
  var group, cloud, accent, glint, ring;
  var camBase = 9.6;
  var pointer = { x: 0, y: 0 };
  var dragRot = 0, dragging = false, dragStartX = 0;
  var scrollSp = 0; /* 0 = hero visible, 1 = hero scrolled past */
  var visible = true, rafId = 0;

  try {
    var canvas = document.createElement('canvas');
    if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) throw new Error('no-webgl');

    var W = mount.clientWidth || 560;
    var H = mount.clientHeight || 480;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !light, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, light ? 1.6 : 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(canvas);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0c0e, 0.026);

    camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 60);
    adjustCamera();

    buildLights();
    buildPanels();
    buildParticles();

    if (coarse) {
      mount.addEventListener('pointerdown', function (e) { dragging = true; dragStartX = e.clientX; }, { passive: true });
      window.addEventListener('pointermove', function (e) {
        if (dragging) { dragRot = (e.clientX - dragStartX) / W; dragRot = Math.max(-1.2, Math.min(1.2, dragRot)); }
      }, { passive: true });
      window.addEventListener('pointerup', function () { dragging = false; }, { passive: true });
    } else {
      window.addEventListener('pointermove', function (e) {
        var r = mount.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      }, { passive: true });
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(resize).observe(mount);
    }
    window.addEventListener('resize', resize, { passive: true });

    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      start();
    }, { threshold: 0.02 });
    io.observe(mount);
    document.addEventListener('visibilitychange', start);

    mount.addEventListener('webglcontextlost', function (e) { e.preventDefault(); }, false);

    doc.classList.add('has-3d');
    has3d = true;
    window.Hero3D = {
      setScroll: function (p) { scrollSp = p || 0; }
    };

    if (reduce) {
      renderer.render(scene, camera);
      return;
    }
    start();
  } catch (err) {
    doc.classList.remove('has-3d');
    has3d = false;
  }

  function buildLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(new THREE.HemisphereLight(0x9aa1ac, 0x0b0c0e, 0.55));
    var key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 4, 7);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x99c2d4, 0.6);
    fill.position.set(-5, 1, -2);
    scene.add(fill);
    var back = new THREE.DirectionalLight(0x9aa1ac, 0.5);
    back.position.set(0, 0, 7);
    scene.add(back);
    accent = new THREE.PointLight(0xc8353a, 12, 26, 1.2);
    accent.position.set(-2.6, 1.2, 2.0);
    scene.add(accent);
    glint = new THREE.PointLight(0x8fb9c9, 3.2, 18, 1.8);
    glint.position.set(3, -2, 1.2);
    scene.add(glint);
  }

  function glassMat(opts) {
    opts = opts || {};
    return new THREE.MeshPhysicalMaterial({
      color: opts.color || 0xffffff,
      transparent: opts.transparent !== false,
      opacity: opts.opacity != null ? opts.opacity : 0.16,
      roughness: opts.roughness != null ? opts.roughness : 0.08,
      metalness: opts.metalness != null ? opts.metalness : 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  function panel(w, h, opts) {
    opts = opts || {};
    var geo = new THREE.PlaneGeometry(w, h);
    var mesh = new THREE.Mesh(geo, opts.mat);
    mesh.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
    if (opts.ry) mesh.rotation.y = opts.ry;
    if (opts.rx) mesh.rotation.x = opts.rx;
    group.add(mesh);

    var edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: opts.edgeColor || 0xffffff, transparent: true, opacity: opts.edgeOpacity != null ? opts.edgeOpacity : 0.3 })
    );
    edge.position.copy(mesh.position);
    edge.rotation.copy(mesh.rotation);
    group.add(edge);
    return mesh;
  }

  function imagePanel(w, h, url, opts) {
    opts = opts || {};
    var mesh = panel(w, h, {
      x: opts.x || 0, y: opts.y || 0, z: opts.z || 0,
      ry: opts.ry || 0, rx: opts.rx || 0,
      mat: new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.26, metalness: 0.04,
        clearcoat: 0.85, clearcoatRoughness: 0.3, side: THREE.DoubleSide
      })
    });
    var loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(url, function (tex) {
      if (!has3d) return;
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      mesh.material.map = tex;
      mesh.material.needsUpdate = true;
    }, undefined, function () {});
    return mesh;
  }

  function buildPanels() {
    group = new THREE.Group();
    scene.add(group);

    /* central photographic panel — brand imagery */
    var photo = panel(2.45, 3.35, { x: 0, y: -0.02, z: -0.35, ry: -0.12, mat: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.26, metalness: 0.04, clearcoat: 0.85, clearcoatRoughness: 0.3, side: THREE.DoubleSide }) });
    var img = document.getElementById('heroImg');
    if (img) {
      var loader = new THREE.TextureLoader();
      loader.crossOrigin = 'anonymous';
      loader.load(img.src, function (tex) {
        if (!has3d) return;
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        photo.material.map = tex;
        photo.material.needsUpdate = true;
      }, undefined, function () {});
    }

    /* extra photographic panels — pet through pet door + shower lifestyle shots */
    imagePanel(1.42, 2.0, 'https://images.unsplash.com/photo-1721070841873-c1d044993666?q=80&w=700&auto=format&fit=crop', { x: -1.98, y: 1.28, z: -0.72, ry: 0.74, rx: 0.05 });
    imagePanel(1.36, 1.92, 'https://images.unsplash.com/photo-1771929662486-f793e08f0f16?q=80&w=700&auto=format&fit=crop', { x: 1.98, y: 1.1, z: -0.6, ry: -0.7, rx: -0.04 });

    /* frameless glass accent panels */
    panel(0.95, 3.1, { x: -2.05, y: 0.08, z: -0.9, ry: 0.75, mat: glassMat({ color: 0xeef3f9, opacity: 0.32 }), edgeOpacity: 0.4 });
    panel(0.88, 2.85, { x: 1.95, y: -0.05, z: -0.75, ry: -0.62, mat: glassMat({ color: 0xf6f9fd, opacity: 0.34 }), edgeOpacity: 0.4 });
    panel(1.25, 1.25, { x: -0.85, y: -1.8, z: -1.35, ry: 0.5, rx: 0.12, mat: glassMat({ color: 0xc8353a, opacity: 0.52, roughness: 0.18 }), edgeOpacity: 0.45, edgeColor: 0xffd9da });
    panel(0.62, 0.62, { x: 1.1, y: -1.9, z: -1.5, ry: -0.42, rx: 0.1, mat: glassMat({ color: 0x8fb9c9, opacity: 0.4 }), edgeOpacity: 0.4, edgeColor: 0xbfe0ec });
    panel(0.42, 2.4, { x: -1.05, y: -1.55, z: -1.45, ry: 0.34, mat: glassMat({ color: 0xf6f9fd, opacity: 0.26 }), edgeOpacity: 0.32 });

    /* sleek accent ring orbiting the scene */
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, 0.028, 16, 120),
      new THREE.MeshBasicMaterial({ color: 0xf25a54, transparent: true, opacity: 0.34 })
    );
    ring.position.set(0, 0.1, -2.3);
    ring.rotation.x = 0.35;
    group.add(ring);
  }

  function makePoints(count, color, opacity, size, additive) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var i, x, y, z;
    for (i = 0; i < count; i++) {
      x = (Math.random() * 2 - 1) * 6.4;
      y = (Math.random() * 2 - 1) * 3.9;
      z = (Math.random() * 2 - 1) * 3.2 - 1.6;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: color, size: size, sizeAttenuation: true,
      transparent: true, opacity: opacity, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    return new THREE.Points(geo, mat);
  }

  function buildParticles() {
    cloud = new THREE.Group();
    scene.add(cloud);
    var steel = makePoints(light ? 80 : 220, 0xd6dde6, light ? 0.45 : 0.55, light ? 0.05 : 0.038, false);
    var sparks = makePoints(light ? 22 : 90, 0xf25a54, light ? 0.7 : 0.78, light ? 0.075 : 0.07, true);
    cloud.add(steel);
    cloud.add(sparks);
  }

  function adjustCamera() {
    if (!camera) return;
    var H = mount.clientHeight || 480;
    camBase = H >= 420 ? 9.6 : (H >= 340 ? 8.5 : 7.5);
  }

  function resize() {
    if (!renderer || !camera) return;
    var w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    adjustCamera();
  }

  function start() {
    if (rafId !== 0 || reduce || !has3d || !visible || document.hidden) return;
    rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    rafId = 0;
    var t = now / 1000;

    var ty, tx;
    if (coarse) {
      ty = dragRot * 0.7 + Math.sin(t * 0.05) * 0.05;
      tx = Math.sin(t * 0.06) * 0.03;
    } else {
      ty = pointer.x * 0.55 + Math.sin(t * 0.07) * 0.05;
      tx = -pointer.y * 0.22 + Math.sin(t * 0.08) * 0.03;
    }
    group.rotation.y += (ty - group.rotation.y) * 0.045;
    group.rotation.x += (tx - group.rotation.x) * 0.045;

    var pull = scrollSp;
    group.position.y = Math.sin(t * 0.5) * 0.07 - pull * 1.7;
    group.position.x = pull * 0.5;
    group.rotation.z = pull * 0.22;
    group.scale.setScalar(1 - pull * 0.18);

    var cx = (coarse ? pointer.x * 0.3 : pointer.x * 0.8);
    var cy = -pointer.y * 0.5 + 0.12;
    camera.position.x += (cx - camera.position.x) * 0.045;
    camera.position.y += (cy - camera.position.y) * 0.045;
    camera.position.z = camBase + pull * 2.4;
    camera.lookAt(0, 0.1, 0);

    accent.position.x = Math.sin(t * 0.45) * 3.2;
    accent.position.y = Math.cos(t * 0.4) * 1.2 + 0.3;
    accent.position.z = 1.7 + Math.cos(t * 0.32) * 1.0;
    glint.position.x = Math.cos(t * 0.22) * 3.4 + 1;
    glint.position.y = Math.sin(t * 0.18) * 1.2 - 2;

    cloud.rotation.y = t * 0.028;
    cloud.position.y = Math.sin(t * 0.12) * 0.12;

    if (ring) {
      ring.rotation.z = t * 0.5;
      ring.scale.setScalar(1 + Math.sin(t * 0.8) * 0.02);
    }

    renderer.render(scene, camera);
    start();
  }
}());
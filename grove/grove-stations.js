/* ===================================================================
   grove-stations.js — glowing markers at each great tree, proximity
   prompts, completion tracking, a numbered NEXT highlight, and a
   toggleable footpath that leads to the next stop in sequence.
   Exposes GROVE.stations.
   =================================================================== */
(function () {
  const T = AFRAME.THREE;
  const col = (h) => new T.Color(h);
  const C = window.GROVE.CONFIG;

  const S = { markers: [], active: null, root: null };

  /* ---------- numbered medallion sprite (state-aware) ----------
     state: 'next' | 'done' | 'upcoming'                              */
  function medallionTexture(station, state) {
    const W = 512, H = 360, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    const cx = W / 2, cy = 120, r = 80;

    // palette per state
    const theme = state === 'next'
      ? { ring: '#ffe07a', ring2: '#ffb33a', disc1: '#fff2cc', disc2: '#f0b948', num: '#3a2606', title: '#fff0cf', cap: '#ffd24a', capText: 'YOUR NEXT STOP' }
      : state === 'done'
        ? { ring: '#a7e08a', ring2: '#5f9e46', disc1: '#cdeeb6', disc2: '#6aa84c', num: '#22380f', title: '#cfe0bb', cap: '#8fce7a', capText: '✓ RECORDED' }
        : { ring: '#caa86a', ring2: '#6e5a36', disc1: '#3a3320', disc2: '#241f12', num: '#e8cf92', title: '#c4b48e', cap: '#9c8a5e', capText: 'STEP ' + station.num };

    // outer glow ring (stronger for NEXT)
    if (state === 'next') {
      const glow = g.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.7);
      glow.addColorStop(0, 'rgba(255,210,90,0.55)');
      glow.addColorStop(1, 'rgba(255,210,90,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, r * 1.7, 0, 7); g.fill();
    }
    // ring band
    g.lineWidth = state === 'upcoming' ? 5 : 9;
    g.strokeStyle = theme.ring; g.beginPath(); g.arc(cx, cy, r + 6, 0, 7); g.stroke();
    g.lineWidth = state === 'upcoming' ? 2 : 4;
    g.strokeStyle = theme.ring2; g.beginPath(); g.arc(cx, cy, r + 13, 0, 7); g.stroke();
    // disc
    const disc = g.createRadialGradient(cx - 18, cy - 24, 10, cx, cy, r);
    disc.addColorStop(0, theme.disc1); disc.addColorStop(1, theme.disc2);
    g.fillStyle = disc; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();

    g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 8;
    if (state === 'done') {
      // check mark
      g.strokeStyle = theme.num; g.lineWidth = 16; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - 34, cy + 2); g.lineTo(cx - 8, cy + 30); g.lineTo(cx + 40, cy - 30); g.stroke();
    } else {
      g.fillStyle = theme.num; g.font = '700 96px Cinzel, Georgia, serif';
      g.textBaseline = 'middle'; g.fillText(station.num, cx, cy + 4);
    }
    g.shadowBlur = 0; g.textBaseline = 'alphabetic';

    // downward pointer under a NEXT medallion ("walk here")
    if (state === 'next') {
      g.fillStyle = theme.ring; g.beginPath();
      g.moveTo(cx - 16, cy + r + 18); g.lineTo(cx + 16, cy + r + 18); g.lineTo(cx, cy + r + 38); g.closePath(); g.fill();
    }

    // title
    g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 12;
    g.fillStyle = theme.title; g.font = '600 38px Cinzel, Georgia, serif';
    g.fillText(station.title.toUpperCase(), cx, 268);
    // caption chip
    g.font = '600 23px Cinzel, Georgia, serif'; g.fillStyle = theme.cap;
    g.shadowBlur = 6; g.fillText(theme.capText, cx, 308);
    // subtitle (faint) for context
    g.font = 'italic 22px "EB Garamond", Georgia, serif';
    g.fillStyle = state === 'upcoming' ? 'rgba(196,180,142,0.6)' : 'rgba(220,206,170,0.85)';
    g.fillText(station.subtitle, cx, 340);
    g.shadowBlur = 0;

    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function setMedallion(m, state) {
    const u = m.userData;
    if (u.medState === state) return;
    u.medState = state;
    const tex = medallionTexture(u.station, state);
    if (u.spr.material.map) u.spr.material.map.dispose();
    u.spr.material.map = tex; u.spr.material.needsUpdate = true;
    // NEXT medallion sits a touch larger and higher
    const big = state === 'next';
    u.spr.scale.set(big ? 9.6 : 7.6, big ? 6.75 : 5.34, 1);
    u.sprBaseY = big ? 6.4 : 5.6;
  }

  /* ---------- glowing ground ring ---------- */
  function ringTex() {
    const Sz = 256, cv = document.createElement('canvas'); cv.width = cv.height = Sz;
    const g = cv.getContext('2d');
    g.translate(Sz / 2, Sz / 2);
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2;
      g.strokeStyle = `rgba(255,${200 + Math.random() * 40 | 0},${110 + Math.random() * 40 | 0},${0.5 + Math.random() * 0.4})`;
      g.lineWidth = 2 + Math.random() * 2;
      const r1 = 96, r2 = 116 + Math.random() * 8;
      g.beginPath();
      g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,214,120,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, 104, 0, Math.PI * 2); g.stroke();
    return new T.CanvasTexture(cv);
  }
  let _ringTex = null;

  function buildMarker(station) {
    const g = new T.Group();
    g.position.set(station.pos.x, 0, station.pos.z);
    const trunkR = station._trunkR || (station.marker === 'altar' ? 2.9 : 4.2);
    // glowing rune ring on the ground, just outside the trunk
    _ringTex = _ringTex || ringTex();
    const ringR = trunkR + 3.2;
    const ring = new T.Mesh(new T.PlaneGeometry(ringR * 2, ringR * 2),
      new T.MeshBasicMaterial({ map: _ringTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.7, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring); g.userData.ring = ring;
    // a soft warm glow column
    const beam = new T.Mesh(new T.CylinderGeometry(0.5, 1.4, 9, 12, 1, true),
      new T.MeshBasicMaterial({ color: col('#ffd27a'), transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
    beam.position.y = 4.5; g.add(beam); g.userData.beam = beam;
    const light = new T.PointLight(col('#ffcf86'), 2.4, 20, 2);
    light.position.set(0, 3, 0); g.add(light); g.userData.light = light;
    // floating numbered medallion, hovering in front of the trunk toward clearing center
    const spr = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthTest: true, depthWrite: false }));
    const toCenter = new T.Vector2(-station.pos.x, -station.pos.z);
    if (toCenter.lengthSq() < 0.01) toCenter.set(0, 1);
    toCenter.normalize();
    spr.position.set(toCenter.x * (trunkR + 1.5), 5.6, toCenter.y * (trunkR + 1.5));
    spr.renderOrder = 4;
    g.add(spr); g.userData.spr = spr;

    g.userData.station = station;
    g.userData.ph = Math.random() * 7;
    g.userData.sprBaseY = 5.6;
    g.userData.medState = null;
    setMedallion(g, 'upcoming');
    S.markers.push(g);
    return g;
  }

  S.build = function (root) {
    S.root = root;
    window.GROVE.STATIONS.forEach(st => root.add(buildMarker(st)));
    buildPath(root);
    S.refresh();
  };

  /* completion: required questions answered; all-optional stations
     count only once the visitor has actually opened them (so the
     sequence highlight never skips ahead or pre-checks a stop) */
  const VISITED = new Set();
  function isComplete(station) {
    const a = window.GROVE.knobe ? window.GROVE.knobe.answers : {};
    const hasRequired = station.questions.some(q => !/Optional/i.test(q.label));
    const requiredAnswered = station.questions.every(q =>
      /Optional/i.test(q.label) || (a[q.field] || '').trim().length > 0);
    if (hasRequired) return requiredAnswered;
    return VISITED.has(station.id);     // all-optional → done when visited
  }
  S.markVisited = function (id) { VISITED.add(id); S.refresh(); };
  S.isComplete = (st) => isComplete(st);

  // the recommended next station = first incomplete in order
  function nextIndex() {
    for (let i = 0; i < window.GROVE.STATIONS.length; i++) {
      if (!isComplete(window.GROVE.STATIONS[i])) return i;
    }
    return -1;
  }
  S.nextIndex = nextIndex;

  S.refresh = function () {
    const ni = nextIndex();
    S.markers.forEach((m, i) => {
      const done = isComplete(m.userData.station);
      m.userData.done = done;
      m.userData.isNext = (i === ni);
      setMedallion(m, done ? 'done' : (i === ni ? 'next' : 'upcoming'));
    });
    if (window.GROVE.ui) window.GROVE.ui.updateProgress(
      window.GROVE.STATIONS.filter(isComplete).length, window.GROVE.STATIONS.length);
  };

  /* ---------- proximity ---------- */
  let _near = null;
  S.checkProximity = function (pos) {
    let best = null, bestD = C.proximity;
    for (const m of S.markers) {
      const st = m.userData.station;
      const d = Math.hypot(pos.x - st.pos.x, pos.z - st.pos.z);
      const reach = (st._trunkR || 4) + C.proximity;   // larger trees → reach from farther
      if (d < reach && (!best || d < bestD)) { best = m; bestD = d; }
    }
    const st = best ? best.userData.station : null;
    if (st !== _near) {
      _near = st;
      S.active = st;
      if (window.GROVE.ui) window.GROVE.ui.showPrompt(st);
    }
  };

  S.openActive = function () {
    if (S.active && window.GROVE.ui) window.GROVE.ui.openTask(S.active);
  };
  S.getActive = function () { return S.active; };

  /* =================================================================
     GUIDING FOOTPATH — a flowing trail of glowing footprints from the
     visitor to the next incomplete station. Toggle with GROVE.stations
     .togglePath(). Hidden while a task panel is open.
     ================================================================= */
  const PATH = { group: null, prints: [], visible: true };

  function footstepTex() {
    const Sz = 128, cv = document.createElement('canvas'); cv.width = cv.height = Sz;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, Sz, Sz);
    // glowing footprint pointing UP (toward -v / top of canvas = travel direction)
    const paint = (cxp, cyp, rx, ry) => {
      const grd = g.createRadialGradient(cxp, cyp, 1, cxp, cyp, Math.max(rx, ry));
      grd.addColorStop(0, 'rgba(255,246,210,0.95)');
      grd.addColorStop(0.55, 'rgba(255,212,110,0.7)');
      grd.addColorStop(1, 'rgba(255,200,90,0)');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(cxp, cyp, rx, ry, 0, 0, 7); g.fill();
    };
    paint(Sz * 0.5, Sz * 0.40, 22, 30);   // ball of the foot (forward)
    paint(Sz * 0.5, Sz * 0.74, 15, 18);   // heel (back)
    // toe dots
    for (let i = -1; i <= 1; i++) paint(Sz * 0.5 + i * 13, Sz * 0.16, 5, 6);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function buildPath(root) {
    PATH.group = new T.Group();
    const tex = footstepTex();
    const N = 20;
    for (let i = 0; i < N; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(1.0, 1.5),
        new T.MeshBasicMaterial({
          map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
          opacity: 0, color: col('#ffdf8a'), fog: true,
        }));
      m.rotation.set(-Math.PI / 2, 0, 0);
      m.position.y = 0.12; m.visible = false; m.renderOrder = 3;
      PATH.group.add(m); PATH.prints.push(m);
    }
    root.add(PATH.group);
  }

  function hidePath() { for (const p of PATH.prints) p.visible = false; }

  function updatePath(tt) {
    if (!PATH.group) return;
    const player = window.GROVE.player;
    const ni = nextIndex();
    const taskEl = document.getElementById('task');
    const taskOpen = taskEl && taskEl.classList.contains('show');
    if (!PATH.visible || ni < 0 || !player || taskOpen) { hidePath(); return; }

    const st = window.GROVE.STATIONS[ni];
    const ax = player.pos.x, az = player.pos.z, bx = st.pos.x, bz = st.pos.z;
    let dx = bx - ax, dz = bz - az;
    const dist = Math.hypot(dx, dz) || 1; dx /= dist; dz /= dist;
    const reach = (st._trunkR || 4) + 3.5;
    const start = 2.4, end = Math.max(start, dist - reach);
    const span = end - start;
    if (span < 1.5) { hidePath(); return; }       // already there
    const heading = Math.atan2(dx, dz);
    const N = PATH.prints.length;
    const flow = (tt * 0.85) % 1;
    for (let i = 0; i < N; i++) {
      const f = (i + flow) / N;                    // 0 (near visitor) → 1 (near tree)
      const along = start + f * span;
      const side = (i % 2 ? 1 : -1) * 0.36;        // alternate left / right footfalls
      const px = ax + dx * along - dz * side;
      const pz = az + dz * along + dx * side;
      const p = PATH.prints[i];
      p.visible = true;
      p.position.set(px, 0.12, pz);
      p.rotation.set(-Math.PI / 2, 0, heading);
      const fade = Math.min(1, f / 0.10, (1 - f) / 0.14);
      const pulse = 0.55 + 0.45 * Math.sin(tt * 3 - i * 0.6);
      p.material.opacity = Math.max(0, fade) * pulse * 0.9;
    }
  }

  S.togglePath = function (force) {
    PATH.visible = (force != null) ? force : !PATH.visible;
    if (!PATH.visible) hidePath();
    if (window.GROVE.ui && window.GROVE.ui.setPathBtn) window.GROVE.ui.setPathBtn(PATH.visible);
    return PATH.visible;
  };
  S.isPathVisible = () => PATH.visible;

  /* ---------- per-frame marker animation ---------- */
  S.tick = function (time) {
    const tt = time / 1000;
    const ni = nextIndex();
    S.markers.forEach((m, i) => {
      const u = m.userData, done = u.done, isNext = (i === ni);
      const pulse = 0.5 + 0.5 * Math.sin(tt * 1.6 + u.ph);
      if (u.ring) {
        u.ring.rotation.z = tt * (isNext ? 0.25 : 0.06);
        u.ring.material.opacity = done ? 0.16 : (isNext ? 0.55 + pulse * 0.4 : 0.16 + pulse * 0.08);
        u.ring.material.color.set(done ? '#7fae5a' : (isNext ? '#ffd24a' : '#b78a4a'));
      }
      if (u.light) u.light.intensity = done ? 0.8 : (isNext ? 2.6 + pulse * 2.0 : 0.9 + pulse * 0.4);
      if (u.beam) u.beam.material.opacity = done ? 0.05 : (isNext ? 0.14 + pulse * 0.12 : 0.05);
      if (u.spr) {
        u.spr.position.y = (u.sprBaseY || 5.6) + Math.sin(tt * 0.8 + u.ph) * (isNext ? 0.26 : 0.14);
        u.spr.material.opacity = done ? 0.62 : (isNext ? 1 : 0.5);
      }
    });
    updatePath(tt);
  };

  window.GROVE.stations = S;
})();

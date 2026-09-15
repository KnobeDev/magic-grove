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

  // footprint reach per marker kind (no big trunk for signs/roots/cone/layers)
  const MARKER_R = {
    sign: 1.8, stumpstory: 1.8, parting: 1.8, barktree: 4.6,
    stumplayer: 1.6, roots: 2.4, cone: 2.0, altar: 2.9,
  };
  function trunkRadius(st) { return st._trunkR || MARKER_R[st.marker] || 3.5; }

  function terrainAt(x, z) {
    return window.GROVE.terrainHeight ? window.GROVE.terrainHeight(x, z) : 0;
  }

  function buildMarker(station) {
    const g = new T.Group();
    const baseY = terrainAt(station.pos.x, station.pos.z);   // ride the stump top
    g.position.set(station.pos.x, baseY, station.pos.z);
    const trunkR = trunkRadius(station);
    const onStump = station.marker === 'stumplayer';
    const isTunnel = station.marker === 'barktree';
    // shorter, tighter glow for the small props so they don't tower
    const beamH = onStump ? 6 : (trunkR > 4 ? 9 : 7);
    // the tunnel tree's medallion drops into the open archway mouth (low, and
    // pushed south past the trunk face) so it reads clearly instead of hiding
    // up at the lintel behind the resuming upper trunk.
    const sprBaseY = isTunnel ? 11 : onStump ? 4.2 : (trunkR > 4 ? 5.6 : 4.6);   // tunnel: above the arch, on the trunk face
    const sprZ = isTunnel ? trunkR + 2.5 : trunkR + 1.5;
    // glowing rune ring on the ground, just outside the prop
    _ringTex = _ringTex || ringTex();
    const ringR = trunkR + 3.0;
    const ring = new T.Mesh(new T.PlaneGeometry(ringR * 2, ringR * 2),
      new T.MeshBasicMaterial({ map: _ringTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.7, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring); g.userData.ring = ring;
    // a soft warm glow column
    const beam = new T.Mesh(new T.CylinderGeometry(0.5, 1.4, beamH, 12, 1, true),
      new T.MeshBasicMaterial({ color: col('#ffd27a'), transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
    beam.position.y = beamH / 2; g.add(beam); g.userData.beam = beam;
    const light = new T.PointLight(col('#ffcf86'), 2.4, 20, 2);
    light.position.set(0, 3, 0); g.add(light); g.userData.light = light;
    // floating numbered medallion — offset toward the walker's approach (south).
    // The tunnel tree wraps geometry AROUND its medallion, so depth-testing lets
    // the arch/trunk eat it — draw it depth-test-free and on top there so it stays
    // readable in the archway no matter the angle.
    const spr = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthTest: !isTunnel, depthWrite: false }));
    spr.position.set(0, sprBaseY, sprZ);   // +Z = south, toward the path
    spr.renderOrder = isTunnel ? 12 : 4;
    g.add(spr); g.userData.spr = spr;

    g.userData.station = station;
    g.userData.ph = Math.random() * 7;
    g.userData.sprBaseY = sprBaseY;
    g.userData.medState = null;
    setMedallion(g, 'upcoming');
    // the Seed altar marker stays hidden until The Parting reveals it
    if (station.hiddenUntilReturn) g.visible = false;
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
  S.seedRevealed = false;
  // the Seed stays out of the sequence until The Parting sends you home
  function isHidden(station) { return station.hiddenUntilReturn && !S.seedRevealed; }

  function isComplete(station) {
    if (isHidden(station)) return false;
    const a = window.GROVE.knobe ? window.GROVE.knobe.answers : {};
    const hasRequired = station.questions.some(q => !/Optional/i.test(q.label));
    const requiredAnswered = station.questions.every(q =>
      /Optional/i.test(q.label) || (a[q.field] || '').trim().length > 0);
    if (hasRequired) return requiredAnswered;
    return VISITED.has(station.id);     // all-optional → done when visited
  }
  S.markVisited = function (id) { VISITED.add(id); S.refresh(); };
  S.isComplete = (st) => isComplete(st);

  /* Reveal the Seed back at the visitor's center once The Parting is done. */
  S.revealSeed = function () {
    if (S.seedRevealed) return;
    S.seedRevealed = true;
    const m = S.markers.find(mk => mk.userData.station.isSeed);
    if (m) m.visible = true;
    if (window.GROVE.revealSeed) window.GROVE.revealSeed();   // env: altar mesh + blocker
    S.refresh();
    if (window.GROVE.ui && window.GROVE.ui.toast)
      window.GROVE.ui.toast('A seed has appeared at the visitor\u2019s center');
  };

  // the recommended next station = first incomplete in order (skipping hidden)
  function nextIndex() {
    for (let i = 0; i < window.GROVE.STATIONS.length; i++) {
      const st = window.GROVE.STATIONS[i];
      if (isHidden(st)) continue;
      if (!isComplete(st)) return i;
    }
    return -1;
  }
  S.nextIndex = nextIndex;

  /* Stops must be taken in order: anything past the next incomplete stop is
     locked until that stop is completed. Returns the gating station, or null. */
  S.lockedBy = function (station) {
    const ni = nextIndex();
    if (ni < 0) return null;
    const idx = window.GROVE.STATIONS.indexOf(station);
    return idx > ni ? window.GROVE.STATIONS[ni] : null;
  };

  S.refresh = function () {
    // completing The Parting opens the way back to the Seed
    const parting = window.GROVE.STATIONS.find(st => st.returnsTo);
    if (parting && !S.seedRevealed && isComplete(parting)) { S.revealSeed(); return; }
    const ni = nextIndex();
    S.markers.forEach((m, i) => {
      const st = m.userData.station;
      if (isHidden(st)) { m.visible = false; return; }
      m.visible = true;
      const done = isComplete(st);
      m.userData.done = done;
      m.userData.isNext = (i === ni);
      setMedallion(m, done ? 'done' : (i === ni ? 'next' : 'upcoming'));
    });
    // Section 07 (Heartwood) complete → the underground root network lights up and stays
    if (window.GROVE.revealRoots) {
      const s7 = window.GROVE.STATIONS[6];
      if (s7 && isComplete(s7)) window.GROVE.revealRoots();
    }
    if (window.GROVE.ui) window.GROVE.ui.updateProgress();
    _near = null;   // completion changed: re-evaluate the prompt where the visitor stands (locks lift in place)
  };

  /* ---------- proximity (stations + fallen-log exhibits) ---------- */
  let _near = null;
  S.activeKind = null;
  S.checkProximity = function (pos) {
    let best = null, bestD = Infinity, kind = null;
    for (const m of S.markers) {
      const st = m.userData.station;
      if (isHidden(st)) continue;                      // seed is silent until revealed
      const d = Math.hypot(pos.x - st.pos.x, pos.z - st.pos.z);
      const reach = trunkRadius(st) + C.proximity;     // larger props → reach from farther
      if (d < reach && d < bestD) { best = st; bestD = d; kind = 'station'; }
    }
    const exhibits = window.GROVE.logExhibits || [];
    for (const e of exhibits) {
      const d = Math.hypot(pos.x - e.x, pos.z - e.z);
      if (d < C.proximity + 2 && d < bestD) { best = e; bestD = d; kind = 'exhibit'; }
    }
    // the seed trophy at the entrance (only once the seed has been taken)
    const F = window.GROVE.finale;
    if (F && F.taken) {
      const d = Math.hypot(pos.x - F.pos.x, pos.z - F.pos.z);
      if (d < C.proximity + 2 && d < bestD) { best = F; bestD = d; kind = 'trophy'; }
    }
    if (best !== _near) {
      // notify ONLY when stepping into the active element — the station the
      // wayfinding currently leads to (next incomplete), or the trophy once it
      // holds the seed. Props you pass before it is their turn stay quiet;
      // exhibits aren't part of the guided sequence.
      const isActive = best && (
        (kind === 'station' && window.GROVE.STATIONS.indexOf(best) === nextIndex()) ||
        (kind === 'trophy' && !F.visited));
      if (isActive && window.GROVE.spatial && window.GROVE.spatial.notify) window.GROVE.spatial.notify();
      _near = best;
      S.active = best;
      S.activeKind = kind;
      if (window.GROVE.ui) {
        if (kind === 'exhibit') window.GROVE.ui.showExhibitPrompt(best);
        else if (kind === 'trophy') F.showPrompt();
        else window.GROVE.ui.showPrompt(best);         // station or null → hides
      }
    }
  };

  S.openActive = function () {
    if (!S.active || !window.GROVE.ui) return;
    if (S.activeKind === 'exhibit') window.GROVE.ui.openExhibit(S.active);
    else if (S.activeKind === 'trophy') window.GROVE.finale.open();
    else window.GROVE.ui.openTask(S.active);
  };

  /* Where the wayfinding (footpath + guiding sound) leads right now: the next
     incomplete station, else the seed trophy until it has been visited. */
  function guideTarget() {
    const F = window.GROVE.finale;
    if (F && F.taken && !F.visited) return { x: F.pos.x, z: F.pos.z, reach: 3.4, key: 'trophy' };
    const ni = nextIndex();
    if (ni >= 0) {
      const st = window.GROVE.STATIONS[ni];
      return { x: st.pos.x, z: st.pos.z, reach: trunkRadius(st) + 3.5, key: 's' + ni };
    }
    return null;
  }
  S.guideTarget = guideTarget;
  S.getActive = function () { return S.active; };

  /* =================================================================
     GUIDING FOOTPATH — a spaced trail of glowing footprints from the
     visitor to the next incomplete station. Toggle with GROVE.stations
     .togglePath(). Hidden while a task panel is open.
     ================================================================= */
  const PATH = { group: null, ribbon: null, tex: null, visible: true, route: null, routeKey: '', geomKey: '' };
  const pathMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const ROUTE_CLEAR = 1.6;   // keep the ribbon this far outside any blocker edge
  const RIBBON_W = 0.9;      // ribbon width (u)
  const RIBBON_STEP = 0.5;   // sample spacing along the route (u)
  const CHEVRON_PERIOD = 1.6; // one chevron every this many units of trail

  /* one chevron, tip toward +v (the direction of travel), on a soft glowing band */
  function chevronTex() {
    const W = 64, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    // faint band down the middle so the ribbon reads as one continuous trail
    const band = g.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, 'rgba(255,214,120,0)');
    band.addColorStop(0.5, 'rgba(255,214,120,0.28)');
    band.addColorStop(1, 'rgba(255,214,120,0)');
    g.fillStyle = band; g.fillRect(0, 0, W, H);
    // the chevron (canvas top = v 1 = toward the stop)
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = 'rgba(255,230,160,0.9)'; g.shadowBlur = 10;
    g.strokeStyle = 'rgba(255,246,214,0.98)'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(12, 84); g.lineTo(32, 44); g.lineTo(52, 84); g.stroke();
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = T.ClampToEdgeWrapping; tex.wrapT = T.RepeatWrapping;
    return tex;
  }

  function buildPath(root) {
    PATH.group = new T.Group();
    PATH.tex = chevronTex();
    PATH.ribbon = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({
      map: PATH.tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      color: col('#ffdf8a'), opacity: 0.9, side: T.DoubleSide, fog: true,
    }));
    PATH.ribbon.renderOrder = 3; PATH.ribbon.visible = false; PATH.ribbon.frustumCulled = false;
    PATH.group.add(PATH.ribbon);
    root.add(PATH.group);
  }

  /* lay the ribbon along the route from `start` to `end` (arc lengths): a strip
     of quads hugging the terrain, v running with the arc so chevrons tile evenly */
  function layRibbon(route, start, end) {
    const n = Math.max(2, Math.ceil((end - start) / RIBBON_STEP) + 1);
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2);
    const idx = [];
    for (let i = 0; i < n; i++) {
      const arc = Math.min(end, start + i * RIBBON_STEP);
      const s = sampleRoute(route, arc);
      const px = -s.hz, pz = s.hx;                 // unit perpendicular (left)
      const hw = RIBBON_W / 2 * Math.min(1, (arc - start) / 1.5, (end - arc) / 2 + 0.35);  // taper the ends
      const lx = s.x + px * hw, lz = s.z + pz * hw, rx = s.x - px * hw, rz = s.z - pz * hw;
      pos.set([lx, terrainAt(lx, lz) + 0.1, lz, rx, terrainAt(rx, rz) + 0.1, rz], i * 6);
      const v = arc / CHEVRON_PERIOD;
      uv.set([0, v, 1, v], i * 4);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const old = PATH.ribbon.geometry; PATH.ribbon.geometry = geo; if (old) old.dispose();
  }

  function hidePath() { if (PATH.ribbon) PATH.ribbon.visible = false; }

  /* ---- obstacle-aware wayfinding route ----
     The footpath used to be a straight line from the visitor to the next stop,
     so it plowed through trunks. Instead we build a polyline that steers around
     GROVE.blockers (each {x,z,r}) and flow the footprints along its arc length.
     Recomputed only when the player/target/obstacle-set changes meaningfully. */

  // deepest blocker the segment A→B passes through (within ROUTE_CLEAR), or null.
  // Blockers belonging to the destination prop (within skipR of B) are ignored —
  // the path stops short of the prop anyway, so its own trunk must not deflect it.
  function segBlocker(ax, az, bx, bz, skipR) {
    const blk = window.GROVE.blockers || [];
    const ex = bx - ax, ez = bz - az;
    const L2 = ex * ex + ez * ez || 1;
    let hit = null, worst = 0;
    for (const b of blk) {
      if (Math.hypot(b.x - bx, b.z - bz) <= skipR) continue;
      let t = ((b.x - ax) * ex + (b.z - az) * ez) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + ex * t, cz = az + ez * t;
      const d = Math.hypot(b.x - cx, b.z - cz);
      const need = b.r + ROUTE_CLEAR;
      if (d < need) { const pen = need - d; if (pen > worst) { worst = pen; hit = { b: b, cx: cx, cz: cz }; } }
    }
    return hit;
  }

  // recursively insert a clearance waypoint around the first blocker hit
  function routeSeg(ax, az, bx, bz, skipR, out, depth) {
    const hit = depth < 6 ? segBlocker(ax, az, bx, bz, skipR) : null;
    if (!hit) { out.push({ x: bx, z: bz }); return; }
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    const px = -dz / L, pz = dx / L;                       // unit perpendicular
    const dPerp = (hit.cx - hit.b.x) * px + (hit.cz - hit.b.z) * pz;
    const sign = dPerp >= 0 ? 1 : -1;                      // pass on the side the line already favors
    const off = hit.b.r + ROUTE_CLEAR + 0.4;
    const wx = hit.b.x + px * sign * off, wz = hit.b.z + pz * sign * off;
    routeSeg(ax, az, wx, wz, skipR, out, depth + 1);
    routeSeg(wx, wz, bx, bz, skipR, out, depth + 1);
  }

  function buildRoute(ax, az, bx, bz, skipR) {
    const pts = [{ x: ax, z: az }];
    routeSeg(ax, az, bx, bz, skipR, pts, 0);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    return { pts: pts, cum: cum, len: cum[cum.length - 1] };
  }

  // position + unit heading at a given arc length along the route
  function sampleRoute(route, arc) {
    const pts = route.pts, cum = route.cum;
    for (let i = 1; i < pts.length; i++) {
      if (arc <= cum[i] || i === pts.length - 1) {
        const segLen = cum[i] - cum[i - 1] || 1;
        const f = Math.max(0, Math.min(1, (arc - cum[i - 1]) / segLen));
        let hx = pts[i].x - pts[i - 1].x, hz = pts[i].z - pts[i - 1].z;
        const h = Math.hypot(hx, hz) || 1;
        return { x: pts[i - 1].x + hx * f, z: pts[i - 1].z + hz * f, hx: hx / h, hz: hz / h };
      }
    }
    const last = pts[pts.length - 1];
    return { x: last.x, z: last.z, hx: 0, hz: 1 };
  }

  function updatePath(tt) {
    if (!PATH.ribbon) return;
    const player = window.GROVE.player;
    const tg = guideTarget();
    const taskEl = document.getElementById('task');
    const taskOpen = taskEl && taskEl.classList.contains('show');
    if (!PATH.visible || !tg || !player || taskOpen) { hidePath(); return; }

    const ax = player.pos.x, az = player.pos.z, bx = tg.x, bz = tg.z;
    const reach = tg.reach;

    // recompute the avoiding route only when something material changed
    const blkN = (window.GROVE.blockers || []).length;
    const key = tg.key + ':' + Math.round(ax / 2) + ':' + Math.round(az / 2) + ':' + blkN;
    if (key !== PATH.routeKey || !PATH.route) {
      PATH.route = buildRoute(ax, az, bx, bz, reach);
      PATH.routeKey = key;
    }
    const route = PATH.route;
    const start = 1.6, end = route.len - reach;
    if (end - start < 1.5) { hidePath(); return; }       // already there

    // re-lay the strip only when the route (or the walker's fine position) moved
    const gk = key + ':' + Math.round(ax * 4) + ':' + Math.round(az * 4);
    if (gk !== PATH.geomKey) { layRibbon(route, start, end); PATH.geomKey = gk; }
    PATH.ribbon.visible = true;
    // chevrons flow toward the stop; a held pattern under reduced motion
    PATH.tex.offset.y = (pathMotion && pathMotion.matches) ? 0 : -((tt * 0.9) % 1);
    PATH.ribbon.material.opacity = 0.85;
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

    // Emit the spatial guiding sound FROM the next incomplete stop, so its
    // HRTF panning + distance pull the visitor toward it. null when none
    // remain. Only audible once the visitor turned the sound on.
    if (window.GROVE.spatial) {
      const tg = guideTarget();
      window.GROVE.spatial.setTarget(tg ? { x: tg.x, z: tg.z } : null);
    }
  };

  window.GROVE.stations = S;
})();

/* ===================================================================
   grove-env.js — builds the campground-map grove as a 3D world.
   Two sunlit clearings joined by a forest path:
     · Visitor's Center (south)  — three whiteboards + the seed altar
     · The Grove (north)         — the walkable Mother stump, glowing
                                    roots, and a fallen cone off the path
   Exposes GROVE.blockers (collision), GROVE.shafts, GROVE.motes,
   GROVE.roots (pulsing root-glow), GROVE.seedAltar, GROVE.groundTexture.
   The Mother stump is walkable: GROVE.terrainHeight(x,z) (defined in
   grove-data.js) raises the player up its sloped edge onto the top.
   =================================================================== */
(function () {
  const T = AFRAME.THREE;
  const col = (h) => new T.Color(h);
  const C = window.GROVE.CONFIG;
  const VC = C.visitorCenter, GC = C.groveCenter, ST = C.stump, CN = C.cone;

  const blockers = [];                 // {x,z,r} trunk/prop footprints
  window.GROVE.blockers = blockers;
  window.GROVE.shafts = [];
  window.GROVE.motes = [];
  window.GROVE.roots = [];
  window.GROVE.fireflies = null;       // night-mode glowing drifters (Points)
  window.GROVE.isNight = false;
  window.GROVE.logExhibits = [];       // {x,z,glow,labels[],lines[],ph} cross-section easter eggs

  const mat = (hex, o = {}) => new T.MeshStandardMaterial(
    Object.assign({ color: col(hex), roughness: 0.95, metalness: 0 }, o));

  /* ---------- roots glow up through the GROUND only (no stencil buffer) ------
     A-Frame's renderer ships without a stencil buffer, so the reveal is done
     with the depth buffer instead: the ground is drawn with depthWrite OFF
     (it never occludes anything below it), while the deep roots keep depth
     TESTING on. Result: in open ground the roots show through the earth, but
     trees, the stump, props, and the avatar — which all write depth — stay
     fully opaque over them (never X-rayed). The sky is pinned to the far
     background so the depth-less ground never lets it bleed through.        */

  /* ---------- keep-clear test: clearings + path corridor stay open ---------- */
  function inClearing(x, z) {
    if (Math.hypot(x - VC.x, z - VC.z) < VC.r + 2) return true;     // visitor center
    if (Math.hypot(x - GC.x, z - GC.z) < GC.r + 2) return true;     // grove
    if (Math.abs(x) < 9 && z < VC.z && z > GC.z) return true;       // path corridor
    if (Math.hypot(x - CN.x, z - CN.z) < 9) return true;            // cone glade
    return false;
  }

  /* ---------- forest-floor ground texture (duff, two clearings, path) ---------- */
  function groundTexture() {
    const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const G = C.ground;
    const toUV = (x, z) => [(x + G / 2) / G * S, (z + G / 2) / G * S];
    const px = (u) => u / G * S;                       // world length → pixels
    // base: warm forest duff
    g.fillStyle = '#352c1c'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5600; i++) {                   // needle/duff mottle
      const x = Math.random() * S, y = Math.random() * S;
      g.fillStyle = `rgba(${70 + Math.random() * 40 | 0},${48 + Math.random() * 26 | 0},${24 | 0},${0.06 + Math.random() * 0.16})`;
      g.beginPath(); g.arc(x, y, 1.5 + Math.random() * 7, 0, 7); g.fill();
    }
    // two sunlit clearings (lighter golden grass)
    const clearing = (cx, cz, rad) => {
      const [ux, uy] = toUV(cx, cz), pr = px(rad);
      const rg = g.createRadialGradient(ux, uy, pr * 0.1, ux, uy, pr);
      rg.addColorStop(0, '#7e6b34'); rg.addColorStop(0.55, '#5f5326');
      rg.addColorStop(0.85, '#473d23'); rg.addColorStop(1, 'rgba(53,44,28,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(ux, uy, pr, 0, 7); g.fill();
    };
    clearing(VC.x, VC.z, VC.r);
    clearing(GC.x, GC.z, GC.r);
    clearing(CN.x, CN.z, 9);
    // grass tufts in the clearings
    for (let i = 0; i < 2600; i++) {
      const inV = Math.random() < 0.5;
      const cx = inV ? VC.x : GC.x, cz = inV ? VC.z : GC.z, rad = inV ? VC.r : GC.r;
      const a = Math.random() * 7, r = Math.random() * rad;
      const [ux, uy] = toUV(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
      g.fillStyle = `rgba(${150 + Math.random() * 50 | 0},${130 + Math.random() * 40 | 0},${50 + Math.random() * 30 | 0},${0.05 + Math.random() * 0.13})`;
      g.beginPath(); g.arc(ux, uy, 1.5 + Math.random() * 6, 0, 7); g.fill();
    }
    // the trail: visitor center → grove, plus a spur to the cone
    const route = [
      { x: 0, z: VC.z + 4 }, { x: 2, z: 40 }, { x: -3, z: 20 },
      { x: 2, z: 0 }, { x: -2, z: -22 }, { x: 0, z: GC.z + 8 },
    ];
    const spur = [{ x: GC.x + 10, z: GC.z - 6 }, { x: 26, z: -54 }, { x: CN.x, z: CN.z }];
    g.lineJoin = g.lineCap = 'round';
    const drawPath = (poly, wd, color) => {
      const pts = poly.map(p => toUV(p.x, p.z));
      g.strokeStyle = color; g.lineWidth = wd; g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        g.quadraticCurveTo(a[0], a[1], mx, my);
      }
      g.stroke();
    };
    [[route, 44, 'rgba(74,58,36,0.5)'], [route, 28, 'rgba(110,86,52,0.6)'], [route, 15, 'rgba(140,112,66,0.55)'],
     [spur, 26, 'rgba(96,76,46,0.5)'], [spur, 13, 'rgba(132,104,62,0.5)']]
      .forEach(([poly, wd, c]) => drawPath(poly, wd, c));
    const tex = new T.CanvasTexture(cv); tex.anisotropy = 8; tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* ---------- tree-ring texture for the walkable Mother stump top ---------- */
  function stumpRingTexture() {
    const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); const c = S / 2;
    g.fillStyle = '#6b4326'; g.fillRect(0, 0, S, S);
    // concentric growth rings, sapwood (pale outer) → heartwood (dark inner) → pith
    const rings = 120;
    for (let i = rings; i >= 0; i--) {
      const f = i / rings;                 // 1 outer → 0 center
      const rad = c * (0.04 + f * 0.95);
      // pale sapwood band on the outer third, warm heartwood inside
      let base;
      if (f > 0.72) base = [196, 170, 120];        // sapwood sleeve (pale)
      else if (f > 0.2) base = [150, 92, 50];      // heartwood (red-brown)
      else base = [110, 60, 34];                   // pith (dark)
      const jit = (Math.sin(i * 2.3) + Math.random() - 0.5) * 14;
      const light = (i % 2 === 0) ? 18 : -10;      // alternating ring contrast
      g.strokeStyle = `rgb(${base[0] + jit + light | 0},${base[1] + jit * 0.7 + light | 0},${base[2] + jit * 0.5 + light | 0})`;
      g.lineWidth = 2 + Math.random() * 3.5;
      g.beginPath();
      // slightly irregular ring (not a perfect circle)
      for (let a = 0; a <= 64; a++) {
        const ang = a / 64 * Math.PI * 2;
        const wob = 1 + Math.sin(ang * 5 + i) * 0.012 + Math.sin(ang * 11) * 0.008;
        const x = c + Math.cos(ang) * rad * wob, y = c + Math.sin(ang) * rad * wob;
        a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath(); g.stroke();
    }
    // radial heartwood cracks
    g.strokeStyle = 'rgba(40,22,12,0.6)'; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      g.lineWidth = 3 + Math.random() * 6; g.beginPath();
      g.moveTo(c + Math.cos(a) * c * 0.05, c + Math.sin(a) * c * 0.05);
      let r = c * 0.05, ang = a;
      while (r < c * 0.9) { r += 18 + Math.random() * 20; ang += (Math.random() - 0.5) * 0.3; g.lineTo(c + Math.cos(ang) * r, c + Math.sin(ang) * r); }
      g.stroke();
    }
    const tex = new T.CanvasTexture(cv); tex.anisotropy = 8; tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* ---------- soft round shadow blob under big props ---------- */
  let _blob = null;
  function blobTex() {
    if (_blob) return _blob;
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const rg = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
    rg.addColorStop(0, 'rgba(20,14,8,0.5)'); rg.addColorStop(1, 'rgba(20,14,8,0)');
    g.fillStyle = rg; g.fillRect(0, 0, S, S);
    _blob = new T.CanvasTexture(cv); return _blob;
  }
  function groundBlob(x, z, r) {
    const m = new T.Mesh(new T.PlaneGeometry(r, r),
      new T.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); return m;
  }

  /* ---------- shared trunk cross-section ("Giant Sequoia Trunk Cross-Section") ---------- */
  let _xsecTex = null;
  function crossSectionTex() { return _xsecTex || (_xsecTex = stumpRingTexture()); }

  /* small billboarded label with a transparent background, for in-world ring callouts */
  function labelSprite(text, hex) {
    const W = 512, H = 110, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.font = '700 52px "JetBrains Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = 'rgba(8,12,6,0.92)';
    g.strokeText(text, W / 2, H / 2);
    g.fillStyle = hex; g.fillText(text, W / 2, H / 2);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const spr = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    spr.renderOrder = 6; spr.scale.set(W / H * 0.46, 0.46, 1);
    return spr;
  }

  /* the exposed, labelled end of an exhibit log: cross-section cap + a faint
     glow ring and three ring-band callouts that fade in as the visitor nears */
  function exhibitEnd(g, s, len, r) {
    const L = s * len / 2;
    const cap = new T.Mesh(new T.CircleGeometry(r, 32),
      new T.MeshStandardMaterial({ map: crossSectionTex(), color: col('#d8c49a'), roughness: 0.95 }));
    cap.position.set(L, 0, 0); cap.rotation.y = s * Math.PI / 2; g.add(cap);

    const glow = new T.Mesh(new T.RingGeometry(r * 0.5, r * 1.14, 40),
      new T.MeshBasicMaterial({ color: col('#ffd27a'), transparent: true, opacity: 0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, fog: false }));
    glow.position.set(L + s * 0.04, 0, 0); glow.rotation.y = s * Math.PI / 2; g.add(glow);

    // annotation group shares the cap orientation; labels billboard regardless
    const ann = new T.Group(); ann.position.set(L + s * 0.08, 0, 0); ann.rotation.y = s * Math.PI / 2; g.add(ann);
    const bands = [
      { t: 'FIRE-RESISTANT BARK', c: '#e8c98a', br: r * 1.0, lr: r * 1.5, a: Math.PI * 0.5 },
      { t: 'LIVING SAPWOOD', c: '#f0d488', br: r * 0.74, lr: r * 1.55, a: Math.PI * 1.2 },
      { t: 'DENSE HEARTWOOD', c: '#e0936a', br: r * 0.3, lr: r * 1.55, a: Math.PI * 1.8 },
    ];
    const labels = [], lines = [];
    bands.forEach(b => {
      const bx = Math.cos(b.a) * b.br, by = Math.sin(b.a) * b.br;
      const lx = Math.cos(b.a) * b.lr, ly = Math.sin(b.a) * b.lr;
      const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(bx, by, 0.02), new T.Vector3(lx, ly, 0.02)]);
      const line = new T.Line(geo, new T.LineBasicMaterial({ color: col(b.c), transparent: true, opacity: 0, depthTest: false, fog: false }));
      line.renderOrder = 5; ann.add(line); lines.push(line);
      const spr = labelSprite(b.t, b.c);
      spr.position.set(lx + Math.cos(b.a) * 0.7, ly + Math.sin(b.a) * 0.25, 0.02);
      ann.add(spr); labels.push(spr);
    });
    return { glow, labels, lines };
  }

  /* ---------- fallen log (the two `exhibit` logs are interactive easter eggs) ---------- */
  function fallenLog(x, z, len, rot, exhibit) {
    const g = new T.Group();
    const { map } = window.GROVE.barkTexture();
    const tmap = map.clone(); tmap.needsUpdate = true; tmap.wrapS = tmap.wrapT = T.RepeatWrapping;
    tmap.repeat.set(len / 5, 2);
    const r = exhibit ? 1.6 : (1.1 + Math.random() * 0.5);
    const trunk = new T.Mesh(new T.CylinderGeometry(r * 0.85, r, len, 14),
      new T.MeshStandardMaterial({ map: tmap, color: col('#b07d5c'), roughness: 1 }));
    trunk.rotation.z = Math.PI / 2; trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
    const moss = new T.Mesh(new T.CylinderGeometry(r * 0.9, r * 1.02, len, 14, 1, true, 0, Math.PI),
      mat('#4a6a34', { roughness: 1 }));
    moss.rotation.z = Math.PI / 2; moss.position.y = 0.05; g.add(moss);
    g.position.set(x, r * 0.9, z); g.rotation.y = rot;
    blockers.push({ x, z, r: 1.4, box: true, hw: len / 2, hd: r, rot });

    if (exhibit) {
      // cut ends both reveal rings; the end facing the grove is the labelled exhibit
      const c = Math.cos(rot), sn = Math.sin(rot), L = len / 2;
      const ePlusD = Math.hypot(x + L * c - GC.x, z - L * sn - GC.z);
      const eMinusD = Math.hypot(x - L * c - GC.x, z + L * sn - GC.z);
      const sExposed = ePlusD < eMinusD ? 1 : -1;
      // plain ring cap on the far end, full exhibit end facing the grove
      const far = new T.Mesh(new T.CircleGeometry(r, 24),
        new T.MeshStandardMaterial({ map: crossSectionTex(), color: col('#c9a878'), roughness: 1 }));
      far.position.set(-sExposed * L, 0, 0); far.rotation.y = -sExposed * Math.PI / 2; g.add(far);
      const ex = exhibitEnd(g, sExposed, len, r);
      const ex0 = sExposed * L;
      window.GROVE.logExhibits.push({
        x: x + ex0 * c, z: z - ex0 * sn, ph: Math.random() * 7,
        glow: ex.glow, labels: ex.labels, lines: ex.lines,
      });
    } else {
      [-1, 1].forEach(s => {
        const end = new T.Mesh(new T.CircleGeometry(r, 16), mat('#c9a878'));
        end.position.set(s * len / 2, 0, 0); end.rotation.y = s * Math.PI / 2; g.add(end);
      });
    }
    return g;
  }

  /* ---------- fern / bush cluster ---------- */
  function fern(x, z, s) {
    const g = new T.Group();
    const greens = ['#3f5e28', '#4d7030', '#598038'];
    for (let i = 0; i < 7; i++) {
      const blade = new T.Mesh(new T.ConeGeometry(0.18 * s, 1.5 * s, 4),
        mat(greens[i % 3], { flatShading: true, side: T.DoubleSide }));
      const a = (i / 7) * Math.PI * 2;
      blade.position.set(Math.cos(a) * 0.3 * s, 0.6 * s, Math.sin(a) * 0.3 * s);
      blade.rotation.z = Math.cos(a) * 0.7; blade.rotation.x = Math.sin(a) * 0.7;
      blade.castShadow = true; g.add(blade);
    }
    g.position.set(x, 0, z);
    return g;
  }

  /* ---------- a campground whiteboard / plaque sign ---------- */
  function makeSign(x, z, face, kind) {
    const g = new T.Group();
    const woodMat = mat('#5a4327', { roughness: 1 });
    // two posts
    [-1.1, 1.1].forEach(sx => {
      const post = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 3.4, 8), woodMat);
      post.position.set(sx, 1.7, 0); post.castShadow = true; g.add(post);
    });
    // board
    const boardColor = kind === 'plaque' ? '#3c2c18' : '#efe9da';
    const board = new T.Mesh(new T.BoxGeometry(3.0, 1.8, 0.14),
      mat(boardColor, { roughness: 0.8 }));
    board.position.set(0, 2.5, 0); board.castShadow = true; g.add(board);
    // frame
    const frame = new T.Mesh(new T.BoxGeometry(3.2, 2.0, 0.1), woodMat);
    frame.position.set(0, 2.5, -0.04); g.add(frame);
    if (kind === 'plaque') {                       // bronze nameplate accent
      const plate = new T.Mesh(new T.BoxGeometry(2.4, 1.2, 0.05), mat('#8a6a32', { metalness: 0.5, roughness: 0.5 }));
      plate.position.set(0, 2.5, 0.08); g.add(plate);
    }
    g.position.set(x, 0, z); g.rotation.y = face;
    blockers.push({ x, z, r: 1.0 });
    return g;
  }

  /* ---------- a walk-through arch cut through a sequoia base ----------
     The famous "tunnel tree": the trunk stands on two legs with an arched
     opening between them so the trail passes straight through. Built as a
     single extruded archway silhouette (no CSG) — the upper trunk is raised
     to rest on top of it. The shared bark texture is cloned ONCE here (a
     single clone is cheap — the GPU-OOM hazard was cloning per background
     tree, not one hero prop) so the legs read as real bark, not flat paint. */
  function tunnelBase(x, z, halfW, Hb, archW, archH, depth) {
    const aw = archW / 2;
    const s = new T.Shape();
    s.moveTo(-halfW, 0);
    s.lineTo(-halfW, Hb);                       // up the left leg + lintel
    s.lineTo(halfW, Hb);                        // across the top
    s.lineTo(halfW, 0);                         // down the right leg outer
    s.lineTo(aw, 0);                            // in along the ground to the arch foot
    s.lineTo(aw, archH - aw);                   // up the inner right of the arch
    s.absarc(0, archH - aw, aw, 0, Math.PI, false);  // arch over to the inner left
    s.lineTo(-aw, 0);                           // down the inner left to the ground
    s.lineTo(-halfW, 0);                        // close along the ground
    const geo = new T.ExtrudeGeometry(s, {
      depth: depth, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 2, steps: 1,
    });
    geo.translate(0, 0, -depth / 2);            // centre the tunnel on the trunk axis (runs along Z)
    geo.computeVertexNormals();
    // skin the legs + lintel with the same vertical bark as the trunks above.
    // ExtrudeGeometry emits world-unit UVs, so a small repeat stretches one
    // bark tile across several feet of leg instead of a tiny stamped grid.
    const bark = window.GROVE.barkTexture().map.clone();
    bark.needsUpdate = true;
    bark.wrapS = bark.wrapT = T.RepeatWrapping;
    bark.repeat.set(0.16, 0.16);
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({
      map: bark, color: col('#8a5a3a'), roughness: 0.97, side: T.DoubleSide,
    }));
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(x, -0.4, z);                 // sink the feet slightly so the legs meet the ground
    return m;
  }

  /* ---------- the walkable Mother-of-the-Forest stump ---------- */
  function buildStump(root) {
    const g = new T.Group();
    const { map } = window.GROVE.barkTexture();
    // sloped sidewall (the ramp the player walks up): top radius ST.r at y=top,
    // bottom radius ST.r+edge at y=0 — matches GROVE.terrainHeight exactly.
    const side = map.clone(); side.needsUpdate = true; side.wrapS = side.wrapT = T.RepeatWrapping;
    side.repeat.set(10, 1.4);
    const wall = new T.Mesh(
      new T.CylinderGeometry(ST.r, ST.r + ST.edge, ST.top, 80, 1, true),
      new T.MeshStandardMaterial({ map: side, color: col('#9a6f4e'), roughness: 1, side: T.DoubleSide }));
    wall.position.y = ST.top / 2; wall.receiveShadow = true; g.add(wall);
    // the ring-topped surface
    const top = new T.Mesh(new T.CircleGeometry(ST.r, 96),
      new T.MeshStandardMaterial({ map: stumpRingTexture(), roughness: 0.85 }));
    top.rotation.x = -Math.PI / 2; top.position.y = ST.top + 0.02; top.receiveShadow = true; g.add(top);
    // a low weathered rim around the top edge
    const rim = new T.Mesh(new T.TorusGeometry(ST.r, 0.4, 8, 80),
      mat('#7a5436', { roughness: 1 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = ST.top; g.add(rim);
    g.position.set(ST.x, 0, ST.z); root.add(g);
    // ground contact shadow at the base
    root.add(groundBlob(ST.x, ST.z, (ST.r + ST.edge) * 2.2));
    // NOTE: deliberately NOT a blocker — the stump is walkable.
  }

  /* ---------- glowing mycorrhizal root network ----------
     A dense web of TubeGeometry roots in three depth bands:
       · surface feeders + main roots fan to nearby trees & the cone
       · mid + deep roots plunge under the stump and travel below the
         floor — rendered depthTest:false so they read as HIGHLIGHTED
         roots glowing up THROUGH the ground.
     Tube radius varies per root → real thickness variety.            */
  function buildRoot(pts, radius, baseMat, opts) {
    const curve = new T.CatmullRomCurve3(pts);
    const tub = Math.max(8, Math.round(pts.length * 2.2));
    const geo = new T.TubeGeometry(curve, tub, radius, 5, false);
    const m = new T.Mesh(geo, baseMat.clone());
    m.material.opacity = opts.base;
    m.userData.base = opts.base;
    m.userData.ph = Math.random() * 7;
    m.userData.toCone = !!opts.toCone;
    m.userData.deep = !!opts.deep;
    m.userData.amp = opts.amp != null ? opts.amp : 0.22;
    if (opts.deep) m.renderOrder = 3;            // draw over the opaque ground
    window.GROVE.roots.push(m);
    return m;
  }

  function buildRoots(root) {
    const g = new T.Group(); root.add(g);
    const placed = window.GROVE._placedTrees || [];
    const targets = [];
    placed.forEach(p => {
      if (Math.hypot(p.x - ST.x, p.z - ST.z) < 85) targets.push({ x: p.x, z: p.z });
    });
    targets.push({ x: CN.x, z: CN.z, isCone: true });  // a bright thread to the cone

    // surface/near-surface roots: lit golden, occluded normally by terrain
    const surfMat = new T.MeshBasicMaterial({
      color: col('#ffcf6a'), transparent: true, opacity: 0.5,
      blending: T.AdditiveBlending, depthWrite: false, fog: false,
    });
    // deep roots: brighter amber. depthTest stays ON so trees / stump / avatar
    // (which write depth) occlude them — but the GROUND is drawn depthWrite:false
    // (see init), so over open earth the roots read THROUGH the ground.
    const deepMat = new T.MeshBasicMaterial({
      color: col('#ffd98a'), transparent: true, opacity: 0.32,
      blending: T.AdditiveBlending, depthWrite: false, fog: false,
    });

    // meandering point chain that dips below the floor mid-span and surfaces at the tip
    function meander(sx, sy, sz, tx, ty, tz, seed, amp, dip) {
      const pts = [], segs = 11;
      for (let i = 0; i <= segs; i++) {
        const f = i / segs;
        const x = sx + (tx - sx) * f + Math.sin(f * 6 + seed) * amp * (1 - f * 0.5);
        const z = sz + (tz - sz) * f + Math.cos(f * 5 + seed * 1.3) * amp * (1 - f * 0.5);
        const y = sy + (ty - sy) * f - Math.sin(f * Math.PI) * dip;
        pts.push(new T.Vector3(x, y, z));
      }
      return pts;
    }

    // 1) MAIN roots — thick, to every nearby tree & the cone, each with rootlets
    targets.forEach((tg, idx) => {
      const a = Math.atan2(tg.z - ST.z, tg.x - ST.x);
      const sx = ST.x + Math.cos(a) * (ST.r + ST.edge);
      const sz = ST.z + Math.sin(a) * (ST.r + ST.edge);
      const gauge = 0.20 + Math.random() * 0.16;       // thick trunk root
      const pts = meander(sx, 0.04, sz, tg.x, 0.06, tg.z, idx, 1.8, 0.3);
      g.add(buildRoot(pts, gauge, surfMat, {
        base: 0.22 + Math.random() * 0.22, toCone: !!tg.isCone, amp: tg.isCone ? 0.5 : 0.22,
      }));
      // 1-3 rootlets forking off the mid-span toward the side, thinner & tapered
      const forks = 1 + (Math.random() * 3 | 0);
      for (let k = 0; k < forks; k++) {
        const fi = 4 + (Math.random() * 4 | 0);
        const base = pts[Math.min(fi, pts.length - 2)];
        const side = (Math.random() < 0.5 ? -1 : 1);
        const ang = a + side * (0.6 + Math.random() * 0.7);
        const len = 6 + Math.random() * 12;
        const ex = base.x + Math.cos(ang) * len, ez = base.z + Math.sin(ang) * len;
        const rl = meander(base.x, base.y, base.z, ex, 0.05, ez, idx * 3 + k, 1.2, 0.18);
        g.add(buildRoot(rl, 0.05 + Math.random() * 0.08, surfMat,
          { base: 0.14 + Math.random() * 0.18, amp: 0.2 }));
      }
    });

    // 2) FEEDER ring — many short thin radial roots crowding out from the stump edge
    const feeders = 22;
    for (let i = 0; i < feeders; i++) {
      const a = (i / feeders) * Math.PI * 2 + Math.random() * 0.18;
      const sx = ST.x + Math.cos(a) * (ST.r + ST.edge);
      const sz = ST.z + Math.sin(a) * (ST.r + ST.edge);
      const len = 5 + Math.random() * 10;
      const ex = sx + Math.cos(a) * len, ez = sz + Math.sin(a) * len;
      const pts = meander(sx, 0.05, sz, ex, 0.05, ez, i * 1.7, 1.0, 0.15);
      g.add(buildRoot(pts, 0.04 + Math.random() * 0.07, surfMat,
        { base: 0.12 + Math.random() * 0.16, amp: 0.2 }));
    }

    // 3) DEEP taproots — plunge from under the stump to several depths, highlighted
    const taps = 14;
    for (let i = 0; i < taps; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = Math.random() * ST.r * 0.8;
      const sx = ST.x + Math.cos(a) * r0, sz = ST.z + Math.sin(a) * r0;
      const depth = 2.5 + Math.random() * 6;           // -2.5 … -8.5 underground
      const spread = 4 + Math.random() * 14;
      const ex = sx + Math.cos(a) * spread, ez = sz + Math.sin(a) * spread;
      const pts = meander(sx, -0.2, sz, ex, -depth, ez, i * 2.3, 2.2, -1.2);
      g.add(buildRoot(pts, 0.06 + Math.random() * 0.13, deepMat,
        { base: 0.16 + Math.random() * 0.2, deep: true, amp: 0.35 }));
    }

    // 4) DEEP network threads — travel far below the floor between stump & trees,
    //    rising at each end, so the underground web reads at the grove scale.
    targets.forEach((tg, idx) => {
      if (Math.random() < 0.45) return;                // not under every tree
      const a = Math.atan2(tg.z - ST.z, tg.x - ST.x);
      const sx = ST.x + Math.cos(a) * (ST.r + ST.edge);
      const sz = ST.z + Math.sin(a) * (ST.r + ST.edge);
      const lvl = -(2 + Math.random() * 3);            // dives to a deep band
      const pts = [
        new T.Vector3(sx, -0.3, sz),
        new T.Vector3(sx + (tg.x - sx) * 0.3, lvl, sz + (tg.z - sz) * 0.3),
        new T.Vector3(sx + (tg.x - sx) * 0.5 + Math.sin(idx) * 4, lvl - 0.8, sz + (tg.z - sz) * 0.5 + Math.cos(idx) * 4),
        new T.Vector3(sx + (tg.x - sx) * 0.7, lvl, sz + (tg.z - sz) * 0.7),
        new T.Vector3(tg.x, -0.3, tg.z),
      ];
      g.add(buildRoot(pts, 0.07 + Math.random() * 0.1, deepMat,
        { base: 0.14 + Math.random() * 0.16, deep: true, toCone: !!tg.isCone, amp: 0.32 }));
    });
    return g;
  }

  /* ---------- the fallen serotinous cone ---------- */
  function buildCone(root) {
    const g = new T.Group();
    // body: overlapping woody scales on an ovoid
    const body = new T.Mesh(new T.SphereGeometry(1.0, 16, 16),
      mat('#6e4a26', { flatShading: true, roughness: 1 }));
    body.scale.set(0.8, 1.3, 0.8); body.castShadow = true; g.add(body);
    for (let i = 0; i < 40; i++) {
      const scale = new T.Mesh(new T.ConeGeometry(0.18, 0.34, 4),
        mat(i % 2 ? '#7d5430' : '#5e3d20', { flatShading: true }));
      const u = Math.random() * Math.PI, v = Math.random() * Math.PI * 2;
      scale.position.set(Math.sin(u) * Math.cos(v) * 0.85, Math.cos(u) * 1.2, Math.sin(u) * Math.sin(v) * 0.85);
      scale.lookAt(scale.position.clone().multiplyScalar(2));
      g.add(scale);
    }
    // resting tilted on the forest floor
    g.rotation.set(Math.PI / 2.2, 0.4, 0);
    g.position.set(CN.x, 1.0, CN.z); root.add(g);
    const glow = new T.PointLight(col('#ffba5a'), 3, 14, 2);
    glow.position.set(CN.x, 1.4, CN.z); root.add(glow);
    g.userData.glow = glow; window.GROVE.coneProp = g;
    root.add(groundBlob(CN.x, CN.z, 8));
    blockers.push({ x: CN.x, z: CN.z, r: 1.6 });
  }

  /* ---------- the seed altar (revealed at the visitor's center on return) ---------- */
  function buildAltar(root, s) {
    const g = new T.Group();
    const base = new T.Mesh(new T.CylinderGeometry(2.4, 2.8, 0.6, 24),
      mat('#7b7266', { flatShading: true, roughness: 1 }));
    base.position.y = 0.3; base.castShadow = true; base.receiveShadow = true; g.add(base);
    const top = new T.Mesh(new T.CylinderGeometry(1.7, 2.0, 0.4, 24), mat('#8b8276'));
    top.position.y = 0.7; g.add(top);
    const cone = new T.Mesh(new T.SphereGeometry(0.5, 12, 12), mat('#7a5a32', { flatShading: true }));
    cone.scale.set(0.7, 1.1, 0.7); cone.position.y = 1.25; cone.castShadow = true; g.add(cone);
    const glow = new T.PointLight(col('#ffd87a'), 6, 16, 2);
    glow.position.y = 1.6; g.add(glow); g.userData.glow = glow;
    g.position.set(s.pos.x, 0, s.pos.z);
    g.visible = false;                              // hidden until The Parting completes
    root.add(g);
    window.GROVE.seedAltar = g;
    // its blocker is only added when revealed (see GROVE.revealSeed)
    window.GROVE.revealSeed = function () {
      if (g.visible) return;
      g.visible = true;
      blockers.push({ x: s.pos.x, z: s.pos.z, r: 2.9 });
      root.add(groundBlob(s.pos.x, s.pos.z, 9));
    };
  }

  /* ---------- god-ray shaft ---------- */
  let _shaftTex = null;
  function shaftTex() {
    if (_shaftTex) return _shaftTex;
    const W = 64, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(255,236,180,0.55)');
    grad.addColorStop(0.5, 'rgba(255,226,150,0.22)');
    grad.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const hg = g.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = hg; g.fillRect(0, 0, W, H);
    _shaftTex = new T.CanvasTexture(cv); return _shaftTex;
  }
  function godRay(x, z, w, h, tilt, rotY) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({
        map: shaftTex(), transparent: true, opacity: 0.5,
        blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide,
      }));
    m.position.set(x, h * 0.42, z);
    m.rotation.set(tilt, rotY, 0);
    m.userData.baseOp = 0.32 + Math.random() * 0.3;
    m.userData.ph = Math.random() * 7;
    window.GROVE.shafts.push(m);
    return m;
  }

  /* ---------- drifting motes ---------- */
  function buildMotes(root) {
    const N = 240, geo = new T.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 150;
      pos[i * 3 + 1] = 1 + Math.random() * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 170;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const m = new T.Points(geo, new T.PointsMaterial({
      color: col('#ffe9b0'), size: 0.16, transparent: true, opacity: 0.7,
      depthWrite: false, blending: T.AdditiveBlending, fog: false,
    }));
    m.userData.base = pos.slice();
    window.GROVE.motes.push(m);
    root.add(m);
  }

  /* ---------- night-mode fireflies: soft glowing dots that drift low through
     the grove and flicker individually. One Points cloud (vertex colours
     carry the per-firefly flicker), hidden until night is toggled on. ---------- */
  let _ffTex = null;
  function fireflyTex() {
    if (_ffTex) return _ffTex;
    const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,235,1)');
    grad.addColorStop(0.3, 'rgba(222,255,150,0.85)');
    grad.addColorStop(1, 'rgba(180,255,120,0)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    _ffTex = new T.CanvasTexture(cv); _ffTex.colorSpace = T.SRGBColorSpace;
    return _ffTex;
  }
  function buildFireflies(root) {
    const N = 90, geo = new T.BufferGeometry();
    const pos = new Float32Array(N * 3), colArr = new Float32Array(N * 3);
    const base = new Float32Array(N * 3), ph = new Float32Array(N);
    const baseCol = col('#d6ff7a');
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 150;
      const y = 0.6 + Math.random() * 8;
      const z = (Math.random() - 0.5) * 170;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
      colArr[i * 3] = baseCol.r; colArr[i * 3 + 1] = baseCol.g; colArr[i * 3 + 2] = baseCol.b;
      ph[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(colArr, 3));
    const m = new T.Points(geo, new T.PointsMaterial({
      map: fireflyTex(), size: 1.1, vertexColors: true, transparent: true,
      opacity: 1, depthWrite: false, blending: T.AdditiveBlending, fog: true, sizeAttenuation: true,
    }));
    m.visible = false;
    m.userData = { base, ph, baseCol };
    window.GROVE.fireflies = m;
    root.add(m);
  }

  /* ===================================================================
     grove-builder component
     =================================================================== */
  AFRAME.registerComponent('grove-builder', {
    init() {
      const sceneEl = this.el.sceneEl;
      const root = new T.Group(); this.el.setObject3D('grove', root);
      const r = sceneEl.renderer;
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
      r.toneMappingExposure = 1.05;

      // ---- ground ----
      const ground = new T.Mesh(new T.PlaneGeometry(C.ground, C.ground),
        new T.MeshStandardMaterial({ map: groundTexture(), roughness: 1, metalness: 0 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
      // depthWrite OFF so the underground roots read through the earth, yet trees /
      // stump / avatar (which DO write depth) still occlude them. depthTest stays on
      // so nearer trunks correctly hide the ground; the sky is pinned behind it.
      ground.material.depthWrite = false; ground.renderOrder = -1; root.add(ground);

      // ---- the walkable Mother stump (built first; trees avoid it) ----
      buildStump(root);

      // ---- station props by marker kind ----
      const placed = [{ x: ST.x, z: ST.z, r: ST.r + ST.edge }]; // reserve the stump footprint
      window.GROVE.STATIONS.forEach(s => {
        const faceSouth = Math.atan2(VC.z - s.pos.z, VC.x - s.pos.x) + Math.PI / 2;
        switch (s.marker) {
          case 'altar':
            buildAltar(root, s); break;
          case 'sign':
            root.add(makeSign(s.pos.x, s.pos.z, Math.PI, 'board'));
            placed.push({ x: s.pos.x, z: s.pos.z, r: 3 }); break;
          case 'stumpstory':
            root.add(makeSign(s.pos.x, s.pos.z, 0, 'plaque'));   // faces south, toward approach
            placed.push({ x: s.pos.x, z: s.pos.z, r: 3 }); break;
          case 'parting':
            root.add(makeSign(s.pos.x, s.pos.z, -0.6, 'plaque'));
            placed.push({ x: s.pos.x, z: s.pos.z, r: 3 }); break;
          case 'barktree': {
            // a walk-through "tunnel tree" — the trail passes through the base,
            // with the Section 04 medallion floating in the archway.
            const halfW = 5.2, Hb = 9, archW = 5.4, archH = 6.6, depth = 11;
            const y0 = Hb - 2;                       // upper trunk resumes just above the arch
            const t = window.GROVE.makeSequoia({ baseR: 4.4, topR: 1.8, trunkH: 60, canopyH: 30, scale: 1.15 });
            t.position.set(s.pos.x, y0, s.pos.z); root.add(t);
            root.add(tunnelBase(s.pos.x, s.pos.z, halfW, Hb, archW, archH, depth));
            // a dark fire scar on the south face of one leg
            const scar = new T.Mesh(new T.CircleGeometry(1.1, 16),
              mat('#241208', { roughness: 1 }));
            scar.position.set(s.pos.x - 3.5, 3.4, s.pos.z + depth / 2 + 0.12); scar.scale.set(0.7, 2.0, 1); root.add(scar);
            root.add(groundBlob(s.pos.x, s.pos.z, 20));
            // two legs flank the tunnel; the middle stays open so you can walk through
            blockers.push({ x: s.pos.x - 3.95, z: s.pos.z, r: 2.2 });
            blockers.push({ x: s.pos.x + 3.95, z: s.pos.z, r: 2.2 });
            placed.push({ x: s.pos.x, z: s.pos.z, r: 5 });
            s._trunkR = 4.6; break;
          }
          case 'cone':
            buildCone(root);
            placed.push({ x: s.pos.x, z: s.pos.z, r: 3 }); break;
          // 'roots' and 'stumplayer' have no standalone prop; markers are
          // drawn by grove-stations.js (roots glow is built below).
          default: break;
        }
      });

      // ---- background grove: dense forest around the clearings + path ----
      const rings = [
        { count: 70, rMin: 30,  rMax: 80,  gap: 13, detail: 1.0,  sMin: 0.9,  sVar: 0.4 },
        { count: 72, rMin: 78,  rMax: 130, gap: 13, detail: 0.5,  sMin: 0.8,  sVar: 0.5 },
        { count: 60, rMin: 126, rMax: 178, gap: 12, detail: 0.26, sMin: 0.7,  sVar: 0.6 },
      ];
      rings.forEach(spec => {
        let made = 0, guard = 0;
        while (made < spec.count && guard < spec.count * 18) {
          guard++;
          const ang = Math.random() * Math.PI * 2;
          const rad = spec.rMin + Math.random() * (spec.rMax - spec.rMin);
          // sample around the grove center so the grove feels enclosed
          const x = GC.x + Math.cos(ang) * rad, z = GC.z + Math.sin(ang) * rad;
          if (Math.abs(x) > 178 || Math.abs(z) > 178) continue;
          if (inClearing(x, z)) continue;            // keep clearings + path open
          let ok = true;
          for (const p of placed) { if (Math.hypot(p.x - x, p.z - z) < spec.gap + (p.r || 0)) { ok = false; break; } }
          if (!ok) continue;
          const t = window.GROVE.makeSequoia({
            baseR: 2.5 + Math.random() * 1.5, topR: 1.1, trunkH: 46 + Math.random() * 22,
            canopyH: 22 + Math.random() * 12, scale: spec.sMin + Math.random() * spec.sVar,
            detail: spec.detail,
          });
          t.position.set(x, 0, z); root.add(t);
          if (rad < 86) { root.add(groundBlob(x, z, 14)); blockers.push({ x, z, r: 3.2 }); }
          placed.push({ x, z, r: 3.2 });
          made++;
        }
      });
      window.GROVE._placedTrees = placed;

      // ---- glowing roots (needs placed trees); hidden until Section 07 ----
      const rootsGroup = buildRoots(root);
      rootsGroup.visible = false;
      window.GROVE.rootsGroup = rootsGroup;
      window.GROVE.revealRoots = () => {
        if (!rootsGroup || rootsGroup.visible) return;
        rootsGroup.visible = true;                 // once lit, it stays
        if (window.GROVE.ui && window.GROVE.ui.toast)
          window.GROVE.ui.toast('The roots beneath the grove begin to glow');
      };

      // ---- understory: ferns, logs, rocks (skip clearings + path) ----
      for (let i = 0; i < 130; i++) {
        const ang = Math.random() * Math.PI * 2, rad = 14 + Math.random() * 150;
        const x = GC.x + Math.cos(ang) * rad, z = GC.z + Math.sin(ang) * rad;
        if (inClearing(x, z)) continue;
        root.add(fern(x, z, 0.7 + Math.random() * 1.1));
      }
      // exactly two fallen giants — interactive cross-section easter eggs
      [[-44, -52, 15, -0.7], [55, -64, 15, 0.35]]
        .forEach(([x, z, l, rot]) => { if (!inClearing(x, z)) root.add(fallenLog(x, z, l, rot, true)); });
      for (let i = 0; i < 28; i++) {
        const ang = Math.random() * Math.PI * 2, rad = 22 + Math.random() * 110;
        const x = GC.x + Math.cos(ang) * rad, z = GC.z + Math.sin(ang) * rad;
        if (inClearing(x, z)) continue;
        const sc = 0.6 + Math.random() * 1.6;
        const rock = new T.Mesh(new T.DodecahedronGeometry(sc, 0), mat('#6b6157', { flatShading: true, roughness: 1 }));
        rock.position.set(x, sc * 0.4, z);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true; rock.receiveShadow = true; root.add(rock);
        blockers.push({ x, z, r: sc * 0.8 });
      }

      // ---- god rays through the canopy, along the path + clearings ----
      const rayspots = [
        [0, 50, 18, 56, 0.3, 0.2], [-6, 20, 18, 58, 0.28, 0.6], [6, -10, 20, 60, 0.3, -0.5],
        [0, GC.z + 6, 24, 64, 0.3, 1.6], [-18, GC.z, 18, 58, 0.3, 1.0], [18, GC.z - 8, 20, 60, 0.32, -1.2],
        [CN.x, CN.z, 16, 56, 0.3, 2.6], [0, VC.z, 22, 60, 0.28, 0.0],
      ];
      rayspots.forEach(([x, z, w, h, tilt, ry]) => root.add(godRay(x, z, w, h, tilt, ry)));
      buildMotes(root);
      buildFireflies(root);

      // ---- lights ----
      this.hemi = new T.HemisphereLight(col('#cfe6f2'), col('#5a4e2a'), 0.85); root.add(this.hemi);
      this.amb = new T.AmbientLight(col('#9fb0a0'), 0.35); root.add(this.amb);
      const sun = new T.DirectionalLight(col('#ffe9c0'), 2.0);
      sun.position.set(-40, 80, 40); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const span = 110; const sc = sun.shadow.camera;
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 320;
      sun.target.position.set(GC.x, 0, GC.z); root.add(sun.target);
      sun.shadow.bias = -0.0005; root.add(sun); this.sun = sun;
      const fill = new T.DirectionalLight(col('#bcd6ff'), 0.4);
      fill.position.set(40, 30, -40); root.add(fill); this.fill = fill;

      // ---- sky + fog ----
      this.buildSky(['#9fc6e8', '#bcd4c0', '#c9d2a0']);
      sceneEl.object3D.fog = new T.Fog(col('#9fae86').getHex(), 80, 300);

      // ---- day/night: respect reduced-motion for firefly flicker; expose toggle ----
      this.night = false;
      this._reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      window.GROVE.setNight = (on) => this.setNight(!!on);

      this.el.emit('grove-ready');
    },

    buildSky(stops) {
      const scene = this.el.sceneEl.object3D;
      this.sky = new T.Mesh(new T.SphereGeometry(240, 32, 16),
        new T.MeshBasicMaterial({ side: T.BackSide, fog: false, depthWrite: false, depthTest: false }));
      this.sky.renderOrder = -2;          // pure background, behind the depthWrite-off ground
      scene.add(this.sky);
      this.paintSky(stops);
    },

    paintSky(stops) {
      const S = 256, cv = document.createElement('canvas'); cv.width = 16; cv.height = S;
      const g = cv.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, S);
      grad.addColorStop(0, stops[0]); grad.addColorStop(0.55, stops[1]); grad.addColorStop(1, stops[2]);
      g.fillStyle = grad; g.fillRect(0, 0, 16, S);
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
      tex.mapping = T.EquirectangularReflectionMapping;
      if (this.sky.material.map) this.sky.material.map.dispose();
      this.sky.material.map = tex; this.sky.material.needsUpdate = true;
    },

    /* toggle the grove between warm daylight and a moonlit night. Day keeps the
       sunbeams + drifting motes; night dims everything to moonlight, mutes the
       shafts, and brings out the fireflies. */
    setNight(on) {
      this.night = on;
      window.GROVE.isNight = on;
      const fog = this.el.sceneEl.object3D.fog;
      if (on) {
        this.paintSky(['#0a0f24', '#11182f', '#1b2438']);
        fog.color.set('#0d1430'); fog.near = 50; fog.far = 230;
        this.hemi.color.set('#33457e'); this.hemi.groundColor.set('#0a0e08'); this.hemi.intensity = 0.5;
        this.amb.color.set('#26406e'); this.amb.intensity = 0.3;
        this.sun.color.set('#b8ccff'); this.sun.intensity = 0.45;      // sun → cool moonlight
        this.fill.color.set('#2a3666'); this.fill.intensity = 0.15;
        window.GROVE.shafts.forEach(m => { m.userData.nightMul = 0.12; });
        window.GROVE.motes.forEach(p => { p.material.opacity = 0.4; });
        if (window.GROVE.fireflies) window.GROVE.fireflies.visible = true;
      } else {
        this.paintSky(['#9fc6e8', '#bcd4c0', '#c9d2a0']);
        fog.color.set('#9fae86'); fog.near = 80; fog.far = 300;
        this.hemi.color.set('#cfe6f2'); this.hemi.groundColor.set('#5a4e2a'); this.hemi.intensity = 0.85;
        this.amb.color.set('#9fb0a0'); this.amb.intensity = 0.35;
        this.sun.color.set('#ffe9c0'); this.sun.intensity = 2.0;
        this.fill.color.set('#bcd6ff'); this.fill.intensity = 0.4;
        window.GROVE.shafts.forEach(m => { m.userData.nightMul = 1; });
        window.GROVE.motes.forEach(p => { p.material.opacity = 0.7; });
        if (window.GROVE.fireflies) window.GROVE.fireflies.visible = false;
      }
    },

    tick(time) {
      const tt = time / 1000;
      window.GROVE.shafts.forEach(m => {
        const nm = m.userData.nightMul != null ? m.userData.nightMul : 1;
        m.material.opacity = m.userData.baseOp * (0.72 + 0.28 * Math.sin(tt * 0.4 + m.userData.ph)) * nm;
      });
      const ff = window.GROVE.fireflies;
      if (ff && ff.visible) {
        const a = ff.geometry.attributes.position, c = ff.geometry.attributes.color;
        const base = ff.userData.base, ph = ff.userData.ph, bc = ff.userData.baseCol;
        const amp = this._reduce ? 0.25 : 1;
        for (let i = 0; i < a.count; i++) {
          a.setX(i, base[i * 3] + Math.sin(tt * 0.3 + ph[i]) * 1.6 * amp);
          a.setY(i, base[i * 3 + 1] + Math.sin(tt * 0.5 + ph[i] * 1.7) * 0.7 * amp);
          a.setZ(i, base[i * 3 + 2] + Math.cos(tt * 0.27 + ph[i]) * 1.6 * amp);
          // individual flicker via vertex brightness (softened under reduced-motion)
          const s = 0.5 + 0.5 * Math.sin(tt * 2.4 + ph[i] * 3);
          const fl = 0.3 + 0.7 * s * s;
          const k = this._reduce ? 0.7 + 0.3 * fl : fl;
          c.setXYZ(i, bc.r * k, bc.g * k, bc.b * k);
        }
        a.needsUpdate = true; c.needsUpdate = true;
      }
      window.GROVE.motes.forEach(p => {
        const a = p.geometry.attributes.position, base = p.userData.base;
        for (let i = 0; i < a.count; i++) {
          a.setX(i, base[i * 3] + Math.sin(tt * 0.2 + i) * 1.4);
          a.setY(i, base[i * 3 + 1] + Math.sin(tt * 0.15 + i * 0.5) * 0.8);
          a.setZ(i, base[i * 3 + 2] + Math.cos(tt * 0.18 + i) * 1.4);
        }
        a.needsUpdate = true;
      });
      // pulse the roots — a travelling glow; deep/highlighted roots breathe brighter
      window.GROVE.roots.forEach(m => {
        const k = m.userData.toCone ? 0.45 : (m.userData.amp || 0.22);
        const lift = m.userData.deep ? 0.12 : 0;     // deep roots stay a touch brighter
        m.material.opacity = m.userData.base + lift +
          Math.sin(tt * 1.1 + m.userData.ph) * k * 0.5 + k * 0.2;
      });
      if (window.GROVE.seedAltar && window.GROVE.seedAltar.visible && window.GROVE.seedAltar.userData.glow) {
        window.GROVE.seedAltar.userData.glow.intensity = 5 + Math.sin(tt * 1.3) * 1.6;
      }
      if (window.GROVE.coneProp && window.GROVE.coneProp.userData.glow) {
        window.GROVE.coneProp.userData.glow.intensity = 2.4 + Math.sin(tt * 1.6) * 1.0;
      }
      // fallen-log cross-sections: rings glow + ring-band callouts fade in on approach (~10 ft)
      const player = window.GROVE.player;
      if (player) {
        window.GROVE.logExhibits.forEach(e => {
          const d = Math.hypot(player.pos.x - e.x, player.pos.z - e.z);
          const f = Math.max(0, Math.min(1, (12 - d) / 7));   // 0 beyond 12u → 1 within 5u
          const pulse = 0.6 + 0.4 * Math.sin(tt * 1.4 + e.ph);
          e.glow.material.opacity = f * (0.22 + pulse * 0.2);
          for (const s of e.labels) s.material.opacity = f;
          for (const l of e.lines) l.material.opacity = f * 0.85;
        });
      }
    },
  });

  window.GROVE.groundTexture = groundTexture;
})();

/* ===================================================================
   sequoia.js — procedural GIANT sequoia.
   A massive fluted, buttressed reddish-bark trunk that towers ~70u,
   with a high canopy of soft green clusters. Bark is a canvas texture
   (vertical fibers + fire scars) wrapped on a lathe-fluted trunk.
   Returns a THREE.Group at origin; caller positions it.
   GROVE.makeSequoia(opts) and GROVE.barkTexture() are exported.
   =================================================================== */
(function () {
  const T = AFRAME.THREE;
  const col = (h) => new T.Color(h);

  /* ---------- shared bark texture (fibrous, vertical, reddish) ---------- */
  let _bark = null;
  function barkTexture() {
    if (_bark) return { map: _bark };
    const W = 512, H = 1024;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    // base reddish-brown vertical gradient (richer near base)
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#7a4026');   // up high, lit
    grad.addColorStop(0.5, '#5e3320');
    grad.addColorStop(1, '#48281c');   // base, shadowed
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    // broad vertical flute columns (light + shadow ridges)
    const cols = 22;
    for (let i = 0; i < cols; i++) {
      const x = (i / cols) * W + (Math.random() - 0.5) * 6;
      const w = W / cols;
      const lg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      lg.addColorStop(0, 'rgba(20,10,6,0.55)');
      lg.addColorStop(0.5, 'rgba(160,92,50,0.32)');
      lg.addColorStop(1, 'rgba(20,10,6,0.5)');
      g.fillStyle = lg; g.fillRect(x - w / 2, 0, w, H);
    }
    // long stringy fibers
    for (let i = 0; i < 4200; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const len = 30 + Math.random() * 160;
      const wob = (Math.random() - 0.5) * 5;
      const shade = Math.random();
      g.strokeStyle = shade > 0.55
        ? `rgba(${160 + Math.random() * 60 | 0},${88 + Math.random() * 40 | 0},${48 | 0},${0.05 + Math.random() * 0.16})`
        : `rgba(${30 + Math.random() * 30 | 0},${14 + Math.random() * 16 | 0},${8 | 0},${0.06 + Math.random() * 0.18})`;
      g.lineWidth = 0.6 + Math.random() * 1.8;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + wob, y + len / 2, x + wob * 0.4, y + len);
      g.stroke();
    }
    // occasional deep furrows
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * W;
      g.strokeStyle = 'rgba(12,6,4,0.5)';
      g.lineWidth = 2 + Math.random() * 5;
      g.beginPath(); g.moveTo(x, 0);
      let yy = 0, xx = x;
      while (yy < H) { yy += 40 + Math.random() * 60; xx += (Math.random() - 0.5) * 18; g.lineTo(xx, yy); }
      g.stroke();
    }
    // a charred fire-scar near the base on one side
    const sg = g.createRadialGradient(W * 0.5, H * 0.93, 10, W * 0.5, H * 0.93, 220);
    sg.addColorStop(0, 'rgba(10,7,6,0.85)');
    sg.addColorStop(0.6, 'rgba(24,14,10,0.4)');
    sg.addColorStop(1, 'rgba(24,14,10,0)');
    g.fillStyle = sg; g.fillRect(0, H * 0.62, W, H * 0.38);

    _bark = new T.CanvasTexture(cv);
    _bark.colorSpace = T.SRGBColorSpace;
    _bark.wrapS = _bark.wrapT = T.RepeatWrapping;
    _bark.anisotropy = 8;
    return { map: _bark };
  }

  /* ---------- canopy needle cluster texture (soft, transparent) ---------- */
  let _needle = null;
  function needleTexture() {
    if (_needle) return _needle;
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.lineCap = 'round';
    // feathery sprays: a central rib with fine side-needles, sage→chartreuse,
    // brighter toward the rim (sunlit edge of a sequoia frond)
    const greens = ['#3f6b30', '#4f7d38', '#5c8a3e', '#356026', '#7da247', '#94bb55'];
    for (let i = 0; i < 150; i++) {
      const x = S / 2 + (Math.random() - 0.5) * S * 0.92;
      const y = S / 2 + (Math.random() - 0.5) * S * 0.92;
      const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      if (Math.random() < d * 0.78) continue;
      const ang = Math.random() * Math.PI * 2;
      const ribLen = 14 + Math.random() * 34;
      const ex = Math.cos(ang), ey = Math.sin(ang);
      // outer sprays read sunlit (last two brighter greens), inner stay shaded
      const bright = d > 0.55;
      const pick = bright ? 4 + ((Math.random() * 2) | 0) : (Math.random() * 4) | 0;
      g.strokeStyle = greens[pick];
      g.globalAlpha = (bright ? 0.55 : 0.42) + Math.random() * 0.45;
      // central rib
      g.lineWidth = 1.1 + Math.random() * 1.3;
      g.beginPath(); g.moveTo(x, y);
      g.lineTo(x + ex * ribLen, y + ey * ribLen); g.stroke();
      // side needles fanning off the rib
      const px = -ey, py = ex;
      const needles = 4 + ((Math.random() * 4) | 0);
      g.lineWidth = 0.7 + Math.random() * 0.9;
      for (let k = 1; k <= needles; k++) {
        const t = k / (needles + 1);
        const bx = x + ex * ribLen * t, by = y + ey * ribLen * t;
        const nl = (1 - t) * ribLen * 0.42 + 2;
        const side = (k % 2 ? 1 : -1);
        g.beginPath(); g.moveTo(bx, by);
        g.lineTo(bx + (ex * 0.45 + px * side * 0.9) * nl,
                 by + (ey * 0.45 + py * side * 0.9) * nl);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    _needle = new T.CanvasTexture(cv); _needle.colorSpace = T.SRGBColorSpace;
    return _needle;
  }

  /* ---------- dense crown texture: overlapping needle masses with irregular
     sky-holes, seen from BELOW (backlit, dark). Tiled on big horizontal discs
     across each crown so the canopy closes over the visitor when they look up. */
  let _crown = null;
  function crownTexture() {
    if (_crown) return _crown;
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, S, S);
    const darks = ['#243f18', '#2c4a1e', '#1f3814', '#345526', '#3a5f2a'];
    // soft masses, denser toward the centre, leaving ragged gaps
    for (let i = 0; i < 420; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * S * 0.47;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      const r = 16 + Math.random() * 34;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      const c = darks[(Math.random() * darks.length) | 0];
      rg.addColorStop(0, c); rg.addColorStop(0.7, c); rg.addColorStop(1, 'rgba(36,63,24,0)');
      g.fillStyle = rg; g.globalAlpha = 0.75 + Math.random() * 0.25;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // needle sprays over the masses for a feathered edge
    g.globalAlpha = 0.9; g.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * S * 0.5;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      const ang = Math.random() * Math.PI * 2, L = 10 + Math.random() * 26;
      g.strokeStyle = darks[(Math.random() * darks.length) | 0]; g.lineWidth = 1.5 + Math.random() * 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
    }
    g.globalAlpha = 1;
    _crown = new T.CanvasTexture(cv); _crown.colorSpace = T.SRGBColorSpace;
    return _crown;
  }
  let _crownMat = null;
  function crownMat() {
    // Unlit: a crown seen from below is a backlit silhouette, and an unlit
    // alphaTest cut-out costs a fraction of a lit one per pixel across sheets
    // this large. Depth is written so early-Z rejects the overlapping sheets.
    return _crownMat || (_crownMat = new T.MeshBasicMaterial({
      map: crownTexture(), alphaTest: 0.3, side: T.DoubleSide, color: col('#8fb86a'), fog: true,
    }));
  }

  /* ---------- a fluted, tapering trunk via lathe ---------- */
  function trunkMesh(opts) {
    const baseR = opts.baseR;          // radius at ground
    const topR = opts.topR;            // radius near canopy
    const H = opts.trunkH;             // bare trunk height
    const flutes = opts.flutes || 11;
    const { map } = barkTexture();
    // Share ONE bark texture across every trunk — cloning it per tree
    // costs hundreds of MB of GPU memory and crashes the context (green
    // screen). Fixed tiling looks fine across the height range we use.
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(3, 4);

    // lathe profile: buttressed flare at the very bottom, then smooth taper
    const pts = [];
    const segs = 26;
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const y = f * H;
      const flare = Math.pow(1 - f, 2.4) * baseR * 0.55;   // base buttress
      const r = baseR + (topR - baseR) * Math.pow(f, 0.72) + flare;
      pts.push(new T.Vector2(Math.max(0.05, r), y));
    }
    const geo = new T.LatheGeometry(pts, 48);
    // flute the radius by angle for organic columns
    const posAttr = geo.attributes.position;
    const v = new T.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const ang = Math.atan2(v.z, v.x);
      const r = Math.hypot(v.x, v.z);
      const flute = 1 + Math.sin(ang * flutes) * 0.035 + Math.sin(ang * flutes * 2.3 + 1.0) * 0.018;
      posAttr.setX(i, Math.cos(ang) * r * flute);
      posAttr.setZ(i, Math.sin(ang) * r * flute);
    }
    geo.computeVertexNormals();
    const m = new T.MeshStandardMaterial({
      map: map, roughness: 0.96, metalness: 0.0, color: col('#c98f6e'),
    });
    const mesh = new T.Mesh(geo, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  /* ---------- a tapered limb between two points (cylinders point +Y, so
     we orient by the vector from base→tip). Used for the crown leader and
     every branch, so nothing ever floats free of the tree. ---------- */
  const _UP = new T.Vector3(0, 1, 0);
  const _dir = new T.Vector3();

  /* ---------- shared foliage materials. Every tree used to allocate its own
     mass + frond materials (hundreds of GPU programs/uniform sets); the crown
     only needs six greens, so build each once and hand them out. ---------- */
  const BRANCH_MAT = new T.MeshStandardMaterial({ color: col('#4a3120'), roughness: 1 });
  const SHADE_GREENS = ['#4a7634', '#52803a', '#5c8a3e'];   // interior / shaded
  const SUN_GREENS = ['#7aa84f', '#8cba56', '#9ec45a'];     // crown / sunlit tips
  const _massMats = {}, _frondMats = {};
  function massMat(lit) {
    const key = (lit ? 's' : 'h') + ((Math.random() * 3) | 0);
    if (_massMats[key]) return _massMats[key];
    return (_massMats[key] = new T.MeshStandardMaterial({
      color: col((lit ? SUN_GREENS : SHADE_GREENS)[+key[1]]),
      emissive: col(lit ? '#3a5a22' : '#28401a'), emissiveIntensity: lit ? 0.5 : 0.6,
      roughness: 0.92, metalness: 0, flatShading: true,
    }));
  }
  function frondMat(lit) {
    const key = (lit ? 's' : 'h') + ((Math.random() * 3) | 0);
    if (_frondMats[key]) return _frondMats[key];
    return (_frondMats[key] = new T.MeshStandardMaterial({
      map: needleTexture(), transparent: true, alphaTest: 0.18, roughness: 1, side: T.DoubleSide,
      depthWrite: false, emissive: col(lit ? '#496e26' : '#33501c'),
      emissiveIntensity: lit ? 0.55 : 0.45, color: col((lit ? SUN_GREENS : SHADE_GREENS)[+key[1]]),
    }));
  }
  function limb(ax, ay, az, bx, by, bz, r1, r2, mat) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 0.001;
    const m = new T.Mesh(new T.CylinderGeometry(r2, r1, len, 6), mat);
    m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    m.quaternion.setFromUnitVectors(_UP, _dir.set(dx / len, dy / len, dz / len));
    m.castShadow = true;
    return m;
  }

  /* ---------- canopy: a conical crown grown from a central LEADER. Every
     branch springs from that spine; every foliage cluster is anchored to a
     branch tip or the trunk top — so no bark or leaves float in the sky. ---- */
  function canopy(opts) {
    const g = new T.Group();
    const tex = needleTexture();
    const top = opts.trunkH;
    const topR = opts.topR;
    const spread = opts.baseR * 3.3;   // broad crown: branches reach well out over the trail
    const crownH = opts.canopyH;
    const detail = opts.detail != null ? opts.detail : 1;   // 1 full · 0.5 mid · 0.26 far

    const branchMat = BRANCH_MAT;

    // central leader — the trunk's spine continues up through the crown so
    // branches have a real origin (this is the "trunk fades, leaves take over")
    const leaderTop = top + crownH * 0.98;
    g.add(limb(0, top - 1, 0, 0, leaderTop, 0, topR * 0.9, 0.1, branchMat));

    // a foliage cluster welded to (cx,cy,cz): flattened blob masses + a feathery
    // billboard frond. `rich` doubles the masses for the dense crown centre.
    function leaves(cx, cy, cz, scale, lit, rich) {
      const blobs = rich ? 2 : 1;
      for (let k = 0; k < blobs; k++) {
        const r = (2.0 + Math.random() * 1.9) * scale;
        const b = new T.Mesh(new T.IcosahedronGeometry(r, 0), massMat(lit));
        b.position.set(cx + (Math.random() - 0.5) * r, cy + (Math.random() - 0.5) * r * 0.7, cz + (Math.random() - 0.5) * r);
        b.scale.y = 0.55 + Math.random() * 0.2;               // flatter → draping sprays
        b.rotation.set(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.4);
        b.castShadow = true;
        g.add(b);
      }
      if (detail > 0.4) {                                     // far trees skip the fringe
        const size = (5.5 + Math.random() * 5) * scale;
        const pl = new T.Mesh(
          new T.PlaneGeometry(size, size * (0.6 + Math.random() * 0.3)),   // wider than tall = frond
          frondMat(lit)
        );
        pl.position.set(cx, cy + size * 0.08, cz);
        pl.rotation.y = Math.random() * Math.PI;
        pl.rotation.z = (Math.random() - 0.5) * 0.4;
        g.add(pl);
      }
    }

    // canopy LACE: a horizontal frond hung under a branch tip. Vertical fronds
    // vanish edge-on when you look straight up; these lie flat, so from the
    // forest floor the crown reads as a lattice of needles against the sky.
    // Near (full-detail) trees only.
    function lace(cx, cy, cz, scale) {
      if (detail < 1) return;
      const size = (6 + Math.random() * 4) * scale;
      const pl = new T.Mesh(new T.PlaneGeometry(size, size * 0.8), frondMat(false));
      pl.position.set(cx, cy - 0.6, cz);
      pl.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.3, 0, Math.random() * Math.PI);
      g.add(pl);
    }

    // foliage taking over where the bare trunk ends
    leaves(0, top + 0.6, 0, 1.3, false, true);

    // tiered whorls of branches around the leader → conical sequoia crown
    const tiers = Math.max(3, Math.round(6 * detail));
    const perTier = Math.max(2, Math.round(4 * detail));
    for (let i = 0; i < tiers; i++) {
      const tf = i / (tiers - 1 || 1);                        // 0 crown base → 1 spire
      const yb = top + crownH * (0.06 + tf * 0.84);
      const reach = (1 - tf * 0.7) * spread * (0.5 + Math.random() * 0.4) + 1.2;
      const a0 = Math.random() * Math.PI * 2;
      for (let j = 0; j < perTier; j++) {
        const ang = a0 + (j / perTier) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const rise = reach * (0.3 + Math.random() * 0.35);    // branches angle upward
        const tx = Math.cos(ang) * reach, ty = yb + rise, tz = Math.sin(ang) * reach;
        g.add(limb(0, yb, 0, tx, ty, tz, 0.28, 0.07, branchMat));
        leaves(tx, ty, tz, 1 - tf * 0.4, true);               // sunlit foliage at each tip
        if (tf < 0.5) lace(tx, ty, tz, 1 - tf * 0.4);        // underside lattice, lower crown (near trees)
      }
    }
    // dense foliage cap over the crown spire
    leaves(0, leaderTop - crownH * 0.06, 0, 1.0, true, true);

    // CROWN DISCS: two or three big horizontal sheets of dense, backlit needle
    // mass spanning the crown at different heights. From the forest floor they
    // close the sky into a canopy with only ragged gaps of light (2-3 planes).
    const discN = /nocrown/.test(location.search) ? 0 : detail >= 1 ? 2 : detail >= 0.5 ? 1 : 0;   // ?nocrown=1 = diagnostics
    for (let i = 0; i < discN; i++) {
      const tf = discN === 1 ? 0.5 : 0.3 + (i / (discN - 1)) * 0.45;
      const size = spread * (2.5 - tf * 0.8) * (0.9 + Math.random() * 0.2);
      const pl = new T.Mesh(new T.PlaneGeometry(size, size), crownMat());
      pl.position.set((Math.random() - 0.5) * spread * 0.4, top + crownH * tf, (Math.random() - 0.5) * spread * 0.4);
      pl.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.2, 0, Math.random() * Math.PI);
      g.add(pl);
    }

    return g;
  }

  /* ---------- full sequoia ---------- */
  function makeSequoia(opts = {}) {
    const o = Object.assign({
      baseR: 3.4, topR: 1.4, trunkH: 52, canopyH: 26, flutes: 11, scale: 1, detail: 1,
    }, opts);
    const g = new T.Group();
    g.add(trunkMesh(o));
    const crown = canopy(o);
    g.add(crown);
    g.scale.setScalar(o.scale);
    g.rotation.y = Math.random() * Math.PI * 2;
    g.userData.trunkTop = o.trunkH * o.scale;
    g.userData.baseR = o.baseR * o.scale;
    g.userData.canopy = crown;                 // swayed by grove-env when you look up
    g.userData.ph = Math.random() * Math.PI * 2;
    return g;
  }

  window.GROVE = window.GROVE || {};
  window.GROVE.makeSequoia = makeSequoia;
  window.GROVE.barkTexture = barkTexture;
  window.GROVE.needleTexture = needleTexture;
})();

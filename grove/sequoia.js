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
    for (let i = 0; i < 240; i++) {
      const x = S / 2 + (Math.random() - 0.5) * S * 0.9;
      const y = S / 2 + (Math.random() - 0.5) * S * 0.9;
      const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      if (Math.random() < d * 0.8) continue;
      const len = 8 + Math.random() * 26;
      const ang = Math.random() * Math.PI * 2;
      const greens = ['#3f6b30', '#4f7d38', '#5c8a3e', '#356026'];
      g.strokeStyle = greens[(Math.random() * greens.length) | 0];
      g.globalAlpha = 0.5 + Math.random() * 0.5;
      g.lineWidth = 1 + Math.random() * 1.6;
      g.beginPath(); g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
    }
    g.globalAlpha = 1;
    _needle = new T.CanvasTexture(cv); _needle.colorSpace = T.SRGBColorSpace;
    return _needle;
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

  /* ---------- canopy: soft billboarded clusters high up ---------- */
  function canopy(opts) {
    const g = new T.Group();
    const tex = needleTexture();
    const top = opts.trunkH;
    const spread = opts.baseR * 2.6;
    const detail = opts.detail != null ? opts.detail : 1;   // 1 full · 0.5 mid · 0.28 far
    // dark branch armature
    const branchMat = new T.MeshStandardMaterial({ color: col('#3a2418'), roughness: 1 });
    const branchN = Math.max(3, Math.round(7 * detail));
    for (let i = 0; i < branchN; i++) {
      const f = i / 9;
      const y = top + f * opts.canopyH * 0.9;
      const len = (1 - f) * spread * 0.7 + 1.5;
      const ang = Math.random() * Math.PI * 2;
      const br = new T.Mesh(new T.CylinderGeometry(0.12, 0.28, len, 5), branchMat);
      br.position.set(Math.cos(ang) * len * 0.4, y, Math.sin(ang) * len * 0.4);
      br.rotation.z = Math.PI / 2 - 0.5;
      br.rotation.y = -ang;
      br.castShadow = true;
      g.add(br);
    }
    // ---- solid foliage MASSES: voluminous green crown, emissive so it reads
    //      lush (not black silhouette) when backlit by the bright sky ----
    const greens = ['#6f9c46', '#5c8a3e', '#7aa84f', '#52803a', '#4a7634'];
    const massMat = () => new T.MeshStandardMaterial({
      color: col(greens[(Math.random() * greens.length) | 0]),
      emissive: col('#2c4a1c'), emissiveIntensity: 0.55,
      roughness: 0.92, metalness: 0, flatShading: true,
    });
    const massN = Math.max(6, Math.round(16 * detail));
    for (let i = 0; i < massN; i++) {
      // bias toward the crown (top), tapering inward as it rises → conical sequoia crown
      const f = Math.pow(Math.random(), 0.5);                 // 0 base of canopy → 1 crown tip
      const y = top + opts.canopyH * (0.05 + f * 0.95);
      const ringR = (1 - f * 0.78) * spread * (0.45 + Math.random() * 0.7);
      const ang = Math.random() * Math.PI * 2;
      const r = (1 - f * 0.55) * (2.6 + Math.random() * 2.2) + 0.8;
      const blob = new T.Mesh(new T.IcosahedronGeometry(r, 0), massMat());
      blob.position.set(Math.cos(ang) * ringR, y, Math.sin(ang) * ringR);
      blob.scale.y = 0.74 + Math.random() * 0.22;
      blob.rotation.set(Math.random(), Math.random(), Math.random());
      blob.castShadow = true;
      g.add(blob);
    }
    // ---- soft billboard fringe over the masses for fine needle detail ----
    const fringeN = Math.round(18 * detail);   // far trees skip the fringe entirely
    for (let i = 0; i < fringeN; i++) {
      const f = Math.pow(Math.random(), 0.55);
      const y = top + opts.canopyH * (0.1 + f * 0.92);
      const ringR = (1 - f * 0.7) * spread * (0.5 + Math.random() * 0.7);
      const ang = Math.random() * Math.PI * 2;
      const size = 5 + Math.random() * 6;
      const pl = new T.Mesh(
        new T.PlaneGeometry(size, size),
        new T.MeshStandardMaterial({
          map: tex, transparent: true, alphaTest: 0.2,
          roughness: 1, side: T.DoubleSide, depthWrite: false,
          emissive: col('#37551f'), emissiveIntensity: 0.5,
          color: col(greens[(Math.random() * greens.length) | 0]),
        })
      );
      pl.position.set(Math.cos(ang) * ringR, y, Math.sin(ang) * ringR);
      pl.rotation.y = Math.random() * Math.PI;
      pl.rotation.z = (Math.random() - 0.5) * 0.5;
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
    g.add(canopy(o));
    g.scale.setScalar(o.scale);
    g.rotation.y = Math.random() * Math.PI * 2;
    g.userData.trunkTop = o.trunkH * o.scale;
    g.userData.baseR = o.baseR * o.scale;
    return g;
  }

  window.GROVE = window.GROVE || {};
  window.GROVE.makeSequoia = makeSequoia;
  window.GROVE.barkTexture = barkTexture;
  window.GROVE.needleTexture = needleTexture;
})();

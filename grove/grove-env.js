/* ===================================================================
   grove-env.js — builds the giant-sequoia grove as a 3D world.
   Sunlit day: golden shafts through a high canopy, fibrous red trunks,
   golden-grass clearing, fallen logs, ferns, drifting motes.
   Exposes GROVE.blockers (trunk collision) + GROVE.shafts for animation.
   =================================================================== */
(function () {
  const T = AFRAME.THREE;
  const col = (h) => new T.Color(h);
  const C = window.GROVE.CONFIG;

  const blockers = [];                 // {x,z,r} trunk footprints
  window.GROVE.blockers = blockers;
  window.GROVE.shafts = [];
  window.GROVE.motes = [];

  const mat = (hex, o = {}) => new T.MeshStandardMaterial(
    Object.assign({ color: col(hex), roughness: 0.95, metalness: 0 }, o));

  /* ---------- forest-floor ground texture (duff + golden grass + trail) ---------- */
  function groundTexture() {
    const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const G = C.ground;
    const toUV = (x, z) => [(x + G / 2) / G * S, (z + G / 2) / G * S];
    // base: warm forest duff, lighter golden toward the clearing center
    g.fillStyle = '#3c3220'; g.fillRect(0, 0, S, S);
    const rg = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.6);
    rg.addColorStop(0, '#7e6b34');     // sunlit golden grass center
    rg.addColorStop(0.4, '#5f5326');
    rg.addColorStop(0.75, '#463c22');
    rg.addColorStop(1, '#2e2716');     // shaded forest edge
    g.fillStyle = rg; g.fillRect(0, 0, S, S);
    // mottling — needles, grass tufts, patches
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const dc = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      const grass = Math.random() < (1 - dc) * 0.6;
      if (grass) {
        g.fillStyle = `rgba(${150 + Math.random() * 50 | 0},${130 + Math.random() * 40 | 0},${50 + Math.random() * 30 | 0},${0.05 + Math.random() * 0.13})`;
      } else {
        g.fillStyle = `rgba(${70 + Math.random() * 40 | 0},${48 + Math.random() * 26 | 0},${24 | 0},${0.06 + Math.random() * 0.16})`;
      }
      g.beginPath(); g.arc(x, y, 1.5 + Math.random() * 7, 0, 7); g.fill();
    }
    // beaten dirt trail through the station loop
    const order = window.GROVE.STATIONS.map(s => s.pos);
    const loop = order.concat([order[0]]);
    const pts = loop.map(p => toUV(p.x, p.z));
    g.lineJoin = g.lineCap = 'round';
    const drawPath = (wd, color) => {
      g.strokeStyle = color; g.lineWidth = wd; g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        g.quadraticCurveTo(a[0], a[1], mx, my);
      }
      g.stroke();
    };
    drawPath(46, 'rgba(74,58,36,0.5)');
    drawPath(30, 'rgba(110,86,52,0.6)');
    drawPath(16, 'rgba(140,112,66,0.5)');
    for (let i = 0; i < 900; i++) {     // trail gravel/needles
      const seg = Math.floor(Math.random() * (pts.length - 1));
      const a = pts[seg], b = pts[seg + 1], f = Math.random();
      const x = a[0] + (b[0] - a[0]) * f + (Math.random() - 0.5) * 22;
      const y = a[1] + (b[1] - a[1]) * f + (Math.random() - 0.5) * 22;
      g.fillStyle = `rgba(${130 + Math.random() * 40 | 0},${100 + Math.random() * 30 | 0},${60 | 0},0.4)`;
      g.beginPath(); g.arc(x, y, 1 + Math.random() * 2.4, 0, 7); g.fill();
    }
    const tex = new T.CanvasTexture(cv); tex.anisotropy = 8; tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* ---------- soft round shadow blob under big trees ---------- */
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

  /* ---------- fallen log ---------- */
  function fallenLog(x, z, len, rot) {
    const g = new T.Group();
    const { map } = window.GROVE.barkTexture();
    const tmap = map.clone(); tmap.needsUpdate = true; tmap.wrapS = tmap.wrapT = T.RepeatWrapping;
    tmap.repeat.set(len / 5, 2);
    const r = 1.1 + Math.random() * 0.5;
    const trunk = new T.Mesh(new T.CylinderGeometry(r * 0.85, r, len, 14),
      new T.MeshStandardMaterial({ map: tmap, color: col('#b07d5c'), roughness: 1 }));
    trunk.rotation.z = Math.PI / 2; trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
    // mossy top
    const moss = new T.Mesh(new T.CylinderGeometry(r * 0.9, r * 1.02, len, 14, 1, true, 0, Math.PI),
      mat('#4a6a34', { roughness: 1 }));
    moss.rotation.z = Math.PI / 2; moss.position.y = 0.05; g.add(moss);
    // pale cut ends
    [-1, 1].forEach(s => {
      const end = new T.Mesh(new T.CircleGeometry(r, 16), mat('#c9a878'));
      end.position.set(s * len / 2, 0, 0); end.rotation.y = s * Math.PI / 2; g.add(end);
    });
    g.position.set(x, r * 0.9, z); g.rotation.y = rot;
    blockers.push({ x, z, r: 1.4, box: true, hw: len / 2, hd: r, rot });
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

  /* ---------- god-ray shaft (additive translucent slab from canopy) ---------- */
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
    // horizontal falloff
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

  /* ---------- drifting motes (dust in the light) ---------- */
  function buildMotes(root) {
    const N = 240, geo = new T.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 130;
      pos[i * 3 + 1] = 1 + Math.random() * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 130;
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
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);

      // ---- station sequoias + threshold arch ----
      const placed = [];
      window.GROVE.STATIONS.forEach(s => {
        if (s.marker === 'altar') { this.buildAltar(root, s); return; }
        if (s.marker === 'arch') {
          // two leaning giants flanking the entrance
          [-1, 1].forEach(side => {
            const t = window.GROVE.makeSequoia({ baseR: 3.0, topR: 1.2, trunkH: 50, canopyH: 24, scale: 1 });
            t.position.set(s.pos.x + side * 9, 0, s.pos.z);
            t.rotation.z = -side * 0.06;       // lean toward each other
            root.add(t);
            root.add(groundBlob(s.pos.x + side * 9, s.pos.z, 14));
            blockers.push({ x: s.pos.x + side * 9, z: s.pos.z, r: 3.4 });
            placed.push({ x: s.pos.x + side * 9, z: s.pos.z });
          });
          return;
        }
        // a single great marked sequoia AT the station
        const t = window.GROVE.makeSequoia({
          baseR: 3.6, topR: 1.5, trunkH: 56, canopyH: 28, scale: 1.05 + Math.random() * 0.1,
        });
        t.position.set(s.pos.x, 0, s.pos.z);
        root.add(t);
        root.add(groundBlob(s.pos.x, s.pos.z, 16));
        blockers.push({ x: s.pos.x, z: s.pos.z, r: 3.9 });
        placed.push({ x: s.pos.x, z: s.pos.z });
        s._trunkR = 3.9;
      });

      // ---- background grove: a dense forest in concentric bands.
      //      Detail drops with distance so the count stays affordable. ----
      const rings = [
        { count: 56, rMin: 56,  rMax: 96,  gap: 15, detail: 1.0,  sMin: 0.85, sVar: 0.45 },
        { count: 60, rMin: 92,  rMax: 134, gap: 14, detail: 0.5,  sMin: 0.80, sVar: 0.50 },
        { count: 52, rMin: 130, rMax: 184, gap: 13, detail: 0.26, sMin: 0.70, sVar: 0.60 },
      ];
      rings.forEach(spec => {
        let made = 0, guard = 0;
        while (made < spec.count && guard < spec.count * 16) {
          guard++;
          const ang = Math.random() * Math.PI * 2;
          const rad = spec.rMin + Math.random() * (spec.rMax - spec.rMin);
          const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
          if (Math.abs(x) > 190 || Math.abs(z) > 190) continue;
          if (z > 38 && Math.abs(x) < 18) continue;          // keep the southern entry corridor clear
          if (Math.hypot(x, z - 50) < 16) continue;          // keep the spawn clearing open
          let ok = true;
          for (const p of placed) { if (Math.hypot(p.x - x, p.z - z) < spec.gap) { ok = false; break; } }
          if (!ok) continue;
          const t = window.GROVE.makeSequoia({
            baseR: 2.5 + Math.random() * 1.5, topR: 1.1, trunkH: 44 + Math.random() * 20,
            canopyH: 22 + Math.random() * 12, scale: spec.sMin + Math.random() * spec.sVar,
            detail: spec.detail,
          });
          t.position.set(x, 0, z); root.add(t);
          if (rad < 88) { root.add(groundBlob(x, z, 14)); blockers.push({ x, z, r: 3.2 }); }
          placed.push({ x, z });
          made++;
        }
      });

      // ---- understory: ferns, logs, rocks ----
      for (let i = 0; i < 120; i++) {
        const ang = Math.random() * Math.PI * 2, rad = 12 + Math.random() * 120;
        root.add(fern(Math.cos(ang) * rad, Math.sin(ang) * rad, 0.7 + Math.random() * 1.1));
      }
      [[-16, 40, 12, 0.5], [38, 6, 16, 1.2], [-40, -40, 14, -0.7], [10, 44, 10, 2.4], [52, -34, 13, 0.3],
       [-58, 18, 15, 1.7], [64, 24, 12, -0.4], [-30, -64, 13, 2.1]]
        .forEach(([x, z, l, rot]) => root.add(fallenLog(x, z, l, rot)));
      for (let i = 0; i < 26; i++) {
        const ang = Math.random() * Math.PI * 2, rad = 20 + Math.random() * 90;
        const s = 0.6 + Math.random() * 1.6;
        const rock = new T.Mesh(new T.DodecahedronGeometry(s, 0),
          mat('#6b6157', { flatShading: true, roughness: 1 }));
        rock.position.set(Math.cos(ang) * rad, s * 0.4, Math.sin(ang) * rad);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true; rock.receiveShadow = true; root.add(rock);
        blockers.push({ x: rock.position.x, z: rock.position.z, r: s * 0.8 });
      }

      // ---- god rays through the canopy ----
      const rayspots = [
        [-6, -8, 20, 60, 0.32, 0.4], [16, 14, 16, 56, 0.28, -0.6], [-24, 24, 18, 58, 0.3, 1.0],
        [30, -20, 22, 62, 0.34, 2.0], [-34, -10, 16, 54, 0.26, -1.4], [8, 34, 18, 58, 0.3, 0.2],
        [44, 8, 16, 56, 0.3, 2.6], [-2, 2, 24, 64, 0.3, 1.6],
      ];
      rayspots.forEach(([x, z, w, h, tilt, ry]) => root.add(godRay(x, z, w, h, tilt, ry)));
      buildMotes(root);

      // ---- lights: bright sunlit day ----
      this.hemi = new T.HemisphereLight(col('#cfe6f2'), col('#5a4e2a'), 0.85); root.add(this.hemi);
      this.amb = new T.AmbientLight(col('#9fb0a0'), 0.35); root.add(this.amb);
      const sun = new T.DirectionalLight(col('#ffe9c0'), 2.0);
      sun.position.set(-40, 70, 50); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const span = 90; const sc = sun.shadow.camera;
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 260;
      sun.shadow.bias = -0.0005; root.add(sun); this.sun = sun;
      // warm fill from the opposite side
      const fill = new T.DirectionalLight(col('#bcd6ff'), 0.4);
      fill.position.set(40, 30, -40); root.add(fill);

      // ---- sky + fog ----
      this.buildSky(scene_stops());
      const scene = sceneEl.object3D;
      scene.fog = new T.Fog(col('#9fae86').getHex(), 70, 260);

      this.el.emit('grove-ready');
    },

    buildSky(stops) {
      const scene = this.el.sceneEl.object3D;
      const sky = new T.Mesh(new T.SphereGeometry(220, 32, 16),
        new T.MeshBasicMaterial({ side: T.BackSide, fog: false }));
      const S = 256, cv = document.createElement('canvas'); cv.width = 16; cv.height = S;
      const g = cv.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, S);
      grad.addColorStop(0, stops[0]); grad.addColorStop(0.55, stops[1]); grad.addColorStop(1, stops[2]);
      g.fillStyle = grad; g.fillRect(0, 0, 16, S);
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
      tex.mapping = T.EquirectangularReflectionMapping;
      sky.material.map = tex; scene.add(sky);
    },

    buildAltar(root, s) {
      const g = new T.Group();
      // low stone ring
      const base = new T.Mesh(new T.CylinderGeometry(2.4, 2.8, 0.6, 24),
        mat('#7b7266', { flatShading: true, roughness: 1 }));
      base.position.y = 0.3; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const top = new T.Mesh(new T.CylinderGeometry(1.7, 2.0, 0.4, 24), mat('#8b8276'));
      top.position.y = 0.7; g.add(top);
      // a single cone resting on top
      const cone = new T.Mesh(new T.SphereGeometry(0.5, 12, 12),
        mat('#7a5a32', { flatShading: true }));
      cone.scale.set(0.7, 1.1, 0.7); cone.position.y = 1.25; cone.castShadow = true; g.add(cone);
      // golden glow light at the seed
      const glow = new T.PointLight(col('#ffd87a'), 6, 16, 2);
      glow.position.y = 1.6; g.add(glow); g.userData.glow = glow;
      g.position.set(s.pos.x, 0, s.pos.z); root.add(g);
      root.add(groundBlob(s.pos.x, s.pos.z, 9));
      blockers.push({ x: s.pos.x, z: s.pos.z, r: 2.9 });
      this.altar = g;
    },

    tick(time, dt) {
      const tt = time / 1000;
      // shimmer god rays
      window.GROVE.shafts.forEach(m => {
        m.material.opacity = m.userData.baseOp * (0.72 + 0.28 * Math.sin(tt * 0.4 + m.userData.ph));
      });
      // drift motes gently
      window.GROVE.motes.forEach(p => {
        const a = p.geometry.attributes.position, base = p.userData.base;
        for (let i = 0; i < a.count; i++) {
          a.setX(i, base[i * 3] + Math.sin(tt * 0.2 + i) * 1.4);
          a.setY(i, base[i * 3 + 1] + Math.sin(tt * 0.15 + i * 0.5) * 0.8);
          a.setZ(i, base[i * 3 + 2] + Math.cos(tt * 0.18 + i) * 1.4);
        }
        a.needsUpdate = true;
      });
      // pulse the seed altar glow
      if (this.altar && this.altar.userData.glow) {
        this.altar.userData.glow.intensity = 5 + Math.sin(tt * 1.3) * 1.6;
      }
    },
  });

  function scene_stops() {
    // bright day filtered green by the canopy: blue up high, green near the trees
    return ['#9fc6e8', '#bcd4c0', '#c9d2a0'];
  }

  window.GROVE.groundTexture = groundTexture;
})();

/* ===================================================================
   grove-player.js — the walking visitor + third-person follow camera.
   Movement: WASD walks (camera-relative), click/tap ground to walk,
   joystick (GROVE.input). Camera: drag to orbit OR arrow keys
   (←/→ yaw, ↑/↓ pitch) for mouse-free look, wheel to zoom, Q gazes up.
   Trunk collision via GROVE.blockers. Exposes GROVE.player.
   =================================================================== */
(function () {
  const T = AFRAME.THREE;
  const col = (h) => new T.Color(h);
  const C = window.GROVE.CONFIG;

  /* ---------- the walker: a jointed human figure, two presets ----------
     Proportions follow a ~7.5-head figure (1.75 u tall): hips at 0.86, shoulders
     at 1.40, head centre at 1.63. Legs bend at the knee and arms at the elbow
     while walking. `kind` is 'male' or 'female'; the two differ in shoulder /
     hip width, torso taper, hair, outfit colour and overall height. */
  const BODY_KEY = 'grove.avatar';
  const BODIES = {
    male:   { shoulder: 0.25, chestTop: 0.20, waist: 0.15, hipW: 0.16, height: 1.0,  hair: 'short', shirt: '#3d6b4a', pants: '#3a3f55', hairC: '#3a2414' },
    female: { shoulder: 0.21, chestTop: 0.17, waist: 0.125, hipW: 0.185, height: 0.95, hair: 'long',  shirt: '#7a4d8a', pants: '#2f3a4e', hairC: '#4a2a14' },
  };
  function buildVisitor(kind) {
    const B = BODIES[kind] || BODIES.male;
    const M = (h, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: col(h), roughness: 0.85 }, o));
    const skin = M('#d9a87c'), shirt = M(B.shirt), pants = M(B.pants), boots = M('#2a2018'),
      hairM = M(B.hairC, { roughness: 0.7 }), pack = M('#6e4a2a'), eyeM = M('#1c1410');
    const outer = new T.Group();
    const body = new T.Group(); outer.add(body);
    const parts = { legs: [], knees: [], arms: [], elbows: [] };
    const cast = (m) => { m.castShadow = true; return m; };

    // ---- legs: hip pivot → thigh → knee pivot → shin → foot ----
    [-1, 1].forEach(side => {
      const hip = new T.Group(); hip.position.set(side * 0.11, 0.86, 0); body.add(hip);
      const thigh = cast(new T.Mesh(new T.CylinderGeometry(0.088, 0.068, 0.42, 12), pants));
      thigh.position.y = -0.21; hip.add(thigh);
      const knee = new T.Group(); knee.position.y = -0.42; hip.add(knee);
      const kneeCap = new T.Mesh(new T.SphereGeometry(0.07, 8, 8), pants); knee.add(kneeCap);
      const shin = cast(new T.Mesh(new T.CylinderGeometry(0.068, 0.048, 0.36, 12), pants));
      shin.position.y = -0.18; knee.add(shin);
      const foot = cast(new T.Mesh(new T.BoxGeometry(0.11, 0.08, 0.25), boots));
      foot.position.set(0, -0.40, 0.05); knee.add(foot);
      parts.legs.push(hip); parts.knees.push(knee);
    });
    // ---- pelvis + torso ----
    const pelvis = new T.Mesh(new T.SphereGeometry(0.19, 12, 10), pants);
    pelvis.scale.set(B.hipW / 0.19, 0.62, 0.72); pelvis.position.y = 0.92; body.add(pelvis);
    const chest = cast(new T.Mesh(new T.CylinderGeometry(B.chestTop, B.waist, 0.48, 12), shirt));
    chest.scale.z = 0.72; chest.position.y = 1.19; body.add(chest); parts.chest = chest;
    [-1, 1].forEach(side => {
      const sh = new T.Mesh(new T.SphereGeometry(0.075, 10, 8), shirt);
      sh.position.set(side * B.shoulder, 1.40, 0); body.add(sh);
    });
    // ---- arms: shoulder pivot → upper arm → elbow pivot → forearm → hand ----
    [-1, 1].forEach(side => {
      const sh = new T.Group(); sh.position.set(side * (B.shoulder + 0.03), 1.40, 0); body.add(sh);
      sh.rotation.z = side * 0.06;
      const upper = cast(new T.Mesh(new T.CylinderGeometry(0.064, 0.048, 0.30, 12), shirt));
      upper.position.y = -0.15; sh.add(upper);
      const elbow = new T.Group(); elbow.position.y = -0.30; sh.add(elbow);
      const fore = cast(new T.Mesh(new T.CylinderGeometry(0.048, 0.032, 0.28, 12), skin));
      fore.position.y = -0.14; elbow.add(fore);
      const hand = new T.Mesh(new T.SphereGeometry(0.05, 8, 8), skin);
      hand.scale.set(0.9, 1.3, 0.6); hand.position.y = -0.31; elbow.add(hand);
      parts.arms.push(sh); parts.elbows.push(elbow);
    });
    // ---- neck + head + face ----
    const neck = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.11, 10), skin); neck.position.y = 1.48; body.add(neck);
    const headRig = new T.Group(); headRig.position.y = 1.63; body.add(headRig); parts.head = headRig;
    const head = cast(new T.Mesh(new T.SphereGeometry(0.125, 16, 14), skin));
    head.scale.set(0.92, 1.1, 1.0); headRig.add(head);
    [-1, 1].forEach(side => {
      const eye = new T.Mesh(new T.SphereGeometry(0.016, 6, 6), eyeM);
      eye.position.set(side * 0.045, 0.02, 0.115); head.add(eye);
    });
    const nose = new T.Mesh(new T.ConeGeometry(0.016, 0.04, 6), skin);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.01, 0.13); head.add(nose);
    [-1, 1].forEach(side => {
      const ear = new T.Mesh(new T.SphereGeometry(0.022, 6, 6), skin);
      ear.position.set(side * 0.12, 0, 0); head.add(ear);
    });
    // ---- hair ----
    const cap = new T.Mesh(new T.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
    cap.scale.set(0.95, 1.05, 1.0); cap.position.set(0, 0.035, -0.018); headRig.add(cap);
    // Rounded locks keep the hair silhouette soft and move with the head.
    const oval = (parent, material, x, y, z, sx, sy, sz) => {
      const mesh = cast(new T.Mesh(new T.SphereGeometry(1, 12, 10), material));
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh);
      return mesh;
    };
    if (B.hair === 'long') {
      oval(headRig, hairM, 0, -0.095, -0.09, 0.12, 0.19, 0.065);
      [-1, 1].forEach(side => {
        oval(headRig, hairM, side * 0.104, -0.04, -0.015, 0.032, 0.12, 0.055);
      });
      oval(headRig, hairM, -0.035, 0.105, 0.05, 0.095, 0.043, 0.075);
    } else {
      const sweep = oval(headRig, hairM, -0.025, 0.12, 0.025, 0.105, 0.048, 0.095);
      sweep.rotation.z = -0.18;
      [-1, 1].forEach(side => {
        oval(headRig, hairM, side * 0.105, 0.015, -0.025, 0.019, 0.07, 0.065);
      });
    }
    const lip = M('#925d4a'), trim = M('#d8c99f'), sole = M('#171c20');
    [-1, 1].forEach(side => {
      const brow = oval(head, hairM, side * 0.045, 0.048, 0.109, 0.024, 0.006, 0.009);
      brow.rotation.z = side * -0.1;
      oval(head, trim, side * 0.042, 0.024, 0.129, 0.004, 0.004, 0.003);
    });
    oval(head, lip, 0, -0.052, 0.113, 0.028, 0.005, 0.006);
    // Jacket hem, front zip and collar create a readable outdoor outfit.
    const hem = new T.Mesh(new T.CylinderGeometry(B.waist, B.hipW, 0.11, 12), shirt);
    hem.scale.z = 0.72; hem.position.y = 0.99; body.add(hem);
    const zip = new T.Mesh(new T.BoxGeometry(0.009, 0.37, 0.009), trim);
    zip.position.set(0, 1.205, (B.chestTop + B.waist) * 0.36 + 0.007);
    zip.rotation.x = Math.atan((B.chestTop - B.waist) * 0.72 / 0.48); body.add(zip);
    [-1, 1].forEach(side => {
      const collar = oval(body, trim, side * 0.055, 1.423, 0.065, 0.047, 0.018, 0.049);
      collar.rotation.z = side * 0.28;
    });
    // Soft daypack, contrasting pocket and straps, visible from the follow camera.
    oval(body, pack, 0, 1.17, -0.205, 0.145, 0.19, 0.10);
    oval(body, shirt, 0, 1.10, -0.29, 0.105, 0.08, 0.035);
    [-1, 1].forEach(side => {
      const strap = new T.Mesh(new T.BoxGeometry(0.028, 0.36, 0.019), pack);
      strap.position.set(side * 0.115, 1.225, 0.10);
      strap.rotation.z = side * -0.12; body.add(strap);
      const tread = new T.Mesh(new T.BoxGeometry(0.116, 0.022, 0.26), sole);
      tread.position.set(0, -0.429, 0.05); parts.knees[side === -1 ? 0 : 1].add(tread);
    });

    outer.scale.setScalar(B.height);
    outer.userData = { body, parts, phase: Math.random() * 6, headY: 1.63 * B.height, kind };
    return outer;
  }

  function animate(outer, time, walking) {
    const ud = outer.userData, body = ud.body, p = ud.parts;
    const t = time / 1000, ph = ud.phase;
    const legs = p.legs, knees = p.knees, arms = p.arms, elbows = p.elbows;
    p.chest.scale.x = 1;
    p.head.rotation.set(0, 0, 0);
    if (walking) {
      const sp = 8.5, a = t * sp + ph, sw = Math.sin(a);
      legs[0].rotation.x = sw * 0.55; legs[1].rotation.x = -sw * 0.55;
      // the knee folds as the leg swings through, straightens at heel-strike
      knees[0].rotation.x = -Math.max(0, Math.sin(a + Math.PI / 2)) * 0.85;
      knees[1].rotation.x = -Math.max(0, Math.sin(a + Math.PI * 1.5)) * 0.85;
      arms[0].rotation.x = -sw * 0.45; arms[1].rotation.x = sw * 0.45;
      elbows[0].rotation.x = 0.25 + Math.max(0, -sw) * 0.35;
      elbows[1].rotation.x = 0.25 + Math.max(0, sw) * 0.35;
      body.position.y = Math.abs(Math.sin(a)) * 0.05;
      body.rotation.z = sw * 0.02;
      body.rotation.y = -sw * 0.05;                       // a little hip / shoulder counter-twist
    } else {
      const b = Math.sin(t * 1.6 + ph);
      body.position.y = 0.005 + b * 0.006;
      body.rotation.y = 0; body.rotation.z = 0;
      legs[0].rotation.x = 0; legs[1].rotation.x = 0;
      knees[0].rotation.x = 0; knees[1].rotation.x = 0;
      arms[0].rotation.x = b * 0.04; arms[1].rotation.x = -b * 0.04;
      elbows[0].rotation.x = 0.18; elbows[1].rotation.x = 0.18;
      if (p.chest) p.chest.scale.x = 1 + b * 0.015;        // breathing
      if (p.head) { p.head.rotation.z = b * 0.02; p.head.rotation.y = Math.sin(t * 0.5 + ph) * 0.12; }
    }
  }

  function disposeGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
  }

  /* ---------- collision against trunk footprints ---------- */
  const R = 0.75;             // avatar radius
  function resolve(nx, nz, ox, oz) {
    let x = nx, z = nz;
    for (const b of window.GROVE.blockers) {
      const rr = (b.r || 1) + R;
      const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
      if (d < rr && d > 0.0001) { x = b.x + dx / d * rr; z = b.z + dz / d * rr; }
    }
    const lim = C.play / 2 + 30;
    x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));
    return { x, z };
  }

  /* ---------- the player object ---------- */
  const P = {
    sceneEl: null, camEl: null, cam: null, canvas: null,
    avatar: null, pos: new T.Vector3(), heading: Math.PI,
    target: null,                       // click-to-walk destination
    cam_yaw: 0, cam_pitch: 0.42, cam_dist: 11,
    gazeUp: 0,                          // 0..1 look-at-canopy blend
    moving: false, frozen: false,
    vy: 0, jumpY: 0, grounded: true,    // vertical jump state
    _drag: null, _up: new T.Vector3(0, 1, 0), _m4: new T.Matrix4(),
  };

  function faceCamera(obj, target) { P._m4.lookAt(obj.position, target, P._up); obj.quaternion.setFromRotationMatrix(P._m4); }

  P.init = function (sceneEl) {
    P.sceneEl = sceneEl;
    P.camEl = document.getElementById('cam');
    P.cam = P.camEl.getObject3D('camera');
    P.canvas = sceneEl.canvas;
    // Own all gestures on the 3D surface (orbit, two-finger gaze, double-tap
    // throw); inline so it beats A-Frame's injected canvas styles.
    P.canvas.style.touchAction = 'none';
    // avatar (preset remembered between visits)
    P.avatar = buildVisitor(P.bodyKind);
    P.pos.set(C.startPos.x, 0, C.startPos.z);
    P.heading = C.startHeading;
    P.avatar.position.copy(P.pos);
    P.avatar.rotation.y = P.heading;
    P.cam_yaw = P.heading + Math.PI;     // start camera behind avatar
    sceneEl.object3D.add(P.avatar);
    bindPointer();
    bindKeys();
    bindTouch();
    if (!sceneEl.components['playerdriver']) {
      AFRAME.registerComponent('playerdriver', { tick: (t, dt) => P.update(t, dt) });
      sceneEl.setAttribute('playerdriver', '');
    }
  };

  P.freeze = function (on) { P.frozen = on; if (on) { P.target = null; window.GROVE.input.x = 0; window.GROVE.input.z = 0; } };

  /* ---------- body preset: 'male' | 'female' (persisted) ---------- */
  function loadBody() {
    try { const k = localStorage.getItem(BODY_KEY); return BODIES[k] ? k : 'male'; } catch (e) { return 'male'; }
  }
  P.bodyKind = loadBody();
  P.setBody = function (kind) {
    kind = BODIES[kind] ? kind : 'male';
    P.bodyKind = kind;
    try { localStorage.setItem(BODY_KEY, kind); } catch (e) {}
    if (!P.sceneEl || !P.avatar) return kind;
    const old = P.avatar;
    const next = buildVisitor(kind);
    next.position.copy(old.position);
    next.rotation.y = old.rotation.y;
    P.sceneEl.object3D.remove(old);
    disposeGroup(old);
    P.avatar = next;
    P.sceneEl.object3D.add(next);
    return kind;
  };

  P.jump = function () {
    if (P.grounded && !P.frozen) { P.vy = 6.4; P.grounded = false; }
  };

  /* ---------- per-frame ---------- */
  const _tgt = new T.Vector3(), _pos = new T.Vector3(), _f = new T.Vector3(), _rgt = new T.Vector3();
  P.update = function (time, dt) {
    dt = Math.min(dt, 50);
    const spd = 7.2 * dt / 1000;
    let mvx = 0, mvz = 0, walking = false;

    // arrow keys = mouse-free camera (matches drag-to-orbit): ←/→ yaw, ↑/↓ pitch
    if (!P.frozen) {
      const yawRate = 1.7 * dt / 1000;
      const pitchRate = 1.2 * dt / 1000;
      if (keys['arrowleft'])  P.cam_yaw += yawRate;   // swing view left
      if (keys['arrowright']) P.cam_yaw -= yawRate;   // swing view right
      if (keys['arrowup'])    P.cam_pitch = Math.max(0.08, P.cam_pitch - pitchRate);  // look up
      if (keys['arrowdown'])  P.cam_pitch = Math.min(1.25, P.cam_pitch + pitchRate);  // look down
      // keep holding ↑ once the view is level and the gaze lifts into the canopy
      P._gazeArrow = !!keys['arrowup'] && P.cam_pitch <= 0.081;
    }

    if (!P.frozen) {
      // camera-relative move from keys/joystick
      const inx = window.GROVE.input.x, inz = window.GROVE.input.z;
      if (inx || inz) {
        // forward = camera look direction projected on ground
        const cy = P.cam_yaw;
        const fwd = _f.set(Math.sin(cy), 0, Math.cos(cy));   // points from cam toward avatar? compute below
        // forward should be from avatar away from camera: -cam offset dir
        const fx = -Math.sin(cy), fz = -Math.cos(cy);
        const rx = Math.cos(cy), rz = -Math.sin(cy);
        mvx = fx * (-inz) + rx * inx;
        mvz = fz * (-inz) + rz * inx;
        const len = Math.hypot(mvx, mvz) || 1; mvx /= len; mvz /= len;
        P.target = null;
        walking = true;
      } else if (P.target) {
        // walk toward click target
        const dx = P.target.x - P.pos.x, dz = P.target.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.6) { mvx = dx / d; mvz = dz / d; walking = true; }
        else { P.target = null; }
      }
    }

    if (walking) {
      const nx = P.pos.x + mvx * spd, nz = P.pos.z + mvz * spd;
      const r = resolve(nx, nz, P.pos.x, P.pos.z);
      P.pos.x = r.x; P.pos.z = r.z;
      P.heading = Math.atan2(mvx, mvz);
    }
    P.moving = walking;

    // ---- terrain: the Mother stump is walkable; the ground rises under us ----
    const groundY = window.GROVE.terrainHeight
      ? window.GROVE.terrainHeight(P.pos.x, P.pos.z) : 0;

    // ---- vertical jump (gravity integration, relative to the ground surface) ----
    if (!P.grounded) {
      P.vy -= 18 * dt / 1000;            // gravity
      P.jumpY += P.vy * dt / 1000;
      if (P.jumpY <= 0) { P.jumpY = 0; P.vy = 0; P.grounded = true; }
    }
    P.avatar.position.set(P.pos.x, groundY + P.jumpY, P.pos.z);
    // smooth turn
    let dh = P.heading - P.avatar.rotation.y;
    while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    P.avatar.rotation.y += dh * Math.min(1, dt / 90);
    animate(P.avatar, time, walking);

    // ---- the look-up moment: a canopy reading appears as the gaze lifts ----
    if (window.GROVE.ui) {
      if (P.gazeUp > 0.5 && !P._noteUp) { P._noteUp = true; window.GROVE.ui.showCanopyNote(); }
      else if (P.gazeUp < 0.2 && P._noteUp) { P._noteUp = false; window.GROVE.ui.hideCanopyNote(); }
    }

    // ---- camera follow ----
    const headY = groundY + (P.avatar.userData.headY || 1.5) - 0.2 + P.jumpY * 0.7;
    // gaze (Q / held ↑ / two fingers): the camera drops to the walker's shoulder
    // and tilts steeply up the trunks into the crowns, instead of hovering above.
    const g0 = P.gazeUp, gaze = g0 * g0 * (3 - 2 * g0);           // smoothstep
    const fx = -Math.sin(P.cam_yaw), fz = -Math.cos(P.cam_yaw);   // where the walker faces
    const pitch = P.cam_pitch;
    const ox = P.pos.x + P.cam_dist * Math.sin(P.cam_yaw) * Math.cos(pitch);
    const oy = headY + P.cam_dist * Math.sin(pitch);
    const oz = P.pos.z + P.cam_dist * Math.cos(P.cam_yaw) * Math.cos(pitch);
    const sx = P.pos.x - fx * 1.7, sy = headY + 0.35, sz = P.pos.z - fz * 1.7;   // over the shoulder
    _pos.set(ox + (sx - ox) * gaze, oy + (sy - oy) * gaze, oz + (sz - oz) * gaze);
    const focus = _tgt.set(
      P.pos.x + fx * 7 * gaze, headY + 130 * gaze, P.pos.z + fz * 7 * gaze);   // up into the canopy
    P.camEl.object3D.position.lerp(_pos, Math.min(1, dt / 130));
    faceCamera(P.camEl.object3D, focus);

    // proximity → stations
    if (window.GROVE.stations) window.GROVE.stations.checkProximity(P.pos);

    // Spatial-audio listener rides the avatar and faces the camera yaw (not
    // the distant orbit camera), so the guiding sound pans by direction
    // relative to where you actually stand and look.
    if (window.GROVE.spatial) {
      const lfx = -Math.sin(P.cam_yaw), lfz = -Math.cos(P.cam_yaw);
      window.GROVE.spatial.setListener(P.pos.x, P.pos.z, lfx, lfz);
    }
  };

  /* ---------- pointer (orbit + click-to-walk) ---------- */
  function setNDC(e, out) {
    const r = P.canvas.getBoundingClientRect();
    out.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    out.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  const _ndc = new T.Vector2(), _ray = new T.Raycaster(), _ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
  function groundPoint(e) {
    setNDC(e, _ndc); _ray.setFromCamera(_ndc, P.cam);
    const p = new T.Vector3();
    return _ray.ray.intersectPlane(_ground, p) ? p : null;
  }
  function bindPointer() {
    P.canvas.addEventListener('pointerdown', e => {
      if (P.frozen) return;
      P._drag = { sx: e.clientX, sy: e.clientY, moved: false };
      P.canvas.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointermove', e => {
      if (!P._drag || P._twoFinger) return;   // two-finger gaze suppresses orbit
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(e.clientX - P._drag.sx) + Math.abs(e.clientY - P._drag.sy) > 4) P._drag.moved = true;
      if (P._drag.moved) {
        P.cam_yaw -= dx * 0.006;
        P.cam_pitch = Math.max(0.08, Math.min(1.25, P.cam_pitch + dy * 0.005));
      }
    });
    window.addEventListener('pointerup', e => {
      if (!P._drag) return;
      const wasTap = !P._drag.moved && !P.frozen;
      P._drag = null;
      if (!wasTap) return;
      // ignore lifts that were part of (or just after) a two-finger gaze gesture
      if (P._twoFinger || performance.now() < (P._multiUntil || 0)) return;
      const gp = groundPoint(e);
      if (gp) P.target = { x: gp.x, z: gp.z };
    });
    P.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      P.cam_dist = Math.max(5, Math.min(22, P.cam_dist * (1 + Math.sign(e.deltaY) * 0.08)));
    }, { passive: false });
    P.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ---------- touch gestures (mobile) ---------- */
  // Count only the fingers that landed on the 3D canvas, so the movement
  // joystick (its own element) never registers as a gaze gesture.
  function canvasTouchCount(e) {
    let n = 0;
    for (const t of e.touches) if (t.target === P.canvas) n++;
    return n;
  }
  function bindTouch() {
    if (!P.canvas) return;
    // Two fingers on the scene = look straight up into the canopy (mirrors holding Q).
    P.canvas.addEventListener('touchstart', e => {
      if (P.frozen) return;
      if (canvasTouchCount(e) >= 2) {
        P._twoFinger = true;
        P._gaze = true;
        P._drag = null;            // drop any single-finger orbit in progress
      }
    }, { passive: true });
    const release = e => {
      if (canvasTouchCount(e) < 2) P._gaze = false;
      if (e.touches.length === 0) {
        if (P._twoFinger) P._multiUntil = performance.now() + 350;
        P._twoFinger = false;
      }
    };
    P.canvas.addEventListener('touchend', release, { passive: true });
    P.canvas.addEventListener('touchcancel', release, { passive: true });
  }

  /* ---------- keyboard ---------- */
  window.GROVE.input = { x: 0, z: 0 };
  const keys = {};
  function bindKeys() {
    window.addEventListener('keydown', e => {
      if (e.target && /TEXTAREA|INPUT/.test(e.target.tagName)) return;
      keys[e.key.toLowerCase()] = true; syncInput();
      if (e.key.toLowerCase() === 'q') P._gaze = true;
      // arrows drive the camera (handled in P.update); stop them scrolling the page
      if (/^Arrow(Up|Down|Left|Right)$/.test(e.key)) e.preventDefault();
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); P.jump(); }
      if (e.key === 'Escape' && window.GROVE.ui) window.GROVE.ui.closeTask();
    });
    window.addEventListener('keyup', e => {
      keys[e.key.toLowerCase()] = false; syncInput();
      if (e.key.toLowerCase() === 'q') P._gaze = false;
    });
    // gaze blend loop
    setInterval(() => {
      const want = (P._gaze || P._gazeArrow) ? 1 : 0;
      P.gazeUp += (want - P.gazeUp) * 0.12;
    }, 16);
  }
  function syncInput() {
    let x = 0, z = 0;
    // WASD walks; arrow keys are the mouse-free CAMERA controls (see P.update).
    if (keys['w']) z -= 1;
    if (keys['s']) z += 1;
    if (keys['a']) x -= 1;
    if (keys['d']) x += 1;
    // only override joystick when keys pressed
    if (x || z) { window.GROVE.input.x = x; window.GROVE.input.z = z; }
    else if (!window.GROVE._joyActive) { window.GROVE.input.x = 0; window.GROVE.input.z = 0; }
  }

  P.setGaze = function (on) { P._gaze = on; };
  P.teleport = function (x, z, faceHeading) {
    const gy = window.GROVE.terrainHeight ? window.GROVE.terrainHeight(x, z) : 0;
    P.pos.set(x, gy, z); P.target = null;
    if (faceHeading != null) {
      P.heading = faceHeading; P.avatar.rotation.y = faceHeading;
      P.cam_yaw = faceHeading + Math.PI;      // camera settles behind the walker, looking the same way
    }
  };

  window.GROVE.player = P;
})();

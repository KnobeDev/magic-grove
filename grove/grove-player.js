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

  /* ---------- a simple traveller figure (animated limbs) ---------- */
  function buildVisitor() {
    const M = (h, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: col(h), roughness: 0.9, flatShading: true }, o));
    const skin = M('#d6a878'), coat = M('#3d6b4a'), coatDk = M('#2f5239'), pack = M('#6e4a2a');
    const outer = new T.Group();
    const body = new T.Group(); outer.add(body);
    const parts = { legs: [], arms: [] };
    // legs
    [-1, 1].forEach(side => {
      const hip = new T.Group(); hip.position.set(side * 0.12, 0.55, 0); body.add(hip);
      const leg = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.55, 7), M('#3a3a44'));
      leg.position.y = -0.27; leg.castShadow = true; hip.add(leg);
      const boot = new T.Mesh(new T.BoxGeometry(0.15, 0.13, 0.26), M('#2a2018'));
      boot.position.set(0, -0.5, 0.04); hip.add(boot);
      parts.legs.push(hip);
    });
    // torso (a hiker's coat)
    const torso = new T.Mesh(new T.CylinderGeometry(0.24, 0.32, 0.58, 9), coat);
    torso.position.y = 0.86; torso.castShadow = true; body.add(torso); parts.torso = torso;
    // backpack
    const bag = new T.Mesh(new T.BoxGeometry(0.34, 0.46, 0.2), pack);
    bag.position.set(0, 0.9, -0.3); bag.castShadow = true; body.add(bag);
    const roll = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.4, 8), M('#a8893a'));
    roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.12, -0.32); body.add(roll);
    // arms
    [-1, 1].forEach(side => {
      const sh = new T.Group(); sh.position.set(side * 0.3, 1.06, 0); body.add(sh);
      const arm = new T.Mesh(new T.CylinderGeometry(0.075, 0.085, 0.5, 7), coatDk);
      arm.position.y = -0.26; arm.castShadow = true; sh.add(arm);
      const hand = new T.Mesh(new T.SphereGeometry(0.07, 8, 8), skin);
      hand.position.y = -0.52; sh.add(hand);
      parts.arms.push(sh);
    });
    // neck + head
    const neck = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.1, 8), skin); neck.position.y = 1.16; body.add(neck);
    const head = new T.Mesh(new T.SphereGeometry(0.17, 12, 12), skin);
    head.position.y = 1.32; head.scale.set(1, 1.08, 1); head.castShadow = true; body.add(head); parts.head = head;
    // hair / hat brim
    const hat = new T.Mesh(new T.CylinderGeometry(0.26, 0.28, 0.04, 14), M('#5a4326'));
    hat.position.y = 1.4; body.add(hat);
    const crown = new T.Mesh(new T.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), M('#6a5030'));
    crown.position.y = 1.4; body.add(crown);
    outer.userData = { body, parts, phase: 0 };
    return outer;
  }

  function animate(outer, time, walking) {
    const ud = outer.userData, body = ud.body, p = ud.parts;
    const t = time / 1000, ph = ud.phase;
    const legs = p.legs, arms = p.arms;
    if (walking) {
      const sp = 8.5, sw = Math.sin(t * sp + ph);
      legs[0].rotation.x = sw * 0.6; legs[1].rotation.x = -sw * 0.6;
      arms[0].rotation.x = -sw * 0.5; arms[1].rotation.x = sw * 0.5;
      body.position.y = Math.abs(Math.sin(t * sp)) * 0.06;
      body.rotation.z = sw * 0.02;
    } else {
      const b = Math.sin(t * 1.6 + ph);
      body.position.y = b * 0.012 + 0.01;
      legs[0].rotation.x = 0; legs[1].rotation.x = 0;
      arms[0].rotation.x = b * 0.05; arms[1].rotation.x = -b * 0.05;
      if (p.head) p.head.rotation.z = b * 0.025;
    }
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
    // avatar
    P.avatar = buildVisitor();
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

    // ---- camera follow ----
    const headY = groundY + 1.3 + P.jumpY * 0.7;
    const gaze = P.gazeUp;
    const focusY = headY + gaze * 10;
    const focus = _tgt.set(P.pos.x, focusY, P.pos.z);
    const dist = P.cam_dist * (1 - gaze * 0.35);
    const pitch = P.cam_pitch + gaze * 0.5;
    _pos.set(
      P.pos.x + dist * Math.sin(P.cam_yaw) * Math.cos(pitch),
      headY + dist * Math.sin(pitch) + gaze * 2,
      P.pos.z + dist * Math.cos(P.cam_yaw) * Math.cos(pitch)
    );
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
      const want = P._gaze ? 1 : 0;
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
    if (faceHeading != null) { P.heading = faceHeading; P.avatar.rotation.y = faceHeading; }
  };

  window.GROVE.player = P;
})();

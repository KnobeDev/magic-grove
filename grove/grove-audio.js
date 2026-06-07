/* ===================================================================
   grove-audio.js — window.GROVE.spatial
   Synthesized POSITIONAL audio for the walkable grove. No assets.

   Two capabilities, both built on Web Audio PannerNodes so direction +
   distance are encoded by the browser's HRTF panning relative to a
   listener that we keep pinned to the avatar (P.pos) facing the camera
   yaw — NOT the distant orbit camera.

   1. Per-station drones — each reflection station emits its own calm,
      localized tone. As you walk, the tone pans and attenuates. Tied to
      the ambient-audio toggle (one mute control). attachStations() is
      lazy: nodes are only built the first time sound is enabled.

   2. Echo ping (bingAt) — a one-shot positional "bing" placed at a world
      point, used by the echolocation sonar in grove-player.js. Routed
      straight to the destination so it works even when ambient is muted.

   Shares the AudioContext created by grove-ui.js via window.GROVE._audio
   so we never spin up a second context.
   =================================================================== */
(function () {
  const G = window.GROVE;

  const S = {
    ctx: null,        // fallback ctx if ambient bed was never started
    master: null,     // spatial drone master gain (station bed)
    stations: [],     // [{ id, panner, gain }]
    on: false,
    attached: false,
  };

  // One calm tone per station — a low, mostly-pentatonic ladder so the
  // grove hums in a consonant chord rather than a cluster.
  const SCALE = [
    110.00, 130.81, 146.83, 164.81, 196.00,
    220.00, 246.94, 293.66, 329.63, 392.00, 440.00,
  ];

  const DRONE_BASE = 0.085;   // per-station emit level when audible
  const DRONE_MASTER = 0.5;   // bed master when ambient is on

  /* ---- context: reuse grove-ui's if it exists, else lazily make one ---- */
  function ctx() {
    if (G._audio && G._audio.ctx) return G._audio.ctx;
    if (!S.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      S.ctx = new AC();
    }
    return S.ctx;
  }

  S.resume = function () {
    const c = ctx();
    if (c && c.state === 'suspended') c.resume();
    return c;
  };

  function ensureMaster(c) {
    if (!S.master) {
      S.master = c.createGain();
      S.master.gain.value = 0.0;
      S.master.connect(c.destination);
    }
    return S.master;
  }

  function makePanner(c, x, y, z) {
    const p = c.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 6;
    p.maxDistance = 60;
    p.rolloffFactor = 1.4;
    p.coneInnerAngle = 360;
    p.coneOuterAngle = 0;
    p.coneOuterGain = 0;
    if (p.positionX) {
      p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    } else {
      p.setPosition(x, y, z);   // legacy Safari
    }
    return p;
  }

  /* ---- per-station drones (lazy, built once) ---- */
  S.attachStations = function () {
    if (S.attached) return;
    const c = ctx(); if (!c) return;
    ensureMaster(c);
    const list = G.STATIONS || [];
    list.forEach((st, i) => {
      const freq = SCALE[i % SCALE.length];

      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // a quiet upper partial for warmth
      const osc2 = c.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2.001;
      const partial = c.createGain();
      partial.gain.value = 0.16;

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = freq * 4;
      lp.Q.value = 0.4;

      const g = c.createGain();
      g.gain.value = DRONE_BASE;

      // slow tremolo so each tone breathes at its own rate
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.06 + i * 0.004;
      const lfoGain = c.createGain();
      lfoGain.gain.value = DRONE_BASE * 0.4;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);

      const panner = makePanner(c, st.pos.x, 1.6, st.pos.z);

      osc.connect(lp);
      osc2.connect(partial); partial.connect(lp);
      lp.connect(g); g.connect(panner); panner.connect(S.master);
      osc.start(); osc2.start(); lfo.start();

      S.stations.push({ id: st.id, panner, gain: g });
    });
    S.attached = true;
  };

  S.setEnabled = function (on) {
    S.on = !!on;
    const c = ctx(); if (!c) return;
    if (S.on && !S.attached) S.attachStations();
    if (!S.master) return;
    const t = c.currentTime;
    S.master.gain.cancelScheduledValues(t);
    S.master.gain.setTargetAtTime(S.on ? DRONE_MASTER : 0.0, t, 0.5);
  };

  /* ---- listener pinned to the avatar, facing camera yaw ---- */
  S.setListener = function (x, z, fx, fz) {
    const c = (G._audio && G._audio.ctx) || S.ctx;
    if (!c) return;   // no context yet — nothing to position against
    const L = c.listener;
    const t = c.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(x, t, 0.02);
      L.positionY.setTargetAtTime(1.6, t, 0.02);
      L.positionZ.setTargetAtTime(z, t, 0.02);
      L.forwardX.setTargetAtTime(fx, t, 0.02);
      L.forwardY.setTargetAtTime(0, t, 0.02);
      L.forwardZ.setTargetAtTime(fz, t, 0.02);
      L.upX.setTargetAtTime(0, t, 0.02);
      L.upY.setTargetAtTime(1, t, 0.02);
      L.upZ.setTargetAtTime(0, t, 0.02);
    } else {
      L.setPosition(x, 1.6, z);            // legacy Safari
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  };

  /* ---- one-shot positional echo "bing" ----
     Placed at world (x,z); the panner + listener encode where it is, and
     the caller schedules `delay` so the bing fires as the sonar ring
     reaches it. Routed direct to destination so echo works while muted. */
  S.bingAt = function (x, z, opts) {
    opts = opts || {};
    const c = ctx(); if (!c) return;
    if (c.state === 'suspended') c.resume();
    const when = c.currentTime + (opts.delay || 0);
    const dur = opts.dur || 0.5;
    const f = opts.freq || 660;

    const panner = makePanner(c, x, 1.6, z);
    panner.refDistance = 4;
    panner.rolloffFactor = 1.2;
    panner.maxDistance = 40;

    const osc = c.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(f, when);
    osc.frequency.exponentialRampToValueAtTime(f * 0.86, when + dur);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.5, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(g); g.connect(panner); panner.connect(c.destination);
    osc.start(when); osc.stop(when + dur + 0.02);
    osc.onended = () => { try { panner.disconnect(); g.disconnect(); } catch (e) {} };
  };

  G.spatial = S;
})();

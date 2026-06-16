/* ===================================================================
   grove-spatial.js — window.GROVE.spatial
   TRUE positional audio. A looping ambient bed (gentle rain + birdsong)
   is emitted FROM the active station through a Web Audio HRTF PannerNode,
   while the AudioListener is pinned to the avatar and oriented to the
   camera yaw. So the sound:
     • pans between your ears by DIRECTION — louder in the ear toward the
       stop, centered only when you face straight at it (or away);
     • attenuates by DISTANCE — swelling as you approach, fading as you
       wander.
   Together that lets a visitor NAVIGATE to the next stop purely by ear.

   The bed is a same-origin asset, so unlike a cross-origin YouTube embed
   it can be decoded into an AudioBuffer and routed through real HRTF
   panning. OFF by default; started only by an explicit user gesture
   (autoplay policy + WCAG 1.4.2 Audio Control).
   =================================================================== */
(function () {
  const G = window.GROVE = window.GROVE || {};

  const SRC = 'grove/assets/whitenoisesleepers-rainy-day-in-town-with-birds-singing-194011.mp3';
  const REF_DIST = 6;     // full volume within this radius of the active stop
  const MAX_DIST = 95;    // fades to silence past here (covers the longest hop ~54u)
  const ROLLOFF = 1;      // linear distance rolloff
  const FADE = 0.8;       // fade in/out seconds
  const VOL_KEY = 'grove.spatial.vol';
  const DEFAULT_VOL = 0.7;  // gentle default — hearing differs; visitor can adjust

  function loadVol() {
    try {
      const v = parseFloat(localStorage.getItem(VOL_KEY));
      return (v >= 0 && v <= 1) ? v : DEFAULT_VOL;
    } catch (e) { return DEFAULT_VOL; }
  }

  const S = {
    ctx: null, buffer: null, source: null,
    panner: null, mono: null, master: null,
    on: false, loading: false,
    vol: loadVol(),
    _target: null,
  };

  function makeCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    return AC ? new AC() : null;
  }

  /* ---- graph: bufferSource → mono downmix → HRTF panner (at the stop)
     → master → out. The HRTF model expects a MONO source: a stereo bed
     fed straight in keeps a constant left bias and never truly centers,
     so we collapse to one channel first — then "ahead/behind" is dead
     center and the sides pan cleanly. ---- */
  function build() {
    S.master = S.ctx.createGain();
    S.master.gain.value = 0;
    S.master.connect(S.ctx.destination);

    const p = S.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'linear';
    p.refDistance = REF_DIST;
    p.maxDistance = MAX_DIST;
    p.rolloffFactor = ROLLOFF;
    p.coneInnerAngle = 360; p.coneOuterAngle = 0; p.coneOuterGain = 0;
    p.connect(S.master);
    S.panner = p;

    const mono = S.ctx.createGain();
    mono.channelCount = 1;
    mono.channelCountMode = 'explicit';
    mono.channelInterpretation = 'speakers';
    mono.connect(p);
    S.mono = mono;

    if (S._target) setPannerPos(S._target);
  }

  function setPannerPos(t) {
    if (!S.panner || !t) return;
    if (S.panner.positionX) {
      const now = S.ctx.currentTime;
      S.panner.positionX.setTargetAtTime(t.x, now, 0.08);
      S.panner.positionY.setTargetAtTime(1.6, now, 0.08);
      S.panner.positionZ.setTargetAtTime(t.z, now, 0.08);
    } else {
      S.panner.setPosition(t.x, 1.6, t.z);   // legacy Safari
    }
  }

  function startSource() {
    if (!S.buffer || S.source) return;
    const src = S.ctx.createBufferSource();
    src.buffer = S.buffer;
    src.loop = true;
    src.connect(S.mono);
    src.start();
    S.source = src;
  }

  function load(cb) {
    if (S.buffer) { cb(); return; }
    if (S.loading) return;
    S.loading = true;
    fetch(SRC)
      .then(r => r.arrayBuffer())
      .then(buf => S.ctx.decodeAudioData(buf,
        decoded => { S.buffer = decoded; S.loading = false; cb(); },
        () => { S.loading = false; }))
      .catch(() => { S.loading = false; });
  }

  /* ---- play / stop ---- */
  function start() {
    if (!S.ctx) { S.ctx = makeCtx(); if (!S.ctx) return; build(); }
    if (S.ctx.state === 'suspended') S.ctx.resume();
    S.on = true;
    load(function () {
      if (!S.on) return;                       // toggled back off while decoding
      startSource();
      const now = S.ctx.currentTime;
      S.master.gain.cancelScheduledValues(now);
      S.master.gain.setTargetAtTime(S.vol, now, FADE / 3);
    });
  }

  function stop() {
    S.on = false;
    if (!S.ctx || !S.master) return;
    const now = S.ctx.currentTime;
    S.master.gain.cancelScheduledValues(now);
    S.master.gain.setTargetAtTime(0, now, FADE / 4);
  }

  S.toggle = function () { S.on ? stop() : start(); return S.on; };
  S.isOn = function () { return S.on; };
  S.stop = stop;

  /* ---- one-shot "knock" cue: a gentle rap played as the visitor steps into
     a station's active area ("you've arrived — press I"). Independent of the
     HRTF guiding bed, and brief (<3s) so WCAG 1.4.2's auto-play rule does not
     apply. Cloned per play so quick re-entries can overlap; play() rejections
     (autoplay policy before any gesture) are swallowed. ---- */
  const KNOCK_SRC = 'grove/assets/universfield-door-knock-291150.mp3';
  const KNOCK_VOL = 0.5;
  let _knockEl = null;
  S.knock = function () {
    try {
      if (!_knockEl) { _knockEl = new Audio(KNOCK_SRC); _knockEl.preload = 'auto'; }
      const a = _knockEl.cloneNode();
      a.volume = KNOCK_VOL;
      const p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  };

  /* ---- visitor volume (0..1), persisted; live while playing ---- */
  S.getVolume = function () { return S.vol; };
  S.setVolume = function (v) {
    v = Math.max(0, Math.min(1, Number(v) || 0));
    S.vol = v;
    try { localStorage.setItem(VOL_KEY, String(v)); } catch (e) {}
    if (S.on && S.master && S.ctx) {
      const now = S.ctx.currentTime;
      S.master.gain.cancelScheduledValues(now);
      S.master.gain.setTargetAtTime(v, now, 0.05);
    }
  };

  /* ---- the active emitter: the next incomplete station (null when done) ---- */
  S.setTarget = function (pos) {
    S._target = pos || null;
    if (pos) setPannerPos(pos);
  };

  /* ---- listener rides the avatar, faces the camera yaw, so HRTF pans
     the bed correctly relative to where you stand and look ---- */
  S.setListener = function (x, z, fx, fz) {
    if (!S.ctx) return;
    const L = S.ctx.listener;
    const now = S.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(x, now, 0.02);
      L.positionY.setTargetAtTime(1.6, now, 0.02);
      L.positionZ.setTargetAtTime(z, now, 0.02);
      L.forwardX.setTargetAtTime(fx, now, 0.02);
      L.forwardY.setTargetAtTime(0, now, 0.02);
      L.forwardZ.setTargetAtTime(fz, now, 0.02);
      L.upX.setTargetAtTime(0, now, 0.02);
      L.upY.setTargetAtTime(1, now, 0.02);
      L.upZ.setTargetAtTime(0, now, 0.02);
    } else {
      L.setPosition(x, 1.6, z);                // legacy Safari
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  };

  G.spatial = S;
})();

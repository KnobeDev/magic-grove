/* ===================================================================
   grove-narrator.js — window.GROVE.narrator
   Spoken narration (audio description on the return, "Read this aloud", the
   Mother's ring reading, the instructor's final word) in the Piper neural
   voice "Amy" (en_US-amy-low), running entirely in the browser from
   grove/lib/piper/ (vendored by tools/fetch-piper.sh, never committed). The
   browser's own Web Speech voice is used only if Piper can never start.

   Every spoken line is CAPTIONED at the bottom of the screen as it is heard
   (from the queue's playback events, never from request time), and the whole
   passage is also posted once to an sr-only live region, so nothing depends
   on hearing (WCAG 1.2.1). Controls: a Stop button in the caption bar and
   Escape (1.4.2); HUD toggles for Voice (default ON; a screen-reader user
   turns it off once and it persists) and Captions.
   =================================================================== */
(function () {
  const G = window.GROVE = window.GROVE || {};
  const $ = (id) => document.getElementById(id);
  const VC = G.voiceCore;
  const VOICE_KEY = 'grove.narration.voice';
  const CAP_KEY = 'grove.narration.captions';
  const VOICE = 'en_US-amy-low';
  const PIPER = new URL('grove/lib/piper/', location.href).href;
  const PLAY_SLACK_MS = 750;
  const LINGER_MS = 1500;
  const TAG = 'narration';

  const N = { speaking: false, _voiceOn: true, _capOn: true, _pending: 0, _onend: null, _timers: [] };
  try { N._voiceOn = localStorage.getItem(VOICE_KEY) !== 'off'; } catch (e) {}
  try { N._capOn = localStorage.getItem(CAP_KEY) !== 'off'; } catch (e) {}

  /* ---------------- Piper engine ---------------- */
  async function loadPiper() {
    if (typeof WebAssembly !== 'object') throw new Error('WebAssembly is unavailable');
    const m = await import(PIPER + 'piper-tts-web.js');
    // The bundle feeds espeak's phoneme ids straight to the model, but this
    // voice knows only `num_symbols` of them; a rarer mark (the syllabic n in
    // "button") lands out of range, crashes the ONNX run and wedges the engine.
    // Drop any id the voice has no symbol for — the word still reads naturally.
    const phon = new m.PhonemizeWebRuntime({ basePath: PIPER + 'piper/' });
    const rawPhonemize = phon.phonemize.bind(phon);
    phon.phonemize = async (text, cfg) => {
      const r = await rawPhonemize(text, cfg);
      const max = (cfg && cfg[0] && cfg[0].num_symbols) || Infinity;
      const ids = [], names = [];
      (r.phoneme_ids || []).forEach((id, i) => { if (id < max) { ids.push(id); names.push(r.phonemes ? r.phonemes[i] : undefined); } });
      return Object.assign({}, r, { phoneme_ids: ids, phonemes: names });
    };
    const engine = new m.PiperWebEngine({
      onnxRuntime: new m.OnnxWebRuntime({ basePath: PIPER + 'onnx/', numThreads: 1 }),
      phonemizeRuntime: phon,
      voiceProvider: new m.RemoteVoiceProvider({ baseUrl: PIPER + 'voices/' }),
    });
    await engine.generate('ready', VOICE);   // compile the WASM + load the model now, not on the first line
    N._engine = engine;                       // for diagnostics only
    return engine;
  }

  let ctx = null;
  function ensureContext() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const unlock = () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);

  const nativeVoice = 'speechSynthesis' in window;
  function nativeSpeak(text) {
    if (!nativeVoice) { lineStart(text); lineEnd(text); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 1.0;
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find(v => /^en/i.test(v.lang) && /female|samantha|karen|zira|google uk english female/i.test(v.name))
      || voices.find(v => /^en/i.test(v.lang)) || null;
    u.onstart = () => lineStart(text);
    u.onend = () => lineEnd(text);
    u.onerror = () => lineEnd(text);
    speechSynthesis.speak(u);
  }

  let current = null;
  const queue = VC.createVoiceQueue({
    load: loadPiper,
    synth: async (engine, text) => {
      const res = await engine.generate(text, VOICE);
      return ensureContext().decodeAudioData(await res.file.arrayBuffer());
    },
    play: (buffer) => new Promise((done) => {
      const c = ensureContext();
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.connect(c.destination);
      const guard = setTimeout(() => finish(), buffer.duration * 1000 + PLAY_SLACK_MS);
      const finish = () => { clearTimeout(guard); if (current && current.source === source) current = null; done(); };
      source.onended = finish;
      current = { source, finish };
      source.start();
    }),
    stopPlayback: () => {
      if (nativeVoice) speechSynthesis.cancel();
      if (!current) return;
      const { source, finish } = current;
      try { source.stop(); } catch (e) {}
      finish();
    },
    fallback: nativeSpeak,
    onStart: lineStart,
    onEnd: lineEnd,
    onFail: (text) => {                  // unsayable line: caption it for reading time, keep the count right
      capShow(text, VC.readingMs(text));
      if (N._pending > 0) { N._pending--; if (N._pending === 0) N._timers.push(setTimeout(finish, VC.readingMs(text))); }
    },
    onError: (err) => { if (window.console) console.warn('Narrator voice:', err); },
  });

  /* ---------------- captions (bottom of the screen) ---------------- */
  let hideTimer = 0, fadeTimer = 0;
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function bar() { return $('captions-bar'); }
  function clearCapTimers() { clearTimeout(hideTimer); clearTimeout(fadeTimer); }
  function capHideNow() {
    clearCapTimers();
    const b = bar(); if (!b) return;
    b.classList.remove('is-fading'); b.hidden = true;
    const t = $('captions'); if (t) t.textContent = '';
    document.body.classList.remove('captions-showing');
  }
  function capHideAfter(ms) {
    clearCapTimers();
    hideTimer = setTimeout(() => {
      const b = bar(); if (!b) return;
      if (reduced()) { capHideNow(); return; }
      b.classList.add('is-fading');
      fadeTimer = setTimeout(capHideNow, 220);
    }, ms);
  }
  function capShow(text, holdMs) {
    if (!N._capOn || !text) return;
    const b = bar(), t = $('captions'); if (!b || !t) return;
    clearCapTimers();
    b.classList.remove('is-fading');
    t.textContent = text;                 // text, never markup: it can carry the visitor's name
    b.hidden = false;
    document.body.classList.add('captions-showing');
    if (holdMs) capHideAfter(holdMs);
    // a caller asked for focus to follow the bar: only now is Stop focusable
    if (N._focusNext) { N._focusNext = false; const s = $('nar-stop'); if (s) s.focus(); }
  }
  function capEnd() { const b = bar(); if (b && !b.hidden) capHideAfter(LINGER_MS); }

  function lineStart(text) { capShow(text); }
  function lineEnd() {
    capEnd();
    if (N._pending > 0) { N._pending--; if (N._pending === 0) finish(); }
  }
  function finish() {
    N.speaking = false;
    const cb = N._onend; N._onend = null;
    if (cb) cb();
  }
  function clearTimers() { N._timers.forEach(clearTimeout); N._timers = []; }

  /* ---------------- HUD toggles ---------------- */
  function syncButtons() {
    const v = $('tool-voice');
    if (v) {
      v.classList.toggle('on', N._voiceOn);
      v.setAttribute('aria-pressed', N._voiceOn ? 'true' : 'false');
      const l = N._voiceOn ? 'Turn the spoken voice off (captions stay on)' : 'Turn the spoken voice on';
      v.setAttribute('aria-label', l); v.setAttribute('title', l);
    }
    const c = $('tool-captions');
    if (c) {
      c.classList.toggle('on', N._capOn);
      c.setAttribute('aria-pressed', N._capOn ? 'true' : 'false');
      const l = N._capOn ? 'Turn captions off' : 'Turn captions on';
      c.setAttribute('aria-label', l); c.setAttribute('title', l);
    }
  }

  /* ---------------- API ---------------- */
  N.supported = typeof WebAssembly === 'object' || nativeVoice;
  N.voiceOn = () => N._voiceOn;
  N.captionsOn = () => N._capOn;
  N.isSpeaking = () => N.speaking;
  N.status = () => queue.status;

  N.setVoice = function (on) {
    N._voiceOn = !!on;
    try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch (e) {}
    syncButtons();
    if (on) queue.preload(); else N.stop(false);
  };
  N.setCaptions = function (on) {
    N._capOn = !!on;
    try { localStorage.setItem(CAP_KEY, on ? 'on' : 'off'); } catch (e) {}
    syncButtons();
    if (!on) capHideNow();
  };
  /* Warm the engine (on a user gesture) so the first line isn't the one that waits. */
  N.preload = function () { if (N._voiceOn && typeof WebAssembly === 'object') queue.preload(); };

  /* speak(text, { label, onend }) — posts the passage to the live region once,
     then speaks it line by line with captions; with the voice off, captions
     run on a reading-time timer instead. */
  /* speak(text, { label, onend, focusStop, append })
     append: queue behind whatever is being read instead of cutting it off
     (used for proximity prompts that appear mid-passage). */
  N.speak = function (text, opts) {
    opts = opts || {};
    const append = !!opts.append && N.speaking;
    if (!append) N.stop(false);
    N._label = opts.label || '';
    const live = $('nar-live');
    if (live) { live.textContent = ''; N._timers.push(setTimeout(() => { live.textContent = (opts.label ? opts.label + '. ' : '') + text; }, 50)); }
    const lines = VC.splitLines(text);
    if (!append) { N._onend = opts.onend || null; N._focusNext = !!opts.focusStop; N._pending = 0; N._capAt = 0; }
    N.speaking = true;
    if (N._voiceOn && N.supported) {
      const tag = append ? (opts.label || TAG) : TAG;   // appended lines carry their own tag so they can be dropped alone
      lines.forEach((line, i) => { if (queue.speak(line, { interrupt: !append && i === 0, tag })) N._pending++; });
      if (!N._pending) finish();
      return true;
    }
    // voice off: captions only, paced to reading speed (appended lines follow the current ones)
    let at = append ? Math.max(0, N._capAt - performance.now()) : 0;
    lines.forEach((line, i) => {
      const hold = VC.readingMs(line);
      N._timers.push(setTimeout(() => capShow(line, hold), at));
      at += hold;
      if (i === lines.length - 1) N._timers.push(setTimeout(finish, at));
    });
    N._capAt = performance.now() + at;
    return false;
  };
  /* Stop only if the passage being read carries this label (a prompt that just
     hid must not silence the audio description playing beneath it). */
  N.stopIf = function (label) {
    if (!N.speaking) return;
    if (N._label === label) { N.stop(); return; }
    // appended under another passage: drop only these lines, keep the count honest
    const dropped = queue.cancel(label);
    if (dropped) { N._pending = Math.max(0, N._pending - dropped); if (N._pending === 0) finish(); }
  };

  N.stop = function () {
    clearTimers();
    queue.stop();                          // every tag: the passage and anything appended to it
    const was = N.speaking;
    N.speaking = false; N._pending = 0; N._onend = null; N._focusNext = false; N._label = ''; N._capAt = 0;
    if (was) capHideNow();
  };
  N.hide = function () { N.stop(); capHideNow(); };

  N.init = function () {
    syncButtons();
    const v = $('tool-voice'); if (v) v.onclick = () => { N.setVoice(!N._voiceOn); if (G.ui) G.ui.toast(N._voiceOn ? 'Voice on — the grove will read aloud' : 'Voice off — captions only'); };
    const c = $('tool-captions'); if (c) c.onclick = () => { N.setCaptions(!N._capOn); if (G.ui) G.ui.toast(N._capOn ? 'Captions on' : 'Captions off'); };
    const s = $('nar-stop'); if (s) s.onclick = () => N.stop();
  };

  // The HUD markup is parsed before this script: reflect the stored preference
  // on the toggles right away, not only once the grove has booted.
  syncButtons();

  G.narrator = N;
})();

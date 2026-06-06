/* ===================================================================
   grove-ui.js — DOM layer: proximity prompt, sliding task panels,
   seed sidebar, touch joystick, ambient audio, toasts, progress.
   Exposes GROVE.ui.
   =================================================================== */
(function () {
  const U = {};
  const $ = (id) => document.getElementById(id);
  let currentStation = null;
  let lastFocus = null;

  /* ---------------- progress dots ---------------- */
  U.updateProgress = function () {
    const wrap = $('progress'); if (!wrap) return;
    const stations = window.GROVE.STATIONS;
    if (wrap.children.length !== stations.length) {
      wrap.innerHTML = '';
      for (let i = 0; i < stations.length; i++) wrap.appendChild(document.createElement('i'));
    }
    const a = window.GROVE.knobe.answers;
    const isDone = (st) => window.GROVE.stations
      ? window.GROVE.stations.isComplete(st)
      : st.questions.every(q => /Optional/i.test(q.label) || (a[q.field] || '').trim());
    let nextSet = false;
    [...wrap.children].forEach((d, i) => {
      const dn = isDone(stations[i]);
      d.classList.toggle('done', dn);
      d.classList.remove('next');
      if (!dn && !nextSet) { d.classList.add('next'); nextSet = true; }
      d.title = stations[i].title;
    });
  };

  /* ---------------- proximity prompt ---------------- */
  U.showPrompt = function (station) {
    const p = $('prompt');
    if (!station) { p.classList.remove('show'); return; }
    if ($('task').classList.contains('show')) { p.classList.remove('show'); return; }
    const a = window.GROVE.knobe.answers;
    const done = window.GROVE.stations
      ? window.GROVE.stations.isComplete(station)
      : station.questions.every(q => /Optional/i.test(q.label) || (a[q.field] || '').trim());
    const ni = window.GROVE.stations ? window.GROVE.stations.nextIndex() : -1;
    const isNext = ni >= 0 && window.GROVE.STATIONS[ni] === station;
    const stateClass = done ? 'is-done' : (isNext ? 'is-next' : 'is-upcoming');
    p.className = 'prompt ' + stateClass;
    p.innerHTML =
      `<div class="p-badge">${station.num}</div>` +
      `<div class="p-main">` +
        `<div class="p-layer">${station.layer}${isNext && !done ? ' &middot; <b>your next stop</b>' : ''}</div>` +
        `<div class="p-title">${station.title}</div>` +
        `<div class="p-cta">Press <span class="p-key" id="prompt-open">I</span> or click to ` +
        `${done ? 'revisit' : (station.isSeed ? 'gather your seed' : (station.questions.length ? 'read &amp; respond' : 'read on'))}</div>` +
        (done ? `<div class="p-done">✓ recorded</div>` : '') +
      `</div>`;
    p.classList.add('show');
    $('prompt-open').onclick = () => U.openTask(station);
    p.onclick = (e) => { if (e.target.id !== 'prompt-open') U.openTask(station); };
  };

  /* ---------------- task panel ---------------- */
  U.openTask = function (station) {
    if (!station) return;
    currentStation = station;
    $('prompt').classList.remove('show');
    window.GROVE.player.freeze(true);
    if (window.GROVE.stations && window.GROVE.stations.markVisited) window.GROVE.stations.markVisited(station.id);

    const a = window.GROVE.knobe.answers;
    $('task-layer').textContent = station.layer;
    $('task-title').textContent = station.title;
    $('task-sub').textContent = station.subtitle;

    const body = $('task-body');
    let html = '<div class="intro">' + station.intro.map(p => `<p>${p}</p>`).join('') + '</div>';

    if (station.isSeed && a.project_description) {
      html += `<div class="recall"><div class="rl">What you wrote when you arrived</div>` +
        `<div class="rt">“${escapeHtml(a.project_description)}”</div></div>`;
    }

    station.questions.forEach(q => {
      const val = a[q.field] ? escapeHtml(a[q.field]) : '';
      html += `<div class="qblock">` +
        `<div class="qlabel">${q.label}</div>` +
        `<div class="qtext">${q.text}</div>` +
        `<textarea data-field="${q.field}" placeholder="${escapeAttr(q.placeholder)}">${val}</textarea>` +
        `<div class="knobe-tag">→ <b>KNOBE field:</b> ${q.knobe}</div>` +
        `</div>`;
    });

    if (station.isSeed) {
      html += `<div class="export-row">` +
        `<button class="btn" id="exp-copy">Copy to Clipboard</button>` +
        `<button class="btn" id="exp-email">Email to Myself</button>` +
        `<button class="btn leaf" id="exp-down">Save .knobe.md</button>` +
        `</div>` +
        `<p style="font-size:13px;color:var(--ink-mute);margin:4px 0 0;text-align:center;">` +
        `Plain text. Open it in any editor, paste into any AI conversation, submit as your Knote. No login. No platform owns it.</p>` +
        `<div class="keymap">` +
        `<div class="kr"><b>Bark</b><span>SHA-256 seal — proof the record is unaltered</span></div>` +
        `<div class="kr"><b>Sapwood</b><span>Human-readable content — your living prose</span></div>` +
        `<div class="kr"><b>Heartwood</b><span>Schema — structured, machine-readable record</span></div>` +
        `<div class="kr"><b>Roots</b><span>Distributed network — no single point of failure</span></div>` +
        `<div class="kr"><b>Cone / Seed</b><span>.knobe.md — portable, opens anywhere</span></div>` +
        `</div>`;
    }

    html += `<div class="grove-key"><b>Grove Key</b>${station.key}</div>`;
    body.innerHTML = html;
    body.scrollTop = 0;

    body.querySelectorAll('textarea[data-field]').forEach(ta => {
      ta.addEventListener('input', () => {
        window.GROVE.knobe.setAnswer(ta.dataset.field, ta.value);
        flashSaved();
        U.updateProgress();
      });
    });
    if (station.isSeed) {
      $('exp-copy').onclick = () => window.GROVE.knobe.copy();
      $('exp-email').onclick = () => window.GROVE.knobe.email();
      $('exp-down').onclick = () => window.GROVE.knobe.download();
    }

    lastFocus = document.activeElement;
    const taskEl = $('task');
    taskEl.classList.add('show');
    taskEl.setAttribute('aria-hidden', 'false');
    $('scrim').classList.add('show');
    const firstEmpty = [...body.querySelectorAll('textarea')].find(t => !t.value);
    const focusTarget = firstEmpty || $('task-close');
    if (focusTarget) setTimeout(() => focusTarget.focus(), 520);
  };

  U.closeTask = function () {
    const taskEl = $('task');
    taskEl.classList.remove('show');
    taskEl.setAttribute('aria-hidden', 'true');
    $('scrim').classList.remove('show');
    window.GROVE.player.freeze(false);
    if (window.GROVE.stations) window.GROVE.stations.refresh();
    U.updateProgress();
    currentStation = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  };

  let savedT = null;
  function flashSaved() {
    const s = $('task-saved'); if (!s) return;
    s.classList.add('show');
    clearTimeout(savedT); savedT = setTimeout(() => s.classList.remove('show'), 1200);
  }

  /* ---------------- sidebar ---------------- */
  U.toggleSidebar = function (force) {
    const sb = $('sidebar');
    const open = force != null ? force : !sb.classList.contains('open');
    sb.classList.toggle('open', open);
    const tgl = $('seed-toggle');
    if (tgl) tgl.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  /* ---------------- toast ---------------- */
  let toastT = null;
  U.toast = function (msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  };

  /* ---------------- touch joystick ---------------- */
  function initJoystick() {
    const joy = $('joy'); if (!joy) return;
    const knob = joy.querySelector('i');
    let active = false, cx = 0, cy = 0, id = null;
    const R = 44;
    function start(e) {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      active = true; window.GROVE._joyActive = true; id = t.identifier;
      const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    }
    function move(e) {
      if (!active) return;
      const touches = e.changedTouches ? [...e.changedTouches] : [e];
      const t = touches.find(tt => tt.identifier === id) || touches[0];
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      window.GROVE.input.x = dx / R; window.GROVE.input.z = dy / R;
      e.preventDefault();
    }
    function end() {
      active = false; window.GROVE._joyActive = false;
      knob.style.transform = 'translate(0,0)';
      window.GROVE.input.x = 0; window.GROVE.input.z = 0;
    }
    joy.addEventListener('touchstart', start, { passive: false });
    joy.addEventListener('touchmove', move, { passive: false });
    joy.addEventListener('touchend', end);
    joy.addEventListener('touchcancel', end);
  }

  /* ---------------- ambient audio (synth forest bed) ---------------- */
  const audio = { ctx: null, on: false, gain: null, birdT: null };
  function startAudio() {
    if (audio.ctx) { resumeAudio(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(); audio.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = 0.0; master.connect(ctx.destination); audio.gain = master;
    const bufSize = 2 * ctx.sampleRate;
    const noise = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const windGain = ctx.createGain(); windGain.gain.value = 0.22;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 200;
    lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
    src.connect(lp); lp.connect(windGain); windGain.connect(master);
    src.start(); lfo.start();
    function chirp() {
      if (!audio.on) { audio.birdT = setTimeout(chirp, 3000); return; }
      const o = ctx.createOscillator(), g = ctx.createGain();
      const base = 1800 + Math.random() * 1600;
      o.type = 'sine'; o.frequency.value = base;
      const now = ctx.currentTime;
      const notes = 2 + (Math.random() * 3 | 0);
      for (let n = 0; n < notes; n++) o.frequency.setValueAtTime(base * (0.8 + Math.random() * 0.5), now + n * 0.09);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.045, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + notes * 0.09 + 0.1);
      o.connect(g); g.connect(master); o.start(now); o.stop(now + notes * 0.09 + 0.15);
      audio.birdT = setTimeout(chirp, 2600 + Math.random() * 6000);
    }
    audio.birdT = setTimeout(chirp, 2000);
    resumeAudio();
  }
  function resumeAudio() {
    if (!audio.ctx) return startAudio();
    audio.ctx.resume();
    audio.on = true;
    audio.gain.gain.linearRampToValueAtTime(0.5, audio.ctx.currentTime + 1.2);
    setAudioIcon(true);
  }
  function pauseAudio() {
    if (!audio.ctx) return;
    audio.on = false;
    audio.gain.gain.linearRampToValueAtTime(0.0, audio.ctx.currentTime + 0.4);
    setAudioIcon(false);
  }
  U.toggleAudio = function () { audio.on ? pauseAudio() : resumeAudio(); };
  U.startAudio = startAudio;

  /* ---- one-shot SFX: rock thunk / knock (procedural, no files) ----
     Plays through its own gain so it's audible even when the ambient
     bed is muted. strength 0..1 = how hard the impact; pan -1..1.       */
  U.playThunk = function (strength, pan, woody) {
    let ctx = audio.ctx;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx(); audio.ctx = ctx;
      const m = ctx.createGain(); m.gain.value = 0.0; m.connect(ctx.destination); audio.gain = m;
    }
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const s = Math.max(0.12, Math.min(1, strength || 0.5));
    const out = ctx.createGain();
    out.gain.value = 1;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan || 0)); out.connect(panner); panner.connect(ctx.destination); }
    else out.connect(ctx.destination);

    // low thud — a fast pitch-dropping sine, the "body" of the impact
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine';
    const f0 = woody ? 230 : 150;
    o.frequency.setValueAtTime(f0 * (0.9 + s * 0.5), now);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.45, now + 0.12);
    og.gain.setValueAtTime(0, now);
    og.gain.linearRampToValueAtTime(0.5 * s, now + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0008, now + 0.16 + s * 0.1);
    o.connect(og); og.connect(out); o.start(now); o.stop(now + 0.32);

    // click/scrape — short filtered noise burst for the "tk" transient
    const len = Math.floor(ctx.sampleRate * 0.09);
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const ns = ctx.createBufferSource(); ns.buffer = nb;
    const bp = ctx.createBiquadFilter();
    bp.type = woody ? 'bandpass' : 'lowpass';
    bp.frequency.value = woody ? 900 + s * 700 : 1600;
    bp.Q.value = woody ? 1.4 : 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.34 * s, now);
    ng.gain.exponentialRampToValueAtTime(0.0006, now + 0.08);
    ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(now); ns.stop(now + 0.1);
  };
  function setAudioIcon(on) {
    const btn = $('tool-audio'); if (!btn) return;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Mute ambient sound' : 'Play ambient sound');
    btn.querySelector('.a-on').style.display = on ? '' : 'none';
    btn.querySelector('.a-off').style.display = on ? 'none' : '';
  }

  /* ---------------- helpers ---------------- */
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  U.setPathBtn = function (on) {
    const btn = $('tool-path');
    if (btn) {
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Hide the path to your next stop' : 'Show the path to your next stop');
    }
    const pill = $('path-toggle');
    if (pill) {
      pill.classList.toggle('on', on);
      pill.setAttribute('aria-pressed', on ? 'true' : 'false');
      const st = $('path-state'); if (st) st.textContent = on ? 'On' : 'Off';
    }
  };

  U.init = function () {
    if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
      document.body.classList.add('touch');
    }
    initJoystick();
    $('task-close').onclick = U.closeTask;
    $('scrim').onclick = U.closeTask;
    $('seed-toggle').onclick = () => U.toggleSidebar();
    $('sb-close').onclick = () => U.toggleSidebar(false);
    $('tool-audio').onclick = U.toggleAudio;
    $('tool-fs').onclick = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    $('tool-seed').onclick = () => U.toggleSidebar();
    const onPathToggle = () => {
      const on = window.GROVE.stations.togglePath();
      U.toast(on ? 'Footpath lit — follow it to your next stop' : 'Footpath hidden');
    };
    const pathBtn = $('tool-path');
    if (pathBtn) pathBtn.onclick = onPathToggle;
    const pathPill = $('path-toggle');
    if (pathPill) pathPill.onclick = onPathToggle;
    U.setPathBtn(window.GROVE.stations.isPathVisible());
    // Escape closes the open task panel or seed sidebar (SC 2.1.2 / 2.4.3).
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if ($('task').classList.contains('show')) { e.preventDefault(); U.closeTask(); return; }
        if ($('sidebar').classList.contains('open')) { e.preventDefault(); U.toggleSidebar(false); return; }
      }
    });
    window.addEventListener('keydown', e => {
      if (e.target && /TEXTAREA|INPUT/.test(e.target.tagName)) return;
      // Interact with the nearby station. Primary key is "I" (interact);
      // Enter / Space also work. We avoid "E" because some host/preview
      // environments capture it as a global edit-mode shortcut.
      const k = e.key.toLowerCase();
      if (k === 'i' && window.GROVE.stations) {
        e.preventDefault();
        window.GROVE.stations.openActive();
      }
    });
  };

  window.GROVE.ui = U;
})();

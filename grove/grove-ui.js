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

  /* hosted imagery (shared with the guided walkthrough) */
  const ASSET_BASE = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b3dc8e562903af2bfb5cbb/';
  const ASSETS = {
    infographic: ASSET_BASE + '660935bb0_sequoia-knobe-infographic.png',
    sapwood: ASSET_BASE + '2536b609c_sapwood_living_sleeve.png',
    rings: ASSET_BASE + 'bf29c6549_sequoia_rings.jpg',
    fungalWeb: ASSET_BASE + '556d4b2ea_sequoia_fungal_web.png',
    mother: ASSET_BASE + '5c8f006f5_mother_of_forest.jpg',
  };
  // a contextual photo for certain stations
  const STATION_IMG = {
    mother: { src: ASSETS.mother, alt: 'The Mother of the Forest — a giant sequoia stripped of its bark in 1854.', cap: 'The Mother of the Forest, her bark peeled away for exhibition.' },
    sapwood: { src: ASSETS.sapwood, alt: 'Cross-section showing the pale living sapwood sleeve beneath the bark.', cap: 'The sapwood — the only living wood, a thin living sleeve.' },
    heartwood: { src: ASSETS.rings, alt: 'A polished sequoia cross-section showing concentric growth rings.', cap: 'The heartwood rings — every year recorded, faithfully.' },
    roots: { src: ASSETS.fungalWeb, alt: 'Illustration of the underground fungal network linking sequoia roots.', cap: 'The mycorrhizal web — no single point of failure.' },
  };
  const FORM_URL = 'https://forms.gle/thLA2FsJXsyDnzsC8';

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
    let html = '<div class="intro">' + station.intro.map(p => `<p>${escapeHtml(p)}</p>`).join('') + '</div>';

    // contextual hosted imagery
    const img = STATION_IMG[station.id];
    if (img) {
      html += `<figure class="station-fig">` +
        `<img src="${img.src}" alt="${escapeAttr(img.alt)}" loading="lazy" decoding="async">` +
        `<figcaption>${escapeHtml(img.cap)}</figcaption></figure>`;
    }

    if (station.isSeed && a.project_description) {
      html += `<div class="recall"><div class="rl">What you wrote when you arrived</div>` +
        `<div class="rt">“${escapeHtml(a.project_description)}”</div></div>`;
    }

    station.questions.forEach(q => {
      const val = a[q.field] ? escapeHtml(a[q.field]) : '';
      const taId = 'ta-' + q.field;
      html += `<div class="qblock">` +
        `<div class="qlabel" id="${taId}-l">${q.label}</div>` +
        `<div class="qtext">${q.text}</div>` +
        `<textarea id="${taId}" aria-labelledby="${taId}-l" data-field="${q.field}" placeholder="${escapeAttr(q.placeholder)}">${val}</textarea>` +
        `<div class="knobe-tag">→ <b>KNOBE field:</b> ${q.knobe}</div>` +
        `</div>`;
    });

    // live SHA-256 readout — visible whenever the visitor is writing
    if (station.questions.length) {
      html += `<div class="livehash" aria-live="off">` +
        `<div class="lh-label">Live SHA-256 fingerprint of your seed</div>` +
        `<code class="lh-value" data-live-hash>${'·'.repeat(64)}</code>` +
        `<div class="lh-note">Every character rewrites the entire fingerprint — that is what makes it tamper-evident.</div>` +
        `</div>`;
    }

    // closing narrative that follows the questions (the grove's reflection)
    if (station.outro && station.outro.length) {
      html += '<div class="intro outro">' + station.outro.map(p => `<p>${escapeHtml(p)}</p>`).join('') + '</div>';
    }

    // "Explore the living layers" — the layers infographic on the stump
    if (station.marker === 'stumplayer') {
      html += `<details class="layers-explore">` +
        `<summary>Explore the living layers</summary>` +
        `<figure class="station-fig wide">` +
        `<img src="${ASSETS.infographic}" alt="Infographic mapping sequoia layers (bark, sapwood, heartwood, roots, cone) to the KNOBE record." loading="lazy" decoding="async">` +
        `<figcaption>How each layer of the tree maps to a layer of your portable record.</figcaption></figure>` +
        `<div class="keymap">` +
        `<div class="kr"><b>Bark</b><span>SHA-256 seal — proof the record is unaltered</span></div>` +
        `<div class="kr"><b>Sapwood</b><span>Human-readable content — your living prose</span></div>` +
        `<div class="kr"><b>Heartwood</b><span>Schema — structured, machine-readable record</span></div>` +
        `<div class="kr"><b>Roots</b><span>Distributed network — no single point of failure</span></div>` +
        `<div class="kr"><b>Cone / Seed</b><span>.knobe.md — portable, opens anywhere</span></div>` +
        `</div></details>`;
    }

    // The Parting — a button to return home (or just walk back)
    if (station.returnsTo) {
      html += `<div class="export-row">` +
        `<button class="btn leaf" id="parting-return">Return to the visitor’s center</button>` +
        `</div>` +
        `<p class="task-note">Or simply walk back down the path — your seed will be waiting where you began.</p>`;
    }

    // The Seed — seal & finish
    if (station.isSeed) {
      html += `<div class="export-row">` +
        `<button class="btn leaf" id="seed-seal">Seal my seed</button>` +
        `</div>` +
        `<p class="task-note">Sealing folds your record into a final SHA-256 fingerprint and unlocks your portable file.</p>`;
    }

    html += `<div class="grove-key"><b>Grove Key</b>${escapeHtml(station.key)}</div>`;
    body.innerHTML = html;
    body.scrollTop = 0;

    body.querySelectorAll('textarea[data-field]').forEach(ta => {
      ta.addEventListener('input', () => {
        window.GROVE.knobe.setAnswer(ta.dataset.field, ta.value);
        window.GROVE.knobe.updateLiveHash(ta.dataset.field, ta.value);
        flashSaved();
        U.updateProgress();
      });
    });
    // prime the live readout with the current fingerprint
    if (station.questions.length) window.GROVE.knobe.updateLiveHash();

    const ret = $('parting-return');
    if (ret) ret.onclick = () => {
      U.closeTask();
      const c = window.GROVE.CONFIG;
      window.GROVE.player.teleport(c.startPos.x, c.startPos.z, c.startHeading);
      U.toast('Back at the visitor’s center — your seed awaits');
    };
    const sealBtn = $('seed-seal');
    if (sealBtn) sealBtn.onclick = () => U.sealSeed();

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

  /* =================================================================
     FALLEN-LOG EXHIBIT — the cross-section easter egg. A trailside
     panel that reads the living tree (bark / sapwood / heartwood) and
     flips to the same structure as a digital record (hash / markdown /
     JSON). Reuses the #task panel and #prompt chrome.
     ================================================================= */
  U.showExhibitPrompt = function (ex) {
    const p = $('prompt');
    if (!ex) { p.classList.remove('show'); return; }
    if ($('task').classList.contains('show')) { p.classList.remove('show'); return; }
    p.className = 'prompt is-exhibit';
    p.innerHTML =
      `<div class="p-badge">✦</div>` +
      `<div class="p-main">` +
        `<div class="p-layer">Trailside exhibit</div>` +
        `<div class="p-title">A fallen giant</div>` +
        `<div class="p-cta">Press <span class="p-key" id="prompt-open">I</span> or click to read its cross-section</div>` +
      `</div>`;
    p.classList.add('show');
    $('prompt-open').onclick = () => U.openExhibit(ex);
    p.onclick = (e) => { if (e.target.id !== 'prompt-open') U.openExhibit(ex); };
  };

  // a leader-lined SVG callout diagram (rings or document) shared shape
  function bioDiagram() {
    return `<svg class="xsec-svg" viewBox="0 0 360 250" role="img" ` +
      `aria-label="Cross-section of a giant sequoia trunk: an outer fire-resistant bark layer, a pale living sapwood sleeve, and dense red-brown heartwood growth rings around the pith.">` +
      `<defs><radialGradient id="hw" cx="42%" cy="42%" r="60%">` +
        `<stop offset="0%" stop-color="#7a4326"/><stop offset="70%" stop-color="#a35a32"/><stop offset="100%" stop-color="#8c4a28"/></radialGradient></defs>` +
      `<circle cx="120" cy="125" r="96" fill="#5a3a22"/>` +
      `<circle cx="120" cy="125" r="86" fill="#cdb079"/>` +
      `<circle cx="120" cy="125" r="70" fill="url(#hw)"/>` +
      // heartwood ring strokes
      [60, 50, 40, 30, 20].map(rr => `<circle cx="120" cy="125" r="${rr}" fill="none" stroke="rgba(60,30,16,0.45)" stroke-width="2.2"/>`).join('') +
      `<circle cx="120" cy="125" r="11" fill="#4a2614"/>` +
      // pointers
      `<g stroke-width="1.6" font-family="'JetBrains Mono',monospace" font-size="13">` +
        `<circle cx="${120 + 91 * Math.cos(-0.9)}" cy="${125 + 91 * Math.sin(-0.9)}" r="3.5" fill="#e8c98a"/>` +
        `<line x1="${120 + 91 * Math.cos(-0.9)}" y1="${125 + 91 * Math.sin(-0.9)}" x2="248" y2="40" stroke="#e8c98a"/>` +
        `<text x="254" y="44" fill="#e8c98a">Bark</text>` +
        `<circle cx="${120 + 78 * Math.cos(0.35)}" cy="${125 + 78 * Math.sin(0.35)}" r="3.5" fill="#f0d488"/>` +
        `<line x1="${120 + 78 * Math.cos(0.35)}" y1="${125 + 78 * Math.sin(0.35)}" x2="248" y2="120" stroke="#f0d488"/>` +
        `<text x="254" y="124" fill="#f0d488">Sapwood</text>` +
        `<circle cx="${120 + 42 * Math.cos(1.5)}" cy="${125 + 42 * Math.sin(1.5)}" r="3.5" fill="#ef9f72"/>` +
        `<line x1="${120 + 42 * Math.cos(1.5)}" y1="${125 + 42 * Math.sin(1.5)}" x2="248" y2="206" stroke="#ef9f72"/>` +
        `<text x="254" y="210" fill="#ef9f72">Heartwood</text>` +
      `</g></svg>`;
  }
  function digitalDiagram() {
    return `<svg class="xsec-svg" viewBox="0 0 360 250" role="img" ` +
      `aria-label="Schematic of a digital .knobe.md record: a cryptographic SHA-256 hash banner, a human-readable markdown body, and a block of JSON metadata.">` +
      `<rect x="24" y="22" width="150" height="206" rx="8" fill="#11160c" stroke="#5b7a3a" stroke-width="1.6"/>` +
      // hash banner
      `<rect x="36" y="36" width="126" height="26" rx="4" fill="rgba(217,178,90,0.16)" stroke="#d9b25a" stroke-width="1"/>` +
      `<text x="42" y="53" font-family="'JetBrains Mono',monospace" font-size="11" fill="#f0d488">9f2a&#8230;c7e1</text>` +
      // markdown body
      `<rect x="36" y="78" width="70" height="8" rx="3" fill="#7fae5a"/>` +
      [98, 112, 126, 140].map(yy => `<rect x="36" y="${yy}" width="${80 + (yy % 24)}" height="5" rx="2.5" fill="#9bb38a"/>`).join('') +
      // json block
      `<text x="36" y="178" font-family="'JetBrains Mono',monospace" font-size="11" fill="#cdbf98">{ "author":&#8230;</text>` +
      `<text x="44" y="194" font-family="'JetBrains Mono',monospace" font-size="11" fill="#cdbf98">"schema":&#8230; }</text>` +
      `<g stroke-width="1.6" font-family="'JetBrains Mono',monospace" font-size="13">` +
        `<circle cx="162" cy="49" r="3.5" fill="#f0d488"/><line x1="162" y1="49" x2="232" y2="44" stroke="#f0d488"/>` +
        `<text x="238" y="48" fill="#f0d488">SHA-256</text>` +
        `<circle cx="120" cy="112" r="3.5" fill="#9bb38a"/><line x1="120" y1="112" x2="232" y2="120" stroke="#9bb38a"/>` +
        `<text x="238" y="124" fill="#9bb38a">Markdown</text>` +
        `<circle cx="138" cy="178" r="3.5" fill="#cdbf98"/><line x1="138" y1="178" x2="232" y2="206" stroke="#cdbf98"/>` +
        `<text x="238" y="210" fill="#cdbf98">JSON</text>` +
      `</g></svg>`;
  }
  function calloutRow(dot, term, desc, map) {
    return `<div class="xc"><span class="xc-dot" style="background:${dot}"></span>` +
      `<div class="xc-body"><b>${term}</b><span>${desc}</span>` +
      `<em class="xc-map">${map}</em></div></div>`;
  }
  function exhibitHTML() {
    const bio =
      `<div class="xsec-fig">${bioDiagram()}</div>` +
      `<figure class="station-fig">` +
        `<img src="${ASSETS.rings}" alt="A polished giant-sequoia cross-section showing dense concentric growth rings around the pith." loading="lazy" decoding="async">` +
        `<figcaption>A real cross-section: fire-resistant bark on the outside, a thin living sapwood sleeve, and dense heartwood rings recording every year of growth.</figcaption></figure>` +
      `<div class="xc-list">` +
        calloutRow('#e8c98a', 'Fire-resistant bark', 'Two to three feet thick and rich in tannins — soft, fibrous, and almost impossible to burn. It chars, turns the flame, and keeps the living tree alive. Every scar is a record of what was tested and held.', '↳ in a record: the SHA-256 seal that proves nothing was altered.') +
        calloutRow('#f0d488', 'Living sapwood', 'The pale outer ring — the only living part of the trunk. It lifts water and signals through channels finer than a hair: structured improvisation, a living system that moves meaning.', '↳ in a record: the human-readable content you actually wrote.') +
        calloutRow('#ef9f72', 'Dense heartwood rings', 'Toward the center the rings darken into heartwood. What was flowing becomes structure; what was alive becomes a record. Every year a ring — drought years thin, good years thick, fire years scarred — recorded faithfully.', '↳ in a record: the structured schema a machine can read.') +
      `</div>`;
    const dig =
      `<div class="xsec-fig">${digitalDiagram()}</div>` +
      `<figure class="station-fig">` +
        `<img src="${ASSETS.infographic}" alt="Infographic mapping each layer of a giant sequoia — bark, sapwood, heartwood, roots, cone — to a layer of a portable KNOBE record." loading="lazy" decoding="async">` +
        `<figcaption>The giant sequoia beside the digital record: every layer of the tree maps to a layer of your portable <code>.knobe.md</code> file.</figcaption></figure>` +
      `<div class="xc-list">` +
        calloutRow('#f0d488', 'Cryptographic hash', 'A SHA-256 fingerprint sealing the file. Change one character and the entire fingerprint changes — tamper-evident, the way thick bark proves the tree was never breached.', '↳ like bark: the outer proof the record is whole.') +
        calloutRow('#9bb38a', 'Markdown text', 'The plain, portable body of your record — living prose, reasoning, and framing. Opens in any editor or AI conversation, no platform required.', '↳ like sapwood: the living, readable content.') +
        calloutRow('#cdbf98', 'JSON metadata', 'Structured fields — author, time, schema — that any program can parse. The ordered, durable core that makes thinking readable across minds that never met you.', '↳ like heartwood rings: the ordered, machine-readable core.') +
      `</div>`;
    return `<div class="xsec">` +
      `<div class="seg" role="tablist" aria-label="Cross-section views">` +
        `<button class="seg-btn" role="tab" id="xtab-bio" aria-controls="xpanel-bio" aria-selected="true">The living tree</button>` +
        `<button class="seg-btn" role="tab" id="xtab-dig" aria-controls="xpanel-dig" aria-selected="false" tabindex="-1">The digital record</button>` +
      `</div>` +
      `<div class="xpanel" role="tabpanel" id="xpanel-bio" aria-labelledby="xtab-bio" tabindex="0">${bio}</div>` +
      `<div class="xpanel" role="tabpanel" id="xpanel-dig" aria-labelledby="xtab-dig" tabindex="0" hidden>${dig}</div>` +
      `<p class="task-note">Two of these giants have fallen along the trail. Find them both.</p>` +
      `</div>`;
  }
  function wireExhibit(body) {
    const tabs = [...body.querySelectorAll('.seg-btn')];
    const select = (tab) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        $(t.getAttribute('aria-controls')).hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.onclick = () => select(t);
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const ni = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
        select(tabs[ni]); tabs[ni].focus();
      });
    });
  }
  U.openExhibit = function (ex) {
    $('prompt').classList.remove('show');
    window.GROVE.player.freeze(true);
    $('task-layer').textContent = 'Trailside exhibit · easter egg';
    $('task-title').textContent = 'Giant Sequoia Trunk Cross-Section';
    $('task-sub').textContent = 'A fallen giant. Read the structure that let it stand for millennia — then watch it become a portable record.';
    const body = $('task-body');
    body.innerHTML = exhibitHTML();
    body.scrollTop = 0;
    wireExhibit(body);
    lastFocus = document.activeElement;
    const taskEl = $('task');
    taskEl.classList.add('show');
    taskEl.setAttribute('aria-hidden', 'false');
    $('scrim').classList.add('show');
    setTimeout(() => { const b = body.querySelector('.seg-btn') || $('task-close'); if (b) b.focus(); }, 520);
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

  /* =================================================================
     SEAL THE SEED — the closing moment. Compute the final SHA-256,
     play a brief "performing the work" animation, then reveal the
     achievement with the export options and the feedback form.
     ================================================================= */
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function ensureOverlays() {
    if ($('seal-anim')) return;
    const seal = document.createElement('div');
    seal.id = 'seal-anim'; seal.className = 'overlay seal-anim';
    seal.setAttribute('aria-hidden', 'true');
    seal.innerHTML =
      `<div class="seal-card">` +
        `<div class="seal-spinner" aria-hidden="true"></div>` +
        `<div class="seal-title">Performing the work…</div>` +
        `<div class="seal-sub">Folding every layer into a single SHA-256 fingerprint</div>` +
        `<code class="seal-stream" id="seal-stream" aria-hidden="true"></code>` +
      `</div>`;
    document.body.appendChild(seal);

    // SR-only live region kept OUTSIDE the aria-hidden overlay so the
    // sealing status is announced even while the visual card is gated.
    const status = document.createElement('p');
    status.id = 'seal-status'; status.className = 'sr-only';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    document.body.appendChild(status);

    const ach = document.createElement('div');
    ach.id = 'achievement'; ach.className = 'overlay achievement';
    ach.setAttribute('aria-hidden', 'true');
    ach.setAttribute('role', 'dialog'); ach.setAttribute('aria-modal', 'true');
    ach.setAttribute('aria-labelledby', 'ach-title');
    ach.innerHTML =
      `<div class="ach-card">` +
        `<div class="ach-badge" aria-hidden="true">✦</div>` +
        `<h2 id="ach-title" class="ach-title">Your seed is sealed</h2>` +
        `<p class="ach-sub">A self-contained record of your thinking — verifiable, portable, and yours. ` +
          `Plain text, a few kilobytes; it opens in any editor or AI conversation, with no login and no platform that owns it.</p>` +
        `<div class="ach-hashwrap"><span class="ach-hlabel">SHA-256 seal</span>` +
          `<code class="ach-hash" id="ach-hash"></code></div>` +
        `<div class="export-row">` +
          `<button class="btn" id="ach-copy">Copy to clipboard</button>` +
          `<button class="btn" id="ach-email">Email to myself</button>` +
          `<button class="btn leaf" id="ach-down">Save .knobe.md</button>` +
        `</div>` +
        `<a class="btn form-btn" id="ach-form" href="${FORM_URL}" target="_blank" rel="noopener">Share your experience <span class="sr-only">(opens in a new tab)</span>→</a>` +
        `<button class="ach-close" id="ach-close">Return to the grove</button>` +
      `</div>`;
    document.body.appendChild(ach);
    $('ach-copy').onclick = () => window.GROVE.knobe.copy();
    $('ach-email').onclick = () => window.GROVE.knobe.email();
    $('ach-down').onclick = () => window.GROVE.knobe.download();
    $('ach-close').onclick = () => hideAchievement();
    ach.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); hideAchievement(); return; }
      if (e.key !== 'Tab') return;
      // keep focus inside the modal dialog (SC 2.1.2 / 2.4.3)
      const f = ach.querySelectorAll('a[href], button:not([disabled])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  let _streamT = null;
  function showSeal(on) {
    ensureOverlays();
    const el = $('seal-anim');
    el.classList.toggle('show', on);
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
    const status = $('seal-status');
    if (status) status.textContent = on ? 'Sealing your seed — performing the work.' : '';
    clearInterval(_streamT); _streamT = null;
    if (on && !reducedMotion()) {
      const stream = $('seal-stream');
      _streamT = setInterval(() => {
        let s = '';
        for (let i = 0; i < 64; i++) s += '0123456789abcdef'[(Math.random() * 16) | 0];
        if (stream) stream.textContent = s;
      }, 60);
    }
  }

  function showAchievement(hash) {
    ensureOverlays();
    clearInterval(_streamT); _streamT = null;
    $('ach-hash').textContent = hash || 'unavailable in this context (needs HTTPS)';
    const el = $('achievement');
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
    setTimeout(() => { const b = $('ach-close'); if (b) b.focus(); }, 360);
  }

  function hideAchievement() {
    const el = $('achievement');
    if (el) { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); }
    U.closeTask();
  }

  let _sealing = false;
  U.sealSeed = async function () {
    if (_sealing) return;             // guard against double-seal race
    _sealing = true;
    showSeal(true);
    try { await window.GROVE.knobe.computeHash(); } catch (e) { /* insecure ctx */ }
    const finish = () => { _sealing = false; showSeal(false); showAchievement(window.GROVE.knobe.hash); };
    if (reducedMotion()) finish(); else setTimeout(finish, 1900);
  };

  function setMusicIcon(on) {
    const btn = $('tool-music'); if (!btn) return;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Stop the guiding sound' : 'Play the guiding sound toward your next stop');
    // reveal the volume slider only while the sound is on
    const wrap = $('volume-wrap');
    if (wrap) wrap.hidden = !on;
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
    $('tool-fs').onclick = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    $('tool-seed').onclick = () => U.toggleSidebar();

    // Day / night toggle — moonlit grove with drifting fireflies. The drifting
    // motes (the falling-leaf ambience) stay; night just dims the sun to
    // moonlight, mutes the sunbeams, and brings the fireflies out.
    const nightBtn = $('tool-night');
    if (nightBtn) nightBtn.onclick = () => {
      const on = !window.GROVE.isNight;
      if (window.GROVE.setNight) window.GROVE.setNight(on);
      nightBtn.classList.toggle('on', on);
      nightBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      nightBtn.setAttribute('aria-label', on ? 'Switch to daytime grove' : 'Switch to night grove with fireflies');
      U.toast(on ? 'Night falls — fireflies wake among the trees' : 'Daylight returns to the grove');
    };

    // Spatial guiding sound (rain + birdsong). Off by default; explicit
    // user gesture only. It emanates from the active station with true
    // HRTF panning — louder in the ear toward the stop, swelling as you
    // near it — so you can navigate to your next stop by ear.
    const musicBtn = $('tool-music');
    if (musicBtn) musicBtn.onclick = () => {
      if (!window.GROVE.spatial) return;
      const on = window.GROVE.spatial.toggle();
      setMusicIcon(on);
      U.toast(on ? 'Listen — the sound comes from your next stop. Follow it.' : 'Guiding sound off');
    };
    // Volume slider — visitor-adjustable level (hearing differs). Persisted by
    // the spatial engine; reflect its stored value into the slider on load.
    const volSlider = $('volume-slider');
    if (volSlider && window.GROVE.spatial) {
      volSlider.value = Math.round(window.GROVE.spatial.getVolume() * 100);
      volSlider.oninput = () => window.GROVE.spatial.setVolume(volSlider.value / 100);
    }
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

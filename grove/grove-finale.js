/* ===================================================================
   grove-finale.js — window.GROVE.finale
   Taking the seed. After the seed is sealed the visitor is carried back to
   where they began; a trophy holding their seed now stands there. This
   module owns that return (teleport, trophy reveal, guiding-sound retarget,
   spoken + captioned audio description), the trophy's proximity prompt, and
   its panel: what the trophy is, the seed file with its exports, and the
   instructor's final word, readable and spoken.
   =================================================================== */
(function () {
  const G = window.GROVE;
  const C = G.CONFIG, TR = G.TROPHY;
  const $ = (id) => document.getElementById(id);
  const FORM_URL = 'https://forms.gle/thLA2FsJXsyDnzsC8';

  const F = { taken: false, visited: false, pos: { x: C.trophy.x, z: C.trophy.z } };

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function name() { return (G.knobe && G.knobe.name) || 'Visitor'; }

  /* ---------- the return ---------- */
  F.takeSeed = function () {
    if (F.taken) return;
    F.taken = true;
    if (G.revealTrophy) G.revealTrophy();
    G.player.teleport(C.returnPos.x, C.returnPos.z, Math.PI);   // face north, toward the trophy
    if (G.stations) G.stations.refresh();
    const guidingOn = !!(G.spatial && G.spatial.isOn());
    if (G.spatial && G.spatial.notify) G.spatial.notify();
    // One channel at a time: the captioned audio description carries this moment;
    // the toast only stands in when there is no narrator. Focus lands on the
    // caption bar's Stop button so keyboard users can silence it at once (2.4.3 / 1.4.2).
    if (G.narrator) {
      G.narrator.speak(TR.audioDescription(name(), guidingOn), { label: 'Audio description', focusStop: true });
    } else if (G.ui) G.ui.toast('You are back where you began. A trophy holds your seed.');
  };

  /* ---------- proximity prompt (reuses #prompt chrome) ---------- */
  F.showPrompt = function () {
    const p = $('prompt'); if (!p) return;
    if ($('task').classList.contains('show')) { p.classList.remove('show'); return; }
    p.className = 'prompt is-trophy';
    p.innerHTML =
      `<div class="p-badge" aria-hidden="true">✦</div>` +
      `<div class="p-main">` +
        `<div class="p-layer">Your seed${F.visited ? '' : ' &middot; <b>your final stop</b>'}</div>` +
        `<div class="p-title">${escapeHtml(TR.title)}</div>` +
        `<div class="p-cta">Press <button type="button" class="p-key" id="prompt-open" aria-label="Open the seed trophy">I</button> or click to read what it is and take your file</div>` +
      `</div>`;
    p.classList.add('show');
    $('prompt-open').onclick = (e) => { e.stopPropagation(); F.open(); };
    p.onclick = (e) => { if (e.target.id !== 'prompt-open') F.open(); };
    if (G.ui && G.ui.sayPrompt) G.ui.sayPrompt('Your seed' + (F.visited ? '' : ', your final stop') + '. ' + TR.title + '. Press I or click to read what it is and take your file.');
  };

  /* ---------- the trophy panel ---------- */
  function panelHTML() {
    const k = G.knobe;
    const file = k ? k.fileName() : 'seed.knobe.md';
    const hash = (k && k.hash) || 'unavailable in this context (needs HTTPS)';
    let h = '<div class="intro">' + TR.explain.map(p => `<p>${escapeHtml(p)}</p>`).join('') + '</div>';
    h += `<div class="export-row"><button type="button" class="btn ghost listen" id="trophy-read"><span aria-hidden="true">▶</span> Read this aloud</button></div>`;
    h += `<div class="ach-hashwrap"><span class="ach-hlabel">Your file</span>` +
      `<code class="ach-hash">${escapeHtml(file)}</code>` +
      `<span class="ach-hlabel" style="margin-top:10px">SHA-256 seal</span>` +
      `<code class="ach-hash" id="trophy-hash">${escapeHtml(hash)}</code></div>`;
    h += `<div class="export-row">` +
      `<button type="button" class="btn" id="trophy-copy">Copy to clipboard</button>` +
      `<button type="button" class="btn" id="trophy-email">Email to myself</button>` +
      `<button type="button" class="btn leaf" id="trophy-down">Save .knobe.md</button>` +
      `</div>`;
    h += `<a class="btn form-btn" href="${FORM_URL}" target="_blank" rel="noopener">Share your experience <span class="sr-only">(opens in a new tab)</span>→</a>`;
    // the instructor's final word
    h += `<section class="final-word" aria-labelledby="fw-title">` +
      `<h3 id="fw-title" class="fw-title">The instructor’s final word</h3>` +
      `<p class="task-note">A closing message from the person who built this walk. Hear it spoken, with captions, or read it below.</p>` +
      `<div class="export-row"><button type="button" class="btn leaf" id="fw-play"><span aria-hidden="true">▶</span> Hear the final word</button>` +
      `<button type="button" class="btn ghost" id="fw-show" aria-expanded="false" aria-controls="fw-text">Show the text</button></div>` +
      `<div id="fw-text" class="fw-text" hidden>` + TR.finalWord.map(p => `<p>${escapeHtml(p)}</p>`).join('') + `</div>` +
      `</section>`;
    h += `<div class="grove-key"><b>Grove Key</b>Seed — ${escapeHtml(file)}: the self-contained record you carry out. Bark = SHA-256 · Sapwood = your words · Heartwood = schema.</div>`;
    return h;
  }

  F.open = function () {
    const ui = G.ui; if (!ui) return;
    F.visited = true;
    $('prompt').classList.remove('show');
    if (ui.sayPrompt) ui.sayPrompt(null);
    G.player.freeze(true);
    $('task-layer').textContent = TR.layer;
    $('task-title').textContent = TR.title;
    $('task-sub').textContent = TR.subtitle;
    const body = $('task-body');
    body.innerHTML = panelHTML();
    body.scrollTop = 0;
    const k = G.knobe;
    $('trophy-copy').onclick = () => k.copy();
    $('trophy-email').onclick = () => k.email();
    $('trophy-down').onclick = () => k.download();
    $('trophy-read').onclick = () => { if (G.narrator) G.narrator.speak(TR.explain.join(' '), { label: TR.title }); };
    $('fw-show').onclick = () => {
      const t = $('fw-text'), b = $('fw-show');
      t.hidden = !t.hidden;
      b.setAttribute('aria-expanded', t.hidden ? 'false' : 'true');
      b.textContent = t.hidden ? 'Show the text' : 'Hide the text';
    };
    $('fw-play').onclick = () => {
      const t = $('fw-text'), b = $('fw-show');
      t.hidden = false; b.setAttribute('aria-expanded', 'true'); b.textContent = 'Hide the text';
      if (G.narrator) G.narrator.speak(TR.finalWord.join(' '), { label: 'The instructor’s final word' });
    };
    ui.showPanel('Your seed: ' + TR.title + '. ' + TR.subtitle);
    setTimeout(() => { const b = $('trophy-read'); if (b) b.focus(); }, 520);
    if (G.stations) G.stations.refresh();
  };

  G.finale = F;
})();

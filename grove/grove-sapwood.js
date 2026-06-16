/* grove-sapwood.js — "The Invisible Layer": the interactive 4-beat study of
   the sapwood (the human-readable content layer). Ported from the guided
   walkthrough so the walkable grove's Sapwood station offers the same
   read-through experience with live, moving content instead of a static
   infographic.

   A focus-trapped, ARIA-tabbed dialog with three animated canvases (sap flow,
   molecular soup, genetic code). Honors prefers-reduced-motion by drawing a
   single static frame instead of an endless animation loop (SC 2.2.2 / 2.3.3).
   Plain IIFE on window.GROVE — no build step. */
(function () {
  const S = {};
  // Small delay before a canvas starts so the freshly shown panel has laid
  // out and its <canvas> reports a real offsetWidth/Height for sizing.
  const CANVAS_START_DELAY = 80;
  let overlay = null, lastFocus = null;
  let sapRef = null, molRef = null, geneRef = null, startT = null;
  let isOpen = false;

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function stopAll() {
    if (startT)  { clearTimeout(startT); startT = null; }
    if (sapRef)  { cancelAnimationFrame(sapRef);  sapRef = null; }
    if (molRef)  { cancelAnimationFrame(molRef);  molRef = null; }
    if (geneRef) { cancelAnimationFrame(geneRef); geneRef = null; }
  }

  /* ── beat 1 · sap flow rising through the xylem ────────────────── */
  function startSap() {
    if (!isOpen) return;
    const c = document.getElementById('ss-sap-canvas'); if (!c) return;
    const ctx = c.getContext('2d'); c.width = c.offsetWidth || 600; c.height = c.offsetHeight || 300;
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
    const pts = [];
    for (let i = 0; i < 55; i++) pts.push({ x: Math.random() * W, y: H + Math.random() * 80, spd: 0.4 + Math.random() * 0.7, sz: 1.5 + Math.random() * 2.5, op: 0.2 + Math.random() * 0.5, hue: 35 + Math.random() * 55, wb: Math.random() * 6.28, wbs: 0.01 + Math.random() * 0.02 });
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0a1208'; ctx.fillRect(0, 0, W, H);
      [0.34, 0.44, 0.50, 0.55].forEach(function (r) { ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(80,50,15,0.12)'; ctx.lineWidth = 1.5; ctx.stroke(); });
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.44, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(160,120,50,0.2)'; ctx.lineWidth = 12; ctx.stroke();
      pts.forEach(function (p) { p.y -= p.spd; p.wb += p.wbs; p.x += Math.sin(p.wb) * 0.4; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; } const d = Math.sqrt((p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy)); const inSap = d > Math.min(W, H) * 0.3 && d < Math.min(W, H) * 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fillStyle = 'hsla(' + p.hue + ',70%,55%,' + (inSap ? p.op : p.op * 0.15) + ')'; ctx.fill(); });
      if (!reduced()) sapRef = requestAnimationFrame(draw);
    }
    draw();
  }

  /* ── beat 2 · the molecular solution in a droplet of sap ───────── */
  function startMol() {
    if (!isOpen) return;
    const c = document.getElementById('ss-mol-canvas'); if (!c) return;
    const ctx = c.getContext('2d'); c.width = c.offsetWidth || 600; c.height = c.offsetHeight || 300;
    const W = c.width, H = c.height;
    const types = [{ label: 'H\u2082O', color: '#5ab4d6', r: 5, n: 22 }, { label: 'sugar', color: '#c8a04a', r: 7, n: 8 }, { label: 'K\u207A', color: '#4ac8a0', r: 4, n: 6 }, { label: 'IAA', color: '#c86a9a', r: 6, n: 5 }, { label: 'myc', color: '#8a6ac8', r: 5, n: 4 }];
    const mols = []; types.forEach(function (t) { for (let i = 0; i < t.n; i++) mols.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, r: t.r, color: t.color, label: t.label, ph: Math.random() * Math.PI * 2 }); });
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#060f06'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < mols.length; i++) { for (let j = i + 1; j < mols.length; j++) { const dx = mols[j].x - mols[i].x, dy = mols[j].y - mols[i].y, d = Math.sqrt(dx * dx + dy * dy); if (d < 60) { ctx.beginPath(); ctx.moveTo(mols[i].x, mols[i].y); ctx.lineTo(mols[j].x, mols[j].y); ctx.strokeStyle = 'rgba(100,180,120,' + (0.15 * (1 - d / 60)) + ')'; ctx.lineWidth = 1; ctx.stroke(); } } }
      mols.forEach(function (m) { m.ph += 0.02; m.x += m.vx + Math.sin(m.ph) * 0.15; m.y += m.vy + Math.cos(m.ph * 0.7) * 0.15; if (m.x < m.r) { m.x = m.r; m.vx = Math.abs(m.vx); } if (m.x > W - m.r) { m.x = W - m.r; m.vx = -Math.abs(m.vx); } if (m.y < m.r) { m.y = m.r; m.vy = Math.abs(m.vy); } if (m.y > H - m.r) { m.y = H - m.r; m.vy = -Math.abs(m.vy); } const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 2.5); g.addColorStop(0, m.color + 'cc'); g.addColorStop(1, m.color + '00'); ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 2.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fillStyle = m.color + 'ee'; ctx.fill(); ctx.strokeStyle = m.color; ctx.lineWidth = 1; ctx.stroke(); if (m.r >= 5) { ctx.fillStyle = '#ffffff88'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.label, m.x, m.y); } });
      let lx = 12; const ly = H - 18;
      types.forEach(function (t) { ctx.beginPath(); ctx.arc(lx + 5, ly, 5, 0, Math.PI * 2); ctx.fillStyle = t.color; ctx.fill(); ctx.fillStyle = '#c8e8c0'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t.label, lx + 13, ly); lx += ctx.measureText(t.label).width + 28; });
      if (!reduced()) molRef = requestAnimationFrame(draw);
    }
    draw();
  }

  /* ── beat 3 · the genetic code beneath the chemistry ───────────── */
  function startGene() {
    if (!isOpen) return;
    const c = document.getElementById('ss-gene-canvas'); if (!c) return;
    const ctx = c.getContext('2d'); c.width = c.offsetWidth || 600; c.height = c.offsetHeight || 240;
    const W = c.width, H = c.height, cy = H / 2; let hOff = 0;
    const prots = []; for (let i = 0; i < 12; i++) prots.push({ x: Math.random() * W * 0.6 + W * 0.2, y: Math.random() * H * 0.6 + H * 0.2, r: 3 + Math.random() * 5, color: ['#6ac880', '#c8a06a', '#6a9ac8', '#c86a6a'][Math.floor(Math.random() * 4)], vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, ph: Math.random() * Math.PI * 2 });
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#060f06'; ctx.fillRect(0, 0, W, H);
      hOff += 0.03; const hw = 28, steps = 40, sh = W / steps;
      for (let s = 0; s < steps; s++) { const x = s * sh, y1 = cy + Math.sin(s * 0.45 + hOff) * hw, y2 = cy + Math.sin(s * 0.45 + hOff + Math.PI) * hw; ctx.beginPath(); ctx.arc(x, y1, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#4a9a6acc'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y2, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#9a6a4acc'; ctx.fill(); if (s % 3 === 0) { ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); const pair = (s / 3) % 2 === 0; ctx.strokeStyle = pair ? 'rgba(100,180,120,0.35)' : 'rgba(180,140,80,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = pair ? '#4a9a6a88' : '#9a6a4a88'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText(pair ? 'A-T' : 'G-C', x, (y1 + y2) / 2 + 3); } }
      ctx.beginPath(); for (let s2 = 0; s2 <= steps; s2++) { const px = s2 * sh, py = cy + Math.sin(s2 * 0.45 + hOff) * hw; s2 === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.strokeStyle = 'rgba(74,154,106,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); for (let s3 = 0; s3 <= steps; s3++) { const px2 = s3 * sh, py2 = cy + Math.sin(s3 * 0.45 + hOff + Math.PI) * hw; s3 === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2); } ctx.strokeStyle = 'rgba(154,106,74,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      prots.forEach(function (p) { p.ph += 0.015; p.x += p.vx; p.y += p.vy; if (p.x < p.r || p.x > W - p.r) p.vx *= -1; if (Math.abs(p.y - cy) < hw + 10) p.vy += p.y < cy ? -0.05 : 0.05; if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); } if (p.y > H - p.r) { p.y = H - p.r; p.vy = -Math.abs(p.vy); } const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3); g.addColorStop(0, p.color + '99'); g.addColorStop(1, p.color + '00'); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = p.color + 'dd'; ctx.fill(); });
      if (!reduced()) geneRef = requestAnimationFrame(draw);
    }
    draw();
  }

  const STARTERS = [null, startSap, startMol, startGene];

  function go(b) {
    if (!overlay) return;
    overlay.querySelectorAll('.ss-beat').forEach(function (el, i) { el.hidden = i !== b; });
    overlay.querySelectorAll('.ss-tab').forEach(function (t, i) {
      const on = i === b;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    stopAll();
    if (STARTERS[b]) startT = setTimeout(STARTERS[b], CANVAS_START_DELAY);
  }

  function focusables() {
    return [...overlay.querySelectorAll('button, [href], [tabindex]')]
      .filter(el => el.tabIndex !== -1 && el.offsetParent !== null);
  }

  function build() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'sapwood-study';
    overlay.className = 'overlay sapwood-study';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ss-title');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      `<div class="ss-card">` +
        `<div class="ss-header">` +
          `<div class="ss-sup">The Magic Grove · Sapwood Study</div>` +
          `<h2 class="ss-title" id="ss-title">The Invisible Layer</h2>` +
          `<p class="ss-sub">The layer you cannot see from outside the tree — and yet without it, nothing outside exists.</p>` +
        `</div>` +
        `<div class="ss-tabs" role="tablist" aria-label="Sapwood study">` +
          `<button type="button" class="ss-tab" role="tab" id="ss-tab-0" aria-controls="ss-beat-0" aria-selected="true">Overview</button>` +
          `<button type="button" class="ss-tab" role="tab" id="ss-tab-1" aria-controls="ss-beat-1" aria-selected="false" tabindex="-1">Sap flow</button>` +
          `<button type="button" class="ss-tab" role="tab" id="ss-tab-2" aria-controls="ss-beat-2" aria-selected="false" tabindex="-1">Molecular</button>` +
          `<button type="button" class="ss-tab" role="tab" id="ss-tab-3" aria-controls="ss-beat-3" aria-selected="false" tabindex="-1">Genetic</button>` +
        `</div>` +
        `<div class="ss-body">` +
          `<div class="ss-beat" role="tabpanel" id="ss-beat-0" aria-labelledby="ss-tab-0" tabindex="0">` +
            `<p class="ss-prose">Between the heartwood and the bark lies the sapwood — a living sleeve no thicker than your hand, and the only part of the trunk that is truly alive.</p>` +
            `<p class="ss-prose2">Every nutrient the tree has ever absorbed moves through here, in a continuous flow that never stops while the tree lives.</p>` +
            `<div class="ss-quote">This is the layer you can never see from outside the tree. And yet without it, nothing outside exists.</div>` +
            `<div class="ss-row"><button type="button" class="ss-next" data-go="1">Begin <span aria-hidden="true">→</span></button></div>` +
          `</div>` +
          `<div class="ss-beat" role="tabpanel" id="ss-beat-1" aria-labelledby="ss-tab-1" tabindex="0" hidden>` +
            `<p class="ss-prose">Right now, sap is moving upward through the xylem. Pulled by the sky, pushed by the roots.</p>` +
            `<canvas id="ss-sap-canvas" class="ss-canvas" aria-hidden="true"></canvas>` +
            `<p class="ss-prose2">The animation traces bright droplets rising through the pale living ring of the sapwood, dimming as they pass into the dead heartwood at the center.</p>` +
            `<div class="ss-row"><button type="button" class="ss-next" data-go="2">What\u2019s in the sap? <span aria-hidden="true">→</span></button></div>` +
          `</div>` +
          `<div class="ss-beat" role="tabpanel" id="ss-beat-2" aria-labelledby="ss-tab-2" tabindex="0" hidden>` +
            `<p class="ss-prose">If you could look through a microscope at a droplet of sap, you would find a solution more complex than blood.</p>` +
            `<canvas id="ss-mol-canvas" class="ss-canvas" aria-hidden="true"></canvas>` +
            `<p class="ss-prose2">Drifting and bonding in that droplet: water, dissolved sugars, potassium ions, the growth signal auxin (IAA), and chemical messages from the mycorrhizal fungi at the roots — a constant exchange of nutrients and information.</p>` +
            `<div class="ss-row"><button type="button" class="ss-next" data-go="3">Go deeper <span aria-hidden="true">→</span></button></div>` +
          `</div>` +
          `<div class="ss-beat" role="tabpanel" id="ss-beat-3" aria-labelledby="ss-tab-3" tabindex="0" hidden>` +
            `<p class="ss-prose center">Beneath the chemistry is code. The sap exists because genes are expressed, proteins fold, channels open.</p>` +
            `<canvas id="ss-gene-canvas" class="ss-canvas tall" aria-hidden="true"></canvas>` +
            `<p class="ss-prose2 center">The animation shows a turning DNA double helix — its rungs the A-T and G-C base pairs — with folded proteins moving around it: the instructions that build every channel the sap flows through.</p>` +
          `</div>` +
        `</div>` +
        `<div class="ss-footer"><button type="button" class="ss-close" id="ss-close">Close <span aria-hidden="true">×</span></button></div>` +
      `</div>`;
    document.body.appendChild(overlay);

    const tabs = [...overlay.querySelectorAll('.ss-tab')];
    tabs.forEach((t, i) => {
      t.onclick = () => { go(i); };
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const ni = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
        go(ni); tabs[ni].focus();
      });
    });
    overlay.querySelectorAll('.ss-next').forEach(btn => {
      btn.onclick = () => {
        const b = parseInt(btn.dataset.go, 10);
        go(b);
        // Move focus into the newly revealed panel (its prose is the content)
        // rather than back up to the tablist. SC 2.4.3.
        const panel = overlay.querySelector('#ss-beat-' + b);
        if (panel) panel.focus();
      };
    });
    overlay.querySelector('#ss-close').onclick = () => S.close();

    // Focus trap + Escape, kept off the global grove key handlers (the
    // study sits above the open task panel, so stop keys from bubbling to
    // the window-level Escape/interact listeners). SC 2.1.2 / 2.4.3.
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); S.close(); return; }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        e.stopPropagation();
      }
    });
  }

  // Hide the still-open task panel beneath the modal from AT and keyboard so
  // the study is a true modal (aria-modal alone is unevenly honored). SC 4.1.2.
  function setBackgroundInert(on) {
    const task = document.getElementById('task');
    if (!task) return;
    if (on) { task.setAttribute('inert', ''); task.setAttribute('aria-hidden', 'true'); }
    else { task.removeAttribute('inert'); task.setAttribute('aria-hidden', 'false'); }
  }

  S.open = function () {
    build();
    isOpen = true;
    lastFocus = document.activeElement;
    setBackgroundInert(true);
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    go(0);
    overlay.querySelector('.ss-card').scrollTop = 0;
    const delay = reduced() ? 0 : 360;
    setTimeout(() => { const b = overlay.querySelector('.ss-tab'); if (b) b.focus(); }, delay);
  };

  S.close = function () {
    if (!overlay) return;
    isOpen = false;
    stopAll();
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    setBackgroundInert(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  };

  window.GROVE.sapwoodStudy = S;
})();

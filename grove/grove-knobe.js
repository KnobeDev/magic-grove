/* ===================================================================
   grove-knobe.js — the portable seed: answer state, live preview,
   SHA-256 seal, and export (copy / email / download .knobe.md).
   Faithful to the original Magic Grove seed format. Exposes GROVE.knobe.
   =================================================================== */
(function () {
  const K = { name: 'Anonymous', answers: {}, hash: null };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  K.setName = function (n) {
    K.name = (n || '').trim() || 'Anonymous';
    const lbl = document.getElementById('seed-filename');
    if (lbl) lbl.textContent = `${K.name.replace(/\s+/g, '_')}_Magic_Grove_Journey.knobe.md`;
    document.querySelectorAll('.player-name').forEach(el => el.textContent = K.name);
    K.updatePreview();
  };

  K.setAnswer = function (field, value) {
    K.answers[field] = (value || '').trim();
    if (field === 'authorship' && K.answers[field].length > 0) K.computeHash();
    K.updatePreview();
    if (window.GROVE.stations) window.GROVE.stations.refresh();
  };

  K.computeHash = async function () {
    try {
      const content = window.GROVE.CLAIM_FIELDS.map(f => K.answers[f] || '').join('\n---\n');
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
      K.hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      K.updatePreview();
    } catch (e) { /* insecure context — skip */ }
  };

  K.updatePreview = function () {
    const el = document.getElementById('knobe-preview');
    if (!el) return;
    const a = K.answers, n = K.name || 'Anonymous';
    const title = a.project_description
      ? a.project_description.split(/[.!?]/)[0].trim().substring(0, 80) : '—';
    let h = '';
    h += `<span class="field-label">---</span>\n`;
    h += `<span class="field-label">title:</span>\n`;
    h += title !== '—' ? `<span class="field-value">${esc(title)}</span>` : `<span class="field-empty">awaiting Q1…</span>`;
    h += `<span class="field-label">content_type:</span> <span class="field-value">original</span>`;
    h += `<span class="field-label">knobe_type:</span> <span class="field-value">thinking</span>`;
    h += `<span class="field-label">author:</span> <span class="field-value">${esc(n)}</span>`;
    if (K.hash) h += `<span class="field-label">sha256:</span>\n<span class="field-value hash-line">${K.hash}</span>`;
    else h += `<span class="field-label">sha256:</span>\n<span class="field-empty">sealed at the Heartwood (Q7)</span>`;
    h += `<span class="field-label">---</span>\n\n`;
    h += `<span class="field-label"># ${esc(n)}_Magic_Grove_Journey.knobe.md</span>\n\n`;
    const fields = [
      { label: 'project_description:', value: a.project_description, append: a.closing_vision ? `\n\n[closing vision] ${a.closing_vision}` : '' },
      { label: 'prior_knowledge:', value: a.prior_knowledge },
      { label: 'breakpoint:', value: a.breakpoint },
      { label: 'invisible_labor:', value: a.invisible_labor },
      { label: 'dependencies:', value: a.dependencies },
      { label: 'collaborators:', value: a.collaborators },
      { label: 'authorship:', value: a.authorship },
      { label: 'preservation_intent:', value: a.preservation },
      { label: 'release_conditions:', value: a.release_conditions },
      { label: 'resource_needs:', value: a.resource_needs },
    ];
    for (const f of fields) {
      h += `<span class="field-label">${f.label}</span>\n`;
      if (f.value) h += `<span class="field-value">${esc(f.value)}${f.append ? esc(f.append) : ''}</span>`;
      else h += `<span class="field-empty">—</span>`;
    }
    el.innerHTML = h;
  };

  K.generateMd = function () {
    const a = K.answers, n = K.name || 'Anonymous';
    const date = new Date().toISOString().split('T')[0];
    const summaryParts = [];
    if (a.project_description) summaryParts.push(a.project_description);
    if (a.closing_vision) summaryParts.push('Vision: ' + a.closing_vision);
    let summary = summaryParts.join(' | ') || '—';
    if (summary.length > 1200) {
      const tr = summary.substring(0, 1200);
      const last = tr.search(/[.!?][^.!?]*$/);
      summary = last > 200 ? tr.substring(0, last + 1) : tr;
    }
    const title = a.project_description
      ? a.project_description.split(/[.!?]/)[0].trim().substring(0, 120) : `${n}'s Grove Seed`;
    let md = '';
    md += `---\n`;
    md += `title: "${title.replace(/"/g, '\\"')}"\n`;
    md += `summary: "${summary.replace(/"/g, '\\"')}"\n`;
    md += `content_type: original\n`;
    md += `knobe_type: thinking\n`;
    md += `author: "${n.replace(/"/g, '\\"')}"\n`;
    md += `created: ${date}\n`;
    md += `generator: Magic Grove (walkable)\n`;
    if (K.hash) md += `sha256: ${K.hash}\n`;
    md += `---\n\n`;
    md += `# ${n}'s Magic Grove Journey\n\n`;
    md += `*The Magic Grove · Knobe.org*\n\n`;
    md += `## 1. Threshold\n\n`;
    md += `The grove asked what you are carrying — not a summary written for a grade, but something true about what you are actually trying to make.\n\n`;
    md += `**Project Description:** ${a.project_description || '—'}\n\n`;
    md += `## 2. First Impressions\n\n`;
    md += `Before entering the grove, you were asked what you already know about the sequoias — the assumptions you carry in.\n\n`;
    md += `**Prior Knowledge:** ${a.prior_knowledge || '—'}\n\n`;
    md += `## 3. The Naming\n\n`;
    md += `These trees carry the name *Sequoia*, likely honoring Sequoyah — a Cherokee man who built an entire syllabary from nothing, turning spoken language into portable, durable code.\n\n`;
    md += `## 4. The Bark — Protection\n\n`;
    md += `The bark is dead tissue two to three feet thick. It does not burn — it chars, turns the flame, and lets the tree use fire rather than fear it. Every scar is a record of what was tested and held.\n\n`;
    md += `**Breakpoint / Vulnerability:** ${a.breakpoint || '—'}\n\n`;
    md += `## 5. The Sapwood — Process\n\n`;
    md += `Between bark and heartwood lies the sapwood — the only living part of the trunk. It carries water, sugars, and signals through channels thinner than a hair. This is the invisible labor that moves meaning through a system.\n\n`;
    md += `**Invisible Labor:** ${a.invisible_labor || '—'}\n\n`;
    md += `**Dependencies / Flow Conditions:** ${a.dependencies || '—'}\n\n`;
    md += `## 6. The Heartwood — Record\n\n`;
    md += `The sapwood hardens into heartwood — what was flowing becomes structure. Every year becomes a ring. This is the schema layer: the record that makes thinking readable across time, tools, and minds that have never met you.\n\n`;
    md += `**Collaborators / Tools:** ${a.collaborators || '—'}\n\n`;
    md += `**Authorship / Claimed Contribution:** ${a.authorship || '—'}\n\n`;
    md += `## 7. The Roots — Network\n\n`;
    md += `Sequoias have shallow roots and no taproot. They survive by connecting — mycorrhizal networks link every tree in the grove. No single point of failure. No single source of truth.\n\n`;
    md += `**Preservation Intent:** ${a.preservation || '—'}\n\n`;
    md += `## 8. The Cone — Dispersal\n\n`;
    md += `A serotinous cone stays sealed for decades, waiting not for rain but for fire. Each seed weighs almost nothing yet carries the complete instructions for the largest living thing on Earth.\n\n`;
    md += `**Release Conditions:** ${a.release_conditions || '—'}\n\n`;
    md += `**Resource Needs:** ${a.resource_needs || '—'}\n\n`;
    md += `## 9. The Seed — Departure\n\n`;
    md += `The smallest part of the largest living thing, carrying the complete instructions for everything in this journey. The KNOBE seed is the architecture; you are the musician. The seed does not play itself.\n\n`;
    if (a.closing_vision) md += `**Closing Vision:** ${a.closing_vision}\n\n`;
    md += `---\n\n`;
    md += `**Grove Key:** Bark = SHA-256 · Sapwood = Human-readable · Heartwood = Schema · Roots = Network · Cone/Seed = .knobe.md\n`;
    return md;
  };

  K.fileName = function () { return `${(K.name || 'seed').replace(/\s+/g, '_')}_Magic_Grove_Journey.knobe.md`; };

  K.copy = function () {
    navigator.clipboard.writeText(K.generateMd())
      .then(() => window.GROVE.ui.toast('Seed copied to clipboard'))
      .catch(() => window.GROVE.ui.toast('Copy failed — try Download'));
  };
  K.email = function () {
    const body = encodeURIComponent(K.generateMd());
    const subject = encodeURIComponent(`${K.name}_Magic_Grove_Journey.knobe.md — Magic Grove Seed`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };
  K.download = function () {
    const blob = new Blob([K.generateMd()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = K.fileName();
    a.click(); URL.revokeObjectURL(a.href);
    window.GROVE.ui.toast('Seed downloaded');
  };

  window.GROVE.knobe = K;
})();

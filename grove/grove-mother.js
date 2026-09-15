/* ===================================================================
   grove-mother.js — window.GROVE.mother
   The Mother of the Forest, read underfoot. While the visitor stands on the
   walkable stump a glowing ring follows their feet, the HUD ring reader names
   the band (sapwood / heartwood / pith) and the approximate ring year beneath
   them, and faint "event rings" (a fire year, a long drought, the stripping)
   brighten and are announced as they are crossed. Band and event changes go
   to a polite live region; the year readout itself stays visual so the
   screen reader is not flooded while walking.
   =================================================================== */
(function () {
  const T = AFRAME.THREE;
  const col = (h) => new T.Color(h);
  const C = window.GROVE.CONFIG, ST = C.stump, M = window.GROVE.MOTHER;
  const $ = (id) => document.getElementById(id);
  const EVENT_REACH = 0.55;      // how close (u) to an event ring counts as "on it"
  const UPDATE_MS = 120;

  const R = { ring: null, events: [], onStump: false, band: null, event: null, seen: new Set(), _last: 0 };

  const yearAt = (f) => M.yearPith + (M.yearOuter - M.yearPith) * Math.pow(Math.max(0, Math.min(1, f)), M.curve);
  const fracAt = (year) => Math.pow((year - M.yearPith) / (M.yearOuter - M.yearPith), 1 / M.curve);
  const fmtYear = (y) => { y = Math.round(y); return y <= 0 ? (1 - y) + ' BCE' : y + ' CE'; };
  const bandAt = (f) => M.bands.find(b => f >= b.min) || M.bands[M.bands.length - 1];

  function ringMat(op) {
    return new T.MeshBasicMaterial({ color: col('#ffd27a'), transparent: true, opacity: op,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
  }

  R.init = function () {
    const host = window.GROVE.stumpGroup; if (!host) return;
    // the follower ring: unit radius, scaled to the visitor's distance from the pith
    R.ring = new T.Mesh(new T.RingGeometry(0.97, 1.03, 96), ringMat(0));
    R.ring.rotation.x = -Math.PI / 2; R.ring.position.y = ST.top + 0.06; R.ring.renderOrder = 4;
    host.add(R.ring);
    // static event rings at their years
    M.events.forEach(ev => {
      const r = Math.max(0.6, fracAt(ev.year) * ST.r);
      const m = new T.Mesh(new T.RingGeometry(r - 0.05, r + 0.05, 128), ringMat(0.14));
      m.rotation.x = -Math.PI / 2; m.position.y = ST.top + 0.05; m.renderOrder = 4;
      m.userData = { ev, r, base: 0.14 };
      host.add(m); R.events.push(m);
    });
  };

  function announce(msg) {
    const live = $('rr-live'); if (!live) return;
    live.textContent = '';
    setTimeout(() => { live.textContent = msg; }, 50);
  }

  function showReader(on) {
    const el = $('ring-reader'); if (el) el.hidden = !on;
  }

  function setText(band, year, ev) {
    const b = $('rr-band'), y = $('rr-year'), e = $('rr-event');
    if (b) b.textContent = band ? band.name : '';
    if (y) y.textContent = 'ring ≈ ' + fmtYear(year);
    if (e) {
      if (ev) { e.innerHTML = '<b></b><span></span>'; e.querySelector('b').textContent = ev.label + ' · ' + fmtYear(ev.year); e.querySelector('span').textContent = ev.text; }
      else e.textContent = '';
    }
  }

  R.tick = function (tt) {
    const p = window.GROVE.player; if (!p || !R.ring) return;
    const dx = p.pos.x - ST.x, dz = p.pos.z - ST.z, d = Math.hypot(dx, dz);
    const onTop = d <= ST.r - 0.2;
    const on = onTop && !p.frozen;           // hidden while a panel is open, but "seen" events persist
    if (!onTop && R.seen.size) R.seen.clear();   // only a real walk-off resets the announcements
    if (on !== R.onStump) {
      R.onStump = on;
      showReader(on);
      if (!on) { R.band = null; R.event = null; R.ring.material.opacity = 0; }
      else announce('You are standing on the Mother of the Forest. The ring reader shows the layer and year under your feet.');
    }
    if (!on) return;
    const f = d / ST.r;
    const band = bandAt(f), year = yearAt(f);
    // follower ring
    R.ring.scale.setScalar(Math.max(0.4, d));
    R.ring.material.opacity = 0.35 + 0.2 * Math.sin(tt * 2.2);
    // nearest event ring
    let ev = null, evM = null, best = EVENT_REACH;
    for (const m of R.events) {
      const dd = Math.abs(m.userData.r - d);
      const near = Math.max(0, 1 - dd / 3);
      m.material.opacity = m.userData.base + near * 0.45 + (dd < EVENT_REACH ? 0.25 : 0);
      if (dd < best) { best = dd; ev = m.userData.ev; evM = m; }
    }
    if (band !== R.band) {
      R.band = band;
      announce('Now on ' + band.name + ': ' + band.hint + '.');
    }
    if (ev !== R.event) {
      R.event = ev;
      if (ev && !R.seen.has(ev.year)) { R.seen.add(ev.year); announce(ev.label + ', about ' + fmtYear(ev.year) + '. ' + ev.text); }
    }
    const now = performance.now();
    if (now - R._last > UPDATE_MS) { R._last = now; setText(band, year, ev); }
  };

  /* the read-aloud for the Mother's story and the ring under your feet */
  R.readHere = function () {
    if (!R.onStump || !window.GROVE.narrator) return;
    const p = window.GROVE.player;
    const d = Math.hypot(p.pos.x - ST.x, p.pos.z - ST.z), f = d / ST.r;
    const band = bandAt(f), year = yearAt(f);
    let s = 'You are standing on ' + band.name + ', ' + band.hint + '. The ring under your feet grew around ' + fmtYear(year) + '.';
    if (R.event) s += ' ' + R.event.label + ': ' + R.event.text;
    window.GROVE.narrator.speak(s, { label: 'The Mother of the Forest' });
  };

  window.GROVE.mother = R;
})();

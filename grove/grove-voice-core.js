/* ===================================================================
   grove-voice-core.js — window.GROVE.voiceCore
   The voice's decisions with no audio APIs in them (ported from the UC Davis
   Health 3D map's speech-core): text sanitising for the Piper phonemizer, a
   single-voice announcement queue with tagged cancel and generation-counter
   stop, and the reading-time estimate used to hold a caption when the voice
   is off. grove-narrator.js injects the real engine, playback and fallback.
   =================================================================== */
(function () {
  const G = window.GROVE = window.GROVE || {};
  const DASHES = /\s*[‒-―−]\s*/g;   // figure, en, em, horizontal-bar dashes and minus
  const MAX_SPEECH_CHARS = 500;

  /* Fold text to what the Amy voice's phonemizer can say. Some non-ASCII
     punctuation maps to out-of-range phoneme ids, which crashes the ONNX model
     and silently drops the whole utterance, so it is replaced first. */
  function sanitizeSpeech(text) {
    const clean = String(text == null ? '' : text)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // é -> e
      .replace(DASHES, ', ')
      .replace(/\s*·\s*/g, ', ')                     // middle dot
      .replace(/\s*→\s*/g, ' to ')                   // arrow
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/…/g, '. ')
      .replace(/[^\x00-\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.])/g, '$1')
      .trim();
    if (clean.length <= MAX_SPEECH_CHARS) return clean;
    const cut = clean.slice(0, MAX_SPEECH_CHARS);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '') + '.';
  }

  /* Split a passage into sentence-sized lines (each synthesised and captioned
     on its own, so the first words are heard quickly and captions stay short). */
  function splitLines(text, max) {
    max = max || 190;
    const parts = String(text).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["’”]?|[^.!?]+$/g) || [String(text)];
    const out = []; let cur = '';
    for (const p of parts) {
      const s = p.trim(); if (!s) continue;
      if ((cur + ' ' + s).length > max && cur) { out.push(cur); cur = s; }
      else cur = cur ? cur + ' ' + s : s;
    }
    if (cur) out.push(cur);
    return out;
  }

  /* A single-voice announcement queue.
     o.load()            start the engine; resolves when it can speak
     o.synth(engine,t)   text -> playable audio
     o.play(audio)       resolves when the audio finished (or was stopped)
     o.stopPlayback()    cut off whatever plays now
     o.fallback(text)    used only once the engine has permanently failed
     o.onStart/onEnd(text)  a line starts / stops being heard (captions) */
  function withTimeout(promise, ms, msg) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(msg)), ms);
      promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
  }

  /* o.onFail(text): a line could not be synthesised (or timed out) — the caller
     shows it as a caption anyway so nothing is lost. */
  function createVoiceQueue(o) {
    const onError = o.onError || function () {};
    const onStart = o.onStart || function () {};
    const onEnd = o.onEnd || function () {};
    const onFail = o.onFail || function () {};
    const synthTimeoutMs = o.synthTimeoutMs || 20000;
    let status = 'idle';        // idle | loading | ready | failed
    let loading = null;
    let generation = 0;
    let busy = false;
    let currentTag;
    const queue = [];

    function ensureLoaded() {
      if (!loading) {
        status = 'loading';
        loading = Promise.resolve()
          .then(o.load)
          .then(engine => { if (!engine) throw new Error('the voice engine did not start'); status = 'ready'; return engine; })
          .catch(err => { status = 'failed'; onError(err); return null; });
      }
      return loading;
    }

    async function drain() {
      if (busy) return;
      busy = true;
      try {
        while (queue.length) {
          const gen = generation;
          const engine = await ensureLoaded();
          if (gen !== generation) continue;          // stopped during warm-up
          if (!engine) { for (const item of queue.splice(0)) o.fallback(item.text); break; }
          const item = queue.shift();
          currentTag = item.tag;
          let audio = null;
          try {
            audio = await withTimeout(o.synth(engine, item.text), synthTimeoutMs, 'synthesis timed out');
          } catch (err) {
            onError(err);
            if (gen === generation) onFail(item.text);   // the line is still shown, just not heard
            currentTag = undefined;
            // A failed or hung synthesis leaves this engine wedged: start a fresh
            // one for the next line (its files are already in the browser cache).
            loading = null; status = 'idle';
            continue;
          }
          try {
            if (gen !== generation) continue;        // stopped mid-synthesis: never play a stale line
            onStart(item.text);
            try { await o.play(audio); } finally { onEnd(item.text); }
          } catch (err) { onError(err); }
          finally { currentTag = undefined; }
        }
      } finally { busy = false; }
    }

    function stop() { generation++; queue.length = 0; o.stopPlayback(); }

    return {
      get status() { return status; },
      preload() { ensureLoaded(); },
      speak(text, opts) {
        opts = opts || {};
        const clean = sanitizeSpeech(text);
        if (!/[a-z0-9]/i.test(clean)) return false;
        if (opts.interrupt) stop();
        queue.push({ text: clean, tag: opts.tag });
        drain();
        return true;
      },
      stop,
      /* Returns how many still-queued lines were dropped (a line being played is
         cut off instead and reports through onEnd as usual). */
      cancel(tag) {
        if (tag === undefined) return 0;
        let dropped = 0;
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].tag === tag) { queue.splice(i, 1); dropped++; }
        if (currentTag === tag) { generation++; o.stopPlayback(); }
        return dropped;
      },
    };
  }

  /* How long a caption shown without the voice stays up: reading pace, bounded. */
  const readingMs = (text) =>
    Math.min(12000, Math.max(2500, 1200 + String(text == null ? '' : text).trim().split(/\s+/).length * 280));

  G.voiceCore = { sanitizeSpeech, splitLines, createVoiceQueue, readingMs, MAX_SPEECH_CHARS };
})();

// ---------------------------------------------------------------------------
// Music — a tiny procedural ambient tavern loop, synthesized entirely with
// the Web Audio API (no external audio files). Plays only while inside the
// Cafe; fades out everywhere else.
//
// Tier 3.4 Phase C: first slice extracted from the client monolith. A DI
// factory (mirrors the server's lib/ pattern) — it receives the two things it
// reads from the app (getMe, setUnlockToast) and returns the handles the rest
// of the client calls. Everything else here is unchanged from the monolith.
// ---------------------------------------------------------------------------
export default function createAudio({ getMe, setUnlockToast }) {
let audioCtx = null;
let musicGain = null;
let musicMuted = false;
let musicPlaying = false;
let musicTimer = null;
let musicStep = 0;
let musicTrackId = null;   // what's actually sounding right now
let musicChoice = 'off';   // the player's saved pick: 'off' | a track id
let musicIsRoomTune = false; // true when the cafe started it, not the player
try { musicChoice = localStorage.getItem('tc_music') || 'off'; } catch (e) {}
// Sound effects: their own bus, default ON (music is the one that defaults off).
// SFX_LEVEL is the master effects volume — kept well below unity so the game
// never blares, especially the rapid-fire combat hits.
const SFX_LEVEL = 0.5;
// TEMP kill switch — the oscillator synth is being retired in favor of real
// recorded CC0 audio. While that's being sourced, every synthesized voice
// (music notes + all SFX) is silenced at the source, so nothing beeps no
// matter what triggers it. Flip to false (or delete these guards) once the
// sampled-audio engine is in.
const SYNTH_MUTED = true;
let sfxGain = null, sfxMuted = false, noiseBuffer = null;
// Recorded SFX (ElevenLabs, public/audio/sfx/) ride a PARALLEL clean bus:
// sfxFileGain → destination, bypassing the 3600 Hz low-pass + reverb that the
// synth path uses (that chain is tuned to tame buzzy oscillators and would just
// dull real recordings). It still tracks the same mute/volume as sfxGain. Buffers
// are decoded once at audio-init from /audio/sfx/index.json; playSfx prefers a
// loaded buffer and falls back to the synth for any id without a file.
let sfxFileGain = null;
let sfxBuffers = {};        // id -> [AudioBuffer, ...] (variants)
let sfxLoadStarted = false;
const SFX_FILE_GAIN = { footstep: 0.45, kill: 0.55 }; // per-id trim; footsteps + the kill wail sit under the mix
const SFX_FILE_LOWPASS = { kill: 2400 };              // per-id high-cut (Hz) — tame the kill's shrill top so combos don't fatigue
// The 🔈 button is one global mute for BOTH music and sfx. It has a single
// source of truth — tc_audio_muted — so the two buses can never drift apart. (An
// earlier build persisted only the sfx half, which left reloads silent with
// the button still reading "unmuted"; honoring tc_audio_muted instead, default off,
// also frees anyone who got stuck that way.)
let allMuted = false;
try { allMuted = localStorage.getItem('tc_audio_muted') === '1'; } catch (e) {}
musicMuted = allMuted;
sfxMuted = allMuted;

const TAVERN_SCALE = [196.00, 220.00, 246.94, 293.66, 329.63, 392.00]; // G3 pentatonic-ish run
const TAVERN_MELODY = [0, 2, 4, 2, 1, 3, 5, 3, 0, 4, 2, 0, 1, 3, 2, 0];

function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(audioCtx.destination);
    // Separate bus for sound effects, so SFX and music mute independently.
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = sfxMuted ? 0 : SFX_LEVEL;
    // Warmth chain on the WHOLE sfx bus: a gentle low-pass rolls off the harsh
    // upper harmonics of the square/saw voices (the main cause of "cheap, buzzy,
    // fatiguing"), and a short reverb gives the otherwise bone-dry blips some
    // room so they read as crafted rather than beeped. Both buses feed the
    // output; the reverb is mixed in low.
    const sfxFilter = audioCtx.createBiquadFilter();
    sfxFilter.type = 'lowpass'; sfxFilter.frequency.value = 3600; sfxFilter.Q.value = 0.6;
    sfxGain.connect(sfxFilter);
    sfxFilter.connect(audioCtx.destination);                 // dry
    try {
      const conv = audioCtx.createConvolver(); conv.buffer = makeReverbIR(0.55, 2.4);
      const wet = audioCtx.createGain(); wet.gain.value = 0.16;
      sfxFilter.connect(conv); conv.connect(wet); wet.connect(audioCtx.destination); // wet tail
    } catch (e) { /* no convolver — dry path still works */ }
    // Parallel clean bus for recorded SFX (no low-pass/reverb), same volume/mute.
    sfxFileGain = audioCtx.createGain();
    sfxFileGain.gain.value = sfxMuted ? 0 : SFX_LEVEL;
    // A gentle limiter on the whole recorded-SFX bus so rapid, stacking sounds
    // (a kill combo, say) can't pile up into something painful — it rides the
    // peaks down without dulling a single hit.
    try {
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.18;
      sfxFileGain.connect(comp); comp.connect(audioCtx.destination);
    } catch (e) { sfxFileGain.connect(audioCtx.destination); }
    loadSfxFiles(); // decode the generated set once
  } catch (e) { /* Web Audio unavailable — music simply won't play */ }
}

// Fetch the generated SFX manifest and decode each file into memory once. Best
// effort: a missing index.json or a failed decode just leaves that id on the
// synth fallback, so the game never breaks for want of an audio file.
async function loadSfxFiles() {
  if (sfxLoadStarted || !audioCtx) return;
  sfxLoadStarted = true;
  let index;
  try {
    // index.json is tiny and the source of truth for which sounds + which
    // versions exist — always fetch it fresh so a regenerated sound is picked
    // up (the MP3s below are themselves cache-busted by ?v=).
    const res = await fetch('/audio/sfx/index.json', { cache: 'no-store' });
    if (!res.ok) return;
    index = await res.json();
  } catch (e) { return; }
  for (const id of Object.keys(index || {})) {
    const entries = index[id] || [];
    for (const entry of entries) {
      // Accept both the versioned shape ({ f, v }) and the old flat string.
      const fn = (typeof entry === 'string') ? entry : (entry && entry.f);
      const ver = (entry && entry.v) ? ('?v=' + entry.v) : '';
      if (!fn) continue;
      try {
        // Same filename + a content-hash query → a changed sound gets a new URL,
        // so force-cache can serve the rest instantly without stranding players
        // on a stale recording.
        const r = await fetch('/audio/sfx/' + fn + ver, { cache: 'force-cache' });
        if (!r.ok) continue;
        const buf = await audioCtx.decodeAudioData(await r.arrayBuffer());
        (sfxBuffers[id] = sfxBuffers[id] || []).push(buf);
      } catch (e) { /* skip this variant; synth covers the id */ }
    }
  }
}

// Play a recorded SFX for `name` if one is loaded; returns true if it did. Picks
// a random variant (so repeats — footsteps, hits — don't sound identical) and
// routes through the clean file bus with an optional per-id trim.
function playSfxFile(name, vol) {
  const bufs = sfxBuffers[name];
  if (!bufs || !bufs.length || !sfxFileGain || !audioCtx) return false;
  const buf = bufs.length === 1 ? bufs[0] : bufs[(Math.random() * bufs.length) | 0];
  try {
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    // Chain src → [high-cut] → [trim×vol] → bus. Each stage is optional per id.
    let node = src;
    const lp = SFX_FILE_LOWPASS[name];
    if (lp) {
      const f = audioCtx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.6;
      node.connect(f); node = f;
    }
    // Per-id trim folded together with an optional per-call volume (distance
    // falloff for remote players' actions).
    const trim = SFX_FILE_GAIN[name];
    const mul = (trim != null ? trim : 1) * (vol != null ? vol : 1);
    if (mul !== 1) {
      const g = audioCtx.createGain(); g.gain.value = mul;
      node.connect(g); node = g;
    }
    node.connect(sfxFileGain);
    src.start(audioCtx.currentTime);
    return true;
  } catch (e) { return false; }
}

// A short synthetic reverb impulse (decaying white noise) for the sfx tail.
function makeReverbIR(seconds, decay) {
  const rate = audioCtx.sampleRate, len = Math.max(1, Math.floor(rate * seconds));
  const ir = audioCtx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return ir;
}

function playNote(freq, time, dur, vol, type) {
  if (SYNTH_MUTED) return;
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}
// A struck-bell voice: fundamental + a quiet octave partial, long-ish fade.
function playBell(freq, time, dur, vol) {
  playNote(freq, time, dur, vol, 'sine');
  playNote(freq * 2, time, dur * 0.6, vol * 0.3, 'sine');
}
// A plucked string with a fading echo — the harp of the kit.
function playPluck(freq, time, vol) {
  playNote(freq, time, 0.5, vol, 'triangle');
  playNote(freq, time + 0.34, 0.44, vol * 0.38, 'triangle');
}

// ── The witchy songbook — generative tracks the player cycles through ──────
// Each track is a tiny recipe: a step interval and a function that schedules
// the next beat's notes. All code, no audio files — the same client that
// draws the town also hums its tunes.
const MUSIC_TRACKS = [
  {
    id: 'moonrise', name: 'Moonrise', icon: '🌙', stepMs: 620,
    // Slow pentatonic-minor plucks over a breathing low drone — the town at
    // night, nothing hurried.
    scale: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
    melody: [0, 4, 2, -1, 5, 3, 6, -1, 1, 4, -1, 2, 6, 3, 2, -1],
    step(now, i) {
      const n = this.melody[i % this.melody.length];
      if (n >= 0) playPluck(this.scale[n], now, 0.13);
      if (i % 8 === 0) playNote(110.00, now, 3.6, 0.07, 'sine');            // A2 breath
      if (i % 8 === 4) playNote(164.81, now, 3.2, 0.055, 'sine');           // E3 answer
    },
  },
  {
    id: 'covens_waltz', name: "The Coven's Waltz", icon: '🔮', stepMs: 400,
    // A slow 3/4 turn through A harmonic minor — the G# is the witchcraft.
    scale: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 415.30, 440.00],
    melody: [0, 2, 4, 7, 6, 4, 2, 4, 0, 3, 5, 3, 6, 4, 2, 0, 1, 2, 3, 4, 6, 7, 6, 4],
    step(now, i) {
      if (i % 3 === 0) playNote(i % 6 === 0 ? 110.00 : 82.41, now, 1.0, 0.11, 'sine'); // bass sway
      else playPluck(this.scale[this.melody[i % this.melody.length]], now, 0.12);
    },
  },
  {
    id: 'wilds_dusk', name: 'Wilds at Dusk', icon: '🌲', stepMs: 880,
    // Sparse bells over a deep drone; every seventh bar leans on the
    // tritone so the forest never feels quite safe.
    bells: [329.63, 392.00, 415.30, 311.13, 493.88, 392.00, 261.63],
    step(now, i) {
      if (i % 4 === 0) { playNote(55.00, now, 4.4, 0.06, 'triangle'); playNote(110.00, now, 4.4, 0.035, 'sine'); }
      if (i % 3 === 1) playBell(this.bells[(i * 5) % this.bells.length], now, 2.2, 0.09);
      if (i % 7 === 3) playBell(311.13, now, 2.6, 0.055); // D#4 — the unease
    },
  },
  {
    id: 'witch_sabbath', name: "Witch's Sabbath", icon: '🧹', stepMs: 700,
    // A low drone with its tritone, scattered unsettling bells, and the odd
    // high shriek — the coven gathered on the hill at midnight.
    bells: [311.13, 415.30, 466.16, 277.18, 369.99, 523.25], // D#4 G#4 A#4 C#4 F#4 C5 — no comfortable home
    step(now, i) {
      if (i % 4 === 0) { playNote(49.00, now, 5.0, 0.07, 'sawtooth'); playNote(69.30, now, 5.0, 0.04, 'sine'); } // G1 + its tritone
      if (i % 2 === 1) playBell(this.bells[(i * 3) % this.bells.length], now, 2.6, 0.085);
      if (i % 7 === 5) playBell(622.25, now, 1.8, 0.05); // a high D#5 cry
    },
  },
  {
    id: 'music_box', name: 'Music Box', icon: '🎀', stepMs: 460,
    // A slow, cracked lullaby in C minor — the music box in the attic that
    // winds itself.
    scale: [523.25, 587.33, 622.25, 698.46, 783.99, 830.61, 932.33], // C5 harmonic-minor-ish
    melody: [0, 2, 4, 2, 0, 3, 1, 4, 2, 5, 4, 2, 0, 1, 2, -1],
    step(now, i) {
      const n = this.melody[i % this.melody.length];
      if (n >= 0) { playNote(this.scale[n], now, 0.6, 0.1, 'sine'); playNote(this.scale[n] * 2, now, 0.28, 0.028, 'sine'); }
      if (i % 8 === 0) playNote(130.81, now, 1.8, 0.05, 'sine'); // a soft low C3
    },
  },
  {
    id: 'ember_jig', name: 'Ember Jig', icon: '🎻', stepMs: 300,
    // The Cauldron Café's own tune, quickened — dotted steps, warm bass.
    step(now, i) {
      const note = TAVERN_MELODY[i % TAVERN_MELODY.length];
      playNote(TAVERN_SCALE[note], now, i % 2 ? 0.28 : 0.5, 0.16);
      if (i % 4 === 0) playNote(TAVERN_SCALE[0] / 2, now, 0.9, 0.1);
      if (i % 8 === 6) playNote(TAVERN_SCALE[note] * 2, now, 0.22, 0.06);   // sparkle
    },
  },
];
function musicTrackById(id) { return MUSIC_TRACKS.find(t => t.id === id) || null; }

function scheduleMusicStep() {
  if (!musicPlaying || !audioCtx) return;
  const track = musicTrackById(musicTrackId);
  if (!track) return;
  track.step(audioCtx.currentTime, musicStep);
  musicStep++;
  musicTimer = setTimeout(scheduleMusicStep, track.stepMs);
}

// startMusic(trackId?, {roomTune}) — the cafe calls it as a room tune (only
// honored when the player hasn't picked their own track); the ☰ Music row
// calls it with an explicit pick.
function startMusic(trackId, opts) {
  const roomTune = !!(opts && opts.roomTune);
  if (roomTune && musicChoice !== 'off') return; // their playlist outranks the room's
  ensureAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const id = trackId || 'ember_jig';
  if (musicPlaying && musicTrackId === id) return;
  clearTimeout(musicTimer);
  musicPlaying = true;
  musicIsRoomTune = roomTune;
  musicTrackId = id;
  musicStep = 0;
  musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
  musicGain.gain.linearRampToValueAtTime(musicMuted ? 0 : 0.5, audioCtx.currentTime + 1.2);
  scheduleMusicStep();
}

// stopMusic({roomTune}) — a room-tune stop (leaving the cafe) never silences
// a track the player chose themselves.
function stopMusic(opts) {
  if (!musicPlaying) return;
  if (opts && opts.roomTune && !musicIsRoomTune) return;
  musicPlaying = false;
  musicIsRoomTune = false;
  musicTrackId = null;
  clearTimeout(musicTimer);
  if (audioCtx && musicGain) {
    musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
  }
}

// ── The ☰ Music row: tap to cycle Off → 🌙 → 🔮 → 🌲 → 🎻 → Off ──
function musicMenuLabel() {
  if (musicChoice === 'off') {
    return musicPlaying && musicIsRoomTune ? '🎶 Music: room tune (tap to pick)' : '🎶 Music: Off';
  }
  const t = musicTrackById(musicChoice);
  return t ? `🎶 Music: ${t.icon} ${t.name}` : '🎶 Music: Off';
}
function cycleMusic() {
  const order = ['off', ...MUSIC_TRACKS.map(t => t.id)];
  musicChoice = order[(order.indexOf(musicChoice) + 1) % order.length];
  try { localStorage.setItem('tc_music', musicChoice); } catch (e) {}
  if (musicChoice === 'off') {
    stopMusic();
    // If they're standing in the cafe, the house tune takes back over.
    const _m = getMe(); if (_m && _m.room === 'cafe') startMusic('ember_jig', { roomTune: true });
    setUnlockToast('🔇 Music off');
  } else {
    musicIsRoomTune = false;
    startMusic(musicChoice);
    const t = musicTrackById(musicChoice);
    setUnlockToast(`${t.icon} Now playing: ${t.name}`);
  }
  const row = document.getElementById('menuMusic');
  if (row) row.textContent = musicMenuLabel();
}
// The browser keeps every AudioContext suspended until it sees a real user
// gesture, and it only honors resume() from inside that gesture's call stack.
// Sound effects fire from WebSocket messages (a blow lands, a level-up), which
// are NOT gestures — so unless the context was already unlocked from a tap, it
// stays suspended and the whole game is silent. The very first tap/click
// (usually the join button) is our one chance: prime and resume the context
// right here, ALWAYS — not only when music happens to be on — then start any
// saved track. Later taps keep nudging it in case the browser re-suspends.
function unlockAudio() {
  ensureAudio();
  if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) {} }
}
document.addEventListener('pointerdown', function firstGesture() {
  document.removeEventListener('pointerdown', firstGesture);
  unlockAudio();
  if (musicChoice !== 'off') startMusic(musicChoice);
}, { once: true });
// Safety net for browsers that re-suspend after focus loss / tab switches.
document.addEventListener('pointerdown', () => {
  if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) {} }
});

function setMusicMuted(muted) {
  musicMuted = muted;
  if (audioCtx && musicGain && musicPlaying) {
    musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
    musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5, audioCtx.currentTime + 0.3);
  }
}

// ── Sound effects — short procedural one-shots on the sfx bus ────────────────
// All synthesized (oscillators + a touch of filtered noise), no audio files,
// same spirit as the music above. One call per game moment: playSfx('hit'), etc.
function sfxTone(freq, t, dur, vol, type, freqEnd) {
  if (SYNTH_MUTED) return;
  if (!audioCtx || !sfxGain) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function sfxNoise(t, dur, vol, filterFreq) {
  if (SYNTH_MUTED) return;
  if (!audioCtx || !sfxGain) return;
  if (!noiseBuffer) {
    noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.4, audioCtx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
  const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 2000;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur + 0.02);
}
// A haunted tail: the same note repeated quieter a beat later (poor-man's reverb).
function sfxEcho(freq, t, dur, vol, type, freqEnd) {
  sfxTone(freq, t, dur, vol, type, freqEnd);
  sfxTone(freq, t + dur * 0.55, dur * 0.8, vol * 0.33, type, freqEnd ? freqEnd * 0.98 : undefined);
}
// The spooky songbook of one-shots — minor intervals, tritones, bells and
// airy noise. Every game moment maps to one call: playSfx('summon'), etc.
function playSfx(name, vol) {
  if (sfxMuted) return;
  ensureAudio();
  if (!audioCtx || !sfxGain) return;
  if (audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) {} }
  // Prefer a recorded sound for this id; fall back to the synth voices below.
  // vol (0..1) attenuates recorded sounds — used for distance falloff on
  // remote players' actions; the synth fallback plays at its own level.
  if (playSfxFile(name, vol)) return;
  const t = audioCtx.currentTime;
  switch (name) {
    // ── Combat ──
    case 'hit':     sfxNoise(t, 0.07, 0.36, 1300); sfxTone(150, t, 0.08, 0.2, 'triangle', 70); break;       // a dry bone-thud
    case 'kill':    sfxEcho(540, t, 0.42, 0.16, 'sawtooth', 120); sfxNoise(t, 0.3, 0.24, 900); break;         // a ghost's falling wail
    case 'hurt':    sfxTone(300, t, 0.12, 0.2, 'triangle', 150); sfxNoise(t, 0.08, 0.16, 1000); break;        // a soft pained stab
    case 'death':   sfxTone(196, t, 0.95, 0.22, 'sine', 70); sfxTone(98, t, 1.05, 0.14, 'triangle', 44); sfxTone(392, t, 0.9, 0.08, 'sine', 160); break; // tolling bell + sinking drone
    // ── Spellcasting ──
    case 'cast':    sfxTone(300, t, 0.3, 0.11, 'triangle', 780); sfxTone(303, t, 0.3, 0.09, 'triangle', 792); sfxTone(1400, t + 0.18, 0.12, 0.04, 'sine'); break; // rising witch-shimmer + sparkle
    case 'summon':  // the earth splits — a low swell, then a dissonant chord claws up (A–C–D♯, a tritone in the minor)
                    sfxTone(65, t, 0.6, 0.2, 'triangle', 150); sfxNoise(t, 0.5, 0.18, 620);
                    [220.00, 261.63, 311.13].forEach((f, i) => sfxTone(f, t + 0.26 + i * 0.03, 0.5, 0.1, 'triangle')); break;
    case 'curse':   sfxTone(440, t, 0.34, 0.17, 'triangle', 150); sfxTone(466, t, 0.34, 0.1, 'triangle', 160); break; // a hex, falling and clashing
    case 'ward':    sfxTone(110, t, 0.45, 0.16, 'sine'); sfxTone(164.81, t, 0.45, 0.1, 'sine'); sfxTone(220, t + 0.1, 0.4, 0.06, 'sine'); break;   // a protective hum
    case 'buff':    sfxTone(120, t, 0.32, 0.18, 'triangle', 300); sfxTone(90, t, 0.32, 0.1, 'triangle', 220); break; // a growling swell
    case 'heal':    [392.00, 523.25, 659.25, 783.99].forEach((f, i) => sfxTone(f, t + i * 0.07, 0.4, 0.1, 'sine')); break; // soft rising shimmer
    case 'reveal':  sfxTone(1245, t, 0.26, 0.07, 'sine'); sfxTone(1661, t + 0.09, 0.22, 0.05, 'sine'); sfxNoise(t, 0.3, 0.05, 6500); break; // whispery high glimmer
    // ── Rewards & world ──
    case 'levelup': [440, 523.25, 659.25, 880, 1046.5].forEach((f, i) => { sfxTone(f, t + i * 0.08, 0.3, 0.16, 'triangle'); sfxTone(f * 2, t + i * 0.08, 0.14, 0.04, 'sine'); }); break; // minor-box run to a bright top
    case 'loot':    sfxTone(988, t, 0.12, 0.13, 'sine'); sfxTone(1318.5, t + 0.08, 0.18, 0.12, 'sine'); break; // glassy chime
    case 'harvest': sfxNoise(t, 0.12, 0.12, 3600); sfxTone(330, t, 0.1, 0.07, 'triangle', 420); break;        // a soft rustle
    case 'drink':   [320, 280, 240].forEach((f, i) => sfxTone(f, t + i * 0.07, 0.07, 0.13, 'sine')); break;    // a quick glug
    case 'error':   sfxTone(92, t, 0.16, 0.14, 'triangle', 70); sfxTone(97, t, 0.16, 0.08, 'triangle', 74); break; // a low dissonant 'no'
    default: break;
  }
}
function setSfxMuted(muted) {
  sfxMuted = muted;
  if (audioCtx && sfxGain) sfxGain.gain.setValueAtTime(muted ? 0 : SFX_LEVEL, audioCtx.currentTime);
  if (audioCtx && sfxFileGain) sfxFileGain.gain.setValueAtTime(muted ? 0 : SFX_LEVEL, audioCtx.currentTime); // clean bus mutes in lock-step
}

// The one global mute. Persists a single flag (tc_audio_muted) and drives both buses
// together, so music and sfx stay in lock-step across reloads.
function setAllMuted(muted) {
  allMuted = muted;
  try { localStorage.setItem('tc_audio_muted', muted ? '1' : '0'); } catch (e) {}
  setMusicMuted(muted);
  setSfxMuted(muted);
}

const muteBtn = document.getElementById('muteBtn');
if (muteBtn) {
  // Reflect the real, persisted state on load so the icon can't lie.
  muteBtn.textContent = allMuted ? '🔇' : '🔈';
  muteBtn.addEventListener('click', () => {
    setAllMuted(!allMuted);
    muteBtn.textContent = allMuted ? '🔇' : '🔈';
  });
}

  return {
    ensureAudio, startMusic, stopMusic, cycleMusic, musicMenuLabel,
    playSfx, setSfxMuted,
    // True once a recorded file for `id` is loaded — lets callers prefer a
    // specific new sound but fall back (e.g. per-class melee → generic 'hit').
    sfxAvailable: (id) => !!(sfxBuffers[id] && sfxBuffers[id].length),
    // Snapshot for the __testDrive.music() probe (kept identical to the old
    // inline reads of this module's private state).
    musicState: () => ({
      choice: musicChoice, playing: musicPlaying, trackId: musicTrackId,
      roomTune: musicIsRoomTune, ctx: audioCtx ? audioCtx.state : null,
    }),
  };
}

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

const TAVERN_SCALE = [196.00, 220.00, 246.94, 293.66, 329.63, 392.00]; // G3 pentatonic-ish run
const TAVERN_MELODY = [0, 2, 4, 2, 1, 3, 5, 3, 0, 4, 2, 0, 1, 3, 2, 0];

function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(audioCtx.destination);
  } catch (e) { /* Web Audio unavailable — music simply won't play */ }
}

function playNote(freq, time, dur, vol, type) {
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
// A saved track can't sound until the browser gets a gesture — the very
// first tap/click (usually the join button) unlocks it.
document.addEventListener('pointerdown', function musicUnlock() {
  document.removeEventListener('pointerdown', musicUnlock);
  if (musicChoice !== 'off') startMusic(musicChoice);
}, { once: true });

function setMusicMuted(muted) {
  musicMuted = muted;
  if (audioCtx && musicGain && musicPlaying) {
    musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
    musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5, audioCtx.currentTime + 0.3);
  }
}

const muteBtn = document.getElementById('muteBtn');
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    setMusicMuted(!musicMuted);
    muteBtn.textContent = musicMuted ? '🔇' : '🔈';
  });
}

  return {
    ensureAudio, startMusic, stopMusic, cycleMusic, musicMenuLabel,
    // Snapshot for the __testDrive.music() probe (kept identical to the old
    // inline reads of this module's private state).
    musicState: () => ({
      choice: musicChoice, playing: musicPlaying, trackId: musicTrackId,
      roomTune: musicIsRoomTune, ctx: audioCtx ? audioCtx.state : null,
    }),
  };
}

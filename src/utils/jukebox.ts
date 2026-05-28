/**
 * Jukebox — Web Audio API melody player for chat-requested music.
 * Viewers type "music [name]" or "play [name]" in chat to trigger melodies.
 * All sounds are synthesized in real-time — no audio files needed.
 */

let audioCtx: AudioContext | null = null;

/** Cooldown to prevent overlapping songs from spam */
let lastPlayTime = 0;
const JUKEBOX_COOLDOWN_MS = 2500;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null as unknown as AudioContext;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

interface Note {
  freq: number;
  duration: number;
  startTime: number;
  type?: OscillatorType;
  volume?: number;
}

/** Play a single tone with envelope */
function playNote(note: Note) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type || 'sine';
    osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.startTime);
    gain.gain.setValueAtTime(note.volume || 0.12, ctx.currentTime + note.startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.startTime + note.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + note.startTime);
    osc.stop(ctx.currentTime + note.startTime + note.duration);
  } catch {
    // Silently ignore audio errors
  }
}

/** Play a full melody from a note array */
function playMelody(melody: Note[]) {
  melody.forEach(n => playNote(n));
}

// ==================== MELODY DEFINITIONS ====================

/** 🎵 Mario Theme — Classic coin-collecting opening */
export function playMarioTheme() {
  const notes: Note[] = [
    { freq: 659, duration: 0.15, startTime: 0, type: 'square' },      // E5
    { freq: 659, duration: 0.15, startTime: 0.15, type: 'square' },    // E5
    { freq: 0, duration: 0.15, startTime: 0.3, type: 'square' },       // rest
    { freq: 659, duration: 0.15, startTime: 0.45, type: 'square' },    // E5
    { freq: 0, duration: 0.15, startTime: 0.6, type: 'square' },       // rest
    { freq: 523, duration: 0.15, startTime: 0.75, type: 'square' },    // C5
    { freq: 659, duration: 0.15, startTime: 0.9, type: 'square' },     // E5
    { freq: 0, duration: 0.15, startTime: 1.05, type: 'square' },      // rest
    { freq: 784, duration: 0.3, startTime: 1.2, type: 'square' },      // G5
    { freq: 0, duration: 0.3, startTime: 1.5, type: 'square' },        // rest
    { freq: 392, duration: 0.3, startTime: 1.8, type: 'square' },      // G4
    { freq: 0, duration: 0.3, startTime: 2.1, type: 'square' },        // rest
    { freq: 523, duration: 0.3, startTime: 2.4, type: 'square' },      // C5
    { freq: 0, duration: 0.15, startTime: 2.7, type: 'square' },       // rest
    { freq: 392, duration: 0.15, startTime: 2.85, type: 'square' },    // G4
    { freq: 330, duration: 0.15, startTime: 3.0, type: 'square' },     // E4
    { freq: 262, duration: 0.15, startTime: 3.15, type: 'square' },    // C4
    { freq: 440, duration: 0.15, startTime: 3.3, type: 'square' },     // A4
    { freq: 494, duration: 0.15, startTime: 3.45, type: 'square' },    // B4
    { freq: 330, duration: 0.15, startTime: 3.6, type: 'square' },     // E4
    { freq: 392, duration: 0.3, startTime: 3.75, type: 'square' },     // G4
  ];
  playMelody(notes);
}

/** 🧱 Tetris Theme — Korobeiniki */
export function playTetrisTheme() {
  const notes: Note[] = [
    { freq: 330, duration: 0.2, startTime: 0, type: 'square' },       // E4
    { freq: 392, duration: 0.2, startTime: 0.25, type: 'square' },    // G4
    { freq: 440, duration: 0.2, startTime: 0.5, type: 'square' },     // A4
    { freq: 523, duration: 0.2, startTime: 0.75, type: 'square' },    // C5
    { freq: 440, duration: 0.2, startTime: 1.0, type: 'square' },     // A4
    { freq: 392, duration: 0.2, startTime: 1.25, type: 'square' },    // G4
    { freq: 330, duration: 0.4, startTime: 1.5, type: 'square' },     // E4
    { freq: 0, duration: 0.2, startTime: 1.9, type: 'square' },       // rest
    { freq: 262, duration: 0.2, startTime: 2.1, type: 'square' },     // C4
    { freq: 330, duration: 0.2, startTime: 2.35, type: 'square' },    // E4
    { freq: 392, duration: 0.2, startTime: 2.6, type: 'square' },     // G4
    { freq: 440, duration: 0.2, startTime: 2.85, type: 'square' },    // A4
    { freq: 392, duration: 0.2, startTime: 3.1, type: 'square' },     // G4
    { freq: 330, duration: 0.2, startTime: 3.35, type: 'square' },    // E4
    { freq: 262, duration: 0.4, startTime: 3.6, type: 'square' },     // C4
  ];
  playMelody(notes);
}

/** 🎂 Happy Birthday */
export function playHappyBirthday() {
  const notes: Note[] = [
    { freq: 262, duration: 0.3, startTime: 0 },      // C4
    { freq: 262, duration: 0.15, startTime: 0.35 },   // C4
    { freq: 294, duration: 0.4, startTime: 0.55 },    // D4
    { freq: 262, duration: 0.4, startTime: 1.0 },     // C4
    { freq: 349, duration: 0.4, startTime: 1.45 },    // F4
    { freq: 330, duration: 0.5, startTime: 1.9 },     // E4
    { freq: 262, duration: 0.3, startTime: 2.5 },     // C4
    { freq: 262, duration: 0.15, startTime: 2.85 },   // C4
    { freq: 294, duration: 0.4, startTime: 3.05 },    // D4
    { freq: 262, duration: 0.4, startTime: 3.5 },     // C4
    { freq: 392, duration: 0.4, startTime: 3.95 },    // G4
    { freq: 349, duration: 0.5, startTime: 4.4 },     // F4
    { freq: 262, duration: 0.3, startTime: 5.0 },     // C4
    { freq: 262, duration: 0.15, startTime: 5.35 },   // C4
    { freq: 523, duration: 0.4, startTime: 5.55 },    // C5
    { freq: 440, duration: 0.4, startTime: 6.0 },     // A4
    { freq: 349, duration: 0.4, startTime: 6.45 },    // F4
    { freq: 330, duration: 0.4, startTime: 6.9 },     // E4
    { freq: 294, duration: 0.5, startTime: 7.35 },    // D4
    { freq: 466, duration: 0.4, startTime: 7.95 },    // Bb4
    { freq: 466, duration: 0.15, startTime: 8.4 },    // Bb4
    { freq: 440, duration: 0.4, startTime: 8.6 },     // A4
    { freq: 349, duration: 0.4, startTime: 9.05 },    // F4
    { freq: 392, duration: 0.4, startTime: 9.5 },     // G4
    { freq: 349, duration: 0.5, startTime: 9.95 },    // F4
  ];
  playMelody(notes);
}

/** 📯 Epic Fanfare — Triumphant victory call */
export function playEpicFanfare() {
  const notes: Note[] = [
    { freq: 523, duration: 0.25, startTime: 0, type: 'triangle', volume: 0.15 },    // C5
    { freq: 659, duration: 0.25, startTime: 0.3, type: 'triangle', volume: 0.15 },  // E5
    { freq: 784, duration: 0.25, startTime: 0.6, type: 'triangle', volume: 0.15 },  // G5
    { freq: 1047, duration: 0.5, startTime: 0.9, type: 'triangle', volume: 0.18 },  // C6
    { freq: 784, duration: 0.15, startTime: 1.5, type: 'triangle', volume: 0.12 },  // G5
    { freq: 1047, duration: 0.6, startTime: 1.7, type: 'triangle', volume: 0.2 },   // C6
  ];
  playMelody(notes);
}

/** 🎄 Jingle Bells */
export function playJingleBells() {
  const notes: Note[] = [
    { freq: 659, duration: 0.2, startTime: 0, type: 'square' },      // E5
    { freq: 659, duration: 0.2, startTime: 0.25, type: 'square' },    // E5
    { freq: 659, duration: 0.3, startTime: 0.5, type: 'square' },     // E5
    { freq: 659, duration: 0.2, startTime: 0.85, type: 'square' },   // E5
    { freq: 659, duration: 0.2, startTime: 1.1, type: 'square' },    // E5
    { freq: 659, duration: 0.3, startTime: 1.35, type: 'square' },   // E5
    { freq: 659, duration: 0.2, startTime: 1.7, type: 'square' },    // E5
    { freq: 784, duration: 0.2, startTime: 1.95, type: 'square' },   // G5
    { freq: 523, duration: 0.2, startTime: 2.2, type: 'square' },    // C5
    { freq: 587, duration: 0.2, startTime: 2.45, type: 'square' },   // D5
    { freq: 659, duration: 0.4, startTime: 2.7, type: 'square' },    // E5
    { freq: 0, duration: 0.2, startTime: 3.1, type: 'square' },      // rest
    { freq: 349, duration: 0.2, startTime: 3.3, type: 'square' },    // F4
    { freq: 392, duration: 0.2, startTime: 3.55, type: 'square' },   // G4
    { freq: 440, duration: 0.2, startTime: 3.8, type: 'square' },    // A4
    { freq: 494, duration: 0.2, startTime: 4.05, type: 'square' },   // B4
    { freq: 523, duration: 0.4, startTime: 4.3, type: 'square' },    // C5
  ];
  playMelody(notes);
}

/** 👾 Among Us Theme — Suspenseful space */
export function playAmongUsTheme() {
  const notes: Note[] = [
    { freq: 130, duration: 0.4, startTime: 0, type: 'sine', volume: 0.1 },        // C3
    { freq: 165, duration: 0.3, startTime: 0.5, type: 'sine', volume: 0.1 },      // E3
    { freq: 196, duration: 0.3, startTime: 0.9, type: 'sine', volume: 0.1 },      // G3
    { freq: 262, duration: 0.6, startTime: 1.3, type: 'sine', volume: 0.12 },     // C4
    { freq: 220, duration: 0.4, startTime: 2.0, type: 'sine', volume: 0.1 },      // A3
    { freq: 262, duration: 0.3, startTime: 2.5, type: 'sine', volume: 0.1 },      // C4
    { freq: 311, duration: 0.6, startTime: 2.9, type: 'sine', volume: 0.12 },     // Eb4
    { freq: 262, duration: 0.4, startTime: 3.6, type: 'sine', volume: 0.1 },      // C4
    { freq: 196, duration: 0.6, startTime: 4.1, type: 'sine', volume: 0.1 },      // G3
    { freq: 165, duration: 0.4, startTime: 4.8, type: 'sine', volume: 0.08 },     // E3
    { freq: 130, duration: 0.8, startTime: 5.3, type: 'sine', volume: 0.1 },      // C3
  ];
  playMelody(notes);
}

/** 🚀 Star Wars — Imperial March (Darth Vader) */
export function playImperialMarch() {
  const notes: Note[] = [
    { freq: 440, duration: 0.4, startTime: 0, type: 'square', volume: 0.12 },
    { freq: 440, duration: 0.4, startTime: 0.45, type: 'square', volume: 0.12 },
    { freq: 440, duration: 0.4, startTime: 0.9, type: 'square', volume: 0.12 },
    { freq: 349, duration: 0.3, startTime: 1.35, type: 'square', volume: 0.1 },
    { freq: 523, duration: 0.15, startTime: 1.7, type: 'square', volume: 0.1 },
    { freq: 440, duration: 0.4, startTime: 1.9, type: 'square', volume: 0.12 },
    { freq: 349, duration: 0.3, startTime: 2.35, type: 'square', volume: 0.1 },
    { freq: 523, duration: 0.15, startTime: 2.7, type: 'square', volume: 0.1 },
    { freq: 440, duration: 0.8, startTime: 2.9, type: 'square', volume: 0.12 },
    { freq: 0, duration: 0.3, startTime: 3.7, type: 'square' },
    { freq: 698, duration: 0.4, startTime: 4.0, type: 'square', volume: 0.1 },
    { freq: 698, duration: 0.4, startTime: 4.45, type: 'square', volume: 0.1 },
    { freq: 698, duration: 0.4, startTime: 4.9, type: 'square', volume: 0.1 },
    { freq: 587, duration: 0.3, startTime: 5.35, type: 'square', volume: 0.1 },
    { freq: 784, duration: 0.15, startTime: 5.7, type: 'square', volume: 0.1 },
    { freq: 698, duration: 0.4, startTime: 5.9, type: 'square', volume: 0.1 },
    { freq: 587, duration: 0.3, startTime: 6.35, type: 'square', volume: 0.1 },
    { freq: 784, duration: 0.15, startTime: 6.7, type: 'square', volume: 0.1 },
    { freq: 698, duration: 0.8, startTime: 6.9, type: 'square', volume: 0.1 },
  ];
  playMelody(notes);
}

/** 🎮 Game Over — Classic descending tones */
export function playGameOver() {
  const notes: Note[] = [
    { freq: 523, duration: 0.3, startTime: 0, type: 'square', volume: 0.12 },
    { freq: 494, duration: 0.3, startTime: 0.35, type: 'square', volume: 0.12 },
    { freq: 440, duration: 0.3, startTime: 0.7, type: 'square', volume: 0.12 },
    { freq: 392, duration: 0.3, startTime: 1.05, type: 'square', volume: 0.12 },
    { freq: 349, duration: 0.3, startTime: 1.4, type: 'square', volume: 0.12 },
    { freq: 330, duration: 0.3, startTime: 1.75, type: 'square', volume: 0.12 },
    { freq: 262, duration: 0.6, startTime: 2.1, type: 'square', volume: 0.15 },
  ];
  playMelody(notes);
}

/** 🎵 Random happy melody */
export function playHappyMelody() {
  const notes: Note[] = [];
  const freqs = [523, 587, 659, 698, 784, 880, 988, 1047];
  for (let i = 0; i < 8; i++) {
    notes.push({
      freq: freqs[Math.floor(Math.random() * freqs.length)],
      duration: 0.15,
      startTime: i * 0.2,
      type: 'square',
      volume: 0.1,
    });
  }
  playMelody(notes);
}

/** 🎸 Rock Riff — Simple power chord */
export function playRockRiff() {
  const notes: Note[] = [
    { freq: 110, duration: 0.3, startTime: 0, type: 'sawtooth', volume: 0.12 },
    { freq: 220, duration: 0.3, startTime: 0, type: 'sawtooth', volume: 0.08 },
    { freq: 330, duration: 0.3, startTime: 0, type: 'sawtooth', volume: 0.06 },
    { freq: 0, duration: 0.2, startTime: 0.3 },
    { freq: 98, duration: 0.3, startTime: 0.5, type: 'sawtooth', volume: 0.12 },
    { freq: 196, duration: 0.3, startTime: 0.5, type: 'sawtooth', volume: 0.08 },
    { freq: 294, duration: 0.3, startTime: 0.5, type: 'sawtooth', volume: 0.06 },
    { freq: 0, duration: 0.2, startTime: 0.8 },
    { freq: 130, duration: 0.5, startTime: 1.0, type: 'sawtooth', volume: 0.15 },
    { freq: 261, duration: 0.5, startTime: 1.0, type: 'sawtooth', volume: 0.1 },
    { freq: 392, duration: 0.5, startTime: 1.0, type: 'sawtooth', volume: 0.08 },
  ];
  playMelody(notes);
}


/** ⚡ Pokemon Theme — Gotta Catch 'Em All opening riff */
export function playPokemonTheme() {
  const notes: Note[] = [
    { freq: 659, duration: 0.15, startTime: 0, type: 'square', volume: 0.1 },       // E5
    { freq: 784, duration: 0.15, startTime: 0.18, type: 'square', volume: 0.1 },     // G5
    { freq: 523, duration: 0.15, startTime: 0.36, type: 'square', volume: 0.1 },     // C5
    { freq: 587, duration: 0.15, startTime: 0.54, type: 'square', volume: 0.1 },     // D5
    { freq: 659, duration: 0.3, startTime: 0.72, type: 'square', volume: 0.12 },     // E5
    { freq: 0, duration: 0.15, startTime: 1.02, type: 'square' },
    { freq: 659, duration: 0.15, startTime: 1.17, type: 'square', volume: 0.1 },     // E5
    { freq: 784, duration: 0.15, startTime: 1.35, type: 'square', volume: 0.1 },     // G5
    { freq: 523, duration: 0.15, startTime: 1.53, type: 'square', volume: 0.1 },     // C5
    { freq: 587, duration: 0.15, startTime: 1.71, type: 'square', volume: 0.1 },     // D5
    { freq: 659, duration: 0.3, startTime: 1.89, type: 'square', volume: 0.12 },     // E5
    { freq: 0, duration: 0.15, startTime: 2.19, type: 'square' },
    { freq: 523, duration: 0.2, startTime: 2.34, type: 'square', volume: 0.1 },      // C5
    { freq: 659, duration: 0.2, startTime: 2.58, type: 'square', volume: 0.1 },      // E5
    { freq: 440, duration: 0.2, startTime: 2.82, type: 'square', volume: 0.1 },      // A4
    { freq: 523, duration: 0.2, startTime: 3.06, type: 'square', volume: 0.1 },      // C5
    { freq: 392, duration: 0.2, startTime: 3.3, type: 'square', volume: 0.1 },       // G4
    { freq: 494, duration: 0.2, startTime: 3.54, type: 'square', volume: 0.1 },      // B4
    { freq: 587, duration: 0.2, startTime: 3.78, type: 'square', volume: 0.1 },      // D5
    { freq: 784, duration: 0.4, startTime: 4.02, type: 'square', volume: 0.12 },     // G5
    { freq: 0, duration: 0.2, startTime: 4.42, type: 'square' },
    { freq: 659, duration: 0.15, startTime: 4.62, type: 'square', volume: 0.1 },     // E5
    { freq: 784, duration: 0.15, startTime: 4.8, type: 'square', volume: 0.1 },      // G5
    { freq: 1047, duration: 0.5, startTime: 5.0, type: 'square', volume: 0.15 },     // C6
  ];
  playMelody(notes);
}

/** 🗡️ Zelda Overworld — Classic Hyrule field theme */
export function playZeldaTheme() {
  const notes: Note[] = [
    { freq: 494, duration: 0.2, startTime: 0, type: 'square', volume: 0.1 },         // B4
    { freq: 659, duration: 0.25, startTime: 0.25, type: 'square', volume: 0.12 },    // E5
    { freq: 740, duration: 0.15, startTime: 0.55, type: 'square', volume: 0.1 },     // F#5
    { freq: 784, duration: 0.15, startTime: 0.75, type: 'square', volume: 0.1 },     // G5
    { freq: 740, duration: 0.15, startTime: 0.95, type: 'square', volume: 0.1 },     // F#5
    { freq: 659, duration: 0.25, startTime: 1.15, type: 'square', volume: 0.12 },    // E5
    { freq: 494, duration: 0.2, startTime: 1.45, type: 'square', volume: 0.1 },      // B4
    { freq: 0, duration: 0.15, startTime: 1.65, type: 'square' },
    { freq: 659, duration: 0.2, startTime: 1.8, type: 'square', volume: 0.1 },       // E5
    { freq: 740, duration: 0.15, startTime: 2.05, type: 'square', volume: 0.1 },     // F#5
    { freq: 784, duration: 0.15, startTime: 2.25, type: 'square', volume: 0.1 },     // G5
    { freq: 740, duration: 0.15, startTime: 2.45, type: 'square', volume: 0.1 },     // F#5
    { freq: 659, duration: 0.2, startTime: 2.65, type: 'square', volume: 0.1 },      // E5
    { freq: 0, duration: 0.15, startTime: 2.85, type: 'square' },
    { freq: 587, duration: 0.2, startTime: 3.0, type: 'square', volume: 0.1 },       // D5
    { freq: 784, duration: 0.2, startTime: 3.25, type: 'square', volume: 0.12 },     // G5
    { freq: 880, duration: 0.15, startTime: 3.5, type: 'square', volume: 0.1 },      // A5
    { freq: 988, duration: 0.2, startTime: 3.7, type: 'square', volume: 0.12 },      // B5
    { freq: 784, duration: 0.2, startTime: 3.95, type: 'square', volume: 0.1 },      // G5
    { freq: 587, duration: 0.2, startTime: 4.2, type: 'square', volume: 0.1 },       // D5
    { freq: 784, duration: 0.2, startTime: 4.45, type: 'square', volume: 0.1 },      // G5
    { freq: 880, duration: 0.15, startTime: 4.7, type: 'square', volume: 0.1 },      // A5
    { freq: 784, duration: 0.4, startTime: 4.9, type: 'square', volume: 0.15 },      // G5
  ];
  playMelody(notes);
}

/** ⛏️ Minecraft Sweden — C418 calm piano melody */
export function playMinecraftTheme() {
  const notes: Note[] = [
    { freq: 370, duration: 0.35, startTime: 0, type: 'triangle', volume: 0.15 },     // F#4
    { freq: 440, duration: 0.35, startTime: 0.4, type: 'triangle', volume: 0.15 },   // A4
    { freq: 554, duration: 0.35, startTime: 0.8, type: 'triangle', volume: 0.15 },   // C#5
    { freq: 659, duration: 0.5, startTime: 1.2, type: 'triangle', volume: 0.18 },    // E5
    { freq: 0, duration: 0.2, startTime: 1.7, type: 'triangle' },
    { freq: 440, duration: 0.3, startTime: 1.9, type: 'triangle', volume: 0.12 },    // A4
    { freq: 554, duration: 0.3, startTime: 2.25, type: 'triangle', volume: 0.12 },   // C#5
    { freq: 659, duration: 0.3, startTime: 2.6, type: 'triangle', volume: 0.12 },    // E5
    { freq: 880, duration: 0.6, startTime: 2.95, type: 'triangle', volume: 0.2 },    // A5
    { freq: 0, duration: 0.3, startTime: 3.55, type: 'triangle' },
    { freq: 415, duration: 0.35, startTime: 3.85, type: 'triangle', volume: 0.15 },  // G#4
    { freq: 494, duration: 0.35, startTime: 4.25, type: 'triangle', volume: 0.15 },  // B4
    { freq: 659, duration: 0.35, startTime: 4.65, type: 'triangle', volume: 0.15 },  // E5
    { freq: 831, duration: 0.5, startTime: 5.05, type: 'triangle', volume: 0.18 },   // G#5
    { freq: 0, duration: 0.2, startTime: 5.55, type: 'triangle' },
    { freq: 494, duration: 0.3, startTime: 5.75, type: 'triangle', volume: 0.12 },   // B4
    { freq: 659, duration: 0.3, startTime: 6.1, type: 'triangle', volume: 0.12 },    // E5
    { freq: 831, duration: 0.3, startTime: 6.45, type: 'triangle', volume: 0.12 },   // G#5
    { freq: 988, duration: 0.8, startTime: 6.8, type: 'triangle', volume: 0.22 },    // B5
  ];
  playMelody(notes);
}

/** 🧙 Harry Potter — Hedwig's Theme magical celesta */
export function playHarryPotterTheme() {
  const notes: Note[] = [
    { freq: 659, duration: 0.2, startTime: 0, type: 'triangle', volume: 0.12 },      // E5
    { freq: 784, duration: 0.2, startTime: 0.25, type: 'triangle', volume: 0.12 },   // G5
    { freq: 988, duration: 0.25, startTime: 0.5, type: 'triangle', volume: 0.15 },   // B5
    { freq: 880, duration: 0.15, startTime: 0.8, type: 'triangle', volume: 0.12 },   // A5
    { freq: 784, duration: 0.15, startTime: 1.0, type: 'triangle', volume: 0.1 },    // G5
    { freq: 659, duration: 0.3, startTime: 1.2, type: 'triangle', volume: 0.12 },    // E5
    { freq: 0, duration: 0.15, startTime: 1.5, type: 'triangle' },
    { freq: 784, duration: 0.2, startTime: 1.65, type: 'triangle', volume: 0.12 },   // G5
    { freq: 988, duration: 0.25, startTime: 1.9, type: 'triangle', volume: 0.15 },   // B5
    { freq: 880, duration: 0.15, startTime: 2.2, type: 'triangle', volume: 0.12 },   // A5
    { freq: 784, duration: 0.15, startTime: 2.4, type: 'triangle', volume: 0.1 },    // G5
    { freq: 659, duration: 0.3, startTime: 2.6, type: 'triangle', volume: 0.12 },    // E5
    { freq: 0, duration: 0.15, startTime: 2.9, type: 'triangle' },
    { freq: 587, duration: 0.2, startTime: 3.05, type: 'triangle', volume: 0.1 },    // D5
    { freq: 784, duration: 0.2, startTime: 3.3, type: 'triangle', volume: 0.12 },    // G5
    { freq: 988, duration: 0.25, startTime: 3.55, type: 'triangle', volume: 0.15 },  // B5
    { freq: 880, duration: 0.15, startTime: 3.85, type: 'triangle', volume: 0.12 },  // A5
    { freq: 784, duration: 0.15, startTime: 4.05, type: 'triangle', volume: 0.1 },   // G5
    { freq: 659, duration: 0.3, startTime: 4.25, type: 'triangle', volume: 0.12 },   // E5
    { freq: 0, duration: 0.2, startTime: 4.55, type: 'triangle' },
    { freq: 523, duration: 0.2, startTime: 4.75, type: 'triangle', volume: 0.1 },    // C5
    { freq: 587, duration: 0.2, startTime: 5.0, type: 'triangle', volume: 0.1 },     // D5
    { freq: 659, duration: 0.2, startTime: 5.25, type: 'triangle', volume: 0.1 },    // E5
    { freq: 784, duration: 0.2, startTime: 5.5, type: 'triangle', volume: 0.1 },     // G5
    { freq: 659, duration: 0.2, startTime: 5.75, type: 'triangle', volume: 0.1 },    // E5
    { freq: 588, duration: 0.4, startTime: 6.0, type: 'triangle', volume: 0.15 },    // D5
  ];
  playMelody(notes);
}

/** 🍜 Naruto — Sadness and Sorrow (shamisen style) */
export function playNarutoTheme() {
  const notes: Note[] = [
    { freq: 440, duration: 0.3, startTime: 0, type: 'sine', volume: 0.12 },          // A4
    { freq: 523, duration: 0.25, startTime: 0.35, type: 'sine', volume: 0.12 },      // C5
    { freq: 659, duration: 0.25, startTime: 0.65, type: 'sine', volume: 0.12 },      // E5
    { freq: 880, duration: 0.4, startTime: 0.95, type: 'sine', volume: 0.15 },       // A5
    { freq: 784, duration: 0.2, startTime: 1.4, type: 'sine', volume: 0.1 },         // G5
    { freq: 659, duration: 0.2, startTime: 1.65, type: 'sine', volume: 0.1 },        // E5
    { freq: 523, duration: 0.2, startTime: 1.9, type: 'sine', volume: 0.1 },         // C5
    { freq: 440, duration: 0.4, startTime: 2.15, type: 'sine', volume: 0.12 },       // A4
    { freq: 0, duration: 0.2, startTime: 2.55, type: 'sine' },
    { freq: 494, duration: 0.3, startTime: 2.75, type: 'sine', volume: 0.12 },       // B4
    { freq: 659, duration: 0.25, startTime: 3.1, type: 'sine', volume: 0.12 },       // E5
    { freq: 831, duration: 0.25, startTime: 3.4, type: 'sine', volume: 0.12 },       // G#5
    { freq: 988, duration: 0.4, startTime: 3.7, type: 'sine', volume: 0.15 },        // B5
    { freq: 880, duration: 0.2, startTime: 4.15, type: 'sine', volume: 0.1 },        // A5
    { freq: 831, duration: 0.2, startTime: 4.4, type: 'sine', volume: 0.1 },         // G#5
    { freq: 659, duration: 0.2, startTime: 4.65, type: 'sine', volume: 0.1 },        // E5
    { freq: 494, duration: 0.4, startTime: 4.9, type: 'sine', volume: 0.12 },        // B4
    { freq: 0, duration: 0.2, startTime: 5.3, type: 'sine' },
    { freq: 440, duration: 0.3, startTime: 5.5, type: 'sine', volume: 0.1 },         // A4
    { freq: 523, duration: 0.25, startTime: 5.85, type: 'sine', volume: 0.1 },       // C5
    { freq: 659, duration: 0.25, startTime: 6.15, type: 'sine', volume: 0.1 },       // E5
    { freq: 784, duration: 0.4, startTime: 6.45, type: 'sine', volume: 0.15 },       // G5
    { freq: 880, duration: 0.5, startTime: 6.85, type: 'sine', volume: 0.18 },       // A5
  ];
  playMelody(notes);
}

// ==================== JUKEBOX DISPATCH ====================

interface SongEntry {
  keywords: string[];
  play: () => void;
  title: string;
  emoji: string;
}

export const jukeboxSongs: SongEntry[] = [
  { keywords: ['mario', 'super mario'], play: playMarioTheme, title: 'Super Mario', emoji: '🍄' },
  { keywords: ['tetris', 'korobeiniki'], play: playTetrisTheme, title: 'Tetris', emoji: '🧱' },
  { keywords: ['happy birthday', 'birthday', 'ultah', 'ulang tahun'], play: playHappyBirthday, title: 'Happy Birthday', emoji: '🎂' },
  { keywords: ['fanfare', 'epic', 'victory', 'menang', 'triumph'], play: playEpicFanfare, title: 'Epic Fanfare', emoji: '📯' },
  { keywords: ['jingle bells', 'jingle', 'natal', 'christmas'], play: playJingleBells, title: 'Jingle Bells', emoji: '🎄' },
  { keywords: ['among us', 'amongus', 'sus', 'impostor', 'crewmate'], play: playAmongUsTheme, title: 'Among Us', emoji: '👾' },
  { keywords: ['imperial march', 'star wars', 'darth vader', 'vader', 'sith'], play: playImperialMarch, title: 'Imperial March', emoji: '🚀' },
  { keywords: ['game over', 'gameover', 'mati', 'kalah', 'dead'], play: playGameOver, title: 'Game Over', emoji: '💀' },
  { keywords: ['happy', 'ceria', 'senang', 'gembira'], play: playHappyMelody, title: 'Happy Random', emoji: '🎵' },
  { keywords: ['rock', 'riff', 'gitar', 'guitar', 'metal'], play: playRockRiff, title: 'Rock Riff', emoji: '🎸' },
  { keywords: ['pokemon', 'pikachu', 'pokémon', 'gotta catch'], play: playPokemonTheme, title: 'Pokemon Theme', emoji: '⚡' },
  { keywords: ['zelda', 'hyrule', 'link', 'overworld'], play: playZeldaTheme, title: 'Zelda Overworld', emoji: '🗡️' },
  { keywords: ['minecraft', 'sweden', 'c418', 'creeper', 'steve'], play: playMinecraftTheme, title: 'Minecraft Sweden', emoji: '⛏️' },
  { keywords: ['harry potter', 'harry', 'potter', 'hedwig', 'hogwarts', 'magic', 'sihir'], play: playHarryPotterTheme, title: 'Harry Potter', emoji: '🧙' },
  { keywords: ['naruto', 'sasuke', 'sakura', 'kakashi', 'sadness', 'hokage', 'rasengan'], play: playNarutoTheme, title: 'Naruto Sadness', emoji: '🍜' },
];

/**
 * Try to play a song matching the given text.
 * Returns the song title if found, null otherwise.
 */
export function playJukebox(text: string): { title: string; emoji: string } | null {
  const lower = text.toLowerCase().trim();

  // Cooldown — prevent spam overlapping
  const now = Date.now();
  if (now - lastPlayTime < JUKEBOX_COOLDOWN_MS) return null;
  lastPlayTime = now;

  // Check for "music" or "play" prefix
  const match = lower.match(/^(?:music|play|mainkan|putar)\s+(.+)/);
  if (!match) return null;

  const query = match[1].trim();
  if (!query) return null;

  // Try to find a matching song
  for (const song of jukeboxSongs) {
    if (song.keywords.some(k => query.includes(k))) {
      song.play();
      return { title: song.title, emoji: song.emoji };
    }
  }

  // No match — play random happy melody
  playHappyMelody();
  return { title: 'Random', emoji: '🎵' };
}

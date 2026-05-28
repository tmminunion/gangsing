/**
 * Web Audio API synthesizer for TikTok gift sound effects.
 * No audio files needed — all sounds are generated in real-time.
 * All note sequences use the `startTime` parameter for clean scheduling,
 * avoiding setTimeout accumulation issues during rapid-fire gift events.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      // Web Audio API not available — silently ignore
      // Return a dummy object that won't break calls
      return null as unknown as AudioContext;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Short helper: play a single frequency tone with envelope */
function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  startTime = 0,
) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration);
  } catch {
    // Ignore audio errors silently
  }
}

/** Play a short ascending arpeggio (cheerful power-up) */
function playArpeggio(baseFreq: number, duration: number, type: OscillatorType = 'sine', volume = 0.12) {
  const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];
  notes.forEach((f, i) => playTone(f, duration / 4, type, volume, i * duration * 0.15));
}

/** White noise burst */
function playNoise(duration: number, volume = 0.08) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    // Ignore audio errors silently
  }
}

// ==================== GIFT SOUND EFFECTS ====================

/** 🌹 Rose — Gentle chime (crescendo with amount) */
export function playRoseSound(amount = 1) {
  for (let i = 0; i < Math.min(amount, 5); i++) {
    playTone(523 + i * 50, 0.3 + i * 0.05, 'sine', 0.12, i * 0.1);
  }
}

/** 🫰 Finger Heart — Soft bubble pop */
export function playHeartSound() {
  playTone(880, 0.15, 'sine', 0.1, 0);
  playTone(1100, 0.2, 'sine', 0.08, 0.08);
}

/** 🍦 Ice Cream — Ice crackle */
export function playIceCreamSound() {
  playNoise(0.3, 0.06);
  playTone(1200, 0.1, 'triangle', 0.05, 0);
  playTone(800, 0.15, 'triangle', 0.04, 0.1);
}

/** 🎵 TikTok — Tech laser */
export function playTikTokSound() {
  playTone(400, 0.1, 'sawtooth', 0.08, 0);
  playTone(800, 0.1, 'sawtooth', 0.07, 0.06);
  playTone(1200, 0.2, 'square', 0.06, 0.12);
}

/** 🍩 Donut — Power-up jingle */
export function playDonutSound() {
  playArpeggio(440, 0.6, 'sine', 0.12);
}

/** 💝 Hand Heart — Heart thump */
export function playHandHeartSound() {
  playTone(110, 0.25, 'sine', 0.15, 0);
  playTone(130, 0.3, 'sine', 0.12, 0.15);
  playTone(165, 0.2, 'sine', 0.1, 0.3);
}

/** 💌 Love Letter — Romantic harp */
export function playLoveLetterSound() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => playTone(f, 0.4, 'sine', 0.1, i * 0.12));
}

/** 🍭 Cotton Candy — Sparkle */
export function playCottonCandySound() {
  for (let i = 0; i < 6; i++) {
    playTone(600 + Math.random() * 800, 0.08, 'sine', 0.06, i * 0.06);
  }
}

/** 🥺 Cute Face — Quirky random sound */
export function playCuteFaceSound() {
  const r = Math.random();
  if (r < 0.33) playTone(300, 0.15, 'square', 0.08);
  else if (r < 0.66) playTone(900, 0.1, 'sawtooth', 0.06);
  else {
    playNoise(0.1, 0.04);
    playTone(600, 0.2, 'triangle', 0.07);
  }
}

/** 🎁 Box/Crate — Heavy metal */
export function playBoxSound() {
  playTone(80, 0.4, 'sawtooth', 0.15, 0);
  playNoise(0.15, 0.08);
  playTone(200, 0.2, 'square', 0.1, 0.1);
}

/** ⭐ Star — Twinkle burst */
export function playStarSound() {
  for (let i = 0; i < 4; i++) {
    playTone(800 + i * 200, 0.2, 'sine', 0.1, i * 0.08);
  }
}

/** 💎 Diamond — Crystal chime */
export function playDiamondSound() {
  const notes = [1047, 1319, 1568, 2093];
  notes.forEach((f, i) => playTone(f, 0.5, 'sine', 0.08, i * 0.1));
  playNoise(0.3, 0.06);
}

/** 🌈 Rainbow — Magical harp */
export function playRainbowSound() {
  const notes = [659, 784, 880, 1047, 1175, 1319, 1397, 1568];
  notes.forEach((f, i) => playTone(f, 0.3, 'sine', 0.07, i * 0.06));
}

/** 🌙 Moon — Mysterious ambient */
export function playMoonSound() {
  playTone(220, 0.6, 'sine', 0.08, 0);
  playTone(330, 0.5, 'triangle', 0.06, 0.2);
  playTone(440, 0.4, 'sine', 0.05, 0.4);
}

/** 👑 Crown — Fanfare */
export function playCrownSound() {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => playTone(f, 0.3, 'sine', 0.12, i * 0.12));
}

/** 🚀 Galaxy — Deep boom */
export function playGalaxySound() {
  playTone(60, 0.8, 'sawtooth', 0.18, 0);
  playNoise(0.4, 0.1);
  playTone(120, 0.4, 'sine', 0.08, 0.2);
}

/** 🎆 Firework — Explosion + crackle */
export function playFireworkSound() {
  playNoise(0.6, 0.15);
  playTone(40, 0.5, 'sawtooth', 0.2, 0);
  for (let i = 0; i < 8; i++) {
    playTone(200 + Math.random() * 2000, 0.08, 'sine', 0.05, 0.2 + i * 0.04);
  }
}

/** 💳 Black Card — Dark thud */
export function playBlackCardSound() {
  playTone(50, 0.5, 'sawtooth', 0.15, 0);
  playTone(100, 0.3, 'square', 0.1, 0.15);
  playTone(200, 0.2, 'sawtooth', 0.08, 0.3);
}

/** 🚀 Rocket — Swoosh */
export function playRocketSound() {
  playNoise(0.4, 0.1);
  playTone(200, 0.1, 'sawtooth', 0.08, 0);
  playTone(400, 0.1, 'sawtooth', 0.07, 0.05);
  playTone(800, 0.2, 'sawtooth', 0.06, 0.1);
  playNoise(0.3, 0.12);
}

/** 🦖 T-Rex — Monster roar */
export function playTRexSound() {
  playTone(80, 0.6, 'sawtooth', 0.2, 0);
  playTone(60, 0.5, 'square', 0.15, 0.15);
  playTone(40, 0.8, 'sawtooth', 0.18, 0.3);
  playNoise(0.5, 0.1);
}

/** 🦁 Lion — Roar */
export function playLionSound() {
  playTone(100, 0.5, 'sawtooth', 0.18, 0);
  playTone(80, 0.4, 'square', 0.14, 0.12);
  playNoise(0.3, 0.08);
  playTone(120, 0.6, 'sawtooth', 0.12, 0.3);
}

/** 🛸 Spaceship — Sci-fi beam */
export function playSpaceshipSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.5);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
    playNoise(0.4, 0.1);
  } catch {
    // ignore
  }
}

/** 🌌 Universe — Epic crescendo */
export function playUniverseSound() {
  const notes = [262, 330, 392, 523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => playTone(f, 0.4, 'sine', 0.1 + i * 0.01, i * 0.08));
  playNoise(0.8, 0.12);
  
  // Final dramatic sweep
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 1.0);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // ignore
  }
}

/**
 * Play a sound effect based on gift name (alias matching).
 * Maps gift name keywords to the appropriate sound function.
 * Wrapped in try/catch so audio errors never break the gift pipeline.
 */
export function playGiftSound(giftName: string | undefined, amount = 1) {
  try {
    if (!giftName) return;

    const lower = giftName.toLowerCase();

    if (lower.includes('rose') || lower.includes('mawar')) {
      playRoseSound(amount);
    } else if (lower.includes('hand heart') || lower.includes('love hug')) {
      playHandHeartSound();
    } else if (lower.includes('heart') || lower.includes('cinta') || lower.includes('cubit')) {
      playHeartSound();
    } else if (lower.includes('ice') || lower.includes('es krim') || lower.includes('icecream')) {
      playIceCreamSound();
    } else if (lower.includes('tiktok') || lower.includes('logo')) {
      playTikTokSound();
    } else if (lower.includes('donut') || lower.includes('donat')) {
      playDonutSound();
    } else if (lower.includes('love letter') || lower.includes('surat cinta')) {
      playLoveLetterSound();
    } else if (lower.includes('cotton candy') || lower.includes('permen kapas') || lower.includes('candy')) {
      playCottonCandySound();
    } else if (lower.includes('cute face') || lower.includes('wajah imut')) {
      playCuteFaceSound();
    } else if (lower.includes('box') || lower.includes('crate') || lower.includes('kado') || lower.includes('hadiah')) {
      playBoxSound();
    } else if (lower.includes('star') || lower.includes('bintang')) {
      playStarSound();
    } else if (lower.includes('diamond') || lower.includes('berlian') || lower.includes('intan')) {
      playDiamondSound();
    } else if (lower.includes('rainbow') || lower.includes('pelangi')) {
      playRainbowSound();
    } else if (lower.includes('moon') || lower.includes('bulan')) {
      playMoonSound();
    } else if (lower.includes('crown') || lower.includes('mahkota')) {
      playCrownSound();
    } else if (lower.includes('galaxy') || lower.includes('galaksi')) {
      playGalaxySound();
    } else if (lower.includes('firework') || lower.includes('kembang api')) {
      playFireworkSound();
    } else if (lower.includes('black card') || lower.includes('kartu hitam')) {
      playBlackCardSound();
    } else if (lower.includes('rocket') || lower.includes('roket') || lower.includes('missile')) {
      playRocketSound();
    } else if (lower.includes('t-rex') || lower.includes('trex') || lower.includes('tyrannosaurus') || lower.includes('dinosaurus')) {
      playTRexSound();
    } else if (lower.includes('lion') || lower.includes('singa') || lower.includes('leo')) {
      playLionSound();
    } else if (lower.includes('spaceship') || lower.includes('pesawat luar') || lower.includes('ufo')) {
      playSpaceshipSound();
    } else if (lower.includes('universe') || lower.includes('semesta') || lower.includes('alam semesta') || lower.includes('cosmos')) {
      playUniverseSound();
    } else {
      // Fallback: generic gift sound
      playArpeggio(440, 0.4, 'sine', 0.08);
    }
  } catch {
    // Audio errors never break the gift pipeline
  }
}

// ==================== CLASH / COLLISION SOUND EFFECTS ====================

/** 🥊 Light clash — small players tapping (high pitch, soft metallic click) */
export function playClashLightSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(1200, 0.08, 'sine', 0.06, 0);
    playTone(1500, 0.06, 'triangle', 0.04, 0.02);
    playNoise(0.04, 0.03);
  } catch {}
}

/** 🥊 Medium clash — standard collision (metallic thwack + ping) */
export function playClashMediumSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(600, 0.15, 'square', 0.12, 0);
    playTone(800, 0.1, 'triangle', 0.08, 0.03);
    playNoise(0.08, 0.06);
    playTone(200, 0.2, 'sine', 0.1, 0.05);
  } catch {}
}

/** 💥 Heavy clash — big players/elite collision (deep boom + crack + metal grind) */
export function playClashHeavySound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(80, 0.5, 'sawtooth', 0.2, 0);
    playTone(120, 0.4, 'square', 0.15, 0.05);
    playNoise(0.25, 0.12);
    playTone(400, 0.12, 'square', 0.1, 0.08);
    playTone(60, 0.6, 'sawtooth', 0.16, 0.1);
    // Low rumble tail
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(30, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch {}
}

// ==================== PARRY/CLASH SOUND EFFECT ====================

/** ⚔️ Perfect Parry — Epic metallic clang for high-speed clash */
export function playParryClashSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // Sharp metallic impact
    playTone(800, 0.08, 'square', 0.15, 0);
    playTone(1200, 0.06, 'square', 0.12, 0.02);
    playTone(400, 0.2, 'square', 0.18, 0.03);
    playNoise(0.15, 0.1);
    // Resonant sustain
    playTone(600, 0.3, 'sine', 0.1, 0.05);
    playTone(900, 0.25, 'triangle', 0.08, 0.08);
    // High ring
    playTone(1500, 0.4, 'sine', 0.06, 0.1);
    // Low rumble underneath
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

// ==================== BOSS ATTACK SOUND EFFECTS ====================

/** 🐉 KRAKEN Laser Beam — Sci-fi laser sweep */
export function playBossLaserSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // Core laser sweep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(300, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
    osc1.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.8);
    gain1.gain.setValueAtTime(0.1, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.8);
    // Laser buzz
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(80, ctx.currentTime);
    gain2.gain.setValueAtTime(0.06, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.5);
    playNoise(0.3, 0.08);
  } catch {}
}

/** 🐉 CYBER DRAGON Ground Pound — Deep boom + rumble */
export function playBossPoundSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(40, 0.6, 'sawtooth', 0.2, 0);
    playTone(55, 0.5, 'square', 0.14, 0.05);
    playTone(30, 0.8, 'sawtooth', 0.16, 0.1);
    playNoise(0.5, 0.12);
    // Low rumble tail
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(20, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.0);
  } catch {}
}

/** 🐉 TITAN Summon — Magical portal opening */
export function playBossSummonSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // Portal opening sweep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(200, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.4);
    osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.6);
    gain1.gain.setValueAtTime(0.1, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.7);
    // Sparkle
    for (let i = 0; i < 6; i++) {
      playTone(1000 + Math.random() * 1500, 0.06, 'sine', 0.05, i * 0.08);
    }
    playArpeggio(440, 0.5, 'sine', 0.1);
  } catch {}
}

/** 🐉 RAJA GANGSING Vortex — Wind swirling */
export function playBossVortexSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(300, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.3);
    osc1.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.6);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.8);
    // Wind noise
    playNoise(0.6, 0.06);
    playTone(120, 0.4, 'triangle', 0.06, 0);
    playTone(180, 0.3, 'triangle', 0.04, 0.2);
  } catch {}
}

/** 🐉 MECHA MONSTER Missile — Explosion */
export function playBossMissileSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // Missile whoosh
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(400, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.3);
    // Explosion
    playTone(60, 0.5, 'sawtooth', 0.18, 0.15);
    playNoise(0.4, 0.12);
    // Debris tinkle
    for (let i = 0; i < 4; i++) {
      playTone(200 + Math.random() * 800, 0.08, 'sine', 0.04, 0.2 + i * 0.05);
    }
  } catch {}
}

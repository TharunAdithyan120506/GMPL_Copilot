/**
 * sound.ts — Lightweight notification sound engine
 *
 * Uses the Web Audio API to synthesize clean UI sounds.
 * No external files needed — all tones generated in-browser.
 *
 * Usage:
 *   import { playSound } from '../lib/sound';
 *   playSound('success');   // soft chime
 *   playSound('error');     // low warning tone
 *   playSound('warning');   // mid alert tone
 *   playSound('info');      // neutral click
 *   playSound('submit');    // satisfying completion chime
 *   playSound('notify');    // bell for incoming notifications
 */

type SoundType = 'success' | 'error' | 'warning' | 'info' | 'submit' | 'notify';

// Singleton AudioContext — created once on first call (requires user gesture)
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ctx) {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browsers auto-suspend if no recent user gesture)
    if (_ctx.state === 'suspended') {
      _ctx.resume().catch(() => {});
    }
    return _ctx;
  } catch {
    return null;
  }
}

/**
 * Play a short synthesized UI sound.
 * Silently no-ops if Web Audio is unavailable or user has muted.
 */
export function playSound(type: SoundType): void {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (type) {
    case 'success':
      // Two-note ascending chime — satisfying confirmation
      playTone(ctx, 523, 0.12, now, 0.08);         // C5
      playTone(ctx, 659, 0.10, now + 0.10, 0.12);  // E5
      break;

    case 'submit':
      // Three-note ascending — completion chime
      playTone(ctx, 523, 0.10, now, 0.07);          // C5
      playTone(ctx, 659, 0.09, now + 0.08, 0.07);  // E5
      playTone(ctx, 784, 0.11, now + 0.18, 0.18);  // G5
      break;

    case 'error':
      // Low descending two-tone — immediate attention
      playTone(ctx, 311, 0.13, now, 0.10, 'sawtooth');        // Eb4
      playTone(ctx, 233, 0.11, now + 0.12, 0.15, 'sawtooth'); // Bb3
      break;

    case 'warning':
      // Single mid-range pulse
      playTone(ctx, 415, 0.12, now, 0.15, 'triangle'); // Ab4
      break;

    case 'info':
      // Short neutral click/tick
      playTone(ctx, 600, 0.08, now, 0.06);
      break;

    case 'notify':
      // Two quick bell-like pings
      playTone(ctx, 880, 0.10, now, 0.08);          // A5
      playTone(ctx, 1046, 0.08, now + 0.10, 0.12); // C6
      break;

    default:
      playTone(ctx, 600, 0.08, now, 0.06);
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  gain: number,
  startAt: number,
  duration: number,
  type: OscillatorType = 'sine',
): void {
  try {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);

    // Smooth fade-in and fade-out to avoid clicks
    gainNode.gain.setValueAtTime(0, startAt);
    gainNode.gain.linearRampToValueAtTime(gain, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  } catch {
    // Web Audio errors should never crash the app
  }
}

/**
 * Primes the AudioContext on first user interaction.
 * Call this once in a click/tap handler anywhere in the app.
 */
export function primeAudio(): void {
  getCtx();
}

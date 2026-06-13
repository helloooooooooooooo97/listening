// ─── Lightweight Sound Effects — Web Audio API synthesis ───
// Synthesizes short game sounds with zero external audio files.

import { useCallback, useRef } from 'react';

type SoundType = 'flip' | 'chip' | 'win' | 'fold' | 'deal';

const SOUND_CONFIG: Record<SoundType, { freq: number[]; duration: number; type: OscillatorType; ramp?: 'up' | 'down' }> = {
  flip: { freq: [800, 1200], duration: 0.08, type: 'sawtooth' },
  chip: { freq: [1800, 2200], duration: 0.12, type: 'sine', ramp: 'down' },
  win: { freq: [523, 659, 784], duration: 0.4, type: 'sine', ramp: 'up' },
  fold: { freq: [400, 200], duration: 0.2, type: 'sine', ramp: 'down' },
  deal: { freq: [300, 600, 900], duration: 0.3, type: 'triangle', ramp: 'up' },
};

let _audioCtx: AudioContext | null = null;
let _ctxUnlocked = false;

function getCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

function primeAudioContext() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') void ctx.resume();
  if (_ctxUnlocked && ctx.state === 'running') return;
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    _ctxUnlocked = true;
  } catch {
    // Non-fatal — desktop Safari may not need this
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  ramp?: 'up' | 'down',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  if (ramp === 'up') {
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.12, startTime + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  } else if (ramp === 'down') {
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  } else {
    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function useSoundEffect() {
  const playingRef = useRef(false);

  const play = useCallback((type: SoundType) => {
    if (playingRef.current) return;
    playingRef.current = true;

    try {
      primeAudioContext();
      const ctx = getCtx();
      const cfg = SOUND_CONFIG[type];
      const now = ctx.currentTime;

      cfg.freq.forEach((f, i) => {
        playTone(ctx, f, now + i * 0.06, cfg.duration, cfg.type, cfg.ramp);
      });

      const totalDuration = cfg.duration + (cfg.freq.length - 1) * 0.06;
      setTimeout(() => { playingRef.current = false; }, totalDuration * 1000 + 50);
    } catch {
      playingRef.current = false;
    }
  }, []);

  return { play };
}

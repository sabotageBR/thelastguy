// Efeitos sonoros sintetizados (docs/design/apresentacao.md §6.2).
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const C4 = 60;

export class Sfx {
  constructor(engine) {
    this.e = engine;
    this.botBudget = 0;
    this.botT = 0;
  }

  ok() {
    return this.e.ctx && this.e.ctx.state === 'running';
  }

  /** Evento da simulação. isFocus = personagem seguido pela câmera. */
  onEvent(ev, world, isFocus, view) {
    if (!this.ok()) return;
    const e = this.e;
    const now = e.ctx.currentTime;
    let vol = 1;
    let pan = 0;
    if (ev.slot !== undefined && !isFocus) {
      if (!view) return;
      const cx = view.x + view.w / 2;
      const d = (ev.x - cx) / (view.w / 2);
      if (Math.abs(d) > 1.2) return;
      pan = Math.max(-0.8, Math.min(0.8, d));
      vol = 0.35 * (1 - Math.min(1, Math.abs(d)) * 0.5);
      if (now - this.botT > 0.1) {
        this.botT = now;
        this.botBudget = 3;
      }
      if (this.botBudget-- <= 0) return;
    }
    switch (ev.type) {
      case 'jump':
        if (!isFocus && !e.cooldown('jumpb', 60)) break;
        e.tone({ type: 'p25', f0: 330, f1: 660, dur: 0.14, vol: 0.22 * vol, pan, detune: (Math.random() - 0.5) * 60 });
        break;
      case 'dive':
        e.noiseHit({ filter: 'bandpass', f0: 500, f1: 2500, q: 1.2, dur: 0.18, vol: 0.25 * vol });
        e.tone({ type: 'triangle', f0: 400, f1: 250, dur: 0.16, vol: 0.2 * vol, pan });
        break;
      case 'land':
        if (ev.a < 200 || !e.cooldown(isFocus ? 'land' : 'landb', 40)) break;
        e.noiseHit({ filter: 'lowpass', f0: 700, dur: 0.05, vol: 0.2 * vol });
        e.tone({ type: 'sine', f0: 140, f1: 60, dur: 0.07, vol: 0.25 * vol, pan });
        break;
      case 'hit':
        e.tone({ type: 'triangle', f0: 260, f1: 90, dur: 0.18, vol: 0.45 * vol, pan });
        e.noiseHit({ filter: 'lowpass', f0: 1200, dur: 0.09, vol: 0.35 * vol });
        e.tone({ type: 'square', f0: 900, dur: 0.02, vol: 0.12 * vol, pan });
        break;
      case 'bump':
        e.tone({ type: 'sine', f0: 180, f1: 520, dur: 0.2, vol: 0.28 * vol, pan });
        break;
      case 'trip':
      case 'thud':
        if (!e.cooldown('thud' + (isFocus ? 1 : 0), 60)) break;
        e.noiseHit({ filter: 'lowpass', f0: 500, dur: 0.08, vol: 0.22 * vol });
        break;
      case 'squash':
        e.noiseHit({ filter: 'lowpass', f0: 400, dur: 0.14, vol: 0.4 * vol });
        e.tone({ type: 'triangle', f0: 120, f1: 50, dur: 0.2, vol: 0.35 * vol, pan });
        break;
      case 'bounce':
        e.tone({ type: 'sine', f0: 180, f1: 560, dur: 0.25, vol: 0.3 * vol, pan });
        break;
      case 'fall':
        if (!isFocus) break;
        e.tone({ type: 'sine', f0: 1100, f1: 180, curve: 'lin', dur: 0.7, vol: 0.25 });
        break;
      case 'respawn':
        if (!isFocus) break;
        [523, 659, 784].forEach((f, i) => e.tone({ type: 'p50', f0: f, dur: 0.08, vol: 0.18, at: now + i * 0.06 }));
        e.noiseHit({ filter: 'highpass', f0: 4000, dur: 0.2, vol: 0.08, at: now + 0.1 });
        break;
      case 'checkpoint':
        if (!isFocus) break;
        e.tone({ type: 'triangle', f0: 1318, dur: 0.08, vol: 0.25 });
        e.tone({ type: 'triangle', f0: 1976, dur: 0.1, vol: 0.25, at: now + 0.07 });
        break;
      case 'qualified':
        if (!isFocus) break;
        [C4 + 12, C4 + 16, C4 + 19, C4 + 24].forEach((n, i) => e.tone({ type: 'p25', f0: NOTE(n), dur: 0.12, vol: 0.25, at: now + i * 0.07 }));
        e.tone({ type: 'triangle', f0: NOTE(C4), dur: 0.5, vol: 0.25 });
        break;
      case 'eliminated':
        if (!isFocus) break;
        [67, 64, 60, 55].forEach((n, i) => e.tone({ type: 'p50', f0: NOTE(n), dur: 0.16, vol: 0.22, at: now + i * 0.09 }));
        e.noiseHit({ filter: 'lowpass', f0: 300, dur: 0.2, vol: 0.2, at: now + 0.36 });
        break;
      case 'winner':
        [60, 64, 67, 72, 67, 72, 76].forEach((n, i) => e.tone({ type: 'p25', f0: NOTE(n), dur: 0.16, vol: 0.25, at: now + i * 0.1 }));
        e.tone({ type: 'triangle', f0: NOTE(48), dur: 0.8, vol: 0.3 });
        break;
      case 'countdown':
        if (ev.a > 3) break;
        e.tone({ type: 'p50', f0: 440, dur: 0.11, vol: 0.28, bus: e.uiBus });
        break;
      case 'go':
        e.tone({ type: 'p25', f0: 880, dur: 0.35, vol: 0.3, bus: e.uiBus });
        e.tone({ type: 'triangle', f0: 440, dur: 0.35, vol: 0.25, bus: e.uiBus });
        break;
      case 'crumble':
        if (!e.cooldown('crumble', 50)) break;
        e.noiseHit({ filter: 'bandpass', f0: 1500, q: 2, dur: 0.06, vol: 0.12 });
        break;
      case 'suddenDeath':
        [880, 660, 880, 660].forEach((f, i) => e.tone({ type: 'square', f0: f, dur: 0.12, vol: 0.2, at: now + i * 0.14, bus: e.uiBus }));
        break;
      default:
        break;
    }
  }

  ui(kind) {
    if (!this.ok()) return;
    const e = this.e;
    if (kind === 'click') e.tone({ type: 'p12', f0: 1250, dur: 0.035, vol: 0.18, bus: e.uiBus });
    else if (kind === 'back') e.tone({ type: 'p12', f0: 800, dur: 0.04, vol: 0.18, bus: e.uiBus });
    else if (kind === 'hover') e.tone({ type: 'triangle', f0: 1800, dur: 0.015, vol: 0.05, bus: e.uiBus });
    else if (kind === 'join') e.tone({ type: 'p25', f0: 660 + Math.random() * 200, dur: 0.05, vol: 0.08, bus: e.uiBus });
  }
}

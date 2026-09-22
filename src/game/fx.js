// Traduz eventos da simulação em efeitos: partículas, tremor, som e vibração.
import { LANE_DY } from '../core/constants.js';

export class FX {
  constructor(renderer, audio = null) {
    this.renderer = renderer;
    this.audio = audio;
    this.buf = [];
    this.vibrate = true;
    this.listeners = new Set();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Processa os eventos pendentes do mundo. */
  drain(world) {
    const evs = this.buf;
    evs.length = 0;
    world.events.drain(evs);
    const r = this.renderer;
    const P = r.particles;
    const focus = r.focus;
    for (const e of evs) {
      const c = e.slot !== undefined ? world.bySlot[e.slot] : null;
      const dy = c ? LANE_DY[c.lane] : 0;
      const isFocus = e.slot === focus;
      switch (e.type) {
        case 'jump':
          P.dust(e.x, e.y - dy, 2, c ? c.facing : 0);
          break;
        case 'land':
          if (e.a > 150) P.dust(e.x, e.y - dy, 4);
          break;
        case 'diveLand':
          P.dust(e.x, e.y - dy, 5);
          break;
        case 'hit':
          P.star(e.x, e.y - 14 - dy);
          if (isFocus) r.camera.addShake(e.a === 2 ? 0.5 : 0.3);
          break;
        case 'bump':
          P.star(e.x, e.y - 12 - dy);
          break;
        case 'squash':
          P.star(e.x, e.y - 6 - dy);
          if (isFocus) r.camera.addShake(0.4);
          break;
        case 'respawn':
          P.poof(e.x, e.y - dy);
          break;
        case 'qualified':
          P.confetti(e.x, e.y - 20 - dy, isFocus ? 50 : 12, 40);
          break;
        default:
          break;
      }
      if (this.audio) this.audio.onEvent(e, world, isFocus);
      if (isFocus && this.vibrate && navigator.vibrate) {
        if (e.type === 'hit') navigator.vibrate(25);
        else if (e.type === 'eliminated') navigator.vibrate([80, 50, 120]);
        else if (e.type === 'qualified') navigator.vibrate([20, 30, 20]);
      }
      for (const fn of this.listeners) fn(e, world);
    }
  }
}

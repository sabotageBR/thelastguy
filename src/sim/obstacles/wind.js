// Campos de força: rajadas de vento (com aviso) e ventiladores (corrente para cima).
import { Obstacle } from './base.js';
import { registerObstacle } from './index.js';
import { mod } from '../../core/dmath.js';

/**
 * def: { x, y, w, h (região), fx (px/s² horizontal), fy (px/s² vertical),
 *        drift (px/s: deriva direta, no chão e no ar — vento contra/lateral legível),
 *        on, off (s; 0 = sempre ligado), warn (s de aviso antes de ligar), kind: 'wind'|'fan',
 *        gameClock (tempos contam do VAI!), start, end (s: janela em que o vento existe) }
 */
export class Wind extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.w = def.w ?? 160;
    this.h = def.h ?? 120;
    this.fx = def.fx ?? 0;
    this.fy = def.fy ?? 0;
    this.drift = def.drift ?? 0;
    this.on = def.on ?? 0;
    this.off = def.off ?? 0;
    this.warn = def.warn ?? 0.5;
    this.groundK = def.groundK ?? 0.4;
    this.start = def.start ?? -Infinity;
    this.end = def.end ?? Infinity;
    this.depth = 'front';
  }

  /** 0 desligado, 1 aviso, 2 ligado. */
  stateAt(t) {
    if (this.def.gameClock && this.world.rules) t -= this.world.rules.countdown / 60;
    if (t < this.start) return t >= this.start - this.warn ? 1 : 0;
    if (t >= this.end) return 0;
    if (!this.on || !this.off) return 2;
    const T = this.on + this.off;
    const u = mod(t - (this.start > -Infinity ? this.start : 0) + this.phase * T, T);
    if (u < this.on) return 2;
    if (u > T - this.warn) return 1;
    return 0;
  }

  init(world) {
    const self = this;
    this.env = { x: this.x, y: this.y, w: this.w, h: this.h };
    world.addZone({
      owner: this,
      groundK: this.groundK,
      forceAt(c, t, f) {
        if (c.x < self.x || c.x > self.x + self.w || c.y - 10 < self.y || c.y - 10 > self.y + self.h) return false;
        if (self.stateAt(t) !== 2) return false;
        f.ax = self.fx;
        f.ay = self.fy;
        f.dx = self.drift;
        // ventilador: a força some perto do topo da corrente
        if (self.fy < 0) {
          const k = (c.y - self.y) / self.h;
          f.ay = self.fy * Math.max(0, Math.min(1, k * 1.4));
          if (c.vy < -260) f.ay = 0;
        }
        return true;
      },
    });
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('wind', Wind);

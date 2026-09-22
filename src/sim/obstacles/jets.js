// Perigos periódicos de chão: jatos de fogo, vapor, espinhos retráteis e piso elétrico.
// Ciclo: desligado → aviso (brilho/chacoalho) → ligado. Fases em onda (φ por jato).
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { aabbBox } from '../physics/shapes.js';
import { mod } from '../../core/dmath.js';

/**
 * def: { xs: [x...] (centros), y (chão), w (largura), height (altura do jato), on, off, warn,
 *   step (s de defasagem entre jatos), kind: 'fire'|'steam'|'spikes'|'electric', tier }
 */
export class Jets extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.xs = def.xs;
    this.gy = def.y;
    this.w = def.w ?? 16;
    this.height = def.height ?? 64;
    this.on = def.on ?? 1.0;
    this.off = def.off ?? 1.4;
    this.warn = def.warn ?? 0.5;
    this.step = def.step ?? 0.3;
    this.T = this.on + this.off;
    this.tier = def.tier || (this.kind === 'spikes' ? 'light' : 'light');
    this.depth = this.kind === 'spikes' ? 'span' : 'front';
  }

  /** Estado do jato i: 0 desligado, 1 aviso, 2 ligado; k = progresso (0..1) no estado. */
  stateAt(i, t) {
    const u = mod(t + i * this.step + this.phase * this.T, this.T);
    if (u < this.on) return 2;
    if (u > this.T - this.warn) return 1;
    return 0;
  }

  extent(i, t) {
    // os espinhos sobem rápido; o fogo "cresce" nos primeiros 0,1 s
    const u = mod(t + i * this.step + this.phase * this.T, this.T);
    if (u >= this.on) return 0;
    return Math.min(1, u / 0.1) * (u > this.on - 0.1 ? (this.on - u) / 0.1 : 1);
  }

  init(world) {
    const self = this;
    const x0 = Math.min(...this.xs) - this.w;
    const x1 = Math.max(...this.xs) + this.w;
    this.env = { x: x0, y: this.gy - this.height - 4, w: x1 - x0, h: this.height + 8 };
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        knock: 'fixed',
        dirX: 0,
        dirY: -1,
        env: this.env,
        test(box, t, out) {
          for (let i = 0; i < self.xs.length; i++) {
            if (self.stateAt(i, t) !== 2) continue;
            const h = self.height * self.extent(i, t);
            if (h < 2) continue;
            if (aabbBox(self.xs[i] - self.w / 2, self.gy - h, self.w, h, box, out)) {
              out.vx = 0;
              out.vy = -260;
              // empurra para longe do centro do jato também
              out.nx = box.x0 + box.x1 > self.xs[i] * 2 ? 0.4 : -0.4;
              out.ny = -1;
              return true;
            }
          }
          return false;
        },
      }),
    );
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('jets', Jets);

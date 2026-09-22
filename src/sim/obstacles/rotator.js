// Rotor no plano da tela: tambor no pivô com N braços girando (período T por volta).
// Variantes (def.kind): 'hammer' (cabeças cilíndricas), 'bar' (moinho: braço inteiro
// perigoso), 'firebar' (corrente de bolas de fogo), 'laser' (feixe fino), 'log' (tronco).
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { sin, cos, TAU } from '../../core/dmath.js';
import { circleBox, capsuleBox } from '../physics/shapes.js';

export class Rotator extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.L = def.length ?? 84;
    this.n = def.arms ?? 2;
    this.T = def.period ?? 6;
    this.dir = def.dir ?? 1;
    this.r = def.headR ?? 14;
    this.style = def.kind || 'hammer';
    this.tier = def.tier || (this.style === 'firebar' || this.style === 'laser' ? 'light' : 'heavy');
    this.hub = def.hub ?? 10;
    this.depth = 'span';
    // o braço também atinge? (moinho/laser/tronco: sim)
    this.armHits = def.armHits ?? (this.style !== 'hammer');
    this.armR = def.armR ?? (this.style === 'laser' ? 2 : this.style === 'firebar' ? 5 : 5);
  }

  angle(t) {
    return this.dir * TAU * (t / this.T + this.phase);
  }

  get omega() {
    return (this.dir * TAU) / this.T;
  }

  pose(t, out = {}) {
    out.a = this.angle(t);
    return out;
  }

  init(world) {
    const self = this;
    const reach = this.L + this.r + 2;
    const env = { x: this.x - reach, y: this.y - reach, w: reach * 2, h: reach * 2 };
    this.env = env;
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        env,
        test(box, t, out) {
          const a0 = self.angle(t);
          const w = self.omega;
          for (let i = 0; i < self.n; i++) {
            const a = a0 + (i * TAU) / self.n;
            const ca = cos(a);
            const sa = sin(a);
            const hx = self.x + ca * self.L;
            const hy = self.y + sa * self.L;
            let hit = false;
            if (self.armHits) {
              hit = capsuleBox(self.x + ca * self.hub, self.y + sa * self.hub, hx, hy, self.armR, box, out);
            }
            if (!hit && self.style === 'hammer') hit = circleBox(hx, hy, self.r, box, out);
            if (hit) {
              out.vx = -w * (out.py - self.y);
              out.vy = w * (out.px - self.x);
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
registerObstacle('rotator', Rotator);

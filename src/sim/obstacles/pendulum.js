// Martelo-pêndulo: pivô (x,y), braço L, amplitude A (graus), período T.
// A cabeça é um cilindro perpendicular ao braço (cápsula). Função pura do tempo.
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { sin, cos, TAU, PI } from '../../core/dmath.js';
import { capsuleBox } from '../physics/shapes.js';

export class Pendulum extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.L = def.length ?? 96;
    this.A = ((def.amp ?? 55) * PI) / 180;
    this.T = def.period ?? 2.4;
    this.headW = def.headW ?? 40;
    this.headH = def.headH ?? 24;
    this.tier = def.tier || 'heavy';
    this.depth = 'span';
    this._h = { x: 0, y: 0, a: 0 };
  }

  angle(t) {
    return this.A * sin(TAU * (t / this.T + this.phase));
  }

  angVel(t) {
    return ((this.A * cos(TAU * (t / this.T + this.phase))) * TAU) / this.T;
  }

  pose(t, out = {}) {
    const a = this.angle(t);
    out.a = a;
    out.x = this.x + this.L * sin(a);
    out.y = this.y + this.L * cos(a);
    return out;
  }

  init(world) {
    const self = this;
    const r = this.headH / 2;
    const half = Math.max(0, this.headW / 2 - r);
    const reach = this.L + this.headW / 2 + 2;
    const env = { x: this.x - reach, y: this.y - 8, w: reach * 2, h: reach + 16 };
    this.env = env;
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        env,
        test(box, t, out) {
          const h = self.pose(t, self._h);
          const ax = cos(h.a) * half;
          const ay = -sin(h.a) * half;
          if (!capsuleBox(h.x - ax, h.y - ay, h.x + ax, h.y + ay, r, box, out)) return false;
          const w = self.angVel(t);
          out.vx = w * (out.py - self.y);
          out.vy = -w * (out.px - self.x);
          return true;
        },
      }),
    );
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('pendulum', Pendulum);

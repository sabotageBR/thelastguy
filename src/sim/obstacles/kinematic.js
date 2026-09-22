// Sólidos cinemáticos (posição = função pura do tempo): empurradores, esmagadores,
// plataformas móveis e roda-gigante. O mundo carrega/empurra/espreme os personagens.
import { Obstacle } from './base.js';
import { registerObstacle } from './index.js';
import { Solid } from '../physics/solid.js';
import { sin, cos, TAU, mod, clamp } from '../../core/dmath.js';

/** Perfis de movimento em [0,1] para fração do período u ∈ [0,1). */
export function profile(kind, u) {
  switch (kind) {
    case 'piston': {
      // sai rápido (15%), segura (35%), volta devagar (30%), descansa (20%)
      if (u < 0.15) {
        const k = u / 0.15;
        return 1 - (1 - k) * (1 - k);
      }
      if (u < 0.5) return 1;
      if (u < 0.8) return 1 - (u - 0.5) / 0.3;
      return 0;
    }
    case 'linear':
      return u < 0.5 ? u * 2 : 2 - u * 2;
    default:
      return (1 - cos(TAU * u)) / 2;
  }
}

class KinBase extends Obstacle {
  /** Para bots: chama cb(solid, x, y) com a posição de cada sólido no tempo t. */
  futureSolids(t, cb) {
    const p = this.posAt(t, this._fp || (this._fp = { x: 0, y: 0 }));
    cb(this.solid, Math.round(p.x), Math.round(p.y));
  }

  update(world, t) {
    const p = this.posAt(t, this._p || (this._p = { x: 0, y: 0 }));
    world.moveSolid(this.solid, p.x, p.y);
  }

  /** Posição inteira do sólido em t (pura) — usada pelos bots. */
  solidAt(t, out) {
    const p = this.posAt(t, out);
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    return p;
  }

  bounds() {
    return this.env;
  }
}

/** Bloco que desliza na horizontal (roxo). Dá para subir nele. */
export class Pusher extends KinBase {
  constructor(def, world, id) {
    super(def, world, id);
    this.w = def.w ?? 32;
    this.h = def.h ?? 32;
    this.stroke = def.stroke ?? 64;
    this.dir = def.dir ?? 1;
    this.T = def.period ?? 2;
    this.prof = def.profile || 'sine';
    this.axis = def.axis || 'x';
    this.depth = 'back';
  }

  posAt(t, out) {
    const f = profile(this.prof, mod(t / this.T + this.phase, 1));
    if (this.axis === 'y') {
      out.x = this.x;
      out.y = this.y + this.dir * this.stroke * f;
    } else {
      out.x = this.x + this.dir * this.stroke * f;
      out.y = this.y;
    }
    return out;
  }

  init(world) {
    const p = this.posAt(0, {});
    this.solid = new Solid({ x: p.x, y: p.y, w: this.w, h: this.h, kind: this.kind, owner: this, impart: this.def.impart ?? 0.8, mat: this.def.mat });
    const x0 = Math.min(this.x, this.x + this.dir * this.stroke);
    const y0 = Math.min(this.y, this.y + this.dir * this.stroke);
    this.env =
      this.axis === 'y'
        ? { x: this.x, y: y0, w: this.w, h: this.h + this.stroke }
        : { x: x0, y: this.y, w: this.w + this.stroke, h: this.h };
    world.addKinematic(this.solid, this.env);
  }
}
registerObstacle('pusher', Pusher);

/** Esmagador (teto): treme, desce rápido, segura, sobe devagar, espera. */
export class Crusher extends KinBase {
  constructor(def, world, id) {
    super(def, world, id);
    this.w = def.w ?? 32;
    this.h = def.h ?? 32;
    this.drop = def.drop ?? 64;
    const d = def.times || {};
    this.tShake = d.shake ?? 0.4;
    this.tDrop = d.drop ?? 0.12;
    this.tHold = d.hold ?? 0.5;
    this.tRise = d.rise ?? 1.0;
    this.tWait = d.wait ?? 1.0;
    this.T = this.tShake + this.tDrop + this.tHold + this.tRise + this.tWait;
    this.depth = 'back';
  }

  /** Fase: 'wait' | 'shake' | 'drop' | 'hold' | 'rise' e f (0 = em cima, 1 = embaixo). */
  stateAt(t) {
    let u = mod(t + this.phase * this.T, this.T);
    if (u < this.tWait) return { s: 'wait', f: 0, k: u / this.tWait };
    u -= this.tWait;
    if (u < this.tShake) return { s: 'shake', f: 0, k: u / this.tShake };
    u -= this.tShake;
    if (u < this.tDrop) return { s: 'drop', f: u / this.tDrop, k: u / this.tDrop };
    u -= this.tDrop;
    if (u < this.tHold) return { s: 'hold', f: 1, k: u / this.tHold };
    u -= this.tHold;
    return { s: 'rise', f: 1 - u / this.tRise, k: u / this.tRise };
  }

  posAt(t, out) {
    const st = this.stateAt(t);
    out.x = this.x;
    out.y = this.y + this.drop * st.f;
    return out;
  }

  init(world) {
    this.solid = new Solid({ x: this.x, y: this.y, w: this.w, h: this.h, kind: this.kind, owner: this, mat: this.def.mat });
    this.env = { x: this.x, y: this.y, w: this.w, h: this.h + this.drop };
    world.addKinematic(this.solid, this.env);
  }
}
registerObstacle('crusher', Crusher);

/** Plataforma móvel (senoidal) em x ou y. oneWay por padrão. */
export class Mover extends KinBase {
  constructor(def, world, id) {
    super(def, world, id);
    this.w = def.w ?? 64;
    this.h = def.h ?? 12;
    this.amp = def.amp ?? 48;
    this.T = def.period ?? 3;
    this.axis = def.axis || 'x';
    this.oneWay = def.oneWay ?? true;
    this.depth = 'back';
  }

  posAt(t, out) {
    const s = sin(TAU * (t / this.T + this.phase)) * this.amp;
    out.x = this.axis === 'x' ? this.x + s : this.x;
    out.y = this.axis === 'y' ? this.y + s : this.y;
    return out;
  }

  init(world) {
    const p = this.posAt(0, {});
    this.solid = new Solid({ x: p.x, y: p.y, w: this.w, h: this.h, kind: this.kind, owner: this, oneWay: this.oneWay, mat: this.def.mat });
    this.env =
      this.axis === 'x'
        ? { x: this.x - this.amp, y: this.y, w: this.w + this.amp * 2, h: this.h }
        : { x: this.x, y: this.y - this.amp, w: this.w, h: this.h + this.amp * 2 };
    world.addKinematic(this.solid, this.env);
  }
}
registerObstacle('mover', Mover);

/** Roda-gigante: N cabines one-way niveladas girando num círculo. */
export class Ferris extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.n = def.cars ?? 4;
    this.R = def.radius ?? 88;
    this.T = def.period ?? 8;
    this.dir = def.dir ?? 1;
    this.w = def.w ?? 48;
    this.depth = 'back';
    this.cars = [];
  }

  carPos(i, t, out) {
    const a = this.dir * TAU * (t / this.T + this.phase) + (i * TAU) / this.n;
    out.x = this.x + cos(a) * this.R - this.w / 2;
    out.y = this.y + sin(a) * this.R;
    out.a = a;
    return out;
  }

  init(world) {
    const env = { x: this.x - this.R - this.w, y: this.y - this.R - 4, w: (this.R + this.w) * 2, h: this.R * 2 + 16 };
    this.env = env;
    for (let i = 0; i < this.n; i++) {
      const p = this.carPos(i, 0, {});
      const s = new Solid({ x: p.x, y: p.y, w: this.w, h: 8, kind: this.kind, owner: this, oneWay: true });
      this.cars.push(s);
      world.addKinematic(s, env);
    }
  }

  update(world, t) {
    const p = this._p || (this._p = {});
    for (let i = 0; i < this.n; i++) {
      this.carPos(i, t, p);
      world.moveSolid(this.cars[i], p.x, p.y);
    }
  }

  futureSolids(t, cb) {
    const p = this._fp || (this._fp = {});
    for (let i = 0; i < this.n; i++) {
      this.carPos(i, t, p);
      cb(this.cars[i], Math.round(p.x), Math.round(p.y));
    }
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('ferris', Ferris);

export { clamp };

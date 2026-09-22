// Sólidos (estáticos e cinemáticos) e rampas.
// Retângulos em pixels inteiros: ocupam [x, x+w) × [y, y+h).

let nextSolidId = 1;

export class Solid {
  constructor(o) {
    this.id = o.id ?? nextSolidId++;
    this.x = o.x | 0;
    this.y = o.y | 0;
    this.w = o.w | 0;
    this.h = o.h | 0;
    this.px = this.x; // posição no tick anterior (interpolação do render)
    this.py = this.y;
    this.oneWay = !!o.oneWay; // só colide por cima
    this.mat = o.mat || 'normal'; // 'normal' | 'ice' | 'slide' | 'sticky'
    this.conveyor = o.conveyor || 0; // velocidade da superfície (px/s)
    this.bounce = o.bounce || 0; // trampolim: vy ao aterrissar (negativo)
    this.impart = o.impart || 0; // fração da velocidade transmitida ao empurrar
    this.kinematic = !!o.kinematic;
    this.active = o.active !== false;
    this.vx = 0; // velocidade atual (px/s), para impulso ao pular e empurrões
    this.vy = 0;
    this.owner = o.owner || null; // obstáculo dono (callbacks de contato)
    this.kind = o.kind || 'block'; // tipo visual
    this.tag = o.tag || null;
    this.riders = 0; // quantos personagens em cima no último tick
    this.snap = false; // teletransporte (não interpolar)
  }

  get top() {
    return this.y;
  }
}

export class Ramp {
  constructor(o) {
    this.id = o.id ?? nextSolidId++;
    this.x0 = o.x0 | 0;
    this.y0 = o.y0 | 0;
    this.x1 = o.x1 | 0;
    this.y1 = o.y1 | 0;
    this.mat = o.mat || 'normal';
    this.conveyor = o.conveyor || 0;
    this.active = o.active !== false;
    this.owner = o.owner || null;
    this.kind = o.kind || 'ramp';
    this.dynamic = !!o.dynamic;
    this.vx = 0;
    this.vy = 0;
  }

  /** Inclinação dy/dx (y para baixo). */
  get slope() {
    return (this.y1 - this.y0) / (this.x1 - this.x0);
  }

  /** Y inteiro da superfície na coluna x, ou NaN fora do intervalo. */
  surfaceY(x) {
    if (x < this.x0 || x > this.x1) return NaN;
    return Math.round(this.y0 + ((x - this.x0) * (this.y1 - this.y0)) / (this.x1 - this.x0));
  }
}

// Projéteis: dardos (em duas alturas: pule ou fique no chão), canhões em arco e
// deslizadores de chão (pinguins). Trajetórias = funções do tempo (bots preveem).
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { aabbBox, circleBox } from '../physics/shapes.js';
import { mod, stepwise } from '../../core/dmath.js';
import { Rng, hash32 } from '../../core/rng.js';

/**
 * Lançador de dardos/projéteis retos.
 * def: { x, y (base do emissor, no chão), dir (±1), interval (s), speed, heights: [h1, h2, ...]
 *   (altura acima do chão, alternando), range (px), w, h (tamanho do dardo), warn (s), tier, look,
 *   gameClock (tempos contam do VAI!), start (s: primeiro disparo), end (s), schedule: [[t, intervalo]] }
 */
export class Darts extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.dir = def.dir ?? -1;
    this.interval = def.interval ?? 1.6;
    this.speed = def.speed ?? 200;
    this.heights = def.heights || [8, 36];
    this.range = def.range ?? 360;
    this.dw = def.w ?? 12;
    this.dh = def.h ?? 4;
    this.warn = def.warn ?? 0.5;
    this.tier = def.tier || 'light';
    this.look = def.look || 'dart';
    this.life = this.range / this.speed;
    this.depth = 'span';
    this.world = world;
    // agenda pré-calculada (tempo de saída de cada dardo)
    this.shots = [];
    const sched = def.schedule || null;
    let t = (def.start ?? 0) + this.phase * this.interval;
    const end = def.end ?? 600;
    for (let k = 0; k < 2000 && t < end; k++) {
      this.shots.push(t);
      t += sched ? stepwise(sched, t) : this.interval;
    }
  }

  clock(t) {
    const r = this.def.gameClock && this.world.rules;
    return r ? t - r.countdown / 60 : t;
  }

  /** Primeiro índice de disparo com saída ≥ t0 (busca binária). */
  firstShot(t0) {
    const sh = this.shots;
    let lo = 0;
    let hi = sh.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sh[mid] < t0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  forEach(t, cb) {
    const g = this.clock(t);
    const sh = this.shots;
    for (let k = this.firstShot(g - this.life); k < sh.length && sh[k] <= g; k++) {
      const age = g - sh[k];
      const h = this.heights[k % this.heights.length];
      const x = this.x + this.dir * age * this.speed;
      cb(x, this.y - h - this.dh / 2, h, k);
    }
  }

  /** O próximo disparo sai em quanto tempo (para o aviso visual)? E em que altura? */
  nextIn(t) {
    const g = this.clock(t);
    const k = this.firstShot(g);
    this._nextH = this.heights[k % this.heights.length];
    return k < this.shots.length ? this.shots[k] - g : Infinity;
  }

  init(world) {
    const self = this;
    const x0 = Math.min(this.x, this.x + this.dir * this.range) - 16;
    this.env = { x: x0, y: this.y - Math.max(...this.heights) - 16, w: this.range + 32, h: Math.max(...this.heights) + 24 };
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        knock: 'fixed',
        dirX: this.dir,
        dirY: -0.5,
        env: this.env,
        test(box, t, out) {
          let hit = false;
          self.forEach(t, (x, y) => {
            if (!hit && aabbBox(x - self.dw / 2, y - self.dh / 2, self.dw, self.dh, box, out)) hit = true;
          });
          if (hit) {
            out.vx = self.dir * self.speed;
            out.vy = 0;
          }
          return hit;
        },
      }),
    );
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('darts', Darts);

/**
 * Canhão em arco (bolas de neve): cada tiro sai do canhão e cai num ponto do chão com sombra de aviso.
 * def: { x, y (boca), targets: [x...] (alvos no chão, ciclo), ground, interval, flight (s), r, warn, spread (1|3), tier,
 *   schedule: [[t, intervalo]], spreadSchedule: [[t, n]], spreadGap (px entre bolas do leque), clamp: [x0, x1],
 *   warnSchedule: [[t, s]], shuffle (embaralha alvos pela semente), start (s de jogo do 1º tiro) }
 * Aviso total antes do impacto = warn (canhão incha, sombra aparece) + flight.
 */
export class Cannon extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.targets = def.targets;
    this.ground = def.ground;
    this.interval = def.interval ?? 2.4;
    this.flight = def.flight ?? 1.0;
    this.r = def.r ?? 10;
    this.warn = def.warn ?? 1.0;
    this.spread = def.spread ?? 1;
    this.tier = def.tier || 'light';
    this.blast = def.blast ?? 20;
    this.depth = 'front';
    this.world = world;
    this.maxWarn = def.warnSchedule ? Math.max(...def.warnSchedule.map((e) => e[1])) : this.warn;
    if (def.shuffle) {
      this.targets = this.targets.slice();
      new Rng(hash32(world.seed, id, 'cannon')).shuffle(this.targets);
    }
    // agenda pré-calculada (tempo de jogo do disparo, alvos, aviso)
    this.shots = [];
    let t = (def.start ?? 1.0) + this.phase * this.interval;
    let n = 0;
    for (let k = 0; k < 400 && t < 400; k++) {
      const spread = def.spreadSchedule ? stepwise(def.spreadSchedule, t) : this.spread;
      const warn = def.warnSchedule ? stepwise(def.warnSchedule, t) : this.warn;
      const base = this.targets[n++ % this.targets.length];
      const gap = def.spreadGap ?? 48;
      for (let s = 0; s < spread; s++) {
        let land = base + (s - (spread - 1) / 2) * gap;
        if (def.clamp) land = Math.max(def.clamp[0], Math.min(def.clamp[1], land));
        this.shots.push({ t, land, warn });
      }
      t += this.intervalAt(t);
    }
  }

  gameTime(t) {
    const r = this.world.rules;
    return r ? t - r.countdown / 60 : t;
  }

  intervalAt(g) {
    return this.def.schedule ? this.def.schedule.reduce((v, [t0, iv]) => (g >= t0 ? iv : v), this.interval) : this.interval;
  }

  /** Tiros visíveis em g: cb(landX, age, k) — age < 0 = ainda no aviso; voo parabólico do canhão ao alvo. */
  forEach(g, cb) {
    if (g < 0) return;
    const shots = this.shots;
    // busca binária do primeiro tiro que ainda pode estar no ar
    const tMin = g - this.flight - 0.12;
    let lo = 0;
    let hi = shots.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (shots[mid].t < tMin) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < shots.length; k++) {
      const sh = shots[k];
      if (sh.t > g + this.maxWarn) break;
      const age = g - sh.t;
      if (age >= -sh.warn && age <= this.flight + 0.12) cb(sh.land, age, k);
    }
  }

  posAt(land, age, out = this._pp || (this._pp = { x: 0, y: 0 })) {
    const f = Math.max(0, Math.min(1, age / this.flight));
    const peak = Math.min(this.y, this.ground) - 90;
    out.x = this.x + (land - this.x) * f;
    out.y = (1 - f) * (1 - f) * this.y + 2 * (1 - f) * f * peak + f * f * this.ground;
    return out;
  }

  init(world) {
    const self = this;
    const xs = [...this.targets, this.x];
    const x0 = Math.min(...xs) - 40;
    const x1 = Math.max(...xs) + 40;
    this.env = { x: x0, y: Math.min(this.y, this.ground) - 120, w: x1 - x0, h: Math.abs(this.ground - this.y) + 160 };
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        knock: 'radial',
        env: this.env,
        test(box, t, out) {
          const g = self.gameTime(t);
          let hit = false;
          self.forEach(g, (land, age) => {
            if (hit || age < 0) return;
            const p = self.posAt(land, age);
            const r = age >= self.flight ? self.blast : self.r;
            if (circleBox(p.x, age >= self.flight ? self.ground - 6 : p.y, r, box, out)) hit = true;
          });
          if (hit) {
            out.vx = 0;
            out.vy = -150;
          }
          return hit;
        },
      }),
    );
  }

  safety(x, y, t) {
    const g = this.gameTime(t);
    let s = 0;
    this.forEach(g, (land, age) => {
      if (age < this.flight && Math.abs(land - x) < this.blast + 10) s -= 100;
    });
    return s;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('cannon', Cannon);

/**
 * Deslizador de chão (pinguim de barriga, bloco de gelo): atravessa uma faixa em velocidade constante.
 * def: { x0, x1, y (chão), speed, interval, schedule: [[t, intervalo]], start (s de jogo), dirs: 'alt'|'left'|'right', w, h, tier }
 */
export class Slider extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.x0 = def.x0;
    this.x1 = def.x1;
    this.gy = def.y;
    this.speed = def.speed ?? 140;
    this.interval = def.interval ?? 6;
    this.dirs = def.dirs || 'alt';
    this.sw = def.w ?? 24;
    this.sh = def.h ?? 14;
    this.tier = def.tier || 'bump';
    this.life = (this.x1 - this.x0 + 80) / this.speed;
    this.depth = 'span';
    this.world = world;
    this.spawns = [];
    let t = (def.start ?? 2) + this.phase * this.interval;
    for (let k = 0; k < 600 && t < 400; k++) {
      this.spawns.push(t);
      t += this.intervalAt(t);
    }
  }

  gameTime(t) {
    const r = this.world.rules;
    return r ? t - r.countdown / 60 : t;
  }

  intervalAt(g) {
    return this.def.schedule ? this.def.schedule.reduce((v, [t0, iv]) => (g >= t0 ? iv : v), this.interval) : this.interval;
  }

  forEach(g, cb) {
    const sp = this.spawns;
    const tMin = g - this.life;
    let lo = 0;
    let hi = sp.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sp[mid] < tMin) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < sp.length && sp[k] <= g; k++) {
      const age = g - sp[k];
      const dir = this.dirs === 'left' ? -1 : this.dirs === 'right' ? 1 : k % 2 ? -1 : 1;
      const x = dir > 0 ? this.x0 - 40 + age * this.speed : this.x1 + 40 - age * this.speed;
      cb(x, dir, k);
    }
  }

  init(world) {
    const self = this;
    this.env = { x: this.x0 - 60, y: this.gy - this.sh - 4, w: this.x1 - this.x0 + 120, h: this.sh + 8 };
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        knock: 'fixed',
        dirX: 1,
        dirY: -0.6,
        env: this.env,
        test(box, t, out) {
          let hit = false;
          let d = 1;
          self.forEach(self.gameTime(t), (x, dir) => {
            if (!hit && aabbBox(x - self.sw / 2, self.gy - self.sh, self.sw, self.sh, box, out)) {
              hit = true;
              d = dir;
            }
          });
          if (hit) {
            out.vx = d * self.speed;
            out.vy = 0;
            out.nx = d;
            out.ny = -0.5;
          }
          return hit;
        },
      }),
    );
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('slider', Slider);

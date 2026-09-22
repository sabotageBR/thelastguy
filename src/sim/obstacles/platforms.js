// Plataformas com estado (dependem de contato): desmoronáveis/ladrilhos, que afundam, gangorra.
// Mudanças por contato só valem no tick seguinte (onStand marca; update aplica).
import { Obstacle } from './base.js';
import { registerObstacle } from './index.js';
import { Solid, Ramp } from '../physics/solid.js';
import { sin, cos, clamp, PI, stepwise } from '../../core/dmath.js';
import { hash32 } from '../../core/rng.js';
import { blockedAt } from '../physics/body.js';

const ST_INTACT = 0;
const ST_SHAKE = 1;
const ST_GONE = 2;

/**
 * Fileira de ladrilhos que tremem e caem depois de pisados.
 * def: { x, y, n, tileW, depth, delay (s), respawn (s, 0 = nunca),
 *        delaySchedule: [[t, s], ...], randomSchedule: [[t, porSegundo], ...],
 *        shrinkSchedule: [[t, larguraMantida], ...], standTrigger (false = pisar não derruba),
 *        mat, iceRange: [x0, x1] (ladrilhos de gelo), iceAt (s: tudo vira gelo), look: 'crack',
 *        dropSchedule: [[t, [índices]]] (módulos que se soltam em t, com `delay` de aviso) }
 */
export class Crumble extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.n = def.n ?? 8;
    this.tw = def.tileW ?? 16;
    this.th = def.depth ?? 16;
    this.delay = def.delay ?? 0.5;
    this.respawn = def.respawn ?? 3;
    this.delaySchedule = def.delaySchedule || null;
    this.randomSchedule = def.randomSchedule || null;
    this.shrinkSchedule = def.shrinkSchedule || null; // [[t, larguraMantida], ...]
    this.standTrigger = def.standTrigger !== false;
    this.center = def.center ?? def.x + ((def.n ?? 8) * (def.tileW ?? 16)) / 2;
    this.tiles = [];
    this.depth = 'back';
    this.world = world;
  }

  init(world) {
    const ir = this.def.iceRange;
    for (let i = 0; i < this.n; i++) {
      const s = new Solid({ x: this.x + i * this.tw, y: this.y, w: this.tw, h: this.th, kind: this.kind, owner: this, oneWay: !!this.def.oneWay, mat: this.def.mat });
      s.tileIdx = i;
      const cx = s.x + this.tw / 2;
      if (ir && cx >= ir[0] && cx < ir[1]) {
        s.mat = 'ice';
        s.kind = 'ice';
      }
      world.addStaticSolid(s);
      this.tiles.push({ s, st: ST_INTACT, timer: 0, total: 1, touched: false, fallT: 0 });
    }
    this.iced = false;
    this.env = { x: this.x, y: this.y - 16, w: this.n * this.tw, h: this.th + 64 };
  }

  currentDelay(world) {
    if (!this.delaySchedule) return this.delay;
    const el = world.rules ? world.rules.elapsed : 0;
    return stepwise(this.delaySchedule, el);
  }

  onStand(c, s) {
    if (!this.standTrigger) return;
    const tile = this.tiles[s.tileIdx];
    if (tile && tile.st === ST_INTACT) tile.touched = true;
  }

  trigger(tile, world) {
    tile.st = ST_SHAKE;
    tile.timer = Math.max(1, Math.round(this.currentDelay(world) * 60));
    tile.total = tile.timer;
    tile.touched = false;
  }

  update(world) {
    const running = !world.rules || world.rules.phase !== 'countdown';
    // a arena inteira congela
    if (this.def.iceAt !== undefined && !this.iced && world.rules && world.rules.elapsed >= this.def.iceAt) {
      this.iced = true;
      for (const t of this.tiles) {
        t.s.mat = 'ice';
        t.s.kind = 'ice';
      }
      world.events.push('freeze', world.tick, { x: this.center, y: this.y, src: this.id });
    }
    // quedas aleatórias programadas (determinísticas por semente/tick)
    if (this.randomSchedule && running && world.rules) {
      const rate = stepwise(this.randomSchedule, world.rules.elapsed);
      if (rate > 0 && world.tick % Math.max(1, Math.round(60 / rate)) === 0) {
        const intact = this.tiles.filter((t) => t.st === ST_INTACT);
        if (intact.length) {
          const k = hash32(world.seed, this.id, world.tick) % intact.length;
          this.trigger(intact[k], world);
        }
      }
    }
    // módulos que se soltam em horários fixos (estação em colapso)
    if (this.def.dropSchedule && running && world.rules) {
      const g = world.rules.elapsed;
      const ds = this.def.dropSchedule;
      if (this.dropNext === undefined) this.dropNext = 0;
      while (this.dropNext < ds.length && g >= ds[this.dropNext][0]) {
        for (const i of ds[this.dropNext][1]) {
          const t = this.tiles[i];
          if (t && t.st === ST_INTACT) this.trigger(t, world);
        }
        this.dropNext++;
      }
    }
    // arena encolhendo: ladrilhos fora da largura mantida tremem e caem
    if (this.shrinkSchedule && running && world.rules) {
      const keep = stepwise(this.shrinkSchedule, world.rules.elapsed);
      for (const t of this.tiles) {
        if (t.st !== ST_INTACT) continue;
        const cx = t.s.x + this.tw / 2;
        if (Math.abs(cx - this.center) > keep / 2) {
          this.trigger(t, world);
          t.timer = Math.max(t.timer, 90); // 1,5 s piscando antes de cair
          t.total = t.timer;
        }
      }
    }
    if (world.rules && world.rules.suddenDeath) {
      for (const t of this.tiles) if (t.st === ST_INTACT && hash32(world.seed, this.id, world.tick, t.s.tileIdx) % 97 === 0) this.trigger(t, world);
    }
    for (const t of this.tiles) {
      if (t.st === ST_INTACT) {
        // durante a contagem regressiva o peso não derruba ninguém
        if (!running) t.touched = false;
        else if (t.touched) this.trigger(t, world);
      } else if (t.st === ST_SHAKE) {
        if (--t.timer <= 0) {
          t.st = ST_GONE;
          t.s.active = false;
          t.fallT = world.tick;
          t.timer = this.respawn > 0 ? Math.round(this.respawn * 60) : -1;
          world.events.push('crumble', world.tick, { x: t.s.x + this.tw / 2, y: t.s.y, src: this.id });
        }
      } else if (t.st === ST_GONE && t.timer > 0) {
        if (--t.timer <= 0) {
          // só volta se não houver ninguém no lugar
          const blocked = world.chars.some(
            (c) => c.active && c.x + 5 > t.s.x && c.x - 5 < t.s.x + t.s.w && c.y > t.s.y && c.y - 20 < t.s.y + t.s.h,
          );
          if (blocked) t.timer = 10;
          else {
            t.st = ST_INTACT;
            t.s.active = true;
          }
        }
      }
    }
  }

  /** Para bots: o ladrilho sob x estará sólido no tempo t (tick absoluto)? */
  tileState(x) {
    const i = Math.floor((x - this.x) / this.tw);
    return this.tiles[i] || null;
  }

  safety(x, y) {
    const t = this.tileState(x);
    if (!t || Math.abs(y - this.y) > 2) return 0;
    if (t.st === ST_INTACT) return 15;
    if (t.st === ST_SHAKE) return -20;
    return -40;
  }

  serialize() {
    return { tiles: this.tiles.map((t) => [t.st, t.timer, t.total]), iced: this.iced, dropNext: this.dropNext ?? 0 };
  }

  deserialize(o) {
    o.tiles.forEach(([st, timer, total], i) => {
      const t = this.tiles[i];
      t.st = st;
      t.timer = timer;
      t.total = total;
      t.s.active = st !== ST_GONE;
    });
    this.dropNext = o.dropNext ?? 0;
    if (o.iced && !this.iced) {
      this.iced = true;
      for (const t of this.tiles) {
        t.s.mat = 'ice';
        t.s.kind = 'ice';
      }
    }
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('crumble', Crumble);

/**
 * Plataforma que afunda enquanto ocupada (mais rápido com mais gente) e sobe vazia.
 * def: { x, y, w, h, sink (px/s), rise (px/s), crowd (fator extra por pessoa), maxSink, delay (s),
 *        delaySchedule: [[t, s]], gone (afundou demais = some), respawn (s até voltar; 0 = nunca),
 *        amp, period (deriva horizontal senoidal: placa de gelo à deriva) }
 */
export class Sinking extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.w = def.w ?? 64;
    this.h = def.h ?? 16;
    this.sink = def.sink ?? 20;
    this.rise = def.rise ?? 16;
    this.crowd = def.crowd ?? 0.5;
    this.maxSink = def.maxSink ?? 48;
    this.delay = Math.round((def.delay ?? 0) * 60);
    this.gone = def.gone ?? false; // afundou demais = some (finais)
    this.respawn = Math.round((def.respawn ?? 0) * 60);
    this.amp = def.amp ?? 0;
    this.T = def.period ?? 6;
    this.off = 0;
    this.occupied = 0;
    this.goneT = 0;
    this.depth = 'back';
  }

  /** x da placa em t (deriva pura). */
  xAt(t) {
    return this.amp ? Math.round(this.x + sin(2 * PI * (t / this.T + this.phase)) * this.amp) : this.x;
  }

  init(world) {
    this.solid = new Solid({ x: this.xAt(0), y: this.y, w: this.w, h: this.h, kind: this.kind, owner: this, mat: this.def.mat, oneWay: !!this.def.oneWay });
    this.env = { x: this.x - this.amp, y: this.y - 8, w: this.w + this.amp * 2, h: this.h + this.maxSink + 16 };
    world.addKinematic(this.solid, this.env);
  }

  currentDelay(world) {
    if (!this.def.delaySchedule) return this.delay;
    return Math.round(stepwise(this.def.delaySchedule, world.rules ? world.rules.elapsed : 0) * 60);
  }

  update(world, t) {
    const s = this.solid;
    if (!s.active) {
      // volta à tona depois de um tempo (se ninguém estiver no lugar)
      if (this.respawn > 0 && --this.goneT <= 0) {
        const nx = this.xAt(t);
        const blocked = world.chars.some((c) => c.active && c.x + 5 > nx && c.x - 5 < nx + this.w && c.y > this.y - 2 && c.y - 20 < this.y + this.h);
        if (blocked) this.goneT = 10;
        else {
          this.off = 0;
          this.occupied = 0;
          s.active = true;
          s.snap = true;
          world.moveSolid(s, nx, this.y);
        }
      }
      return;
    }
    const riders = s.riders || 0;
    const rate = world.rules && world.rules.sinkMult ? world.rules.sinkMult : 1;
    if (riders > 0) {
      this.occupied++;
      if (this.occupied > this.currentDelay(world)) this.off += (this.sink * rate * (1 + this.crowd * (riders - 1))) / 60;
    } else {
      this.occupied = 0;
      this.off = Math.max(0, this.off - this.rise / 60);
    }
    if (this.off >= this.maxSink) {
      this.off = this.maxSink;
      if (this.gone && s.active) {
        s.active = false;
        this.goneT = this.respawn;
        world.events.push('sunk', world.tick, { x: s.x + this.w / 2, y: this.y, src: this.id });
        return;
      }
    }
    world.moveSolid(s, this.xAt(t), this.y + Math.round(this.off));
  }

  /** Para bots: posição futura (deriva exata; afundamento congelado no valor atual). */
  futureSolids(t, cb) {
    if (!this.amp || !this.solid.active) return;
    cb(this.solid, this.xAt(t), this.y + Math.round(this.off));
  }

  serialize() {
    return [this.off, this.occupied, this.solid.active, this.goneT];
  }

  deserialize(o) {
    [this.off, this.occupied] = o;
    this.solid.active = o[2];
    this.goneT = o[3] ?? 0;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('sinking', Sinking);

/**
 * Pilares de pedra sobre o rio: afundam enquanto ocupados (mais rápido com mais gente), sobem
 * devagar vazios e desabam por agenda (tremem `warn` s antes). Pilar que chega à água some.
 * def: { pillars: [{ x, h (topo), w }], water (y da superfície), sink: [[t, px/s]], rise (px/s),
 *   crowd, collapse: [[t, cada N s]], warn (s), drain: [[t, px/s]] (afunda todos, ocupados ou não), kind }
 */
export class Pillars extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.water = def.water;
    this.sinkS = def.sink || [[0, 6]];
    this.rise = def.rise ?? 4;
    this.crowd = def.crowd ?? 0.5;
    this.collapseS = def.collapse || null;
    this.warn = Math.round((def.warn ?? 2) * 60);
    this.items = [];
    this.nextCollapse = -1;
    this.depth = 'back';
  }

  init(world) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    for (const p of this.def.pillars) {
      const top = -p.h;
      const h = this.water - top + 40; // o corpo vai até abaixo da água
      const s = new Solid({ x: p.x, y: top, w: p.w, h, kind: this.kind, owner: this });
      const env = { x: p.x, y: top - 8, w: p.w, h: h + (this.water - top) + 16 };
      world.addKinematic(s, env);
      this.items.push({ s, top, off: 0, gone: false, warnT: 0, goneT: 0 });
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x + p.w);
      y0 = Math.min(y0, top);
    }
    this.env = { x: x0, y: y0 - 16, w: x1 - x0, h: this.water - y0 + 64 };
  }

  update(world) {
    const r = world.rules;
    const running = !!r && r.phase !== 'countdown';
    const g = r ? r.elapsed : 0;
    const rate = stepwise(this.sinkS, g) * (r && r.suddenDeath ? 2 : 1);
    // desabamentos programados: um pilar de pé por vez, sorteado de forma determinística
    if (running && this.collapseS) {
      const every = stepwise(this.collapseS, g);
      if (every > 0) {
        if (this.nextCollapse < 0) this.nextCollapse = g + every;
        if (g >= this.nextCollapse) {
          this.nextCollapse = g + every;
          const up = this.items.filter((it) => !it.gone && it.warnT <= 0);
          if (up.length > 1) up[hash32(world.seed, this.id, world.tick) % up.length].warnT = this.warn;
        }
      }
    }
    for (const it of this.items) {
      if (it.gone) continue;
      if (it.warnT > 0 && --it.warnT === 0) {
        this.drop(it, world);
        continue;
      }
      const riders = it.s.riders || 0;
      const drain = running && this.def.drain ? stepwise(this.def.drain, g) : 0;
      if (running && riders > 0) it.off += (rate * (1 + this.crowd * (riders - 1)) + drain) / 60;
      else if (drain > 0) it.off += drain / 60;
      else it.off = Math.max(0, it.off - this.rise / 60);
      if (it.top + it.off >= this.water - 2) {
        this.drop(it, world);
        continue;
      }
      world.moveSolid(it.s, it.s.x, Math.round(it.top + it.off));
    }
  }

  drop(it, world) {
    it.gone = true;
    it.s.active = false;
    it.goneT = world.tick;
    world.events.push('sunk', world.tick, { x: it.s.x + it.s.w / 2, y: it.s.y, src: this.id });
  }

  /** Para bots: em cima de um pilar firme é bom; afundado ou tremendo, ruim. */
  safety(x, y) {
    for (const it of this.items) {
      if (it.gone || x < it.s.x - 2 || x > it.s.x + it.s.w + 2 || Math.abs(y - it.s.y) > 4) continue;
      return 20 - it.off * 0.8 - (it.warnT > 0 ? 70 : 0) - (it.s.riders || 0) * 6;
    }
    return 0;
  }

  serialize() {
    return { items: this.items.map((it) => [it.off, it.gone, it.warnT]), next: this.nextCollapse };
  }

  deserialize(o) {
    o.items.forEach(([off, gone, warnT], i) => {
      const it = this.items[i];
      it.off = off;
      it.gone = gone;
      it.warnT = warnT;
      it.s.active = !gone;
    });
    this.nextCollapse = o.next;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('pillars', Pillars);

/**
 * Gangorra: rampa dinâmica que inclina com o peso de quem está em cima.
 * def: { x (pivô), y (topo no pivô), w, maxAngle (graus) }
 */
export class Seesaw extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.hl = (def.w ?? 128) / 2;
    this.maxA = ((def.maxAngle ?? 22) * PI) / 180;
    this.theta = 0;
    this.omega = 0;
    this.depth = 'back';
  }

  endpoints(theta, out) {
    out.x0 = this.x - this.hl * cos(theta);
    out.y0 = this.y - this.hl * sin(theta);
    out.x1 = this.x + this.hl * cos(theta);
    out.y1 = this.y + this.hl * sin(theta);
    return out;
  }

  init(world) {
    this.ramp = new Ramp({ x0: this.x - this.hl, y0: this.y, x1: this.x + this.hl, y1: this.y, kind: 'seesaw', owner: this, dynamic: true });
    this.ramp.dynamic = true;
    const reach = this.hl * sin(this.maxA) + 4;
    this.env = { x: this.x - this.hl - 2, y: this.y - reach, w: this.hl * 2 + 4, h: reach * 2 + 24 };
    world.addRamp(this.ramp, this.env);
  }

  update(world) {
    const dt = world.dt;
    let torque = 0;
    const riders = [];
    for (const c of world.chars) {
      if (c.active && c.grounded && c.ground === this.ramp) {
        riders.push(c);
        torque += (c.x - this.x) / this.hl;
      }
    }
    // dinâmica: peso inclina, mola volta ao centro, amortecimento
    const alpha = torque * 4.5 - this.omega * 4 - this.theta * 3;
    this.omega += alpha * dt;
    this.theta = clamp(this.theta + this.omega * dt, -this.maxA, this.maxA);
    if (Math.abs(this.theta) >= this.maxA) this.omega *= 0.3;
    const e = this.endpoints(this.theta, this._e || (this._e = {}));
    const r = this.ramp;
    r.x0 = Math.round(e.x0);
    r.y0 = Math.round(e.y0);
    r.x1 = Math.round(e.x1);
    r.y1 = Math.round(e.y1);
    // carrega quem está em cima para a nova superfície e escorrega se inclinado
    const slide = Math.abs(this.theta) > (12 * PI) / 180;
    for (const c of riders) {
      const sy = r.surfaceY(c.x);
      if (sy === sy && sy !== c.y && !blockedAt(world.space, c, c.x, sy)) c.y = sy;
      if (slide) c.vx += Math.sign(this.theta) * 1000 * sin(Math.abs(this.theta)) * 0.5 * dt;
    }
  }

  serialize() {
    return [this.theta, this.omega];
  }

  deserialize(o) {
    [this.theta, this.omega] = o;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('seesaw', Seesaw);

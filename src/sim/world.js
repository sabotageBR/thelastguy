// Mundo da simulação: nível + personagens + obstáculos + regras. DOM-free.
import { DT } from '../core/constants.js';
import { Rng, hash32 } from '../core/rng.js';
import { EventQueue } from '../core/events.js';
import { Space } from './physics/space.js';
import { Solid, Ramp } from './physics/solid.js';
import { Grid } from './physics/grid.js';
import { rawMove, overlapsSolid, blockedAt, HW, BH } from './physics/body.js';
import { resolveHit } from './physics/knockback.js';
import { Character, ST, setState, stepCharacter, isVulnerable, hurtBox, applySquash, applyHit } from './character.js';
import { makePhys, TUNING } from './tuning.js';
import { makeInput } from './input.js';
import { createObstacle } from './obstacles/index.js';
import './obstacles/all.js';

const EMPTY_INPUT = makeInput();

export class World {
  /**
   * @param {object} level  nível construído (LevelBuilder.build())
   * @param {object} cfg    { seed, roster: [{slot,name,skin,human,lane}], rules (instância) }
   */
  constructor(level, cfg = {}) {
    this.level = level;
    this.seed = cfg.seed >>> 0 || 1;
    this.rng = new Rng(hash32(this.seed, 'match'));
    this.dt = DT;
    this.tick = 0;
    this.t = 0;
    this.phys = makePhys(level.physics || 'normal');
    this.events = new EventQueue();
    this.space = new Space(level.bounds);
    this.chars = [];
    this.obstacles = [];
    this.kinSolids = [];
    this.hazards = [];
    this.zones = [];
    this.killers = [];
    this.hazardGrid = new Grid(level.bounds.x0, level.bounds.y0, level.bounds.x1, level.bounds.y1, 64);
    this.rules = null;
    this.status = 'countdown';
    this._riders = [];
    this._box = { x0: 0, y0: 0, x1: 0, y1: 0 };
    this._contact = { px: 0, py: 0, nx: 0, ny: 0, vx: 0, vy: 0 };
    this._tmp = new Array(256);
    this._force = { ax: 0, ay: 0 };

    for (const s of level.solids) this.space.addSolid(new Solid(s));
    for (const r of level.ramps) this.space.addRamp(new Ramp(r));

    let oid = 1;
    for (const def of level.obstacles) {
      const o = createObstacle(def, this, oid++);
      if (o) this.obstacles.push(o);
    }

    const roster = cfg.roster || [{ slot: 0, name: 'Você', human: true, skin: 0 }];
    for (const r of roster) {
      const c = new Character(r.slot, r);
      this.chars[r.slot] = c;
    }
    this.chars = this.chars.filter(Boolean);
    this.bySlot = [];
    for (const c of this.chars) this.bySlot[c.slot] = c;
    this.placeAtSpawn();

    if (cfg.rules) this.setRules(cfg.rules);
  }

  setRules(rules) {
    this.rules = rules;
    rules.attach(this);
  }

  // ------------------------------------------------------------------ registro
  addKinematic(solid, env) {
    solid.kinematic = true;
    this.space.addSolid(solid, env);
    this.kinSolids.push(solid);
    return solid;
  }

  addStaticSolid(solid) {
    this.space.addSolid(solid);
    return solid;
  }

  addRamp(ramp, env) {
    this.space.addRamp(ramp, env);
    return ramp;
  }

  addHazard(hz) {
    const e = hz.env;
    this.hazards.push(hz);
    this.hazardGrid.insert(hz, e.x, e.y, e.x + e.w, e.y + e.h);
    return hz;
  }

  addZone(z) {
    this.zones.push(z);
    return z;
  }

  addKiller(k) {
    this.killers.push(k);
    return k;
  }

  emit(type, c, src, a) {
    const d = {};
    if (c) {
      d.slot = c.slot;
      d.x = c.x;
      d.y = c.y;
    }
    if (src) d.src = src.id;
    if (a !== undefined) d.a = a;
    this.events.push(type, this.tick, d);
  }

  // ------------------------------------------------------------------ spawn
  placeAtSpawn() {
    const sp = this.level.spawns;
    const order = this.chars.map((c) => c.slot);
    // ordem de largada embaralhada (sem privilegiar o slot 0)
    const r = new Rng(hash32(this.seed, 'spawn'));
    r.shuffle(order);
    order.forEach((slot, i) => {
      const c = this.bySlot[slot];
      const p = sp[i % sp.length];
      c.x = p.x;
      c.y = p.y;
      c.px = c.x;
      c.py = c.y;
      c.facing = p.facing || 1;
      c.grounded = false;
      c.snap = true;
      setState(c, ST.FALL);
    });
  }

  respawn(c) {
    const cps = this.level.checkpoints;
    const cp = c.checkpoint > 0 && cps[c.checkpoint - 1] ? cps[c.checkpoint - 1] : this.level.start;
    const spots = cp.spawn;
    const i = this.rng.int(spots.length);
    const p = spots[i];
    c.x = p.x;
    c.y = p.y;
    c.xr = 0;
    c.yr = 0;
    c.vx = 0;
    c.vy = 0;
    c.px = c.x;
    c.py = c.y;
    c.snap = true;
    c.active = true;
    c.grounded = false;
    c.ground = null;
    c.facing = 1;
    c.spin = 0;
    c.spinV = 0;
    c.iframes = TUNING.respawnIframes;
    setState(c, ST.FALL);
    this.emit('respawn', c);
  }

  /** Caiu no vazio/lava/etc. As regras decidem: respawn (corrida) ou eliminação. */
  kill(c, cause = 'void') {
    if (!c.active || !c.alive) return;
    if (c.state === ST.CELEBRATE || c.state === ST.WIN || c.state === ST.DONE) return;
    c.falls++;
    c.lastFallTick = this.tick;
    this.emit('fall', c, null, cause);
    if (this.rules) this.rules.onKill(c, cause);
    else this.startRespawn(c);
  }

  startRespawn(c) {
    c.active = false;
    c.vx = 0;
    c.vy = 0;
    setState(c, ST.RESPAWN);
    c.timer = TUNING.respawnDelay;
  }

  eliminate(c, cause) {
    c.active = false;
    c.alive = false;
    c.eliminated = true;
    setState(c, ST.ELIM);
    this.emit('eliminated', c, null, cause);
  }

  onCelebrateEnd(c) {
    if (this.rules && this.rules.onCelebrateEnd) this.rules.onCelebrateEnd(c);
  }

  // ------------------------------------------------------------------ forças
  applyForces(c, dt, t = this.t) {
    const zs = this.zones;
    if (!zs.length) return;
    const f = this._force;
    for (let i = 0; i < zs.length; i++) {
      f.ax = 0;
      f.ay = 0;
      f.dx = 0;
      if (zs[i].forceAt(c, t, f)) {
        const k = c.grounded ? zs[i].groundK ?? 0.4 : 1;
        c.vx += f.ax * dt * k;
        if (!c.grounded) c.vy += f.ay * dt;
        else if (f.ay < -600) {
          // corrente de ar forte levanta do chão
          c.vy = f.ay * dt;
          c.grounded = false;
          c.ground = null;
        }
        if (f.dx) c.xr += f.dx * dt; // deriva direta (px/s) — buraco negro no chão
      }
    }
  }

  // ------------------------------------------------------------------ sólidos cinemáticos
  /** Move o sólido para (nx, ny) inteiros carregando quem está em cima e empurrando o resto. */
  moveSolid(s, nx, ny) {
    nx = Math.round(nx);
    ny = Math.round(ny);
    const dx = nx - s.x;
    const dy = ny - s.y;
    s.vx = dx / DT;
    s.vy = dy / DT;
    if (dx === 0 && dy === 0) return;
    const riders = this._riders;
    riders.length = 0;
    const chars = this.chars;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c.active && c.grounded && c.ground === s) riders.push(c);
    }
    const wasActive = s.active;
    s.active = false;
    s.x = nx;
    s.y = ny;
    for (let i = 0; i < riders.length; i++) rawMove(this.space, riders[i], dx, dy, s);
    s.active = wasActive;
    if (!wasActive) return;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (!c.active || riders.includes(c)) continue;
      if (!s.oneWay) {
        if (overlapsSolid(c, s)) this.pushOut(c, s, dx, dy);
      } else if (dy < 0 && c.vy >= 0) {
        // plataforma one-way subindo passa pelos pés: levanta
        if (c.x - HW < s.x + s.w && c.x + HW > s.x && c.y >= s.y && c.y <= s.y - dy) {
          if (!blockedAt(this.space, c, c.x, s.y)) {
            c.y = s.y;
            c.yr = 0;
            c.vy = 0;
            c.grounded = true;
            c.ground = s;
          }
        }
      }
    }
  }

  pushOut(c, s, dx, dy) {
    let px = 0;
    let py = 0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      px = dx > 0 ? s.x + s.w - (c.x - HW) : s.x - (c.x + HW);
    } else {
      py = dy > 0 ? s.y + s.h - (c.y - BH) : s.y - c.y;
    }
    const ok = rawMove(this.space, c, px, py, s);
    if (ok && !overlapsSolid(c, s)) {
      if (py < 0) {
        // empurrado para cima = agora está em cima
        c.grounded = true;
        c.ground = s;
        c.vy = 0;
      } else if (s.impart && px !== 0) {
        c.vx = s.vx * s.impart;
        applyHit(c, 'bump', px > 0 ? 1 : -1, -0.3, 0, this, s.owner);
      } else if (py > 0 && c.vy < s.vy) {
        c.vy = s.vy;
      }
      return;
    }
    // espremido: procura espaço livre perpendicular ao empurrão
    const perp = Math.abs(dx) >= Math.abs(dy) ? [0, -1, 0, 1] : [-1, 0, 1, 0];
    for (let d = 2; d <= 32; d += 2) {
      for (let k = 0; k < 2; k++) {
        const ex = perp[k * 2] * d;
        const ey = perp[k * 2 + 1] * d;
        const ox = c.x;
        const oy = c.y;
        c.x += ex;
        c.y += ey;
        if (!overlapsSolid(c, s) && !blockedAt(this.space, c, c.x, c.y)) {
          c.snap = true;
          applySquash(c, this, s.owner);
          return;
        }
        c.x = ox;
        c.y = oy;
      }
    }
    // último recurso (não deveria acontecer): conta como queda
    this.emit('squeezeFail', c);
    this.kill(c, 'crush');
  }

  // ------------------------------------------------------------------ passo
  step(inputs) {
    this.tick++;
    const t = (this.t = this.tick * DT);
    const rules = this.rules;
    if (rules) rules.preStep(this);
    const ks = this.kinSolids;
    for (let i = 0; i < ks.length; i++) {
      const s = ks[i];
      s.px = s.x;
      s.py = s.y;
      s.snap = false;
    }
    const obs = this.obstacles;
    // obstáculos leem os contatos do tick anterior (riders/onStand) e só depois zeramos
    for (let i = 0; i < obs.length; i++) if (obs[i].update) obs[i].update(this, t);
    for (let i = 0; i < ks.length; i++) ks[i].riders = 0;
    const frozen = rules ? rules.inputFrozen(this) : false;
    const chars = this.chars;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const inp = frozen || !c.alive ? EMPTY_INPUT : inputs[c.slot] || EMPTY_INPUT;
      stepCharacter(c, inp, this);
      if (c.active && c.alive) this.postCharacter(c, t);
    }
    for (let i = 0; i < obs.length; i++) if (obs[i].post) obs[i].post(this, t);
    if (rules) rules.postStep(this);
  }

  postCharacter(c, t) {
    // contato com o chão (obstáculos com estado leem isto no próximo tick)
    if (c.grounded && c.ground) {
      if (c.ground.kinematic) c.ground.riders++;
      const own = c.ground.owner;
      if (own && own.onStand) own.onStand(c, c.ground, this);
    }
    // perigos
    if (isVulnerable(c)) {
      const b = hurtBox(c, this._box);
      const tmp = this._tmp;
      const n = this.hazardGrid.queryInto(b.x0, b.y0, b.x1, b.y1, tmp);
      for (let i = 0; i < n; i++) {
        const hz = tmp[i];
        if (hz.active && !hz.active(t)) continue;
        const ct = this._contact;
        ct.vx = 0;
        ct.vy = 0;
        if (hz.test(b, t, ct)) {
          if (resolveHit(c, hz, ct, this)) break;
          if (!c.active) return;
        }
      }
    }
    if (!c.active) return;
    // mortes: fundo do nível e volumes letais
    if (c.y - BH > this.level.killY) {
      this.kill(c, 'void');
      return;
    }
    const ks = this.killers;
    if (ks.length) {
      const b = hurtBox(c, this._box);
      for (let i = 0; i < ks.length; i++) {
        const cause = ks[i].killAt(b, t, c);
        if (cause) {
          this.kill(c, cause);
          return;
        }
      }
    }
    if (this.rules) this.rules.onMoved(c, t);
  }

  // ------------------------------------------------------------------ consultas (bots)
  /** Algum perigo atinge a caixa no tempo t? Devolve o perigo ou null. */
  hazardAt(b, t) {
    const tmp = this._tmp;
    const n = this.hazardGrid.queryInto(b.x0, b.y0, b.x1, b.y1, tmp);
    const ct = this._contact;
    for (let i = 0; i < n; i++) {
      const hz = tmp[i];
      if (hz.active && !hz.active(t)) continue;
      if (hz.test(b, t, ct)) return hz;
    }
    return null;
  }

  killAt(b, t) {
    if (b.y0 > this.level.killY) return 'void';
    for (let i = 0; i < this.killers.length; i++) {
      const cause = this.killers[i].killAt(b, t, null);
      if (cause) return cause;
    }
    return null;
  }

  aliveCount() {
    let n = 0;
    for (const c of this.chars) if (c.alive && !c.finished) n++;
    return n;
  }
}

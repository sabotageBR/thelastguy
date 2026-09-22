// "Fantasma" de previsão: roda o integrador REAL do personagem no futuro, com os
// sólidos cinemáticos na posição futura, perigos testados no tempo futuro e
// ladrilhos caindo na hora prevista. Restaura tudo ao terminar (DOM-free, sem alocar).
import { DT } from '../../core/constants.js';
import { stepCharacter, ST } from '../character.js';
import { rawMove, overlapsSolid, BH, HW } from '../physics/body.js';
import { makeInput, clearInput } from '../input.js';
import { TUNING } from '../tuning.js';
import { runPolicy, makeState, resetState } from './policies.js';

const FIELDS = [
  'slot', 'x', 'y', 'xr', 'yr', 'vx', 'vy', 'facing', 'state', 'st', 'timer', 'grounded', 'ground', 'groundMat',
  'groundVx', 'onRamp', 'coyote', 'buffer', 'jumpTicks', 'airTicks', 'noCut', 'diveUsed', 'pendingDive',
  'iframes', 'proneTicks', 'spin', 'spinV', 'active', 'alive', 'finished', 'landT', 'bumpCooldown', 'lane', 'launched',
];

export function copyChar(dst, src) {
  for (let i = 0; i < FIELDS.length; i++) dst[FIELDS[i]] = src[FIELDS[i]];
  dst.ignore = null;
  dst.px = src.x;
  dst.py = src.y;
  dst.emote = 0;
  dst.emoteT = 0;
  return dst;
}

export class Ghost {
  constructor(world) {
    this.world = world;
    this.g = copyChar({}, world.chars[0]);
    this.inp = makeInput();
    this.S = makeState();
    this.SP = makeState(); // estado do plano atual durante o atraso de reação
    const gw = {
      space: world.space,
      phys: world.phys,
      dt: world.dt,
      tick: 0,
      t: 0,
      level: world.level,
      isGhost: true,
      emit() {},
      respawn() {},
      onCelebrateEnd() {},
      applyForces: (c, dt) => world.applyForces(c, dt, gw.t),
    };
    this.gw = gw;
    this.kin = [];
    this.saved = [];
    this.falling = [];
    this.touched = [];
    this.fallBase = 0;
    this.box = { x0: 0, y0: 0, x1: 0, y1: 0 };
    this.tmp = new Array(128);
    this.contact = { px: 0, py: 0, nx: 0, ny: 0, vx: 0, vy: 0 };
    this.result = {};
    this.margin = 0;
    this._crushed = false;
    this._moveCb = (s, nx, ny) => {
      const g = this.g;
      if (g.grounded && g.ground === s) rawMove(this.world.space, g, nx - s.x, ny - s.y, s);
      s.x = nx;
      s.y = ny;
      if (!s.oneWay && s.active && overlapsSolid(g, s)) this._crushed = true;
    };
  }

  /** Reúne obstáculos móveis e ladrilhos prestes a cair perto do personagem. */
  prepare(c, ahead, back, up, down) {
    const w = this.world;
    this.kin.length = 0;
    this.saved.length = 0;
    this.falling.length = 0;
    const x0 = c.x - back;
    const x1 = c.x + ahead;
    const y0 = c.y - up;
    const y1 = c.y + down;
    const obs = w.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (!o.futureSolids && !o.tiles) continue;
      const b = o.bounds();
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      if (o.futureSolids) {
        this.kin.push(o);
        o.futureSolids(w.t, (s) => this.saved.push(s, s.x, s.y));
      }
      if (o.tiles) {
        for (const tl of o.tiles) if (tl.st === 1 && tl.s.active) this.falling.push(tl.s, w.tick + tl.timer);
      }
    }
    this.fallBase = this.falling.length;
  }

  restore() {
    const sv = this.saved;
    for (let i = 0; i < sv.length; i += 3) {
      const s = sv[i];
      s.x = sv[i + 1];
      s.y = sv[i + 2];
    }
    const f = this.falling;
    for (let i = 0; i < f.length; i += 2) f[i].active = true;
    // desfaz as quedas agendadas pelo próprio fantasma nesta simulação
    f.length = this.fallBase;
    for (let i = 0; i < this.touched.length; i++) this.touched[i]._ghostFall = false;
    this.touched.length = 0;
  }

  /**
   * Simula `plan` por H ticks a partir do personagem c. offset = ticks já decorridos do plano.
   * prefix (opcional) = { plan, offset, S, react }: o plano atual continua por `react` ticks
   * antes do candidato assumir — modela o atraso de reação do bot.
   */
  rollout(c, plan, H, offset = 0, S0 = null, prefix = null) {
    const w = this.world;
    const g = copyChar(this.g, c);
    const gw = this.gw;
    const R = this.result;
    const inp = this.inp;
    const S = S0 ? Object.assign(this.S, S0) : resetState(this.S);
    const react = prefix ? prefix.react : 0;
    const SP = prefix ? Object.assign(this.SP, prefix.S) : null;
    this.restore();
    R.hit = false;
    R.hitK = 0;
    R.bump = false;
    R.dead = false;
    R.deadK = 0;
    R.near = 0;
    R.finished = false;
    R.finishK = 0;
    R.voidBelow = false;
    R.minY = g.y;
    const t0 = w.t;
    const tick0 = w.tick;
    const finishX = w.level.finish ? w.level.finish.x : Infinity;
    const killY = w.level.killY;
    const kin = this.kin;
    const fall = this.falling;
    const box = this.box;
    const H2 = TUNING.hurt;
    const margin = this.margin;
    let k = 1;
    let HH = H;
    for (; k <= HH; k++) {
      // no ar no fim da previsão: estende até aterrissar (no máx. +36 ticks)
      if (k === HH && !g.grounded && HH < H + 36) HH++;
      const t = t0 + k * DT;
      gw.t = t;
      gw.tick = tick0 + k;
      this._crushed = false;
      for (let i = 0; i < kin.length; i++) kin[i].futureSolids(t, this._moveCb);
      for (let i = 0; i < fall.length; i += 2) if (fall[i + 1] <= tick0 + k) fall[i].active = false;
      if (this._crushed) {
        R.hit = true;
        R.bump = true;
        R.hitK = k;
        break;
      }
      clearInput(inp);
      if (k <= react) {
        runPolicy(prefix.plan, g, k + prefix.offset, inp, gw, SP);
        // o "segurar pulo" continua valendo quando o candidato assumir
        if (k === react) S.holdUntil = Math.max(S.holdUntil, SP.holdUntil - prefix.offset - react + k + offset);
      } else runPolicy(plan, g, k + offset, inp, gw, S);
      const px = g.x;
      stepCharacter(g, inp, gw);
      if (g.state === ST.RAGDOLL) {
        R.hit = true;
        R.hitK = k;
        break;
      }
      // perigos (caixa de dano, e caixa inflada para "quase acertou")
      box.x0 = g.x - HW + H2.inset;
      box.x1 = g.x + HW - H2.inset;
      box.y0 = g.y - BH + H2.top;
      box.y1 = g.y;
      if (g.iframes <= 0) {
        if (this.hazardHit(box, t)) {
          if (this._lastTier === 'kill') {
            R.dead = true;
            R.deadK = k;
            break;
          }
          R.hit = true;
          R.hitK = k;
          R.bump = this._lastTier === 'bump';
          break;
        }
        if (margin > 0 && k % 3 === 0) {
          box.x0 -= margin;
          box.x1 += margin;
          box.y0 -= margin;
          if (this.hazardHit(box, t)) R.near++;
        }
      }
      if (margin > 0 && k % 3 === 0 && g.iframes <= 0) {
        box.x0 += margin;
        box.x1 -= margin;
        box.y0 += margin;
      }
      if (g.y - BH > killY || (w.killers.length && w.killAt(box, t))) {
        R.dead = true;
        R.deadK = k;
        break;
      }
      if (g.y < R.minY) R.minY = g.y;
      // pisou num ladrilho intacto que cai com o peso: agenda a queda no fantasma
      if (g.grounded && g.ground && g.ground.owner && g.ground.owner.tiles && g.ground.active) {
        const own = g.ground.owner;
        if (own.standTrigger) {
          const tl = own.tiles[g.ground.tileIdx];
          if (tl && tl.st === 0 && !g.ground._ghostFall) {
            g.ground._ghostFall = true;
            this.falling.push(g.ground, tick0 + k + Math.round(own.currentDelay(w) * 60));
            this.touched.push(g.ground);
          }
        }
      }
      if (px < finishX && g.x >= finishX) {
        R.finished = true;
        R.finishK = k;
        break;
      }
    }
    R.k = Math.min(k, HH);
    R.x = g.x;
    R.y = g.y;
    R.grounded = g.grounded;
    R.state = g.state;
    if (!R.dead && !R.hit && !R.finished && !g.grounded) {
      R.voidBelow = !this.landsSafely(g, t0 + R.k * DT);
    } else if (!R.dead && !R.hit && !R.finished && g.grounded) {
      // no chão mas ainda escorregando (deslize do mergulho, gelo): onde vai parar?
      const rel = g.vx - g.groundVx;
      const ice = g.groundMat === 'ice';
      let d = 0;
      if (g.state === ST.SLIDE) d = (rel * rel) / (2 * TUNING.dive.slideFriction * (ice ? 0.15 : 1));
      else if (ice && Math.abs(rel) > 30) d = (rel * rel) / (2 * TUNING.ice.turn);
      if (d > 4 && w.space.groundBelow(Math.round(g.x + Math.sign(rel) * d), g.y - 2, HW - 1, 48) < 0) R.voidBelow = true;
    }
    this.restore();
    return R;
  }

  /** No ar no fim da previsão: projeta o arco (sem colisões laterais) até achar chão ou morrer. */
  landsSafely(g, t) {
    const w = this.world;
    const sp = w.space;
    const P = w.phys;
    const killY = w.level.killY;
    const box = this.box;
    // passos de 3 ticks; a busca de chão cobre a faixa varrida no passo
    const STEP = 3;
    const sdt = STEP * DT;
    let x = g.x;
    let y = g.y;
    let vy = g.vy;
    const vx = g.vx;
    const dx = vx * sdt;
    const hw = HW - 1 + Math.ceil(Math.abs(dx) / 2);
    for (let i = STEP; i <= 150; i += STEP) {
      const ny = y + vy * sdt + 0.5 * P.gFall * sdt * sdt;
      vy = Math.min(vy + P.gFall * sdt, P.maxFall);
      if (ny > y && sp.groundBelow(Math.round(x + dx / 2), Math.round(y), hw, Math.ceil(ny - y) + 1) >= 0) return true;
      x += dx;
      y = ny;
      if (y - BH > killY) return false;
      if (w.killers.length) {
        box.x0 = x - HW;
        box.x1 = x + HW;
        box.y0 = y - BH;
        box.y1 = y;
        if (w.killAt(box, t + i * DT)) return false;
      }
    }
    return false;
  }

  hazardHit(b, t) {
    const w = this.world;
    const tmp = this.tmp;
    const n = w.hazardGrid.queryInto(b.x0, b.y0, b.x1, b.y1, tmp);
    for (let i = 0; i < n; i++) {
      const hz = tmp[i];
      if (hz.active && !hz.active(t)) continue;
      if (hz.test(b, t, this.contact)) {
        this._lastTier = hz.tier;
        return true;
      }
    }
    return false;
  }
}

// Bot com planejador por amostragem: a cada ~10-18 ticks simula várias políticas no
// futuro (integrador real, obstáculos no tempo futuro), pontua e adota a melhor com
// atraso de reação, imprecisão e erros ocasionais — como um humano.
import { Rng, hash32 } from '../../core/rng.js';
import { ST } from '../character.js';
import { PROFILES } from './profiles.js';
import { Ghost } from './ghost.js';
import { runPolicy, makeState, resetState, FULL_HOLD, TAP_HOLD } from './policies.js';
import { HW } from '../physics/body.js';
import { progressOf } from '../levels/progress.js';

const MAX_THINKS_PER_TICK = 4;
const tmpList = new Array(64);

function ghostFor(world) {
  return world._ghost || (world._ghost = new Ghost(world));
}

export class BotController {
  constructor(world, slot, opts = {}) {
    this.slot = slot;
    const P = (this.P = PROFILES[opts.profile || 'normal'] || PROFILES.normal);
    this.personality = opts.personality || 'neutral';
    this.rng = new Rng(hash32(world.seed, slot, 'bot'));
    this.mag = P.mag[0] + (P.mag[1] - P.mag[0]) * this.rng.next();
    this.caution = this.personality === 'cautious' ? 1.6 : this.personality === 'aggressive' ? 0.5 : 1;
    this.margin = Math.max(0, P.margin + (this.personality === 'cautious' ? 2 : this.personality === 'aggressive' ? -1 : 0));
    const arena = world.level.type === 'survival' || world.level.type === 'final';
    this.plan = arena ? this.mk('hold') : this.mk('run');
    this.S = makeState();
    this.planStart = 0;
    this.pending = null;
    this.stale = false;
    this.cleanKeep = false;
    this.nextThink = this.rng.int(P.think);
    this.goDelay = -1;
    this.bestX = -Infinity;
    this.lastProg = 0;
    this.explore = 0;
    this.stuckStage = 0;
    this.dazed = 0;
    this.emoted = false;
    this.calm = false;
    this.thinks = 0;
    this.lastState = -1;
  }

  mk(type, o = {}) {
    return { type, dir: 1, mag: this.mag, ...o };
  }

  write(world, slot, out) {
    out.move = 0;
    out.jump = false;
    out.jumpHeld = false;
    out.dive = false;
    out.emote = 0;
    const c = world.bySlot[slot];
    const rules = world.rules;
    if (!c.alive) return out;
    if (c.state === ST.CELEBRATE || c.state === ST.WIN) {
      if (!this.emoted) {
        this.emoted = true;
        if (this.rng.next() < 0.75) out.emote = 1 + this.rng.int(4);
      }
      return out;
    }
    if (!c.active) return out;
    if (!rules || rules.phase === 'countdown') {
      this.goDelay = -1;
      return out;
    }
    if (this.goDelay < 0) this.goDelay = Math.max(0, Math.round(this.P.go[0] + (this.rng.next() * 2 - 1) * this.P.go[1]));
    if (this.goDelay > 0) {
      this.goDelay--;
      return out;
    }
    const race = world.level.type === 'race' || world.level.type === 'free';
    // derrubado: aperta pulo para levantar mais rápido; depois fica um pouco atordoado
    if (c.state === ST.PRONE || c.state === ST.SQUASH) {
      if (this.P.mash && world.tick % Math.max(1, Math.round(60 / this.P.mash)) === 0) out.jump = true;
      this.dazed = this.P.dazed;
      this.dropPending(world);
      this.stale = true;
      return out;
    }
    if (c.state === ST.GETUP || c.state === ST.RAGDOLL || c.state === ST.SLIDE) {
      // decisões tomadas antes do tombo/deslize valiam para outra situação
      this.dropPending(world);
      this.stale = true;
      return out;
    }
    let urgent = false;
    if (this.stale) {
      // recuperou o controle: o plano velho valia para outra situação (a continuação pode ser fatal)
      this.stale = false;
      this.plan = this.mk('hold');
      this.planStart = world.tick;
      resetState(this.S);
      urgent = true;
    }
    if (this.dazed > 0 && c.grounded) {
      this.dazed--;
      return out;
    }
    if (race) this.checkStuck(world, c);
    // plano de ar que só entraria em vigor depois do pouso: descarta e pensa de novo
    if (this.pending && this.pending.plan.type === 'airdive' && c.grounded) this.dropPending(world);
    if (this.pending && world.tick >= this.pending.at) {
      const carry = this.carryHold(world);
      this.plan = this.pending.plan;
      this.planStart = this.pending.start;
      resetState(this.S);
      this.S.holdUntil = carry + (world.tick - this.planStart);
      this.pending = null;
    }
    // plano de ar que encontrou o bot no chão (pousou): acabou — para e pensa de novo
    if (this.plan.type === 'airdive' && c.grounded && world.tick - this.planStart > 2) {
      this.plan = this.mk('hold');
      this.planStart = world.tick;
      resetState(this.S);
      urgent = true;
    }
    if (urgent || world.tick >= this.nextThink) {
      const b = world.botBudget || (world.botBudget = { tick: -1, used: 0 });
      if (b.tick !== world.tick) {
        b.tick = world.tick;
        b.used = 0;
      }
      if (urgent || b.used < MAX_THINKS_PER_TICK) {
        b.used++;
        this.think(world, c, race);
        const jit = Math.round(this.P.think * 0.25 * (this.rng.next() * 2 - 1));
        // plano atual limpo e mantido: dá para pensar de novo um pouco mais tarde
        const relax = this.cleanKeep && this.plan.type !== 'hold' ? 1.6 : 1;
        this.nextThink = world.tick + (this.calm ? 24 : Math.round((this.P.think + jit) * relax));
      } else this.nextThink = world.tick + 1;
    }
    runPolicy(this.plan, c, world.tick - this.planStart, out, world, this.S);
    // pulinhos aleatórios (bem raros) para parecer humano
    if (race && c.grounded && this.calm && this.rng.next() < 0.004) {
      out.jump = true;
      out.jumpHeld = true;
    }
    return out;
  }

  checkStuck(world, c) {
    const px = progressOf(world.level, c.x, c.y);
    if (px < this.bestX - 64) {
      this.bestX = px; // voltou ao checkpoint
      this.lastProg = world.tick;
    }
    if (px > this.bestX + 16) {
      this.bestX = px;
      this.lastProg = world.tick;
      this.stuckStage = 0;
    }
    if (world.rules.phase !== 'running') return;
    const stuck = world.tick - this.lastProg;
    if (stuck > 180 && this.stuckStage < 1) {
      this.stuckStage = 1;
      this.explore = 120;
    }
    if (stuck > 480 && this.stuckStage < 2) {
      this.stuckStage = 2;
      this.adopt(world, this.mk('retreat', { ticks: 30 }), 0);
    }
    if (stuck > 900) {
      c.stuckRespawns++;
      world.emit('stuckRespawn', c);
      world.startRespawn(c);
      this.lastProg = world.tick;
      this.stuckStage = 0;
    }
    if (this.explore > 0) this.explore--;
  }

  /** Trecho sem perigo à frente: só correr (nível de detalhe). */
  isCalm(world, c) {
    const x0 = c.x - 8;
    const x1 = c.x + 190;
    const y0 = c.y - 170;
    const y1 = c.y + 48;
    const n = world.hazardGrid.queryInto(x0, y0, x1, y1, tmpList);
    for (let i = 0; i < n; i++) {
      const e = tmpList[i].env;
      if (e.x < x1 && e.x + e.w > x0 && e.y < y1 && e.y + e.h > y0) return false;
    }
    const obs = world.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (!o.futureSolids && !o.tiles && !o.ramp) continue;
      const b = o.bounds();
      if (b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0) return false;
    }
    const sp = world.space;
    for (let dx = 12; dx <= 160; dx += 12) {
      const d = sp.groundBelow(c.x + dx, c.y - 40, HW - 1, 96);
      if (d < 0) return false;
      const h = d - 40;
      if (h < -3 || h > 36) return false;
    }
    return true;
  }

  raceCandidates(world, c) {
    const P = this.P;
    const L = [
      this.mk('run'),
      this.mk('edge', { hold: FULL_HOLD }),
      this.mk('jumpAt', { at: 0, hold: FULL_HOLD }),
      this.mk('jumpAt', { at: 0, hold: TAP_HOLD }),
      this.mk('wait', { ticks: 12 }),
      this.mk('hold'),
      this.mk('jumpAt', { at: 9, hold: FULL_HOLD }),
      this.mk('wait', { ticks: 26 }),
      P.dive ? this.mk('edge', { hold: FULL_HOLD, dive: true }) : this.mk('jumpAt', { at: 5, hold: FULL_HOLD }),
      this.mk('jumpAt', { at: 18, hold: FULL_HOLD }),
      this.mk('wait', { ticks: 44 }),
      this.mk('retreat', { ticks: 14 }),
      this.mk('jumpAt', { at: 6, hold: FULL_HOLD, pre: 6 }),
    ];
    const out = L.slice(0, P.cands);
    // nichos por perto: parar dentro deles (a bola gigante passa por cima)
    const hides = world.level.hides;
    if (hides && hides.length) {
      for (const hx of hides) {
        const d = hx - c.x;
        if (d > -48 && d < 160) out.push(this.mk('goto', { x: hx }));
      }
    }
    if (this.explore > 0) {
      for (let i = 0; i < 4; i++) {
        const r = this.rng.next();
        out.push(r < 0.5 ? this.mk('jumpAt', { at: this.rng.int(30), hold: this.rng.next() < 0.5 ? FULL_HOLD : 8 }) : this.mk('retreat', { ticks: 8 + this.rng.int(30) }));
      }
    }
    out.push(this.plan);
    return out;
  }

  /** Ticks restantes do "segurar pulo" do plano atual (preservado ao trocar de plano no ar). */
  carryHold(world) {
    return Math.max(0, this.S.holdUntil - (world.tick - this.planStart));
  }

  /** No ar há pouco a decidir: continuar, parar de avançar, mergulhar ou recuar. */
  airCandidates() {
    // 'hold' = pousar e ficar parado (gêiser dormente, cabine, plataforma estreita)
    const L = [this.mk('wait', { ticks: 10 }), this.mk('wait', { ticks: 30 }), this.mk('hold'), this.mk('retreat', { ticks: 10 }), this.mk('jumpAt', { at: 0, hold: FULL_HOLD })];
    if (this.P.dive && !this.S.dived) {
      L.push(this.mk('airdive', { at: 0 }));
      L.push(this.mk('airdive', { at: 10 }));
    }
    L.push(this.plan);
    return L;
  }

  scoreRace(R, c, H, world) {
    const lv = world.level;
    let s = lv.lifts && lv.lifts.length ? progressOf(lv, R.x, R.y) - progressOf(lv, c.x, c.y) : R.x - c.x;
    if (R.finished) s += 1000 - 10 * R.finishK;
    if (R.hit) s -= R.bump ? 25 + 40 * 0.97 ** R.hitK : 70 + 150 * 0.97 ** R.hitK;
    // morrer é morrer: decaimento leve; vazio no fim da previsão = morte logo depois
    if (R.dead) s -= 400 * 0.992 ** R.deadK;
    else if (R.voidBelow) s -= 400 * 0.992 ** (H + 12);
    // terminar deslizando/deitado custa tempo depois do horizonte
    if (R.state === ST.SLIDE) s -= 30;
    else if (R.state === ST.GETUP) s -= 20;
    else if (R.state === ST.PRONE || R.state === ST.RAGDOLL) s -= 45;
    s -= R.near * 8 * this.caution;
    return s;
  }

  // ---------------------------------------------------------------- arenas (sobrevivência / final)
  arenaCandidates(world, c) {
    const L = [
      this.mk('hold'),
      this.mk('run', { dir: 1 }),
      this.mk('run', { dir: -1 }),
      this.mk('hold', { jumpAt: 0 }),
      this.mk('hold', { jumpAt: 6 }),
      this.mk('hold', { jumpAt: 12 }),
      this.mk('hold', { jumpAt: 20 }),
      this.mk('hold', { jumpAt: 30 }),
    ];
    const targets = this.safeTargets(world, c);
    const final = world.level.type === 'final';
    for (const x of targets) {
      L.push(this.mk('goto', { x, leap: true }));
      L.push(this.mk('goto', { x, leap: true, jumpAt: 0 }));
      if (final) L.push(this.mk('hop', { x }));
    }
    if (final) {
      L.push(this.mk('hop', { x: c.x + 40 }));
      L.push(this.mk('hop', { x: c.x - 40 }));
    }
    L.push(this.mk('run', { dir: 1, dive: false }), this.mk('edge', { dir: c.facing, hold: FULL_HOLD }));
    L.push(this.plan);
    return L;
  }

  /** Escaneia a arena e devolve até 3 posições x seguras (no futuro), com cache curto. */
  safeTargets(world, c) {
    if (this._tgt && world.tick - this._tgtTick < 24 && Math.abs(this._tgtY - c.y) < 8) return this._tgt;
    this._tgt = this.scanTargets(world, c);
    this._tgtTick = world.tick;
    this._tgtY = c.y;
    return this._tgt;
  }

  scanTargets(world, c) {
    const lvl = world.level;
    const cb = lvl.camBounds;
    const t = world.t + this.P.horizon / 60;
    const cand = [];
    for (let x = Math.ceil(cb.x0 + 24); x < cb.x1 - 24; x += 16) {
      const d = world.space.groundBelow(x, c.y - 90, HW - 1, 260);
      if (d < 0) continue;
      const y = c.y - 90 + d;
      const moveCost = world.level.type === 'final' ? 0.12 : 0.05;
      cand.push([this.safetyAt(world, x, y, t) - Math.abs(x - c.x) * moveCost, x]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    const out = [];
    for (const [, x] of cand) {
      if (out.every((o) => Math.abs(o - x) > 40)) out.push(x);
      if (out.length >= 3) break;
    }
    return out;
  }

  safetyAt(world, x, y, t) {
    let s = 0;
    const obs = world.obstacles;
    for (let i = 0; i < obs.length; i++) if (obs[i].safety) s += obs[i].safety(x, y, t, this);
    // aglomeração: gente perto gasta o mesmo chão (e empurra)
    const chars = world.chars;
    for (let i = 0; i < chars.length; i++) {
      const o = chars[i];
      if (o.slot === this.slot || !o.alive || !o.active) continue;
      if (Math.abs(o.x - x) < 22 && Math.abs(o.y - y) < 24) s -= 10;
    }
    // bordas: distância até o vazio dos dois lados
    const sp = world.space;
    let edge = 0;
    for (const dir of [-1, 1]) {
      for (let dx = 8; dx <= 40; dx += 8) {
        if (sp.groundBelow(x + dir * dx, y - 4, 1, 12) < 0) {
          edge += (48 - dx) * 2;
          break;
        }
      }
    }
    return s - edge;
  }

  scoreArena(world, R, c) {
    let s = 300;
    if (R.hit) s -= R.bump ? 60 : 150 + 100 * 0.96 ** R.hitK;
    if (R.dead) s -= 500 * 0.98 ** R.deadK;
    if (R.voidBelow) s -= 300;
    if (!R.dead) {
      s += this.safetyAt(world, R.x, R.y, world.t + R.k / 60) * (world.level.type === 'final' ? 1.3 : 1);
      // mais alto = mais andares de reserva embaixo
      if (world.level.type === 'final') s += (c.y - R.y) * 0.4;
    }
    s -= Math.abs(R.x - c.x) * (world.level.type === 'final' ? 0.15 : 0.05);
    s -= R.near * 8 * this.caution;
    return s;
  }

  // ---------------------------------------------------------------- decisão
  think(world, c, race) {
    this.thinks++;
    if (race && this.explore <= 0 && this.isCalm(world, c)) {
      this.calm = true;
      if (this.plan.type !== 'run') this.adopt(world, this.mk('run'), 0);
      return;
    }
    this.calm = false;
    const P = this.P;
    const g = ghostFor(world);
    g.margin = this.margin;
    g.prepare(c, race ? 260 : 400, race ? 60 : 400, 220, 220);
    const H = race ? P.horizon : P.horizon + 12;
    const carry = this.carryHold(world);
    const S0 = this._s0 || (this._s0 = { jumped: false, holdUntil: -1, dived: false, hopK: -99, jumpK: -99 });
    // candidatos novos só assumem depois do atraso de reação: o plano atual segue até lá
    const pre = this._pre || (this._pre = { plan: null, offset: 0, S: null, react: 0 });
    pre.plan = this.plan;
    pre.offset = world.tick - this.planStart;
    pre.S = this.S;
    pre.react = P.react;
    const scored = [];
    const evalPlan = (plan) => {
      const cur = plan === this.plan;
      const offset = cur ? world.tick - this.planStart : 0;
      S0.jumped = false;
      S0.holdUntil = carry;
      S0.dived = this.S.dived;
      S0.hopK = -99;
      S0.jumpK = carry > 0 ? 0 : -99;
      const R = g.rollout(c, plan, H, offset, cur ? this.S : S0, cur || P.react <= 0 ? null : pre);
      let s = race ? this.scoreRace(R, c, H, world) : this.scoreArena(world, R, c);
      if (!cur) s -= 12;
      s += this.rng.next() * 2;
      scored.push({ s, plan, lethal: R.dead || R.voidBelow });
      if (this.debug) this.debug(plan, R, s, cur);
      return R;
    };
    // aceite antecipado: se o plano atual está limpo e rende bem, testa só 2 alternativas
    const Rc = evalPlan(this.plan);
    const ideal = H * this.mag * world.phys.run * world.dt;
    const prog = race ? progressOf(world.level, Rc.x, Rc.y) - progressOf(world.level, c.x, c.y) : 0;
    const clean = race && !Rc.hit && !Rc.dead && !Rc.voidBelow && Rc.near === 0 && Rc.state !== ST.SLIDE && Rc.state !== ST.PRONE && (Rc.finished || prog >= ideal * 0.8);
    let cands = race ? (c.grounded ? this.raceCandidates(world, c) : this.airCandidates()) : this.arenaCandidates(world, c);
    this.cleanKeep = false;
    if (clean && this.rng.next() > 0.2) {
      this.cleanKeep = true;
      const a = cands[1 + this.rng.int(cands.length - 2)];
      const b = cands[1 + this.rng.int(cands.length - 2)];
      cands = a === b ? [a] : [a, b];
    } else if (!race && !Rc.hit && !Rc.dead && !Rc.voidBelow && Rc.near === 0 && this.rng.next() > 0.3) {
      // arena tranquila: o plano atual segue bem — testa só algumas alternativas (a 1ª ida a lugar seguro sempre)
      const firstGoto = cands.find((p) => p.type === 'goto');
      const pick = [];
      for (let i = 0; i < 3; i++) pick.push(cands[this.rng.int(cands.length - 1)]);
      if (firstGoto) pick.push(firstGoto);
      cands = [...new Set(pick)];
    }
    for (let i = 0; i < cands.length; i++) if (cands[i] !== this.plan) evalPlan(cands[i]);
    scored.sort((a, b) => b.s - a.s);
    let pick = scored[0];
    if (scored.length > 2 && this.rng.next() < P.mistake) {
      const alt = scored[1 + (this.rng.next() < 0.3 ? 1 : 0)];
      if (!alt.lethal || this.rng.next() < P.blunder / Math.max(1e-6, P.mistake)) pick = alt;
    }
    if (pick.plan !== this.plan) this.adopt(world, pick.plan, P.react);
  }

  dropPending(world) {
    if (!this.pending) return;
    this.pending = null;
    this.nextThink = Math.min(this.nextThink, world.tick + 1);
  }

  adopt(world, plan, react) {
    const n = this.P.noise;
    // imprecisão humana só no tempo dos pulos a partir do chão (no ar, apertar pulo cedo/tarde
    // muda o que acontece: mergulho agora × pulo guardado para o pouso)
    const c = world.bySlot[this.slot];
    if (n > 0 && c && c.grounded) {
      if (plan.type === 'jumpAt') plan.at = Math.max(0, plan.at + Math.round((this.rng.next() * 2 - 1) * n));
      if (plan.type === 'edge') plan.bias = (this.rng.next() * 2 - 1) * n * 1.5;
    }
    if (react <= 0) {
      this.plan = plan;
      this.planStart = world.tick;
      resetState(this.S);
      this.pending = null;
    } else this.pending = { plan, at: world.tick + react, start: world.tick };
  }
}

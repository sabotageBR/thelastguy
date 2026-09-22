// Sobrevivência (arena): cair = eliminado. Termina quando restam ≤ meta ou no tempo.
// A intensidade dos perigos sobe por estágios (tabela `ramp` da fase), garantindo o fim.
import { BaseRules } from './common.js';
import { Rng, hash32 } from '../../core/rng.js';

export class SurvivalRules extends BaseRules {
  constructor(o = {}) {
    super(o);
    this.type = 'survival';
    this.targetWanted = o.target ?? 4;
    this.target = this.targetWanted;
    this.timeLimit = o.timeLimit ?? 90;
    this.elimOrder = []; // [{slot, t}] em ordem de eliminação
    this.pending = [];
    this.tiebreak = [];
    this.suddenDeath = false;
  }

  attach(world) {
    super.attach(world);
    const n = world.chars.length;
    this.target = Math.max(1, Math.min(this.targetWanted, Math.floor(n / 2) || 1));
    const r = new Rng(hash32(world.seed, 'tiebreak'));
    const perm = world.chars.map((c) => c.slot);
    r.shuffle(perm);
    perm.forEach((slot, i) => (this.tiebreak[slot] = i));
  }

  /** Estágio de intensidade atual (índice na tabela de rampa da fase). */
  get stage() {
    const ramp = this.world.level.ramp;
    if (!ramp) return 0;
    let s = 0;
    for (let i = 0; i < ramp.length; i++) if (this.elapsed >= ramp[i].t) s = i;
    return s;
  }

  aliveList() {
    return this.world.chars.filter((c) => c.alive);
  }

  onKill(c, cause) {
    if (this.phase === 'ending' || this.phase === 'over') {
      // depois do fim ninguém mais é eliminado: volta para cima
      this.world.startRespawn(c);
      return;
    }
    // fração de tick: quanto mais cedo no tick, pior (usa a ordem do slot como proxy estável)
    this.pending.push({ c, cause, t: this.world.tick, y: c.y });
    this.world.eliminate(c, cause);
  }

  resolvePending() {
    if (!this.pending.length) return;
    // ordem de eliminação: mais cedo primeiro; empates pelo desempate sorteado
    this.pending.sort((a, b) => a.t - b.t || this.tiebreak[b.c.slot] - this.tiebreak[a.c.slot]);
    const alive = this.aliveList().length;
    if (alive === 0) {
      // todos os que restavam caíram no mesmo tick: os melhores (último a cair) sobrevivem
      const keep = Math.min(this.target, this.pending.length);
      const saved = this.pending.slice(this.pending.length - keep);
      for (const p of saved) this.revive(p.c);
      this.pending = this.pending.slice(0, this.pending.length - keep);
    }
    for (const p of this.pending) this.elimOrder.push({ slot: p.c.slot, t: p.t });
    this.pending.length = 0;
  }

  revive(c) {
    c.alive = true;
    c.eliminated = false;
    this.world.startRespawn(c);
    c.timer = 1;
  }

  postStep(world) {
    this.resolvePending();
    if (this.phase === 'running') {
      const alive = this.aliveList().length;
      if (alive <= this.target) this.finish('target');
      else if (this.timeLimit && this.elapsed >= this.timeLimit) this.finish('time');
    }
    super.postStep(world);
  }

  finish(reason) {
    if (this.phase === 'ending' || this.phase === 'over') return;
    for (const c of this.aliveList()) {
      c.qualified = true;
      this.celebrate(c);
      c.timer = 0;
      this.world.emit('qualified', c, null, 0);
    }
    super.finish(reason);
  }

  buildResult() {
    const alive = this.aliveList().sort((a, b) => this.tiebreak[a.slot] - this.tiebreak[b.slot]);
    const elim = [...this.elimOrder].reverse().map((e) => e.slot);
    const q = alive.map((c) => c.slot);
    return { type: this.type, standings: [...q, ...elim], qualified: q, endReason: this.endReason, time: this.elapsed };
  }
}

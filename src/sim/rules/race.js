// Corrida: os primeiros `quota` a cruzar a chegada se classificam.
import { BaseRules } from './common.js';
import { Rng, hash32 } from '../../core/rng.js';

export class RaceRules extends BaseRules {
  constructor(o = {}) {
    super(o);
    this.type = 'race';
    this.quotaWanted = o.quota ?? 16;
    this.quota = this.quotaWanted;
    this.timeLimit = o.timeLimit ?? 150;
    this.finishOrder = [];
    this.pending = [];
    this.tiebreak = [];
  }

  attach(world) {
    super.attach(world);
    const n = world.chars.length;
    // cota nunca maior que metade (arredondada para baixo) e sempre ≥ 1; treino: todos
    this.quota = this.quotaWanted >= n ? n : Math.max(1, Math.min(this.quotaWanted, Math.floor(n / 2) || 1));
    this.finishX = world.level.finish ? world.level.finish.x : Infinity;
    const r = new Rng(hash32(world.seed, 'tiebreak'));
    const perm = world.chars.map((c) => c.slot);
    r.shuffle(perm);
    perm.forEach((slot, i) => (this.tiebreak[slot] = i));
    for (const c of world.chars) c.progress = c.x;
  }

  onMoved(c) {
    const w = this.world;
    const cps = w.level.checkpoints;
    while (c.checkpoint < cps.length && c.x >= cps[c.checkpoint].x && c.y <= cps[c.checkpoint].y + 24) {
      c.checkpoint++;
      w.emit('checkpoint', c, null, c.checkpoint);
    }
    if (c.x > c.progress) c.progress = c.x;
    if (!c.finished && this.phase === 'running' && c.px < this.finishX && c.x >= this.finishX) {
      const f = c.x === c.px ? 0 : (this.finishX - c.px) / (c.x - c.px);
      this.pending.push({ c, t: w.tick - 1 + f });
    }
  }

  postStep(world) {
    if (this.pending.length) {
      this.pending.sort((a, b) => a.t - b.t || this.tiebreak[a.c.slot] - this.tiebreak[b.c.slot]);
      for (const p of this.pending) {
        if (this.finishOrder.length >= this.quota) break;
        this.qualify(p.c, p.t);
      }
      this.pending.length = 0;
    }
    if (this.phase === 'running') {
      if (this.finishOrder.length >= this.quota) this.finish('quota');
      else if (this.timeLimit && this.elapsed >= this.timeLimit) this.finish('time');
    }
    super.postStep(world);
  }

  qualify(c, t) {
    c.finished = true;
    c.qualified = true;
    c.place = this.finishOrder.length + 1;
    this.finishOrder.push({ slot: c.slot, t });
    this.celebrate(c);
    this.world.emit('qualified', c, null, c.place);
  }

  finish(reason) {
    if (this.phase === 'ending' || this.phase === 'over') return;
    // tempo esgotado sem ninguém suficiente: completa pela classificação (garante ≥1 avança)
    if (reason === 'time') {
      const n = this.world.chars.length;
      const need = Math.min(Math.max(1, Math.min(2, n - 1)), this.quota) - this.finishOrder.length;
      if (need > 0) {
        const rest = this.standingsRest();
        for (let i = 0; i < need && i < rest.length; i++) this.qualify(rest[i], this.world.tick + i);
      }
    }
    super.finish(reason);
    for (const c of this.world.chars) {
      if (!c.qualified && c.alive) {
        c.eliminated = true;
        this.world.emit('eliminated', c, null, 'race');
      }
    }
  }

  standingsRest() {
    return this.world.chars
      .filter((c) => !c.qualified)
      .sort((a, b) => b.progress - a.progress || this.tiebreak[a.slot] - this.tiebreak[b.slot]);
  }

  buildResult() {
    const q = this.finishOrder.map((f) => f.slot);
    const rest = this.standingsRest().map((c) => c.slot);
    return { type: 'race', standings: [...q, ...rest], qualified: q, endReason: this.endReason, time: this.elapsed };
  }
}

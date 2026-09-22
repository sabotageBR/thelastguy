// Final: vence o último vivo. Morte súbita aos 150 s; failsafe aos 170 s.
import { SurvivalRules } from './survival.js';
import { ST } from '../character.js';

export class FinalRules extends SurvivalRules {
  constructor(o = {}) {
    super({ timeLimit: 0, ...o });
    this.type = 'final';
    this.target = 1;
    this.suddenDeathAt = o.suddenDeathAt ?? 150;
    this.failsafeAt = o.failsafeAt ?? 170;
    this.winner = -1;
  }

  attach(world) {
    super.attach(world);
    this.target = 1;
  }

  postStep(world) {
    this.resolvePending();
    if (this.phase === 'running') {
      if (!this.suddenDeath && this.elapsed >= this.suddenDeathAt) {
        this.suddenDeath = true;
        world.emit('suddenDeath');
      }
      const alive = this.aliveList();
      if (alive.length <= 1) this.finish('winner');
      else if (this.elapsed >= this.failsafeAt) {
        // failsafe: o mais alto (menor y) vence; empate pelo desempate sorteado
        alive.sort((a, b) => a.y - b.y || this.tiebreak[a.slot] - this.tiebreak[b.slot]);
        for (let i = 1; i < alive.length; i++) {
          this.elimOrder.push({ slot: alive[i].slot, t: world.tick });
          world.eliminate(alive[i], 'tempo');
        }
        this.finish('failsafe');
      }
    }
    if (this.phase === 'ending' && world.tick >= this.endTick) {
      this.phase = 'over';
      world.status = 'over';
      world.emit('roundEnd');
    }
  }

  finish(reason) {
    if (this.phase === 'ending' || this.phase === 'over') return;
    const alive = this.aliveList();
    const w = alive[0];
    if (w) {
      this.winner = w.slot;
      w.qualified = true;
      this.celebrate(w, true);
      this.world.emit('winner', w);
    }
    this.phase = 'ending';
    this.endReason = reason;
    this.endTick = this.world.tick + 210;
    this.world.status = 'ending';
    this.result = this.buildResult();
  }

  celebrate(c, win) {
    c.state = win ? ST.WIN : ST.CELEBRATE;
    c.st = 0;
    c.timer = 0;
    c.vx = 0;
  }
}

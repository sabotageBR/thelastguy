// Regras-base de rodada. As regras de corrida/sobrevivência/final estendem esta.
import { ST, setState } from '../character.js';
import { TUNING } from '../tuning.js';

export const COUNTDOWN_TICKS = 180; // 3 s

export class BaseRules {
  constructor(o = {}) {
    this.type = 'free';
    this.countdown = o.countdown ?? COUNTDOWN_TICKS;
    this.timeLimit = o.timeLimit ?? 0; // s (0 = sem limite)
    this.world = null;
    this.phase = 'countdown'; // countdown | running | ending | over
    this.endTick = 0;
    this.endReason = '';
    this.elapsedTicks = 0;
    this.result = null;
  }

  attach(world) {
    this.world = world;
    if (this.countdown <= 0) this.phase = 'running';
    world.status = this.phase;
  }

  /** Segundos desde o VAI! */
  get elapsed() {
    return this.elapsedTicks / 60;
  }

  get timeLeft() {
    return this.timeLimit ? Math.max(0, this.timeLimit - this.elapsed) : 0;
  }

  inputFrozen() {
    return this.phase === 'countdown';
  }

  preStep(world) {
    if (this.phase === 'countdown') {
      if (world.tick >= this.countdown) {
        this.phase = 'running';
        world.emit('go');
      } else if ((this.countdown - world.tick) % 60 === 0) {
        world.emit('countdown', null, null, (this.countdown - world.tick) / 60);
      }
    } else if (this.phase === 'running') {
      this.elapsedTicks++;
    }
    world.status = this.phase;
  }

  onKill(c) {
    this.world.startRespawn(c);
  }

  onMoved() {}

  onCelebrateEnd(c) {
    c.active = false;
    setState(c, ST.DONE);
  }

  postStep(world) {
    if (this.phase === 'ending' && world.tick >= this.endTick) {
      this.phase = 'over';
      world.status = 'over';
      world.emit('roundEnd');
    }
  }

  /** Encerra a rodada; o mundo continua rodando 2,5 s ("ending") para as comemorações. */
  finish(reason) {
    if (this.phase === 'ending' || this.phase === 'over') return;
    this.phase = 'ending';
    this.endReason = reason;
    this.endTick = this.world.tick + 150;
    this.world.status = 'ending';
    this.result = this.buildResult();
  }

  buildResult() {
    return { standings: this.world.chars.map((c) => c.slot), qualified: [], endReason: this.endReason };
  }

  celebrate(c, win = false) {
    setState(c, win ? ST.WIN : ST.CELEBRATE);
    c.timer = win ? 0 : TUNING.celebrate;
    c.vx = 0;
  }
}

/** Treino livre: sem contagem, cai = volta ao checkpoint. */
export class FreeRules extends BaseRules {
  constructor(o = {}) {
    super({ countdown: 0, ...o });
    this.type = 'free';
  }

  onMoved(c) {
    const cps = this.world.level.checkpoints;
    while (c.checkpoint < cps.length && c.x >= cps[c.checkpoint].x) {
      c.checkpoint++;
      this.world.emit('checkpoint', c, null, c.checkpoint);
    }
  }
}

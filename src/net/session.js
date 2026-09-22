// Sessão de partida: o contrato que a interface do jogo usa para rodar uma rodada, igual para
// o jogo local (v1) e para o futuro multiplayer (v2). Ver protocol.js para o formato de rede.
//
// interface Session {
//   start(): void                       começa a contagem
//   setLocalInput(input): void          entrada do jogador local para o próximo tick
//   advance(dt): number                 avança o relógio; devolve alpha (0..1) para interpolar
//   get world(): World                  estado para o render (só leitura)
//   drainEvents(out): Event[]           eventos novos (sons, partículas, HUD)
//   get status(): 'countdown'|'running'|'ending'|'over'
//   get result(): { standings, qualified, ... } | null
// }
//
// LocalSession: tudo na máquina — o mundo roda no passo fixo, os bots escrevem suas entradas
// e o humano escreve a dele. Uma RemoteSession (v2) teria o mesmo contrato, com o mundo
// autoritativo no servidor, previsão só do próprio personagem e snapshots a 20 Hz.
import { World } from '../sim/world.js';
import { BotController } from '../sim/bots/botController.js';
import { makeInput, copyInput } from '../sim/input.js';
import { DT } from '../core/constants.js';

const MAX_STEPS = 5;

export class LocalSession {
  /** cfg: { level, seed, roster, rules, humanSlot (null = só bots), profiles: { slot: {profile, personality} } } */
  constructor(cfg) {
    this.world = new World(cfg.level, { seed: cfg.seed, roster: cfg.roster, rules: cfg.rules });
    this.humanSlot = cfg.humanSlot ?? null;
    this.inputs = [];
    this.controllers = [];
    for (const c of this.world.chars) {
      this.inputs[c.slot] = makeInput();
      if (c.slot !== this.humanSlot) this.controllers[c.slot] = new BotController(this.world, c.slot, (cfg.profiles || {})[c.slot] || {});
    }
    this.local = makeInput();
    this.acc = 0;
    this.started = false;
  }

  start() {
    this.started = true;
  }

  setLocalInput(input) {
    // pressionamentos de borda (jump/dive/emote) acumulam até o próximo tick
    const l = this.local;
    const jump = l.jump || input.jump;
    const dive = l.dive || input.dive;
    const emote = input.emote || l.emote;
    copyInput(l, input);
    l.jump = jump;
    l.dive = dive;
    l.emote = emote;
  }

  /** Um tick de simulação. */
  step() {
    const w = this.world;
    for (let s = 0; s < this.controllers.length; s++) if (this.controllers[s]) this.controllers[s].write(w, s, this.inputs[s]);
    if (this.humanSlot !== null) {
      copyInput(this.inputs[this.humanSlot], this.local);
      this.local.jump = false;
      this.local.dive = false;
      this.local.emote = 0;
    }
    w.step(this.inputs);
  }

  advance(dt) {
    if (!this.started) return 0;
    this.acc = Math.min(this.acc + dt, MAX_STEPS * DT);
    let n = 0;
    while (this.acc >= DT && n < MAX_STEPS) {
      this.step();
      this.acc -= DT;
      n++;
    }
    return this.acc / DT;
  }

  drainEvents(out = []) {
    return this.world.events.drain(out);
  }

  get status() {
    return this.world.status;
  }

  get result() {
    return this.world.rules ? this.world.rules.result : null;
  }
}

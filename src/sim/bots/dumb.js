// Bot provisório (reativo simples): corre para a direita e pula em bordas/paredes.
// Usado só até o planejador (botController.js) ficar pronto e em testes.
import { Rng, hash32 } from '../../core/rng.js';

export class DumbBot {
  constructor(slot, seed) {
    this.slot = slot;
    this.rng = new Rng(hash32(seed, slot, 'dumb'));
    this.hold = 0;
  }

  write(world, slot, out) {
    const c = world.bySlot[slot];
    out.move = 1;
    out.jump = false;
    out.dive = false;
    out.jumpHeld = this.hold > 0;
    if (this.hold > 0) this.hold--;
    if (!c.active || !c.grounded) return out;
    const sp = world.space;
    const ahead = sp.groundBelow(c.x + 14, c.y, 2, 8);
    const wall = sp.solidAt(c.x + 6, c.y - 18, c.x + 16, c.y - 1);
    if (ahead < 0 || wall) {
      if (this.rng.next() < 0.5) {
        out.jump = true;
        out.jumpHeld = true;
        this.hold = 20;
      }
    }
    return out;
  }
}

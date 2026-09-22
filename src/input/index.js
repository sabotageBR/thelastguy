// HumanController: junta teclado, toque e gamepad num InputState por tick.
import { quantizeMove } from '../sim/input.js';

export class HumanController {
  constructor(kb, touch, pad) {
    this.kb = kb;
    this.touch = touch;
    this.pad = pad;
    this.jumpSeen = 0;
    this.diveSeen = 0;
    this.kbEmoteSeen = 0;
    this.padEmoteSeen = 0;
    this.sync();
  }

  /** Descarta pressionamentos pendentes (ex.: ao começar uma rodada). */
  sync() {
    this.jumpSeen = this.jumpTotal();
    this.diveSeen = this.diveTotal();
    this.kbEmoteSeen = this.kb.emoteSerial;
    this.padEmoteSeen = this.pad ? this.pad.emoteSerial : 0;
  }

  jumpTotal() {
    return this.kb.jumpSerial + (this.touch ? this.touch.jumpSerial : 0) + (this.pad ? this.pad.jumpSerial : 0);
  }

  diveTotal() {
    return this.kb.diveSerial + (this.touch ? this.touch.diveSerial : 0) + (this.pad ? this.pad.diveSerial : 0);
  }

  /** Preenche `out` para um tick. Cada pressionar vira exatamente 1 tick com jump=true. */
  write(out) {
    const ax = this.kb.axis() + (this.touch ? this.touch.axisX : 0) + (this.pad ? this.pad.axisX : 0);
    out.move = quantizeMove(Math.max(-1, Math.min(1, ax)));
    const jt = this.jumpTotal();
    out.jump = jt > this.jumpSeen;
    if (out.jump) this.jumpSeen++;
    else this.jumpSeen = jt;
    const dt = this.diveTotal();
    out.dive = dt > this.diveSeen;
    if (out.dive) this.diveSeen++;
    else this.diveSeen = dt;
    out.jumpHeld = this.kb.jumpHeld || (this.touch ? this.touch.jumpHeld : false) || (this.pad ? this.pad.jumpHeld : false);
    // emote (1..4): o último pedido, uma vez (de quem apertou)
    out.emote = 0;
    if (this.kb.emoteSerial !== this.kbEmoteSeen) {
      this.kbEmoteSeen = this.kb.emoteSerial;
      out.emote = this.kb.emote;
    }
    if (this.pad && this.pad.emoteSerial !== this.padEmoteSeen) {
      this.padEmoteSeen = this.pad.emoteSerial;
      out.emote = this.pad.emote;
    }
    return out;
  }
}

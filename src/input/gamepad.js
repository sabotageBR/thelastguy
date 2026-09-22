// Gamepad (API padrão): analógico/d-pad + A pula, X/B mergulha, Start pausa; Y/LB/RB/baixo = emotes 1-4.
export class Gamepad {
  constructor() {
    this.axisX = 0;
    this.jumpHeld = false;
    this.jumpSerial = 0;
    this.diveSerial = 0;
    this.pauseSerial = 0;
    this.emoteSerial = 0;
    this.emote = 0;
    this.prev = {};
    this.lastUse = 0;
    this.connected = false;
  }

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) {
      gp = p;
      break;
    }
    this.connected = !!gp;
    if (!gp) {
      this.axisX = 0;
      this.jumpHeld = false;
      return;
    }
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    let ax = gp.axes[0] || 0;
    if (Math.abs(ax) < 0.25) ax = 0;
    if (b(14)) ax = -1;
    if (b(15)) ax = 1;
    this.axisX = Math.max(-1, Math.min(1, ax));
    const jump = b(0);
    const dive = b(2) || b(1);
    const pause = b(9);
    const emo = b(3) ? 1 : b(4) ? 2 : b(5) ? 3 : b(13) ? 4 : 0;
    if (emo && emo !== this.prev.emo) {
      this.emote = emo;
      this.emoteSerial++;
    }
    if (jump && !this.prev.jump) this.jumpSerial++;
    if (dive && !this.prev.dive) this.diveSerial++;
    if (pause && !this.prev.pause) this.pauseSerial++;
    if (jump || dive || pause || ax) this.lastUse = performance.now();
    this.jumpHeld = jump;
    this.prev = { jump, dive, pause, emo };
  }
}

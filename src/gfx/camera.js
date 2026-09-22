// Câmera 2D com antecipação, zona morta vertical e trava no pixel quando assenta.

export class Camera {
  constructor() {
    this.x = 0; // canto superior esquerdo (mundo)
    this.y = 0;
    this.vw = 480;
    this.vh = 270;
    this.look = 0;
    this.bounds = null;
    this.mode = 'follow'; // follow | fixed | tween
    this.shakeT = 0; // trauma 0..1
    this.shakeX = 0;
    this.shakeY = 0;
    this.tween = null;
    this.initialized = false;
    this.screenFrac = 0.66; // altura dos pés na tela
  }

  setView(vw, vh) {
    this.vw = vw;
    this.vh = vh;
  }

  setBounds(b) {
    this.bounds = b;
  }

  clamp() {
    const b = this.bounds;
    if (!b) return;
    const bw = b.x1 - b.x0;
    const bh = b.y1 - b.y0;
    if (bw <= this.vw) this.x = b.x0 + (bw - this.vw) / 2;
    else this.x = Math.max(b.x0, Math.min(b.x1 - this.vw, this.x));
    if (bh <= this.vh) this.y = b.y0 + (bh - this.vh) / 2;
    else this.y = Math.max(b.y0, Math.min(b.y1 - this.vh, this.y));
  }

  /** Salta direto para enquadrar (tx, ty). */
  snapTo(tx, ty, facing = 1) {
    this.look = facing * this.vw * 0.12;
    this.x = tx + this.look - this.vw / 2;
    this.y = ty - this.vh * this.screenFrac;
    this.clamp();
    this.initialized = true;
  }

  /** Segue (tx, ty) (pés do alvo, já interpolados). */
  follow(dt, tx, ty, facing = 1, vx = 0) {
    if (!this.initialized) this.snapTo(tx, ty, facing);
    const lookTarget = (Math.abs(vx) > 20 ? Math.sign(vx) : facing) * this.vw * 0.12;
    this.look += (lookTarget - this.look) * (1 - Math.exp(-dt * 2.5));
    const desX = tx + this.look - this.vw / 2;
    let desY = this.y;
    const footScreen = ty - this.y;
    const target = this.vh * this.screenFrac;
    const dz = 24;
    if (footScreen < target - dz * 2) desY = ty - (target - dz * 2);
    else if (footScreen > target + dz) desY = ty - (target + dz);
    const kx = 1 - Math.exp(-dt * 7);
    const ky = 1 - Math.exp(-dt * 5);
    this.x += (desX - this.x) * kx;
    this.y += (desY - this.y) * ky;
    if (Math.abs(desX - this.x) < 0.5) this.x = desX;
    if (Math.abs(desY - this.y) < 0.5) this.y = desY;
    this.clamp();
  }

  /** Viagem suave (sobrevoo da fase). */
  startTween(fromX, fromY, toX, toY, duration) {
    this.tween = { fromX, fromY, toX, toY, t: 0, duration };
    this.mode = 'tween';
  }

  updateTween(dt) {
    const tw = this.tween;
    if (!tw) return true;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.duration);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.x = tw.fromX + (tw.toX - tw.fromX) * e;
    this.y = tw.fromY + (tw.toY - tw.fromY) * e;
    this.clamp();
    if (k >= 1) {
      this.tween = null;
      this.mode = 'follow';
      return true;
    }
    return false;
  }

  addShake(amount) {
    this.shakeT = Math.min(1, this.shakeT + amount);
  }

  updateShake(dt, enabled = true) {
    if (!enabled || this.shakeT <= 0) {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeT = Math.max(0, this.shakeT - dt * 1.5);
      return;
    }
    const m = 4 * this.shakeT * this.shakeT;
    this.shakeX = Math.round((Math.random() * 2 - 1) * m);
    this.shakeY = Math.round((Math.random() * 2 - 1) * m);
    this.shakeT = Math.max(0, this.shakeT - dt * 1.5);
  }

  /** Posição final arredondada (px inteiro) para o render. */
  get rx() {
    return Math.round(this.x) + this.shakeX;
  }

  get ry() {
    return Math.round(this.y) + this.shakeY;
  }
}

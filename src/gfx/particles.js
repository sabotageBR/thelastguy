// Partículas cosméticas (pool SoA, sem alocação por frame). Coordenadas do mundo.

const MAX = 480;

export const PT = { DUST: 0, STAR: 1, CONFETTI: 2, SPARK: 3, SNOW: 4, EMBER: 5, LEAF: 6, SPLASH: 7, POOF: 8, DIZZY: 9, CHIP: 10 };

const CONFETTI_COLORS = ['#e6313a', '#fcd223', '#38b54a', '#0562c9', '#fc4da5', '#ffffff'];

export class Particles {
  constructor() {
    this.n = 0;
    this.x = new Float32Array(MAX);
    this.y = new Float32Array(MAX);
    this.vx = new Float32Array(MAX);
    this.vy = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.max = new Float32Array(MAX);
    this.type = new Uint8Array(MAX);
    this.col = new Array(MAX).fill('#fff');
    this.g = new Float32Array(MAX);
    this.cap = MAX;
  }

  clear() {
    this.n = 0;
  }

  setCap(n) {
    this.cap = Math.min(MAX, n);
  }

  add(type, x, y, vx, vy, life, col = '#ffffff', g = 0) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.type[i] = type;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.max[i] = life;
    this.col[i] = col;
    this.g[i] = g;
  }

  dust(x, y, n = 3, dir = 0) {
    for (let k = 0; k < n; k++) {
      this.add(PT.DUST, x + (Math.random() * 6 - 3), y - 1, (Math.random() - 0.5) * 30 - dir * 20, -Math.random() * 18, 0.35 + Math.random() * 0.2, '#ffffff', -20);
    }
  }

  star(x, y) {
    this.add(PT.STAR, x, y, 0, 0, 0.28, '#fcd223', 0);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      this.add(PT.SPARK, x, y, Math.cos(a) * 70, Math.sin(a) * 70, 0.25, k & 1 ? '#fcd223' : '#ffffff', 0);
    }
  }

  confetti(x, y, n = 40, spread = 60) {
    for (let k = 0; k < n; k++) {
      this.add(
        PT.CONFETTI,
        x + (Math.random() - 0.5) * spread,
        y - Math.random() * 20,
        (Math.random() - 0.5) * 120,
        -60 - Math.random() * 120,
        1.6 + Math.random(),
        CONFETTI_COLORS[k % CONFETTI_COLORS.length],
        160,
      );
    }
  }

  poof(x, y) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      this.add(PT.POOF, x, y - 10, Math.cos(a) * 40, Math.sin(a) * 40, 0.4, '#ffffff', 0);
    }
  }

  splash(x, y, col) {
    for (let k = 0; k < 10; k++) this.add(PT.SPLASH, x, y, (Math.random() - 0.5) * 90, -60 - Math.random() * 80, 0.6, col, 400);
  }

  chips(x, y, col, n = 6) {
    for (let k = 0; k < n; k++) this.add(PT.CHIP, x + (Math.random() - 0.5) * 12, y, (Math.random() - 0.5) * 80, -40 - Math.random() * 60, 0.7, col, 500);
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        this.type[i] = this.type[j];
        this.x[i] = this.x[j];
        this.y[i] = this.y[j];
        this.vx[i] = this.vx[j];
        this.vy[i] = this.vy[j];
        this.life[i] = this.life[j];
        this.max[i] = this.max[j];
        this.col[i] = this.col[j];
        this.g[i] = this.g[j];
        continue;
      }
      this.vy[i] += this.g[i] * dt;
      if (this.type[i] === PT.CONFETTI) {
        this.vx[i] *= 0.98;
        if (this.vy[i] > 40) this.vy[i] = 40;
        this.x[i] += Math.sin(this.life[i] * 9 + i) * 0.4;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      i++;
    }
  }

  draw(ctx, cx, cy) {
    for (let i = 0; i < this.n; i++) {
      const x = Math.round(this.x[i]) - cx;
      const y = Math.round(this.y[i]) - cy;
      const k = this.life[i] / this.max[i];
      const t = this.type[i];
      ctx.fillStyle = this.col[i];
      switch (t) {
        case PT.DUST: {
          const s = k > 0.6 ? 2 : 1;
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillRect(x, y, s, s);
          ctx.globalAlpha = 1;
          break;
        }
        case PT.STAR: {
          // estrela de impacto 11×11 ("POW")
          const r = k > 0.5 ? 5 : 4;
          ctx.fillRect(x - r, y, r * 2 + 1, 1);
          ctx.fillRect(x, y - r, 1, r * 2 + 1);
          ctx.fillRect(x - 2, y - 2, 5, 5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 1, y - 1, 3, 3);
          ctx.fillStyle = '#e6313a';
          ctx.fillRect(x - r + 1, y - r + 1, 1, 1);
          ctx.fillRect(x + r - 1, y - r + 1, 1, 1);
          ctx.fillRect(x - r + 1, y + r - 1, 1, 1);
          ctx.fillRect(x + r - 1, y + r - 1, 1, 1);
          break;
        }
        case PT.CONFETTI:
          ctx.fillRect(x, y, (i & 1) + 1, 2 - (i & 1));
          break;
        case PT.POOF:
          ctx.globalAlpha = k;
          ctx.fillRect(x - 1, y - 1, 3, 3);
          ctx.globalAlpha = 1;
          break;
        default:
          ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

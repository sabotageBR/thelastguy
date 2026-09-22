// Clima em espaço de tela (neve, brasas, folhas, poeira espacial). Cada partícula tem uma
// profundidade z (parallax) e reaparece do outro lado ao sair da tela: sem criar nem destruir.
// Puramente cosmético (fora da simulação).

const TAU = Math.PI * 2;
const LEAF = ['#7dc243', '#5aa832', '#ffc83d', '#a8d860'];

export class Weather {
  constructor() {
    this.kind = null;
    this.n = 0;
    this.t = 0;
  }

  setup(spec, scale = 1) {
    this.kind = spec ? spec.kind : null;
    const n = spec ? Math.round((spec.rate || 10) * 2 * scale) : 0;
    this.n = n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.z = new Float32Array(n);
    this.p = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = Math.random() * 2000;
      this.y[i] = Math.random() * 2000;
      this.z[i] = 0.5 + Math.random() * 0.8;
      this.p[i] = Math.random() * TAU;
    }
  }

  update(dt) {
    if (!this.n) return;
    this.t += dt;
    const t = this.t;
    for (let i = 0; i < this.n; i++) {
      const z = this.z[i];
      const p = this.p[i];
      let vx = 0;
      let vy = 0;
      switch (this.kind) {
        case 'snow':
          vx = Math.sin(t * 1.3 + p) * 8 * z - 6;
          vy = 16 + 22 * z;
          break;
        case 'embers':
          vx = Math.sin(t * 2.1 + p) * 12;
          vy = -(12 + 26 * z);
          break;
        case 'leaves':
          vx = 14 + Math.sin(t * 1.7 + p) * 16;
          vy = 14 + 10 * z + Math.cos(t * 2.3 + p) * 6;
          break;
        default:
          vx = 3 * z;
          vy = Math.sin(t * 0.5 + p) * 2;
      }
      this.x[i] += vx * dt;
      this.y[i] += vy * dt;
    }
  }

  /** near=false: partículas do fundo (z < 0.9); near=true: as da frente. */
  draw(ctx, camX, camY, vw, vh, near) {
    if (!this.n) return;
    const W = vw + 16;
    const H = vh + 16;
    const t = this.t;
    for (let i = 0; i < this.n; i++) {
      const z = this.z[i];
      if (near !== z >= 0.9) continue;
      const sx = Math.round((((this.x[i] - camX * z) % W) + W) % W) - 8;
      const sy = Math.round((((this.y[i] - camY * z) % H) + H) % H) - 8;
      switch (this.kind) {
        case 'snow': {
          ctx.fillStyle = z > 1.05 ? '#ffffff' : z > 0.8 ? 'rgba(255,255,255,0.85)' : 'rgba(235,245,255,0.6)';
          const s = z > 1.05 ? 2 : 1;
          ctx.fillRect(sx, sy, s, s);
          break;
        }
        case 'embers': {
          const fl = Math.sin(t * 9 + this.p[i] * 5) > 0;
          ctx.fillStyle = fl ? '#ffd23d' : '#ff7a1a';
          ctx.fillRect(sx, sy, 1, 1);
          if (z > 1.1) ctx.fillRect(sx, sy + 1, 1, 1);
          break;
        }
        case 'leaves': {
          ctx.fillStyle = LEAF[i % LEAF.length];
          if (Math.sin(t * 3 + this.p[i]) > 0) ctx.fillRect(sx, sy, 2, 1);
          else ctx.fillRect(sx, sy, 1, 2);
          break;
        }
        default:
          ctx.fillStyle = z > 1 ? 'rgba(160,200,255,0.8)' : 'rgba(160,200,255,0.45)';
          ctx.fillRect(sx, sy, 1, 1);
      }
    }
  }
}

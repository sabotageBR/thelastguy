// Painters dos obstáculos dos mundos Gelo, Vulcão, Selva e Espaço.
import { registerPainter } from './index.js';
import { pixLine } from './basic.js';
import { TOP_BAND } from '../tiles.js';

const TAU = Math.PI * 2;

function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  for (let yy = -r; yy <= r; yy++) {
    const hw = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy + r * 0.8)));
    ctx.fillRect(Math.round(x) - hw, Math.round(y) + yy, hw * 2 + 1, 1);
  }
}

// ------------------------------------------------------------------ vento / ventilador
registerPainter('wind', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'front') return;
  const st = o.stateAt(t);
  const x0 = o.x - cx;
  const y0 = o.y - cy;
  if (o.fy < 0) {
    // ventilador: grade na base + correntes subindo
    const by = y0 + o.h;
    ctx.fillStyle = '#3b4459';
    ctx.fillRect(x0 + 4, by - 6, o.w - 8, 6);
    ctx.fillStyle = '#8a95a8';
    for (let x = x0 + 8; x < x0 + o.w - 8; x += 6) ctx.fillRect(x, by - 5, 3, 4);
    if (st === 2) {
      ctx.fillStyle = 'rgba(220,240,255,0.55)';
      for (let i = 0; i < 10; i++) {
        const px = x0 + 8 + ((i * 37) % (o.w - 16));
        const py = by - 8 - ((t * 160 + i * 23) % (o.h - 10));
        ctx.fillRect(px, py, 1, 6);
      }
    }
    return;
  }
  if (st === 0) return;
  const dir = Math.sign(o.fx || o.drift) || -1;
  ctx.fillStyle = st === 2 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 16; i++) {
    const py = y0 + ((i * 29) % o.h);
    const len = 10 + ((i * 7) % 14);
    const px = x0 + (((dir > 0 ? t : -t) * (st === 2 ? 220 : 60) + i * 53) % o.w + o.w) % o.w;
    ctx.fillRect(Math.round(px), Math.round(py), len, 1);
  }
});

// ------------------------------------------------------------------ pingentes
registerPainter('icicles', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'span') return;
  const st = {};
  const ice = th.iceColors || ['#ffffff', '#cff3ff', '#7fd3ff', '#3a8cc8'];
  for (let i = 0; i < o.xs.length; i++) {
    o.stateAt(i, t, st);
    let x = o.xs[i] - cx;
    let len = o.len;
    if (st.s === 'grow') len = Math.max(2, Math.round(o.len * st.k));
    if (st.s === 'shake') x += Math.floor(t * 40) & 1 ? 1 : -1;
    const tipY = (st.s === 'fall' ? st.y : o.top + len) - cy;
    const topY = tipY - len;
    for (let k = 0; k < len; k++) {
      const hw = Math.max(0, Math.round((o.w / 2) * (1 - k / len)));
      ctx.fillStyle = ice[3];
      ctx.fillRect(Math.round(x) - hw - 1, topY + k, hw * 2 + 2, 1);
      ctx.fillStyle = k < len * 0.3 ? ice[0] : ice[1];
      ctx.fillRect(Math.round(x) - hw, topY + k, Math.max(1, hw * 2), 1);
    }
    if (st.s === 'shake') {
      // aviso: sombra no chão
      ctx.fillStyle = 'rgba(40,80,160,0.35)';
      ctx.fillRect(Math.round(x) - 6, o.ground - cy - 2, 12, 2);
    }
  }
});

// ------------------------------------------------------------------ bombardeio (meteoros, bombas, bolas de neve)
registerPainter('bombard', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'front') return;
  const g = o.gameTime(t);
  const look = o.look;
  const colors =
    look === 'snow'
      ? ['#ffffff', '#dcecf8', '#7fa8c8']
      : look === 'bomb'
        ? ['#3a3a44', '#1d1d24', '#ff7a1a']
        : look === 'debris'
          ? ['#c8d0dc', '#8a95a8', '#3b4459']
          : ['#ffd23d', '#ff7a1a', '#b3261e'];
  for (const e of o.events) {
    if (e.impact < g - 0.2) continue;
    if (e.impact > g + e.warn) break;
    const ph = o.phaseOf(e, g);
    if (!ph) continue;
    const x = o.impactX(e) - cx;
    const gy = o.ground - cy;
    if (ph === 'warn' || ph === 'fall') {
      // marcador vermelho encolhendo (aviso)
      const k = Math.max(0, Math.min(1, (e.impact - g) / e.warn));
      const r = Math.round(e.r * (0.4 + 0.6 * k));
      ctx.fillStyle = Math.floor(g * 10) & 1 ? 'rgba(255,40,40,0.55)' : 'rgba(255,40,40,0.35)';
      ctx.fillRect(x - r, gy - 2, r * 2, 2);
      ctx.fillRect(x - Math.round(r * 0.7), gy - 3, Math.round(r * 1.4), 1);
    }
    if (ph === 'fall') {
      const f = 1 - (e.impact - g) / o.flight;
      const y = o.top - cy + (gy - (o.top - cy)) * f;
      const R = Math.max(4, Math.round(e.r * 0.35));
      disc(ctx, x, y, R + 1, colors[2]);
      disc(ctx, x, y, R, colors[1]);
      disc(ctx, x - 1, y - 1, Math.max(1, R - 2), colors[0]);
      if (look === 'meteor') {
        ctx.fillStyle = 'rgba(255,180,60,0.6)';
        ctx.fillRect(x - 1, y - R * 3, 3, R * 2);
      }
    } else if (ph === 'boom') {
      const k = (g - e.impact) / 0.15;
      const R = Math.round(e.r * (0.6 + k * 0.6));
      disc(ctx, x, gy - 6, R, look === 'snow' ? 'rgba(255,255,255,0.8)' : 'rgba(255,200,80,0.75)');
      disc(ctx, x, gy - 6, Math.round(R * 0.6), look === 'snow' ? '#ffffff' : '#fff0a0');
    }
  }
});

// ------------------------------------------------------------------ pedras caindo na torre
registerPainter('rockfall', (ctx, o, th, t, cx, cy, layer, vw = 700, vh = 400) => {
  if (layer !== 'front') return;
  const g = o.gameTime(t);
  o.forEach(g, (x, y) => {
    const X = x - cx;
    if (y === null) {
      // aviso: linha tracejada vermelha na coluna (só o trecho na tela)
      ctx.fillStyle = Math.floor(g * 10) & 1 ? 'rgba(255,60,40,0.7)' : 'rgba(255,60,40,0.35)';
      const off = Math.floor(g * 40) % 8;
      for (let yy = -8 + off; yy < 420; yy += 8) ctx.fillRect(X, yy, 1, 4);
      return;
    }
    const Y = y - cy;
    if (Y < -20 || Y > 440) return;
    ctx.fillStyle = 'rgba(255,150,60,0.5)';
    ctx.fillRect(X - 1, Y - o.r * 3, 3, o.r * 2);
    disc(ctx, X, Y, o.r + 1, '#1d1624');
    disc(ctx, X, Y, o.r, '#54465e');
    disc(ctx, X - 2, Y - 2, Math.max(2, o.r - 5), '#7a6a84');
    ctx.fillStyle = '#ff8c1a';
    ctx.fillRect(X + 2, Y + 1, 2, 1);
    ctx.fillRect(X - 3, Y + 3, 1, 2);
  });
});

// ------------------------------------------------------------------ dardos
registerPainter('darts', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'span') return;
  const x = o.x - cx;
  const gy = o.y - cy;
  // emissor: cabeça de ídolo de pedra (ou torreta no espaço); os buracos são as alturas dos dardos
  const turret = o.look === 'turret';
  const stone = turret ? ['#aeb9cb', '#566279', '#161b2e'] : ['#b8b08a', '#8a7a5a', '#33261a'];
  const top = Math.max(...o.heights) + 16;
  ctx.fillStyle = stone[2];
  ctx.fillRect(x - 11, gy - top - 1, 22, top + 1);
  ctx.fillStyle = stone[0];
  ctx.fillRect(x - 10, gy - top, 20, top);
  ctx.fillStyle = stone[1];
  ctx.fillRect(x + 4, gy - top, 6, top);
  ctx.fillRect(x - 10, gy - 4, 20, 4);
  if (!turret) {
    // cocar dourado e sobrancelha
    ctx.fillStyle = stone[2];
    ctx.fillRect(x - 13, gy - top - 5, 26, 6);
    ctx.fillStyle = th.capYellow || '#ffc83d';
    ctx.fillRect(x - 12, gy - top - 4, 24, 4);
    ctx.fillStyle = '#e5484d';
    ctx.fillRect(x - 2, gy - top - 4, 4, 4);
  }
  const glow = o.nextIn(t) < o.warn;
  const blink = Math.floor(t * 12) & 1;
  for (const h of o.heights) {
    const lit = glow && h === o._nextH && blink;
    ctx.fillStyle = lit ? '#ff3b3b' : '#1d1d24';
    const high = h > 20;
    if (high && !turret) {
      // olhos (dardo alto)
      ctx.fillRect(x - 7, gy - h - 3, 5, 3);
      ctx.fillRect(x + 2, gy - h - 3, 5, 3);
    } else ctx.fillRect(x + o.dir * 3 - 5, gy - h - 3, 10, 4); // boca (dardo baixo)
  }
  o.forEach(t, (px, py) => {
    const X = Math.round(px) - cx;
    const Y = Math.round(py) - cy;
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(X - o.dw / 2, Y - 1, o.dw, 2);
    ctx.fillStyle = '#c8d0dc';
    ctx.fillRect(o.dir > 0 ? X + o.dw / 2 - 3 : X - o.dw / 2, Y - 1, 3, 2);
    ctx.fillStyle = '#e53935';
    ctx.fillRect(o.dir > 0 ? X - o.dw / 2 : X + o.dw / 2 - 3, Y - 2, 3, 4);
  });
});

// ------------------------------------------------------------------ canhão em arco
registerPainter('cannon', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'front') return;
  const g = o.gameTime(t);
  const x = o.x - cx;
  const y = o.y - cy;
  const dir = o.targets[0] > o.x ? 1 : -1;
  // forte de neve com canhão
  ctx.fillStyle = '#7fa8c8';
  ctx.fillRect(x - 14, y + 2, 28, 22);
  ctx.fillStyle = '#f4fbff';
  ctx.fillRect(x - 13, y + 3, 26, 20);
  ctx.fillStyle = '#3b4459';
  ctx.fillRect(dir > 0 ? x : x - 14, y - 4, 14, 8);
  ctx.fillStyle = '#566279';
  ctx.fillRect(dir > 0 ? x + 1 : x - 13, y - 3, 12, 6);
  o.forEach(g, (land, age) => {
    const gy = o.ground - cy;
    if (age < o.flight) {
      // sombra de aviso no chão
      const k = age < 0 ? 0.3 : 0.3 + (age / o.flight) * 0.5;
      ctx.fillStyle = `rgba(30,60,120,${k.toFixed(2)})`;
      ctx.fillRect(Math.round(land - cx) - o.blast / 2, gy - 2, o.blast, 2);
    }
    if (age >= 0 && age <= o.flight) {
      const p = o.posAt(land, age);
      disc(ctx, p.x - cx, p.y - cy, o.r * 0.6 + 1, '#7fa8c8');
      disc(ctx, p.x - cx, p.y - cy, o.r * 0.6, '#ffffff');
    } else if (age > o.flight) {
      disc(ctx, land - cx, gy - 5, o.blast * 0.7, 'rgba(255,255,255,0.8)');
    }
  });
});

// ------------------------------------------------------------------ deslizador (pinguim)
// pinguim deslizando de barriga (virado para a direita; espelhado ao desenhar)
const penguinCache = new Map();

function penguinSprite(w, h) {
  const key = `${w}x${h}`;
  let c = penguinCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = w + 4;
  c.height = h + 2;
  const x = c.getContext('2d');
  const px = (xx, yy, col) => {
    x.fillStyle = col;
    x.fillRect(xx, yy, 1, 1);
  };
  const cx = w * 0.45;
  const cy = h * 0.6;
  const rx = w * 0.45;
  const ry = h * 0.4;
  const hx = w * 0.78;
  const hy = h * 0.42;
  const hr = h * 0.36;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const inBody = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1;
      const inHead = (xx - hx) ** 2 + (yy - hy) ** 2 <= hr * hr;
      if (!inBody && !inHead) continue;
      let col = '#1d1d2a';
      if (inBody && yy > cy + ry * 0.15) col = '#f4fbff';
      if (inBody && yy > cy + ry * 0.55) col = '#cfe6f6';
      px(xx + 1, yy + 1, col);
    }
  }
  // contorno
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const solid = (xx, yy) => xx >= 0 && yy >= 0 && xx < c.width && yy < c.height && d[(yy * c.width + xx) * 4 + 3] > 0;
  const edge = [];
  for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) if (!solid(xx, yy) && (solid(xx - 1, yy) || solid(xx + 1, yy) || solid(xx, yy - 1) || solid(xx, yy + 1))) edge.push([xx, yy]);
  for (const [xx, yy] of edge) px(xx, yy, '#0c0c18');
  // olho, bico, pés e nadadeira
  const ex = Math.round(hx) + 2;
  const ey = Math.round(hy);
  px(ex, ey, '#ffffff');
  px(ex + 1, ey, '#ffffff');
  px(ex + 1, ey, '#0c0c18');
  px(ex, ey - 1, '#ffffff');
  x.fillStyle = '#f39a1a';
  x.fillRect(Math.round(hx + hr) + 1, ey + 1, 3, 2);
  x.fillRect(0, Math.round(cy) - 1, 2, 2);
  x.fillRect(1, Math.round(cy) + 1, 2, 1);
  x.fillStyle = '#3a3a52';
  x.fillRect(Math.round(cx) - 2, Math.round(cy) - 1, 5, 1);
  penguinCache.set(key, c);
  return c;
}

function debrisSprite(w, h) {
  const key = `debris${w}x${h}`;
  let c = penguinCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = w + 4;
  c.height = h + 2;
  const x = c.getContext('2d');
  x.fillStyle = '#161b2e';
  x.fillRect(1, 1, w + 2, h);
  x.fillStyle = '#8a95a8';
  x.fillRect(2, 2, w, h - 2);
  x.fillStyle = '#cbd5e3';
  x.fillRect(2, 2, w, 2);
  x.fillStyle = '#ffd23f';
  for (let k = 3; k < w; k += 6) x.fillRect(k + 1, h - 3, 3, 2);
  x.fillStyle = '#3df5ff';
  x.fillRect(w - 3, 4, 2, 2);
  penguinCache.set(key, c);
  return c;
}

registerPainter('slider', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'span') return;
  const g = o.gameTime(t);
  const spr = o.def.look === 'debris' ? debrisSprite(o.sw, o.sh) : penguinSprite(o.sw, o.sh);
  o.forEach(g, (px, dir) => {
    const x = Math.round(px) - cx;
    const y = o.gy - cy;
    const bob = Math.floor(t * 12) & 1;
    if (dir > 0) ctx.drawImage(spr, x - o.sw / 2 - 1, y - o.sh - 1 - bob);
    else {
      ctx.setTransform(-1, 0, 0, 1, x * 2, 0);
      ctx.drawImage(spr, x - o.sw / 2 - 1, y - o.sh - 1 - bob);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // borrifos de gelo atrás
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(x - dir * (o.sw / 2 + 3), y - 2, 2, 1);
    ctx.fillRect(x - dir * (o.sw / 2 + 6), y - 3 - bob, 1, 1);
  });
});

// ------------------------------------------------------------------ jatos (fogo, vapor, espinhos, elétrico)
registerPainter('jets', (ctx, o, th, t, cx, cy, layer) => {
  const spikes = o.kind === 'spikes';
  if (layer !== (spikes ? 'span' : 'front')) return;
  for (let i = 0; i < o.xs.length; i++) {
    const x = Math.round(o.xs[i] - o.w / 2) - cx;
    const gy = o.gy - cy;
    const st = o.stateAt(i, t);
    // bocal
    ctx.fillStyle = spikes ? '#5a4a3a' : '#2b2233';
    ctx.fillRect(x - 1, gy - 3, o.w + 2, 3);
    if (st === 1) {
      ctx.fillStyle = spikes ? '#c8d0dc' : o.kind === 'electric' ? '#3df5ff' : '#ff9a1a';
      if (Math.floor(t * 16) & 1) ctx.fillRect(x + 2, gy - 4, o.w - 4, 1);
      if (spikes) for (let k = 2; k < o.w - 1; k += 4) ctx.fillRect(x + k, gy - 5, 2, 2);
    }
    if (st !== 2) continue;
    const h = Math.round(o.height * o.extent(i, t));
    if (spikes) {
      for (let k = 0; k < o.w; k += 4) {
        for (let r = 0; r < Math.min(h, 12); r++) {
          const hw = Math.max(0, 2 - Math.floor((r * 2) / 12) * 1);
          ctx.fillStyle = r < 3 ? '#ffffff' : '#aeb9cb';
          ctx.fillRect(x + k + 2 - hw, gy - Math.min(h, 12) + r, hw * 2 || 1, 1);
        }
      }
    } else if (o.kind === 'electric') {
      ctx.fillStyle = 'rgba(61,245,255,0.35)';
      ctx.fillRect(x, gy - h, o.w, h);
      ctx.fillStyle = '#e0ffff';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + ((k * 5 + Math.floor(t * 30)) % o.w), gy - h + ((k * 13) % h), 1, 5);
    } else {
      const steam = o.kind === 'steam';
      for (let r = 0; r < h; r++) {
        const wob = Math.round(Math.sin(r * 0.4 + t * 30) * 1.5);
        const f = r / h;
        ctx.fillStyle = steam ? `rgba(240,248,255,${(0.8 - f * 0.5).toFixed(2)})` : f > 0.75 ? '#ffe066' : f > 0.35 ? '#ff9a1a' : '#ff5a1f';
        const hw = Math.round((o.w / 2) * (0.5 + 0.5 * f));
        ctx.fillRect(x + o.w / 2 - hw + wob, gy - r - 1, hw * 2, 1);
      }
    }
  }
});

// ------------------------------------------------------------------ lasers
function beam(ctx, x0, y0, x1, y1, glow = true) {
  if (glow) {
    ctx.globalCompositeOperation = 'lighter';
    pixLine(ctx, x0, y0, x1, y1, 5, 'rgba(255,40,80,0.28)');
    ctx.globalCompositeOperation = 'source-over';
  }
  pixLine(ctx, x0, y0, x1, y1, 3, '#ff2e4d');
  pixLine(ctx, x0, y0, x1, y1, 1, '#ffffff');
}

function dotted(ctx, x0, y0, x1, y1, t) {
  ctx.fillStyle = Math.floor(t * 10) & 1 ? 'rgba(255,60,90,0.9)' : 'rgba(255,60,90,0.45)';
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i += 4) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}

registerPainter('laser', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'front') return;
  const d = o.def;
  if (o.mode === 'gate') {
    const x = o.x - cx;
    ctx.fillStyle = '#566279';
    ctx.fillRect(x - 4, d.y0 - cy - 4, 8, 6);
    ctx.fillRect(x - 4, d.y1 - cy - 2, 8, 4);
    ctx.fillStyle = '#ff2e4d';
    ctx.fillRect(x - 1, d.y0 - cy, 2, 2);
    const st = o.gateState(t);
    if (st === 2) beam(ctx, x, d.y0 - cy + 2, x, d.y1 - cy - 2);
    else if (st === 1) dotted(ctx, x, d.y0 - cy + 2, x, d.y1 - cy - 2, t);
  } else if (o.mode === 'sweep') {
    const y = o.sweepY(t) - cy;
    ctx.fillStyle = '#566279';
    ctx.fillRect(o.x - cx - 6, y - 3, 6, 6);
    ctx.fillRect(o.x - cx + d.w, y - 3, 6, 6);
    beam(ctx, o.x - cx, y, o.x - cx + d.w, y);
  } else if (o.mode === 'turret') {
    const a = o.turretAngle(t);
    const x = o.x - cx;
    const y = o.y - cy;
    beam(ctx, x, y, x + Math.cos(a) * d.len, y + Math.sin(a) * d.len);
    disc(ctx, x, y, 6, '#3b4459');
    disc(ctx, x, y, 4, '#8a95a8');
    disc(ctx, x, y, 2, '#ff2e4d');
  } else {
    const g = o.gameTime(t);
    const top = (d.ceil ?? d.ground - 160) - cy;
    const gy = d.ground - cy;
    for (const e of o.cols) {
      if (e.t > g + e.warn) break;
      const st = o.colState(e, g);
      for (const x of e.xs) {
        const X = Math.round(x) - cx;
        if (st === 1) {
          dotted(ctx, X - e.w / 2, top, X - e.w / 2, gy, t);
          dotted(ctx, X + e.w / 2, top, X + e.w / 2, gy, t);
        } else if (st === 2) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,40,80,0.35)';
          ctx.fillRect(X - e.w / 2, top, e.w, gy - top);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#ff2e4d';
          ctx.fillRect(X - e.w / 2 + 4, top, e.w - 8, gy - top);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(X - 2, top, 4, gy - top);
        }
      }
    }
    for (const e of o.lines) {
      if (e.t > g + e.warn) break;
      if (g > e.t + 0.45) continue;
      const L = o.lineY(e);
      const y = Math.round((L.y0 + L.y1) / 2) - cy;
      if (g < e.t) dotted(ctx, d.x0 - cx, y, d.x1 - cx, y, t);
      else beam(ctx, d.x0 - cx, y, d.x1 - cx, y);
    }
    for (const e of o.scans) {
      if (e.t - e.warn > g) break;
      const x = o.scanX(e, g);
      const g0 = d.ground - e.gapY - e.gap - cy;
      const g1 = d.ground - e.gapY - cy;
      if (x === null) {
        if (g < e.t) {
          // aviso: a parede tracejada espera na borda de onde vai sair
          const X = (e.dir > 0 ? d.x0 : d.x1) - cx;
          dotted(ctx, X, top, X, g0, t);
          if (g1 < gy) dotted(ctx, X, g1, X, gy, t);
        }
        continue;
      }
      const X = Math.round(x) - cx;
      beam(ctx, X, top, X, g0);
      if (g1 < gy) beam(ctx, X, g1, X, gy);
      ctx.fillStyle = '#3df5ff';
      ctx.fillRect(X - 3, g0 - 1, 7, 2);
      ctx.fillRect(X - 3, g1 - 1, 7, 2);
    }
    const f = o.fenceGap(g);
    if (f) {
      if (f.x0 > d.x0) beam(ctx, f.x0 - cx, top, f.x0 - cx, gy, false);
      if (f.x1 < d.x1) beam(ctx, f.x1 - cx, top, f.x1 - cx, gy, false);
    }
  }
});

// ------------------------------------------------------------------ lava / água
registerPainter('liquid', (ctx, o, th, t, cx, cy, layer, vw = 700, vh = 400) => {
  if (layer !== 'front') return;
  const y = Math.round(o.level) - cy;
  if (y > 900) return;
  const lava = o.look === 'lava';
  const c = lava ? th.lava || ['#fff0a0', '#ffd23d', '#ff7a1a', '#b3261e'] : th.water || ['#bfe6ff', '#6cc4ee', '#2fa7c9', '#1c4f8f'];
  const x0 = Math.max(o.x, cx - 8) - cx;
  const x1 = Math.min(o.x + o.w, cx + 1200) - cx;
  if (x1 <= x0) return;
  // corpo
  ctx.fillStyle = c[2];
  ctx.fillRect(x0, y + 3, x1 - x0, 2);
  ctx.fillStyle = c[3];
  ctx.fillRect(x0, y + 5, x1 - x0, 800);
  // crista ondulada
  for (let x = x0; x < x1; x += 2) {
    const wob = Math.round(Math.sin((x + cx) * 0.18 + t * (lava ? 3 : 4)) * 1.5);
    ctx.fillStyle = c[1];
    ctx.fillRect(x, y + wob, 2, 3);
    ctx.fillStyle = c[0];
    ctx.fillRect(x, y + wob, 2, 1);
  }
  if (lava) {
    // bolhas
    for (let i = 0; i < 6; i++) {
      const bx = x0 + ((i * 97 + Math.floor(t * 2) * 31) % Math.max(1, x1 - x0));
      if ((Math.floor(t * 3) + i) % 3 === 0) {
        ctx.fillStyle = c[1];
        ctx.fillRect(bx, y - 2, 3, 2);
      }
    }
  }
});

// ------------------------------------------------------------------ buraco negro
registerPainter('blackhole', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const x = o.x - cx;
  const y = o.y - cy;
  for (let r = 60; r > o.core; r -= 6) {
    const a = t * (1.5 + (60 - r) * 0.05);
    ctx.fillStyle = r % 12 === 0 ? 'rgba(178,108,255,0.25)' : 'rgba(123,60,255,0.18)';
    for (let k = 0; k < 10; k++) {
      const ang = a + (k * TAU) / 10;
      ctx.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y + Math.sin(ang) * r * 0.6), 3, 1);
    }
  }
  disc(ctx, x, y, o.core + 3, '#b26cff');
  disc(ctx, x, y, o.core, '#0d0018');
});

// ------------------------------------------------------------------ totem giratório (DSWEEP)
registerPainter('totem', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'span') return;
  const x = o.x - cx;
  const gy = o.gy - cy;
  // totem
  ctx.fillStyle = '#33261a';
  ctx.fillRect(x - 11, gy - 90, 22, 90);
  ctx.fillStyle = '#a88e6a';
  ctx.fillRect(x - 10, gy - 89, 20, 88);
  ctx.fillStyle = '#7f6a4e';
  for (let k = 0; k < 4; k++) ctx.fillRect(x - 10, gy - 80 + k * 20, 20, 3);
  const eyes = o.reverseIn() < 1 && Math.floor(t * 8) & 1 ? '#ff3b3b' : '#ffc83d';
  ctx.fillStyle = eyes;
  ctx.fillRect(x - 6, gy - 76, 4, 3);
  ctx.fillRect(x + 2, gy - 76, 4, 3);
  // barras projetadas em 3/4: comprimento aparente = cos, profundidade = sin
  for (const b of o.bars) {
    if (!o.barOn(b)) continue;
    const a = o.angleAt(t) + b.offset;
    const px = Math.cos(a) * o.reach;
    const depth = Math.sin(a) * 10;
    const y = (b.type === 'low' ? gy - 10 : gy - 42) - Math.round(depth);
    const front = Math.cos(a) > 0.9 || Math.cos(a) < -0.9;
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(Math.round(x - Math.abs(px)) - 1, y - 5, Math.round(Math.abs(px) * 2) + 2, 11);
    ctx.fillStyle = front ? '#c28c50' : '#8a5a2e';
    ctx.fillRect(Math.round(x - Math.abs(px)), y - 4, Math.round(Math.abs(px) * 2), 9);
    ctx.fillStyle = '#a8733c';
    ctx.fillRect(Math.round(x - Math.abs(px)), y - 4, Math.round(Math.abs(px) * 2), 2);
    // sombra de aviso cruzando as faixas
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(Math.round(x - Math.abs(px)), gy - TOP_BAND + 2 + Math.round((depth + 10) / 2), Math.round(Math.abs(px) * 2), 2);
  }
});

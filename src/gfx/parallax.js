// Céu em faixas com pontilhado Bayer + camadas de parallax em tiras repetidas.
// Cada tema escolhe as camadas far/mid/near pelo `kind` (ver PAINTERS no fim do arquivo).
import { Rng } from '../core/rng.js';
import { bayer, hexToRGB, mix } from './pixel/palette.js';

const TAU = Math.PI * 2;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Céu: faixas de cor com transições pontilhadas curtas. */
export function paintSky(ctx, w, h, stops) {
  const img = ctx.createImageData(w, h);
  const d = new Uint32Array(img.data.buffer);
  const cols = stops.map(([, hex]) => {
    const [r, g, b] = hexToRGB(hex);
    return (255 << 24) | (b << 16) | (g << 8) | r;
  });
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const t0 = stops[i][0];
    const t1 = stops[i + 1][0];
    const f = (t - t0) / Math.max(1e-6, t1 - t0);
    // só pontilha perto da fronteira (faixas chapadas no meio)
    const k = Math.min(1, Math.max(0, (f - 0.7) / 0.3));
    for (let x = 0; x < w; x++) d[y * w + x] = bayer(x, y) < k ? cols[i + 1] : cols[i];
  }
  ctx.putImageData(img, 0, 0);
}

/** Tira de pixels com x cíclico (a emenda some quando a tira se repete). */
class Strip {
  constructor(w, h, wrapY = false) {
    this.w = w;
    this.h = h;
    this.wrapY = wrapY;
    this.canvas = makeCanvas(w, h);
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(w, h);
    this.d = new Uint32Array(this.img.data.buffer);
    this.cols = new Map();
  }

  col(hex) {
    let v = this.cols.get(hex);
    if (v === undefined) {
      const [r, g, b] = hexToRGB(hex);
      v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      this.cols.set(hex, v);
    }
    return v;
  }

  px(x, y, hex) {
    y = Math.round(y);
    if (this.wrapY) y = ((y % this.h) + this.h) % this.h;
    else if (y < 0 || y >= this.h) return;
    x = ((Math.round(x) % this.w) + this.w) % this.w;
    this.d[y * this.w + x] = this.col(hex);
  }

  rect(x, y, w, h, hex) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, hex);
  }

  disc(cx, cy, r, hex) {
    for (let yy = -r; yy <= r; yy++) {
      const hw = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy + r * 0.8)));
      for (let xx = -hw; xx <= hw; xx++) this.px(cx + xx, cy + yy, hex);
    }
  }

  done() {
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
}

/** Distância horizontal cíclica. */
function wrapDx(x, px, w) {
  let d = x - px;
  if (d > w / 2) d -= w;
  if (d < -w / 2) d += w;
  return d;
}

function hazeOf(theme) {
  return theme.haze || (theme.sky && theme.sky[theme.sky.length - 1][1]) || '#8fd9fd';
}

// ------------------------------------------------------------------ nuvens (Céu, Selva, cinzas)
/** Nuvem de pixel: união de círculos com base reta e 2-3 tons. */
function paintCloud(ctx, cx, by, size, colors, rng) {
  const [c0, c1, c2] = colors;
  const blobs = [];
  const n = 3 + rng.int(3);
  let x = cx - size;
  for (let i = 0; i < n; i++) {
    const r = Math.round(size * (0.45 + rng.next() * 0.45));
    blobs.push([x + r, by - r * 0.8, r]);
    x += r * (1.1 + rng.next() * 0.4);
  }
  const x0 = cx - size - 4;
  const x1 = x + size;
  const y0 = by - size * 2;
  for (let yy = Math.floor(y0); yy <= by; yy++) {
    for (let xx = Math.floor(x0); xx <= x1; xx++) {
      let inside = false;
      let shadeT = 0;
      for (const [bx, byy, r] of blobs) {
        const dx = xx - bx;
        const dy = yy - byy;
        if (dx * dx + dy * dy <= r * r) {
          inside = true;
          shadeT = Math.max(shadeT, (dy + r) / (2 * r));
        }
      }
      if (!inside) continue;
      let col = c0;
      if (yy > by - 3) col = c2;
      else if (shadeT > 0.72) col = c1;
      ctx.fillStyle = col;
      ctx.fillRect(xx, yy, 1, 1);
    }
  }
}

function stripClouds(theme, seed, w, h, big) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = new Rng(seed);
  const colors = theme.cloud || ['#ffffff', '#def3fd', '#b7e7fd'];
  const n = big ? 5 : 8;
  for (let i = 0; i < n; i++) {
    const x = Math.round((i + rng.next() * 0.6) * (w / n));
    const y = Math.round(h * (big ? 0.55 : 0.4) + rng.next() * h * 0.35);
    const size = big ? 16 + rng.int(16) : 8 + rng.int(10);
    paintCloud(ctx, x, y, size, colors, rng);
    // repete no começo para emendar a tira
    if (x + size * 4 > w) paintCloud(ctx, x - w, y, size, colors, new Rng(seed + i));
  }
  return c;
}

function stripCandyIslands(theme, seed, w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = new Rng(seed);
  // perspectiva atmosférica: o fundo se mistura ao céu para não parecer plataforma
  const haze = hazeOf(theme);
  const [top, front, yellow, pink, white, green] = theme.mid.colors.map((c) => mix(c, haze, 0.55));
  const n = 4;
  for (let i = 0; i < n; i++) {
    const iw = 40 + rng.int(40);
    const x = Math.round((i + 0.2 + rng.next() * 0.4) * (w / n));
    const y = Math.round(h * 0.45 + rng.next() * h * 0.3);
    const drawAt = (ox) => {
      ctx.fillStyle = top;
      ctx.fillRect(ox, y, iw, 4);
      ctx.fillStyle = front;
      for (let k = 0; k < 10; k++) ctx.fillRect(ox + k, y + 4 + k, iw - k * 2, 1);
      ctx.fillStyle = yellow;
      ctx.fillRect(ox + 4, y - 1, iw - 8, 1);
      // pirulito
      const lx = ox + 8 + rng.int(Math.max(1, iw - 16));
      ctx.fillStyle = white;
      ctx.fillRect(lx, y - 12, 1, 12);
      ctx.fillStyle = pink;
      ctx.fillRect(lx - 3, y - 18, 7, 6);
      ctx.fillStyle = white;
      ctx.fillRect(lx - 1, y - 16, 2, 2);
      // arbusto
      ctx.fillStyle = green;
      ctx.fillRect(ox + iw - 14, y - 4, 8, 4);
    };
    drawAt(x);
    if (x + iw > w) drawAt(x - w);
  }
  return c;
}

// ------------------------------------------------------------------ Reino Gelado
/** Aurora: cortinas onduladas que se desfazem para baixo (pontilhado), com estrelas. */
function stripAurora(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const skyTop = theme.sky[0][1];
  for (let i = 0; i < 40; i++) {
    const x = rng.int(w);
    const y = rng.int(Math.round(h * 0.45));
    s.px(x, y, mix('#ffffff', skyTop, 0.2 + rng.next() * 0.5));
  }
  const cols = theme.far.colors;
  cols.forEach((c, r) => {
    const base = 26 + r * 20;
    const k1 = 1 + rng.int(3);
    const k2 = 3 + rng.int(3);
    const k3 = 2 + rng.int(4);
    const p1 = rng.next() * TAU;
    const p2 = rng.next() * TAU;
    const p3 = rng.next() * TAU;
    const bright = mix(c, '#ffffff', 0.35);
    const soft = mix(c, skyTop, 0.45);
    for (let x = 0; x < w; x++) {
      const u = (x / w) * TAU;
      const top = base + 10 * Math.sin(k1 * u + p1) + 4 * Math.sin(k2 * u + p2);
      const H = 24 + 10 * Math.sin(k3 * u + p3);
      // raios verticais: algumas colunas mais fracas
      const ray = (x * 7 + r * 13) % 11 < 3 ? 0.55 : 1;
      for (let y = Math.floor(top); y < top + H; y++) {
        const f = (y - top) / H;
        if (bayer(x, y) >= (1 - f) * 0.95 * ray) continue;
        s.px(x, y, f < 0.12 ? bright : f < 0.5 ? c : soft);
      }
    }
  });
  return s.done();
}

/** Cordilheira nevada (dois planos, o de trás mais apagado). */
function stripPeaks(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const haze = hazeOf(theme);
  const [base, snow, shadow, light] = theme.mid.colors;
  const planes = [
    { n: 5, hMin: 50, hMax: 80, fade: 0.62, y0: h - 30 },
    { n: 6, hMin: 60, hMax: 110, fade: 0.38, y0: h },
  ];
  for (const P of planes) {
    const peaks = [];
    for (let i = 0; i < P.n; i++) {
      peaks.push({ x: (i + rng.next() * 0.7) * (w / P.n), hgt: P.hMin + rng.next() * (P.hMax - P.hMin), hw: 50 + rng.next() * 40, snow: 0.3 + rng.next() * 0.15 });
    }
    const C = {
      base: mix(base, haze, P.fade),
      shadow: mix(shadow, haze, P.fade),
      snow: mix(snow, haze, P.fade * 0.6),
      snowShade: mix(light, haze, P.fade * 0.8),
    };
    for (let x = 0; x < w; x++) {
      let best = null;
      let bh = -1;
      let bdx = 0;
      for (const p of peaks) {
        const dx = wrapDx(x, p.x, w);
        const hh = p.hgt * (1 - Math.abs(dx) / p.hw);
        if (hh > bh) {
          bh = hh;
          best = p;
          bdx = dx;
        }
      }
      if (bh <= 0) continue;
      // serrilhado leve no cume
      const jag = ((x * 13) % 7) < 2 ? 1 : 0;
      const ridge = Math.round(P.y0 - bh + jag);
      const snowLine = P.y0 - best.hgt * (1 - best.snow) + (((x * 29) % 9) - 4);
      for (let y = ridge; y < P.y0; y++) {
        const inSnow = y < snowLine;
        const lit = bdx < 0;
        let col;
        if (inSnow) col = lit ? C.snow : C.snowShade;
        else col = lit ? C.base : C.shadow;
        s.px(x, y, col);
      }
    }
  }
  return s.done();
}

/** Pinheiros com neve, dissolvendo em pontilhado embaixo (não parecem chão). */
function stripPines(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const haze = hazeOf(theme);
  const [green, dark, snow] = theme.near.colors.map((c) => mix(c, haze, 0.3));
  const trees = [];
  for (let i = 0; i < 16; i++) trees.push({ x: rng.int(w), hgt: 34 + rng.int(34), seed: rng.int(1000) });
  trees.sort((a, b) => a.hgt - b.hgt);
  const ground = h - 8;
  for (const t of trees) {
    const trunkH = 6;
    const top = ground - t.hgt;
    // tronco
    s.rect(t.x - 1, ground - trunkH, 3, trunkH, dark);
    // três camadas triangulares
    const tiers = 3;
    for (let k = 0; k < tiers; k++) {
      const ty = top + k * ((t.hgt - trunkH) / tiers) * 0.8;
      const th = ((t.hgt - trunkH) / tiers) * 1.3;
      for (let y = 0; y < th; y++) {
        const hw = Math.round((y / th) * (6 + k * 3 + t.hgt * 0.08));
        for (let xx = -hw; xx <= hw; xx++) {
          const snowy = y < 2 || (y === Math.floor(th) - 1 && (xx + t.seed) % 3 === 0);
          s.px(t.x + xx, ty + y, snowy ? snow : xx > hw / 3 ? dark : green);
        }
      }
    }
  }
  // base dissolvendo
  for (let y = ground - 12; y < h; y++) {
    const k = (y - (ground - 12)) / (h - ground + 12);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (s.d[i] && bayer(x, y) < k) s.d[i] = 0;
    }
  }
  return s.done();
}

// ------------------------------------------------------------------ Vulcão
/** Vulcão com rios de lava e cratera brilhando, cordilheira escura atrás. */
function stripVolcano(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const haze = hazeOf(theme);
  const [rock, lava, dark, glow] = theme.mid.colors;
  // cordilheira distante
  const far = mix(dark, haze, 0.5);
  const p1 = rng.next() * TAU;
  for (let x = 0; x < w; x++) {
    const u = (x / w) * TAU;
    const hh = 36 + 12 * Math.sin(3 * u + p1) + 6 * Math.sin(7 * u) + ((x * 13) % 5 < 2 ? 1 : 0);
    for (let y = Math.round(h - hh); y < h; y++) s.px(x, y, far);
  }
  // o vulcão
  const cx = Math.round(w * (0.3 + rng.next() * 0.4));
  const topW = 22;
  const baseW = 210;
  const vh = 124;
  const body = mix(rock, haze, 0.25);
  const shadeC = mix(dark, haze, 0.25);
  for (let x = -baseW; x <= baseW; x++) {
    const ax = Math.abs(x);
    if (ax > baseW) continue;
    const f = ax <= topW ? 0 : (ax - topW) / (baseW - topW);
    // perfil côncavo (encosta mais íngreme perto do topo)
    const hh = vh * (1 - Math.sqrt(f)) ** 1.15;
    const top = Math.round(h - hh);
    for (let y = top; y < h; y++) s.px(cx + x, y, x > 8 ? shadeC : body);
  }
  // cratera
  for (let x = -topW + 2; x <= topW - 2; x++) {
    s.px(cx + x, h - vh, lava);
    s.px(cx + x, h - vh + 1, Math.abs(x) < topW - 6 ? glow : lava);
  }
  // rios de lava serpenteando encosta abaixo
  const rivers = 3;
  for (let r = 0; r < rivers; r++) {
    let x = cx + (r - 1) * 10;
    const dir = r === 0 ? -1 : r === 2 ? 1 : rng.chance(0.5) ? 1 : -1;
    for (let y = h - vh + 2; y < h; y++) {
      const depth = (y - (h - vh)) / vh;
      x += dir * (0.35 + depth * 0.9) + Math.sin(y * 0.3 + r) * 0.6;
      s.px(x, y, depth < 0.25 ? glow : lava);
      if (depth > 0.15) s.px(x + 1, y, lava);
    }
  }
  // brilho na borda da cratera
  for (let k = 0; k < 14; k++) {
    const x = cx - topW + rng.int(topW * 2);
    s.px(x, h - vh - 1 - rng.int(3), glow);
  }
  return s.done();
}

/** Colunas de basalto com rachaduras de lava, base dissolvendo. */
function stripColumns(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const haze = hazeOf(theme);
  const [face, dark, crack] = theme.near.colors;
  const faceC = mix(face, haze, 0.18);
  const darkC = mix(dark, haze, 0.18);
  const topC = mix(face, '#ffffff', 0.12);
  let x = 0;
  while (x < w) {
    // grupo de colunas
    const n = 3 + rng.int(4);
    const baseH = 24 + rng.int(40);
    for (let i = 0; i < n && x < w; i++) {
      const cw = 7 + rng.int(4);
      const ch = Math.max(10, baseH + rng.int(22) - 11);
      const top = h - ch;
      s.rect(x, top, cw, ch, faceC);
      s.rect(x + cw - 2, top, 2, ch, darkC);
      s.rect(x, top, cw, 2, topC);
      s.rect(x, top, 1, ch, darkC);
      if (rng.chance(0.35)) {
        let yy = top + 6 + rng.int(Math.max(1, ch - 12));
        let xx = x + 2 + rng.int(Math.max(1, cw - 4));
        for (let k = 0; k < 6; k++) {
          s.px(xx, yy, crack);
          yy++;
          if (k % 2) xx += rng.chance(0.5) ? 1 : -1;
        }
      }
      x += cw;
    }
    x += 20 + rng.int(60);
  }
  for (let y = h - 14; y < h; y++) {
    const k = (y - (h - 14)) / 14;
    for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx;
      if (s.d[i] && bayer(xx, y) < k) s.d[i] = 0;
    }
  }
  return s.done();
}

// ------------------------------------------------------------------ Templo da Selva
/** Copas da selva em morros + pirâmide de degraus com templo. */
function stripJungle(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const haze = hazeOf(theme);
  const [leaf, leafDark, stone, stoneDark] = theme.mid.colors;
  // pirâmide (atrás das copas)
  const px = Math.round(w * (0.25 + rng.next() * 0.5));
  const steps = 6;
  const stepH = 12;
  const pyTop = h - 20 - steps * stepH;
  const st = mix(stone, haze, 0.35);
  const stD = mix(stoneDark, haze, 0.35);
  for (let k = 0; k < steps; k++) {
    const hw = 20 + (steps - 1 - k) * 14;
    const y0 = pyTop + k * stepH + 14;
    for (let y = y0; y < h; y++) {
      for (let x = -hw; x <= hw; x++) s.px(px + x, y, x > hw - 5 || y === y0 + stepH - 1 ? stD : st);
    }
    // borda iluminada do degrau
    for (let x = -hw; x <= hw; x++) s.px(px + x, y0, mix(st, '#ffffff', 0.25));
  }
  // templo no topo, com porta escura e escadaria central
  s.rect(px - 12, pyTop, 24, 14, st);
  s.rect(px - 14, pyTop - 3, 28, 3, stD);
  s.rect(px - 4, pyTop + 5, 8, 9, mix('#33261a', haze, 0.3));
  for (let y = pyTop + 14; y < h; y++) {
    s.px(px - 4, y, stD);
    s.px(px + 4, y, stD);
  }
  // copas: soma de bolhas em dois planos
  const planes = [
    { n: 18, rMin: 12, rMax: 22, y0: h - 26, fade: 0.45 },
    { n: 16, rMin: 14, rMax: 26, y0: h - 6, fade: 0.25 },
  ];
  for (const P of planes) {
    const trees = [];
    for (let i = 0; i < P.n; i++) trees.push({ x: (i + rng.next() * 0.6) * (w / P.n), r: P.rMin + rng.next() * (P.rMax - P.rMin), dy: rng.int(10) });
    const L = mix(leaf, haze, P.fade);
    const D = mix(leafDark, haze, P.fade);
    const Hl = mix(leaf, '#ffffff', 0.2 - P.fade * 0.2);
    for (let x = 0; x < w; x++) {
      let top = Infinity;
      let who = null;
      for (const t of trees) {
        const dx = wrapDx(x, t.x, w);
        if (Math.abs(dx) > t.r) continue;
        const y = P.y0 - t.dy - Math.sqrt(t.r * t.r - dx * dx);
        if (y < top) {
          top = y;
          who = { dx, t };
        }
      }
      if (!who) continue;
      const y0 = Math.round(top);
      for (let y = y0; y < h; y++) {
        const edge = y - y0;
        let col = edge < 2 ? Hl : who.dx > who.t.r * 0.35 ? D : L;
        // textura de folhas
        if (edge > 3 && (x * 5 + y * 3) % 13 === 0) col = D;
        s.px(x, y, col);
      }
    }
  }
  return s.done();
}

/** Palmeiras e arbustos (com flores) na frente, base dissolvendo. */
function stripPalms(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const haze = hazeOf(theme);
  const [leaf, dark, trunk, flower] = theme.near.colors.map((c) => mix(c, haze, 0.28));
  const ground = h - 6;
  // palmeiras
  for (let i = 0; i < 6; i++) {
    const x0 = (i + rng.next() * 0.6) * (w / 6);
    const th = 50 + rng.int(40);
    const lean = (rng.next() - 0.5) * 0.5;
    let x = x0;
    let tx = x0;
    let ty = ground - th;
    for (let y = ground; y > ground - th; y--) {
      const k = (ground - y) / th;
      x = x0 + lean * th * k * k;
      s.px(x, y, trunk);
      s.px(x + 1, y, (y & 3) === 0 ? dark : trunk);
      s.px(x + 2, y, dark);
      tx = x + 1;
      ty = y;
    }
    // folhas em arco
    for (let f = 0; f < 6; f++) {
      const a = -Math.PI + (f / 5) * Math.PI + (rng.next() - 0.5) * 0.3;
      const len = 18 + rng.int(10);
      for (let k = 0; k < len; k++) {
        const u = k / len;
        const fx = tx + Math.cos(a) * k;
        const fy = ty + Math.sin(a) * k * 0.5 + u * u * 10;
        s.px(fx, fy, leaf);
        s.px(fx, fy + 1, dark);
        if (k % 3 === 0) s.px(fx, fy + 2, dark);
      }
    }
    s.disc(tx, ty + 1, 2, trunk);
  }
  // arbustos
  for (let i = 0; i < 12; i++) {
    const bx = rng.int(w);
    const r = 8 + rng.int(8);
    for (let yy = -r; yy <= 0; yy++) {
      const hw = Math.floor(Math.sqrt(r * r - yy * yy) * 1.4);
      for (let xx = -hw; xx <= hw; xx++) s.px(bx + xx, ground + yy, yy < -r + 2 ? mix(leaf, '#ffffff', 0.15) : xx > hw / 3 ? dark : leaf);
    }
    if (rng.chance(0.6)) {
      s.px(bx - 3, ground - r + 3, flower);
      s.px(bx + 4, ground - r + 5, flower);
    }
  }
  for (let y = h - 16; y < h; y++) {
    const k = (y - (h - 16)) / 16;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (s.d[i] && bayer(x, y) < k) s.d[i] = 0;
    }
  }
  return s.done();
}

// ------------------------------------------------------------------ Estação Espacial
/** Campo de estrelas com nebulosas pontilhadas (repete também na vertical). */
function stripStars(theme, seed, w, h) {
  const s = new Strip(w, h, true);
  const rng = new Rng(seed);
  const [white, blue, neb1, neb2] = theme.far.colors;
  const sky = theme.sky[1][1];
  // nebulosas
  for (let k = 0; k < 3; k++) {
    const nx = rng.int(w);
    const ny = rng.int(h);
    const r = 50 + rng.int(40);
    const col = mix(k % 2 ? neb2 : neb1, sky, 0.62);
    const col2 = mix(k % 2 ? neb2 : neb1, sky, 0.4);
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r * 1.6; xx <= r * 1.6; xx++) {
        const d = Math.sqrt((xx / 1.6) ** 2 + yy * yy) / r;
        const wob = 0.18 * Math.sin(xx * 0.09 + k) * Math.cos(yy * 0.11 + k * 2);
        const dens = 1 - d + wob;
        if (dens <= 0) continue;
        if (bayer(nx + xx, ny + yy) < dens * 0.8) s.px(nx + xx, ny + yy, dens > 0.55 ? col2 : col);
      }
    }
  }
  // estrelas
  for (let i = 0; i < 150; i++) {
    const x = rng.int(w);
    const y = rng.int(h);
    const b = rng.next();
    s.px(x, y, b > 0.7 ? white : b > 0.35 ? blue : mix(blue, sky, 0.5));
  }
  for (let i = 0; i < 10; i++) {
    const x = rng.int(w);
    const y = rng.int(h);
    s.px(x, y, white);
    s.px(x - 1, y, blue);
    s.px(x + 1, y, blue);
    s.px(x, y - 1, blue);
    s.px(x, y + 1, blue);
  }
  return s.done();
}

/** Planeta com anel + lua pequena. */
function stripPlanets(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const [c1, c2, c3, c4] = theme.mid.colors;
  const sky = theme.sky[1][1];
  const shadeOf = (c, k) => mix(c, sky, k);
  const planet = (cx, cy, r, base, band, ring) => {
    const back = [];
    const front = [];
    if (ring) {
      // anel: elipse fina inclinada; metade de trás antes do planeta
      for (let a = 0; a < TAU; a += 0.004) {
        const rx = r * 1.9;
        const ry = r * 0.42;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry - Math.cos(a) * r * 0.18;
        (Math.sin(a) < 0 ? back : front).push([x, y]);
      }
      for (const [x, y] of back) {
        s.px(x, y, shadeOf(ring, 0.35));
        s.px(x, y + 1, shadeOf(ring, 0.55));
      }
    }
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        const d2 = xx * xx + yy * yy;
        if (d2 > r * r) continue;
        const nz = Math.sqrt(1 - d2 / (r * r));
        const lit = (-xx * 0.6 - yy * 0.5) / r + nz * 0.6;
        const stripe = Math.floor((yy + r) / Math.max(3, r / 4) + Math.sin(xx * 0.15) * 0.6) % 3 === 0;
        let col = stripe ? band : base;
        if (lit < 0.05) col = shadeOf(col, 0.55);
        else if (lit < 0.35 && bayer(xx, yy) > lit * 2.4) col = shadeOf(col, 0.35);
        else if (lit > 0.95) col = mix(col, '#ffffff', 0.3);
        s.px(cx + xx, cy + yy, col);
      }
    }
    for (const [x, y] of front) {
      s.px(x, y, ring);
      s.px(x, y + 1, shadeOf(ring, 0.3));
    }
  };
  const px = Math.round(w * (0.2 + rng.next() * 0.2));
  planet(px, Math.round(h * 0.45), 30, c1, c4, c3);
  planet(Math.round(px + w * 0.45), Math.round(h * 0.25), 9, c2, mix(c2, '#ffffff', 0.3), null);
  return s.done();
}

/** Treliças da estação com luzes, colunas dissolvendo para baixo. */
function stripTrusses(theme, seed, w, h) {
  const s = new Strip(w, h);
  const rng = new Rng(seed);
  const haze = hazeOf(theme);
  const [dark, mid, light] = theme.near.colors;
  const D = mix(dark, haze, 0.2);
  const M = mix(mid, haze, 0.2);
  const beams = [
    { y: Math.round(h * 0.28), hh: 10 },
    { y: Math.round(h * 0.62), hh: 8 },
  ];
  for (const B of beams) {
    // viga com contraventamento em X
    for (let x = 0; x < w; x++) {
      s.px(x, B.y, M);
      s.px(x, B.y + B.hh, M);
      s.px(x, B.y + B.hh + 1, D);
      const cell = x % (B.hh * 2);
      const yA = B.y + Math.round((cell / (B.hh * 2)) * B.hh);
      const yB = B.y + B.hh - Math.round((cell / (B.hh * 2)) * B.hh);
      s.px(x, yA, D);
      s.px(x, yB, D);
      if (cell === 0) for (let y = B.y; y <= B.y + B.hh; y++) s.px(x, y, M);
    }
  }
  // colunas verticais descendo
  for (let i = 0; i < 5; i++) {
    const x = Math.round((i + rng.next() * 0.5) * (w / 5));
    for (let y = beams[0].y; y < h; y++) {
      s.px(x, y, M);
      s.px(x + 1, y, M);
      s.px(x + 2, y, D);
      if ((y & 7) === 0) s.px(x + 1, y, D);
    }
  }
  // luzes
  for (let i = 0; i < 14; i++) {
    const B = beams[i % 2];
    const x = rng.int(w);
    s.px(x, B.y - 1, light);
    s.px(x, B.y - 2, mix(light, '#ffffff', 0.5));
  }
  for (let y = h - 24; y < h; y++) {
    const k = (y - (h - 24)) / 24;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (s.d[i] && bayer(x, y) < k) s.d[i] = 0;
    }
  }
  return s.done();
}

// ------------------------------------------------------------------ montagem
// kind → (tema, semente) → { canvas, speed, sy, anchor, tileY? }
const PAINTERS = {
  clouds: (th, sd) => ({ canvas: stripClouds(th, sd, 512, 180, false), speed: 0.06, sy: 0.02, anchor: 0.05 }),
  ash: (th, sd) => ({ canvas: stripClouds(th, sd, 512, 180, false), speed: 0.06, sy: 0.02, anchor: 0.08 }),
  aurora: (th, sd) => ({ canvas: stripAurora(th, sd, 512, 150), speed: 0.04, sy: 0.02, anchor: 0.2 }),
  stars: (th, sd) => ({ canvas: stripStars(th, sd, 512, 384), speed: 0.03, sy: 0.03, anchor: 0.5, tileY: true }),
  candyIslands: (th, sd) => ({ canvas: stripCandyIslands(th, sd, 640, 120), speed: 0.18, sy: 0.08, anchor: 0.38 }),
  peaks: (th, sd) => ({ canvas: stripPeaks(th, sd, 640, 150), speed: 0.12, sy: 0.06, anchor: 0.5 }),
  volcano: (th, sd) => ({ canvas: stripVolcano(th, sd, 640, 160), speed: 0.1, sy: 0.06, anchor: 0.5 }),
  jungle: (th, sd) => ({ canvas: stripJungle(th, sd, 640, 150), speed: 0.14, sy: 0.07, anchor: 0.55 }),
  planets: (th, sd) => ({ canvas: stripPlanets(th, sd, 640, 180), speed: 0.08, sy: 0.04, anchor: 0.35 }),
  cloudBank: (th, sd) => ({ canvas: stripClouds(th, sd, 640, 120, true), speed: 0.35, sy: 0.2, anchor: 0.7 }),
  pines: (th, sd) => ({ canvas: stripPines(th, sd, 640, 110), speed: 0.3, sy: 0.16, anchor: 0.74 }),
  columns: (th, sd) => ({ canvas: stripColumns(th, sd, 640, 100), speed: 0.3, sy: 0.16, anchor: 0.78 }),
  palms: (th, sd) => ({ canvas: stripPalms(th, sd, 640, 120), speed: 0.3, sy: 0.16, anchor: 0.74 }),
  trusses: (th, sd) => ({ canvas: stripTrusses(th, sd, 640, 120), speed: 0.3, sy: 0.16, anchor: 0.72 }),
};

// tiras são caras de gerar: cache por tema/semente (a partida seguinte reaproveita)
const stripCache = new Map();

function layerFor(theme, spec, seed) {
  if (!spec || !PAINTERS[spec.kind]) return null;
  const key = `${theme.id}:${spec.kind}:${seed}`;
  let L = stripCache.get(key);
  if (!L) {
    if (stripCache.size > 24) stripCache.clear();
    L = PAINTERS[spec.kind](theme, seed);
    stripCache.set(key, L);
  }
  return L;
}

export class Parallax {
  constructor(theme, seed = 7) {
    this.theme = theme;
    this.sky = null;
    this.skyKey = '';
    // poucas variações de semente: o cache acerta entre partidas
    const sd = seed & 3;
    this.layers = [layerFor(theme, theme.far || { kind: 'clouds' }, sd), layerFor(theme, theme.mid, sd + 1), layerFor(theme, theme.near || { kind: 'cloudBank' }, sd + 2)].filter(Boolean);
  }

  draw(ctx, camX, camY, vw, vh, levelTopY = -300) {
    const key = `${vw}x${vh}`;
    if (this.skyKey !== key) {
      this.sky = makeCanvas(vw, vh);
      paintSky(this.sky.getContext('2d'), vw, vh, this.theme.sky);
      this.skyKey = key;
    }
    ctx.drawImage(this.sky, 0, 0);
    for (const L of this.layers) {
      const w = L.canvas.width;
      const h = L.canvas.height;
      let y = Math.round(vh * L.anchor - h / 2 - (camY - levelTopY) * L.sy);
      if (L.tileY) y = (((y % h) + h) % h) - h;
      const x0 = -Math.round(((camX * L.speed) % w) + w) % w;
      do {
        for (let x = x0; x < vw; x += w) ctx.drawImage(L.canvas, x, y);
        y += h;
      } while (L.tileY && y < vh);
    }
  }
}

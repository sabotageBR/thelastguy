#!/usr/bin/env node
// Gera os ícones do PWA a partir do sprite do herói (sem dependências).
// Saída: icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png, icon.svg
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Image32 } from './png.mjs';
import { composeFrame, skinPalette } from '../src/gfx/sprites/builder.js';
import { SKINS } from '../src/gfx/sprites/skins.js';
import { FRAMES, FRAME } from '../src/gfx/sprites/poses.js';
import { rgba32 } from '../src/gfx/pixel/palette.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');
mkdirSync(OUT, { recursive: true });

const sk = SKINS[0];
const frame = composeFrame(sk, FRAMES[FRAME.celebrate1][1]);
const pal = skinPalette(sk);
const rgba = frame.toRGBA(pal);
// recorta a caixa do personagem
const bb = frame.bbox();
const cw = bb.x1 - bb.x0 + 1;
const ch = bb.y1 - bb.y0 + 1;
const crop = new Uint32Array(cw * ch);
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) crop[y * cw + x] = rgba[(bb.y0 + y) * 32 + bb.x0 + x];

function icon(size, safe) {
  const img = new Image32(size, size, rgba32('#32b7fd'));
  // faixa de chão amarela quadriculada
  const groundH = Math.round(size * 0.2);
  for (let y = size - groundH; y < size; y++)
    for (let x = 0; x < size; x++) {
      const cell = Math.floor(x / (size / 8)) + Math.floor((y - (size - groundH)) / (size / 16));
      img.px[y * size + x] = cell & 1 ? rgba32('#f9c031') : rgba32('#f5d93c');
    }
  const area = size * (safe ? 0.62 : 0.8);
  const scale = Math.max(1, Math.floor(area / Math.max(cw, ch)));
  const dx = Math.round((size - cw * scale) / 2);
  const dy = size - groundH - ch * scale + Math.round(scale * 1);
  img.blit32(crop, cw, ch, dx, dy, scale);
  return img;
}

writeFileSync(join(OUT, 'icon-192.png'), icon(192, false).toPNG());
writeFileSync(join(OUT, 'icon-512.png'), icon(512, false).toPNG());
writeFileSync(join(OUT, 'maskable-512.png'), icon(512, true).toPNG());
writeFileSync(join(OUT, 'apple-touch-icon.png'), icon(180, false).toPNG());

// SVG em retângulos (crispEdges)
const hex = (v) => '#' + [v & 255, (v >> 8) & 255, (v >> 16) & 255].map((n) => n.toString(16).padStart(2, '0')).join('');
let rects = '';
for (let y = 0; y < ch; y++) {
  let x = 0;
  while (x < cw) {
    const v = crop[y * cw + x];
    if (!(v >>> 24)) {
      x++;
      continue;
    }
    let run = 1;
    while (x + run < cw && crop[y * cw + x + run] === v) run++;
    rects += `<rect x="${x + 4}" y="${y + 3}" width="${run}" height="1" fill="${hex(v)}"/>`;
    x += run;
  }
}
const vb = Math.max(cw, ch) + 8;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" shape-rendering="crispEdges"><rect width="${vb}" height="${vb}" rx="4" fill="#32b7fd"/><rect y="${vb - 4}" width="${vb}" height="4" fill="#f9c031"/>${rects}</svg>`;
writeFileSync(join(OUT, 'icon.svg'), svg);
console.log('ícones gerados em icons/');

#!/usr/bin/env node
// Renderiza os atlas das skins num PNG para inspeção visual.
// Uso: node tools/sprite-sheet.mjs [saida.png] [--scale=3] [--skins=0,1,2] [--frames=0-8]
import { writeFileSync } from 'node:fs';
import { Image32 } from './png.mjs';
import { buildAtlasBuffer, skinPalette } from '../src/gfx/sprites/builder.js';
import { SKINS } from '../src/gfx/sprites/skins.js';
import { FRAMES, ATLAS_COLS, CELL } from '../src/gfx/sprites/poses.js';
import { rgba32 } from '../src/gfx/pixel/palette.js';

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) || 'sprites.png';
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : d;
};
const scale = +opt('scale', 3);
const skinIdx = opt('skins', null) ? opt('skins').split(',').map(Number) : SKINS.map((_, i) => i);
const [f0, f1] = opt('frames', `0-${FRAMES.length - 1}`).split('-').map(Number);
const nf = f1 - f0 + 1;
const pad = 2;
const W = nf * (CELL + pad) * scale;
const H = skinIdx.length * (CELL + pad) * scale;
const img = new Image32(W, H, rgba32('#58c8fd'));
// faixa de "chão" em cada linha
skinIdx.forEach((si, row) => {
  const sk = SKINS[si];
  const atlas = buildAtlasBuffer(sk);
  const pal = skinPalette(sk);
  const rgba = atlas.toRGBA(pal);
  for (let f = f0; f <= f1; f++) {
    const cx = (f % ATLAS_COLS) * CELL;
    const cy = Math.floor(f / ATLAS_COLS) * CELL;
    const cell = new Uint32Array(CELL * CELL);
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) cell[y * CELL + x] = rgba[(cy + y) * atlas.w + cx + x];
    const dx = (f - f0) * (CELL + pad) * scale;
    const dy = row * (CELL + pad) * scale;
    const ground = new Uint32Array(CELL).fill(rgba32('#f5d93c'));
    img.blit32(ground, CELL, 1, dx, dy + CELL * scale, scale);
    img.blit32(cell, CELL, CELL, dx, dy, scale);
  }
});
writeFileSync(out, img.toPNG());
console.log(`ok: ${out} (${W}×${H})`);

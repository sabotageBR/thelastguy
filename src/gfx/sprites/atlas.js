// Atlas em canvas por skin (gerados sob demanda e guardados em cache).
import { buildAtlasBuffer, skinPalette, skinById } from './builder.js';
import { P } from './parts.js';

const cache = new Map();
const flashCache = new Map();

function bufferToCanvas(buf, pal) {
  const c = document.createElement('canvas');
  c.width = buf.w;
  c.height = buf.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(buf.w, buf.h);
  buf.toRGBA(pal, new Uint32Array(img.data.buffer));
  ctx.putImageData(img, 0, 0);
  return c;
}

export function getAtlas(skinIdx) {
  let c = cache.get(skinIdx);
  if (!c) {
    const sk = skinById(skinIdx);
    c = bufferToCanvas(buildAtlasBuffer(sk), skinPalette(sk));
    cache.set(skinIdx, c);
  }
  return c;
}

/** Silhueta branca (piscar de golpe) — só para a skin do jogador humano. */
export function getFlashAtlas(skinIdx) {
  let c = flashCache.get(skinIdx);
  if (!c) {
    const sk = skinById(skinIdx);
    const buf = buildAtlasBuffer(sk);
    const pal = new Uint32Array(64);
    for (let i = 1; i < 64; i++) pal[i] = 0xffffffff;
    pal[P.outline] = 0xff28101a;
    c = bufferToCanvas(buf, pal);
    flashCache.set(skinIdx, c);
  }
  return c;
}

/** Pré-gera atlas de várias skins (durante o lobby). */
export function warmAtlases(skins) {
  for (const s of skins) getAtlas(s);
}

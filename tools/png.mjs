// Encoder PNG mínimo (RGBA 8 bits), sem dependências: zlib do Node + CRC32 próprio.
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** rgba: Uint8Array/Uint8ClampedArray (w*h*4). */
export function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    src.copy(raw, y * stride + 1, y * w * 4, y * w * 4 + w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Imagem RGBA simples para compor em Node. */
export class Image32 {
  constructor(w, h, bg = 0) {
    this.w = w;
    this.h = h;
    this.px = new Uint32Array(w * h).fill(bg);
  }

  /** Copia pixels RGBA (Uint32 0xAABBGGRR) com escala inteira; alfa 0 = transparente. */
  blit32(src, sw, sh, dx, dy, scale = 1) {
    for (let y = 0; y < sh * scale; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < sw * scale; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= this.w) continue;
        const v = src[((y / scale) | 0) * sw + ((x / scale) | 0)];
        if (v >>> 24) this.px[ty * this.w + tx] = v;
      }
    }
  }

  toPNG() {
    return encodePNG(this.w, this.h, new Uint8Array(this.px.buffer));
  }
}

// Gerador pseudoaleatório determinístico (mulberry32) com estado serializável.

export class Rng {
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }

  /** Número em [0, 1). */
  next() {
    let a = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [0, n). */
  int(n) {
    return Math.floor(this.next() * n);
  }

  /** Real em [a, b). */
  range(a, b) {
    return a + (b - a) * this.next();
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[this.int(arr.length)];
  }

  /** Embaralha no lugar (Fisher–Yates) e devolve o próprio array. */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  serialize() {
    return this.s;
  }

  deserialize(s) {
    this.s = s >>> 0;
  }
}

/** Mistura inteiros num hash de 32 bits (para derivar sementes independentes). */
export function hash32(...values) {
  let h = 0x811c9dc5;
  for (const v of values) {
    let x = typeof v === 'string' ? strHash(v) : v | 0;
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff;
      h = Math.imul(h, 0x01000193);
      x >>>= 8;
    }
  }
  // avalanche final
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function strHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Valor pseudoaleatório em [0,1) derivado de inteiros, sem estado. */
export function hashFloat(...values) {
  return hash32(...values) / 4294967296;
}

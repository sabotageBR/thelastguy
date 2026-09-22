// Grade uniforme para broadphase. Itens são inseridos uma vez pelo retângulo que
// cobrem (para coisas que se movem: o envelope de todo o movimento).

export class Grid {
  constructor(x0, y0, x1, y1, cell = 64) {
    this.cell = cell;
    this.ox = Math.floor(x0 / cell);
    this.oy = Math.floor(y0 / cell);
    this.cols = Math.max(1, Math.floor(x1 / cell) - this.ox + 1);
    this.rows = Math.max(1, Math.floor(y1 / cell) - this.oy + 1);
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = null;
    this.items = [];
    this.stamps = new Uint32Array(64);
    this.stamp = 0;
  }

  insert(item, x0, y0, x1, y1) {
    const idx = this.items.length;
    this.items.push(item);
    if (idx >= this.stamps.length) {
      const s = new Uint32Array(this.stamps.length * 2);
      s.set(this.stamps);
      this.stamps = s;
    }
    const c = this.cell;
    const cx0 = Math.max(0, Math.floor(x0 / c) - this.ox);
    const cy0 = Math.max(0, Math.floor(y0 / c) - this.oy);
    const cx1 = Math.min(this.cols - 1, Math.floor((x1 - 1) / c) - this.ox);
    const cy1 = Math.min(this.rows - 1, Math.floor((y1 - 1) / c) - this.oy);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = cy * this.cols + cx;
        if (!this.cells[k]) this.cells[k] = [];
        this.cells[k].push(idx);
      }
    }
    return idx;
  }

  /** Coloca em `out` os itens cujas células tocam o retângulo; devolve a contagem. */
  queryInto(x0, y0, x1, y1, out) {
    let st = ++this.stamp;
    if (st === 0xffffffff) {
      this.stamps.fill(0);
      this.stamp = st = 1;
    }
    const c = this.cell;
    const cx0 = Math.max(0, Math.floor(x0 / c) - this.ox);
    const cy0 = Math.max(0, Math.floor(y0 / c) - this.oy);
    const cx1 = Math.min(this.cols - 1, Math.floor((x1 - 1) / c) - this.ox);
    const cy1 = Math.min(this.rows - 1, Math.floor((y1 - 1) / c) - this.oy);
    let n = 0;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const cell = this.cells[cy * this.cols + cx];
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const idx = cell[i];
          if (this.stamps[idx] === st) continue;
          this.stamps[idx] = st;
          out[n++] = this.items[idx];
        }
      }
    }
    return n;
  }
}

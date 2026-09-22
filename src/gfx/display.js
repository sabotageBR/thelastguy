// Pipeline de exibição: um único canvas de baixa resolução ampliado por CSS
// (image-rendering: pixelated) num fator INTEIRO de pixels do aparelho.

export const MIN_VH = 216;
export const MAX_VH = 336;

/**
 * Escolhe escala inteira `s` e resolução virtual (vw × vh) para a tela.
 * Alvo: 256 linhas em telas de toque, 270 no desktop; sem tarja preta
 * (a sobra vira área visível extra). No desktop, largura limitada (pillarbox).
 */
export function computeLayout(cssW, cssH, dpr, touch, maxVw = 640) {
  const devW = Math.max(1, Math.round(cssW * dpr));
  const devH = Math.max(1, Math.round(cssH * dpr));
  const target = touch ? 256 : 270;
  let best = null;
  for (let s = 1; s <= 16; s++) {
    const vh = Math.ceil(devH / s);
    if (vh < MIN_VH || vh > MAX_VH) continue;
    const d = Math.abs(vh - target);
    if (!best || d < best.d || (d === best.d && s > best.s)) best = { s, vh, d };
  }
  let s = best ? best.s : Math.max(1, Math.round(devH / target));
  let vh = Math.ceil(devH / s);
  let vw = Math.ceil(devW / s);
  // Janelas estreitas (desktop em retrato): garante largura mínima jogável.
  while (!touch && vw < 400 && s > 1) {
    s--;
    vh = Math.ceil(devH / s);
    vw = Math.ceil(devW / s);
  }
  if (!touch) vw = Math.min(vw, maxVw, Math.floor(vh * 2.4));
  if (touch) vw = Math.min(vw, maxVw);
  return { s, vw, vh, devW, devH, dpr, cssPx: s / dpr };
}

export function isTouchDevice() {
  return (
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

export class Display {
  constructor(canvas, root = document.documentElement) {
    this.canvas = canvas;
    this.root = root;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.touch = isTouchDevice();
    this.maxVw = 640;
    this.layout = null;
    this.listeners = new Set();
    this.frozen = false;
    this._pending = false;
    this._devBox = null;

    const schedule = () => this.scheduleResize();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    document.addEventListener('fullscreenchange', schedule);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    this._watchDpr();

    // Tamanho exato em pixels do aparelho, quando suportado (Chromium/Firefox).
    if (typeof ResizeObserver === 'function') {
      try {
        const ro = new ResizeObserver((entries) => {
          const e = entries[0];
          const box = e.devicePixelContentBoxSize && e.devicePixelContentBoxSize[0];
          this._devBox = box ? { w: box.inlineSize, h: box.blockSize } : null;
          schedule();
        });
        ro.observe(canvas.parentElement || document.body, { box: 'device-pixel-content-box' });
      } catch {
        /* navegador sem device-pixel-content-box */
      }
    }

    // Congela o layout enquanto um campo de texto está focado (teclado virtual).
    document.addEventListener('focusin', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) this.frozen = true;
    });
    document.addEventListener('focusout', () => {
      this.frozen = false;
      schedule();
    });
    this.resize();
  }

  _watchDpr() {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onChange = () => {
      this.scheduleResize();
      this._watchDpr();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange, { once: true });
  }

  onResize(fn) {
    this.listeners.add(fn);
    if (this.layout) fn(this.layout);
    return () => this.listeners.delete(fn);
  }

  scheduleResize() {
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => {
      this._pending = false;
      if (!this.frozen) this.resize();
    });
  }

  viewportSize() {
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = this.viewportSize();
    let L = computeLayout(w, h, dpr, this.touch, this.maxVw);
    if (this._devBox && Math.abs(this._devBox.w - L.devW) <= 2 && Math.abs(this._devBox.h - L.devH) <= 2) {
      L = computeLayout(this._devBox.w / dpr, this._devBox.h / dpr, dpr, this.touch, this.maxVw);
    }
    const prev = this.layout;
    this.layout = L;
    const c = this.canvas;
    if (c.width !== L.vw) c.width = L.vw;
    if (c.height !== L.vh) c.height = L.vh;
    const cssW = (L.vw * L.s) / dpr;
    const cssH = (L.vh * L.s) / dpr;
    const leftDev = Math.max(0, Math.floor((L.devW - L.vw * L.s) / 2));
    const topDev = Math.max(0, Math.floor((L.devH - L.vh * L.s) / 2));
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    c.style.left = `${leftDev / dpr}px`;
    c.style.top = `${topDev / dpr}px`;
    // Redimensionar o canvas zera o estado do contexto.
    this.ctx.imageSmoothingEnabled = false;
    const rs = document.documentElement.style;
    rs.setProperty('--px', `${L.cssPx}px`);
    rs.setProperty('--vw', String(L.vw));
    rs.setProperty('--vh', String(L.vh));
    rs.setProperty('--game-left', `${leftDev / dpr}px`);
    rs.setProperty('--game-w', `${cssW}px`);
    rs.setProperty('--game-h', `${Math.min(cssH, h)}px`);
    if (!prev || prev.vw !== L.vw || prev.vh !== L.vh || prev.s !== L.s || prev.dpr !== L.dpr) {
      for (const fn of this.listeners) fn(L);
    }
  }
}

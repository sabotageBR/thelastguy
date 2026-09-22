// Teclado: eixo horizontal + contadores de pressionar (nunca perde toques rápidos).
const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const JUMP = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyK']);
const DIVE = new Set(['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ', 'KeyL']);
const PAUSE = new Set(['Escape', 'KeyP']);
const EMOTE = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
const GAME = new Set([...LEFT, ...RIGHT, ...JUMP, ...DIVE, 'ArrowDown', 'Tab']);

export class Keyboard {
  constructor() {
    this.keys = new Set();
    this.jumpSerial = 0;
    this.diveSerial = 0;
    this.pauseSerial = 0;
    this.emoteSerial = 0;
    this.emote = 0;
    this.lastUse = 0;
    this.enabled = true;
    this.listeners = new Set();
    window.addEventListener('keydown', (e) => this.onDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  onDown(e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (GAME.has(e.code) && !(tag === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter'))) e.preventDefault();
    for (const fn of this.listeners) fn(e);
    if (e.repeat) return;
    this.keys.add(e.code);
    this.lastUse = performance.now();
    if (!this.enabled) return;
    if (JUMP.has(e.code)) this.jumpSerial++;
    if (DIVE.has(e.code)) this.diveSerial++;
    if (PAUSE.has(e.code)) this.pauseSerial++;
    if (EMOTE[e.code]) {
      this.emote = EMOTE[e.code];
      this.emoteSerial++;
    }
  }

  onKey(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  axis() {
    if (!this.enabled) return 0;
    let a = 0;
    if (LEFT.some((k) => this.keys.has(k))) a -= 1;
    if (RIGHT.some((k) => this.keys.has(k))) a += 1;
    return a;
  }

  get jumpHeld() {
    if (!this.enabled) return false;
    for (const k of JUMP) if (this.keys.has(k)) return true;
    return false;
  }
}

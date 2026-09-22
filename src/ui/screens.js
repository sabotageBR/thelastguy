// Gerenciador de telas (DOM): mostra uma tela por vez, navegação por teclado/gamepad
// e botão "voltar" do Android (history).

export function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

export class ScreenManager {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.cur = null;
    this.depth = 0;
    window.addEventListener('popstate', () => {
      if (this.cur && this.cur.back) {
        this.cur.back();
        history.pushState({ tlg: 1 }, '');
      }
    });
    history.replaceState({ tlg: 0 }, '');
    history.pushState({ tlg: 1 }, '');
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Mostra uma tela: fn(app, params) → { el, name, back?, onKey?, dispose?, tick? }. */
  show(fn, params) {
    this.clear();
    const s = fn(this.app, params || {});
    this.cur = s;
    this.root.append(s.el);
    requestAnimationFrame(() => {
      if (this.cur !== s) return;
      const first = s.el.querySelector('[autofocus]') || s.el.querySelector('.btn:not([disabled]), .card, .skin-grid button');
      if (first && !this.app.touchMode) first.focus({ preventScroll: true });
    });
    return s;
  }

  clear() {
    if (this.cur && this.cur.dispose) this.cur.dispose();
    this.cur = null;
    this.root.innerHTML = '';
  }

  get active() {
    return !!this.cur;
  }

  focusables() {
    if (!this.cur) return [];
    return [...this.cur.el.querySelectorAll('.btn:not([disabled]), .card, .skin-grid button, .seg button, input')].filter((e) => e.offsetParent !== null);
  }

  move(dir) {
    const list = this.focusables();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const n = i < 0 ? 0 : (i + dir + list.length) % list.length;
    list[n].focus({ preventScroll: false });
    this.app.sfx.ui('hover');
  }

  onKey(e) {
    if (!this.cur) return;
    if (this.cur.onKey && this.cur.onKey(e)) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' && e.key !== 'Escape' && e.key !== 'Enter') return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        this.move(1);
        e.preventDefault();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        this.move(-1);
        e.preventDefault();
        break;
      case 'Escape':
      case 'Backspace':
        if (tag === 'INPUT' && e.key === 'Backspace') return;
        if (this.cur.back) {
          this.app.sfx.ui('back');
          this.cur.back();
        }
        e.preventDefault();
        break;
      default:
        break;
    }
  }

  /** Gamepad: d-pad navega, A confirma, B volta (chamado pelo app a cada frame). */
  gamepad(pad) {
    if (!this.cur || !pad.connected) return;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    if (!gp) return;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const st = { up: b(12), down: b(13), left: b(14), right: b(15), a: b(0), b: b(1) };
    const prev = this._gp || {};
    if ((st.down && !prev.down) || (st.right && !prev.right)) this.move(1);
    if ((st.up && !prev.up) || (st.left && !prev.left)) this.move(-1);
    if (st.a && !prev.a && document.activeElement && document.activeElement.click) document.activeElement.click();
    if (st.b && !prev.b && this.cur.back) this.cur.back();
    this._gp = st;
  }
}

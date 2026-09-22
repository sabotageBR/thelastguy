// Controles de toque (como nos mockups): joystick flutuante na metade esquerda
// (só o eixo x importa) e botão de pulo redondo à direita. Tocar de novo no ar = mergulho.
// Pointer Events + multitoque por pointerId.

export class TouchControls {
  constructor(root) {
    this.root = root;
    this.enabled = false;
    this.visible = false;
    this.axisX = 0;
    this.joyId = null;
    this.jumpIds = new Set();
    this.diveIds = new Set();
    this.jumpSerial = 0;
    this.diveSerial = 0;
    this.lastUse = 0;
    this.opts = { size: 1, leftHanded: false, diveButton: false, arrows: false };
    this.R = 56;

    root.innerHTML = '';
    this.zoneL = el('div', 'tz tz-left');
    this.zoneR = el('div', 'tz tz-right');
    this.joy = el('div', 'joy');
    this.knob = el('div', 'joy-knob');
    this.joy.append(this.knob, el('i', 'joy-arrow l'), el('i', 'joy-arrow r'));
    this.jumpBtn = el('div', 'tbtn tbtn-jump');
    this.jumpBtn.innerHTML = '<i class="arrow-up"></i>';
    this.diveBtn = el('div', 'tbtn tbtn-dive');
    this.diveBtn.innerHTML = '<i class="arrow-dive"></i>';
    this.arrowL = el('div', 'tbtn tarrow tarrow-l');
    this.arrowR = el('div', 'tbtn tarrow tarrow-r');
    root.append(this.zoneL, this.zoneR, this.joy, this.jumpBtn, this.diveBtn, this.arrowL, this.arrowR);

    const down = (e) => this.onDown(e);
    this.zoneL.addEventListener('pointerdown', down);
    this.zoneR.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: true });
    const up = (e) => this.onUp(e);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.zoneL.addEventListener('lostpointercapture', up);
    this.zoneR.addEventListener('lostpointercapture', up);
    window.addEventListener('resize', () => this.layout());
    this.setEnabled(false);
    this.layout();
  }

  configure(o) {
    Object.assign(this.opts, o);
    this.layout();
  }

  setEnabled(on) {
    this.enabled = on;
    this.root.classList.toggle('on', on && this.visible);
    if (!on) this.reset();
  }

  setVisible(v) {
    this.visible = v;
    this.root.classList.toggle('on', this.enabled && v);
  }

  reset() {
    this.axisX = 0;
    this.joyId = null;
    this.jumpIds.clear();
    this.diveIds.clear();
    this.joy.classList.remove('active');
    this.jumpBtn.classList.remove('pressed');
    this.diveBtn.classList.remove('pressed');
    this.placeGhost();
  }

  layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const short = Math.min(w, h);
    const k = this.opts.size || 1;
    this.R = Math.max(40, Math.min(72, short * 0.12)) * k;
    const jd = Math.max(64, Math.min(110, short * 0.2)) * k;
    const lh = this.opts.leftHanded;
    const r = this.root.style;
    r.setProperty('--joy-r', `${this.R}px`);
    r.setProperty('--jump-d', `${jd}px`);
    this.zoneL.style.cssText = lh ? 'right:0;left:auto' : '';
    this.zoneR.style.cssText = lh ? 'left:0;right:auto' : '';
    this.jumpBtn.classList.toggle('lh', lh);
    this.diveBtn.classList.toggle('lh', lh);
    this.diveBtn.style.display = this.opts.diveButton ? '' : 'none';
    const arrows = this.opts.arrows;
    this.arrowL.style.display = arrows ? '' : 'none';
    this.arrowR.style.display = arrows ? '' : 'none';
    this.joy.style.display = arrows ? 'none' : '';
    this.placeGhost();
  }

  placeGhost() {
    if (this.joyId !== null) return;
    const sa = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-l')) || 0;
    const x = this.opts.leftHanded ? window.innerWidth - (this.R + 28 + sa) : this.R + 28 + sa;
    const y = window.innerHeight - (this.R + 28);
    this.setJoyPos(x, y, 0);
    this.joy.classList.remove('active');
  }

  setJoyPos(x, y, knobDx) {
    this.joyX0 = x;
    this.joyY0 = y;
    this.joy.style.transform = `translate(${x - this.R}px, ${y - this.R}px)`;
    this.knob.style.transform = `translate(${knobDx}px, 0)`;
  }

  isLeftZone(e) {
    return e.currentTarget === this.zoneL;
  }

  onDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.lastUse = performance.now();
    const left = this.isLeftZone(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignora */
    }
    if (left) {
      if (this.opts.arrows) {
        const dir = e.clientX < (this.opts.leftHanded ? window.innerWidth * 0.75 : window.innerWidth * 0.25) ? -1 : 1;
        this.joyId = e.pointerId;
        this.axisX = dir;
        this.arrowL.classList.toggle('pressed', dir < 0);
        this.arrowR.classList.toggle('pressed', dir > 0);
        return;
      }
      if (this.joyId !== null) return;
      this.joyId = e.pointerId;
      const x = Math.max(this.R + 8, Math.min(window.innerWidth - this.R - 8, e.clientX));
      const y = Math.max(this.R + 8, Math.min(window.innerHeight - this.R - 8, e.clientY));
      this.setJoyPos(x, y, 0);
      this.joy.classList.add('active');
      this.axisX = 0;
    } else {
      // botão de mergulho separado (opcional): metade de cima da zona direita perto do botão
      if (this.opts.diveButton && this.hitDive(e)) {
        this.diveIds.add(e.pointerId);
        this.diveSerial++;
        this.diveBtn.classList.add('pressed');
        return;
      }
      this.jumpIds.add(e.pointerId);
      this.jumpSerial++;
      this.jumpBtn.classList.add('pressed');
    }
  }

  hitDive(e) {
    const r = this.diveBtn.getBoundingClientRect();
    const pad = 16;
    return e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
  }

  onMove(e) {
    if (e.pointerId !== this.joyId || this.opts.arrows) return;
    let dx = e.clientX - this.joyX0;
    const R = this.R;
    if (Math.abs(dx) > R) {
      // a base acompanha o dedo
      this.joyX0 = e.clientX - Math.sign(dx) * R;
      dx = Math.sign(dx) * R;
      this.joy.style.transform = `translate(${this.joyX0 - R}px, ${this.joyY0 - R}px)`;
    }
    const n = dx / R;
    const m = Math.min(1, Math.max(0, (Math.abs(n) - 0.2) / 0.4));
    this.axisX = Math.sign(n) * m;
    this.knob.style.transform = `translate(${dx}px, 0)`;
  }

  onUp(e) {
    const id = e.pointerId;
    if (id === this.joyId) {
      this.joyId = null;
      this.axisX = 0;
      this.arrowL.classList.remove('pressed');
      this.arrowR.classList.remove('pressed');
      this.placeGhost();
    }
    if (this.jumpIds.delete(id) && this.jumpIds.size === 0) this.jumpBtn.classList.remove('pressed');
    if (this.diveIds.delete(id) && this.diveIds.size === 0) this.diveBtn.classList.remove('pressed');
  }

  get jumpHeld() {
    return this.jumpIds.size > 0;
  }
}

function el(tag, cls) {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

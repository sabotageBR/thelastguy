// HUD (DOM): objetivo, contador, cronômetro, posição, contagem, faixas e espectador.
// Só escreve no DOM quando um valor muda.

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = '';
    this.obj = el('div', 'hud-panel hud-objective');
    this.objTab = el('div', 'tab', '<span>Objetivo</span>');
    this.objBody = el('div', 'body', '<span></span>');
    this.obj.append(this.objTab, this.objBody);
    this.counter = el('div', 'hud-panel hud-counter');
    this.cTab = el('div', 'tab', '<span>Qualificado</span>');
    this.cBody = el('div', 'body', '<b>0/16</b>');
    this.counter.append(this.cTab, this.cBody);
    this.timer = el('div', 'hud-timer');
    this.pos = el('div', 'hud-pos');
    this.pause = el('button', 'hud-pause');
    this.pause.setAttribute('aria-label', 'Pausar');
    this.center = el('div', 'hud-center');
    this.count = el('div', 'hud-count');
    this.banner = el('div', 'hud-banner');
    this.center.append(this.count, el('br'), this.banner);
    this.spec = el('div', 'hud-spectate');
    this.specPrev = el('button', '', '◀');
    this.specName = el('div', 'name', '');
    this.specNext = el('button', '', '▶');
    this.specSpeed = el('button', 'wide', '1×');
    this.specLeave = el('button', 'wide', 'Sair');
    this.spec.append(this.specPrev, this.specName, this.specNext, this.specSpeed, this.specLeave);
    root.append(this.obj, this.counter, this.timer, this.pos, this.pause, this.center, this.spec);
    this.cache = {};
    this.bannerTimer = 0;
    this.countTimer = 0;
    this.collapseAt = 0;
    this.setVisible(false);
  }

  setVisible(v) {
    this.root.classList.toggle('off', !v);
  }

  set(key, fn, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(value);
  }

  setObjective(text, collapseAfter = 5) {
    this.set('obj', (v) => (this.objBody.firstChild.textContent = v), text);
    this.obj.classList.remove('collapsed');
    this.collapseAt = performance.now() + collapseAfter * 1000;
  }

  setCounter(label, value, sub = '') {
    this.set('cl', (v) => (this.cTab.firstChild.textContent = v), label);
    this.set('cv', (v) => {
      this.cBody.innerHTML = `<div class="cval"><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
      this.counter.classList.remove('pop');
      void this.counter.offsetWidth;
      this.counter.classList.add('pop');
    }, value + '|' + sub);
  }

  setGold(on) {
    this.set('gold', (v) => this.counter.classList.toggle('gold', v), on);
  }

  setTimer(sec) {
    const txt = sec === null || sec === undefined ? '' : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    this.set('timer', (v) => {
      this.timer.textContent = v;
      this.timer.style.display = v ? '' : 'none';
    }, txt);
    this.set('warn', (v) => this.timer.classList.toggle('warn', v), sec !== null && sec !== undefined && sec <= 10);
  }

  setPosition(n) {
    this.set('pos', (v) => (this.pos.innerHTML = v ? `Posição <b>${v}º</b>` : ''), n || 0);
  }

  showCount(text, go = false) {
    this.count.textContent = text;
    this.count.classList.remove('show', 'go');
    void this.count.offsetWidth;
    this.count.classList.add('show');
    if (go) this.count.classList.add('go');
    this.countTimer = performance.now() + (go ? 900 : 950);
  }

  showBanner(text, kind = '', sub = '', ms = 2200) {
    this.banner.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    this.banner.className = 'hud-banner';
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    if (kind) this.banner.classList.add(kind);
    this.bannerTimer = ms ? performance.now() + ms : 0;
  }

  hideBanner() {
    this.banner.classList.remove('show');
    this.bannerTimer = 0;
  }

  showSpectate(on, name = '') {
    this.spec.classList.toggle('show', on);
    if (on) this.specName.textContent = `Assistindo: ${name}`;
  }

  tick() {
    const now = performance.now();
    if (this.countTimer && now > this.countTimer) {
      this.count.classList.remove('show');
      this.countTimer = 0;
    }
    if (this.bannerTimer && now > this.bannerTimer) this.hideBanner();
    if (this.collapseAt && now > this.collapseAt) {
      this.obj.classList.add('collapsed');
      this.collapseAt = 0;
    }
  }
}

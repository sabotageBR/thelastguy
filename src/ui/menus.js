// Telas de menu: título, principal, mundos, treino, personagem, configurações.
import { h } from './screens.js';
import { skinThumb, worldPreview, drawFrame, canvas } from './preview.js';
import { WORLDS, SLOT_LABEL, SLOT_TYPES } from '../sim/levels/worlds.js';
import { levelMeta } from '../sim/levels/catalog.js';
import { SKINS } from '../gfx/sprites/skins.js';
import { FRAME } from '../gfx/sprites/poses.js';
import { BOT_NAMES } from '../sim/bots/names.js';

function btn(label, onclick, cls = '', app = null) {
  return h('button', {
    class: `btn ${cls}`,
    onclick: (e) => {
      if (app) app.sfx.ui('click');
      onclick(e);
    },
    text: label,
  });
}

export function titleScreen(app) {
  const go = () => {
    app.sfx.ui('click');
    app.audio.unlock();
    app.showMenu();
  };
  const el = h(
    'div',
    { class: 'screen', onpointerup: go },
    h('div', { class: 'logo', html: 'THE <span class="accent">LAST</span><br>GUY<small>BATTLE ROYALE DE OBSTÁCULOS</small>' }),
    h('div', { class: 'hint blink', text: app.touchMode ? 'Toque para jogar' : 'Pressione Enter para jogar' }),
  );
  return {
    name: 'title',
    el,
    onKey: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        go();
        return true;
      }
      return false;
    },
  };
}

/** Personagem animado num canvas (idle/corrida/comemoração alternando). */
function livePreview(app, skinIdx, size = 64) {
  const c = canvas(32, 32);
  c.style.width = `calc(${size} * var(--u))`;
  c.style.height = `calc(${size} * var(--u))`;
  let t = 0;
  const frames = [FRAME.idle0, FRAME.idle1, FRAME.idle0, FRAME.idle1, FRAME.run0, FRAME.run1, FRAME.run2, FRAME.run3, FRAME.run4, FRAME.run5, FRAME.celebrate0, FRAME.celebrate1, FRAME.celebrate2, FRAME.celebrate3];
  let skin = skinIdx;
  const tick = () => {
    t++;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 32, 32);
    const f = frames[Math.floor(t / 8) % frames.length];
    drawFrame(ctx, skin, f, 0, 0);
  };
  tick();
  const id = setInterval(tick, 1000 / 12);
  return { el: c, set: (s) => (skin = s), dispose: () => clearInterval(id) };
}

export function mainMenu(app) {
  const s = app.settings;
  const prev = livePreview(app, s.get('skin'), 64);
  const name = s.get('name') || 'Você';
  const st = s.stats;
  const el = h(
    'div',
    { class: 'screen dim' },
    h('div', { class: 'logo', style: 'font-size:calc(24 * var(--u));margin-bottom:calc(8 * var(--u))', html: 'THE <span class="accent">LAST</span> GUY' }),
    h(
      'div',
      { class: 'main-menu' },
      h(
        'div',
        { class: 'panel player-card' },
        h('div', { class: 'tab', text: 'Você' }),
        prev.el,
        h('div', { class: 'pname', text: name }),
        h('div', { class: 'stats-line', text: `Coroas: ${st.crowns} · Partidas: ${st.matches}` }),
        btn('Personagem', () => app.showCharacter(), 'small', app),
      ),
      h(
        'div',
        { class: 'menu-col' },
        btn('JOGAR', () => app.showWorlds(), 'big yellow', app),
        btn('Partida rápida', () => app.startTournament({ mode: 'quick' }), 'big', app),
        btn('Treino', () => app.showTraining(), 'big', app),
        btn('Configurações', () => app.showSettings(), 'big gray', app),
      ),
    ),
  );
  return { name: 'menu', el, back: () => app.showTitle(), dispose: () => prev.dispose() };
}

function phaseList(world, app) {
  return h(
    'ol',
    {},
    world.phases.map((id, k) => {
      const m = levelMeta(id);
      const label = SLOT_LABEL[SLOT_TYPES[k]];
      return h('li', {}, h('span', { text: label + ': ' }), m ? m.name : 'em breve');
    }),
  );
}

export function worldsScreen(app) {
  const cards = WORLDS.map((w, i) => {
    const ready = app.worldReady(w.id);
    const c = worldPreview(w.id, [app.settings.get('skin'), (i * 5 + 3) % 20, (i * 7 + 9) % 20]);
    const img = canvas(c.width, c.height);
    img.getContext('2d').drawImage(c, 0, 0);
    const card = h(
      'div',
      {
        class: `panel card${ready ? '' : ' soon'}`,
        tabindex: 0,
        onclick: () => {
          if (!ready) {
            app.toast('Este mundo ainda está em construção');
            return;
          }
          app.sfx.ui('click');
          app.startTournament({ mode: 'world', world: w.id });
        },
        onkeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') card.click();
        },
      },
      img,
      h('h3', {}, w.name, ready ? null : h('span', { class: 'badge', text: 'EM BREVE' })),
      h('div', { class: 'tagline', text: w.tagline }),
      phaseList(w, app),
    );
    return card;
  });
  const el = h(
    'div',
    { class: 'screen dim' },
    h('div', { class: 'topbar' }, btn('◀ Voltar', () => app.showMenu(), 'small gray', app), h('h1', { class: 'shadowtxt', text: 'Escolha o mundo' })),
    h('div', { class: 'cards' }, cards),
    h('div', { class: 'hint', style: 'margin-top:0;font-size:calc(8 * var(--u))', text: 'Cada mundo é um torneio de 4 fases — o último de pé leva a coroa!' }),
  );
  return { name: 'worlds', el, back: () => app.showMenu() };
}

export function trainingScreen(app, params) {
  let world = params.world || 'ceu';
  let phase = params.phase ?? 0;
  let bots = params.bots ?? 15;
  const el = h('div', { class: 'screen dim' });
  const render = () => {
    el.innerHTML = '';
    const w = WORLDS.find((x) => x.id === world);
    el.append(
      h('div', { class: 'topbar' }, btn('◀ Voltar', () => app.showMenu(), 'small gray', app), h('h1', { class: 'shadowtxt', text: 'Treino' })),
      h(
        'div',
        { class: 'panel', style: 'min-width:calc(260 * var(--u))' },
        h('div', { class: 'tab', text: 'Escolha a fase' }),
        h(
          'div',
          { class: 'settings', style: 'grid-template-columns:auto 1fr' },
          h('label', { text: 'Mundo' }),
          seg(
            WORLDS.map((x) => [x.id, x.name.split(' ')[0]]),
            world,
            (v) => {
              world = v;
              phase = 0;
              render();
            },
            (id) => app.worldReady(id),
          ),
          h('label', { text: 'Fase' }),
          seg(
            w.phases.map((id, k) => [k, `${k + 1}. ${SLOT_LABEL[SLOT_TYPES[k]]}`]),
            phase,
            (v) => {
              phase = v;
              render();
            },
            (k) => !!levelMeta(w.phases[k]),
          ),
          h('label', { text: 'Bots' }),
          seg(
            [[0, 'Nenhum'], [7, '7'], [15, '15'], [31, '31']],
            bots,
            (v) => {
              bots = v;
              render();
            },
          ),
        ),
        h('p', { style: 'margin-top:calc(4 * var(--u))', text: levelMeta(w.phases[phase]) ? `“${levelMeta(w.phases[phase]).name}”` : 'Fase em construção' }),
        h('div', { class: 'row' }, btn('Começar', () => app.startTraining(w.phases[phase], bots), 'yellow', app)),
      ),
    );
  };
  render();
  return { name: 'training', el, back: () => app.showMenu() };
}

function seg(options, value, onpick, enabled = () => true) {
  return h(
    'div',
    { class: 'seg' },
    options.map(([v, label]) =>
      h('button', {
        class: v === value ? 'on' : '',
        disabled: !enabled(v),
        onclick: () => onpick(v),
        text: label,
      }),
    ),
  );
}

export function characterScreen(app) {
  const s = app.settings;
  let skin = s.get('skin');
  const prev = livePreview(app, skin, 96);
  const sname = h('div', { class: 'sname', text: SKINS[skin].name });
  const input = h('input', { class: 'name-input', maxlength: 12, value: s.get('name') || '', placeholder: 'Seu apelido' });
  input.addEventListener('change', () => s.set('name', input.value.trim().slice(0, 12)));
  const grid = h(
    'div',
    { class: 'skin-grid' },
    SKINS.map((sk, i) => {
      const b = h('button', {
        class: i === skin ? 'sel' : '',
        title: sk.name,
        onclick: () => {
          skin = i;
          s.set('skin', i);
          prev.set(i);
          sname.textContent = sk.name;
          grid.querySelectorAll('button').forEach((x, j) => x.classList.toggle('sel', j === i));
          app.sfx.ui('click');
        },
      });
      b.append(skinThumb(i));
      return b;
    }),
  );
  const random = () => {
    input.value = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)].slice(0, 12);
    s.set('name', input.value);
  };
  const el = h(
    'div',
    { class: 'screen dim' },
    h('div', { class: 'topbar' }, btn('◀ Voltar', () => app.showMenu(), 'small gray', app), h('h1', { class: 'shadowtxt', text: 'Personagem' })),
    h(
      'div',
      { class: 'char-screen' },
      h('div', { class: 'panel char-preview' }, h('div', { class: 'tab', text: 'Visual' }), prev.el, sname, input, h('div', { class: 'row' }, btn('Aleatório', random, 'small', app))),
      h('div', { class: 'panel', style: 'display:flex' }, h('div', { class: 'tab', text: '20 personagens' }), grid),
    ),
  );
  return {
    name: 'character',
    el,
    back: () => {
      s.set('name', input.value.trim().slice(0, 12));
      app.showMenu();
    },
    dispose: () => prev.dispose(),
  };
}

export function settingsScreen(app, params) {
  const s = app.settings;
  const el = h('div', { class: 'screen dim' });
  const back = () => (params.from === 'pause' ? app.showPause() : app.showMenu());
  const render = () => {
    el.innerHTML = '';
    const slider = (k) => {
      const i = h('input', { type: 'range', class: 'slider', min: 0, max: 1, step: 0.05, value: s.get(k) });
      i.addEventListener('input', () => s.set(k, +i.value));
      return i;
    };
    const pick = (k, opts) => seg(opts, s.get(k), (v) => {
      s.set(k, v);
      render();
    });
    const onoff = (k) => pick(k, [[true, 'Sim'], [false, 'Não']]);
    el.append(
      h('div', { class: 'topbar' }, btn('◀ Voltar', back, 'small gray', app), h('h1', { class: 'shadowtxt', text: 'Configurações' })),
      h(
        'div',
        { class: 'panel' },
        h('div', { class: 'tab', text: 'Jogo' }),
        h(
          'div',
          { class: 'settings' },
          h('label', { text: 'Música' }),
          slider('music'),
          h('label', { text: 'Efeitos' }),
          slider('sfx'),
          h('label', { text: 'Dificuldade dos bots' }),
          pick('difficulty', [['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']]),
          h('label', { text: 'Qualidade' }),
          pick('quality', [['auto', 'Auto'], ['high', 'Alta'], ['medium', 'Média'], ['low', 'Baixa']]),
          h('label', { text: 'Tremor de tela' }),
          onoff('shake'),
          h('label', { text: 'Vibração' }),
          onoff('vibrate'),
          h('label', { text: 'Mostrar FPS' }),
          onoff('fps'),
          h('label', { text: 'Controle (toque)' }),
          pick('controls', [['joystick', 'Joystick'], ['arrows', 'Setas']]),
          h('label', { text: 'Botão de mergulho' }),
          onoff('diveButton'),
          h('label', { text: 'Tamanho dos botões' }),
          pick('buttonSize', [[0.85, 'P'], [1, 'M'], [1.2, 'G']]),
          h('label', { text: 'Modo canhoto' }),
          onoff('leftHanded'),
        ),
        h('div', { class: 'row', style: 'margin-top:calc(4 * var(--u))' }, btn('Tela cheia', () => app.toggleFullscreen(), 'small', app)),
      ),
    );
  };
  render();
  return { name: 'settings', el, back };
}

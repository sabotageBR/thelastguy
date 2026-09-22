// Telas do fluxo da partida: lobby, apresentação da rodada, resultados, vencedor, pausa.
import { h } from './screens.js';
import { headThumb, drawFrame, canvas } from './preview.js';
import { FRAME } from '../gfx/sprites/poses.js';
import { levelMeta } from '../sim/levels/catalog.js';
import { SLOT_LABEL } from '../sim/levels/worlds.js';

function btn(label, onclick, cls, app) {
  return h('button', {
    class: `btn ${cls || ''}`,
    onclick: () => {
      app.sfx.ui('click');
      onclick();
    },
    text: label,
  });
}

function pickTip(world) {
  const own = WORLD_TIPS[world];
  const pool = own && Math.random() < 0.6 ? own : TIPS;
  return pool[Math.floor(Math.random() * pool.length)];
}

const TIPS = [
  'Dica: segure o pulo para pular mais alto.',
  'Dica: aperte pulo de novo no ar para MERGULHAR e ir mais longe.',
  'Dica: quando cair, aperte pulo várias vezes para levantar mais rápido.',
  'Dica: os martelos seguem um ritmo — observe antes de passar.',
  'Dica: nas corridas, cair não elimina — você volta no último checkpoint.',
  'Dica: na sobrevivência e na final, cair é eliminação!',
  'Dica: paredes baixas: pule. Paredes altas: fique no chão.',
];

// dicas de cada mundo (aparecem mais quando o torneio é daquele mundo)
const WORLD_TIPS = {
  ceu: ['Dica: os blocos roxos empurram — espere o vão abrir.', 'Dica: o wafer racha logo depois que você pisa: não pare em cima!'],
  gelo: [
    'Dica: no gelo você escorrega — comece a frear antes.',
    'Dica: na Avalanche, pare dentro dos nichos e deixe a bola gigante passar por cima.',
    'Dica: rajadas de vento empurram para trás: pule quando o vento parar.',
  ],
  vulcao: [
    'Dica: espere em cima do gêiser: a erupção leva você até o próximo.',
    'Dica: jangadas afundam mais rápido com muita gente em cima.',
    'Dica: na Torre de Magma, suba sem parar — a lava não espera.',
  ],
  selva: [
    'Dica: dardo pela boca do ídolo = pule; pelos olhos = fique no chão.',
    'Dica: tronco BAIXO do totem: pule. Tronco ALTO: não pule!',
    'Dica: "PEDRA!" — corra, ela não para.',
  ],
  espaco: [
    'Dica: a gravidade é baixa — o pulo vai longe e demora para cair.',
    'Dica: na Varredura Laser, o laser elimina na hora. Olhe o aviso pontilhado.',
    'Dica: perto do buraco negro, pular puxa você para ele.',
  ],
};

export function lobbyScreen(app, { roster, onDone, fast, world }) {
  const n = roster.length;
  const grid = h('div', { class: 'lobby-grid', style: n <= 16 ? 'grid-template-columns:repeat(8, calc(26 * var(--u)))' : '' });
  const slots = roster.map(() => h('div', { class: 'slot' }));
  slots.forEach((s) => grid.append(s));
  const counter = h('b', { text: `0/${n}` });
  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'panel', style: 'text-align:center' },
      h('div', { class: 'tab', text: 'Partida' }),
      h('h2', {}, 'Procurando jogadores… ', counter),
      grid,
      h('div', { class: 'tip', text: pickTip(world) }),
    ),
  );
  let i = 0;
  const order = roster.map((r, k) => k);
  const step = fast ? 25 : Math.max(35, Math.round(2200 / n));
  const id = setInterval(() => {
    if (i >= n) {
      clearInterval(id);
      setTimeout(onDone, fast ? 150 : 500);
      return;
    }
    const k = order[i];
    const r = roster[k];
    const s = slots[k];
    s.classList.add('in');
    if (r.human) s.classList.add('you');
    s.append(headThumb(r.skin));
    s.title = r.name;
    counter.textContent = `${i + 1}/${n}`;
    if (i % 2 === 0) app.sfx.ui('join');
    i++;
  }, step);
  return { name: 'lobby', el, dispose: () => clearInterval(id) };
}

export function introCard(app, { cfg, level }) {
  const type = level.type;
  const rule =
    type === 'race'
      ? `Os ${cfg.quota} primeiros se classificam`
      : type === 'survival'
        ? `Sobreviva até restarem ${cfg.target} (ou por ${level.timeLimit || 90} s)`
        : type === 'final'
          ? 'O último de pé ganha a coroa!'
          : 'Treino livre';
  const el = h(
    'div',
    { class: 'screen clear', style: 'justify-content:flex-start;padding-top:calc(34 * var(--u))' },
    h(
      'div',
      { class: 'panel intro-card' },
      h('div', { class: 'round', text: cfg.rounds > 1 ? `RODADA ${cfg.round + 1} DE ${cfg.rounds}` : 'TREINO' }),
      h('h2', { text: level.name }),
      h('div', { class: `type ${type}`, text: SLOT_LABEL[type] || 'Treino' }),
      h('div', { class: 'obj', text: level.objective }),
      h('div', { class: 'rule', text: rule }),
      cfg.humanPlays ? null : h('div', { class: 'rule', style: 'color:#e6313a;font-weight:700', text: 'Você está assistindo' }),
    ),
    h('div', { class: 'hint', style: 'margin-top:auto', text: app.touchMode ? 'Toque para pular a apresentação' : 'Enter para pular a apresentação' }),
  );
  el.addEventListener('pointerup', () => app.skipIntro());
  return {
    name: 'intro',
    el,
    onKey: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        app.skipIntro();
        return true;
      }
      return false;
    },
  };
}

function headsGrid(roster, ids, humanSlot, out = false) {
  return h(
    'div',
    { class: 'heads' },
    ids.map((slot) => {
      const r = roster[slot];
      if (!r) return null;
      return h('div', { class: `h${slot === humanSlot ? ' you' : ''}${out ? ' out' : ''}` }, headThumb(r.skin), h('span', { text: slot === humanSlot ? 'VOCÊ' : r.name }));
    }),
  );
}

export function resultsScreen(app, { tour, result, humanWas, onNext, onWatch, onSkip, onQuit }) {
  const q = new Set(result.qualified);
  const humanOut = humanWas && !q.has(0);
  const humanIn = humanWas && q.has(0);
  const qualifiedIds = result.standings.filter((s) => q.has(s));
  const out = result.standings.filter((s) => !q.has(s));
  const nextLevel = !tour.over ? levelMeta(tour.current.levelId) : null;
  let secs = 7;
  const cd = h('div', { class: 'countdown-txt' });
  const title = humanIn ? 'VOCÊ SE CLASSIFICOU!' : humanOut ? 'VOCÊ FOI ELIMINADO' : 'CLASSIFICADOS';
  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'panel results' },
      h('div', { class: 'tab', text: 'Resultado da rodada' }),
      h('h2', { class: humanIn ? 'good' : humanOut ? 'bad' : '', text: title }),
      humanOut ? h('p', { text: `Sua colocação: ${tour.humanPlacement()}º de ${tour.roster.length}` }) : null,
      h('p', { text: `Classificados (${qualifiedIds.length}) · Eliminados (${out.length})` }),
      h('div', { class: 'heads-wrap' }, headsGrid(tour.roster, qualifiedIds, 0)),
      nextLevel ? h('p', { html: `Próxima fase: <b>${nextLevel.name}</b>` }) : null,
      h(
        'div',
        { class: 'row' },
        humanOut
          ? [btn('Assistir', onWatch, 'yellow', app), btn('Pular', onSkip, '', app), btn('Sair', onQuit, 'gray', app)]
          : [btn(tour.over ? 'Ver vencedor' : 'Continuar', onNext, 'yellow', app), btn('Sair', onQuit, 'gray', app)],
      ),
      humanOut ? null : cd,
    ),
  );
  let id = 0;
  if (!humanOut) {
    const tick = () => {
      cd.textContent = `Continuando em ${secs}…`;
      if (secs-- <= 0) {
        clearInterval(id);
        onNext();
      }
    };
    tick();
    id = setInterval(tick, 1000);
  }
  return { name: 'results', el, back: onQuit, dispose: () => clearInterval(id) };
}

export function finalScreen(app, { tour, onAgain, onMenu }) {
  const w = tour.roster[tour.winner];
  const won = tour.winner === 0;
  const place = tour.humanPlacement();
  const c = canvas(48, 48);
  c.style.width = 'calc(96 * var(--u))';
  c.style.height = 'calc(96 * var(--u))';
  c.style.imageRendering = 'pixelated';
  let t = 0;
  const frames = [FRAME.celebrate0, FRAME.celebrate1, FRAME.celebrate2, FRAME.celebrate3];
  const draw = () => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 48, 48);
    drawFrame(ctx, w.skin, frames[Math.floor(t++ / 6) % 4], 8, 16);
    // coroa
    ctx.fillStyle = '#fcd223';
    ctx.fillRect(18, 8, 12, 5);
    ctx.fillRect(18, 5, 2, 3);
    ctx.fillRect(23, 4, 2, 4);
    ctx.fillRect(28, 5, 2, 3);
    ctx.fillStyle = '#e6313a';
    ctx.fillRect(23, 9, 2, 2);
    ctx.fillStyle = '#c99a12';
    ctx.fillRect(18, 12, 12, 1);
  };
  draw();
  const id = setInterval(draw, 1000 / 12);
  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'panel results' },
      h('div', { class: 'tab', text: 'Fim do torneio' }),
      h('h2', { class: won ? 'good' : '', text: won ? 'VOCÊ É O ÚLTIMO DE PÉ!' : 'VENCEDOR' }),
      c,
      h('div', { class: 'winner-name', text: won ? app.settings.get('name') || 'Você' : w.name }),
      h('div', { class: 'placement', text: won ? '👑 1º lugar de ' + tour.roster.length : `Sua colocação: ${place}º de ${tour.roster.length}` }),
      h('div', { class: 'row' }, btn('Jogar de novo', onAgain, 'yellow', app), btn('Menu', onMenu, 'gray', app)),
    ),
  );
  return { name: 'final', el, back: onMenu, dispose: () => clearInterval(id) };
}

export function pauseScreen(app, { onResume, onSettings, onQuit }) {
  const el = h(
    'div',
    { class: 'screen dark' },
    h(
      'div',
      { class: 'panel', style: 'text-align:center;min-width:calc(160 * var(--u))' },
      h('div', { class: 'tab', text: 'Pausa' }),
      h('h2', { text: 'Jogo pausado' }),
      h('div', { class: 'menu-col' }, btn('Continuar', onResume, 'yellow', app), btn('Configurações', onSettings, '', app), btn('Sair da partida', onQuit, 'gray', app)),
    ),
  );
  return { name: 'pause', el, back: onResume };
}

export function trainingDone(app, { result, level, onAgain, onMenu }) {
  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'panel results' },
      h('div', { class: 'tab', text: 'Treino' }),
      h('h2', { text: 'Treino concluído' }),
      h('p', { text: `${level.name} — ${result && result.time ? result.time.toFixed(1) + ' s' : ''}` }),
      h('div', { class: 'row' }, btn('Repetir', onAgain, 'yellow', app), btn('Menu', onMenu, 'gray', app)),
    ),
  );
  return { name: 'trainDone', el, back: onMenu };
}

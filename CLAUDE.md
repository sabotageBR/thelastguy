# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

The Last Guy: battle royale 2D em pixel art (estilo Stumble Guys), 32 jogadores (31 bots na v1), 4 rodadas.
HTML + JavaScript puro, ES modules, **sem build e sem dependências** — não adicione bundler nem pacotes npm.
Código, comentários e mensagens estão em português.

## Comandos

```sh
python3 tools/serve.py 8000            # ou npm run serve — ES modules não abrem via file://
npm test                               # node --test tools/test/
node --test --test-name-pattern="determinismo" tools/test/   # um teste só
node --test tools/test/physics.test.mjs                      # um arquivo só
npm run lint                           # tools/lint-sim.mjs: pureza de src/sim e src/core
npm run sim -- --all --seeds=3         # simula as 20 fases só com bots e reprova o que falhar
npm run sim -- --level=gelo-2 --hits   # uma fase; também --players=N --difficulty= --oracle --verbose
npm run icons                          # regenera icons/
```

Node 18+ só para testes/simulador. Depuração no navegador: `?level=vulc-4&bots=3`, `&autoplay`, `?fps`,
`?touch`; no console, `__game.run(segundos)` avança o jogo de forma síncrona.

Depois de mexer em fase, obstáculo, física ou bots, rode `npm test`, `npm run lint` e `npm run sim -- --all`.

## Arquitetura

**Separação sim / apresentação.** `src/core` e `src/sim` são simulação pura que roda no Node.
`tools/lint-sim.mjs` reprova nesses diretórios: `window`, `document`, `performance`, `Date`,
`requestAnimationFrame`, `localStorage`, `navigator`, `Math.random`; trigonometria/`exp`/`pow` de `Math`
fora de `core/dmath.js` (use as funções de `dmath`); e qualquer import de `src/sim` que saia de `sim/` ou `core/`.
`gfx/`, `ui/`, `audio/`, `input/` e `game/` só *leem* a simulação.

**Determinismo (base do multiplayer v2).** Passo fixo de 60 Hz (`core/constants.js` `DT`), física em pixels
inteiros, RNG por semente (`core/rng.js`, `hash32` para derivar sub-sementes). `matchConfig = { seed, levelId,
rules, roster }` reconstrói a partida; `sim/snapshot.js` serializa só o estado dinâmico. Os testes conferem que
mesma semente → mesmo hash e que restaurar um snapshot e repetir as entradas dá o mesmo estado.

**Fluxo de uma rodada.** `game/app.js` → `game/match.js` (`Match`: monta `World` + regras + `BotController`s +
HUD + render) → `game/loop.js` (passo fixo + render interpolado com `alpha`). `net/session.js` define o contrato
`Session` (`LocalSession` na v1; uma `RemoteSession` futura teria o mesmo contrato) e `net/protocol.js` o formato
de rede (entrada cabe em 2 bytes).

**`sim/world.js`** junta nível, personagens (`sim/character.js`, máquina de estados `ST`), obstáculos e regras
(`sim/rules/race|survival|final.js`, `FreeRules` em `common.js`). Personagens andam em 4 faixas (`LANES`/`LANE_DY`).

**Obstáculos** (`sim/obstacles/`): classes que estendem `Obstacle` (`base.js`) e se registram com
`registerObstacle(type, cls)`; `all.js` importa todos. Contrato: `init`, `update(world,t)`, `post` opcional,
`pose(t,out)` **pura em função do tempo** (usada pelo render e pelos bots para prever o futuro), `safety` opcional,
e `serialize/deserialize` só se tiver estado. Cada tipo precisa de um painter em `gfx/props/` via
`registerPainter(type, fn)` (desenhado nas camadas `back`/`span`/`front`).

**Fases** (`sim/levels/`): cada `<mundo>/faseN.js` exporta `meta` (`id`, `world`, `slot` 1–4, `type`
race/survival/final, `target`…) e um `build()` que usa `LevelBuilder` (`builder.js`) e os segmentos de
`segments.js`. Registrar em `catalog.js`. Vãos são anotados (`b.noteGap`) e `validate.js` os confere contra o
alcance real do pulo (`tuning.js`) e os limites de desenho do slot (`limits.js`); pulo assistido leva `{ assist }`.
Mundo `espaco` usa física de gravidade baixa (`level.physics`).

**Bots** (`sim/bots/botController.js`): planejador por amostragem que simula políticas (`policies.js`) no futuro
com o integrador real (`ghost.js`), com atraso de reação e erros por perfil (`profiles.js`).

**Gráficos** (`gfx/`): canvas de baixa resolução, sprites procedurais (`gfx/sprites/`), temas por mundo em
`gfx/themes/` (paleta, parallax, clima). UI/HUD em DOM (`src/ui/`, `css/`).

## Documentos de design

`docs/design/` (`motor.md`, `apresentacao.md`, `conteudo.md`) são as especificações. `docs/design/README.md`
define a precedência entre eles (tuning de física: valem os alvos do plano — corrida 120 px/s, apex ≈ 60 px,
alcance ≈ 90 px; baixa gravidade g×0,55 e JUMP_V×0,85) e lista os desvios feitos no balanceamento com o
simulador. Registre ali novos desvios intencionais das especificações.

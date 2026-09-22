# The Last Guy

Battle royale 2D em pixel art, no estilo Stumble Guys: 32 jogadores, 4 rodadas, vence o último de pé.
Roda no navegador do celular e do computador, em HTML + JavaScript puro (sem build e sem dependências).
Nesta primeira versão os outros 31 jogadores são bots; a simulação já nasce pronta para multiplayer.

## Como rodar

Precisa só de um servidor estático (os módulos ES não abrem via `file://`):

```sh
python3 tools/serve.py 8000      # ou: npm run serve
```

Abra `http://localhost:8000`.

**No celular:** com o celular na mesma rede Wi-Fi, abra `http://<ip-do-computador>:8000`
(o `serve.py` mostra o IP ao iniciar). Jogue com o aparelho deitado. No Android dá para instalar
como app (tela cheia); no iPhone use "Compartilhar → Adicionar à Tela de Início".

Node 18+ só é necessário para os testes e o simulador.

## Como jogar

| | Teclado | Toque | Gamepad |
|---|---|---|---|
| Andar | ← → ou A D | joystick (metade esquerda) | analógico / d-pad |
| Pular (segure para ir mais alto) | Espaço, W ou ↑ | botão redondo | A |
| Mergulhar | pule de novo no ar (ou Shift / X) | toque de novo no ar | X / B |
| Emotes | 1 a 4 | — | Y, LB, RB, ↓ |
| Pausar | Esc | botão ⏸ | Start |

Nas **corridas**, cair não elimina: você volta no último checkpoint. Na **sobrevivência** e na **final**, cair é eliminação.

**Rodadas de um torneio:** Corrida (32 → 16), Corrida (16 → 8), Sobrevivência (até restarem 4 ou 90 s)
e Final (o último vivo leva a coroa; depois de 150 s vem a MORTE SÚBITA).

**Modos:** Torneio (as 4 fases de um mundo), Partida Rápida (uma fase de cada tipo, sorteadas entre os mundos)
e Treino (qualquer fase, com 0 a 31 bots).

## Mundos e fases

| Mundo | Corrida 1 | Corrida 2 | Sobrevivência | Final |
|---|---|---|---|---|
| Céu Doce | Martelada nas Nuvens | Tobogã de Algodão-Doce | Paredão de Jujuba | Seis Andares de Wafer |
| Reino Gelado | Descida Congelada | Ponte dos Pingentes | Guerra de Bolas de Neve | Lago Rachado |
| Vulcão | Trilha da Brasa | Escalada da Cratera | Chuva de Meteoros | Torre de Magma |
| Templo da Selva | Corredor dos Ídolos | Ladeira das Toras | Roda do Totem | Pilares do Rio |
| Estação Espacial (gravidade baixa) | Corrida Orbital | Cinturão de Asteroides | Varredura Laser | Colapso da Estação |

## Parâmetros de URL (depuração)

- `?level=<id>&bots=15` — treino direto numa fase (ex.: `?level=vulc-4&bots=3`).
- `&autoplay` — um bot joga no seu lugar.
- `?fps` — mostra o tempo de quadro. `?touch` — força os controles de toque.
- No console: `__game.run(segundos)` avança o jogo de forma síncrona (funciona com a aba em segundo plano).

## Desenvolvimento

```sh
npm test                               # node --test: física, determinismo, snapshot, torneio, validação das 20 fases
npm run lint                           # src/sim e src/core sem DOM, Date ou Math.random
npm run sim -- --all --seeds=3         # simula as 20 fases só com bots e reprova o que falhar
npm run sim -- --level=gelo-2 --hits   # uma fase, com origem dos golpes e pontos de queda
```

O simulador usa 32/16/8/4 jogadores conforme a rodada e confere: cota preenchida nas corridas,
fim pela meta na sobrevivência, exatamente um vencedor na final, zero NaN e poucos bots travados.

## Estrutura

```
index.html  css/  assets/fonts/  icons/  manifest.webmanifest
src/
  core/      RNG determinístico, matemática, eventos, constantes
  sim/       simulação pura (roda no Node): mundo, personagem, física em pixels inteiros,
             obstáculos, regras das rodadas, torneio, bots, snapshot
    levels/  construtor de fases, segmentos, validador e as 20 fases (ceu/ gelo/ vulcao/ selva/ espaco/)
  gfx/       render em canvas de baixa resolução: parallax, ilhas pré-renderizadas, sprites
             procedurais, painters dos obstáculos, clima, temas dos mundos
  ui/        telas e HUD em DOM (fonte Pixelify Sans, OFL)
  input/     teclado, toque e gamepad
  audio/     efeitos e música chiptune gerados com WebAudio
  net/       contrato de sessão/transporte e formato de protocolo para o multiplayer (v2)
  game/      aplicativo, laço de jogo, partida, configurações
tools/       servidor, simulador, lint, testes, geração de ícones
docs/        especificações de design e imagens de referência
```

**Determinismo e multiplayer:** a simulação roda em passo fixo de 60 Hz, com RNG por semente e sem
depender do relógio. `matchConfig = { seed, levelId, rules, roster }` reconstrói a partida em qualquer
lugar, e `src/sim/snapshot.js` serializa só o estado dinâmico. Os obstáculos são, em geral, funções do
tempo — o que também permite aos bots "enxergar o futuro" rodando o mesmo integrador do jogo.

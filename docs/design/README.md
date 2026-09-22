# Documentos de design

Especificações produzidas no planejamento (referência para a implementação):

- `motor.md` — simulação, física, bots, regras de rodada, harness, costuras de multiplayer.
- `apresentacao.md` — pipeline de canvas, pixel art procedural, props, UI/HUD, celular, áudio.
- `conteudo.md` — 5 mundos, 20 fases, biblioteca de segmentos, skins e nomes de bots.

## Precedência (conflitos entre os documentos)

1. O plano aprovado (`~/.claude/plans/quero-criar-um-jogo-lazy-stardust.md`) vence tudo.
2. **Tuning de física**: valem os alvos do plano, que batem com `conteudo.md`
   (corrida 120 px/s, pulo cheio com apex ≈ 60 px e alcance ≈ 90 px; baixa gravidade
   g×0,55 e JUMP_V×0,85). Os números medidos em `motor.md` (apex 41,6 px) ficam
   substituídos; a estrutura (gravidade assimétrica, coyote, buffer, corte de pulo,
   mergulho, níveis de knockback, timers) continua valendo. `src/sim/limits.js` mede
   os valores reais e `validate.js` reprova fases fora dos limites.
3. Limites de desenho de fase: tabela do plano (seção 5).
4. Tempo de sobrevivência 90 s; final 150 s + morte súbita (conteúdo), com as
   garantias de término e desempate de `motor.md`.
5. Paleta do Céu Doce: `apresentacao.md` (amostrada dos mockups). Demais mundos:
   `conteudo.md`.
6. Estrutura de pastas: a do plano (`src/…`), não `js/…`.

## Desvios em relação às especificações (feitos no balanceamento com o simulador)

- **Gêiseres e trampolins mirados** (`aimX`/`aimY`): o voo cai no centro do próximo apoio, é balístico
  (só frear muda) e não permite mergulho. Com velocidade fixa, quem saía da borda caía na poça.
- **Gêiseres e trampolins lançam quem pisa andando** (e, no gêiser, quem está parado na erupção).
- **Vento como deriva** (`drift`, px/s) em vez de aceleração: o efeito ficou legível e previsível.
- **Gelo Fino e pontes que racham** têm pedaços firmes intercalados: com 32 jogadores em fila as
  placas ficavam quase sempre caídas e viravam um abismo.
- **Avalanche (gelo-2)**: nichos de 16 px em cada terraço; bolas largas passam por cima deles.
- **selva-1 "Totem Giratório"**: virou o varredor de totem (tronco baixo cruzando as faixas); o rotor
  vertical com braço abaixo do chão era intransponível.
- **Rotores** (ceu-2, gelo-2, esp-2): a ponta do braço fica acima do chão.
- **Roda-gigante (vulc-2) e roda d'água (selva-2)**: giram para o lado da saída; a cabine passa a 8–40 px
  das plataformas. `b.lift()` diz aos bots que subir ali é progresso.
- **Estação Espacial**: vãos reduzidos (o alcance real na gravidade baixa é menor que o suposto na
  especificação); os ventiladores fazem o ragdoll recuperar o controle depois de 1,6 s no ar.
- **ceu-4** tem 6 andares (com 5 a final durava ~30 s); **esp-3** teve o ritmo aliviado (acabava em ~35 s).
- Pedra gigante da perseguição (selva-2) achata por 1,2 s (tier `squash`) e atropela troncos baixos.

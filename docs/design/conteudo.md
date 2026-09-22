<!-- Especificação de conteúdo: mundos, fases, segmentos, skins e bots (planejamento) — gerado pelo agente de planejamento; referência para a implementação -->

# The Last Guy: content and level design spec (plan only, no files written)

**Status.** This is the full content spec: 5 worlds, all 20 phases, a segment library, the difficulty curve, 20 skins and 60 bot names. I checked every gap and step against your jump numbers and wrote down the rules I used. The project folder has only the reference images, so there is no code to build on. There are four open items:
- **Low gravity:** the space numbers assume the normal jump strength with 0.55× gravity. If the engine weakens the jump in space, scale those gaps down.
- **New components:** these phases need about ten components that are not on your list. They are listed in section 8.
- **Moving platforms:** these phases need two small moving-platform features: a speed cap and a sink-faster-with-more-people rule.
- **Finish banner:** it reads "FINISH" to match the images. Swap it for "CHEGADA" if all on-screen text must be Portuguese.

## 0. Conventions and jump rules

**Notation**
- `x` is horizontal px from the level start. `h` is the height of a platform's top above the base line (px, up is positive).
- A gap is clear horizontal space. `T` is a period. `φ` is a phase offset. `A` is a swing amplitude. `ø` is a diameter.
- CP is a checkpoint: a safe flat of at least 96 px, with 1 s of invulnerability after respawn.

**Jump limits used for every level**

| Rule | Normal gravity | Low gravity (space) |
|---|---|---|
| Max gap, Race slot 1 | 72 px | 128 px |
| Max gap, Race slot 2 | 80 px | 128 px |
| Max step up | 40 px (slot 1) / 48 px (slot 2) | 80 px |
| Gap limit when rising 24 px or more | gap ≤ 56 px | gap ≤ 112 px |
| Gaps wider than 88 px | only with a jump pad, geyser, slope speed or a ramp | — |
| Dive-only gaps | optional shortcuts only, ≤ 112 px | — |
| Low hurdle / jump-over wall | ≤ 24 px tall | ≤ 24 px tall |
| Stay-down (high) wall | lower edge ≥ 28 px (hitbox is 20 px) | — |

**Assumed physics**
- **Jump:** v0 ≈ 300 px/s, g ≈ 750 px/s², apex about 60 px. Feet stay above 32 px for about 0.55 s.
- **Low gravity, same v0:** apex about 105 px, reach about 165 px.

**Timing and visibility rules**
- **Safe window:** every timed hazard needs a safe window of at least (distance to cross ÷ 120 px/s) plus 0.6 s in slot 1, or plus 0.35 s in slot 2 and later.
- **Warning time:** at least 0.8 s in races. It ramps down to 0.6 s at the end of survival and final rounds, and is never below 0.5 s.
- **Look-ahead:** the camera shows at least 200 px ahead. There are no hazards inside a 64 px landing zone after a jump.

**Getting hit**
- **Hammer or rotating arm:** knocked back with v = (±220, −180) and stunned 0.9 s.
- **Pusher:** pushed back 48–96 px, 0.4 s stun.
- **Hurdle or bumper:** 0.5 s stumble.
- **Crusher:** 1.0 s squashed.

**Default geometry**
- **Pendulum:** pivot at h 120, arm length L 96, head 40×24. It is dangerous only while the head's bottom is below 24 px, which is a band of about ±47 px around the pivot.
- **Slopes:** downhill speed cap 170 px/s, uphill speed ×0.8.
- **Trampoline:** apex 104 px. **Geyser:** apex 120 px.

**Tournament rules**
- **Races:** end when the quota (a parameter) crosses the finish, or at the time limit of 2× the target time (at least 150 s). If time runs out, remaining players are ranked by last CP, then by x.
- **Survival:** a `targetAlive` parameter, default 4. The hard limit is 90 s, after which everyone alive qualifies.
- **Final:** hard limit 150 s. After that comes sudden death ("MORTE SÚBITA"): the rest of the arena collapses within 10 s. The winner is the last player eliminated; ties go to the higher position, then random.
- **Arenas:** all are 448 px wide, which fits the 480 px minimum screen. They work for 2–16 players.
- **Partida Rápida:** each slot draws only from that slot's 5 phases, and all phases are self-contained.
- **Randomness:** all random hazards are scheduled with a seed at least one warning time ahead, so the bots' planner can see them.

## 1. Worlds

| | **Céu Doce** | **Reino Gelado** | **Vulcão** | **Templo da Selva** | **Estação Espacial** |
|---|---|---|---|---|---|
| Fantasy | Candy obstacle course floating in a bright sky (the mockups) | Ice kingdom with an aurora, slippery floors and falling icicles | Race inside an erupting volcano over a sea of lava | Ancient jungle temple full of traps, logs and a river | Orbital station in low gravity, with lasers and a black hole |
| Sky top / bottom | #1E8FEA / #9FDCFF | #3B5FB0 / #CFEFFF | #2A0E22 / #C4462C | #3CB6E0 / #D6F5D2 | #080826 / #2B1A5E |
| Clouds / far scenery | #FFFFFF, shade #CDE7FB / #7EC3F2 | #F2FAFF, aurora #7DF5C9/#B69CFF / peaks #9CC8E8 | ash #6E4650 / volcano #4B1B24, lava rivers #FF7A1A | mist #E9FFF0 / canopy #3E9A5E, #2A7446 | stars #FFFFFF/#9FC8FF, nebula #7B3CFF/#FF4FA3 |
| Platform top / checker | #FFD447 / #F2B52C | snow #F4FBFF / #D2EAF8 | basalt #54465E / #463A50 (cracks #FF8C1A) | moss #7DC243 / #6AAE36 | metal #CBD5E3 / #AEB9CB (stripe #FFD23F/#2A2A2A) |
| Platform front / shade | #2F86E8 / #1F63BD | ice #6CC4EE / #3A8CC8 | #2B2233 / #1D1624 | stone #A88E6A / #7F6A4E | #566279 / #3B4459 |
| Outline | #10326B | #173C66 | #0F0A14 | #33261A | #161B2E |
| Accent 1 / 2 | pink #F0428C / purple #8B4DE8 (rails #FFC21A) | scarf #FF5E7E / gold #FFD166 | gold #FFB627 / teal crystal #3FD9C6 | idol gold #FFC83D / flower #E5484D | cyan #3DF5FF / magenta #FF3DA8 |
| Hazard colours | hammer #E8367F + stripe #FFC2DB; pusher #8B4DE8/#6A30C0; barrier #FFD447/#FFFFFF | icicle #CFF3FF; water #1C4F8F; thin-ice crack #FFFFFF | lava #FF5A1F/#FFD23D/#B3261E; fire #FFE066; aim marker #FF2E2E | blade #A7A7A7; log #8A5A2E; dart feather #E53935; water #2FA7C9 | laser #FF2E4D core #FFFFFF; black hole #0D0018 ring #B26CFF |
| Parallax (far → near) | 1) gradient with big pixel clouds (0.1×) 2) floating candy islands with lollipop trees (0.3×) 3) cloud banks under the track and a hot-air balloon (0.6×) | 1) aurora over a dusk starfield 2) snowy peaks and an ice castle 3) snowy pines plus a snowfall layer in front | 1) red sky with rising embers 2) erupting volcano with lava rivers 3) basalt columns with heat shimmer | 1) sun rays and a stepped-pyramid silhouette 2) canopy and waterfalls 3) hanging vines, leaves and fireflies | 1) twinkling stars and nebula 2) ringed planet and satellites 3) station trusses and windows |
| Signature mechanics | pendulum hammers, purple pushers, pink rotating sweeper, marshmallow trampolines, crumbling wafer | ice floors (friction 0.12), snowballs that grow as they roll, icicles, thin ice, snowstorm gusts | lava, fire jets, fire bars, sinking rafts, geyser launch pads, meteors | stone axes, dart walls at two heights, spike traps, logs and boulders, sinking lily pads | 0.55× gravity, laser gates / sweepers / turrets, fans, black-hole pull, airlock doors |
| Music | bouncy major-key chiptune, 150 BPM, xylophone | sleigh bells and glockenspiel, 128 BPM | taiko drums and distorted chip bass, 140 BPM, minor key | tribal percussion and marimba, 120 BPM | synthwave arpeggios, 118 BPM |

## 2. Obstacle looks by world

| Component | Céu Doce | Reino Gelado | Vulcão | Templo da Selva | Estação Espacial |
|---|---|---|---|---|---|
| Pendulum | pink/white striped candy hammer on a pink post with yellow cap | ice hammer with frost stripes | chained basalt boulder | stone axe on a vine rope; swinging log | wrecking-ball probe |
| Rotating arm | pink drum with purple arm and candy hammer head; lollipop propeller | 3-arm ice windmill | fire bar (5 fireballs) | totem with log arms | laser arm; solar-panel satellite |
| Pusher | purple block 32×32 | sliding ice cube; belly-sliding penguin | magma piston | carved stone block | cargo block |
| Hurdle / bumper | yellow/white striped barrier; gumdrop bumper | snow mound; crystal bumper | cooled lava rock | fallen log | hazard-striped bar |
| Crumbling | wafer tiles | thin ice | brittle basalt | rope bridge planks | loose grating |
| Rolling objects | gumballs | snowballs that grow; giant snowball | lava rocks | logs; boulders | debris |
| Falling / telegraphed | sprinkle bombs | icicles | meteors | falling idol stones | falling debris |
| Periodic jets | whipped-cream jets | steam vents | fire jets | spike traps | electric floor |
| Pad | marshmallow | ice spring | geyser | mushroom | jump pad |
| Crusher | giant candy stamp | ice press | basalt crusher | stone lid | airlock door |
| Finish gate | checkered "FINISH" banner with blue crown flags (as in the images) | ice arch | obsidian arch with flames | temple gate with golden idol | neon gate |

## 3. Segment library (22 generators, 3 arena modules, set pieces)

| ID | What it builds | Main parameters (defaults) | Difficulty knobs (easy → hard) |
|---|---|---|---|
| GAPS | chain of blocks with gaps | n, blockW 96, gaps[], rises[], ice | gap 48→80, rise 0→48, block 96→48 |
| STEP | stairs or ledges | steps, rise 32–40, run 64–96, gap | rise, narrower run |
| HURD | striped barriers (12–24 px) and bumpers ø24 | n, spacing 80–112, air/ground | spacing, mixed with other hazards |
| PEND | overhead pendulums | n, spacing ≥128, pivotH 120, L 96, A ±55°, T 2.4, φ mode (sync / offset / "green wave" φᵢ = i·spacing/120) | T 3.0→1.8, head size, count |
| ROTOR | rotating arm(s) in the side-view plane | pivot x/h, armL, heads 1–4, T, direction | T, number of heads, reversals |
| PUSH | sliding blocks you can stand on | n, size 32, stroke 48–96, T 2.2, φ | T 2.2→1.4, stroke |
| CRUSH | ceiling crushers, floor pistons, airlock doors | n, spacing 112–128, drop 0.3 / hold 0.5 / rise 1.2 / wait 1.0, shake 0.4 | wait time, phase wave |
| MOVP | moving platforms | n, axis, amplitude ±32–64, T 2.8–4, w 48–64 | amplitude, T, width |
| FERRIS | wheel of platforms that stay level | cars 3–4, radius 80–96, T 7–8 | T, car width |
| CRUMB | crumbling bridge or tiles | length, tileW 16/32, delay 0.45–0.6, respawn 3–3.5 (∞ in finals) | delay, respawn, fallback route |
| SINK | sinking platforms | n, w, sink 20 px/s (×1.5 with 3+ players), rise 16 | rates, crowd multiplier |
| SEESAW | tilting platforms | n, w 128–144, tilt ±22–25°, gap | tilt, gap |
| SLOPE | ramp (speed up downhill, slow uphill) | length, drop / climb | angle |
| ROLL | spawner of rolling objects | interval 1.6–2.4 s, ø, speed 120–140, grow, giant every k, niches, chase trigger | interval, ø, mixing |
| CONV | conveyor belt | length, speed ±50–70 | speed, hazards on top |
| PAD | trampoline or geyser | apex, vx, pulse on/off | pulsing, chaining |
| JETS | fire / spikes / steam | n, spacing, on/off, φ step, height 64 | on share, wave speed |
| DROP | telegraphed falling hazards | area, interval, warning 1.0→0.6, radius, mode (fixed x / random / target players) | rate, warning, radius |
| DARTS | horizontal shots (darts, cannons) | emitters, interval, height (8 = jump / 36 = stay down) or arc, speed 200 | rate, height mix |
| LASER | gates, sweepers, turrets, columns, lines, fences | on/off, speed, length, warning | overlap, warning |
| WALLS | Block-Dash-style walls | interval, speed, patterns (LOW / HIGH / PAIR / CROSSED) | speed, doubles, crossed |
| DSWEEP (new) | bars rotating around a vertical totem that cross the depth lanes | ω, LOW/HIGH bars, reversals | ω, reversals |
| WIND | wind gusts or fans | force ±60–90, on/off, warning 0.5 | force, share of time on |
| GRAV | black-hole pull | centre, radius, air pull, ground drift | pull strength |
| SPLIT | wrapper: upper and lower route | upper[], lower[] | — |
| ICE | modifier: slippery floor | friction 0.12, accel ×0.4 | — |

**Arena modules**
- **TILEFALL:** layers of tiles that drop after being stepped on, with a delay.
- **RISING:** rising lava or water, with a schedule plus rubber-banding.
- **SHRINK:** arena edges collapse from the sides.

**Set pieces:** START (32 spawn slots, 8 columns × 4 lanes, 24 px apart), CP, FINISH.

## 4. Phases

### Céu Doce

**ceu-1 "Martelada nas Nuvens"**
- Slot 1, Race. Objective "CORRA ATÉ A CHEGADA!".
- Evokes the mockups plus Stumble Guys-style hammer and pusher courses.
- Target 70 s (ideal 45 s). Size 5120×320.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–320 | START |
| 2 | 320–640 | HURD ×3 (12 px) at 416/512/608 |
| 3 | 640–960 | GAPS 48/56/64, rises 0/+16/0, yellow rails |
| 4 | 960–1440 | PEND ×3 at 1056/1200/1344, T 2.4, A ±55°, φ 0/⅓/⅔ |
| CP1 | 1472 | |
| 5 | 1520–1968 | PUSH ×4 purple (stroke 64, T 2.0, spacing 112, alternating φ), HURD ×2 in between |
| 6 | 2000–2400 | ROTOR "Varredor Rosa": pink drum on a post at x 2200, pivot h 96, arm 84, 2 heads 28×28, T 6 s, clockwise (the low head moves right, so you follow behind it) |
| 7 | 2400–2880 | GAPS 56(+24)/72(−24)/48(+32), then a 176 px chasm with MOVP 64 w ±40, T 3.0 |
| CP2 | 2912 | |
| 8 | 2944–3520 | PEND ×4 "Onda Verde" at 3040/3168/3296/3424, T 2.0, φᵢ = i·1.07 s |
| 9 | 3520–4160 | SPLIT. Upper: STEP +32 ×3 to h 96, then gaps 72/72. Lower: PUSH ×3 (T 1.8) and HURD ×2. The upper route is about 1.5 s faster |
| CP3 | 4192 | |
| 10 | 4224–4640 | PEND "Martelões" ×2 at 4352/4544: pivot h 150, L 120, head 56×32, T 3.0, A ±60°, φ 0/½ |
| 11 | 4640–4880 | HURD ×3, spacing 80 |
| 12 | 4880–5120 | FINISH gate at x 4960, crown flags at 4912/5008, confetti |

Memorable moment: the mockup comes alive. The pink sweeper throws players off the clouds, and anyone who keeps full speed through the 4-hammer "Onda Verde" passes all of them in rhythm.

**ceu-2 "Tobogã de Algodão-Doce"**
- Slot 2, Race. Objective "CORRA ATÉ A CHEGADA!".
- Evokes Super Slide.
- Target 80 s. Size 5600×480; the course descends overall.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–256 | START at h 320 |
| 2 | 256–736 | PAD ×4 marshmallows (48 w, apex 104), empty gaps of 80 |
| 3 | 736–1536 | SLOPE down 160 px. Bumpers at 896/1056/1216/1376 (alternating ground and air at h+40). Gaps of 64 at 1136 and 1456 |
| CP1 | 1568 | h 160 |
| 4 | 1600–2080 | SEESAW ×3 (128 w, ±22°, gaps 40) |
| 5 | 2112–2560 | ROTOR ×2 "Hélices de Pirulito" at 2240/2432: pivot h 88, arm 96, 2 bars, T 5, opposite directions |
| CP2 | 2592 | |
| 6 | 2624–3264 | SLOPE up 96 with ROLL gumballs ø28 every 2.0 s at 140 px/s |
| 7 | 3296–3776 | CRUMB "Ponte de Wafer" at h 256 (16 px tiles, 0.45 s delay, respawn 3.5 s). Falling lands on a lower lane at h 128 (CONV −50, HURD ×3), with STEP 4×32 back up at 3776–3872 |
| CP3 | 3904 | h 256 |
| 8 | 3936–5216 | SLOPE down 224 "Grande Tobogã": CONV speed boosts +60 (2 × 160 px), HURD at 4128/4384/4640, bumpers at 4512/4832, kicker ramp at 5152 over a 96 px gap (you arrive at ≥160 px/s) |
| 9 | 5312–5600 | FINISH gate at x 5408 |

Memorable moment: the wafer bridge collapses under the crowd.

**ceu-3 "Paredão de Jujuba"**
- Survival. Objective "SOBREVIVA!".
- Evokes Block Dash.
- Arena: a 448×16 platform at h 0 over empty sky, fixed camera.
- Walls are 32 px thick and span h 0–144.
- Wall patterns:
  - **LOW** (filled 0–24): jump it.
  - **HIGH** (open below 28): stay on the ground.
  - **PAIR:** LOW then HIGH, 160 px apart.
  - **CROSSED:** two walls coming from both sides at once.
- A wall carries anyone it hits off the edge.

| t (s) | Walls | Speed | Other changes |
|---|---|---|---|
| 0–15 | 1 every 3.0 s, from the right | 90 | LOW and HIGH only |
| 15–30 | 1 every 2.6 s, alternating sides | 110 | |
| 30–45 | 1 every 2.3 s | 130 | PAIR added. Edges blink for 2 s and fall, leaving 416 px |
| 45–60 | 1 every 2.0 s, 20% doubles | 150 | 384 px |
| 60–75 | 1 every 1.7 s, 40% doubles | 170 | CROSSED added. 320 px |
| 75–90 | 1 every 1.4 s | 190 | 256 px |

Ends at `targetAlive` or 90 s. Memorable moment: CROSSED walls, where you jump one and stay under the other.

**ceu-4 "Três Andares de Wafer"**
- Final. Objective "SEJA O ÚLTIMO DE PÉ!".
- Evokes Tile Fall and Hex-A-Gone.
- Arena: 3 layers of 28 tiles × 16 px (448 px) at h 0 / 80 / 160, with empty sky below.
- A tile shakes and turns pink after being stepped on, then falls. Tiles never come back.

| t (s) | Tile fall delay | Random tile falls |
|---|---|---|
| 0–30 | 0.45 s | — |
| 30–60 | 0.35 s | — |
| 60–90 | 0.25 s | 1 per second per layer |
| 90+ | 0.20 s | 2 per second per layer |

- There are 84 tiles, and each landing destroys at least one, so the round ends in about 70 s even with one perfect jumper.
- Hard limit 150 s.

Memorable moment: falling from the top layer onto a lower one that is already full of holes.

### Reino Gelado

**gelo-1 "Descida Congelada"**
- Slot 1, Race. Objective "CORRA ATÉ A CHEGADA!".
- Evokes Fall Guys Ski Fall and Stumble Guys ice races.
- Target 70 s. Size 5280×400.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–320 | START on snow |
| 2 | 320–704 | ICE floor, HURD ×3 snow mounds, spacing 112 |
| 3 | 704–1216 | SLOPE down 96 on ice (reaches 170 px/s), gaps 56/64 near the bottom |
| 4 | 1248–1664 | PEND ×3 ice hammers, spacing 144, T 2.6, A ±50°, φ 0/½/0, on ice |
| CP1 | 1696 | |
| 5 | 1728–2208 | PUSH ×4 ice cubes (stroke 80, T 2.2), slippery tops |
| 6 | 2240–2880 | SLOPE up 96 with ROLL snowballs every 2.4 s at 130 px/s, growing from ø20 to ø36 over 480 px |
| CP2 | 2912 | |
| 7 | 2944–3392 | CRUMB "Gelo Fino" 32 px slabs, 0.6 s delay, respawn 3 s, 3 gaps of 40 |
| 8 | 3424–3904 | WIND head-wind −70 (1.5 s on / 2.0 s off, 0.5 s warning), 2 gaps of 48 |
| CP3 | 3936 | |
| 9 | 3968–4928 | SLOPE down 192 on ice, 4 bumpers, gaps 64/72 at the end |
| 10 | 4960–5280 | FINISH gate at x 5056 (ice arch) |

Memorable moment: jumping snowballs early, while they are still small.

**gelo-2 "Ponte dos Pingentes"**
- Slot 2, Race. Objective "CORRA ATÉ A CHEGADA!".
- Target 85 s. Size 5760×360.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–256 | START |
| 2 | 256–832 | DROP ×8 icicles (spacing 64, cave ceiling at h 128): shake 0.8 s, fall 0.35 s, regrow 2.5 s, staggered 0.4 s |
| 3 | 832–1280 | GAPS on ice 64(0)/56(+24)/80(−16)/72(0) |
| CP1 | 1312 | |
| 4 | 1344–1984 | CRUMB bridge (0.5 s delay, respawn 3 s) with 4 icicles (0.7 s warning) |
| 5 | 2016–2656 | WIND gusts −90 (2 s on / 2 s off) with PEND ×3 (T 2.2, spacing 160) |
| CP2 | 2688 | |
| 6 | 2720–3616 | SPLIT. Upper at h 96: MOVP ×5 ice floes (48 w, ±32, T 2.8) over 64 px gaps. Lower, on ice: PUSH ×4 (T 1.8) and HURD ×3 |
| 7 | 3648–4032 | ROTOR 3-arm ice windmill, pivot h 104, arm 100, T 7.5, on ice |
| CP3 | 4064 | |
| 8 | 4096–4992 | SLOPE up 128 "Avalanche": ROLL snowballs every 1.8 s (ø24→40), plus a GIANT ø64 every 5.4 s. Niches (48 w × 28 deep) every 192 px to hide in |
| 9 | 5024–5760 | 2 icicles, HURD ×3, FINISH gate at x 5504 |

Memorable moment: diving into a niche while the giant snowball rolls over you.

**gelo-3 "Guerra de Bolas de Neve"**
- Survival. Objective "SOBREVIVA!".
- Evokes Bombardment.
- Arena: 448 px with snow edges of 64 px each and a 320 px ice centre. Two snow mounds (32×16) at x 144 and 304 give cover.
- Snow forts with cannons sit outside the arena on both sides, at h 96.
- **Cannon shots:** each shot has a swelling cannon plus a shadow marker, then an arcing snowball. Impact radius 20, knockback 80 px.
- **Giant snowball:** rolls across the whole arena.

| t (s) | Cannons | Other changes |
|---|---|---|
| 0–15 | 1 shot every 2.4 s per side, 1.0 s warning | |
| 15–30 | every 1.8 s | giant ø32 every 8 s |
| 30–45 | 3-ball spread shots, 0.9 s warning | wind ±60 for 2 s every 10 s |
| 45–60 | every 1.4 s | giant ø40 every 6 s, mounds destroyed |
| 60–75 | 0.8 s warning | whole arena turns to ice, wind ±80 |
| 75–90 | every 1.0 s | giant ø48 every 4 s, edges −32 each side |

Ends at `targetAlive` or 90 s. Memorable moment: getting hit on the ice and sliding helplessly toward the edge.

**gelo-4 "Lago Rachado"**
- Final. Objective "SEJA O ÚLTIMO DE PÉ!".
- Arena: 28 ice slabs of 16 px over water at h −24 (touching the water eliminates you). Friction is ice everywhere.
- 3 drifting ice floes (48 w, ±64, T 6) sink after 3 s with someone on them.
- **Crack lines:** a crack draws over a slab for 1.5 s, glows for 0.5 s, then the slab breaks for good.
- **Edge melt:** the outer slabs melt, working inward from both edges.
- **Penguins:** 24×16 pushers belly-slide across at 140 px/s. They can be jumped.

| t (s) | Slabs cracking | Other changes |
|---|---|---|
| 0–30 | 1 every 4 s | 1 penguin every 6 s |
| 30–60 | 1 every 3 s | 1 slab melts from each edge every 10 s; penguins from both sides every 4 s; floes sink after 2 s |
| 60–90 | 1 every 2 s, shorter warning (1.2 s crack + 0.4 s glow) | melt every 6 s |
| 90+ | 2 every 1.5 s | |

The ice is about gone by roughly 95 s. Hard limit 150 s.

Memorable moment: two players stuck on the last slabs, with a penguin coming.

### Vulcão

In the Vulcão races, touching lava means respawning at the last CP.

**vulc-1 "Trilha da Brasa"**
- Slot 1, Race. Objective "CORRA ATÉ A CHEGADA!".
- Target 75 s. Size 5280×360.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–320 | START |
| 2 | 320–704 | GAPS 48/56/64 over lava |
| 3 | 704–1184 | JETS ×5 fire vents, spacing 96, flames 64 tall, 1.0 s on / 1.4 s off, φ step 0.3 s, 0.5 s glow warning |
| CP1 | 1216 | |
| 4 | 1248–1792 | ROTOR ×3 fire bars (length 48, pivot h 56, T 3.6, alternating direction), spacing 176 |
| 5 | 1824–2400 | SINK ×5 rafts (64 w, gaps 48): top starts 16 px above lava, sinks 20 px/s (×1.5 with 3+ players), rises 16 px/s |
| CP2 | 2432 | |
| 6 | 2464–2944 | CRUSH ×4 from h 112 (T 3.0), spacing 112, φ step 0.75 s |
| 7 | 2976–3456 | PAD ×3 geysers: vent rocks 64 w between 128 px pools you cannot jump; 1.5 s active / 1.5 s dormant, apex 120, vx 150 |
| CP3 | 3488 | |
| 8 | 3520–4480 | JETS ×4 and 2 fire bars, alternating, climbing 3 steps of +16 |
| 9 | 4480–4960 | GAPS on obsidian 56(+16)/64/64(−16)/72(+16) |
| 10 | 4960–5280 | FINISH gate at x 5088 |

Memorable moment: a crowded raft sinking into the lava, and geysers launching everyone.

**vulc-2 "Escalada da Cratera"**
- Slot 2, Race. Objective "CORRA ATÉ A CHEGADA!".
- Target 90 s. Size 5760×640, climbing from h 0 to h 560.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–256 | START |
| 2 | 256–704 | STEP +40 ×6 (gaps 32–48) up to h 240; fire jets on steps 3 and 5 (T 2.4) |
| 3 | 704–1216 | CONV −70, HURD ×3, 2 fire jets |
| CP1 | 1248 | h 240 |
| 4 | 1280–1920 | DROP meteors (1.0 s target marker, radius 24, 1 every 1.2 s), 2 gaps of 64 |
| 5 | 1952–2304 | FERRIS ×4 cars (48 w, radius 88, T 8), exit at h 400 |
| CP2 | 2336 | h 400 |
| 6 | 2368–3072 | MOVP ×4 moving vertically (±48, T 3, gaps 64) alternating with CRUSH ×3 |
| 7 | 3104–3904 | SPLIT. Upper at h 480: 48 px ledges with gaps 56, plus 2 fire bars (about 2 s faster). Lower at h 320: CONV −60 and meteors |
| CP3 | 3936 | h 400 |
| 8 | 3968–4608 | PAD chain of 4 geysers (1.2 s on / 1.2 s off, φ staggered 0.6 s) up to the rim at h 560 |
| 9 | 4640–5760 | on the rim: 2 fire bars, HURD ×3, light meteors (1 every 2.0 s), FINISH gate at x 5504 |

Memorable moment: the geyser chain up to the crater rim.

**vulc-3 "Chuva de Meteoros"**
- Survival. Objective "SOBREVIVA!".
- Arena: a basalt island of 28 destructible tiles over lava. Two raised platforms (80 w, h 40) at x 96 and 272.
- **Meteors:** a red target marker (radius 24) shrinks for 1.2 s before impact.
  - Knockback radius 32 (vx 180, vy −150).
  - Each small meteor destroys 1 tile, leaving a hole to the lava.

| t (s) | Meteors | Other changes |
|---|---|---|
| 0–15 | 1 every 1.5 s | |
| 15–30 | 1 every 1.2 s, 30% aimed at players | |
| 30–45 | 1 every 1.0 s, plus a line of 5 meteors every 10 s | |
| 45–60 | 1 every 0.8 s | big meteor every 6 s (4 tiles, radius 40) |
| 60–75 | 0.9 s warning | raised platforms destroyed |
| 75–90 | 1 every 0.6 s, 0.8 s warning | |

Ends at `targetAlive` or 90 s. Memorable moment: the floor turning into Swiss cheese.

**vulc-4 "Torre de Magma"**
- Final. Objective "SEJA O ÚLTIMO DE PÉ!".
- Evokes Lava Land.
- Arena: a vertical tower 448×2400. The camera follows your character upward.
- Structure:
  - A row of ledges every 40 px, with 2–3 ledges per row (48–80 wide).
  - The next ledge up is always within 64 px sideways.
  - Built from 8 hand-made 6-row chunks, picked with a seed.
- **Hazards:**
  - 40% of ledges above row 20 crumble and never return, so leaders ruin the path for those behind.
  - Fire bars at rows 15, 30 and 45.
  - Falling rocks from 70 s, with a shadow-line warning.
- **Lava rise:**
  - Idle for the first 10 s.
  - Then 12 px/s, 18 px/s from 40 s, 24 px/s from 70 s, and 30 px/s from 100 s.
  - Rubber band: lava is never more than 360 px below the highest living player after 30 s.
- **Top:** a sealed cap at h 2400. The top chamber has 3 crumbling ledges and a 32 px spire that collapses at 140 s.
- Lava reaches the cap by about 128 s.

Memorable moment: a standoff on the crumbling top with lava coming up underneath.

### Templo da Selva

**selva-1 "Corredor dos Ídolos"**
- Slot 1, Race. Objective "CORRA ATÉ A CHEGADA!".
- Target 75 s. Size 5280×360.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–320 | START |
| 2 | 320–832 | HURD ×2 logs (16 px), GAPS 48/56/64 |
| 3 | 832–1344 | PEND ×3 stone axes (pivot h 128, L 104, A ±50°, T 2.6, spacing 160, φ 0/½/0) |
| CP1 | 1376 | |
| 4 | 1408–1888 | DARTS from 2 idol heads at 1664/1856 facing the player: every 1.6 s, alternating h 8 (jump) and h 36 (stay down), 200 px/s, eyes glow 0.5 s before |
| 5 | 1920–2400 | CRUMB rope bridge (0.6 s delay, respawn 3 s), 2 missing-plank gaps of 48 |
| CP2 | 2432 | |
| 6 | 2464–3104 | SLOPE up 96 with ROLL logs ø24 every 1.8 s at 120 px/s |
| 7 | 3136–3616 | JETS ×6 spike traps (32 w, spacing 80, 0.8 s up / 1.2 s down, 0.4 s rattle warning, φ step 0.33 s) |
| CP3 | 3648 | |
| 8 | 3680–4128 | ROTOR "Totem Giratório": pivot h 72, 2 log arms of 88, T 5 |
| 9 | 4160–4800 | SPLIT. Upper at h 80: 3 gaps of 72 and 1 axe. Lower tunnel: 1 dart head and 2 spike traps |
| 10 | 4864–5280 | FINISH gate at x 5024 (temple gate with golden idol) |

Memorable moment: reading which height each dart comes at, jump or stay down.

**selva-2 "Ladeira das Toras"**
- Slot 2, Race. Objective "CORRA ATÉ A CHEGADA!".
- Evokes Jungle Roll.
- Target 85 s. Size 5760×480.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–256 | START |
| 2 | 256–1024 | SLOPE up 128: logs ø24 every 1.6 s plus boulders ø32 every 4.8 s at 140 px/s, 2 flat rest spots |
| CP1 | 1056 | h 128 |
| 3 | 1088–1664 | SINK ×8 lily pads (48 w, gaps 40–56): start sinking 20 px/s after 0.4 s, come back up 2 s after being left |
| 4 | 1696–2144 | SEESAW ×3 (144 w, ±25°, gaps 32–48) over the river |
| CP2 | 2176 | |
| 5 | 2208–2848 | PEND ×2 swinging logs (T 2.8), DARTS from 2 heads |
| 6 | 2880–3296 | FERRIS water wheel (4 paddles 48 w, radius 80, T 7) over a 192 px waterfall |
| CP3 | 3328 | |
| 7 | 3360–4640 | "Perseguição da Pedra": downhill tunnel dropping 192. A ø64 boulder is released when someone passes 3360, then every 6 s. It moves 105 px/s on flat ground, capped at 140 on the slope. HURD ×3 and 2 gaps of 56. Getting hit flattens you for 1.2 s. On-screen warning "PEDRA!" |
| 8 | 4672–5760 | 3 slow lily pads, FINISH gate at x 5504 |

Memorable moment: the boulder chase.

**selva-3 "Roda do Totem"**
- Survival. Objective "SOBREVIVA!".
- Evokes Fall Guys Jump Club and Stumble Guys Over & Under.
- Arena: 448 px over a ravine, with a totem in the centre.
- **DSWEEP logs:** bars rotate around the totem and cross all 4 lanes.
  - LOW log (h 0–20): jump it.
  - HIGH log (h 28–56): stay down.
  - A shadow crosses the lanes as the warning.
- **Boulders:** roll in from the sides.

| t (s) | Rotation | Other changes |
|---|---|---|
| 0–15 | 45°/s, LOW log only | |
| 15–30 | 60°/s, HIGH log added | |
| 30–45 | 72°/s | boulders ø28 every 5 s |
| 45–60 | reverses every 10 s (eyes flash 1 s before) | boulders every 4 s, edges −32 each side |
| 60–75 | 90°/s | boulders every 3 s |
| 75–90 | 110°/s | double boulders, edges −32 each side |

Ends at `targetAlive` or 90 s. How it differs from ceu-3: ceu-3 is about position, dodging walls that sweep sideways; this one is about rhythm, since every bar hits all players at once.

**selva-4 "Pilares do Rio"**
- Final. Objective "SEJA O ÚLTIMO DE PÉ!".
- Arena: 6 stone pillars (48 w, gaps 32) with tops at 0/+16/0/+24/0/+16, over a river at h −56. Touching the water eliminates you.
- 2 log rafts drift in the river (±48).
- **Pillar sinking:** a pillar sinks while occupied, faster with more people on it (×(1 + 0.5·(n−1))). It rises 4 px/s when empty. A pillar that reaches the water is gone.

| t (s) | Pillar sink rate | Other changes |
|---|---|---|
| 0–20 | 6 px/s | darts every 3 s |
| 20–40 | 8 px/s | one pillar collapses every 12 s (2 s warning) |
| 40–70 | 10 px/s | darts from both sides at 2 heights every 2 s; rafts sink after 2 s |
| 70–100 | | collapses every 8 s, water rises 2 px/s |
| 100+ | all sink 12 px/s | |

Ends by about 105 s. Memorable moment: pillar-hopping, where sharing a pillar speeds up its sinking.

### Estação Espacial

The space phases use low gravity; limits are in section 0.

**esp-1 "Corrida Orbital"**
- Slot 1, Race. Objective "CORRA ATÉ A CHEGADA!".
- Evokes Space Race.
- Target 80 s. Size 5600×400.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–320 | START |
| 2 | 320–864 | GAPS 96(+48)/112(−32)/96(+64)/128(0), platforms 80 w |
| 3 | 864–1440 | LASER ×4 floor-to-ceiling gates (ceiling at h 128), 1.2 s on / 1.4 s off, spacing 128, φ step 0.5 s, 0.4 s flicker warning |
| CP1 | 1472 | |
| 4 | 1504–2112 | CONV ±60 alternating, PAD ×3 (apex 180) up to a deck at h 160 |
| 5 | 2144–2656 | MOVP ×3 vertical (±64, T 4, gaps 112) |
| CP2 | 2688 | |
| 6 | 2720–3232 | LASER ×3 short horizontal beams (96 px) moving between h 8 and 120 (T 3, φ steps of ⅓) |
| 7 | 3264–3712 | ROTOR ×2 laser arms (pivot h 64, length 80, T 4, opposite directions) |
| CP3 | 3744 | |
| 8 | 3776–4352 | WIND ×3 fans (lift to h 200) across a 256 px void, plus 2 laser gates at h 100–140 (1.0 s on / 1.6 s off) |
| 9 | 4384–5600 | HURD ×3 (24 px), 1 laser gate, FINISH gate at x 5344 |

Memorable moment: floating on fans between lasers.

**esp-2 "Cinturão de Asteroides"**
- Slot 2, Race. Objective "CORRA ATÉ A CHEGADA!".
- Target 90 s. Size 6000×640.

| # | x | Segment and parameters |
|---|---|---|
| 1 | 0–256 | START |
| 2 | 256–832 | FERRIS ×2 asteroid rings (3 rocks, radius 96, T 7), gaps ≤128 |
| 3 | 832–1472 | GRAV mini black hole below the path (centre h −160, radius 240, air pull 280, ground drift 30), 5 rocks with gaps 96–112 |
| CP1 | 1504 | |
| 4 | 1536–2176 | LASER ×2 turrets at h 96 (beam 160, T 5; pass while the beam is up), HURD ×2 |
| 5 | 2208–2720 | CRUSH ×4 airlock doors (T 2.6, closed 0.6 s, spacing 128, phase wave) |
| CP2 | 2752 | |
| 6 | 2784–3680 | SPLIT. Upper at h 240: MOVP ×4 rocks (±48, T 3.5). Lower at h 64: CONV −50 and 3 laser gates |
| 7 | 3744–4448 | GRAV pulling backward (air −60, drift −25), ROTOR ×2 satellites (pivot h 80, arm 96, 3 panels, T 6) |
| CP3 | 4480 | |
| 8 | 4512–5120 | PAD chain ×3 over the void, laser gate pairs above (1.0 s on / 1.5 s off) |
| 9 | 5152–6000 | FINISH gate at x 5760 |

Memorable moment: asteroid hopping while being pulled toward the black hole.

**esp-3 "Varredura Laser"**
- Survival. Objective "SOBREVIVA!".
- Evokes Laser Tracer.
- Arena: a 448 px deck with a ceiling at h 144. Here a laser hit eliminates you outright ("desintegrado").
- **Laser types:**
  - **Columns:** 32 px wide, a dotted warning line, then they fire for 0.5 s. You dodge them by moving sideways.
  - **Full-width lines:** LOW at h 4–12 (jump) or HIGH at h 32–40 (stay grounded). They punish spam-jumping in low gravity.
  - **Fences:** laser fences close in from the sides.

| t (s) | Columns | Lines | Other changes |
|---|---|---|---|
| 0–15 | 1 every 1.5 s, 1.2 s warning | | |
| 15–30 | | LOW every 5 s, 1.0 s warning | |
| 30–45 | 2 every 1.3 s | alternating LOW and HIGH every 3.5 s | |
| 45–60 | "scanner" wave crossing at 200 px/s with a 48 px gap | | fences leave 352 px |
| 60–75 | shorter warning, 0.9 s | every 2.5 s, including LOW + HIGH doubles 0.6 s apart (0.8 s warning) | |
| 75–90 | 3 every 1.0 s | every 2.0 s | fences leave 256 px |

Ends at `targetAlive` or 90 s.

**esp-4 "Colapso da Estação"**
- Final. Objective "SEJA O ÚLTIMO DE PÉ!".
- Arena: 7 modules of 64 px at h 0, plus 3 floating modules at h 72. A black hole sits at (224, −200).
- **Pull:** a ground drift toward the centre, starting at 20 px/s. In the air the pull is a stronger acceleration (see the table).
- **Module detachment:** 2 s of sparks and red lights, then the module drops away.
- **Debris:** ø16, can be jumped, flies toward the black hole.

| t (s) | Ground drift | Air pull | Modules | Debris |
|---|---|---|---|---|
| 0–20 | 20 px/s | 150 px/s² | | |
| 20 | 35 | | centre module detaches | |
| 45 | 50 | | both neighbours detach; floating modules fall | 1 every 3 s |
| 70 | 65 | | next pair detaches | |
| 100 | 80 | 400 | outer pair detaches, nothing left | 1 every 1.5 s |

- Ends by about 105 s. Winner is the last one pulled in.

Memorable moment: running outward against the pull while the hole grows.

### Segments used per phase

| Phase | Segments |
|---|---|
| ceu-1 | START, HURD, GAPS, PEND, PUSH, ROTOR, MOVP, SPLIT, STEP, FINISH |
| ceu-2 | PAD, SLOPE, HURD, SEESAW, ROTOR, ROLL, CRUMB, CONV, STEP |
| ceu-3 | WALLS, SHRINK |
| ceu-4 | TILEFALL |
| gelo-1 | ICE, HURD, SLOPE, GAPS, PEND, PUSH, ROLL, CRUMB, WIND |
| gelo-2 | DROP, GAPS, ICE, CRUMB, WIND, PEND, SPLIT, MOVP, PUSH, HURD, ROTOR, ROLL (giant + niches) |
| gelo-3 | DARTS (arcing), ROLL, WIND, ICE, SHRINK |
| gelo-4 | CRUMB (∞), SHRINK, PUSH (penguins), MOVP / SINK (floes), ICE |
| vulc-1 | GAPS, JETS, ROTOR, SINK, CRUSH, PAD, STEP |
| vulc-2 | STEP, JETS, CONV, HURD, DROP, FERRIS, MOVP, CRUSH, SPLIT, ROTOR, PAD |
| vulc-3 | DROP (destroys tiles), SHRINK |
| vulc-4 | RISING, CRUMB, ROTOR, DROP, STEP |
| selva-1 | HURD, GAPS, PEND, DARTS, CRUMB, SLOPE, ROLL, JETS, ROTOR, SPLIT |
| selva-2 | SLOPE, ROLL (+chase), SINK, SEESAW, PEND, DARTS, FERRIS, HURD |
| selva-3 | DSWEEP, ROLL, SHRINK |
| selva-4 | SINK, DARTS, MOVP, RISING |
| esp-1 | GAPS, LASER, CONV, PAD, MOVP, ROTOR, WIND, HURD |
| esp-2 | FERRIS, GRAV, LASER, HURD, CRUSH, SPLIT, MOVP, CONV, ROTOR, PAD |
| esp-3 | LASER (columns / lines / fences) |
| esp-4 | GRAV, CRUMB, DARTS (debris) |

## 5. Difficulty curve and variety

**Difficulty on a 1–10 scale**

| World | Race 1 | Race 2 | Survival | Final |
|---|---|---|---|---|
| Céu Doce | 2 | 4 | 4 | 5 |
| Reino Gelado | 3 | 5 | 5 | 6 |
| Vulcão | 4 | 6 | 6 | 7 |
| Templo da Selva | 4 | 6 | 6 | 7 |
| Estação Espacial | 5 | 7 | 7 | 8 |

**Rules by slot**

| Rule | Race 1 | Race 2 | Survival / Final |
|---|---|---|---|
| Max gap | 72 | 80 | 64 |
| Max step up | 40 | 48 | 40 |
| Shortest hazard period | 2.0 s | 1.6 s | ramps |
| Minimum warning | 0.8 s | 0.6 s | 1.2 → 0.6 s |
| CP spacing | 1100–1500 px | 1100–1500 px | — |

**Where each obstacle type appears**

| Type | Phases |
|---|---|
| PEND | ceu-1, gelo-1, gelo-2, selva-1, selva-2 |
| ROTOR | ceu-1, ceu-2, gelo-2, vulc-1, vulc-2, vulc-4, selva-1, esp-1, esp-2 |
| PUSH | ceu-1, gelo-1, gelo-2, gelo-4 |
| CRUSH | vulc-1, vulc-2, esp-2 |
| FERRIS | vulc-2, selva-2, esp-2 |
| CRUMB | ceu-2, gelo-1, gelo-2, selva-1, vulc-4, gelo-4, esp-4 |
| SINK | vulc-1, selva-2, selva-4 |
| SEESAW | ceu-2, selva-2 |
| ROLL | ceu-2, gelo-1, gelo-2, selva-1, selva-2, gelo-3, selva-3 |
| CONV | ceu-2, vulc-2, esp-1, esp-2 |
| PAD | ceu-2, vulc-1, vulc-2, esp-1, esp-2 |
| JETS | vulc-1, vulc-2, selva-1 |
| DROP | gelo-2, vulc-2, vulc-3, vulc-4 |
| DARTS | selva-1, selva-2, gelo-3, selva-4, esp-4 |
| LASER | esp-1, esp-2, esp-3 |
| WIND | gelo-1, gelo-2, gelo-3, esp-1 |
| GRAV | esp-2, esp-4 |
| Each once | WALLS (ceu-3), DSWEEP (selva-3), TILEFALL (ceu-4), RISING (vulc-4, selva-4) |

Each world's two races share at most 3 of their signature segments.

## 6. The 20 skins

Skin tones: S1 #F9D3B4, S2 #E8B48F, S3 #C68B5E, S4 #8D5A3B, S5 #5E3A26.

| # | Name | Head | Shirt | Pants | Skin | Accessory |
|---|---|---|---|---|---|---|
| 1 | **Beto Boné** (default hero) | red cap #E8322B, brown hair | red t-shirt | blue jeans #2F5FD0 | S2 | white sneakers |
| 2 | Guga Verde | green cap #3DAA3A | brown shirt with skull print | brown shorts | S3 | — |
| 3 | Duda Azul | blue cap #2A62D6 | white t-shirt | navy trousers | S2 | — |
| 4 | Xerife Tonho | brown cowboy hat | red shirt | jeans | S3 | red bandana |
| 5 | Olaf Viking | horned helmet #8C97A6 | navy tunic | black trousers | S1 | ginger beard |
| 6 | Chef Juca | chef's hat | white chef jacket | brown trousers | S3 | moustache |
| 7 | Panda Pipoca | panda hood | black and white suit | black | — | round ears |
| 8 | Rosa Punk | pink hair #E0408A | black tank top | dark jeans | S1 | wristband |
| 9 | Nico Boné Preto | backwards black cap | black hoodie | navy trousers | S4 | earbuds |
| 10 | Téo Gorro | white beanie | light-blue shirt #A9C9F0 | dark trousers | S2 | — |
| 11 | Gui Loiro | blond hair, no hat | black t-shirt | jeans | S1 | — |
| 12 | Zeca Capacete | yellow hard hat | orange vest | jeans | S5 | — |
| 13 | Kaio Astronauta | bubble helmet with cyan visor | white spacesuit | white | S3 | oxygen tank |
| 14 | Pingo Pinguim | penguin hood | black and white | black | — | orange feet |
| 15 | Nina Ninja | red headband and mask | black outfit | black | S2 | — |
| 16 | Capitão Barba | tricorn hat | red and white stripes | brown | S3 | eye patch |
| 17 | Rex Dino | green dinosaur hood with spikes | green | green | — | tail |
| 18 | Bia Bombeira | red firefighter helmet | tan jacket with yellow stripes | tan | S4 | — |
| 19 | Indi Explorador | safari hat | khaki shirt | brown shorts | S2 | backpack |
| 20 | Bip Robô | silver head with antenna | grey | grey | — | LED eyes |

## 7. The 60 bot nicknames

All ASCII.

xX_Pedrin_Xx, Lukinhas2011, BRZ_Maromba, DuduGamer_BR, Kauan_PvP, AnaClara07, Nicolas_Top1, JoaoVitor_XD, Tio_Bolinha, Vitinho_Monstro, GabiGameplay, Rafa_Noob123, Bruninha_, Ze_Da_Manga, Enzo_Bala, Gordin_Veloz, LeoZika, Mc_Pulinho, PiuPiu_BR, Sr_Coxinha, PaoDeQueijo99, Brigadeiro_Fofo, Tatu_Bolinha, CapivaraRage, Julinha_Kawaii, Matheus_BR, Thiagao_PRO, Lipe_Tryhard, Duda_OP, Kaio.exe, Yasmin_Sz, Sofia_Sz2, Arthur_GG, Heitor_1v1, Tropeco_Master, UltimoDePe, BRabo_Games, Fominha_BR, Pastel_De_Vento, Acai_Com_Granola, Mandioca_Frita, Guarana_Gelado, Jacare_Voador, Sabia_Laranjeira, Macaquinho_BR, Tucano_Turbo, Onca77, Saci_XD, Curupira_Pro, Boitata_Fire, Bolacha_Ou_Biscoito, Chimarrao_RS, CariocaDoGrau, Mineirinho_Uai, Baiano_Relax, Paulistinha_SP, Nordestino_Raiz, Frevo_Recife, Miguelzin_777, Bela_Tropeca.

## 8. Things the engine needs that aren't on the list yet

1. **DSWEEP** (selva-3): a bar rotating around a vertical totem. It hits only while crossing the lanes (a window of about 0.25 s) and comes in LOW and HIGH versions.
2. **Rolling objects:** snowballs that grow as they roll, a "giant" option with niches to hide in, and a chase-boulder trigger.
3. **Sinking with a crowd:** a sink multiplier based on how many players are standing on the platform.
4. **Meteors** that destroy tiles and leave holes.
5. **Lasers:** columns and full-width lines with dotted warning lines, plus fences that close in.
6. **Black hole:** pull split into ground drift and air acceleration.
7. **Vertical arena camera and lava** (vulc-4): the camera follows the player up, and the lava rubber-bands to the leader.
8. **Pulsing geyser pads.**
9. **Kicker ramp** that preserves slope speed.
10. **Sudden death and tie-breaks** for finals.

### Critical files to create

These are all new, since the project folder is empty:
- /home/evandro/git/em_tech/thelastguy/src/content/segments.js (the 22 generators, arena modules and safety checks)
- /home/evandro/git/em_tech/thelastguy/src/content/phases.js (the 20 phases as lists of segments with x, parameters and CPs, plus survival/final ramp tables)
- /home/evandro/git/em_tech/thelastguy/src/content/worlds.js (palettes, parallax layers, obstacle looks, music)
- /home/evandro/git/em_tech/thelastguy/src/content/skins.js (the 20 skins and 5 skin tones)
- /home/evandro/git/em_tech/thelastguy/src/content/botNames.js (the 60 nicknames)
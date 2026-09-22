<!-- Especificação do motor, física, bots e regras (planejamento) — gerado pelo agente de planejamento; referência para a implementação -->

# The Last Guy: Simulation Core Technical Design

I didn't write any files. The project folder only has the reference PNGs, one of them twice (`6f8e4d7a-… (1).png`). I checked every number in section 2 by running the actual 60 Hz integrator in `node -e`, so they're measured, not estimated. I also checked two environment facts: python3's `http.server` serves `.js` as `text/javascript`, and Node 18.19 includes `node:test`.

---

## 0. Changes to the tentative design

**Keep:** fixed 60 Hz step, mulberry32, obstacles as functions of match time, one shared InputState, a sampling planner for bots, 32→16→8→≤4→1, and a headless harness.

**Change or refine:**

1. **No character-to-character physics in the sim.** Move "soft separation" into the renderer as a visual de-clumping offset of at most 4 px. In 2D it adds nothing to gameplay. It's also the one interaction that breaks client prediction, because remote players are drawn in the past. Without it, predicting your own character is almost exact.
2. **Integer-pixel Actor/Solid model** (the Celeste/TowerFall approach) instead of float AABB sweeps. Positions are integers plus float remainders, and movement steps 1 px at a time against solids. This gives no epsilons and no tunneling. Riders move in lockstep with their platforms, and snapshots quantize trivially.
3. **Make even more of the world a pure function of time.**
   - Rolling objects use trajectories baked at level build and replayed for each spawn.
   - Projectiles use closed-form motion.
   - Bombardments come from a seeded schedule.
   - Only crumble/tile-fall, sinking platforms, seesaws and triggered icicles keep contact state.
4. **Bots choose closed-loop policies** like "run and jump at the edge", not fixed input sequences. Their rollouts reuse the real character integrator with a cheaper collider. The one required hint is a **route polyline**, generated automatically by the level builder. It drives progress, placements, spectate order and bot scoring.
5. **Single-button dive:** a jump press while airborne is a dive, *unless* the character is predicted to land within the jump-buffer window. In that case it's a buffered jump. Very early double-taps queue a pending dive.
6. **Ties** are broken by sub-tick crossing time, then by a seeded tiebreak permutation. Never by slot id, because the human is always slot 0.
7. **Termination guarantees:** every round eliminates at least 1 player and advances at least 1. The final always has exactly one winner (sudden death plus a failsafe). Stuck bots respawn silently.
8. **Constant 10×20 collision box in every state**, with a forgiving 8×17 hurtbox. I-frames cover the whole ragdoll→prone→getup chain, so a player can't be stun-locked.
9. **`limits.js` computes gap and step limits from the real integrator.** The level builder validates geometry against them, so re-tuning physics can't silently break levels.
10. **Contact-triggered changes always apply at least 1 tick later.** That makes slot order irrelevant, which helps both determinism and prediction.
11. **Bot skill comes from analog `move` magnitude and decision quality, never physics multipliers.** AI level-of-detail depends only on sim state, never on the wall clock.
12. **No build step for Node:** a root `package.json` containing only `{"type":"module"}` lets Node 18 import `src/**/*.js` as ESM.

---

## 1. Architecture

### 1.1 Layout
```
index.html
package.json                  {"type":"module"} only
src/
  main.js
  core/     constants.js rng.js dmath.js events.js pool.js
  sim/      tuning.js limits.js input.js world.js character.js snapshot.js hash.js tournament.js
    physics/   body.js (moveX/moveY) collide.js kinematics.js shapes.js knockback.js grid.js forces.js
    obstacles/ index.js base.js pendulum.js rotator.js pusher.js piston.js crusher.js mover.js ferris.js
               crumble.js sinking.js seesaw.js jumppad.js bumper.js hurdle.js roller.js cannon.js
               bombard.js icicle.js trap.js laser.js sweeper.js wind.js lava.js blackhole.js gravzone.js
    levels/    level.js (Level + LevelQuery) builder.js segments.js route.js validate.js catalog.js
               ceu-doce/fase1..4.js reino-gelado/… vulcao/… templo-selva/… estacao-espacial/…
    rules/     common.js race.js survival.js final.js
    bots/      botController.js planner.js policies.js rollout.js profiles.js names.js
  net/      session.js (Session + LocalSession) transport.js (interface + FakeTransport) protocol.js (future codec)
  game/     app.js matchController.js storage.js        browser orchestration, no drawing
  input/ render/ ui/ audio/                             browser-only
tools/      simulate.mjs lint-sim.mjs test/*.test.mjs   (node --test)
```
- `tournament.js` and the mode builders live in `sim/` so a future server can run tournaments.

### 1.2 Dependency rules (enforced by `tools/lint-sim.mjs`)
- `src/core` and `src/sim` must not reference `window`, `document`, `performance`, `Date`, `requestAnimationFrame`, `localStorage` or `Math.random`.
- `src/sim` must not use `Math.sin/cos/tan/atan2/exp/log/pow/hypot`; use `dmath` instead.
- sim imports only from core and sim.
- render, ui, audio and input may import sim modules read-only (obstacle `pose()` functions, enums). Never the reverse.

### 1.3 Order of one tick
```js
step(inputs) {                                   // inputs: InputState[32]
  const t = ++this.tick * DT;                    // recomputed from tick, never accumulated
  this.rules.preStep(this);                      // countdown gate, ramp stage, sudden death
  this.dyn.preStep(this);                        // crumble/sinking/seesaw/icicle from LAST tick's contacts
  this.kin.moveAll(this, t);                     // kinematic solids to pose(t): carry, push, squeeze
  for (const c of this.chars)                    // slot order; characters never read each other
    stepCharacter(c, this.rules.gate(inputs[c.slot]), this, t);
      // intent → forces → moveX/moveY → supports → hazards → kill/finish/checkpoint → this.pending[]
  this.rules.resolve(this.pending);              // sort by (subTick, tiebreakRank); qualify/eliminate/respawn
  this.rules.postStep(this);                     // end checks → 'ending' (150 ticks) → 'over'
  this.obstacles.emit(t - DT, t, this.events);   // cosmetic schedule events (cannon fire, slam, laser on)
}
```

### 1.4 Fixed timestep and interpolation
```js
advance(frameDt) {                               // LocalSession
  this.acc += Math.min(frameDt, 0.25); let n = 0;
  while (this.acc >= DT && n < 5) {
    for (const s of slots) this.ctrl[s].write(this.world, s, this.inputs[s]);   // bots think here
    this.world.step(this.inputs); this.acc -= DT; n++;
  }
  if (n === 5) this.acc = 0;                     // drop time rather than spiral
  return this.acc / DT;                          // alpha
}
```
- **Render time** is `(tick − 1 + alpha)·DT`.
- **Characters and rider-carrying solids:** lerp between their integer positions at the previous and current tick. This keeps riders and platforms from shimmering against each other.
- **Pure hazards** (hammers, lasers, rollers): draw with `pose(renderTime)`, which is smooth even at 120 Hz.
- **Teleports** (respawn, squeeze eject) set a `snap` flag so the renderer skips the lerp.
- **Button presses are never lost.** Device handlers increment a `pressSerial`, and the HumanController reports `jump=true` for exactly one tick per increment. This holds whether a frame runs 0 or 3 ticks.
- **`move` is quantized to int8/127 even offline**, so local and network inputs are bit-identical.

### 1.5 Determinism checklist
- **Time:** `tick` is an integer and `t = tick·DT`.
- **RNG streams are separate.**
  - `matchRng` is used at build time for phases, schedules and the tiebreak permutation.
  - `botRng[slot] = mulberry32(hash(seed, slot))`.
  - No subsystem shares a stream, so adding a bot decision never shifts obstacle phases.
- **Trig:** `dmath.sin/cos` does range reduction plus an odd polynomial using only `+ − * /`, which is IEEE-exact in every engine. `Math.sqrt` is also exact. Constants are written as literals.
- **Ordering:** arrays are kept in id/slot order, sorts use total-order comparators, and nothing depends on object-key iteration.
- **No wall clock:** the sim and bots never adapt to real time.
- **Tests:**
  - The same seed run twice gives equal `world.hash()` every 600 ticks.
  - serialize → deserialize → continue gives the same hash.
  - A replay needs only matchConfig plus the human's input log (2 B per tick, about 21 KB for a 3-minute race) to reproduce the whole match.

### 1.6 Multiplayer seams (defined in v1, implemented later)
```ts
interface Controller { write(world, slot, out: InputState): void }
  // HumanController (client), BotController, ReplayController, NetworkController (server)

interface Session {
  start(): Promise<void>; setLocalInput(i: InputState): void;
  advance(frameDt: number): number;            // returns alpha
  readonly view: RenderView;                   // read-only for render/HUD
  drainEvents(out: SimEvent[]): number;
  readonly status: 'countdown'|'running'|'ending'|'over';
  readonly result: RoundResult|null; dispose(): void;
}
// LocalSession (v1) | RemoteSession (future) | LoopbackSession (dev: in-process server World +
//   RemoteSession over FakeTransport with latency/jitter/loss, validates prediction before a server exists)
interface Transport { send(b: Uint8Array); onMessage(cb); onClose(cb); close() }
```
- **NetworkController** repeats the last input with presses cleared when an input arrives late.

**matchConfig** is all you need to rebuild a match anywhere:
```js
{ v: 1, tuning: 'v1', seed: 0x9e3779b9, levelId: 'vulcao/3',
  rules: { type: 'survival', target: 4, timeLimit: 100 },
  roster: [{ slot: 0, name: 'Você', human: true, skin: 7 },
           { slot: 1, name: 'Bia', bot: { profile: 'normal', personality: 'cautious' }, skin: 3 }, …] }
```

**Never serialized** (rebuilt from levelId + seed): static geometry, pure obstacles, schedules, baked roller paths, laser length tables.

**Serialized:** characters, dynamic obstacle state, rules state, and bot RNG states.

**Input on the wire (client → server):** 2 bytes per tick.
- `move: int8`.
- `buttons: u8`: bit 0 is jumpHeld, bits 1–3 are jumpPressSeq (mod 8), bits 4–6 are divePressSeq (mod 8).
- Each packet carries `firstTick: u32` plus the last 6 ticks, for loss redundancy.
- The server detects press edges from sequence changes, which survives packet loss and repeats.

**Snapshots (server → client)** at 20 Hz:
- Header: `tick`, `ackTick`.
- Public record per character, about 12 B: slot, state, stateTicks, flags (facing, grounded, 2-bit lane, blink, alive), x u16, y i16, vx and vy as i16 in 1/8 px/s.
- Private record for the receiving player: exact remainders and all timers, used for reconciliation.
- Deltas of dynamic obstacle state.
- Reliable events: qualified, eliminated, roundEnd.
- Total is about 450 B per snapshot, or roughly 9 KB/s per client.

**Client prediction:**
- The client predicts only its own character, using the same `stepCharacter()`.
- Obstacles are evaluated at the predicted tick. Dynamic obstacles come from the latest snapshot and are rolled forward; crumble timers are deterministic once the trigger tick is known.
- On each snapshot: restore the private record at `ackTick`, replay the stored inputs, and fade the visual error by about 15% per frame.

**Clock sync:**
- Ping/pong once per second, with a smoothed average of RTT and offset.
- `predictedTick = estServerTick + ceil((RTT/2 + 2 ticks)/DT)`. The client runs at 0.98–1.02× speed to hold that lead.
- Remote characters are drawn at `estServerTick − 6` using snapshot interpolation, with at most 250 ms of extrapolation.
- Obstacles are drawn at the predicted tick. Remote players therefore appear slightly behind the hazards; Fall Guys makes the same trade-off.

**Server reuse:** a future `server/matchServer.mjs` imports `src/sim/*` unchanged (World, NetworkController, BotController, Tournament) and runs a fixed loop using hrtime. Node 18 has no built-in WebSocket server, so use `ws` on the server or a roughly 150-line RFC 6455 handler. The no-library rule applies to the client.

**RenderView contract for the render agent:** tick, alpha, renderTime, level (static geometry, theme, finishX), obstacles (call `inst.pose(t)`), dyn states, and per character: interpolated x/y, facing, state, stateTicks, lane, skin, name, isLocal, blink, spin. It also carries hud (objective, qualified/quota, alive/target, timeLeft, countdown) and spectate candidates.

**Constraints for the render agent:**
- Physics is lane-agnostic, so the vertical offset per lane must stay small (at most 3 px) or hazard hits will look wrong.
- A platform's physics top is the front edge of its drawn top face.

---

## 2. Tuning (px, seconds, +y down, 60 Hz)

The character's position is its feet center, as an integer pixel plus float remainders. The body AABB is `[x−5, x+5) × [y−20, y)`.

**A. Movement (normal profile)**

| Parameter | Value | Effect |
|---|---|---|
| Collision body / hurtbox | 10×20 / 8×17 (inset 1 px each side, 3 px top) | forgiving hits |
| MAX_RUN | 100 px/s (6.25 tiles/s) | crosses a 480 px screen in 4.8 s |
| Ground accel / decel / turn | 900 / 1400 / 2200 px/s² | 0→max in 0.11 s, stops in 0.07 s |
| Air accel / decel / turn | 600 / 150 / 900 | |
| Over-speed decay (\|vx\| above MAX_RUN) | ground 700, air 120 | knockback, dive, pads and conveyors carry momentum |
| Ice accel / decel / turn | 220 / 70 / 320 | 0→max in 0.45 s, slides 71 px from full speed |
| Conveyor surface speed | 40 / 60 px/s | accel and friction act on `vx − surfaceVx` |
| Slide ramps | friction 40; along-slope accel g·sinθ·cosθ = 368 px/s² at 1:2; cap 220 | |
| Gravity while rising with jump held / otherwise | 660 / 920 | snappier fall |
| MAX_FALL | 320 px/s (5.3 px/tick) | reached after 56 px of falling |
| JUMP_V | 240 px/s | |
| Variable jump | after at least 5 ticks held, releasing clamps vy to −90 | |
| Coyote / jump buffer | 6 / 8 ticks (100 / 133 ms) | |
| Liftboost | jumping off a moving solid adds its velocity, capped at 250 | |
| Piston launch | if the solid's upward speed drops by more than 120 in one tick, the rider keeps it | |
| Jump pads | vy −300 / −380 / −480 → apex 49 / 78 / 125 px | |
| Trampoline | vy = −max(0.9·impact, 300) | |
| Wind | ±250 px/s² in air, ×0.4 on ground | mostly affects jumps |
| Fan updraft | −1400 px/s², max rise 160 | |
| Black hole | pull up to 450 px/s², falling off linearly to radius R; core kill radius 10 px | |

**B. Resulting moves (measured)**

| Move | Apex | Airtime | Distance at 100 px/s |
|---|---|---|---|
| Full jump | 41.6 px (2.6 tiles) | 40 ticks (0.67 s) | 66.7 px |
| Tap jump | 20.2 px | 23 ticks | 38.3 px |
| Full jump onto a +32 px ledge | – | 31 ticks | 51.7 px |
| Full jump down 32 px | – | 46 ticks | 76.7 px |
| Jump + dive at apex (vx 170, vy = min(vy, −60)) | 43.1 px | 44 ticks | 99 px |
| Ground dive (explicit dive key only; vy −120) | 6.8 px | 15 ticks | 42 px lunge, then 29 px slide and 0.3 s getup |

Diving on flat ground loses about 18 px compared with just running for the same time. So spamming dive doesn't pay; it only helps over gaps and at the finish line.

**C. Designer limits (normal profile).** The theoretical maximum is travel distance + 8 px (1 px of overlap at takeoff and at landing with a 10 px body). Level designers should use the right-hand column.

| Feature | Theoretical max | Designer limit |
|---|---|---|
| Same-height gap, tap jump | 46 px | ≤ 2 tiles |
| Same-height gap, full jump | 75 px | ≤ 3 tiles standard, 4 tiles "difícil" (about a 6-tick window), never 5 |
| Gap that requires a dive | 107 px | exactly 5 tiles, never 6 or more |
| Step up 1 tile | gap ≤ 68 px | a tap jump clears it; allow gaps up to 3 tiles |
| Step up 2 tiles | gap ≤ 60 px | needs a full jump; gap ≤ 2 tiles (3 for "difícil") |
| Wall of 3+ tiles | – | impassable, use as a barrier |
| Hurdle height | – | ≤ 12 px |
| Ceiling over a jump path | needs 62 px | ≥ 4 tiles; corridors ≥ 2 tiles |
| Drop | unlimited | a fall of 8+ tiles causes a hard-land stumble (can be turned off per level) |
| Ramps | ≤ 45° | only 1:2 and 1:1 |
| Hazard speed | – | ≤ 6 px/tick; anything faster must be flagged `fast` (swept test) |

**Low-gravity profile** (Estação Espacial and gravity zones): gravity ×0.5, JUMP_V ×0.8, jump cut ×0.8, MAX_FALL ×0.6, air accel ×0.8.
- Full jump: apex 54 px, 64 ticks, 107 px.
- Tap jump: 19 px apex, 53 px.
- Dive at apex: 160 px.
- Limits: gaps ≤ 5 tiles (6 "difícil", 8 with a dive), steps ≤ 3 tiles, ceilings ≥ 5 tiles.

**D. Knockback tiers**

| Tier | Used by | Magnitude (px/s) | Min upward | Result | Flight on flat |
|---|---|---|---|---|---|
| bump | bumpers, soft pushers | 150, fixed direction | 100 | STUMBLE 12 ticks (control ×0.3), 12-tick cooldown per obstacle | ~32 px |
| trip | hurdles (grounded only) | vx = facing·70, vy −90 | – | TRIP → PRONE 18 | ~15 px |
| light | darts, lasers, small logs, fire jets | 200 + 0.5·closing, clamped 180–280 | 180 | RAGDOLL → PRONE 21 | ~67 px |
| heavy | hammers, boulders, bombs | 280 + 0.6·closing, clamped 260–420 | 240 | RAGDOLL → PRONE 30 | 119–178 px |

- \|vx\| is at least 60 so the victim always leaves the hazard's path.
- Ragdoll physics: vx ×0.98 per tick; bounces off the floor when vy > 200 (vy ×−0.35, vx ×0.7); walls ×−0.4.

**E. Timers (ticks)**

| Timer | Ticks |
|---|---|
| Dive minimum air time | 6 (earlier presses become a pending dive) |
| Dive slide | up to 24 (ends early when \|vx\| < 20) |
| Getup | 18 |
| Prone: light / heavy / trip / hard landing | 21 / 30 / 18 / 12 (each jump press −3, minimum 9) |
| Squashed | 36 |
| I-frames | from the hit until 30 ticks after getup |
| Respawn delay / respawn i-frames | 60 / 60 |
| Celebrate | 72 |
| Countdown | 180 (obstacles already running) |

---

## 3. Collision system

### 3.1 Actors and solids, 1 px at a time
Actors (characters) never overlap solids. Solids always move and are never blocked; actors get carried, pushed or squeezed.
```js
function moveX(c, amount, w) {                   // returns false if blocked
  c.xRem += amount; let n = Math.round(c.xRem); if (!n) return true;
  c.xRem -= n; const s = n > 0 ? 1 : -1;
  while (n) {
    if (!w.solidAt(c.x + s, c.y, c)) { c.x += s; if (c.grounded) followGround(c, w); }
    else if (!(c.grounded && stepUp(c, s, 2, w))) { c.xRem = 0; hitWall(c, s); return false; }
    n -= s;
  }
  return true;
}
```
- **moveY going down, pixel by pixel:**
  - A solid top stops the character.
  - A one-way top stops it only if the feet were exactly at the top before the step and it isn't ascending.
  - A ramp stops it when footY reaches rampY(footX).
- **moveY going up:** only solids block.
- **Fast path:** if the grid finds nothing in the swept box, move the whole distance at once.
- **Ramps** are walkable surfaces that are one-way from above and checked with the foot point.
  - `followGround` snaps the feet to the surface when it's within ±2 px. Since ramps are at most 45°, the height changes by at most 1 px per px.
  - If there's no surface within 2 px below, the character becomes airborne and coyote time starts.
  - Seams at ramp ends are handled by the ≤ 2 px step-up.
- **Supports:** up to 3 surfaces touching the feet. Ground material comes from the surface under the foot center.
- **Safety net:** an actor that starts a tick inside a solid runs the eject search from 3.2.
- **No rotated solids.** Rotating things you can stand on are ferris gondolas that stay level. A spinning log is a one-way platform with surface speed.

### 3.2 Kinematic solids
```js
for (const s of kinematic /* id order */) {
  s.posAt(t, P);                                 // integer px = Math.round(pure pose)
  const dx = P.x - s.x, dy = P.y - s.y; if (!dx && !dy) continue;
  const riders = collectRiders(s);               // feet touching s.top, measured BEFORE the move
  s.collidable = false; s.x = P.x; s.y = P.y;
  for (const c of chars) {
    if (riders.has(c)) { moveX(c, dx); moveY(c, dy); c.lift = s.vel; }
    else if (!s.oneWay && overlaps(c, s)) {
      if (!pushOut(c, s, dx, dy)) squeeze(c, s);
      else if (s.impart) { c.vx = 0.8 * s.velX; stumble(c); }   // purple pushers shove you off edges
    } else if (s.oneWay && dy < 0 && feetBetween(c, s.top, s.top - dy)) moveY(c, s.top - c.y);
  }
  s.collidable = true;
}
```
- **Rider displacement uses the integer rounded pose**, so the rider moves exactly as much as the platform.
- **Ferris wheels:** N one-way gondolas whose centers follow a circle and stay level.
- **Crushers:** shake 24 ticks → slam at 400 px/s → hold 36 → rise at 40 px/s.
- **Block Dash walls:** stacks of kinematic solids sweeping at 60–120 px/s. Being pushed off the arena edge counts as a fall.
- **Squeeze handling:**
  - Search for a free spot perpendicular to the push, alternating sides with the backward side first, in 2 px steps up to 32 px.
  - Success → SQUASHED (36 ticks) with the snap flag set.
  - Failure (should never happen; the harness counts it) → respawn in races, elimination ("esmagado") in survival/final.
  - One-way carriers never squeeze; if they can't lift the character, they pass through it.

### 3.3 Contact-triggered obstacles (the only stateful ones)
All of these read contacts from the previous tick and are serialized.
- **Crumble tile:** INTACT → SHAKING 36 ticks (30 in tile-fall) → FALLING (non-solid, 30 ticks of visuals) → GONE. In races only, it returns after 240 ticks if nobody overlaps it.
- **Sinking platform:** sinks at +20 px/s if it had riders last tick, rises at −15 px/s back to rest otherwise.
- **Seesaw:** a ramp whose angle θ changes. `ω += (Σ(riderX − pivot)·k − c·ω − s·θ)·DT`, θ is clamped to ±26°, and characters start sliding above 12°.
- **Icicle:** a trigger zone → shakes for 30 ticks → falls → shatters.

### 3.4 Hazard tests against the hurtbox, and knockback

| Shape | Test | Contact point |
|---|---|---|
| circle | clamp the center into the box; hit if d² < r² | clamped point |
| capsule | distance 0 if the segment clips the box (Liang–Barsky); otherwise the min of each endpoint→box and each box corner→segment, which is exact in 2D; hit if < r | closest point on the segment |
| OBB | SAT on 4 axes | box center clamped into the OBB's local frame |
| laser | capsule with r = 1.5–2; beam length from a 256-entry per-angle table built against static geometry | same as capsule |

```js
cp = h.closestPoint(box, t);  n = norm(center(c) − cp) || [sign(c.x − h.cx), −1];
v = h.velocityAt(cp, t);      // generic: apply pose(t)·pose(t−DT)⁻¹ to cp, divide by DT
d = norm(n + 0.8·clamp(|v|/200, 0, 1)·v̂);
mag = clamp(T.base + T.k·max(0, dot(v, n)), T.min, T.max);
c.vx = d.x·mag;  /* |vx| ≥ 60 */  c.vy = min(d.y·mag, −T.minUp);
```
- A hazard can override the direction with `knock`: blend (default), radial (bumpers), fixed (fire jets push up), or normal.
- If several hazards hit in one tick, the lowest obstacle id wins; i-frames start immediately.

### 3.5 Rolling objects, projectiles, bombardment: all pure functions
- **Rollers (baked):**
  - At level build, simulate one body per spawner against static terrain only:
    - bottom point against ramps and tops; circle treated as an AABB against walls;
    - tangential accel g·sinθ; rolling resistance 20 px/s²;
    - bounce if normal speed > 150; despawn at walls or below killY.
  - Store x/y/angle per tick in a Float32Array.
  - Instance k spawns at `t0 + k·period + jitter(hash(seed, id, k))` and reads its position from the path. The validator rejects paths that cross kinematic envelopes.
- **Cannons and darts:** straight lines or parabolas, with lifetime found once by a static raycast.
- **Bombs, meteors:** a schedule `{telegraphTick, impactTick, x}` generated at match start. The interval divides by the survival intensity, the telegraph lasts 60 ticks, and the explosion is heavy with a 20 px radius for 9 ticks.
- **Fair perception:** each bombardment event has `knowTick = telegraphTick`. Bots can't see an event before a human could.

### 3.6 Broadphase
- A uniform 2D grid of 64×64 px cells, packed in CSR form at level load.
- It holds static solids, ramps, one-ways and crumble tiles, plus every obstacle **by its motion envelope** (a pendulum's arc bounds, a roller spawner's whole path).
- It's never rebuilt at runtime, and queries dedupe with a query stamp.
- Characters aren't indexed. Expect about 5k primitive tests per tick.

### 3.7 Obstacle module contract
```js
export default { type: 'pendulum', create(def, ctx /* {rng, id, level} */) { return inst; } };
inst = { id, type, envelope,
  pose(t, out),                                                        // pure: render + sim
  hazards?: [{ shape, tier, knock, fast?, shapeAt(t, out), activeAt?(t) }],
  solids?:  [{ w, h, oneWay, mat, impart?, posAt(t, out), velAt(t, out) }],
  ramps?, zones? /* forceAt */, kills? /* killAt */,
  preStep?, onSupport?, serialize?, deserialize?, predictSolid?(i, t),  // dynamic types only
  safety?(x, y, t), emit?(tPrev, t, events) };
```
- **Designer phases and jitter:** `phase` sets a designer pattern, and `jitter` + `group` add a per-match random offset shared within a group, so alternating hammer patterns survive.
- **Survival/final ramps:** use an integrated phase `φ(t) = ∫I(τ)/T dτ` with piecewise-linear intensity, so the pattern never jumps when the ramp starts.

---

## 4. Character state machine

**States and animations**

| State | Animation (sprite sheet) | Notes |
|---|---|---|
| IDLE / RUN | idle / CORRER, playback rate ∝ \|vx\| | controllable |
| JUMP / FALL | PULO 1–4 / 5–7; landing squash for 4 ticks | controllable |
| DIVE → DIVE_SLIDE | horizontal pose → belly slide | air control ×0.25 |
| STUMBLE | ATINGIDO 1–2, upright | control ×0.3 |
| TRIP → PRONE | CAÍDA 1–3 → 4–5 | |
| RAGDOLL → PRONE | ATINGIDO tumble (`spin`) → lying | |
| GETUP | LEVANTAR | |
| SQUASHED | flattened sprite | |
| CELEBRATE / WIN | CHEGADA / EXPRESSÕES | ignores hazards and kills |
| RESPAWNING / ELIMINATED / FINISHED | hidden | not collidable |

**Transitions**

| From | Condition | To | Event |
|---|---|---|---|
| IDLE/RUN | jump pressed or buffered | JUMP | jump |
| IDLE/RUN | ground lost | FALL (coyote = 6) | – |
| FALL | jump pressed during coyote, before jumping | JUMP | jump |
| JUMP/FALL | dive pressed, or jump pressed and not landing soon (air ≥ 6, dive not yet used) | DIVE | dive |
| JUMP/FALL | jump pressed and landing within 8 ticks | buffer 8 ticks | – |
| JUMP/FALL | lands | IDLE/RUN, or PRONE 12 if the fall was ≥ 128 px | land {vy} |
| DIVE | lands | DIVE_SLIDE | diveLand |
| DIVE_SLIDE | \|vx\| < 20 or 24 ticks | GETUP | – |
| controllable, DIVE, DIVE_SLIDE | light/heavy hit, no i-frames | RAGDOLL | hit {tier, dir, obstacle} |
| controllable | bump / hurdle while grounded | STUMBLE / TRIP | bump / trip |
| RAGDOLL | lands with vy ≤ 200 (bounces otherwise) | PRONE | thud |
| PRONE, SQUASHED | timer (mash shortens PRONE) | GETUP | – |
| GETUP | 18 ticks | IDLE (i-frames +30) | getup |
| any alive | squeezed | SQUASHED | squash |
| any alive | kill volume (race) | RESPAWNING 60 → FALL at checkpoint, i-frames 60 | fall {cause}, respawn |
| any alive | kill volume (survival/final) | ELIMINATED | eliminated {place, cause} |
| any alive (race) | crosses the finish; mid-ragdoll counts | CELEBRATE → FINISHED | qualified {place} |
| alive at round end | quota/timer (race) / survivors / last alive | ELIMINATED / CELEBRATE / WIN | eliminated / qualified / winner |

**Landing-soon rule:** estimate the landing time as `τ = (−vy + sqrt(vy² + 2gd))/g`, using a ground probe of up to 64 px. A press within the buffer window becomes a jump; an earlier press becomes a dive.

**Events** go into a ring buffer as `{type, tick, slot|obstacleId, x, y, p1, p2}`:
- Countdown and flow: countdown, go.
- Character actions: jump, dive, land, diveLand.
- Being hit: hit, bump, trip, thud, getup, squash.
- Falls and progress: fall, respawn, checkpoint.
- Results: qualified, eliminated, winner, roundEnd.
- Warnings: timeWarning, rampStage, suddenDeath.
- Obstacles (for audio): fire, slam, telegraph, explode, crumbleStart, crumbleFall, laserOn/Off, padBounce, bumper.
- Every character event corresponds to a state change, so a future RemoteSession can rebuild them from snapshots. Results arrive as reliable messages.

---

## 5. Bot AI

### 5.1 Options compared

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| Reactive rules | cheapest | per-obstacle code for 25+ types; weak on timing combinations | no |
| Hand-authored nav hints | reliable | heavy authoring across 20 phases, brittle to level edits, robotic | no |
| Sampling planner | general; exact timing because obstacles are functions of time | CPU cost; model mismatch | core |
| **Hybrid** | planner with closed-loop policies, an auto-generated route polyline, and optional `longHorizon`/`waitZone` hints | – | **recommended** |

### 5.2 Loop
- **Think** every N ticks (staggered offsets, ±25% jitter):
  - Prefetch the solids and hazards in the rollout box.
  - Roll out each candidate policy and score it.
  - Pick one, with mistakes (5.5).
  - **Adopt it at `now + reactionTicks`.** Until then the old plan keeps running, but the new plan's timing is measured from `now`, so reactions are genuinely late.
- **Every tick:** run the active policy on the real state. Jump presses get ±timingNoise ticks of jitter from the bot's seeded RNG.

### 5.3 Policies and candidates
All policies are closed-loop and are evaluated each tick in both rollout and execution.
- **RUN(dir, mag):** auto-hops steps up to 2 tiles and hurdles within 10 px.
- **EDGE_JUMP(dir, hold, dive):** jumps when the probe `4 + |vx|·2·DT` px ahead finds no ground. With `dive`, it dives at the apex if the landing isn't reachable.
- **JUMP_AT(dir, delay, hold)**
- **WAIT(ticks):** drifts toward the platform center and never idles at an edge.
- **RETREAT(ticks)**
- **GOTO(x, surface), HOLD(x):** used in survival.
- **CONTINUE:** the current plan shifted in time. It gets a +12 switching bonus, which prevents dithering.

Candidate sets:
- **Race (Difícil, 12):** RUN, EDGE_JUMP (full), EDGE_JUMP (full + dive), JUMP_AT 0 (full), JUMP_AT 0 (tap), JUMP_AT 9, JUMP_AT 18, WAIT 12/24/42, RETREAT 12, CONTINUE.
- **Normal (9)** and **Fácil (6)** use subsets. Fácil never plans dives.
- **Survival/final (≤ 10):** HOLD here, GOTO the top 3 targets from a safety scan (arena sampled every 16 px on each standable surface, once per second), in-place jump, EDGE_JUMP toward neighboring surfaces, WAIT, CONTINUE.
- **Explore mode** adds 4 random seeded candidates.

### 5.4 Rollouts
- **Step and horizon:** 2-tick steps using the real integrator with dt = 2/60. The apex comes out about 2 px lower than reality, which errs on the safe side. Horizons are 0.6 / 0.9 / 1.1 s (18 / 27 / 33 steps).
- **Collider:** uses the prefetched list.
  - Static geometry.
  - Kinematic poses at the future time t_k, with carry when supported.
  - Dynamic geometry predicted: crumble tiles stay solid until their known fall tick, sinking platforms are extrapolated, seesaws are frozen.
- **Checks at each step:**
  - `hazardAt(hurtbox ⊕ margin, t_k, knowTick = now)`; fast hazards are also checked at t_k − 1.
  - `killAt`, and finish crossing.
  - Stop early on a hit or death.
- **At the end:** if the bot is airborne, `groundBelow(x, y, 200, t_end)`. No ground means `voidBelow`.
- **Shared prefixes:** candidates that start by running resume from RUN's cached state at the point where they diverge, saving about 30% of the steps.

### 5.5 Scoring
- **Race:**
  - Start with Δprogress (px along the route).
  - Finishing: +(1000 − 10k).
  - Hit: −(60 + 150·0.96^k).
  - Death: −400·0.97^k.
  - voidBelow: −250.
  - Near misses: −caution·8 each.
  - More than 2 bots in the same lane within 6 px: −2 each.
  - Switching plans: −12.
  - Plus a seeded 0–2 random bonus to break ties.
- **Survival:**
  - Base: +300 alive, −150 hit, −400 dead.
  - Plus Σ `obstacle.safety(x, y, t_end)`.
  - Tile-fall terms: +25 per intact layer below, +15 on an untouched tile, −20 on a shaking tile.
  - Minus 0.2·|Δx| and the switching cost.
- **Safety contributions from obstacles:**
  - Void edges: −3 per px within 24 px of the edge.
  - Lava: +0.6 per px above lava(t), capped at 60.
  - Black hole: +0.5·min(d, 200), and −200 if d < 40.
  - Bomb telegraphs: −120 inside the radius + 8 px.
  - Sweepers: +40 in the next wall's safe column.
- **Final:** like survival with a 0.2 s longer horizon and safety weighted ×1.3.
- **Mistakes:**
  - With probability mistakeChance, pick the 2nd or 3rd best candidate.
  - Never pick a lethal candidate when a safe one exists, except on a blunderChance roll.

### 5.6 LevelQuery (supports future times)
```
forEachSolid(x0,y0,x1,y1, t, fn)          groundBelow(x, yFeet, maxDist, t) → dist | -1
hazardAt(box, t, knowTick, margin) → ref  killAt(box, t) → cause
forceAt(x, y, t, out)                     safetyAt(x, y, t)        progress(x, y, hintIdx) → s
```

### 5.7 Skill profiles and difficulty

| Profile | Fácil | Normal | Difícil |
|---|---|---|---|
| Think interval | 18 ticks | 13 | 10 |
| Reaction delay | 15 ticks | 9 | 5 |
| Horizon / candidates | 0.6 s / 6 | 0.9 s / 9 | 1.1 s / 12 |
| Jump timing noise | ±4 ticks | ±2 | ±1 |
| Hazard margin | 0 px | 2 | 2 |
| Mistake / blunder chance | 15% / 2% | 6% / 0.5% | 2% / 0.1% |
| Move magnitude | 0.85–0.95 | 0.93–1.0 | 1.0 |
| Models ice, conveyor, wind | none | ice + conveyor | all |
| Reaction at GO | 300±150 ms | 180±100 | 100±60 |
| Mash rate / dazed after getup | 2 presses/s / 0.4 s | 4 / 0.25 s | 7 / 0.1 s |

- **Game difficulty sets the mix of bot profiles:**
  - Fácil: 60% fácil / 35% normal / 5% difícil.
  - Normal: 25 / 55 / 20.
  - Difícil: 5 / 45 / 50.
- **Personalities:**
  - cautious: margin +2, prefers waiting.
  - aggressive: margin −1, takes the earliest window.
  - neutral.
- Later rounds get harder on their own, because the weak bots are eliminated first.

### 5.8 Performance budget (mid-range phone, about 4× slower than desktop V8)
- A Normal think is about 170 rollout steps × about 12 primitive tests ≈ 2k tests, or about 0.12 ms on desktop.
- The scheduler allows at most 4 thinks per tick (deterministic queue ordered by dueTick then slot). The average is about 2.5–3 thinks per tick.
- That's about 0.4 ms/tick for bots on desktop, or about 1.6 ms on a phone.
- **Frame budget:** sim ≤ 1 ms, bots ≤ 2 ms, render ≤ 7 ms.
- **Level of detail:** in "calm" 64 px columns (nothing hazardous within 160 px ahead, precomputed at build), bots run RUN/EDGE_JUMP and re-check every 30 ticks.
- Rollout state structs are preallocated, so thinking allocates nothing.

### 5.9 Getting unstuck, imperfections, start line
- **Stuck detection (race):**
  - No new progress ≥ 16 px for 3 s, while not deliberately waiting because of danger → explore mode for 1.5 s.
  - At 8 s → RETREAT 30 ticks, then EDGE_JUMP.
  - At 15 s → silent respawn at the last checkpoint, logged as `stuckRespawn`.
  - More than 4 direction flips in 2 s → lock the current plan for 30 ticks.
  - In survival, the trigger is "no safe candidate for 2 s".
- **Human-like imperfections:**
  - Reaction lag (plan adoption delay) and jump-timing jitter.
  - Analog speed variation.
  - Occasional hesitation before big gaps.
  - Random hops (about 1% per second).
  - Imperfect world models (easy bots ignore wind).
  - Dazed pauses after getting hit.
  - Emotes at the finish.
- **Start line:**
  - Players are frozen during the countdown (bots only emote).
  - Staggered reactions at GO and per-bot early/late window preferences keep bots from moving as a herd.
  - Spawn x spread is only 0–28 px (slot rank × 4 px), which is fair to within 0.28 s.
  - lane = slot % 4. On respawn, lane is the least-used lane among characters within ±64 px.

---

## 6. Round rules and tournament

| | R1 race | R2 race | R3 survival | R4 final |
|---|---|---|---|---|
| Nominal players | 32 | 16 | 8 | ≤ 4 (up to 8) |
| Advance | min(16, ⌊n/2⌋) finishers | min(8, ⌊n/2⌋) | alive once alive ≤ min(4, ⌊n/2⌋) | last alive |
| On fall | respawn at checkpoint | same | eliminated | eliminated |
| Ramp | none | none | intensity 1.0 → 1.5 at 45 s → 2.0 at 75 s | → 2.0 at 60 s; sudden death at 120 s (kill plane rises, accelerating) |
| Hard limit | level.timeLimit (150 s default) | same | 100 s: everyone alive qualifies | 180 s failsafe: highest above the kill plane wins |

- **The race ends as soon as the quota fills.** Everyone else is eliminated and ranked by route progress.
- **Tie-breaking:**
  - Finish and kill crossings compare the sub-tick fraction `f = (line − prev)/(cur − prev)`, where an earlier crossing is better for finishes and worse for eliminations.
  - After that, the seeded `tiebreakRank` permutation decides.
- **Termination guarantees:**
  - Every round advances at least 1 player and eliminates at least 1.
  - If a race times out with fewer than min(2, n − 1) qualifiers, fill from the standings.
  - If survival drops to 0 alive in a single tick, the best min(target, last-tick deaths) of those deaths qualify, by sub-tick order.
  - If the final's last players all die in the same tick, the winner is decided by sub-tick order and then tiebreak.
  - If a round advances exactly 1 player, that player is champion and the remaining rounds are skipped.
- **Bookkeeping:** each round returns `RoundResult {standings: slot[] best→worst, qualifiedCount, endReason, stats}`.
  - Placements are built from the last round backward: all of R4's standings first, then R3's eliminated in order, then R2's, then R1's.
  - The result is always a permutation of places 1..32; the harness asserts this.
- **Spectating:**
  - Race: start on the leader (highest progress among racers still going); ◀ ▶ cycles by progress; when your target qualifies, switch to the next racer after 1 s.
  - Survival/final: cycle through the alive; on elimination, switch to the nearest alive by x.
  - Human eliminated: choose Assistir (watch at 1× or 2×), or Pular/Sair. Skipping calls `tournament.fastResolve()`, an instant, seeded result from bot ratings plus noise.
- **Modes:**
  - Torneio: a world's 4 phases in order.
  - Partida Rápida: seeded random race, race, survival and final from all worlds.
  - Treino: a single phase with 0–31 bots and a restart option. No quota end; the race ends when the human finishes or time runs out.

---

## 7. Headless harness (`tools/simulate.mjs`)

**Commands:**
```
node tools/simulate.mjs --level ceu-doce/1 --seeds 20 --difficulty normal [--human-proxy]
node tools/simulate.mjs --all --seeds 10 --report out.json      (worker_threads, one per core)
node tools/simulate.mjs --tournament vulcao --runs 50 | --determinism | --perf | --replay file.json
```
It runs all-bot rosters with no rendering and exits with code 1 on any FAIL.

**Metrics per match:**
- endReason, endTime, quota time.
- Finish-time median, p10 and p90.
- Falls, hits and respawns per bot.
- stuckRespawns, squeezeFallbacks.
- Hotspot map of falls and hits per 64 px bucket.
- Elimination curve, winner.
- NaN/Infinity scan every tick; hash every 600 ticks.
- µs/tick split between sim and bots.

**Pass/fail criteria** (defaults; a level's `meta.balance` can override them)

| Criterion | Rule |
|---|---|
| Race quota | reached before the limit in 100% of seeds; median in `meta.target` (default 45–100 s); p90 ≤ 0.8 × limit |
| Race health | median hits per bot in [0.5, 6]; no 64 px bucket holds more than 35% of all falls (WARN) |
| Oracle bot | Difícil profile with no noise and a 1.5 s horizon finishes every seed within 1.3 × par with 0 stuck events. If it fails, either the level or the planner is broken. |
| Human proxy | an average-human profile qualifies from R1 ≥ 75% on Normal (report) |
| Survival | ends by reaching the target in ≥ 85% of seeds; median 40–90 s; first elimination ≥ 8 s; never 0 qualifiers |
| Final | exactly 1 winner in 100% of seeds; median 45–120 s; sudden death ≤ 30%; failsafe never |
| Global | no NaN or exceptions; hashes match across reruns and snapshot round-trips; bots ≤ 0.5 ms/tick and sim ≤ 0.3 ms/tick on desktop; placements are a permutation of 1..32 |
| Static checks | gaps and steps within `limits.js` per profile; checkpoints ≤ 800 px apart and before each hazard section; hazard speed ≤ 6 px/tick unless `fast`; spawns free of solids; route continuous |

A 90 s race is about 5.4k ticks, or roughly 2–3 s of harness time. So `--all --seeds 10` takes about 1–2 minutes when parallelized.

---

## 8. Risks and implementation order

| Risk | Mitigation |
|---|---|
| Bots fail on some obstacle types | closed-loop policies with exact future queries; oracle gate; hotspot maps; `longHorizon`/`waitZone` hints; per-obstacle `safety` |
| Mobile CPU | fixed budgets and gates; staggered thinking with a per-tick cap; calm-zone LOD; allocation-free hot paths; profile on a real phone by M5 |
| Collision edge cases (ramps × movers × one-ways) | integer actor model; small set of primitives; unit tests at the limit values; unstick safety net |
| Determinism regressions | lint-sim, dmath, double-run and snapshot tests, no adapting to the wall clock |
| Accidental dives on mobile | landing-soon rule, pending dive, tunable thresholds, optional "Botão de mergulho" setting |
| Content scale (20 phases) | segment library plus per-world reskins; finish Céu Doce 1–4 first as a vertical slice |
| Readability with 32 characters | lanes, render de-clumping, human highlight and ▼ marker |
| Contact-state mispredictions online | keep stateful obstacles few, with telegraphs ≥ 0.5 s; server authoritative; visual smoothing |

**Milestones (engine side):**
- **M0:** skeleton.
  - `package.json`, core (rng, dmath, events), the fixed loop, `lint-sim`, a `node --test` setup, a debug box renderer.
  - Freeze the RenderView contract.
- **M1:** character on static geometry.
  - Solids, one-ways, ramps; jump with coyote, buffer and variable height; dive and slide; getup.
  - `limits.js`, with tests asserting the numbers in Table B.
- **M2:** race loop.
  - LevelBuilder, route, checkpoints, kill/respawn, race rules, World.step, LocalSession, events.
  - Harness v0 with a naive bot.
- **M3:** hazards.
  - Shapes, grid, knockback, ragdoll/prone/i-frames.
  - pendulum, rotator, bumper, hurdle, cannon, laser.
- **M4:** kinematics and stateful obstacles.
  - movers, ferris, pusher, piston, crusher with squeeze, crumble, sinking, conveyor, pads, seesaw; serialization.
- **M5:** bot planner (race).
  - Profiles, anti-stuck, perf instrumentation, harness pass/fail.
  - Céu Doce 1–2 must pass.
- **M6:** survival, final and tournament.
  - Survival and final rules; tile-fall, lava, bombardment, sweepers, black hole, rollers, wind, low gravity.
  - Survival scoring for bots, tie-breaking, tournament and modes, fast resolve.
- **M7:** content for the other 4 worlds, balanced with the harness.
- **M8:** network readiness.
  - Snapshot quantization, determinism and replay tests.
  - LoopbackSession with FakeTransport (100 ms, jitter, 2% loss).
- **M9:** mobile performance pass.

### Critical Files for Implementation
- /home/evandro/git/em_tech/thelastguy/src/sim/world.js
- /home/evandro/git/em_tech/thelastguy/src/sim/physics/body.js
- /home/evandro/git/em_tech/thelastguy/src/sim/character.js
- /home/evandro/git/em_tech/thelastguy/src/sim/bots/planner.js
- /home/evandro/git/em_tech/thelastguy/tools/simulate.mjs
<!-- Especificação da apresentação: render, pixel art, UI, celular e áudio (planejamento) — gerado pelo agente de planejamento; referência para a implementação -->

# The Last Guy: Presentation Layer Design

## 0. Critique of the tentative design (keep / change)

| Area | Tentative | Recommendation | Why |
|---|---|---|---|
| Upscale | Low-res offscreen canvas, then a full-screen DPR canvas | **One low-res canvas, scaled by CSS** (`image-rendering: pixelated`) to an exact integer number of device pixels | Removes a ~12 MB backing store on 3x phones and a full-screen blit every frame. `pixelated` is supported everywhere (Safari/iOS 10+, Firefox, Chrome). Keep the manual blit only as a debug fallback. |
| Virtual height | About 270 fixed | **Variable**: target 256 on touch devices and 270 on desktop, allowed range [216, 336], always an integer scale, extra space becomes extra view | No letterbox and no uneven pixels (see the table in 1.2) |
| Camera | Not specified | **Pixel-snapped camera** (the Celeste approach): interpolate, then round, and lock the camera once it settles | Sub-pixel scrolling on a low-res canvas makes sprites jitter 1 px. It isn't worth the complexity. |
| Static level | Chunk canvases | **Bake per "island"** (bbox-sized canvases, split at 512 px) | Sky levels are mostly empty. Island caches use ~1.5–3 MB instead of 6–12 MB, with no LRU. |
| Lanes | z 0..3, a few px each | **4 lanes at 0/3/6/9 px over a 12 px top band.** Human in lane 0, drawn last. Obstacles get `back`/`span`/`front` depth | Keeps the crowd readable. Hammers visually pass between lanes. |
| Mirroring/rotation | Mirror plus rotation | Mirror at draw time (pivot on a pixel edge). Tumble rotation at runtime, **quantized to 16 steps**. Rotating props use per-angle caches from an analytic per-pixel painter | Pixel-exact results, half the atlas memory, and props stay crisp at every angle |
| HUD | DOM | DOM text, with **panel backgrounds as procedurally generated pixel images sized in virtual px** (`--px` units). Pixel widgets (race progress bar, ▼, name tag) are drawn in the canvas | The HUD sits on the game's pixel grid |
| Font | Open | **Pixelify Sans only** (77 KB, OFL, no Reserved Font Name). Icons (→ ▼ ★ ✓) are procedural pixel images | Coverage checked from the actual font file (see 4.3) |
| Additions | none | Race **progress bar** (a side view can't show the finish), **blob shadows**, FINISH gate as a screen-plane backdrop arch, dissolve transitions | These are needed for a side view to read correctly |

---

## 1. Canvas pipeline

### 1.1 Display strategy
- `#game` is the low-res canvas, created with `getContext('2d', { alpha: false })`. Set `imageSmoothingEnabled = false` again after every resize, because resizing resets context state.
- CSS: `image-rendering: pixelated;` with `crisp-edges` declared before it as a fallback. Size it to `vw*s/dpr × vh*s/dpr` CSS px and place it at a device-pixel-aligned offset inside a `position:fixed; inset:0; overflow:hidden` root. Any overflow of up to s−1 device px is cropped.
- The canvas is full-bleed, under the notch. The HUD and touch controls respect safe areas (see 4.2).

### 1.2 Virtual resolution and integer scale

```js
export function computeLayout(cssW, cssH, dpr, touch) {
  const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
  const target = touch ? 256 : 270;
  let best = null;
  for (let s = 1; s <= 16; s++) {
    const vh = Math.ceil(devH / s);
    if (vh < 216 || vh > 336) continue;
    const d = Math.abs(vh - target);
    if (!best || d < best.d || (d === best.d && s > best.s)) best = { s, vh, d };
  }
  const s = best ? best.s : Math.max(1, Math.round(devH / target));
  const vh = Math.ceil(devH / s);
  let vw = Math.ceil(devW / s);
  if (!touch) vw = Math.min(vw, 640, Math.floor(vh * 2.4));   // pillarbox beyond this
  return { s, vw, vh, cssPx: s / dpr };                        // cssPx → CSS var --px
}
```

Values computed with this algorithm:

| Device (CSS @ DPR) | Device px | s | Virtual | --px (CSS px per virtual px) |
|---|---|---|---|---|
| iPhone 13/14 844×390 @3 | 2532×1170 | 5 | 507×234 | 1.67 |
| iPhone 13 Safari with bars 750×340 @3 | 2250×1020 | 4 | 563×255 | 1.33 |
| iPhone 15 Pro Max 932×430 @3 | 2796×1290 | 5 | 560×258 | 1.67 |
| iPhone SE 667×375 @2 | 1334×750 | 3 | 445×250 | 1.5 |
| Galaxy S20/S21 915×412 @2.625 | 2402×1082 | 4 | 601×271 | 1.52 |
| Pixel 7 with URL bar 915×356 @2.625 | 2402×934 | 4 | 601×234 | 1.52 |
| Low-end 640×360 @2 | 1280×720 | 3 | 427×240 | 1.5 |
| iPad Air 1180×820 @2 | 2360×1640 | 6 | 394×274 | 3 |
| Desktop 1920×1080 | 1920×1080 | 4 | 480×270 | 4 |
| Laptop window 1366×657 | 1366×657 | 3 | 456×219 | 3 |
| Windows 125%, 1536×730 | 1920×912 | 3 | 640×304 | 2.4 |
| Ultrawide 3440×1330 | 3440×1330 | 5 | 638×266 (250 device px pillarbox) | 5 |

Phones end up at 234–271 rows and desktops at 219–304. **Level-design contract:** anything that matters for gameplay must fit in 216 rows around the player, and the camera follows vertically.

- **DPR cap:** not needed. The canvas is always small (at most 640×336, about 215k px) and the compositor does the scaling.
- **Exact device size:** use `ResizeObserver` with `devicePixelContentBoxSize` where supported (Chromium/Firefox). Otherwise use `round(css*dpr)`.
- **Portrait or narrow desktop windows:** if vw < 400, lower s until vw ≥ 400. Phones in portrait get the rotate prompt instead (see 5.3).

### 1.3 Resize and orientation
- Listen to `window.resize`, `visualViewport.resize`, `orientationchange`, `fullscreenchange`, and `matchMedia('(resolution: Xdppx)').change` (browser zoom and monitor changes). Coalesce them into one recompute on the next rAF.
- A recompute does the following: resize the canvas, set CSS vars (`--px`, `--vw`, `--vh`), rebuild the sky cache, reposition the camera bounds and re-snap, and re-layout the touch controls. **Island caches, atlases and prop caches are world-space and are never rebuilt on resize.**
- Freeze the recompute while an `<input>` has focus. The landscape keyboard shrinks the visual viewport to about 150 px.

### 1.4 Loop, interpolation hooks, camera
- Fixed-step simulation (60 Hz). `dt` is clamped to 0.25 s, with at most 5 steps per frame. Rendering uses `alpha = acc/STEP`.
- **Contract:** the sim exposes `px,py,x,y,pangle,angle,facing,lane,state,stateTime,grounded,groundY,skinId,isHuman,teleported`. It also pushes events (`jump`, `land`, `hit`, `dive`, `bounce`, `fall`, `respawn`, `checkpoint`, `qualified`, `eliminated`) into a queue. The presentation drains that queue and turns events into particles, SFX, shake, vibration and banners. The presentation never mutates sim state, so a headless sim can run on a server later.
- Snapping rule: compute everything in floats, then round once.
```js
const camX = Math.round(lerp(cam.px, cam.x, a)) + shake.x;   // shake is integer px
const sx   = Math.round(lerp(e.px, e.x, a)) - camX;           // same rounding for every entity
const sy   = Math.round(lerp(e.py, e.y, a)) - camY - LANE_DY[e.lane];
```
- Camera follow: the target is the player plus a lookahead (player at about 35% of vw when running right). Vertical dead zone ±24 px, exponential damping. **When |cam − target| < 0.5, set cam = target exactly** so the human is pixel-stable on screen. Clamp to level bounds.
- Other camera modes: intro flyover (spline from finish to start, clamp(len/1500 px/s, 3, 6) s, ease in-out, tap to skip), spectate (0.4 s pan, or a 150 ms dissolve cut when the target is more than 2 screens away), and winner framing.
- `teleported` means prev = current, so a respawn doesn't streak across the screen for a frame.

### 1.5 Draw order with lanes

| # | Layer | Source | Notes |
|---|---|---|---|
| 0 | Sky | cached vw×vh canvas | Flat bands with 6-row Bayer transitions, screen-anchored |
| 1–3 | Parallax far/mid/near | tileable strips as `repeat-x` patterns | 1 `fillRect` per layer. Speeds 0.08/0.25/0.5, vertical ×0.5 |
| 4 | Static BACK | island caches | Back rails, decor, top bands and front faces, FINISH arch and crown flags |
| 5 | Animated tiles | pattern fills and small sprites | Lava surface, conveyors, waving flags, laser emitters |
| 6 | **Depth-sorted dynamics** | persistent array, insertion-sorted | Keys: obstacle `back` = −10, lane 3 = 0, lane 2 = 10, obstacle `span` = 15, lane 1 = 20, lane 0 = 30, human = 35, obstacle `front` = 40. Inside a lane: shadow +0, body +1, dust +2. The sweeper arm key is `15 + 25·sinθ`, so it passes between lanes. |
| 7 | World particles | pool | Confetti, impact stars, splashes |
| 8 | Static FRONT | island caches (sparse) | Snow lips, grass, front ropes. Skipped on Baixa. |
| 9 | World UI | sprites and the in-code bitmap font | ▼ marker, spectated player's name tag, checkpoint glow |
| 10 | Screen FX | canvas | Race progress bar, flash, Bayer dissolve transition, danger vignette (rising lava), near weather |
| 11 | DOM | HUD, menus, touch controls | |

- **Lanes:** every walkable surface has a 12 px top band drawn *above* the physics ground line. Lane 0 feet sit on the ground line; lanes 1–3 sit at −3/−6/−9 px. Bots are spread across lanes 0–3. The human is always in lane 0 and drawn after lane-0 bots. A visual lane change is a 150 ms tween. Physics stays 2D.
- **Blob shadow:** an 8×2 ellipse at `groundY − laneDY`, shrinking with height. No shadow over the void.
- **FINISH gate:** in a side view it has to be a backdrop arch in the screen plane (as in the "EXEMPLO NO JOGO" strip). Characters walk in front of it, and a checkered strip on the top band marks `finishX`.

### 1.6 Static geometry baking
- Tile size 16. Build a per-theme **tileset** once from indexed buffers: top band variants with checker parity A/B, left/right caps, front face rows (base, then darker per 16 px of depth, dithered), bottom edge.
- Autotile with a 4-neighbour mask. Draw a tile's top band only if the cell above is empty. Paint all bands first and all front faces second, so steps occlude correctly.
- **Islands:** connected solid tiles plus their attached static decor are baked into a bbox-sized canvas (split at 512 px). Everything is baked during the lobby and intro, and bboxes are culled each frame. A 6000 px race level uses about 1.5–3 MB.
- Checkers, seams and dither **use world coordinates**, so there are no seams between islands.

### 1.7 Dithered gradients
- 4×4 Bayer matrix. The sky is built from bands with short dithered transitions; dithering the whole band looks noisy. Apply the same idea to lava glow, the planet in space, ice depth, and the vignette.
- Moving surfaces use world-anchored dither so it doesn't shimmer.

### 1.8 Performance budget (mid-range phone, 60 fps)

| Item | Typical draws | Worst |
|---|---|---|
| Sky + parallax | 4 | 5 |
| Islands | 5–10 | 20 |
| Animated tiles | 5–15 | 40 |
| Obstacle parts | 10–30 | 60 |
| Characters + shadows (culled) | 20–40 | 64 |
| Particles (atlas `drawImage`) | 50–150 | 400 |
| Overlays | 3–5 | 10 |
| **Total** | **~150–250** | **~600** |

- Time budget: render JS ≤ 4 ms, sim ≤ 4 ms, DOM ≤ 0.5 ms.
- **No per-frame allocations:** pooled drawables and particles, precomputed color strings. Use `setTransform` rather than `save`/`restore`.
- DOM writes only when a value changes.

### 1.9 Quality tiers

| | Alta | Média | Baixa |
|---|---|---|---|
| Max vw | 640 | 560 | 480 (target vh 224) |
| Particles | 400 | 200 | 80 |
| Parallax | all + weather | 2 + light weather | 1, no weather |
| Shadows | all | all | human only |
| Additive glow (`lighter`) | yes | yes | solid colors |
| Prop angle cache | 64 steps | 32 | 32 |
| Render fps | display rate (≤120) | ≤60 | 30 |
| Menu scene fps | 30 | 30 | 20 |

**Auto:** start on Média if the device is touch with `deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4`, otherwise Alta. After 3 s of play, if p90 frame time > 19 ms, drop one tier (once per match) and show a toast: "Qualidade ajustada". `prefers-reduced-motion` turns off shake and flashes by default.

---

## 2. Procedural pixel-art characters

### 2.1 Approach

| | (a) ASCII per frame | (b) Skeleton + Bresenham | **(c) Hybrid** |
|---|---|---|---|
| Quality | Best | Risk of stick-figure look | Head and torso hand-drawn (where identity lives), limbs rasterized |
| Effort for ~43 frames | Very high (32 rows × frames, plus hat anchors per frame) | Low | Medium |
| Hats and skins | Needs anchor metadata per frame | Automatic | Automatic |
| Prone, dive, tumble | Natural | Awkward | Exact 90° part rotations, plus optional per-frame override templates |
| Data size | ~50 KB | ~3 KB | ~10 KB |

**Recommendation: (c).** Parts are hand-authored templates (head, face overlays, 4 torso variants `up`/`lean`/`flat`/`ball`, 2×2 hands, 3×2 shoes). Limbs are 2 px Bresenham segments driven by pose tables. The head plus hat composite can be rotated by exact multiples of 90°. Any frame can be replaced by a full template that still uses the palette-slot letters.

The generator is **DOM-free**: typed arrays in, typed arrays out. That means the same code runs in Node for icons and sprite-sheet exports.

### 2.2 Sprite spec
Measured from the reference sheet: the chibi is about 24–25 native px tall, and the head with cap is about 12 of that.

- **Cell 32×32.** Pivot is the bottom-centre *edge* (16, 32), so mirroring is exact.
- Rows: 31 is the shoe outline, 29–30 shoes, 25–28 legs, 18–24 torso (8 px wide, x 12–19), 7–17 head with cap (template origin (10, 7)). Tall hats can reach row 1.
- Keep a 1 px transparent margin for the outline.
- Standing height is 24 px of body plus the outline. That is about 9–11% of screen height on the devices in 1.2.

### 2.3 Palette slots (Uint8 indices; per-skin slots 1–17, fixed global colors from 20 up)

| idx | slot | letter | Hero (from the sheet) |
|---|---|---|---|
| 0 | transparent | `.` | — |
| 1 | outline | `o` | #0c1024 |
| 2/3 | skin / skinShade | `s`/`S` | #f0c4a4 / #c98d6e |
| 4/5 | hair / hairShade | `h`/`H` | #5a3222 / #3a1f16 |
| 6/7/8 | hat / hatShade / hatLight | `c`/`C`/`L` | #e32a31 / #a3182a / #ff6b5e |
| 9 | hatAccent (brim, band, logo) | `b` | #7f1325 |
| 10/11 | shirt / shirtShade | `t`/`T` | #e32a31 / #9e1b2a |
| 12/13 | pants / pantsShade | `p`/`P` | #2e5fd6 / #1d3c96 |
| 14 | shoes | `f` | #3b2a2a |
| 15 | eye | `e` | #10131f |
| 16/17 | accent / blush | `a`/`k` | bandana, logos / #f08a8a |
| 20+ | fixed: white, metal ×2, bone ×2, gold ×2, black, visor ×2 | `w m M n N g G K v V` | shared by all skins |

Back limbs use the shade slots, which gives depth.

### 2.4 Frames (right-facing only; 43 frames in 48 slots, so the atlas is 8×6 cells = 256×192)

| Animation | Frames | Timing | Head / face |
|---|---|---|---|
| idle | 2 + blink | 3 fps, blink every ~3 s | up / normal, closed |
| run | 6 (3 authored, 3 limb-swapped) | driven by distance (one cycle ≈ 28 px) | lean / normal. Dust on frames 0 and 3. |
| jump_takeoff / rise / apex | 1 / 1 / 1 | by vy | up |
| jump_fall | 2 | 8 fps | up |
| land | 1 (squash) | 80 ms | up |
| dive_air / dive_slide | 1 / 1 | by state | head rotated 90° CW, `flat` torso |
| hit | 1 | 100 ms, plus a POW star particle | X eyes |
| tumble | 2 (ball, spread) | alternate at 10 fps, runtime rotation | X eyes |
| stumble (CAÍDA) | 2 | 80 ms each | tilted |
| prone | 1 | while lying, plus dizzy stars | head rotated 90° (face down) |
| getup (LEVANTAR) | 4 | 90 ms each | tilted, then up |
| celebrate (CHEGADA) | 4 | 8 fps, hop | happy `^^`, open mouth |
| emotes: aceno, dança, triste, risada | 2 / 4 / 2 / 2 | 6 / 8 / 3 / 8 fps | happy / happy / sad / laughing |
| fall_void | 2 | 10 fps | wide eyes, O mouth |
| respawn | reuses idle | blink plus a poof particle | — |

Front-facing heads for the podium and CHEGADA are phase 2. The data model has a nullable `head.front` so they can be added later.

### 2.5 Authoring samples
Head with cap, facing right, 14×11, origin (10, 7). Authored without the outer outline; the outline pass adds it.
```
     0123456789ABCD
r0   ...cccccc.....
r1   ..ccLLcccc....
r2   .ccLccccccccc.
r3   Ccccccccccccc.
r4   CCcccccccccbbb   brim sticks out 2 px past the face
r5   hHCCCCCCCsSS..   cap band; shadow under the brim
r6   hHhssssesses..   eyes at x=17 and x=20 (1×2)
r7   hHhssssesses..
r8   .HhSssssssss..   ear shade
r9   ..HSssssskks..   blush
r10  ...SSsssssS...   chin
```
Face overlays (eyes: normal, closed, `^^`, X 3×3, sad, wide; mouths: O, smile) are drawn at a face anchor. Hats anchor at `crown` (head-local (6, 0)).

Pose table. Offsets are relative to the joint (y points down). Joints on the `up` torso: back shoulder (12,19), front shoulder (18,19), back hip (13,25), front hip (17,25). Each limb is `elbow/knee → hand/foot`.

| pose | bob | torso | back arm | front arm | back leg | front leg | face |
|---|---|---|---|---|---|---|---|
| idle_0 | 0 | up | 0,2 → 0,4 | 0,2 → 1,4 | 0,2 → 0,4 | 0,2 → 0,4 | n |
| run_0 contact | 0 | lean | 2,1 → 4,1 | −2,2 → −3,4 | −2,2 → −4,3 | 2,2 → 4,4 | n |
| run_1 down | +1 | lean | 1,2 → 3,3 | −1,2 → −2,4 | −1,2 → −3,2 | 1,2 → 2,4 | n |
| run_2 pass | 0 | lean | 0,2 → 1,4 | 0,2 → −1,4 | 1,1 → 0,3 | 0,2 → −1,4 | n |
| jump_rise | −1 | up | −1,−2 → −2,−4 | 1,−2 → 2,−5 | −1,2 → −3,3 | 2,1 → 2,4 | n |
| celebrate_1 | −2 | up | −1,−3 → −2,−6 | 1,−3 → 2,−6 | 0,2 → −1,4 | 0,2 → 1,4 | happy |

These are starting values to tune in the gallery. Run frames 3–5 are frames 0–2 with the limbs swapped.

**Composition order:** back hair, back arm, back leg, front leg, torso (the belt covers the hips), head (with part-level outline by dilation), hat, front arm (with part-level outline), front accessories. Then the outer outline, then palette mapping to a Uint32 array (0xAABBGGRR, little-endian).

### 2.6 Hats and skins

| Hat | Size above crown | Layers / flags | Colors |
|---|---|---|---|
| Boné (cap; red, green, blue, black) | 13×5 + 3 px brim | over; hides top hair | skin hat slots |
| Gorro (beanie) | 12×5 + 3×3 pompom | over; ribbing = hatShade on odd columns | skin slots |
| Caubói (cowboy) | 18×6 (brim 18×2, dented crown) | over; bandana accessory at the neck | fixed browns + accent band |
| Viking | 13×6 + two 3×5 horns | **back horn under the head**, front horn over; hides hair | fixed metal/bone, rivets |
| Chef | 12×8, 3 puffs + band | over | fixed whites |
| Cartola (top hat) | 12×9 | over | black + accent band |
| Coroa (crown) | 9×5 | over, sits on hair | gold + red gem |
| Orelhas de coelho (bunny ears) | 9×9 | back ear under the head; one ear droops | white/pink |
| Cabelo rosa (pink hair) | bangs + 8×6 back hair | replaces hair; back hair drawn under the torso | skin hair slots |
| Panda | 14×13 head | replaces head (own eyes and patches) | fixed B/W |
| Astronauta | 15×14 helmet | replaces head; visor gradient + glint | white / visor |

Hat definition shape: `{ tpl, back?, anchor:'crown'|'head', dx, dy, hidesHairTop, replacesHair, replacesHead, fixedColors }`.

About 25 skins are planned: hero, green, blue, cowboy, viking, chef, panda, pink hair, black cap, beanie, astronaut, king, top hat, bunny, ninja, pirate, firefighter, miner, robot, frog, clown, princess, eskimo (ice world), explorer (jungle), alien (space).

### 2.7 Outline pass
Use 4-neighbour dilation into a separate buffer so outlines don't cascade. This gives a soft chibi silhouette. Offer an optional "selout" mode where the outline takes the darkest ramp colour of the neighbouring material.
```js
if (!idx[i] && (idx[i-1]>OUT || idx[i+1]>OUT || idx[i-w]>OUT || idx[i+w]>OUT)) out[i] = OUT;
```

### 2.8 Atlas, memory, mirroring, rotation
- One canvas per skin (256×192 = **196 KB**), built with `putImageData` and never read back. 20 skins ≈ 3.9 MB; 25 ≈ 4.8 MB. Baking mirrored frames would double that, which is why mirroring happens at draw time.
- Build lazily per skin (about 2–5 ms each), mostly during the lobby screen. It doubles as the loading time.
- Mirroring: `ctx.setTransform(face,0,0,1,x,y); drawImage(atlas, fx,fy,32,32, -16,-32,32,32)`. Exact because the pivot sits on a pixel edge.
- Rotation: `rotate(round(a/STEP)*STEP)` with 16 steps, pivot at the body centre (16,22), integer translation. Nearest-neighbour sampling onto the low-res grid gives honest pixel art. Quad edge anti-aliasing lands in the transparent margin, so it isn't visible.
- Hit flash: bake white silhouettes **for the human's skin only**. Bots blink instead. Avoid `ctx.filter` (Safari only added it recently).

### 2.9 Name tags
- Off by default ("Mostrar nomes" in settings), because 32 tags would clutter the screen.
- Always shown: the human's ▼ (7×4, white with outline, 1 px bob at 2 Hz, 6 px above the head), and the spectated player's name.
- In-canvas text uses an **in-code 5×7 bitmap font** with PT accent rows (Á Â Ã À É Ê Í Ó Ô Õ Ú Ç). Canvas `fillText` gets anti-aliased at this size.

### 2.10 `?debug=sprites` (loaded with a dynamic import, so it costs nothing in production)
- Grid of animations × frames at 1–8× zoom on checker, sky or dark backgrounds.
- Toggles: outline, mirror, pivot, joints, bounds. Skin and hat pickers, plus an "all skins idle" sheet.
- Animation preview with a speed slider.
- **Pose editor:** drag joints, then copy the JS row (falls back to a textarea when there is no secure context).
- Palette editor, and "Baixar PNG" to download the sheet.
- Sibling pages: `?debug=props`, `?debug=tiles&world=`, `?debug=ui`, `?debug=audio`, `?debug=perf`, `?debug=layout`.

---

## 3. Props and themes

### 3.1 Painter technique
- **Primitives on indexed buffers:** rect, Bresenham line and 2 px brush, midpoint ellipse, scanline polygon, checker, 45° hazard stripes (`((x+y)/3|0)&1`), vertical-cylinder shading ramp, bevel box, Bayer fill, seeded noise (mulberry32), rot90/mirror, outline.
- **Analytic per-pixel painter for rotating props:** for each target pixel, inverse-transform into object space `(u,v)` and classify it (stripe band `floor((u + 0.5v + phase)/4)&1`, top light band for v < −0.55r, shade band for v > 0.5r, front cap ellipse `((u−L/2)/capW)² + (v/r)² ≤ 1`). Then run the outline pass. The result is crisp at every angle. Cache per angle step (64 steps × a 40×40 hammer head ≈ 400 KB) and pre-bake during the lobby.
- Long handles are thin strips drawn with runtime `rotate` (nearest).

### 3.2 Céu Doce palette (sampled from the mockups)

| Material | Ramp (light to dark) |
|---|---|
| Sky | #8fd9fd, #58c8fd, #3dbefd, #32b7fd, #2aa8f5 |
| Cloud | #ffffff, #def3fd, #b7e7fd, #8ccdf5 |
| Blue block | top #27befd/#1fbcfd, front #0d80f2, deep #0a66cf, edge #06408f |
| Yellow path | top checker #f9c031 / #f5d93c, front #faad36, deep #e08e22, edge #8a4b0f |
| Pink (hammers, posts, hub) | #fdc4e6, #fc4da5, #ef2b7e, #c12f8d, #832162; cap yellow #fbe23d |
| Purple | #c071e7, #b75bf9, #8b39eb, #6724ca |
| Hazard / rail | #fcc532 + #fefce3 / #efd848 |
| FINISH | plate #e6313a (dark #b3202a), white #fefdfd, flag #0562c9/#033d90, gold #fcd223 |
| HUD | tab #0569c8 (top #4792d4, bottom #035ab6), panel #fdfdfd, bevel #dce0e3, text #0f151f; jump button #0864bc/#147bd6, arrow #ebf7fd; joystick #0767bf, #94d5fc, #b4e2fb |

### 3.3 Prop catalog

| Prop | Pixel spec | Animation / cache | Depth |
|---|---|---|---|
| Pendulum or windmill hammer | 28×16 striped cylinder, both caps as 4×16 ellipses; 4 px purple handle; pink hub with yellow cap | head cached at 64 angles, handle rotated at runtime | `span` |
| Side ram (big mockup hammers) | horizontal cylinder punching out of a pink post | translate only | `span` |
| Rotating sweeper | hub 20×14 (pink, yellow top ellipse); 6 px striped arm projected as `(cosθ·L, −sinθ·L·0.35)` | 64-angle cache | key `15 + 25·sinθ` |
| Posts with yellow caps | vertical cylinder ramp + top ellipse | static (baked in the island) | back |
| Purple blocks | bevelled cube (lighter top face, 1 px highlight / 1 px shadow) | static, or a sprite cached per size when moving | back |
| Hazard barriers | 24×8, 45° stripes | static | back |
| Rails | 3 px tube (highlight + shade), a post every 32 px | static | back |
| FINISH arch | posts, banner with checkered ends, 80×18 red plate, "FINISH" in the 5×7 font at 2× | 2-frame banner flutter, confetti emitters | back |
| Crown flags | golden pole with ball, blue flag with 5×4 crown | 4 frames (column sine wave) | back |
| Checkpoint | pole + 8×6 flag: grey, then green with ✓ | state + sparkle | back |
| Trampoline / bumper | squat cylinder, zigzag springs | 3 frames: rest / compressed / stretched | back |
| Conveyor | chevrons with an 8 px period, rollers | pattern offset, 4 roller frames | back |
| Lasers | metal emitter with red lens; beam 2 px white core + red/magenta glow | per frame; `lighter` on Alta; **blinking dotted telegraph for 0.5 s** | front |
| Lava | 64×12 strip, crest #fff0a0, body #ff7a1a, deep #9a1a10 | 8 seamless frames (`sin` periodic in x and t), bubble/ember particles, glow strip | back |
| Ice | pale top, shine streaks, icicles | occasional moving glint | back |
| Falling tiles, boulders, snowballs, spikes, fireballs, logs, doors | from the tileset / analytic painter | shake, then fall; 16-angle spheres; 3-frame spikes with dust telegraph | as needed |

### 3.4 Theme organization
```js
export default {
  id: 'vulcao', nome: 'Vulcão',
  pal: { outline:'#140c10', sky:['#1a0a12','#4a1020','#a02a1a','#e0601a'],
         ground:{ top:['#6b5a5a','#5a4a4a'], front:'#3e3236', deep:'#2a2024', glow:'#ff9a1a' },
         stripeA:'#3a3a44', stripeB:'#ff7a1a', hazard:['#fcc532','#1a1a1a'] },
  parallax: [{ paint:'volcanoFar', speed:.08 }, { paint:'rockSpires', speed:.25 }, { paint:'lavaFalls', speed:.5 }],
  weather: { kind:'embers', rate:18 },
  props: { hammer:{ stripes:['stripeA','stripeB'] } },         // recolor via palette keys
  painters: { groundTile: paintBasalt, hazardFloor: paintLava }, // shape overrides
  music: 'vulcao', fx: { additiveGlow: true },
};
```
Level data refers to prop *kinds*, never to visuals.

| World | Sky | Ground | Signature props / overrides | Weather |
|---|---|---|---|---|
| Céu Doce | blue ramp (3.2) | yellow checker / blue | hammers, sweepers, candy bumpers | none |
| Reino Gelado | #0b1f4a → #9fd8f5 + aurora | ice #e8fbff/#7fd3ff | ice-and-white hammers, snowballs, icicles | snow |
| Vulcão | #1a0a12 → #e0601a | basalt with glowing cracks | rising lava, fireballs, crumbling rock | embers |
| Templo da Selva | #7fe0d0 → #f6f0a0 haze | mossy stone #b8b08a | **hammer is swapped for a swinging log**, spikes, boulder, totems | leaves |
| Estação Espacial | #05060f → #1a1f4a, stars, planet | metal panels #c8d0e0 | lasers, airlocks, conveyors | floating dust |

### 3.5 Particles and shake
- SoA pool, updated at render time (purely cosmetic). Types: dust (3 frames), POW star (13×13, 3 frames), confetti (1×2 in 6 colours, 2 orientations with sway), snow, embers, leaves, splash, dizzy stars, poof.
- Screen shake is trauma-based: offset = `max·trauma²·rand`, integer px only, decay 1.5/s. It fires only for the human or big nearby events.

---

## 4. DOM UI and HUD

### 4.1 Structure
`#app > canvas#game, #hud, #touch, #screens, #rotate, #toast`.

Screen manager API: `ui.show(id, params)` (does a `history.pushState`, so the Android back button works), `ui.back()`, `ui.overlay('pause')`. Each screen module exports `{ build(h), enter(p), exit(), onBack() }`. Inactive screens get `inert` and `aria-hidden`, and the first button is focused on enter so keyboard and gamepad navigation work. All strings live in `ui/strings.pt-BR.js`.

The canvas keeps running an attract-mode scene (Céu Doce with bots) behind the menus.

### 4.2 CSS and units
- Files: `base.css` (reset, @font-face, variables), `ui.css`, `hud.css`, `touch.css`.
- JS sets `--px` (CSS px per virtual px, e.g. 1.67 on an iPhone). **All HUD and menu sizes are written as `calc(N * var(--px))`**, so the UI is designed once in virtual px (minimum 384×216) and scales with the game.
- `--sa-t/r/b/l: env(safe-area-inset-*)` with `viewport-fit=cover`. HUD offset is `max(var(--sa-l), calc(4*var(--px)))`.
- Pixel-style outlined text: 8 `text-shadow` offsets of `var(--px)`.
- Buttons: pixel corners via `clip-path` notches of 1 `--px`, pressed state `translateY(var(--px))`, transitions with `steps(4)`.
- No `backdrop-filter`. Use `contain: layout paint` on HUD panels.

### 4.3 Font decision (checked by parsing the font files from google/fonts)

| Font | License | Size | PT accents, … º ª | Missing | Pixel grid | Verdict |
|---|---|---|---|---|---|---|
| **Pixelify Sans** | OFL 1.1, **no RFN** | 77 KB variable, wght 400–700 | all present | → ▼ ▲ ★ ♥ ✓ | approximate, ~0.092 em per pixel (cap ≈ 7 px) | **Use it.** Bold for the HUD, 400/500 for body text. |
| Press Start 2P | OFL 1.1, RFN "Press Start 2P" (renaming required if subset or converted) | 115 KB | all | ✓ | exact 1/8 em | Too wide for Portuguese sentences |
| Silkscreen | OFL 1.1 | 31 + 29 KB | all | → ▼ ★ ✓ | exact 1/8 em, **5 px caps** | Too small at 1×, too wide at 2× |

- Bundle `assets/fonts/PixelifySans-VF.ttf` (renamed; the bracketed filename is awkward in URLs) plus `OFL.txt`.
- `@font-face { font-weight: 400 700; font-display: block }`, `<link rel=preload as=font crossorigin>`, and `await document.fonts.load('700 16px "Pixelify Sans"')` before the first screen.
- Fallback stack: `"Pixelify Sans", "Trebuchet MS", system-ui, sans-serif`.
- Never rely on font glyphs for symbols; they come from `ui/icons.js` as pixel images.

### 4.4 HUD layout (virtual px at a 480×270 base)
```
+-[Objetivo]----------------+    1:12     [II] +-[Qualificado]-+
| CORRA ATÉ A CHEGADA!      |  ==o=o==o==>F    |     3/16      |
+---------------------------+  progress bar    +---------------+
 Posição 5º (after the objective panel collapses)
   joystick zone: left 50%, below HUD band  |  jump zone: right 50%
   ( ghost ring at rest )                   |               ( ^ )
```

| Element | Size (vpx) | Details |
|---|---|---|
| Objetivo tab + body | 44×11 over 104×30 | White body with a stepped right slant (1 px per 4 rows), 1 px #0f151f outline, 2 px bevel #dce0e3, drop shadow. Text is 11 vpx Bold. Collapses to the tab after 4 s. |
| Counter tab + body | 52×11 over 64×26 | Mirrored slant. Race: "Qualificado" and `3/16`. Survival: "Vivos" and `20` with "até 8". Final: "Vivos". Pops and turns gold when you qualify. |
| Timer | pill 36×12, top centre | Only in timed rounds. The last 10 s tick and turn red. |
| Progress bar | 140×7, canvas layer 10 | Bot ticks, human head icon, checkered flag at the end |
| Pause | 14×14 | Left of the counter panel |
| Banners | ~200×40 centred | QUALIFICADO! (gold ribbon), ELIMINADO! (red + shake), TEMPO ESGOTADO!, VENCEDOR! Pop animation with `steps()`, plus icons so the states don't rely on red/green alone. |
| Countdown | 48 vpx text | 3, 2, 1, VAI! with pixel outline and pop |

### 4.5 Generated pixel images
`ui/panels.js` renders panels, tabs, the jump button, the joystick ring and icons from the same indexed-buffer primitives, then `toDataURL` → `background-image` with `background-size: 100% 100%; image-rendering: pixelated`.

Panel sizes are fixed in vpx, so they are generated **once**; only `--px` changes. Touch controls are generated at `sizeCss / --px` virtual px.

### 4.6 Screens
Title (canvas-rendered "THE LAST GUY" logo), Mundos (5 cards, horizontal scroll-snap on phones; each lists its 4 phases with round-type icons, all unlocked), Personagem (skin grid, animated preview, nickname `maxlength=12` with an "Aleatório" button), Configurações (Música/Efeitos/Mudo, dificuldade dos bots, qualidade, FPS, tremor, vibração, nomes, estilo de controle, tamanho dos botões, canhoto).

Match screens: fake lobby ("Procurando jogadores… 12/32", avatars popping in, tips; atlases build here), intro flyover with the round banner, countdown, HUD, spectate (◀ ▶, "Espectando: Nome", Sair), results (grid of qualified avatars, "Próxima rodada em 5…"), winner (the winner's sprite at 2–3× integer scale on the canvas, crown, confetti, DOM text), pause, rotate prompt, toasts.

### 4.7 Menus reuse the painters
- World cards: `renderWorldPreview(theme, w, h, seed)` draws sky, parallax, a platform strip, 2 props and 3 idle bots. It is cached; only the selected card animates.
- Skin thumbnails are small `<canvas>` elements blitted from the atlases (no encoding cost).
- The skin preview is driven by the main loop's UI tick (no second rAF).

---

## 5. Mobile

### 5.1 Controls
- A single `#touch` layer covers the screen with `touch-action: none`. Pointer events only; everything is keyed by `pointerId`.
- **Floating joystick:** starts on the first touch in the left 50%, below the HUD band (top 22%). The base is placed at the touch point, clamped on-screen. R = `clamp(0.12·shortSide, 40, 72)` CSS px. Use `setPointerCapture`. When the finger goes past R, the base follows it. Only the x axis is used: `n = dx/R`, dead zone 0.2, full speed at 0.6: `moveX = sign(n)·min(1, (|n|−0.2)/0.4)`. A second finger on the left is ignored. At rest, a ghost ring (40% opacity, ◀ ▶ only) sits at bottom-left.
- **Jump:** any touch in the right 50% below the HUD band counts. Missed jumps hurt more than accidental ones. The visual button is at bottom-right, diameter `clamp(0.20·shortSide, 64, 110)`. `pointerdown` sets `jumpHeld = true` and `jumpPresses++` (an edge counter, so fast taps are never lost). `pointerup`, `pointercancel` and `lostpointercapture` release it. Holding gives a variable-height jump; releasing while rising cuts it. **A new press while airborne dives.**
- Options: a separate dive button (then jump uses its circle ×1.4), an "Setas" mode with two big arrow buttons instead of the joystick, button size (0.85 / 1 / 1.2), left-handed swap.
- Controls sit at least 16 px plus the safe-area inset away from the edges, to avoid system edge swipes.
- Show touch UI on the first `pointerType==='touch'` event and hide it on keyboard input. Initial guess: `matchMedia('(pointer: coarse)')`.

### 5.2 Blocking browser gestures
- CSS: `position:fixed; inset:0; overflow:hidden; overscroll-behavior:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent`.
- JS: `touchmove` with `{passive:false}` and `preventDefault` (iOS rubber-band); `gesturestart`/`gesturechange` `preventDefault` (iOS pinch); also block `contextmenu`, `dblclick` and `selectstart` (except inside inputs).
- Scrollable menu lists opt back in with `touch-action: pan-y` / `pan-x` and `overscroll-behavior: contain`. The nickname input gets `user-select: text`.

### 5.3 Orientation and fullscreen
- Portrait on a coarse pointer shows a rotate overlay ("Gire o aparelho para jogar na horizontal", with a pixel phone icon) and pauses the game. Menus are landscape-only too.
- **Android and desktop:** a "Tela cheia" button, and on Android it also triggers on JOGAR. Call `root.requestFullscreen({navigationUI:'hide'})`, then `screen.orientation.lock('landscape').catch(()=>{})`. The lock only works in fullscreen or an installed PWA.
- **iPhone:** there is no element fullscreen (video only) and `orientation.lock` rejects with NotSupportedError. On iPhone Safari when not standalone, show a one-time tip: "Para tela cheia: Compartilhar → Adicionar à Tela de Início". In standalone mode use `apple-mobile-web-app-capable` and `status-bar-style=black-translucent`. iPad does support the Fullscreen API.

### 5.4 Viewport
- Root is `position:fixed; inset:0` (use `100dvh` if a height is ever needed; never `100vh`).
- Size from `visualViewport.width/height` and listen to its `resize` event. The Chrome landscape URL bar (~56 CSS px) simply produces a different layout; see the "Pixel 7 with URL bar" row in 1.2.

### 5.5 Lifecycle
- `visibilitychange` → hidden: pause the match (show the pause menu on return), `audioCtx.suspend()`, clear held inputs, release the wake lock. On visible: resume. If the context is still not `running` (iOS), resume on the next gesture. Handle `pagehide`/`freeze` the same way. Clear keys on `blur`.
- **Audio unlock:** on the first `pointerup`, `touchend`, `keydown` or `click`, create the `AudioContext`, play a 1-sample silent buffer, and call `resume()`. Don't change `navigator.audioSession.type`. The default respects the iPhone silent switch, which is the right behaviour; add a tip "Sem som? Verifique a chave silenciosa".
- Vibration (Android only; hide the toggle when unsupported): hit 25 ms, eliminated `[80,50,120]`, qualified `[20,30,20]`, VAI! 40 ms.
- `navigator.wakeLock.request('screen')` during matches. It needs HTTPS, so guard it.

### 5.6 PWA
```json
{ "name":"The Last Guy", "short_name":"Last Guy", "lang":"pt-BR", "start_url":"./?src=pwa", "scope":"./",
  "display":"fullscreen", "display_override":["fullscreen","standalone"], "orientation":"landscape",
  "background_color":"#32b7fd", "theme_color":"#0569c8",
  "icons":[{"src":"icons/icon.svg","sizes":"any","type":"image/svg+xml"},
           {"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},
           {"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"},
           {"src":"icons/maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}] }
```
- Chrome wants 192 and 512 icons, and iOS ignores manifest icons (it needs a 180 px PNG `apple-touch-icon`). So **PNGs are required**.
- `tools/gen-icons.mjs` (Node 18, zero dependencies) renders the icons with the DOM-free sprite code, adds zlib deflate and a hand-written CRC32 (Node 18 has no `zlib.crc32`), and writes the PNGs plus a `<rect>` SVG with `shape-rendering="crispEdges"`. The outputs are committed.
- Optional `sw.js`: cache-first with a versioned cache, network-first for `index.html`. **Not registered on localhost, on LAN IPs, or with `?nosw`.**

### 5.7 Testing on a phone over LAN
- Serve with `python3 tools/serve.py 8000`, a small stdlib `http.server` subclass that sends `Cache-Control: no-store` and explicit MIME types for `.js`, `.webmanifest` and `.ttf`. Bind to `0.0.0.0` and open `http://<hostname -I>:8000`.
- A plain LAN IP is **not a secure context**, so the SW, install and wake lock won't work there. The game, WebAudio, fullscreen and vibration do.
- For secure-context features on Android: `adb reverse tcp:8000 tcp:8000`, then open `http://localhost:8000` and debug via `chrome://inspect`. A tunnel works too.
- iOS without a Mac: use `?debug=perf` plus an on-screen `window.onerror` / `unhandledrejection` log.

---

## 6. Audio

### 6.1 Graph
`sfxBus`, `uiBus` and `musicBus` feed `master`, then a `DynamicsCompressor` used as a limiter (−6 dB, ratio 12, attack 3 ms, release 150 ms), then the destination.

- Slider value v maps to gain v². Defaults: music 0.6, SFX 0.8. Mute toggles for music, SFX and master (M key). Persist in `localStorage['tlg.settings.v1']`.
- Duck music to 50% during stingers (`setTargetAtTime`).
- Voice limit 16. Per-sound cooldowns (e.g. land 40 ms).
- Bot sounds play at 0.35 × distance attenuation, are culled beyond 1.2 × half the view, and are capped at 3 per 100 ms. `StereoPanner` pan = `clamp((x − camCenter)/(vw/2), −0.8, 0.8)`.
- Assets built once: pulse waves via `createPeriodicWave` with `re[n] = 2/(nπ)·sin(nπd)` for d = 12.5 / 25 / 50%, a 1 s white-noise buffer (played with random offsets), and a short-mode LFSR "metallic" buffer.

### 6.2 SFX recipes

| SFX | Recipe |
|---|---|
| jump | p25, 330→660 Hz exponential over 90 ms, attack 5 ms, decay to 140 ms, 0.3, ±40 cents jitter |
| dive | noise → bandpass (Q 1.2) sweeping 500→2500 Hz over 180 ms, plus triangle 400→250 Hz |
| land | noise → lowpass 700 Hz, 50 ms; plus sine 140→60 Hz, 70 ms |
| footstep (human only) | noise → highpass 1800 Hz, 18 ms, 0.05, on contact frames |
| hit / bonk | triangle 260→90 Hz, 180 ms, 0.5; noise → lowpass 1.2 kHz, 90 ms; square click 900 Hz, 20 ms |
| tumble whoosh | noise → bandpass 900 Hz, gain swell over 300 ms |
| bounce | sine 180→520 Hz over 250 ms, vibrato 14 Hz ±25 Hz |
| fall into void | sine slide whistle 1100→180 Hz linear over 700 ms |
| respawn | p50 arpeggio 523/659/784 Hz at 60 ms steps, plus noise → highpass 4 kHz sparkle |
| checkpoint | triangle E6 then B6, 70 ms each |
| qualified | p25 C5 E5 G5 C6 at 70 ms, triangle C4 underneath |
| eliminated | p50 G4 E4 C4 G3 at 90 ms, lowpass closing, noise thud |
| 3 / 2 / 1 | p50 440 Hz, 110 ms |
| VAI! | p25 880 Hz, 350 ms, vibrato 6 Hz, plus triangle 440 Hz |
| UI click / back / hover | p12 1250 / 800 Hz, 25 ms; triangle 1800 Hz, 12 ms, 0.05 |
| confetti pop | noise → highpass 2.5 kHz, 40 ms; sine 900→300 Hz |
| laser charge / hum | saw 200→1200 Hz over 500 ms; two saws at 110/112 Hz → lowpass 900 Hz, gain by proximity |
| lava bubble / sizzle | sine 90→260 Hz, 60 ms, at random intervals; noise → highpass 3 kHz, 450 ms |
| ice slide / conveyor / hammer pass | noise bandpass 3 kHz loop with gain ∝ speed; noise lowpass 220 Hz loop; bandpass sweep when a hammer passes within 64 px |
| last-10-seconds tick | square 2000 Hz, 15 ms |

Define them with a small DSL, e.g. `sfx.def('jump', { osc:'p25', f:[330,660,.09,'exp'], env:[.005,.13], vol:.3, jitter:40 })`.

### 6.3 Chiptune sequencer
- Channels: p1 lead, p2 harmony/arpeggio, triangle bass, noise drums. 16th-note steps. One Oscillator + Gain (ADSR) per note; that is about 30 nodes per second, which is trivial.
- Scheduler: `setInterval(25 ms)` schedules everything that falls within `currentTime + 0.1`. Re-anchor `nextTime` after a resume so no backlog plays.
```js
while (nextTime < ctx.currentTime + 0.1) { scheduleStep(step++, nextTime); nextTime += 60 / (bpm * tempoScale) / 4; }
```
- Song data: `{ bpm, inst, pat:{ A:{ lead:'C5 . E5 . G5 . E5 .', bass:'C3 . C3 . G2 . G2 .', drums:'k . h . s . h .' } }, order:['A','A','B','A'], final:{ bpmScale:1.12, add:{ drums:'h h h h h h h h' } } }`. Token `.` means sustain/empty and `-` means note off.
- Song and tempo switches happen on the next bar. Effects: arpeggio, vibrato, slide. The space world adds a DelayNode (3/16 beat, feedback 0.35).
- Tracks: menu theme, lobby loop, one per world, a "final" variant (tempo ×1.12 plus a 16th hi-hat layer, used in the final round and the last 15 s), and victory/elimination stingers.

| World | Mode | BPM | Character |
|---|---|---|---|
| Céu Doce | C major | 132 | bouncy p25 lead, arpeggio p2, root-fifth bass |
| Reino Gelado | A minor | 118 | glassy p12, high triangle bells, sleigh hi-hats |
| Vulcão | E phrygian dominant | 144 | driving 8th-note bass, p50 lead, heavy snare |
| Templo da Selva | D dorian / pentatonic | 126 | staccato "marimba" p25, triangle toms with pitch drop |
| Estação Espacial | F lydian | 108 | 16th arpeggios with echo, slow-attack pad |

---

## 7. Pitfalls and implementation order

### 7.1 Pitfalls
- Resizing a canvas resets smoothing and all context state, so re-apply it. Always round positions before `drawImage`, and use one rounding rule for the camera and every entity.
- Never read back GPU canvases. Only use `willReadFrequently` on scratch canvases, never on atlases. `putImageData` ignores transforms.
- iOS limits total canvas memory. Free discarded canvases (width = height = 0) and keep the total under about 50 MB. Use regular `<canvas>` for caches (`OffscreenCanvas` 2D needs Safari 16.4+).
- Mirror around a pixel **edge**, not a pixel centre. Keep a 1 px transparent margin in every cell.
- Patterns and dither must be world-anchored or they seam between islands. Props that cross an island boundary must be painted into both islands.
- Anything interpolated needs `teleported` handling. Clamp `dt` and cap steps per frame. Use dt-based animation (120 Hz displays, 30 Hz in iOS Low Power Mode).
- `touch-action` must be set in CSS before the touch starts. Handle `pointercancel` (iOS edge swipes). Never assume `touches[0]`.
- Unlock iOS audio on `touchend`. `currentTime` freezes while suspended. `setInterval` is throttled to about 1 Hz in the background.
- Save everything as UTF-8 with `<meta charset="utf-8">`. The bitmap font needs the accent rows.
- The virtual keyboard shrinks the viewport, so freeze layout while an input is focused.
- DOM: write only on change, animate only `transform`/`opacity`, no `backdrop-filter`. Forgetting `pixelated` on thumbnails makes them blurry.
- A service worker in dev serves stale files; don't register it on localhost/LAN. On some systems `.js` is served with the wrong MIME type, which the dev server's explicit types avoid.
- The Android back button needs `history` states. Standalone iOS apps have no back button, so every screen needs its own navigation.
- Avoid `ctx.filter` for tints (bake them instead). Don't rely on font glyphs for → ▼ ★ ✓.

### 7.2 Order (each step testable in the browser)
1. **Boot and pipeline:** `index.html`, CSS, `computeLayout`, resize handling, fixed-step loop, dithered sky, test grid, `?debug=layout` and `perf`. **Check the pixel grid on a real phone over LAN on day 1.**
2. **Pixel core:** indexed buffer, primitives, outline pass, palette mapping, atlas builder. One skin with idle and run. `?debug=sprites` with the pose editor. Iterate against the reference sheet.
3. **World look:** tileset, autotile, island baking, camera, Céu Doce parallax. 31 dummy bots across lanes with shadows and the ▼. Judge crowd readability here.
4. Remaining frames, the animator (sim state → frame), particles, shake, event bus.
5. Prop painters and angle caches, depth sorting, `?debug=props`.
6. DOM: screen manager, font, generated panels and icons, HUD, countdown, banners. Touch controls, keyboard, rotate prompt, fullscreen, safe areas.
7. Audio engine and SFX, then the sequencer with the Céu Doce song.
8. All hats and skins, skin select screen, nickname.
9. The other 4 themes, world props, weather, world songs.
10. Match flow screens (lobby, flyover, spectate, results, winner, pause), quality tiers and auto mode, PWA with the Node icon generator, optional SW.
11. Performance and accessibility pass on real devices.

### 7.3 Planned files
- `index.html`, `manifest.webmanifest`, `css/{base,ui,hud,touch}.css`, `assets/fonts/`
- `js/core/{loop,settings,rng,events}.js`
- `js/gfx/{display,renderer,camera,tiles,islands,parallax,particles}.js`, `js/gfx/pixel/{buffer,palette,font5x7}.js`, `js/gfx/sprites/{parts,hats,poses,skins,builder,animator}.js`, `js/gfx/props/*.js`, `js/gfx/themes/*.js`
- `js/ui/{screens,hud,panels,icons,strings.pt-BR}.js`, `js/ui/screens/*.js`
- `js/input/{touch,keyboard,gamepad,index}.js`
- `js/audio/{engine,sfx,sequencer}.js`, `js/audio/songs/*.js`
- `js/debug/*.js`
- `tools/{serve.py,gen-icons.mjs}`

Everything under `gfx/pixel` and `gfx/sprites` except the atlas upload must stay DOM-free so it runs in Node.

### Sources
- [Can I use: Fullscreen API](https://caniuse.com/fullscreen) and [Apple Developer Forums: Fullscreen API on non-video elements (iOS)](https://developer.apple.com/forums/thread/133248)
- [Can I use: Screen orientation lock](https://caniuse.com/wf-screen-orientation-lock)
- [web.dev: Install criteria](https://web.dev/articles/install-criteria) and [Chrome blog: Revisiting installability criteria](https://developer.chrome.com/blog/update-install-criteria)
- [iOS Safari audio sessions (Sam Eddy)](https://samueleddy.com/writing/ios-safari-audio-sessions/) and [nattog.dev: Web Audio and iOS mute](https://nattog.dev/blog/web-audio-ios-unmute)
- [Can I use: image-rendering crisp-edges/pixelated](https://caniuse.com/css-crisp-edges)
- [google/fonts: pixelifysans](https://github.com/google/fonts/tree/main/ofl/pixelifysans), [pressstart2p](https://github.com/google/fonts/tree/main/ofl/pressstart2p), [silkscreen METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/silkscreen/METADATA.pb). Glyph coverage and grid figures come from parsing the TTFs directly.

### Critical Files for Implementation
All of these are planned; the project currently contains only the reference images, e.g. `/home/evandro/git/em_tech/thelastguy/e9f2a81a-fcca-40b5-bbfb-16f9480653f3.png` for the sprite targets.
- `/home/evandro/git/em_tech/thelastguy/js/gfx/display.js` (layout, integer scale, resize, `--px`)
- `/home/evandro/git/em_tech/thelastguy/js/gfx/sprites/builder.js` (with `parts.js`, `poses.js`, `hats.js`: DOM-free frame composition and atlases)
- `/home/evandro/git/em_tech/thelastguy/js/gfx/renderer.js` (draw order, lanes, depth sort, interpolation and snapping)
- `/home/evandro/git/em_tech/thelastguy/js/ui/hud.js` (with `ui/panels.js`: HUD on the pixel grid)
- `/home/evandro/git/em_tech/thelastguy/js/input/touch.js` (floating joystick, jump/dive, gesture blocking)
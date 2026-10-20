# 3D Battleground — Sudarshan Command Deck

An interactive 3D rendition of the SILENT RIDGE exercise. The commander is placed *in* the terrain; the picture they see is built only from the reports that actually reached them. Everything is synthetic, scripted and offline.

Open it from the landing page: **Enter 3D battleground**.

## What the 3D view adds (and what it deliberately does not claim)

| Idea from the concept document | In the 3D battleground |
| --- | --- |
| Own side and enemy side in one simulation | Friendly squads, UAS and reserve as 3D actors; hostile vehicles exist as *truth* (Instructor/review only) |
| Communication disruption: delay, drop, partial, garble | Fixture effects drive what appears; late reports spawn later, dropped ones never appear, partial fields show `▒▒▒` |
| Information management / role-based views | Trainee world is built from *perceived tracks* only; truth meshes are never created for trainee stations |
| Military symbology | MIL-STD-2525 symbols (milsymbol) on every unit/contact label and the minimap |
| GIS / 3D terrain | Procedural terrain from the fixture's named places (FORD, N BRIDGE, SILENT RIDGE, FUP ORCHID); river, tracks, forest, boundary wall |
| Decision support + records | Decision window with countdown, rationale, cited reports, self-reported confidence |
| Training evaluation / AAR | Scrubbable replay: *what T1 knew* vs *what was real*, truth layer and picture-gap lines |
| Multiplayer | Same-browser multi-window seats over `BroadcastChannel` (no server). A real network service is future work |

Terrain is **procedural and illustrative**, not survey data. Unit sizes are exaggerated so they read from a command camera. The scenario outcome is scripted; there is no score, rank or readiness claim.

## PUBG-style interface, mapped to the training idea

| Familiar game element | Here |
| --- | --- |
| Drop-in from the plane | Cinematic deployment with altimeter (skippable) |
| Compass strip with objective pins | Bearing strip with FORD / N BRIDGE / RIDGE / FUP and distances |
| Minimap with view cone | Hill-shaded minimap, click to move, `M` for the large tactical map |
| Health bars | **Link bars** per element: CLEAR / DEGRADED / LOST |
| Kill feed | Comms feed: reports as they arrive, link alerts, decisions |
| Inventory | **Reports held**, with age, source grade, credibility, Locate and Verify |
| Hotbar 1–5 | Role-specific actions (Instructor: Jam Net, Spoof Contact, layers) |
| Shrinking blue zone | The scripted **interference zone** shrinks over the Jam Net (Instructor/review only) |
| Ping markers | `X` or hotbar, then click ground; distance shown |
| Third-person / free cam / spectate | Follow, Free, Top views (`V`); Tab cycles units |
| Night vision | `N` |

## Light and dark themes

A theme toggle sits on the sign-in screen, in the top banner and in the Menu. **Dark** is a dusk scene (dim warm sun, cool fog, stronger glow); **Light** is a bright day scene with a light interface. Both use the same terrain and the same HUD tokens (`.bg-root[data-theme]` in `battleground.css`). The first visit follows the system colour scheme; the choice is remembered in `localStorage` as a per-viewer convenience only (the app still works if storage is blocked). The Ashoka Chakra is used as a decorative mark, not as the State Emblem. The 2D screens are still dark only.

## Roles and what each can see

| Station | Sees | Can do |
| --- | --- | --- |
| T1 · Company Commander | Perceived picture, reports held, own link state | Verify, ping, decide at DP-1 |
| T2 / T3 · Platoon commanders | Their own outbox with *no acknowledgement* markers | Ping, camera |
| Instructor · White Cell | Truth layer, interference dome, spoof source, traffic ledger, link matrix, picture gap | Fire Jam Net / Spoof, pause, speed, layers |

Authorisation is enforced where commands are issued (`issue()` in `Battleground.tsx`), not only by hiding buttons. A denied command is written to the audit chain.

## Architecture

```
src/battleground/
  world.ts       lon/lat -> world, terrain height, river, tracks (shared by 3D, minimap, sim)
  sim.ts         computeState(commands, t, viewer): pure & deterministic, fixture-driven
  engine.ts      three.js scene; draws whatever SimState it is given
  minimap.ts     2D map renderer
  security.ts    hash-chained audit log, passphrase vault, role table
  audio.ts       native Web Audio cues with captions
  panels.tsx     gate, lobby, compass, mission card, reports, decision, director, AAR
  Battleground.tsx  orchestration: clock, auto-director, multi-window sync, HUD
```

* **One pure function.** `computeState` derives everything from the command log and a time. Same inputs → same picture, so the AAR scrubber, window sync and audit trail agree.
* **Truth/perception boundary.** `computeState` only emits `truthEnemies`, `jam`, `spoofAt`, `traffic` and the `fabricated` flag for the Instructor viewer, or for everyone once the exercise is over. `engine.ts` creates truth meshes only when those fields exist. `tests/battleground.test.ts` and `tests/battleground.e2e.spec.ts` check this.
* **Lazy loaded.** three.js loads only when the battleground opens.

## Security posture (training build)

Implemented in the browser:

* No runtime network calls; production build ships a strict `Content-Security-Policy` (`connect-src 'self'`, no inline scripts, no plugins, no form posts).
* Session gate: operator ID + passphrase (PBKDF2-SHA-256, 150k iterations, memory only); idle lock after 5 minutes; manual lock; **panic wipe** (`Ctrl+Shift+X`).
* Tamper-evident **SHA-256 hash-chained audit log** of every command; verify in-app; export a sealed JSON that is stamped synthetic / unvalidated.
* Role-gated commands and views (above); truth withheld from trainee stations until review.
* Per-session **watermark** (operator, session ID, "TRAINING · SYNTHETIC") over the scene to deter leaked screenshots.
* No `localStorage` / cookies written by the battleground; synthetic data only.

Not provided — and required before any institutional use: server-side authentication and authorisation, signed and reproducible builds, transport security and security response headers set by the host (`frame-ancestors`, HSTS, `Permissions-Policy`), hosting in an approved environment, dependency and licence review, and a formal security assessment. A client-only session gate can be bypassed by anyone with the browser's developer tools; treat it as defence-in-depth for a demo.

## Controls

`W A S D` move · drag orbit · `Shift`+drag pan · wheel zoom · `Q/E` rotate · `V` view · `F` follow · `Tab` next unit · `X` ping · `R` reports · `M` map · `N` night vision · `L` legend · `1`–`5` actions · `T G J` truth/gap/zone (Instructor, review) · `P` pause (Instructor) · `Esc` menu.

## Running

```bash
npm install
npm run dev          # open the landing page, click "Enter 3D battleground"
npm test             # includes battleground sim + audit-chain tests
npm run build        # production build with CSP meta tag
npm run test:e2e     # includes tests/battleground.e2e.spec.ts (software WebGL, slow)
```

Two-person demo: open the page in two windows. Window A: **Instructor**. Window B: **T1**. Both press Deploy; commands, pings and the clock sync over `BroadcastChannel`.

## Known limits

* Terrain, vehicles and soldiers are procedural placeholder art, not authored assets or real geography.
* Multi-window sync is same-browser only and has no authority server; late joiners replay the Instructor's commands.
* Only SILENT RIDGE / DP-1 is playable; IRON FORD has no fixture.
* T2/T3 stations are intentionally light: the fixture has no traffic addressed to them.
* Effects `Full` uses bloom and shadow maps; use `Reduced`/`Off` on integrated GPUs.

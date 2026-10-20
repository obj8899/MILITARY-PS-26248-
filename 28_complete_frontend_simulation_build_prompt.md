# 28 — Complete Front-End Illustrative Simulation Build Prompt (v2, 18 Oct 2026)

**How to use:** give the complete prompt between the `=====` lines to your AI coding tool as the project brief. Fill in the four `«FILL IN»` items in §0. This version specifies the complete illustrative front end of the intended four-month product—not a reduced one-day MVP. The two-minute storyboard is the presentation path through the prototype, not a limit on the features that must exist.

**Agrees with:** `27_two_day_demo_plan.md` (scenarios, event-script format, honest framing), `02` PS-01…PS-10, `13` §6–8, §8b, §11, §12, `14` §4.1, `16` §1, `18` §B.1, `25` Part B/C.

=====

# Build: "Sudarshan Command Deck", a front-end illustrative simulation

## 0. Context and fill-ins

You are building the **front end only** of Sudarshan, an immersive web-based decision-making trainer for junior and mid-level commanders (small-team and sub-unit level) that trains decisions under **degraded communication**: delayed, dropped, incomplete and contradictory information across land, air, cyber and EW. This is for Smart India Hackathon problem statement 26248.

This build is a **comprehensive, cinematic front-end simulation of the intended final product after approximately four months of development**. It is not the real operational product: there is **no backend, no server, no database, no real simulation engine, no real multiplayer infrastructure, and no AI inference**. Every screen, visible feature, button, slider, tab, map control, menu, filter, modal, and export interaction must work locally in the browser. All scenario inputs, event timing, communication effects, decisions, outcomes, and AAR explanations are predetermined in local fixtures and a deterministic storyboard. Simulate the experience of the complete intended product, not just the features needed for a minimum demo. The two-minute video uses one carefully rehearsed path through this larger prototype.

Fill-ins (the person pasting this sets these):
- Team name for the end card: «FILL IN»
- Team member names and roles for the end card: «FILL IN»
- SIH round / video length limit (default 2:00): «FILL IN»
- Synthetic terrain choice: «FILL IN: a non-sensitive inland area, or "fully synthetic map"» (default: fully synthetic map, see §6)

## 1. Hard rules

0. **Complete product vision, front-end only.** Implement every feature and screen described in this brief as a convincing interactive simulation, including the secondary scenario and all trainee seats. Do not interpret the two-minute storyboard or the original one-day schedule as permission to omit features. The storyboard defines what to demonstrate on camera; it does not define the full scope of the prototype.
0a. **Mock the behaviour, not the backend.** A control must produce a meaningful local UI change, update local state, append an event/command to the run log, or trigger its scripted consequence. For example, multiplayer is represented by synced browser windows or a single-window seat switcher; network degradation is simulated by the event player; exports are generated locally; and the scenario editor/configuration controls manipulate local fixture-backed state. Do not create server infrastructure just to make the prototype look real.
0b. **Every feature must have a visible demonstration state.** Where a complex future capability cannot be genuinely implemented without a backend (real authentication, server-hosted multiplayer, real AI, persistent multi-user sessions), show a clearly labelled illustrative interface and deterministic local interaction. Do not fake a live external service or claim that a backend capability exists.
0c. **Do not stop at the plan or scaffolding.** Use the plan as an implementation guide, then continue building and testing all screens and controls. Do not wait for approval after writing the plan unless a genuine blocker or a material ambiguity requires a question.

1. **Front end only.** No network calls at runtime except loading local files. Must run offline from `npm run dev` and from a static `npm run build`.
2. **Every visible control works.** No dead buttons. If a control's effect is not in the script, it must still do something truthful (filter, toggle, open a panel, record a command in the run log).
3. **All data lives in `src/fixtures/`.** No hard-coded scenario text, coordinates or timings inside components.
4. **One simulation clock and one event player** drive every screen. No component sets its own timers for scenario events.
5. **Truth and perception are separate data.** A trainee seat only ever receives its own perceived stream. Only the Instructor and the AAR may read the truth stream.
6. **All content is synthetic.** Invented callsigns, unit names and place names only. No real units, operations or classified-looking material.
7. **Honesty label (required, not optional).** A small, tasteful corner tag on every screen: `Illustrative simulation · scripted exercise`. It must be legible in the video but not dominant (for example 11–12 px, 60% opacity, bottom-left). The landing screen and the final end card carry the full wording in §9.
8. **No scores.** No points, stars, XP, leaderboards, "mission score" or accuracy percentages. All AAR indicators are descriptive and labelled `unvalidated`.
9. **Never write the words** "fully working", "production-ready", "deployed", "validated", "AI-powered", or any performance number, anywhere in the UI.

## 2. Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS + shadcn/ui (Radix primitives)
- Zustand for state (one store for the player, one per seat view, one for UI)
- MapLibre GL JS for the map, with a **local** style and local data only (see §6)
- milsymbol for APP-6-style unit symbols (placeholder symbology)
- Framer Motion for animation
- Howler.js for audio, with locally bundled **CC0** sound files only; list each file and its source in `public/audio/LICENCES.md`
- BroadcastChannel API for syncing multiple browser windows (seats) on one PC
- Vitest for unit tests, Playwright for the acceptance run in §12

Pin exact versions in `package.json`. Choose only MIT/BSD/Apache/ISC-licensed packages and list them in `THIRD_PARTY.md`.

## 3. File layout

```
src/
  app/            routing, layout, providers, honesty tag, seat switcher
  player/         sim clock, event player, branch resolver, run log, BroadcastChannel sync
  contracts/      TypeScript types for script, events, commands (§4)
  fixtures/
    scenarios/    silent-ridge.json, iron-ford.json   (the scripts)
    map/          terrain style, synthetic features GeoJSON, place names
    copy/         orders briefs, radio phrasing, inject card text
    audio-map.json
  map/            map component, layers (truth, perceived, fog, rings, ghosts), symbol renderer
  screens/
    landing/  setup/  instructor/  trainee/  brief/  aar/  endcard/
  components/     shared UI (radio card, link lamp, countdown, timeline, slider)
  audio/          sound manager (mute, captions)
  export/         JSON, CSV, print-to-PDF
public/audio/
tests/
```

## 4. Typed scenario script and event contracts

Define these types in `src/contracts/`. Field names follow the project's messaging design so the front end can later be switched to a real server without changing screens.

### 4.1 Scenario script (`Scenario`)
- `id`, `title`, `synthetic: true`, `summary`
- `map`: centre, zoom, bounds, named places (FORD, N BRIDGE, RIDGE, FUP, Coy HQ, Pl 1, Pl 2 positions)
- `seats`: Instructor (white cell), `T1` Coy Cdr (sub-unit commander), `T2` Pl 1 Cdr, `T3` Pl 2 Cdr; automated feeds `T5` Fires/Air (UAS) and `T6` Signals/EW
- `links`: one per pair (UAS→T1, T2→T1, T3→T1, T1→T2, T1→T3, Adjacent→T1), each with a default profile
- `profiles`: Clear, Contested, Heavily Jammed, Deceptive; each with `delayMin` range, `lossPct`, `partialPct`, `garblePct`
- `truthTimeline[]`: ground-truth entity positions and facts over sim time
- `segments[]`: groups of timed items. Each segment has `startsOn`: `"sessionStart"` or a command type + args (for example `FireInject{card:"SPOOF"}`), and `items[]` with times **relative to the trigger**
- each item: a report or message with `id`, `from`, `to[]`, `simOffset`, `precedence` (FLASH / IMMEDIATE / ROUTINE), `sourceGrade` (A–F) and `credibility` (1–6), `text`, `fields`, `truthRef` or `fabricated: true`, and per-recipient `delivery`: `{ delayMin, drop, partialFields[], garble }`
- `decisionPoints[]`: `id`, `seat`, `opensAt`, `deadlineMin`, `defaultOption`, `options[]`
- `branches[]`: keyed on (`decisionPointId`, `optionId`) → a segment to start
- `brief`: situation, mission, commander's intent, H-hour (synthetic)
- `aarNotes`: which reports were delayed, dropped, partial or false, for the explanation panel

### 4.2 Stream event envelope (`StreamEvent`)
`sessionId, streamId, streamSeq, sseq, incarnation, simTime, type, payload`
- One stream per seat (`perceived:T1`, `perceived:T2`, `perceived:T3`) plus `truth`.
- `streamSeq` is gapless per stream. `sseq` is the global order.
- Event types: `SessionStateChanged`, `BriefIssued`, `ReportDelivered`, `MessageDelivered`, `EntityPerceived`, `LinkStateChanged`, `InjectFired`, `DecisionPointOpened`, `DecisionRecorded`, `DefaultApplied`, `ItemFlagged`, `TruthUpdated`.

### 4.3 Command envelope (`Command`)
`commandId` (crypto UUID), `sessionId`, `seat`, `clientSeq`, `basisStreamSeq` (the last streamSeq that seat had applied when the user acted: this records "what you knew"), `type`, `payload`.
Command types: `CreateSession`, `SetLinkProfile`, `SetLinkParam`, `FireInject`, `Pause`, `Resume`, `SetSpeed`, `EndSession`, `SubmitDecision` (option, rationale, confidence 0–100, citedBasis[]), `FlagItem` (trust / verify / discard), `RetaskUAS`, `SendMessage`, `SendRunner`, `SwitchFrequency`, `Annotate`.

### 4.4 Event player (`src/player/`)
- **Sim clock:** start, pause, resume, speed ×1 / ×4 / ×10, jump to next beat (used in rehearsal only, hidden behind a key). Display in DTG style (e.g. `181005Z OCT`).
- **Player:** on each tick, emits due items as `StreamEvent`s onto the right streams, applying each recipient's `delivery` (late arrival, drop, partial fields removed, garbled words replaced by `[BROKEN]`).
- **Commands in:** every user action becomes a `Command`, is appended to the **run log**, and may start a segment (`startsOn`) or select a branch.
- **Live profile changes** apply the chosen profile to items sent after the change. Script items already carry their scripted delivery for the profile the storyboard expects; if the instructor picks a different profile, recompute delivery deterministically from the profile with a fixed seed so the result is the same every run.
- **Deadline:** if a decision point's deadline passes, emit `DefaultApplied` with the scripted default.
- **Sync:** the Instructor window is the host and runs the player; other windows join by BroadcastChannel and render their own stream. A single-window mode (seat switcher + split view) must also work for recording.
- **Run log:** every command and every emitted event, with wall time and sim time. The AAR and exports are computed **only** from the run log of the current run.
- **Reset:** "Restart exercise" clears the run log and replays identically.

## 5. Visual direction: "Sudarshan Command Deck"

Premium military operations centre, not a school dashboard.
- Near-black charcoal background; deep terrain-green surfaces.
- One vivid signal colour, electric amber, for alerts. Restrained red only for danger and loss of comms. Cyan only for the truth layer on the instructor map.
- Full-screen map is the anchor and occupies at least half of every major screen.
- Glass panels with soft blur, depth and a subtle noise texture; thin dividers; glowing status lamps.
- Tactical grid, contour lines, coordinate readout under the cursor, synthetic map labels.
- Type: one condensed sans for headings and labels (uppercase tracking), one mono for DTG, grids and callsigns. Generous spacing, large type, no clutter.
- Motion: panel arrivals, map fly-tos on FLASH traffic, report cards landing, signal-interference flicker on contested links, fog fading in as information ages. Respect `prefers-reduced-motion`.
- Audio (optional, with a mute button and on-screen captions): radio squelch on new traffic, low static bed while a link is contested, a distinct FLASH tone, a countdown tick in the last minute.
- Target 1920×1080; must also be usable at 1366×768.
- Terminology on screen: Coy, Pl, Coy Cdr, Pl Cdr, sub-unit, FUP, CO, white cell, net, callsign, SITREP, CONTACT report.

## 6. Map

- Use a **fully synthetic** terrain by default: a local MapLibre style with a background, hillshade-like gradient, contour lines, a river, a ford, a northern bridge, a ridge, tracks and woods drawn as local GeoJSON in `src/fixtures/map/`. This avoids tile downloads and licence questions.
- If a real non-sensitive inland area is chosen instead, use a local PMTiles extract and show the OpenStreetMap attribution.
- Layers: friendly units, perceived enemy (solid when fresh), **ghost** last-known positions (dashed, faded), **uncertainty rings** that grow with information age, **contradiction pairs** (two ghosts linked by a dotted line with a "?"), air threat icon with ring, GPS-drift trail, truth layer (instructor and AAR only).

## 7. Screens, controls and what each does

Each control lists its effect against the script. "Logs" means it creates a `Command` in the run log.

### S1 Landing / role select
- Title, one-line description, full honesty line (§9), scenario picker (SILENT RIDGE, IRON FORD), seat buttons (Instructor, T1, T2, T3), "Open all seats" (opens 4 windows), "Single-window mode".
- **Enter Exercise:** cinematic transition (map zooms in from a high view to the area).

### S2 Instructor: Session Setup (PS-03 configure)
- Preset chips: Clear / Contested / Heavily Jammed / Deceptive → sets every link's profile (logs `SetLinkProfile`).
- Per-link sliders: delay, loss %, partial %, garble % (logs `SetLinkParam`); a live preview line shows how a sample report would arrive.
- Seat list with ready lamps; each seat window's "Ready" lights the lamp through sync.
- Decision deadline selector (4 / 6 / 8 min sim time).
- **Start Exercise** (logs `CreateSession`, starts the clock).

### S3 Instructor: Command Deck, live (PS-01 inject mid-exercise, PS-04 monitor)
- **Truth map** with all real positions, plus a toggle to overlay any seat's perceived picture.
- **Inject deck** (cards): Jam Net (link → Contested or blackout), Spoof Contact (fabricated adjacent-unit report), GPS Spoof Pl 2, Drone Sighting, Restore Link. Click or drag a card onto the timeline → card animation → logs `FireInject` → starts the matching script segment.
- **Link-health matrix:** each link with lamp (green / amber / red), current profile, delivered / dropped / delayed counts.
- **Live decision feed:** each decision appears within a second of submission with seat, option, rationale, confidence, time since the decision point opened, **"Information held"** chips (the reports that seat had at `basisStreamSeq`, with ages and grades) and a **truth comparison** chip.
- **Live traffic monitor:** every message with its sent time, delivery fate (delivered late / dropped / partial / garbled) and recipient.
- Clock controls: play, pause, speed. **End Exercise** → AAR.

### S4 Trainee console, T1 Coy Cdr (PS-09, PS-10)
- Perceived map with fog-of-war (§6 layers). Never shows truth.
- **Radio-net feed:** callsign, precedence, DTG, source grade, age chip ticking up, "SENT / RCVD" times, garbled words as `[BROKEN]`, empty fields shown as `—` for partial reports. New FLASH traffic flies the map to the location.
- **Triage cards:** each report can be marked Trust / Verify / Discard or pinned to the map (logs `FlagItem`).
- **Team net:** chat to T2/T3; messages show sending → delivered (double tick) or no ack; outgoing messages pass through the same degraded links (logs `SendMessage`).
- **Comms actions:** Switch frequency (restores a link after a scripted delay; logs `SwitchFrequency`), Send runner (slow, never jammed; logs `SendRunner`), Re-task UAS (logs `RetaskUAS`, triggers the scripted UAS update after its delay).
- **Link status strip** with lamps; static audio while contested.
- **Decision modal** (opens at the decision point): options, cited basis (tick the reports relied on), free-text rationale, confidence slider, countdown with the stated default. **Submit** logs `SubmitDecision` and selects the branch.

### S5 Trainee consoles T2 / T3 (PS-02 team coordination)
- Same component as S4 with their own perceived stream: own sector, send CONTACT / SITREP form (logs `SendMessage`), "NO COMMS" banner and queued-message counter during blackout, GPS drift on T3 in IRON FORD.
- In single-window mode, a seat switcher shows each seat's different picture of the same moment.

### S6 Orders brief
- One-screen OPORD-style brief (situation, mission, intent, H-hour) with a slow map pan; each seat presses "Acknowledge".

### S7 After-Action Review (PS-05)
Computed from the run log of this run only.
- **Tab 1 — What happened:** replay scrubber over the whole run (map re-renders at any moment); individual timelines per seat and a team timeline, each decision with rationale and confidence.
- **Tab 2 — Why:** **fog slider** that wipes the map from the commander's perceived picture to ground truth at the selected moment (default: the decision point), with "your picture was wrong here" markers; a **"What you knew vs what was true"** card per decision (left: reports held with ages and grades; right: actual situation); an **information-flow strip** per key report: created → delayed / dropped / altered → delivered → read → cited; a plain-language explanation panel ("The UAS report was delayed 4 minutes and its strength field was stripped; the bridge report was fabricated").
- **Tab 3 — Indicators (descriptive, `unvalidated`):** time from decision point to decision, information age at decision, number of verification actions, time to flag the false report, decisions based on later-refuted information. Show counts and times only.
- **Tab 4 — Sustain / improve:** instructor notes and trainee reflection text boxes (stored in the run log).
- **Compare** (optional, P2): Clear vs Contested run of the same scenario side by side.
- **Export:** JSON (full run log + computed indicators), CSV (decisions, indicators), PDF (print stylesheet of the AAR). Every export includes `synthetic: true`, `illustrativeSimulation: true`, `validity_status: "unvalidated"`.

### S8 End card
Architecture diagram with two colours, plus team names. Wording in §9.

## 8. The storyboard (scripts to author in `src/fixtures/scenarios/`)

Times are sim time. The video uses ×4–×10 between beats.

### 8.1 SILENT RIDGE (primary; this is the 2-minute video)
| # | Sim time | Trigger | Truth | What T1 sees | Expected UI | PS |
|---|---|---|---|---|---|---|
| A0 | H-10 | Session start | — | Orders brief | Acknowledge lamps on instructor | PS-03, PS-07 |
| A1 | H+0 | Auto | 4 enemy vehicles at FORD | UAS report B/2 "4 × vehicles at FORD"; T2 CONTACT near ford | Squelch, card lands, enemy icon | PS-08 land, air |
| A2 | H+5 | Instructor plays **Jam Net** on T2→T1 | Unchanged | T2's 3 reports: #1 arrives 4 min late, #2 dropped, #3 partial and garbled | Amber lamp, static, age chips, missing acks | PS-01 delay, dropout; PS-09; PS-08 EW |
| A3 | H+8 | Instructor plays **Spoof Contact** | Nothing at N BRIDGE | Adjacent-unit report C/3 "enemy armour at N BRIDGE" | Contradiction ghost pair with "?" | PS-01 conflict; PS-08 cyber |
| A4 | H+8–12 | Auto + team chat | — | T2/T3 messages arrive late | Team net delivery states | PS-02 |
| A5 | H+10 | Decision point DP-1 opens (6 min) | — | Options: Commit reserve north / Hold at ford / Re-task UAS first; default Hold | Countdown | PS-10 |
| A6 | H+11 | T1 picks **Re-task UAS first**, marks spoof "Verify", 60% confidence | — | — | Instructor feed shows decision + information held vs truth | PS-04 |
| A7 | H+17 | Branch "re-task" | Ford confirmed; bridge empty | Fresh UAS report B/2 | Bridge ghost fades; T1 flags spoof false; holds | PS-10 |
| A8 | End | Instructor ends | — | — | AAR: fog slider, what you knew vs truth, info-flow, export | PS-05 |

Also author the other two DP-1 branches so any click works: **Commit north** (enemy crosses the ford unopposed at H+16) and **Hold** (enemy probes at H+15).

### 8.2 IRON FORD (secondary, selectable on the landing screen)
| # | Sim time | Trigger | Truth | What seats see | Expected UI | PS |
|---|---|---|---|---|---|---|
| B0 | H-5 | Instructor chooses **Deceptive** and changes UAS delay and T3 GPS error | — | Setup screen | Preset + sliders | PS-03 |
| B1 | H+0 | Auto | Enemy drone over Pl 2 | T3 "drone sighted"; T1 gets it 6 min late | Air threat icon, growing ring | PS-08 air |
| B2 | H+4 | **Jam Net** → 5-min blackout on T3 | — | T1 loses T3; T3 sends queue | Red lamp, NO COMMS, queued counter | PS-01 dropout |
| B3 | H+6 | **GPS Spoof Pl 2** | T3 at its real grid | T3 and T1 see T3 400 m off | Drift trail; truth on instructor | PS-08 EW, PS-09 |
| B4 | H+9 | Blackout ends | — | 4 queued reports land at once, out of order, one 8 min stale | Burst animation, reorder marker | PS-01 delay |
| B5 | H+10 | DP-1 | Main enemy at FORD | Decision under countdown | — | PS-10 |
| B6 | H+11 | T1 picks **Commit reserve north** citing the stale report, 80% | — | Instructor feed flags "based on 8-min-old info" | — | PS-04 |
| B7 | H+16 | Branch | Enemy crosses FORD | T2 CONTACT | Consequence on map | — |
| B8 | End | — | — | AAR shows why the picture was wrong | — | PS-05 |

### 8.3 Two-minute video click path (SILENT RIDGE)
| Video time | On screen | Action |
|---|---|---|
| 0:00–0:08 | Landing, honesty line visible | Enter Exercise transition |
| 0:08–0:18 | Setup | Choose Contested preset for T2 link, Start |
| 0:18–0:30 | T1 console | A1 UAS report lands |
| 0:30–0:50 | Instructor deck | Play Jam Net; cut to T1: late, missing and garbled reports |
| 0:50–1:05 | Instructor → T1 | Play Spoof Contact; contradiction ghosts appear |
| 1:05–1:25 | T1 decision modal | Re-task UAS, rationale, 60%, Submit; cut to instructor live feed |
| 1:25–1:50 | AAR | Fog slider sweep, "What you knew vs what was true", info-flow strip |
| 1:50–2:00 | End card | Built vs roadmap |

## 9. Honesty wording (required)

- **Corner tag, every screen:** `Illustrative simulation · scripted exercise`
- **Landing screen, under the title:** "Interactive prototype of the Sudarshan trainer. Exercise events come from a scripted scenario in the same message format our simulation engine will produce."
- **End card:** two columns. *Built in this prototype:* trainee, instructor and AAR interface; scenario script format; event and command contracts. *Next in our roadmap:* deterministic simulation engine, multiplayer server over LAN, scenario editor, 3D view.
- The AAR export header carries `illustrativeSimulation: true`.

## 10. Accessibility and quality
- Keyboard focus visible on every control; all icons have labels; captions for every sound; colour is never the only signal (lamps also show text).
- No console errors during the full click path.
- Lighthouse performance and accessibility ≥ 90 on the built app (target, measure locally).

## 11. Build order — complete prototype, not a reduced MVP

Build in this order to control dependencies, but the final deliverable must include **all** listed screens and features. Do not stop after the early steps and call the prototype complete.

1. **Foundation:** contracts (§4), both scenario fixtures, synthetic map data, deterministic simulation clock/event player, run log, local state, branch resolver, and tests for delay/drop/partial/garble and branching.
2. **Application shell:** theme, responsive layout, persistent honesty tag, landing/role selection, scenario selection, single-window seat switcher, and browser-window seat sync.
3. **Map system:** synthetic terrain, grid/coordinates, unit symbols, truth/perceived layers, fog-of-war, ghost markers, uncertainty rings, contradiction pairs, air threat, GPS drift, layer toggles, pan/zoom, and map focus actions.
4. **Orders and setup:** orders brief, acknowledge flow, instructor setup, communication presets and per-link controls, deadline selection, seat readiness, and start/restart flow.
5. **All trainee seats:** T1, T2 and T3 consoles with their distinct perceived streams, radio feed, triage actions, team messaging, CONTACT/SITREP forms, link health, queued messages, frequency switch, runner, UAS retasking, decision modal, rationale, confidence, cited reports, deadline, and scripted branches.
6. **Instructor Command Deck:** truth map, perceived-view overlays, inject cards and drag/drop-to-timeline, link-health matrix, traffic monitor, delivery-fate details, live decision feed, information-held chips, playback controls, and end-exercise flow.
7. **Full AAR:** all four tabs, replay scrubber, seat/team timelines, perception-to-truth slider, decision comparison, report information-flow strip, descriptive unvalidated indicators, instructor notes, trainee reflection, and local JSON/CSV/print-to-PDF exports.
8. **Scenario coverage:** complete SILENT RIDGE and IRON FORD storylines, all injects, every decision branch, missed-deadline defaults, GPS spoofing, blackout recovery, delayed message bursts, and repeatable reset.
9. **Polish and end card:** cinematic transitions, map flyovers, motion/accessibility preferences, optional local licensed audio with captions and mute, responsive 1920×1080 and 1366×768 layouts, end-card architecture/roadmap, and recording-friendly controls.
10. **Verification:** run unit tests and available browser tests, complete the manual control checklist, verify offline static build, inspect console errors, verify no truth leakage into trainee views, and rehearse the exact two-minute storyboard.

**Scope rule:** if implementation time becomes constrained, simplify the internal implementation—not the visible feature coverage. Use deterministic local mock behaviour, scripted state transitions, reusable components, and fixture data to keep every screen demonstrable. Do not remove T2/T3, IRON FORD, AAR tabs, exports, communication actions, or the instructor configuration interface merely to meet the two-minute video length. The video demonstrates the primary path; the rest of the prototype remains available for exploration and judging. Keep the honesty tag and end card.

## 12. Acceptance checks (all must pass; write a Playwright test for 1–8)
1. The app runs offline from a static build; no runtime network requests except local files.
2. Running SILENT RIDGE with the §8.3 click path produces the same run log every time (same events, same order, same sim times).
3. T1's window never contains a truth-only entity or the "fabricated" flag before the AAR.
4. After Jam Net, T2→T1 report #1 arrives 4 sim-minutes late, #2 never arrives, #3 arrives with the strength field empty and garbled text.
5. Spoof Contact creates a contradiction pair on T1's map and both cards show a contradiction marker.
6. Submitting a decision shows it on the instructor feed within 1 second, with the information-held chips matching T1's stream at `basisStreamSeq`.
7. Each DP-1 option starts its own branch; a missed deadline applies the default.
8. The AAR fog slider at DP-1 shows the bridge report as false and the delayed UAS report as true; exports download and contain `illustrativeSimulation: true`.
9. Every button on every screen does something visible or logs a command (manual check list in `tests/MANUAL.md`).
10. Honesty tag visible on every screen at 1920×1080; end card present.
11. No "fully working", "production-ready", "validated", scores or accuracy/effectiveness percentages in the UI; the trainee's own confidence value is allowed (add a test that greps the built bundle for these strings).

## 13. How to work

- Start by writing `docs/PLAN.md` summarising the full scope, screen inventory, state model, event flow, storyboard, and file layout.
- Then implement the contracts and both scenario fixtures, followed by the app shell and screens in §11. **Do not stop after showing the plan, contracts, or first fixture. Continue through the complete prototype.**
- Work in small, testable increments. After each major section, run the available tests, fix regressions, and maintain `docs/IMPLEMENTATION_STATUS.md` with completed screens, working controls, known limitations, and the next tasks.
- Use reusable components and a single deterministic event player. Keep scenario content, timings, labels, outcomes, and map features in fixtures/configuration rather than scattering them through UI components.
- Every control must have a meaningful local effect. Maintain a manual control inventory in `tests/MANUAL.md`; do not leave decorative buttons that appear interactive but do nothing.
- If a feature normally requires a backend, build its front-end simulation with local deterministic data and label it honestly. Do not add backend services, network dependencies, authentication services, or real AI.
- Ask before adding any dependency not in §2.
- At completion, provide run instructions, a feature-by-feature status summary, test results, any remaining limitations, and the exact two-minute demo click path. Do not claim tests were run unless they actually were.

=====

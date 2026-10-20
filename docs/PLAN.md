# Sudarshan front-end prototype plan

## Purpose

Build an offline, browser-only illustrative simulation for SIH 26248. The prototype trains small-team commanders to make decisions when reports are delayed, lost, incomplete, garbled, or contradictory. It deliberately contains no backend, database, real simulation engine, AI, or external runtime services.

The prototype must always show the honesty label: `Illustrative simulation · scripted exercise`.

## Demonstration outcome

The primary demonstration is the SILENT RIDGE scenario:

1. An instructor starts a scripted exercise with a shared simulated clock.
2. T1 receives a credible UAS report about enemy vehicles at the FORD.
3. The instructor fires Jam Net. T2-to-T1 traffic is deliberately late, lost, partial, or garbled.
4. The instructor fires Spoof Contact, producing a plausible but fabricated report at N BRIDGE.
5. T1 records a decision, rationale, confidence, and cited reports.
6. An after-action review derives its timeline and explanation from the current run log, comparing what T1 received to the truth stream.

## Architectural constraints

- Scenario text, positions, delays, map labels, and timing belong in `src/fixtures/` only.
- A single simulation clock and event player produce all scenario events.
- Trainee views consume only their own `perceived:<seat>` stream. The truth stream is restricted to Instructor and AAR code.
- Every interaction creates a typed command and is retained in the run log.
- The Instructor is the BroadcastChannel host; recording must also work in a single-window seat-switcher mode.
- The static build must make no runtime network requests other than local application files.

## Screen inventory

- Landing and role selection: scenario choice, separate-seat windows, single-window mode, and cinematic entry.
- Orders brief and acknowledgment flow.
- Instructor setup: presets, per-link controls, readiness, and decision deadline.
- Instructor command deck: truth and perception overlays, injects, traffic, link health, decisions, and playback.
- T1, T2, and T3 tactical consoles: unique perceived streams, radio traffic, triage, messaging, link status, communication actions, and decision flow.
- AAR: replay, team and seat timelines, truth/perception comparison, information flow, descriptive unvalidated indicators, reflection, and local exports.
- End card: clearly separates prototype components from future roadmap components.

## State and event model

The app has one deterministic player state, one derived perceived state for each trainee seat, and UI-only state. Scenario segments are triggered by the session start, an instructor command, or a decision branch. A command captures the acting seat's last applied stream sequence (`basisStreamSeq`); generated stream events and commands are appended to a current-run log. The AAR is derived solely from that log.

The primary script is SILENT RIDGE. IRON FORD adds blackout recovery, GPS drift, delayed bursts, and a stale-information decision. Both use a fully synthetic local map and invented terminology.

## Storyboard

The two-minute recording route is SILENT RIDGE: enter exercise; configure the contested link; receive UAS traffic; trigger Jam Net; trigger Spoof Contact; record the re-task-UAS decision; open the AAR; finish on the roadmap card. The remainder of the prototype stays explorable outside that route.

## File layout

`src/app` owns routing and persistent framing; `src/player` owns clock, event playback, branches, log and browser sync; `src/contracts` holds the server-compatible envelopes; `src/fixtures` owns scripts, map and copy; `src/map` owns local layers and tactical rendering; `src/screens` owns the visible product views; `src/components` owns reusable interaction parts; `src/export` generates local artifacts; `tests` holds deterministic and manual acceptance checks.

## Delivery order

1. Typed contracts, SILENT RIDGE fixture, deterministic player, run log, and delivery-effect tests.
2. Application shell, immersive visual system, honesty tag, landing, and seat selection.
3. Local synthetic map: terrain, symbols, ghosts, uncertainty rings, and contradiction pairs.
4. T1 tactical console and decision recording.
5. Instructor setup and command deck with Jam Net and Spoof Contact.
6. AAR timeline and truth-versus-perception reveal.
7. End card.
8. T2/T3 seats, extra comms actions, orders brief, further AAR tabs, exports, audio, and IRON FORD.

## Acceptance evidence

The primary run must be deterministic: Jam Net produces one four-minute delay, one drop, and one partial/garbled T2 report; Spoof Contact creates a contradiction; each decision choice selects its own branch; and the AAR reconstructs the decision context from the run log. No screen may describe the prototype as fully working, production-ready, deployed, validated, or AI-powered.

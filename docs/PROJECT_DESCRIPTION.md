# Sudarshan Command Deck — project description

## Purpose and audience

Sudarshan Command Deck is an offline, browser-only illustrative prototype for Smart India Hackathon problem statement 26248. It presents a decision exercise for junior and mid-level commanders: reports can be late, incomplete, garbled, missing, or contradictory, and the learner must decide what to do with an imperfect picture.

The intended users of a future trainer are exercise facilitators and small-team or sub-unit commanders. The current prototype is for explaining the training concept and rehearsing a scripted SILENT RIDGE path. It is not an operational tool and must not be used for operational decisions.

## Why degraded-communication training matters

Commanders often have to choose whether to trust, verify, request more information, or act before uncertainty is resolved. A useful learning discussion is not only whether a choice led to a favorable scripted outcome, but what information the learner had at the time, how old it was, and what additional action might have improved the picture. This prototype makes those questions visible without assigning a score or claiming that a scripted outcome measures real-world readiness.

## What the prototype contains

The current build provides:

- A SILENT RIDGE landing page, exercise setup, orders brief, Instructor view, T1/T2/T3 consoles, AAR, end card, field guide, and a local Scenario Builder screen.
- A local SILENT RIDGE fixture, with synthetic reports and terrain labels such as FORD, N BRIDGE, and RIDGE.
- Separate seat-specific feed arrays in the browser UI, triage controls, a decision form, visible Instructor inject controls, and a local run-log display.
- A single app-level interval clock used by the Instructor display and the fixture-timed Auto-Director behavior.
- A rule-based AAR reel and narrative assembled from the current local feed, run-log entries, triage state, and fixture notes.
- Local JSON/CSV serialization, browser print styling, local scenario-definition import/export, structural checks, and seeded delay-variant generation.
- Five interactive field-guide cards, a seven-step Judge walkthrough path, presenter controls, a CSS effects preference, and a low-volume native Web Audio confirmation cue with a caption.

See [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md), [`UPGRADE_PLAN.md`](./UPGRADE_PLAN.md), and [`tests/MANUAL.md`](../tests/MANUAL.md) for phase state and interaction notes.

## Prototype behavior versus a future product

| Area | Present in this prototype | Future product work |
| --- | --- | --- |
| Scenario content | Local SILENT RIDGE JSON fixture and copy fixtures | Complete authored scenario set, including IRON FORD |
| Communication effects | Per-report outcomes shown from fixed fixture rules; setup controls provide a profile preview | A complete deterministic event player that applies selected settings to all scheduled messages |
| Simulation clock | One app-level interval clock drives the displayed time and partial Auto-Director schedule | One authoritative event clock with pause, speed, scheduled events, deadline defaults, replay and reset |
| Seats and sharing | Single-window seat switching with separate local feed data | Isolated seat processes, robust truth/perception boundaries, and BroadcastChannel or server synchronization |
| Map | CSS illustration with synthetic labels and visual markers | Fixture-owned terrain and entities rendered through a map system, with timeline-driven movement and measured perception gaps |
| Decisions | Local T1 decision choice, rationale, confidence, citations, and scripted consequence caption | Branch execution that changes subsequent scheduled events; DP-2 and missed-deadline behavior |
| After-action review | Rule-based moments, narrative, age marks, descriptive comparison, local exports | AAR derived from an authoritative event log, independently recorded run comparison, and comprehensive export verification |
| Scenario Builder | Local definition editing, structural checks, session-only save, import/export, and seeded delay variants | An authoring workflow for terrain, units, links, reports, branches, plus end-to-end execution of saved definitions |
| Network/services | No runtime service is required for the static prototype | Any future service would need an explicit architecture, security review, and truthful status display |

The existing screen components do not implement the full event-driven simulation described in the concept. In particular, the configured profile is explicitly labeled a preview; scripted report outcomes remain defined in the fixture. Auto-Director is a partial fixture-timed demonstration, not a second implementation of the manual run. The current branch mapping selects a consequence caption, not a complete new event sequence. IRON FORD is displayed as a future exercise but has no scenario fixture. The Builder's preview is definition-only; imported definitions do not run in the SILENT RIDGE player.

## Architecture and data flow

### Current implementation

- [`src/App.tsx`](../src/App.tsx) owns the screen selection, exercise UI, local feed arrays, run-log view, clock state, walkthrough progress, and other presentation state. It is the main composition point rather than a set of independently synchronized screens.
- [`src/contracts/scenario.ts`](../src/contracts/scenario.ts) defines TypeScript shapes for scenarios, seats, links, events, commands, reports, decisions, and branches. These are useful contracts, but the presence of a type does not mean every contract is emitted or consumed by a complete player.
- [`src/fixtures/scenarios/silent-ridge.json`](../src/fixtures/scenarios/silent-ridge.json) and `src/fixtures/copy/` contain the current local scenario and presentation text.
- [`src/player/simulation.ts`](../src/player/simulation.ts) provides scenario lookups, fixed delivery transformation, branch lookup, constructors for sample envelopes, and a log-deduplication helper. It is not yet an authoritative event scheduler.
- [`src/aar/analysis.ts`](../src/aar/analysis.ts) selects key moments, creates a local narrative/export object, and serializes CSV. The screen also uses local seat-feed and triage state.
- [`src/automation/rules.ts`](../src/automation/rules.ts) derives rule-based Advisor suggestions. [`src/builder/validation.ts`](../src/builder/validation.ts) checks local definitions and creates deterministic seeded delay variants.

At a high level, the current path is:

```text
local scenario/copy fixtures
        ↓
React screen state and seat-specific local feeds
        ↓
local commands and display-oriented run-log entries
        ↓
rule-based AAR selection, narrative and local export
```

There is no server, database, real-time multiplayer service, external data feed, or model inference. The app-level clock is not a global event player: report timing and full delivery effects are not consistently scheduled from it.

### Truth and perception

The scenario fixture contains a truth timeline and also contains report metadata. The trainee feed is built from seat-targeted scenario items into a reduced `FeedEntry` shape; the T1 UI test checks that visible T1 text does not include the `fabricated` marker or a truth-only entity label during the covered SILENT RIDGE flow. The Instructor and AAR views can display scenario truth facts.

This is a presentation boundary, not a hardened security boundary. The source fixture is bundled locally, the app is a single React component tree, and the app does not yet enforce separate windows/processes with independent stream permissions. The current test is useful regression coverage, not proof of complete truth isolation.

### Log and AAR

Actions are represented in a local display log with command/event labels and details. Repeated command IDs and repeated event tuples are rejected by the helper; the UI also uses stable IDs for start and inject actions. The AAR chooses moments using the fixed rules in [`AAR_RULES.md`](./AAR_RULES.md), including delay/drop evidence, a refuted report, a decision, a verification action, and a branch caption when those items exist. Export metadata includes synthetic, illustrative, and unvalidated markers.

The log is not a complete server-compatible record of every event in a shared deterministic stream. The clear comparison is explicitly a no-link-effects reference assumption, not a separately recorded run. Browser download and print/save behavior are available locally but are not covered by an automated download/print test.

## Design decisions and trade-offs

- **Local fixtures over service simulation:** keeps the demonstration offline and its content inspectable; it also limits scenario flexibility and realism.
- **CSS terrain over map data rendering:** avoids network tiles and keeps the map synthetic, but positions and movement are illustrative rather than geospatial simulation.
- **Rule-based explanations over opaque inference:** makes the AAR and Advisor behaviors inspectable; the rules are simple and do not establish training efficacy.
- **Descriptive indicators over scores:** avoids implying that a count, elapsed time, or scripted outcome is a validated measure of commander performance. A learner may set their own confidence value as part of a decision.
- **Visible honesty labels:** the interface consistently describes the exercise as illustrative and scripted, and distinguishes built prototype elements from roadmap work.
- **No new dependency for this upgrade:** the sound cue uses native Web Audio, styling uses CSS, and existing project packages were retained.

## Accessibility and responsive use

The UI includes named controls, visible focus styling, descriptive lamp labels, an effects setting (`Full`, `Reduced`, `Off`), and a reduced-motion default when the browser requests reduced motion. The guide and walkthrough use live regions in several places; the generated sound has a visible caption. Screenshot coverage exists at 1920×1080 and 1366×768, and the E2E flow checks document width at those viewports.

No formal Lighthouse audit or full assistive-technology review has been completed. The screenshot test does not measure each panel's overflow, interaction timing, or every focus path. Treat accessibility and responsiveness as ongoing work rather than a certification.

## Glossary

- **AAR:** after-action review; a facilitated discussion of the exercise and the information available at decision time.
- **CONTACT:** a concise report of an observed contact or activity.
- **Credibility:** a descriptive fixture value from 1 to 6; it is not proof that a report is true.
- **DTG:** date-time group, a military-style time convention. The current UI primarily displays an H+ exercise clock.
- **EMCON:** emissions-control posture. It is part of the domain vocabulary, not a full control system in this build.
- **FLASH / IMMEDIATE / ROUTINE:** report precedence labels, from highest urgency to normal handling.
- **FUP:** forming-up point.
- **Net:** a shared radio communication group.
- **Source grade A–F:** a descriptive source-reliability label in the scenario; it does not establish the truth of report content.
- **SITREP:** situation report.
- **White cell:** exercise-control staff who facilitate and observe a training scenario; represented by the Instructor seat here.
- **T1 / T2 / T3:** synthetic role labels for company and platoon command seats in this exercise.

## Explain it in 60 seconds

> Sudarshan Command Deck is an offline, illustrative prototype for a training problem: making decisions when reports arrive late, incomplete, or contradictory. In the SILENT RIDGE rehearsal, an instructor can add scripted communications friction and a contradictory report. T1 reviews a local perceived feed, records a decision and rationale, and then opens an AAR that walks through selected moments and the fixture's truth notes. The current build demonstrates the interaction and discussion flow, not a complete simulation engine or multiplayer product. Its data is synthetic, its outcomes are scripted, and its descriptive indicators are marked unvalidated.

## Explain it in five minutes

1. **Need:** explain why a commander must judge report age, source, and uncertainty rather than simply follow a perfect shared picture.
2. **Show the setup:** point out the synthetic scenario, local communication profile preview, and explicit Waiting/Ready lamps. Say that the profile controls are a preview; the fixture still defines report outcomes.
3. **Show the Instructor and trainee views:** use Jam Net and Spoof Contact, then open T1. Explain that these are scripted local UI effects, not live network delivery. Ask what T1 knows and what should be verified.
4. **Record a decision:** show the cited-basis checkboxes, rationale, and learner-selected confidence. There is no mission score or right/wrong grade.
5. **Review:** show the AAR reel, its rule-based narrative and information-age marks. Explain that the clear reference is an assumption, not a second run.
6. **Be candid about the roadmap:** a complete deterministic player, IRON FORD, DP-2/default handling, real stream synchronization, and execution of custom Builder definitions remain future work.
7. **Close with the principle:** the prototype is designed to make uncertainty discussable while making its own limits visible.

## Local development and checks

Run `npm install` only if dependencies are absent, then `npm run dev`. The project has no required runtime service. Current verification commands are `npm test`, `npm run build`, and `npm run test:e2e`; results and limitations are recorded in [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

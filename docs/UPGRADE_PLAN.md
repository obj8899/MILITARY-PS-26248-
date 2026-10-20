# Upgrade audit and execution plan

This is an upgrade of the existing Vite/React prototype, not a rebuild. The implementation follows the phases in `29_clarity_immersion_and_winning_features_prompt.md` §8 and preserves the offline, synthetic, truth/perception separation, no-score, and honesty-label constraints in file 28.

## Current screen inventory and baseline audit

| Screen | Current behavior | Findings |
| --- | --- | --- |
| Landing / role select | SILENT RIDGE introduction and seat switcher | No IRON FORD selection, no judge walkthrough, and no explanation of the exercise flow. |
| Field guide | Five-step text tutorial | The second step describes setup controls as illustrative only; no interactive demonstrations. |
| Setup | Preset labels, sliders, deadline and readiness list | Preset buttons and sliders do not update state, readiness is pre-marked green, and Start is separated from the controls. |
| Orders brief | Situation, mission, intent and H-hour | Acknowledge is at the top; substantial unused space; no radio check, key questions, task organization, or readiness count. |
| Instructor | Static truth-map mockup, inject buttons and short run log | Map has only two markers; there is no resize-aware map, timeline, link matrix, traffic fate view, playback, or decision feed. |
| T1 console | Shared T1 feed and decision form | No stream isolation by active seat; decision can be submitted repeatedly; no triage, citations, rationale state, or command basis. |
| T2 console | Reuses T1 feed and decision controls | Not a distinct perceived stream or role-specific workflow. |
| T3 console | Reuses T1 feed and decision controls | Not a distinct perceived stream or role-specific workflow. |
| AAR | Static example indicators and truth facts | Not derived from the current run log; contains static, non-interactive explanation; no exports. |
| End card | Built / roadmap lists | No full honesty wording or architecture diagram. |

### Baseline control and layout observations

- The global ten-button navigation is always present without phase indication.
- Setup presets, sliders, deadline, ready indicators, and several AAR text areas are not meaningfully wired to application state.
- Run-log entries are title/detail placeholders without command IDs, event IDs, or simulation ordering. `CreateSession` and `BriefIssued` are seeded once in the initial log and appended again on Start, which is the concrete duplicate-entry root cause.
- Injects immediately append every scripted item to T1's feed, including delayed and dropped messages; delivery timing is displayed but not played by a clock. Spoof truth metadata is present in the shared `FeedEntry`.
- T2 and T3 render T1's feed, so their view is not isolated.
- The maps are CSS mockups rather than MapLibre instances. There is no resize observer to add; the map canvas uses `height: 100%` with a minimum height inside a panel, which can outgrow a constrained parent.
- Base styles contained browser-default range controls and a green readiness lamp that conveyed ready before acknowledgment. Amber focus and slider tokens and explicit readiness states are now being added.
- The maps are CSS mockups; because no MapLibre instance exists, the MapLibre `ResizeObserver` requirement is not applicable yet. CSS map surfaces are constrained to their parent panels.
- The baseline Vitest suite passes (2 tests); the TypeScript/Vite build passes. There is no Playwright config or browser acceptance suite in the repository.
- Captured all ten screens at 1920×1080 and 1366×768 in `docs/screens/before/` (20 viewport screenshots). Browser measurements reported no document-width overflow and no overflow in `.panel` or `.map-canvas` at either viewport.
- The browser audit recorded one failed resource request (the browser's `/favicon.ico`, HTTP 404) and no JavaScript console/page errors.
- Browser controls are mostly interactive, but setup presets/sliders/deadline and static AAR content are not connected to simulation state as described in `tests/MANUAL.md`.

## Execution phases

1. Phase 0 audit and fixes: screenshots at both target sizes; deterministic command/event deduplication; map containment/resize behavior; token alignment; explicit readiness; acceptance status.
2. Design tokens and shared components: palette, type, custom controls, shared atmosphere and motion settings.
3. Header and phase rail: progressive navigation, seat identity, help/sound controls, rehearsal menu and shortcut.
4. Guidance system: mission card, glossary, legend, empty states, beat notifications and role tours.
5. Map upgrade: synthetic terrain, movement/trails, perceived markers and split/picture-gap views with role separation.
6. Brief and setup redesign: radio check, readiness, live profile sample and sticky start action.
7. Instructor deck: script, injects, links, traffic/run-log dock, seat peek and signal path.
8. Trainee consoles: role-specific reports, triage, comms actions, decision capture and branch consequences including DP-2.
9. AAR: key moments, information age, run-derived narrative, facilitator prompts and local exports.
10. Rule-based automation and fixture-backed scenario builder.
11. Judge walkthrough, presenter mode, field guide/end-card updates and optional local Web Audio.
12. Full verification: acceptance tests, control inventory, offline checks, bundle wording check, after screenshots, and demo rehearsal.

## Phase execution notes

The baseline currently does not implement a simulation player or MapLibre map instance despite the original plan. Work will stay honest about that limitation: local UI improvements must not be described as a complete deterministic simulation or as live map functionality.

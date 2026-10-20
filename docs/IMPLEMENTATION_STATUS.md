# Implementation status

Updated: 2026-10-20

## Baseline

- Vitest: 2 tests passed before changes.
- `npm run build`: passed before changes.
- Browser screenshots: 20 screenshots captured at 1920×1080 and 1366×768 in `docs/screens/before/`.
- Browser console: no JavaScript errors; `/favicon.ico` returns 404.
- Playwright: `tests/core-flow.e2e.spec.ts` passes for the SILENT RIDGE UI path and checks duplicate log titles and trainee truth markers.
- Latest Phase 12 verification: Vitest 10/10 passed; TypeScript/Vite build passed; Playwright 2/2 passed; the after-screenshot run produced 22 images; static preview loaded with non-local requests blocked; the production JavaScript bundle had no case-sensitive forbidden-term matches.

## Phase 0 — Audit and fixes

- [x] Read the existing plan and both build/upgrade prompts. File 28 is at the workspace root, not under `docs/`.
- [x] Add `docs/UPGRADE_PLAN.md` with screen inventory and baseline findings.
- [x] Capture every screen at both target resolutions. Browser measurements found no horizontal document overflow or map/panel overflow; no JavaScript errors. One `/favicon.ico` request returns 404.
- [x] Remove pre-seeded `CreateSession`/`BriefIssued` entries (the root cause of duplicates); make start and scripted inject actions idempotent; add typed run-log deduplication helper and Vitest checks for repeated command IDs and repeated event tuples.
- [x] Correct initial seat lamps to grey Waiting and provide explicit acknowledge/mark-all-ready actions. CSS map canvas is bounded; there are no MapLibre instances to observe.
- [ ] Verify the remaining file 28 acceptance checks; the UI is still not backed by the planned shared deterministic event player.

## Phase 2 — Design tokens and shared surfaces

- [x] Added palette, type, spacing, border, radius, focus, slider, and panel tokens in CSS.
- [x] Added a CSS-only `Atmosphere` component and an effects-mode preference persisted to local storage with reduced-motion default.
- [x] Effects mode (`Full` / `Reduced` / `Off`) is persisted locally and defaults to Reduced when reduced-motion preference is set.
- [ ] Complete motion presets and validate performance/a11y targets.

## Phase 1 — Clarity and guidance

- [x] Replaced ten global pills with the five-step phase rail, seat chip, help, sound preference, rehearsal menu, and `Shift+R`.
- [x] Added screen purpose text, role/goal/next-step mission cards, glossary hints, map legend, simple coach tour, and inject notification.
- [ ] Guidance is not fully fixture-keyed by phase/beat; tours are generic, not true spotlight overlays, and `?` replay behavior needs refinement.

## Phase 3 — Map surfaces

- [x] Added CSS synthetic terrain detail, named map labels, tracks, compass, scale, stale/ghost marker styling, T1 contradiction marker, legend, and instructor split-view toggle.
- [ ] Map remains a CSS illustration; movement is not driven by `truthTimeline`, there is no genuine picture-gap measurement or resize observer, and map content positions still need fixture ownership.

## Phase 6 — Orders brief and instructor setup

- [x] Setup presets update the profile preview; sliders show live value/unit and sample report effects; friction label and trainee summary are descriptive.
- [x] Profile and deadline changes are logged; seat lamps start Waiting and can be explicitly marked Ready; Start action is sticky.
- [x] Brief includes fixture-backed key questions and task organization, synthetic named-place map, radio-check control, seat-ready count and bottom acknowledge action.
- [ ] Radio check is a visual local action only; profile changes still do not drive a complete event player or scripted clock.

## Phase 7 — Instructor Command Deck

- [x] Added the three-zone instructor screen, scripted beat list, inject deck and seat target, link summary, bottom data tabs, seat peek, and signal-path panel.
- [x] E2E rehearsal confirms duplicate Jam Net clicks do not duplicate the command and the instructor run log opens.
- [ ] Instructor data remains local UI state rather than a shared deterministic player; truth map movement, real delivery-fate metrics, full signal-path parameters, and functional quick-profile delivery remain incomplete. Auto-Director has partial fixture-timed behavior (see Phase 10), but does not provide manual-log parity or deadline defaults.

## Phase 8 — Trainee consoles

- [x] Added seat-specific report feeds, triage controls, proword replies, comms-action controls, decision form, cited-report selection, and a scripted consequence beat.
- [x] E2E rehearsal verifies T1's rendered text omits truth-only markers and reaches the review screen after submitting a decision.
- [ ] DP-2 is not implemented; comms actions and selected profile are not yet connected to a shared delivery engine or sim clock; T2/T3 forms and real offline queue behavior remain incomplete.
- [ ] Audio currently provides a generated soft confirmation tone and visible caption only; other fixture-triggered audio cues remain outstanding.

## Phase 9 — After-action review

- [x] Added a rule-based key-moment reel, fixed selection rules in `docs/AAR_RULES.md`, fixture-backed facilitator prompts, a run-log narrative, information-age timeline marks, and descriptive current-vs-clear-reference counts.
- [x] Added JSON/CSV serialization with `synthetic: true`, `illustrativeSimulation: true`, `validity_status: "unvalidated"`, selected moments, and narrative; added browser print styling and PDF path.
- [x] Added unit coverage for moment selection, narrative, export markers, and empty evidence. Playwright verifies the moment sequence, truth boundary, review state, and JSON export control.
- [ ] Clear reference is a scripted no-link-effects assumption, not a separately recorded second run. Browser download and print/save-to-PDF flows have not been automated.

## Phase 10 — Automation and builder

- [x] Added one app-level simulation clock, fixture-timed Auto-Director beats, actor attribution in the run log/export, a logged Auto-Director toggle, and a pause before DP-1 with resume after submission.
- [x] Added up to two rule-based Instructor Advisor suggestions; accepting a suggestion logs `AdvisorAccepted` and opens the T1 view.
- [x] Added local scenario JSON import/edit/validation/save/export, deterministic delay variants by seed, and a custom-scenario landing entry. Runtime structure validation and deterministic variants have unit tests.
- [ ] The custom builder preview is definition-only; custom scenarios are not executed by the current SILENT RIDGE player, and map dragging/editors for unit placement, links, reports, options and branches remain incomplete.
- [ ] Auto-Director does not yet match a full manual event-player log, deliver a DP-2, or apply deadline defaults; no shared deterministic scenario engine exists.

## Phase 11 — Judge walkthrough, field guide, presenter, end card, audio

- [x] Added the landing and field-guide entry points to a seven-step Judge walkthrough; it resets a single-window instructor rehearsal, forces Auto-Director off, tracks the scripted action path, and offers Skip.
- [x] Replaced the guide text list with five fixture-backed cards and small local demos for delay, source grade, stream separation, deadlines/defaults, and AAR.
- [x] Presenter mode now hides the rehearsal menu, shows the required hotkey hint, enlarges the interface, and supports rehearsal-gated `N`, presenter `Space`, and `1–4` station switching.
- [x] Added an animated truth → comms effects → perceived streams → AAR end-card diagram, editable team fill-ins, and full synthetic/illustrative wording.
- [x] Added native Web Audio soft confirmation cues with visible captions on user-enabled actions; no dependency or sound files were added.
- [ ] Judge walkthrough was browser-tested for launch/skip, not a complete 90-second rehearsal. Audio remains a single soft cue (radio/static/FLASH/countdown/heartbeat cues are not implemented). Hindi labels are intentionally omitted.

## Phase 12 — Verification

- [x] Vitest: 10 tests passed across 3 files.
- [x] TypeScript and Vite production build passed.
- [x] Playwright: 2/2 tests passed. The core-flow test covers readiness, the SILENT RIDGE UI path, T1 truth-marker absence, duplicate log labels, Builder definition save, field-guide demos, and Judge walkthrough launch/skip.
- [x] Added `tests/after-screenshots.e2e.spec.ts`; it captured all 11 screens at both 1920×1080 and 1366×768 (22 files in `docs/screens/after/`). These screenshots are visual evidence, not a full overflow audit.
- [x] Served the production build with Vite preview; a local Edge run blocked every non-local request and reached the landing page with HTTP 200 and no page errors.
- [x] Scanned the production JavaScript bundle using case-sensitive whole-word checks for the prohibited wording; no matches.
- [ ] The complete file 28 / file 29 acceptance suite and all-screen console/overflow audit are not complete. The full two-minute recording path and 90-second Judge walkthrough were not rehearsed end to end; Lighthouse targets were not measured.
- [ ] Major functional acceptance gaps remain: no complete shared deterministic event player or BroadcastChannel sync; IRON FORD has no scenario fixture; DP-2/deadline defaults are absent; Auto-Director does not reproduce the manual run log; Builder definitions do not execute; Signal path and cross-seat truth-leakage checks are partial.
- Optional Hindi labels were not added. The seeded variant generator was implemented, but its output is not an executable scenario.

## Known limitations

- The app has one app-level interval clock used for the live display and Auto-Director scheduling, but is not backed by a complete shared deterministic event player. The AAR consumes local UI run-log/feed state and fixture truth; it is not a server-authoritative replay.
- Current `IRON FORD` presentation is placeholder copy only; its scenario fixture is absent.
- `MapLibre` is installed but not used by the app. The current visual map is CSS.
- Playwright runs against the system-installed Edge executable; no package dependency was added.

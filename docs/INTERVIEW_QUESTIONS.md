# Sudarshan Command Deck — interview preparation

Answers below describe the current local prototype, not the future product. Replace any first-person wording with the team's actual responsibilities before using it in an interview.

## Concept

### 1. What problem are you addressing?
**Model answer:** The concept is to help small-team commanders discuss decisions made with late, missing, incomplete, or contradictory reports. The prototype makes information uncertainty visible before and after a decision.
**Avoid:** Claiming this build improves operational readiness or prevents real-world incidents.

### 2. Who is the intended user?
**Model answer:** The intended users are exercise facilitators and junior or mid-level commanders in small-team or sub-unit training. The current screens represent an Instructor and T1/T2/T3 seats.
**Avoid:** Saying the prototype is approved for operational use.

### 3. What is immersive about this?
**Model answer:** It uses a command-deck presentation, synthetic map labels, report cards, scripted communications effects, a decision form, and a guided AAR. The immersion is a UI demonstration; it is not a live field or network simulation.
**Avoid:** Describing visual polish as proof of training effectiveness.

### 4. What happens in SILENT RIDGE?
**Model answer:** A fictional exercise presents reports about the FORD and N BRIDGE, lets an Instructor add scripted effects, and asks T1 to review information and record a decision. The AAR then shows selected moments and scenario truth notes.
**Avoid:** Claiming that all events are scheduled and delivered by a complete simulation engine.

### 5. How is this different from existing simulators?
**Model answer:** We have not established uniqueness against existing simulators. Our current emphasis is a transparent, local demonstration of degraded-report decision discussion, with explicit labels about what is scripted and what remains future work.
**Avoid:** Claiming that competing products lack these features without research evidence.

### 6. What learning outcome do you intend?
**Model answer:** The intended discussion is about what the learner knew at decision time, how old or uncertain the reports were, and whether verification or another information-gathering action would have helped.
**Avoid:** Promising measured improvement or a score-based assessment.

### 7. Why use a fully synthetic scenario?
**Model answer:** Synthetic places and content keep the demo self-contained and avoid dependence on live or sensitive information. Scenario names like SILENT RIDGE and FORD are fictional labels.
**Avoid:** Suggesting any map or scenario data is operationally accurate.

## Technical

### 8. What is the current architecture?
**Model answer:** It is a Vite/React/TypeScript single-page application. Fixtures hold scenario and copy data; `App.tsx` owns most screen state; helper modules provide scenario lookups, local rule-based AAR analysis, Advisor rules, and Builder checks.
**Avoid:** Describing it as a distributed or server-backed architecture.

### 9. Is the application event-driven?
**Model answer:** The contracts define command and event envelopes, and the UI records local command/event-like entries. A complete event scheduler that drives every view is not implemented yet.
**Avoid:** Saying the contract types mean a complete event engine already exists.

### 10. How does the simulation clock work?
**Model answer:** One app-level interval updates the displayed exercise time and is used for partial Auto-Director scheduling. It does not schedule every report or apply all timing and deadline rules.
**Avoid:** Calling it an authoritative simulation clock.

### 11. How deterministic is the prototype?
**Model answer:** Fixture outcomes and the seeded delay-variant helper are deterministic for the same inputs. The full user run is not yet proven to reproduce an identical complete event log across resets.
**Avoid:** Claiming end-to-end repeatability beyond the tested functions.

### 12. Why use local fixtures?
**Model answer:** Fixtures keep scenario content inspectable, avoid runtime network requirements, and make the demonstration reproducible without a backend. The trade-off is limited dynamic behavior.
**Avoid:** Saying fixtures are equivalent to a live simulation service.

### 13. How are truth and perception separated?
**Model answer:** Trainee feeds are created from seat-targeted report entries in a reduced UI shape, while the Instructor/AAR can show truth facts. A Playwright check confirms that the covered T1 view does not display two truth markers.
**Avoid:** Calling this a hardened security boundary; the fixture is bundled in one client application.

### 14. Does the app use BroadcastChannel?
**Model answer:** No. The current demo uses single-window seat switching; cross-window synchronization is a roadmap item.
**Avoid:** Implying several browser windows share a live session.

### 15. What does the run log contain?
**Model answer:** It contains local display entries for commands and scenario events, with IDs, descriptions, actors, and simulated-time labels where available. A deduplication helper rejects repeated command IDs and repeated event tuples.
**Avoid:** Calling it a complete authoritative event-sourcing log.

### 16. How are branches resolved?
**Model answer:** A helper maps the DP-1 option to a scripted branch identifier, and the UI shows a matching consequence caption. The branch does not start a complete subsequent event segment.
**Avoid:** Claiming that all DP-1 options lead to complete follow-on scenarios.

### 17. How does the offline requirement work?
**Model answer:** The static build serves local HTML, JavaScript, and CSS. A browser check loaded the preview while requests to other origins were blocked.
**Avoid:** Claiming every possible interaction was tested offline; the check covered the static landing load.

## Design

### 18. Why are there no scores?
**Model answer:** A scripted prototype cannot justify a performance rating. Descriptive timing and counts can support discussion, but they are marked unvalidated and are not grades.
**Avoid:** Turning counts, confidence, or scripted outcomes into rankings.

### 19. Why does the decision form have confidence?
**Model answer:** Confidence is the learner's own reflection attached to a decision, not an accuracy measure or instructor-assigned grade.
**Avoid:** Interpreting a higher confidence value as better performance.

### 20. Why is automation rule-based?
**Model answer:** Fixed rules are easier to inspect and explain in this prototype. Auto-Director and Advisor use fixture timing or local run-log conditions rather than model inference.
**Avoid:** Calling the Advisor intelligent or implying it predicts outcomes.

### 21. Why keep the honesty label on screen?
**Model answer:** It makes the boundaries visible during a demo: the exercise is illustrative, scripted, and synthetic. The end card separately lists what is built and what is still planned.
**Avoid:** Removing the label to make the prototype appear more complete.

### 22. What design choices help accessibility?
**Model answer:** The UI includes named controls, visible focus styling, textual readiness states alongside lamps, reduced-motion preferences, and a caption for the generated sound cue.
**Avoid:** Claiming a formal accessibility rating; no Lighthouse or assistive-technology audit has been completed.

### 23. Why is the map CSS rather than a live map?
**Model answer:** CSS keeps the terrain fully local and synthetic with no tile service. It is an illustration, not a geospatial renderer or timeline-driven map.
**Avoid:** Describing the map as operationally accurate or live.

## Honesty and limits

### 24. Is this a working product?
**Model answer:** It is an interactive front-end prototype. Some flows change local state and produce scripted presentation, but there is no complete simulation backend or production service.
**Avoid:** Presenting the prototype as finished or production-ready.

### 25. Is AI used in the application?
**Model answer:** No model inference is part of the app. Advisor and Auto-Director behaviors are rule-based. An AI coding assistant was used during implementation; that is separate from runtime product behavior.
**Avoid:** Saying the app learns, predicts, or reasons.

### 26. Has the training effect been validated?
**Model answer:** No. The current AAR indicators and outcomes are explicitly unvalidated. A future study would need a defined training protocol, participant consent, appropriate oversight, and evidence beyond a scripted demo.
**Avoid:** Treating passing software tests as evidence of training effectiveness.

### 27. What is mocked?
**Model answer:** Full event delivery, multiplayer synchronization, map movement, decision deadlines/defaults, some communications actions, IRON FORD, and execution of Builder scenarios are absent or partial. The current primary path is driven by local state and fixtures.
**Avoid:** Hiding gaps behind the visual similarity of screens.

### 28. What does the Scenario Builder do?
**Model answer:** It can import/edit local JSON, check required structure, save a definition for the current session, export it, and generate a seeded delay variant. It cannot run a custom scenario in the current player.
**Avoid:** Calling it a complete scenario authoring and execution environment.

### 29. How does the AAR comparison work?
**Model answer:** It compares current T1 feed counts with a stated clear/no-link-effects assumption. It is not a second recorded run.
**Avoid:** Calling it a measured controlled comparison.

### 30. How is sensitive data handled?
**Model answer:** The current scenario content is synthetic, and the app does not require a runtime service. A future product would need a separate data classification, access-control, retention, and security design.
**Avoid:** Claiming that synthetic content alone makes a future system secure.

## Teamwork and process

### 31. How did an AI coding tool fit into the work?
**Model answer:** An AI coding assistant helped draft implementation and test changes. The claims in the project materials are limited to behavior checked in source, unit tests, browser tests, and the static build.
**Avoid:** Claiming every generated change was correct or that a tool replaces review.

### 32. How did you test the prototype?
**Model answer:** The current checks include ten Vitest tests, a TypeScript/Vite build, a Playwright core-flow test, a screenshot navigation test at two viewport sizes, and a static-preview load with non-local requests blocked.
**Avoid:** Describing these checks as full acceptance coverage; several required flows remain untested.

### 33. What did you prioritize?
**Model answer:** Clarity, honest UI states, local demonstrability, and a visible path from Instructor action to trainee decision and AAR discussion.
**Avoid:** Claiming every planned subsystem was implemented.

### 34. What was a significant trade-off?
**Model answer:** A CSS map and local fixture flows enabled an offline presentation without adding dependencies, but they are not substitutes for a map engine and event player.
**Avoid:** Saying a shortcut has no limitations.

### 35. What would you do next?
**Model answer:** Implement and test the shared deterministic event player and log first, then connect delivery timing, defaults, DP-2, isolated seat streams, and AAR replay to that source of truth. Add IRON FORD and executable Builder scenarios only after the engine supports them.
**Avoid:** Starting with more visual features while core behavior is still disconnected.

## Judge-style challenges

### 36. “SWORD already supports communications degradation. What is new here?”
**Model answer:** We should not claim novelty without a feature-by-feature comparison. The prototype's current contribution is a transparent, low-friction way to explain the intended decision discussion and how information uncertainty could be reviewed.
**Avoid:** Claiming superiority or exclusivity without evidence.

### 37. Why is IRON FORD shown if it does not run?
**Model answer:** It is a roadmap teaser in the landing UI, not a selectable implemented scenario. The current fixture and tested path are SILENT RIDGE.
**Avoid:** Demonstrating it as if a complete scenario exists.

### 38. What would a real backend need?
**Model answer:** At minimum: an authoritative event scheduler, immutable audit log, scenario versioning, role/seat authorization, synchronization, deterministic replay, deadline handling, and an agreed data protection model. Those are design requirements, not current features.
**Avoid:** Suggesting that adding a database alone would create a reliable simulator.

### 39. How would you prove the system is reliable?
**Model answer:** First define invariants for event order, delivery outcomes, idempotency, branch behavior, and seat isolation; then add deterministic integration tests and independent scenario reviews. User-study claims would need a separate study design.
**Avoid:** Using a visual demo or unit-test count as reliability proof.

### 40. How would you protect against truth leakage?
**Model answer:** Keep truth on the authoritative side and generate each seat's permitted stream through an explicit server-side projection, with authorization tests and serialized-payload checks. The current client-only view is not sufficient for that guarantee.
**Avoid:** Relying on hiding a label or omitting a field from rendered JSX as the final control.

## Resume-style bullets

- Accomplished duplicate-command and duplicate-event handling by adding stable local log IDs and deduplication tests, resulting in covered start/inject flows showing a single log entry.
- Accomplished a clearer exercise introduction by building five fixture-backed field-guide cards with small local demos, resulting in an explorable explanation of report effects, source grades, stream labels, deadlines, and AAR.
- Accomplished a structured local review path by adding a rule-based AAR reel, narrative, information-age marks, and synthetic/unvalidated export metadata, resulting in a review screen grounded in current UI run data and fixture rules.
- Accomplished local scenario-definition editing by adding import, structural checks, session-only save, export, and seeded delay variants, resulting in reproducible definition edits without adding a service; custom definitions are not executable.
- Accomplished repeatable browser evidence capture by adding Playwright navigation across 11 screens at two target resolutions, resulting in 22 screenshots for visual review.

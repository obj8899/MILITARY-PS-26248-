# Manual control inventory

Current control inventory for the local prototype. Controls that only update local presentation or log a command are identified as such; they do not imply a shared simulation backend.

| Screen | Control | Current expected behavior / baseline finding |
| --- | --- | --- |
| Landing | Begin exercise | Opens setup. |
| Landing | Field guide | Opens the field guide. |
| Landing | Judge walkthrough · 90 seconds | Starts a fresh single-window Instructor rehearsal with Auto-Director off and a seven-step progress card. |
| Landing | Seat buttons | Opens the corresponding screen with that seat's scripted feed. |
| Field guide | Step buttons / previous / next | Changes among five fixture-backed interactive cards. |
| Field guide | Demo controls | Adjusts local sample delay/source grade/deadline or toggles generic stream labels; does not change scenario delivery. |
| Field guide | Start Judge walkthrough | Opens the guided Instructor rehearsal. |
| Field guide | Open this station | Opens the related screen. |
| Setup | Presets | Updates the profile preview and logs `SetLinkProfile`; delivery remains fixture-scripted. |
| Setup | Delay/loss/partial/garble sliders | Updates the live sample and logs `SetLinkParam`; delivery remains fixture-scripted. |
| Setup | Decision deadline | Updates the start summary and logs `SetLinkParam`; no live decision clock exists. |
| Setup | Mark all ready | Turns all four single-window seat lamps Ready. |
| Setup | Start Exercise | Idempotently logs CreateSession and BriefIssued, then opens Brief. |
| Brief | Key questions / task organization | Displays local fixture values from `src/fixtures/copy/orders.json`. |
| Brief | Run radio check | Logs a local check and lights the four link indicators; no audio/clock sequence. |
| Brief | Acknowledge | Marks the active seat Ready and opens Instructor; the ready count updates. |
| Instructor | Inject cards | Appends fixture items to T1's feed once per card and deduplicates the run-log view. |
| Instructor | Simulation clock / Pause / Playback speed | A single app-level clock advances while the exercise is started and unpaused; speed changes its simulated seconds per wall-clock second. |
| Instructor | Auto-Director · Rule-based automation | Toggles fixture-timed Jam Net / Spoof beats at H+5/H+8, logs the toggle and FireInject actor, and pauses before DP-1; off by default. |
| Instructor | Advisor · Rule-based automation | Derives up to two advisory prompts from the local run log and triage state; accepting one logs `AdvisorAccepted` and opens the T1 view. |
| Instructor | Run log actor/detail | Shows command/event detail and actor when recorded, including Auto-Director attribution. |
| Trainee | Decision options | Changes selected option. |
| Trainee | Rationale textarea | Editable, but not included in the log. |
| Trainee | Submit decision | Logs the selected option/rationale, records its scripted branch, shows the consequence beat, then opens AAR. |
| AAR | Key moments reel | Selects delayed/dropped/spoof/decision/refutation/consequence moments that have evidence in the run feed and log; missing evidence is omitted. |
| AAR | Previous / Next moment and moment list | Changes the active caption and facilitator prompts. |
| AAR | Facilitator prompts | Reads the local debrief prompt fixture. |
| AAR | Information-age stripe | Shows report-arrival positions and the freshest delivered report age at the last recorded simulated time. |
| AAR | Clear reference comparison | Compares current T1 delivery counts with a stated no-link-effects assumption; it is not a second recorded run. |
| AAR | Export JSON / CSV | Downloads locally generated data with synthetic and unvalidated markers, the narrative, and selected moments. |
| AAR | Print / save PDF | Opens the browser print flow for the visible AAR and complete selected-moment list. |
| AAR | Tabs | Changes among What happened, Why, Indicators, and Sustain / improve. |
| AAR | Fog slider | Changes its value; it remains a visual comparison control, not a changing simulation outcome. |
| AAR | Notes textareas | Editable only; not persisted or logged. |
| AAR | End card | Opens end card. |
| Phase rail | Brief / Setup / Live / Decide / Review | Highlights current phase; later phases are disabled until unlocked. |
| Header | Seat chip | Displays the active role. |
| Header | `?` help | Opens help panel; Start walkthrough opens a four-step coach card. |
| Header | `♪` sound preference | Enables a generated soft Web Audio confirmation tone; the caption is shown on screen. |
| Header | `⋯` rehearsal menu | Opens the old all-screen navigation and local Effects selector; `Shift+R` toggles it. |
| Header | Effects selector | Changes Full / Reduced / Off CSS atmosphere state and stores preference locally. |
| Header | Presenter mode | `Shift+P` toggles enlarged type and presenter hint; rehearsal menu is hidden. |
| Presenter mode | `N` / `Space` / `1–4` | In instructor view, `N` plays the next scripted beat; `Space` pauses/resumes; `1–4` switches Instructor/T1/T2/T3. |
| Map | `L · Legend` | Opens/closes the synthetic map legend. |
| Map | Truth | T1 picture | Toggles a split-view illustration on the instructor map. |
| Map | Mission card | Shows role, goal, present uncertainty, next step and a purpose disclosure. |
| Instructor | Inject buttons | Adds fixture items to the selected seat once per card/seat; repeated clicks are ignored and a toast is shown. |
| Landing / rehearsal menu | Scenario Builder | Opens the local synthetic JSON editor without network access. |
| Scenario Builder | Import JSON file / JSON editor | Loads local text into the editor; imported definitions are not sent over the network. |
| Scenario Builder | Validate & save | Checks the required Scenario structure and keeps a valid custom definition in session state; invalid JSON shows a plain-language error. |
| Scenario Builder | Generate variant | Applies deterministic per-seed delay offsets to existing delivery rules and logs the seed. |
| Scenario Builder | Export JSON | Downloads the saved or currently valid local scenario definition. |
| Scenario Builder | Preview definition | Shows fixture contents and counts; it does not start a custom scenario in the current player. |
| Judge walkthrough | Step card / Skip | Tracks the manual Jam Net → Spoof → T1 → decision → AAR path and may be skipped at any time. |
| End card | Architecture flow | Animates the truth → comms → perceived streams → AAR diagram. |
| End card | Team name / Members and roles | Edits local end-card fill-in text for the current browser session. |
| Trainee | Decision submit | Submits once; repeat submission is disabled. |
| Notification | Show me | Switches to T1; dismiss removes a single toast. |
| Setup | Mark all ready · single-window mode | Changes all seat lamps from Waiting to Ready. |
| Brief | Acknowledge | Marks the active seat Ready and opens the instructor view. |
| Verification | Capture after screenshots | `npm run test:e2e -- --grep "captures every screen"` captures 11 screens at 1920×1080 and 1366×768 into `docs/screens/after/`; this checks screenshot navigation, not every panel's overflow. |

No dependency was added. Scenario delivery remains fixture-driven; local setup profiles are previews and do not recalculate a full event stream. IRON FORD and executable custom scenarios are not available in this build.

# 29 — Upgrade Prompt: Clarity, Immersion and Winning Features (v1, 20 Oct 2026)

**How to use:** open Claude Code in the existing Sudarshan Command Deck project folder (the one built from `28_complete_frontend_simulation_build_prompt.md`). Paste everything between the `=====` lines. No fill-ins are needed. This prompt **upgrades the existing build**; it does not restart it. It keeps every hard rule of file 28 (front end only, offline, synthetic, no scores, honesty label).

**Why this exists:** the current build works but (1) a first-time user does not know what to do on any screen, (2) only the landing page feels premium, and the other screens look like a standard dark dashboard, (3) the instructor map is nearly empty, and (4) it needs features that make judges remember it.

=====

# Upgrade: Sudarshan Command Deck — make it self-explanatory, cinematic and memorable

## 0. Context

The project already exists in this folder: a front-end-only illustrative simulation (Vite + React + TypeScript + Tailwind/shadcn + Zustand + MapLibre + Framer Motion + BroadcastChannel) of a degraded-communications decision trainer for Smart India Hackathon PS 26248. It has a landing page, field guide, setup, orders brief, instructor deck, T1/T2/T3 consoles, AAR and end card, driven by one deterministic event player and fixtures in `src/fixtures/`.

**Do not rebuild it. Audit it, fix it, then upgrade it.** Keep the architecture: one sim clock, one event player, truth and perception as separate streams, all content in fixtures, everything local.

### What the owner observed (screens already reviewed)
1. **Nobody knows what to do.** A row of ten navigation pills (Landing, Field guide, Setup, Brief, Instructor, T1, T2, T3, AAR, End card) is always visible, with no current-step highlight and no "next action". Screens do not say what the user's job is.
2. **Visual inconsistency.** The landing page is premium (serif display type, glowing terrain map, amber CTA). The other screens use a plain sans, default blue slider tracks and flat panels. They look like a different product.
3. **Instructor Command Deck map is nearly empty**: two unlabelled dots and a crosshair on a dark rectangle, no terrain, no legend, no movement. The map's inner box also **overflows its glass panel** (its border runs past the panel's bottom edge).
4. **Run log shows duplicated entries** (`CreateSession` and `BriefIssued` appear twice in a row). That breaks the deterministic-log requirement (file 28 §12 check 2).
5. **Setup screen**: sliders have no unit explanation or preview, every seat shows a green "ready" lamp before anyone has acknowledged, and the Start button is far from the controls.
6. **Orders brief** uses about 40% of the screen and leaves the rest empty; the Acknowledge button is easy to miss in the top-right corner.

Screens not yet reviewed by the owner (T1, T2, T3, AAR, End card, Field guide): audit them yourself in Phase 0 and apply the same standard.

### Non-negotiable rules (carried over from file 28 §1, restated because they are the easiest to break)
- Front end only. No network calls at runtime except local files. Must run offline from `npm run dev` and a static `npm run build`.
- All content synthetic. No real units, operations, places or classified-looking material.
- Truth and perception stay separate. A trainee seat never receives truth-only data or the `fabricated` flag before the AAR. **Every new feature below must respect this**; features marked *Instructor-only* must not be reachable from a trainee window.
- **No scores**: no points, stars, XP, ranks, leaderboards, mission score, accuracy or effectiveness percentages. Descriptive counts, times and distances only, labelled `unvalidated` where they are indicators. The trainee's own confidence slider value is allowed.
- Never write these anywhere in the UI or bundle: "fully working", "production-ready", "deployed", "validated", "AI-powered", "AI", "machine learning", any performance number.
- Keep the corner tag `Illustrative simulation · scripted exercise` on every screen and the full wording on landing and end card.
- **New automation features are rule-based and must be labelled "Rule-based automation".** They read the run log and scripted fixtures. They do not use any model or inference.
- Every visible control does something truthful and logs a command or changes visible state. No decorative buttons.
- Ask before adding any dependency not already in `package.json`. This prompt is designed to need **none**: build coach-marks, effects and audio with React, CSS, canvas and the native Web Audio API.

---

## 1. Phase 0 — Audit and bug fixes (do this first, before any new feature)

1. Write `docs/UPGRADE_PLAN.md`: screen inventory, what each screen does today, the problems found, and the phases below. Do not wait for approval; continue.
2. Use Playwright to capture a screenshot of **every screen at 1920×1080 and 1366×768** into `docs/screens/before/`. List every dead control, overflow, console error and visual inconsistency you find in `docs/UPGRADE_PLAN.md`.
3. **Fix duplicate run-log entries.** Find the root cause (likely candidates: React StrictMode running effects twice, the player being constructed inside a component, or two `CreateSession` dispatches). Fix it properly: the player/store must be a singleton created outside the React lifecycle, `CreateSession` must be idempotent, and the run log must reject a repeated `commandId`. Add a Vitest test and a Playwright test: after a full run, the log contains no duplicate `commandId` and no duplicate `(type, simTime, payload)` event in sequence.
4. **Fix map sizing.** Every MapLibre instance must fill its container exactly, with a `ResizeObserver` calling `map.resize()`; no inner box may exceed its panel at any viewport size, including during window resize and panel collapse.
5. **Unify the design system** (see §3). Replace all default blue slider/focus colours with the palette.
6. Make seat-ready lamps start **grey ("Waiting")** and turn green only when that seat has pressed Acknowledge/Ready (through BroadcastChannel sync, or the single-window "Mark all ready" button).
7. Re-run the file 28 §12 acceptance checks 1–11 and record the result in `docs/IMPLEMENTATION_STATUS.md`. After every later phase, run them again; **no phase may regress them.**

---

## 2. Phase 1 — The clarity system ("I know what to do on every screen")

This is the highest-priority upgrade. Judges often get one minute on the prototype; they must understand it without a person explaining it.

### 2.1 Replace the ten-pill navigation with a phase rail
- Header layout: logo and name on the left; **phase rail** in the centre; on the right a seat chip (who you are: "T1 · Coy Cdr"), a help button (`?`), a sound toggle, and a `⋯` menu.
- Phase rail steps: **1 Brief → 2 Setup → 3 Live exercise → 4 Decide → 5 Review**. Current step highlighted in amber, completed steps ticked, upcoming steps dimmed. Steps are clickable only where it makes sense (going back to review a brief is fine; skipping ahead is not).
- The old ten-pill list moves into the `⋯` menu under **"All screens (rehearsal)"**, so recording and rehearsal still work. It is also reachable with `Shift+R`.
- Every screen has a visible **current-step highlight** and a one-line subtitle under its title saying what the screen is for.

### 2.2 Mission Card on every seat console (and the instructor deck)
A collapsible card docked top-left of the map, fed by `src/fixtures/copy/guidance.json` keyed by (seat, phase, beat). Contents:
- **Your role** in one line ("You are T1, the company commander. You hold the reserve.")
- **Your goal** in one sentence ("Decide where to commit the reserve without a clear picture.")
- **Right now** (dynamic, derived from state, e.g. "T2's link is contested. Their reports may be late, partial or missing.")
- **Next step**, with the matching control pulsing softly (e.g. "Mark the bridge report Verify, then open the decision window.")
- A small "Why am I doing this?" expander that links the step to the training purpose (decide under uncertainty).

The card updates itself as the scenario progresses and never shows truth-only information on a trainee seat.

### 2.3 Spotlight walkthrough (coach marks), built in-house
- First visit to each screen starts a skippable 4–7 step tour: a dimmed overlay with a spotlight cut-out, an arrow, a short plain-language caption and Next / Back / Skip. Role-specific tours for Instructor, T1, T2/T3 and AAR.
- `?` replays the tour; `Esc` closes it. Respect `prefers-reduced-motion`.
- Store "tour seen" in `localStorage` only; failure to read it must not break the app.

### 2.4 Landing: explain the product in ten seconds
Under the headline add a three-step "How an exercise works" strip with small animated icons:
1. **You are the commander.** Reports reach you late, partial or false.
2. **Decide anyway.** Verify, ask, or act before the clock runs out.
3. **See what was true.** The review shows what you knew versus what was real.

Add a **"Judge walkthrough · 90 seconds"** button (see §5.6) next to "Begin exercise".

### 2.5 Glossary tooltips and legends
- Every defence term on screen (SITREP, CONTACT, FUP, FLASH / IMMEDIATE / ROUTINE, source grade A–F, credibility 1–6, white cell, net, DTG, EMCON) gets a dotted underline and a hover/focus tooltip with a one-sentence plain-English meaning (from `fixtures/copy/glossary.json`).
- A **Map legend** panel (toggle `L`): unit symbols, fresh vs ghost enemy, uncertainty ring, contradiction pair "?", air threat, GPS drift trail, link lamp colours (green / amber / red with text), and the cyan truth layer (instructor and AAR only).

### 2.6 Helpful empty and waiting states
Every list or panel that can be empty explains what will fill it and when: "No reports yet. First scheduled report at H+0 in 00:12." Never a blank panel.

### 2.7 Beat notifier
A non-blocking toast stack for important moments ("FLASH report from UAS-1", "Link to T2 degraded", "Decision window opens in 30 s") with a "Show me" button that focuses the map or card. Toasts are visible to the right seats only.

---

## 3. Phase 2 — One design language: "Sudarshan Command Deck", extreme edition

Use the landing page as the reference and bring every screen up to it. Create a short `docs/DESIGN_SYSTEM.md` and implement it as Tailwind tokens and shared components.

### 3.1 Tokens
- Surfaces: near-black green `#070D0B`, deep terrain green panels, glass layers (backdrop blur 12–20 px, 1 px hairline border at 8–12% white, soft inner glow).
- Signal amber `#F5B942` for alerts and primary actions; restrained red `#E5484D` only for danger and lost comms; cyan `#5EEAD4` **only** for the truth layer; text `#E8EFE6` with two lower-contrast tiers. Verify contrast ≥ 4.5:1 for body text.
- Type: **display serif** for hero and brief headlines (as on landing); **condensed uppercase sans** with wide tracking for labels and panel titles; **mono** for DTG, grid refs, callsigns, timers. Use the same three families everywhere. Self-host fonts from the project; no CDN. If a font package must be added, ask first.
- Radius, spacing and shadow scales defined once. Replace default form controls: amber slider tracks with a numeric readout and unit, custom toggles and selects.

### 3.2 Atmosphere layer (shared `<Atmosphere />` component)
- Soft vignette, subtle SVG film grain, faint tactical grid, very light scanlines on map surfaces only.
- **Signal interference overlay** (canvas or CSS): intensity follows the **viewed seat's current link quality**. Clear = none. Contested = occasional horizontal tear and noise bursts. Heavily jammed = constant static with brief chromatic-aberration glitches. A `Jam Net` inject triggers a visible 600 ms glitch on the affected seat.
- Effects mode in settings: **Full / Reduced / Off**; `prefers-reduced-motion` defaults to Reduced. Visual-only randomness must use a **separate non-logged RNG** that never touches the run log or script delivery.
- Keep 60 fps at 1366×768 on an integrated GPU: no full-screen backdrop blur over the live map, limit canvas redraws, test it.

### 3.3 Motion language
- Panels slide and fade in with spring easing; report cards "land" with a short settle; FLASH traffic flies the map to the location and pulses the card border amber.
- Numbers tick (counters, age chips); lamps glow and pulse with their state; buttons have pressed states with a 60 ms response.
- Screen-to-screen transitions are cinematic (zoom through the map, then cross-fade to the next panel).

### 3.4 Audio (optional, mute button, captions)
Generate all sounds with the **native Web Audio API** so there are no files and no licences: radio squelch (bandpassed noise burst), static bed whose volume follows link degradation, FLASH two-tone, countdown tick, low "heartbeat" thump in the last 30 s of a decision window, soft UI ticks. Every sound has an on-screen caption when captions are on. Default volume low; audio starts only after the first user click.

---

## 4. Phase 3 — Screen-by-screen redesign

### 4.1 Landing
Keep the strong hero. Add the "How an exercise works" strip (§2.4), seat cards that explain each role in one line ("T1 · Company Commander — decides under pressure"), "Open all seats", "Single-window mode", and the Judge walkthrough button. The scenario list shows the two scenarios with a difficulty descriptor ("Moderate friction", "High friction"): descriptive text only.

### 4.2 Orders brief (cinematic)
- Full-screen layout: left, a typed-out OPORD (situation, mission, commander's intent, H-hour, with a short **"Key questions"** box: *What do I know? What am I unsure of? Who can I trust?*); right, a map showing mission graphics (objective FORD, boundaries, FUP, axis arrows, N BRIDGE, RIDGE) with a slow fly-over.
- **Task organisation** strip (Coy HQ, Pl 1, Pl 2, UAS, reserve) with callsigns.
- Countdown to H-hour and a **Radio check** step: pressing it lights each link lamp in sequence with squelch.
- A large **Acknowledge** button at the bottom, always visible, with a ready-count ("2 of 4 seats ready").

### 4.3 Instructor setup
- Two columns plus a sticky bottom action bar (**Start Exercise** at bottom-right, with a one-line summary of what will start).
- Every slider shows value and unit ("Delay · 4 min"), a one-line meaning, and a **live sample report** that shows how a real report would arrive under the current settings (late / missing fields / garbled words).
- Preset chips show a short description on hover. A descriptive **"Friction level"** label (Low / Moderate / High) is derived from the sliders and explains itself in one line. No numbers or scores.
- "What your trainees will experience" summary panel, written in plain language from the current profile.
- Seat readiness list with Waiting / Ready states and a single-window "Mark all ready".

### 4.4 Instructor Command Deck (the screen judges will actually use)
Three-zone layout:
- **Left — Director's script:** a vertical timeline of scripted beats (upcoming / now / done) from the fixture, each with a plain-language description and a **suggested inject time** ("Suggested at H+5: Jam Net on T2→T1"). A **Play** button fires the matching inject. A banner states what is next.
- **Centre — Truth map (rich):** full terrain (contours, hillshade-style shading, river, FORD, N BRIDGE, RIDGE, woods, tracks, grid, scale bar, compass, cursor coordinates), labelled friendly and enemy units that **move along tracks** according to `truthTimeline`, movement trails, and a layer panel: Truth, T1 / T2 / T3 perceived overlay, and **Picture gap** (draws a thin line from where a seat believes a unit is to where it really is, with the distance in metres). A split view **Truth | selected seat's perceived picture** with a draggable divider (works in single-window mode).
- **Right — Inject deck and links:** inject cards with icon, one-line effect, and target seat chosen at play time; link-health matrix with lamps, current profile, delivered / dropped / delayed counts, and a "quick profile" dropdown per link.
- **Bottom dock with tabs:** *Live decisions* (as in file 28 §7 S3, with "Information held" chips and truth-comparison chip), *Traffic* (every message and its fate), *Run log*, and **Signal path** (§5.2).
- A top status strip: sim clock in DTG, speed controls, Pause/Resume, "Auto-Director" switch (§5.3), End Exercise.

### 4.5 Trainee console (T1, T2, T3)
- Layout: perceived map ≥ 55% of the screen; Mission Card top-left; radio-net dock on the right; link status strip and comms-actions tray along the bottom.
- **Radio-net feed** upgrades: callsign, precedence badge, DTG, source grade and credibility chips, ticking age chip, sent/received times, `[BROKEN]` garbled words with a glitch effect, `—` for missing fields, a tiny waveform that animates on arrival, and **proword quick replies** (ROGER, SAY AGAIN, WILCO, STAND BY, OUT) for the team net.
- **Triage cards**: Trust / Verify / Discard and pin-to-map as in file 28, with a visible state on each card and on the map marker.
- **Stale information fades**: as a report's age grows, its map marker desaturates and its uncertainty ring expands; contradicting reports are linked by a dotted line with "?".
- **Comms actions tray** with the trade-off written plainly on each button: *Switch frequency* ("Restores the link after about 3 min; scripted enemy EW may follow"), *Send runner* ("Never jammed, arrives in about 9 min"), *Re-task UAS* ("New report in about 4 min"), *Request EW check* and *Verify source authentication* (scripted cyber/EW actions that return a scripted answer after a delay). Each logs a command.
- **Decision Window** (cinematic): when the decision point opens, the background desaturates slightly, a circular countdown ring appears with the stated default ("If you do nothing: Hold at the ford"), the last 30 s adds an amber edge pulse and heartbeat tick. Contents as in file 28 (options, cited-basis tick-list, rationale, confidence) plus a plain **"What do I currently know?"** panel summarising the reports held, their ages and grades. Submit logs `SubmitDecision` and starts the branch.
- **Consequence beat** after Submit: a 5–8 s animated sequence on the map with a caption ("H+17 · UAS confirms enemy at the ford. N BRIDGE is clear.") before the console returns to live. Skippable.
- T2/T3: same component, own perceived stream, CONTACT/SITREP forms, NO COMMS banner with a queued-message counter, GPS drift trail on T3 in IRON FORD.

### 4.6 AAR (make it the star)
Keep the four tabs from file 28 and add:
- **Key moments reel:** the AAR picks 5–6 moments from the run log by fixed rules (first delayed report, first dropped report, spoof delivered, decision submitted, first refutation, branch consequence) and plays them as a short guided replay with captions. Rule-based; the selection rules are listed in `docs/AAR_RULES.md`.
- **Information-age stripe:** for each seat, a horizontal strip over sim time showing how old that seat's freshest relevant report was (descriptive, in minutes).
- **Narrative summary:** a plain-language paragraph for each decision, composed from templates filled with run-log facts ("T1 decided at H+11 holding reports aged 4–11 minutes; the N BRIDGE report was fabricated and was marked Verify."). Label: *Rule-based summary from this run's log.*
- **Debrief prompts:** for each key moment, two facilitator questions drawn from a fixture (guided discovery: "What did you know at this point? What would have changed your picture sooner?"). No right/wrong grading.
- **Compare runs (promote from optional):** Clear vs Contested of the same scenario side by side using the descriptive indicators only.
- Exports stay as in file 28 (JSON, CSV, print-to-PDF) with `synthetic: true`, `illustrativeSimulation: true`, `validity_status: "unvalidated"`; add the key-moments list and narrative to the JSON and PDF.

### 4.7 Field guide and end card
- Field guide becomes **five interactive cards** (one idea each: comms effects, source grades, truth vs perception, deadlines and defaults, the AAR) with a tiny live demo inside each card (e.g., a slider that delays a sample report). Finish with a "Start Judge walkthrough" button.
- End card keeps the honest two-column "Built / Next" layout and adds an animated architecture diagram (truth stream → comms effects → perceived streams → AAR). Add the team fill-ins that already exist.

---

## 5. Phase 4 — Features designed to make judges remember it

### 5.1 Seat peek (Instructor-only)
A floating, resizable mini-window on the instructor deck showing the selected trainee's **live perceived map and last three reports**. In single-window mode this lets one person see both sides at once.

### 5.2 Signal path visualiser (Instructor-only, in the bottom dock)
Click any message in the traffic monitor to see an animated path: *Sender → Comms effects layer → Recipient*. Inside the effects layer, small meters show delay, loss, partial and garble applied to that message, ending in its fate (delivered late / dropped / partial / garbled). This makes the core idea visible: **the instructor's settings change what the commander perceives.** Data comes from the run log and `delivery` fields.

### 5.3 Auto-Director (Rule-based automation)
A switch on the instructor deck. When on, the Director plays scripted beats at their suggested times, pauses before each decision point and resumes on submission or default. It uses only the fixture timeline; it logs every inject as a `FireInject` command attributed to "Auto-Director". Off by default in live play; used for demos and hands-free recording.

### 5.4 Inject Advisor (Rule-based automation, Instructor-only)
A small panel that shows 0–2 suggestions from fixed rules over the run log, each with the rule that fired and a one-click action:
- "T1 has not verified the contradicting report 3 min after delivery. Consider restoring the UAS link."
- "T2's link has been contested for 6 min. Consider Switch frequency prompt."
- "Decision window closes in 60 s; no cited basis ticked yet."
Suggestions are advisory, never applied automatically, and are shown in the run log if accepted. Do not call it intelligent or AI; call it "Advisor (rule-based)".

### 5.5 Scenario Builder (fixture-backed, local)
A new screen from the `⋯` menu and the landing page:
- Pick a synthetic map, drag units on it, define links and profiles, add timed report cards (text, sender, recipients, precedence, grade, credibility, delivery effects) on a timeline, define one decision point with options and branch segments.
- **Validate** against the `Scenario` type and show errors in plain language; **Preview** runs it in single-window mode; **Export/Import JSON**. Saved scenarios appear on the landing page list as "Custom".
- **Generate variant** button: seeded procedural variation of delays/loss/order for an existing scenario; the seed is shown and logged so the same seed gives the same result. Label: *Rule-based variant from seed.*

### 5.4a Second decision point
Add **DP-2** to SILENT RIDGE (after the branch consequence) with its own countdown, default and branches so that the first choice visibly changes what the second looks like (Commit north → "bridge now contested, ford lost"; Hold → "enemy probe, reserve intact"; Re-task → "enemy repositions toward RIDGE"). Everything is scripted in the fixture; no new engine logic.

### 5.6 Judge walkthrough (90 seconds, guided)
A button on landing. It opens single-window mode as **Instructor**, with Seat peek on T1, and guides the judge with coach marks: "Tap Jam Net → watch T1's reports go late → tap Spoof Contact → see the contradiction on T1's map → switch to T1 and decide → open the review." Auto-Director is off; the judge does the actions. A progress meter ("Step 3 of 7") and a Skip button are always visible. Ends on the AAR key moments reel.

### 5.7 Hindi labels (optional, P2)
Language toggle (EN / हिं) for headings, buttons and mission cards via `fixtures/copy/i18n/`. Keep military terms in English where used in the field. Include only if time remains after everything else passes.

### 5.8 Presenter mode
`Shift+P` toggles **Presenter mode**: hides the rehearsal menu, enlarges type 10%, shows a small hotkey hint ("N: next beat · Space: pause · 1–4: seat"), and keeps the honesty tag visible. Keep the existing jump-to-next-beat hotkey rehearsal-only.

---

## 6. Content and fixtures changes
- Add `fixtures/copy/guidance.json`, `glossary.json`, `debrief-prompts.json`, `consequences.json` (captions for each branch), and `director-beats.json` (suggested inject times). No scenario text hard-coded in components.
- Extend the `Scenario` type only where needed (`decisionPoints[]` for DP-2, `branches[]`, optional `guidanceKey`). Keep the `StreamEvent` and `Command` envelopes unchanged so the front end can still be switched to a real server later.
- New command types: `AdvisorAccepted`, `AutoDirectorToggled`, `ScenarioImported` (all logged; none needed on trainee seats).
- Update `THIRD_PARTY.md` if anything is added (it should not be).

---

## 7. Accessibility and performance
- All new controls reachable by keyboard with visible focus; tour steps announced with `aria-live`; every icon labelled; no information conveyed by colour alone (lamps also show text).
- Effects mode (Full / Reduced / Off); Reduced is the default under `prefers-reduced-motion`.
- Usable at 1366×768 as well as 1920×1080. Target: no layout shift when panels collapse; map interactions stay smooth.
- Lighthouse accessibility ≥ 90 and performance ≥ 85 on the built app (measure locally; do not print the numbers in the UI).

---

## 8. Build order (follow in this order; the deliverable includes all of it)

1. **Phase 0 audit and fixes:** screenshots, duplicate-log fix, map resize fix, seat-ready lamps, baseline acceptance run.
2. **Design tokens and shared components:** palette, type, sliders, toggles, panels, `Atmosphere`, motion presets, effects-mode setting.
3. **Header and phase rail:** replace the pill row, add the seat chip, help, sound toggle and `⋯` menu with "All screens (rehearsal)".
4. **Guidance system:** Mission Card, glossary tooltips, legend, empty states, beat notifier, coach-mark engine with the five tours.
5. **Map upgrade:** rich synthetic terrain on all maps, movement along tracks, trails, picture-gap lines, stale-information fade, split view.
6. **Brief and setup redesign:** cinematic brief with radio check; setup with live sample report, friction label and sticky Start bar.
7. **Instructor Command Deck redesign:** three-zone layout, Director's script, inject deck, link matrix, bottom dock, Seat peek, Signal path.
8. **Trainee consoles:** radio-net upgrades, prowords, comms actions with trade-offs, Decision Window, consequence beat, DP-2.
9. **AAR upgrades:** key moments reel, information-age stripe, narrative, debrief prompts, compare runs, updated exports.
10. **Automation and builder:** Auto-Director, Inject Advisor, Scenario Builder with import/export and variant generator.
11. **Judge walkthrough, Presenter mode, field guide cards, end card animation, audio via Web Audio, optional Hindi labels.**
12. **Verification:** unit tests, Playwright acceptance (below), manual control inventory, offline static build, bundle string grep, screenshots in `docs/screens/after/`, rehearsal of the two-minute video path and the 90-second Judge walkthrough.

**Scope rule:** if time is tight, simplify the internal implementation, not the visible features. The one allowed cut order, last item cut first: Hindi labels → Scenario Builder variant generator → Compare runs → Inject Advisor → animated end-card diagram. Everything else stays.

---

## 9. Acceptance checks (all must pass; keep the 11 checks from file 28 and add these)

12. Run log has **no duplicate commands or events** after a full run, in dev (StrictMode) and in the static build.
13. Every map resizes cleanly with the window and with panel collapse; no element overflows its panel at 1920×1080 or 1366×768.
14. On each screen the phase rail highlights the current step and the Mission Card shows a correct "Next step" for that screen and beat (Playwright checks the text for the Brief, Setup, Live and Decision states).
15. The coach-mark tour for each role completes, can be skipped and replayed with `?`, and never reveals truth-only data on a trainee seat.
16. Seat-ready lamps start grey and turn green only after Acknowledge/Ready.
17. **No truth leakage** from the new features: Seat peek, Signal path, Picture gap, Director's script, Inject Advisor, Auto-Director and Scenario Builder are not reachable from a trainee window, and a test asserts T1's window contains no truth-only entity or `fabricated` flag after a full run with all of them active elsewhere.
18. Auto-Director plays the SILENT RIDGE beats and produces the **same run log** as the manual §8.3 click path except for the `actor: "Auto-Director"` field.
19. DP-2 branches work for all three DP-1 outcomes and a missed deadline applies the default.
20. The Signal path view for any dropped, delayed, partial and garbled message shows the matching fate and parameters from the log.
21. Key moments reel selects the documented moments for both scenarios and its captions match the run log; exports include them and keep `illustrativeSimulation: true`.
22. Scenario Builder: a scenario built, exported and re-imported runs end to end; an invalid scenario shows a plain-language error; the same variant seed gives the same result.
23. Reduced-motion and Effects: Off remove glitches, scanlines and tears while keeping all information visible.
24. A built-bundle grep finds none of: "fully working", "production-ready", "deployed", "validated", "AI-powered", " AI ", "accuracy", "score", "points", "leaderboard", "XP". (Allowed: the trainee confidence value, and the word "unvalidated".)
25. No console errors across the two-minute path, the 90-second Judge walkthrough and an IRON FORD run; offline static build works with network disabled.

---

## 10. Documents to produce at the end (required)

1. `docs/PROJECT_DESCRIPTION.md` — a detailed project description written for interview and judging preparation: the problem and who it is for; why degraded-communication training matters; what the prototype shows versus what the real product would do (be explicit about what is mocked); the architecture (event player, streams, run log, truth vs perception, branch resolver); design decisions and trade-offs; the honesty approach; accessibility; the roadmap; a glossary; and a plain-language "how to explain this in 60 seconds / 5 minutes".
2. `docs/INTERVIEW_QUESTIONS.md` — at least 35 likely questions with short model answers and the points to avoid, grouped as: concept (e.g. "What is immersive about this?", "How is this different from existing simulators?"), technical (event-driven design, determinism, why local fixtures, BroadcastChannel sync, how truth leakage is prevented), design (why no scores, why rule-based), honesty and limits ("Is this a working product?", "Is AI used?", "How is it validated?", "What would the real backend need?"), teamwork and process (building with an AI coding tool, testing, what you would do next), and judge-style challenges ("SWORD already does comms degradation, so what is new?"). Also include 4–5 resume-style bullets for the project in the format "Accomplished X by doing Y, resulting in Z", using only facts that are true of the build.
3. `docs/DEMO_SCRIPT.md` — the exact two-minute video path, a five-minute live judge demo, and a one-page cheat sheet of answers.
4. `docs/IMPLEMENTATION_STATUS.md` and `tests/MANUAL.md` updated for every new control, and `docs/screens/before/` and `docs/screens/after/`.

## 11. How to work
- Start with `docs/UPGRADE_PLAN.md`, then Phase 0. **Do not stop after the plan or after Phase 0**; continue through every step in §8 without waiting for approval, unless a real blocker needs a question.
- Work in small increments. After each step run the Vitest and Playwright tests, fix regressions, and update `docs/IMPLEMENTATION_STATUS.md` with what is done, what is partly done and what is next.
- Keep one event player and one clock. Never let a new component set its own scenario timers.
- Do not claim a test was run if it was not. At the end, give run instructions, a feature-by-feature status list, honest limitations, test results, and the exact click paths for the two-minute video and the 90-second Judge walkthrough.

=====

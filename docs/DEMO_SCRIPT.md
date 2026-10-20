# Sudarshan Command Deck — demo script

## Two-minute video path

Use SILENT RIDGE. Keep the `Illustrative simulation · scripted exercise` label visible, and state that link-profile controls preview the condition while scripted fixture data supplies the report outcomes. The timing below is an editing/storyboard target, not a claim that the current app has a real-time two-minute scenario engine.

| Video time | Screen and action | Suggested narration |
| --- | --- | --- |
| 0:00–0:08 | **Landing.** Hold long enough to show the honesty label and synthetic scenario. Click **Begin exercise**. | “This is an offline, illustrative decision-training prototype. The exercise content is synthetic and scripted.” |
| 0:08–0:20 | **Setup.** Select **Contested** if it is not already selected. Click **Mark all ready · single-window mode**, then **Start Exercise**. | “The instructor can preview communication friction and confirm readiness. The fixture still defines these report outcomes.” |
| 0:20–0:28 | **Brief.** Show the key questions and synthetic task organization. Click **Acknowledge**. | “The brief frames the decision: what is known, what is uncertain, and who can be trusted?” |
| 0:28–0:43 | **Instructor.** Show the Director's script and synthetic map. Click **Jam Net** once. | “The instructor adds a scripted communications effect. This is a local demonstration, not a live radio network.” |
| 0:43–0:57 | Click **Spoof Contact**. Open **⋯ → T1**. | “A second scripted report creates a contradiction for the trainee to consider.” |
| 0:57–1:15 | **T1 console.** Point to report source/grade/delay and the contradiction marker. Click **Verify** on the **ADJACENT REPORT** card. Keep the current **Re-task UAS first** option and the rationale visible. Click **Submit decision**. | “T1 sees a seat-specific feed, records a verification action, and explains a decision with a cited basis and personal confidence.” |
| 1:15–1:23 | In the consequence overlay, click **Skip to review** if needed; otherwise let the short scripted beat end. | “The consequence is a scripted caption, not a simulated operational outcome.” |
| 1:23–1:47 | **AAR.** Show the rule-based key-moments reel. Use **Next moment** to reach the decision and branch-consequence captions. Point out the information-age section and the note that the clear reference is an assumption. | “The review selects moments from this local run's feed and log. Its indicators are descriptive and unvalidated; the comparison is not a separately recorded run.” |
| 1:47–2:00 | Click **End card**. Show **Built in this prototype / Next in our roadmap** and the architecture animation. | “The prototype demonstrates the interaction path. A complete event player, synchronization, additional scenarios, and executable custom scenarios remain roadmap work.” |

### Exact click sequence

`Begin exercise` → `Contested` (if needed) → `Mark all ready · single-window mode` → `Start Exercise` → `Acknowledge` → Instructor `Jam Net` → Instructor `Spoof Contact` → `⋯` → `T1` → `Verify` on `ADJACENT REPORT` → `Submit decision` → `Skip to review` (if visible) → AAR `Next moment` until `Branch consequence` → `End card`.

The Judge/field-guide coach card may appear on first visits. Use its **Skip** button to keep the recording path moving. Do not claim that the profile slider dynamically changes the fixture delivery or that the consequence is a complete branch simulation.

## Five-minute live Judge demo

### 0:00–0:40 — State the boundary

Open the landing page and point to the honesty label and SILENT RIDGE card. Say: “This is a local, synthetic, scripted front-end prototype. It demonstrates the interaction and training discussion, not a complete simulation backend.” Mention that IRON FORD is shown as a next exercise but is not implemented as a scenario fixture.

### 0:40–1:20 — Setup and brief

Click **Begin exercise**, show the Contested profile preview and Waiting lamps, then click **Mark all ready** and **Start Exercise**. In the brief, point to the key questions and callsign strip. Click **Acknowledge**. Note that settings remain previews and the authored fixture determines report outcomes.

### 1:20–2:15 — Instructor effects

On the Instructor screen, identify the synthetic terrain, script list, inject deck, and run-log tabs. Click **Jam Net**, then **Spoof Contact**. Explain that the controls create local feed/log changes and do not represent a live network or complete event scheduler.

### 2:15–3:15 — T1 decision

Open **⋯ → T1**. Show the report cards, grade, delay, contradiction marker, and mission card. Click **Verify** for the adjacent report. Keep or select **Re-task UAS first**, show the rationale, cited reports, and confidence slider, then click **Submit decision**. Use **Skip to review** if the consequence overlay is still visible.

### 3:15–4:20 — AAR discussion

Step through the key-moments reel. Ask: “What did T1 know at this point? Which report needed verification? What information would have changed the decision?” Point out the run-based narrative, information-age marks, current-versus-clear assumption, and export markers. Clarify that the indicators are unvalidated and that no second run was recorded for the comparison.

### 4:20–5:00 — Roadmap and questions

Open **End card**. Explain that a complete deterministic event player, authoritative run log, multi-window synchronization, IRON FORD, DP-2/default handling, and execution of custom Builder scenarios are future work. Invite questions about how those should be specified and tested before adding further visual polish.

## Judge walkthrough · 90-second rehearsal

1. From **Landing**, click **Judge walkthrough · 90 seconds**. The app opens a fresh single-window Instructor rehearsal, starts SILENT RIDGE, selects T1 as the inject target, and leaves Auto-Director off.
2. Follow the progress card. Click **Jam Net**, then **Spoof Contact** on the Instructor screen.
3. Open **⋯ → T1**. Verify the adjacent report and submit the selected decision.
4. Let the consequence beat reach AAR, or choose **Skip to review**.
5. Use **Next moment** once in the AAR reel to advance the tracked walkthrough step. The end state remains the AAR key-moments reel.
6. **Skip walkthrough** is available throughout. `?` opens the generic coach card; it is not a second full scripted Judge walkthrough.

The walkthrough has a seven-step progress card and manual action tracking. It has been tested for launch and skip in Playwright, but a complete 90-second rehearsal has not been recorded or timed.

## One-page answer cheat sheet

| Judge asks | Concise answer |
| --- | --- |
| What does it do? | Demonstrates a scripted decision exercise with late, incomplete, or contradictory reports and a local review path. |
| Who is it for? | The intended users are exercise facilitators and junior/mid-level commanders; this build is a prototype. |
| Is it a real simulator? | No. It is an interactive front end with local fixtures and partial local state, not a complete event engine or backend. |
| Is AI used at runtime? | No. Auto-Director and Advisor are rule-based; there is no model inference in the app. |
| Does the profile slider change every report? | No. It previews the profile; report outcomes are scripted in the fixture. |
| Is there multiplayer? | Not in this build. Seat switching is single-window; cross-window synchronization remains future work. |
| Does the AAR measure performance? | No. It presents descriptive, unvalidated indicators and facilitator questions; there are no grades or leaderboards. |
| Is IRON FORD available? | It is shown as a future exercise; only SILENT RIDGE has the current fixture-backed path. |
| Does the Builder run custom scenarios? | No. It edits, checks, saves, and exports a local definition, but the player does not execute it. |
| What is next technically? | Build and test the authoritative deterministic event player, then connect delivery timing, branch/default handling, isolated streams, synchronization, and AAR replay. |

## Local run and verification

From the project folder, run `npm run dev` and open the local URL printed by Vite. If the default port is occupied, use `npm run dev -- --host 127.0.0.1 --port 5174`. Verification commands: `npm test`, `npm run build`, and `npm run test:e2e`.

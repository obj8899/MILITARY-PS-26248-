import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Atmosphere, type EffectsMode } from "./components/Atmosphere";
import guidanceCopy from "./fixtures/copy/guidance.json";
import glossary from "./fixtures/copy/glossary.json";
import ordersCopy from "./fixtures/copy/orders.json";
import consequenceCopy from "./fixtures/copy/consequences.json";
import directorBeats from "./fixtures/copy/director-beats.json";
import debriefPrompts from "./fixtures/copy/debrief-prompts.json";
import fieldGuideCards from "./fixtures/copy/field-guide.json";
import judgeWalkthrough from "./fixtures/copy/judge-walkthrough.json";
import { createAarExportData, createAarNarrative, selectAarKeyMoments, toAarCsv } from "./aar/analysis";
import { deriveAdvisorSuggestions } from "./automation/rules";
import { generateSeededVariant, parseScenarioDefinition } from "./builder/validation";
import {
  buildRunLogFromScenario,
  computeDeliveryOutcome,
  getBriefSummary,
  getDecisionPoint,
  getInitialT1Messages,
  getInject,
  getScenarioItemsForSeat,
  listDecisionOptions,
  resolveDecisionBranch,
  scenario,
} from "./player/simulation";
import type { Scenario, ScenarioItem } from "./contracts";

type Screen = "landing" | "guide" | "setup" | "brief" | "instructor" | "t1" | "t2" | "t3" | "aar" | "end" | "builder";
type Seat = "Instructor" | "T1" | "T2" | "T3";
type UiLogEntry = {
  title: string;
  kind: "command" | "event";
  detail: string;
  commandId?: string;
  eventId?: string;
  actor?: string;
  simTime?: number;
};

const guideScreenTargets: Screen[] = ["instructor", "t1", "t1", "t1", "aar"];

type FeedEntry = {
  id: string;
  source: string;
  text: string;
  precedence: string;
  grade: string;
  credibility: number;
  location: string;
  simOffset: number;
  fields: Record<string, string>;
  garbled: boolean;
  outcome: ReturnType<typeof computeDeliveryOutcome>;
};

type TraineeSeat = "T1" | "T2" | "T3";

function toFeedEntry(item: ScenarioItem, seatId: TraineeSeat): FeedEntry {
  const delivery = item.delivery[seatId] ?? item.delivery.T1 ?? {
    delayMin: 0,
    drop: false,
    partialFields: [],
    garble: false,
  };
  return {
    id: item.id,
    source: item.from,
    text: item.text,
    precedence: item.precedence ?? "ROUTINE",
    grade: item.sourceGrade ?? "C",
    credibility: item.credibility ?? 3,
    location: item.location ? `${item.location[0].toFixed(3)} ${item.location[1].toFixed(3)}` : "FORD",
    simOffset: item.simOffset,
    fields: item.fields,
    garbled: delivery.garble,
    outcome: computeDeliveryOutcome({
      fields: item.fields,
      delayMin: delivery.delayMin,
      drop: delivery.drop,
      partialFields: delivery.partialFields,
      garble: delivery.garble,
      text: item.text,
    }),
  };
}

function GlossaryTerm({ term, children }: { term: keyof typeof glossary; children: ReactNode }) {
  return <abbr className="glossary-term" title={glossary[term]}>{children}</abbr>;
}

const seatViewFromKey: Record<string, Screen> = {
  Instructor: "instructor",
  T1: "t1",
  T2: "t2",
  T3: "t3",
};

const phaseSteps = [
  { label: "Brief", target: "brief" as Screen },
  { label: "Setup", target: "setup" as Screen },
  { label: "Live exercise", target: "instructor" as Screen },
  { label: "Decide", target: "t1" as Screen },
  { label: "Review", target: "aar" as Screen },
];

const rehearsalScreens: { label: string; target: Screen }[] = [
  { label: "Landing", target: "landing" },
  { label: "Field guide", target: "guide" },
  { label: "Setup", target: "setup" },
  { label: "Brief", target: "brief" },
  { label: "Instructor", target: "instructor" },
  { label: "T1", target: "t1" },
  { label: "T2", target: "t2" },
  { label: "T3", target: "t3" },
  { label: "AAR", target: "aar" },
  { label: "End card", target: "end" },
  { label: "Scenario Builder", target: "builder" },
];

const phaseIndexForScreen: Record<Screen, number> = {
  landing: 0, guide: 0, brief: 0, setup: 1,
  instructor: 2, t2: 2, t3: 2, t1: 3, aar: 4, end: 4, builder: 0,
};

const screenSubtitles: Record<Screen, string> = {
  landing: "Choose a scenario and station to begin.",
  guide: "Learn what each station asks you to do.",
  setup: "Set the communication conditions for this scripted run.",
  brief: "Review the orders and acknowledge when you are ready.",
  instructor: "Introduce scripted events and observe what each seat receives.",
  t1: "Review your reports and record a decision with its rationale.",
  t2: "Review your reports and share observations with the team.",
  t3: "Review your reports and share observations with the team.",
  aar: "Review the exercise picture and the reports available to each seat.",
  end: "See what this prototype demonstrates and what remains on the roadmap.",
  builder: "Edit, validate, and export a local synthetic scenario definition.",
};

function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [exerciseStarted, setExerciseStarted] = useState(false);
  const [seat, setSeat] = useState<Seat>("T1");
  const [selectedScenario] = useState("silent-ridge");
  const [customScenario, setCustomScenario] = useState<Scenario | null>(null);
  const [builderText, setBuilderText] = useState(() => JSON.stringify(scenario, null, 2));
  const [builderSeed, setBuilderSeed] = useState(26248);
  const [builderStatus, setBuilderStatus] = useState("");
  const [builderPreviewOpen, setBuilderPreviewOpen] = useState(false);
  const [aarTab, setAarTab] = useState<"what" | "why" | "indicators" | "sustain">("what");
  const [aarMomentIndex, setAarMomentIndex] = useState(0);
  const [aarExportStatus, setAarExportStatus] = useState("");
  const [fogLevel, setFogLevel] = useState(68);
  const [runLog, setRunLog] = useState<UiLogEntry[]>(buildRunLogFromScenario());
  const sessionStarted = useRef(false);
  const decisionSubmittedRef = useRef(false);
  const appliedInjects = useRef(new Set<string>());
  const commandSequence = useRef(0);
  const [profileName, setProfileName] = useState("Contested");
  const [profileValues, setProfileValues] = useState({ delay: 4, loss: 25, partial: 30, garble: 30 });
  const [decisionDeadline, setDecisionDeadline] = useState(6);
  const [radioCheckComplete, setRadioCheckComplete] = useState(false);
  const [readySeats, setReadySeats] = useState<Seat[]>([]);
  const [effectsMode, setEffectsMode] = useState<EffectsMode>(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "Reduced"
        : (localStorage.getItem("sudarshan-effects") as EffectsMode) || "Full";
    } catch {
      return "Reduced";
    }
  });
  const [seatFeeds, setSeatFeeds] = useState<Record<TraineeSeat, FeedEntry[]>>(() => ({
    T1: getInitialT1Messages().map((item) => toFeedEntry(item, "T1")),
    T2: getScenarioItemsForSeat("T2").map((item) => toFeedEntry(item, "T2")),
    T3: getScenarioItemsForSeat("T3").map((item) => toFeedEntry(item, "T3")),
  }));
  const t1Feed = seatFeeds.T1;
  const [selectedCard, setSelectedCard] = useState<string | null>("JAM_NET");
  const [targetSeat, setTargetSeat] = useState<TraineeSeat>("T1");
  const [triageStatus, setTriageStatus] = useState<Record<string, string>>({});
  const [decisionChoice, setDecisionChoice] = useState<string>("retask-uas");
  const [decisionSubmitted, setDecisionSubmitted] = useState(false);
  const [decisionRationale, setDecisionRationale] = useState("We have a delay and a spoofed witness, so re-tasking the UAS is the least-risk option.");
  const [confidence, setConfidence] = useState(60);
  const [citedReports, setCitedReports] = useState<string[]>([]);
  const [showConsequence, setShowConsequence] = useState(false);
  const consequenceTimer = useRef<number | null>(null);
  const [teamMessage, setTeamMessage] = useState("");
  const [guideStep, setGuideStep] = useState(0);
  const [guideDelay, setGuideDelay] = useState(2);
  const [guideGrade, setGuideGrade] = useState("B");
  const [guideStreamsShown, setGuideStreamsShown] = useState(false);
  const [guideDeadline, setGuideDeadline] = useState(6);
  const [judgeWalkthroughActive, setJudgeWalkthroughActive] = useState(false);
  const [judgeWalkthroughStep, setJudgeWalkthroughStep] = useState(0);
  const [teamName, setTeamName] = useState("Sudarshan Command Deck");
  const [teamRoles, setTeamRoles] = useState("Team members and roles");
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioCaption, setAudioCaption] = useState("");
  const audioContext = useRef<AudioContext | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [splitMap, setSplitMap] = useState(false);
  const [instructorDock, setInstructorDock] = useState<"decisions" | "traffic" | "runlog" | "signal">("decisions");
  const [selectedTrafficId, setSelectedTrafficId] = useState<string | null>(null);
  const [playerPaused, setPlayerPaused] = useState(false);
  const [playerSpeed, setPlayerSpeed] = useState<1 | 4 | 10>(1);
  const [simTimeSeconds, setSimTimeSeconds] = useState(0);
  const [autoDirectorEnabled, setAutoDirectorEnabled] = useState(false);
  const [advisorAccepted, setAdvisorAccepted] = useState<string[]>([]);
  const autoPausedForDecision = useRef(false);

  const truthFacts = useMemo(() => scenario.truthTimeline.flatMap((entry) => entry.facts), []);
  const refutedReportIds = scenario.aarNotes.filter((note) => note.category === "false").map((note) => note.reportId);
  const keyMoments = selectAarKeyMoments(t1Feed, runLog, triageStatus, refutedReportIds);
  const decisionLog = runLog.find((entry) => entry.kind === "command" && entry.title === "SubmitDecision");
  const aarNarrative = createAarNarrative(decisionLog, t1Feed);

  const playUiTick = (force = false) => {
    if (!force && !soundEnabled) return;
    try {
      const Context = window.AudioContext;
      if (typeof Context !== "function") {
        setAudioCaption("Audio cue unavailable in this browser.");
        setSoundEnabled(false);
        return;
      }
      audioContext.current ??= new Context();
      if (audioContext.current.state === "suspended") {
        void audioContext.current.resume().catch((error: unknown) => {
          setSoundEnabled(false);
          setAudioCaption(`Audio cue unavailable: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
      const oscillator = audioContext.current.createOscillator();
      const gain = audioContext.current.createGain();
      oscillator.frequency.value = 540;
      gain.gain.setValueAtTime(0.025, audioContext.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.current.currentTime + 0.055);
      oscillator.connect(gain);
      gain.connect(audioContext.current.destination);
      oscillator.start();
      oscillator.stop(audioContext.current.currentTime + 0.055);
      setAudioCaption("Audio caption: soft interface confirmation tone.");
    } catch (error) {
      setSoundEnabled(false);
      setAudioCaption(`Audio cue unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const appendUiLogEntry = (entry: UiLogEntry) => {
    setRunLog((current) => {
      if (entry.commandId && current.some((item) => item.commandId === entry.commandId)) return current;
      if (entry.eventId && current.some((item) => item.eventId === entry.eventId)) return current;
      if (entry.kind === "event" && current.some((item) =>
        item.kind === "event" && item.title === entry.title
          && item.simTime === entry.simTime && item.detail === entry.detail
      )) return current;
      return [...current, entry];
    });
  };

  const logCommand = (title: string, detail: string, commandId?: string, actor: string = seat) => {
    commandSequence.current += 1;
    appendUiLogEntry({
      title,
      kind: "command",
      detail,
      commandId: commandId ?? `silent-ridge:${commandSequence.current}`,
      actor,
      simTime: simTimeSeconds / 60,
    });
  };

  const setProfile = (name: string, values: typeof profileValues) => {
    setProfileName(name);
    setProfileValues(values);
    logCommand("SetLinkProfile", `${name} profile applied to the exercise links.`);
  };

  const updateProfileValue = (key: keyof typeof profileValues, value: number) => {
    setProfileValues((current) => ({ ...current, [key]: value }));
    setProfileName("Custom");
    logCommand("SetLinkParam", `${key} set to ${value}${key === "delay" ? " min" : "%"}.`);
  };

  useEffect(() => {
    try {
      localStorage.setItem("sudarshan-effects", effectsMode);
    } catch {
      // Effects are decorative; unavailable storage must not interrupt the exercise.
    }
  }, [effectsMode]);

  const applyInject = (card: string, label: string, recipient: TraineeSeat = targetSeat, actor = "Instructor") => {
    const injectKey = `${card}:${recipient}`;
    if (appliedInjects.current.has(injectKey)) return;
    appliedInjects.current.add(injectKey);
    playUiTick();
    setToasts((current) => [...current, `${label} added to this scripted run.`]);
    const items = getInject(card);
    const feedEntries = items.map((item) => toFeedEntry(item, recipient));
    setSeatFeeds((current) => ({ ...current, [recipient]: [...current[recipient], ...feedEntries] }));
    logCommand(`FireInject:${card}`, `${label} injected for ${recipient} by ${actor}.`, `FireInject:${injectKey}`, actor);
    items.forEach((item) => appendUiLogEntry({
        title: item.id,
        kind: "event" as const,
        detail: `${item.from} → ${item.to.join(", ")} — ${item.text}`,
        eventId: `${item.id}:${recipient}`,
        simTime: item.simOffset,
      }));
  };

  useEffect(() => {
    if (!exerciseStarted || playerPaused) return;
    const clock = window.setInterval(() => {
      setSimTimeSeconds((current) => current + playerSpeed);
    }, 1000);
    return () => window.clearInterval(clock);
  }, [exerciseStarted, playerPaused, playerSpeed]);

  useEffect(() => {
    if (!exerciseStarted || !autoDirectorEnabled || playerPaused || decisionSubmitted) return;
    const decisionOpenAtSeconds = (scenario.decisionPoints[0]?.opensAt ?? Number.POSITIVE_INFINITY) * 60;
    if (simTimeSeconds >= decisionOpenAtSeconds && !autoPausedForDecision.current) {
      autoPausedForDecision.current = true;
      setPlayerPaused(true);
      logCommand("Pause", "Auto-Director paused before DP-1.", "AutoDirectorPause:dp-1", "Auto-Director");
      return;
    }
    const beat = directorBeats.find((entry) =>
      entry.card &&
      simTimeSeconds >= entry.atMinute * 60 &&
      !appliedInjects.current.has(`${entry.card}:T1`)
    );
    if (beat?.card) applyInject(beat.card, beat.title, "T1", "Auto-Director");
  }, [autoDirectorEnabled, decisionSubmitted, exerciseStarted, playerPaused, runLog, simTimeSeconds]);

  const startExercise = () => {
    if (sessionStarted.current) {
      setScreen("brief");
      return;
    }
    sessionStarted.current = true;
    setExerciseStarted(true);
    setSimTimeSeconds(0);
    setPlayerPaused(false);
    autoPausedForDecision.current = false;
    logCommand("CreateSession", `Session started for ${selectedScenario}.`, `CreateSession:${selectedScenario}`);
    appendUiLogEntry({ title: "BriefIssued", kind: "event", detail: "OPORD acknowledged by T1.", eventId: "BriefIssued:session-start", simTime: 0 });
    setScreen("brief");
  };

  const submitDecision = () => {
    if (decisionSubmittedRef.current) return;
    decisionSubmittedRef.current = true;
    const branchId = resolveDecisionBranch("dp-1", decisionChoice);
    setDecisionSubmitted(true);
    logCommand("SubmitDecision", `T1 selected ${decisionChoice}; rationale: ${decisionRationale}; confidence ${confidence}; basis ${citedReports.join(", ") || "none"}; branch ${branchId}.`, `SubmitDecision:dp-1`);
    if (autoDirectorEnabled && autoPausedForDecision.current) {
      autoPausedForDecision.current = false;
      setPlayerPaused(false);
      logCommand("Resume", "Auto-Director resumed after the decision submission.", "AutoDirectorResume:dp-1", "Auto-Director");
    }

    const branchConsequence = consequenceCopy.dp1[decisionChoice as keyof typeof consequenceCopy.dp1];
    if (branchId && branchConsequence) {
      appendUiLogEntry({
        title: "BranchConsequence",
        kind: "event",
        detail: branchConsequence,
        eventId: `BranchConsequence:${branchId}`,
        simTime: scenario.decisionPoints[0]?.opensAt,
      });
    }

    if (branchId === "retask-uas-branch") {
      applyInject("SPOOF", "Spoof Contact");
    }

    setShowConsequence(true);
    consequenceTimer.current = window.setTimeout(() => {
      setShowConsequence(false);
      setScreen("aar");
    }, 6000);
  };

  const seatTabs = [
    { key: "Instructor", label: "Instructor" },
    { key: "T1", label: "T1 Coy Cdr" },
    { key: "T2", label: "T2 Pl Cdr" },
    { key: "T3", label: "T3 Pl Cdr" },
  ];

  const markReady = (seatToMark: Seat) => {
    setReadySeats((current) => current.includes(seatToMark) ? current : [...current, seatToMark]);
  };

  const brief = getBriefSummary();
  const currentPhase = phaseIndexForScreen[screen];
  const lastUnlockedPhase = decisionSubmitted ? 4 : exerciseStarted ? (screen === "brief" ? 2 : 3) : 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        setRehearsalOpen((open) => !open);
      } else if (event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        const enabled = !presenterMode;
        setPresenterMode(enabled);
        if (enabled) setRehearsalOpen(false);
      } else if (event.key === "Escape") {
        setRehearsalOpen(false);
        setHelpOpen(false);
        setTourIndex(null);
      } else if (event.key.toLowerCase() === "l") {
        setLegendOpen((open) => !open);
      } else if (event.key === "?") {
        setTourIndex(0);
      } else if (presenterMode && screen === "instructor" && event.code === "Space") {
        event.preventDefault();
        setPlayerPaused((paused) => !paused);
        logCommand(playerPaused ? "Resume" : "Pause", "Presenter mode playback hotkey.");
      } else if (event.key.toLowerCase() === "n" && screen === "instructor" && (presenterMode || rehearsalOpen)) {
        const beat = directorBeats.find((entry) => entry.card && !appliedInjects.current.has(`${entry.card}:${targetSeat}`));
        if (beat?.card) applyInject(beat.card, beat.title, targetSeat);
      } else if (presenterMode && ["1", "2", "3", "4"].includes(event.key)) {
        const stations: { seat: Seat; screen: Screen }[] = [
          { seat: "Instructor", screen: "instructor" },
          { seat: "T1", screen: "t1" },
          { seat: "T2", screen: "t2" },
          { seat: "T3", screen: "t3" },
        ];
        const station = stations[Number(event.key) - 1];
        if (station) { setSeat(station.seat); setScreen(station.screen); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyInject, logCommand, playerPaused, presenterMode, rehearsalOpen, screen, targetSeat]);

  useEffect(() => {
    if (screen === "landing" || judgeWalkthroughActive) return;
    const key = `sudarshan-tour-seen:${screen}`;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "true";
      if (!seen) localStorage.setItem(key, "true");
    } catch {
      seen = false;
    }
    if (!seen) setTourIndex(0);
  }, [judgeWalkthroughActive, screen]);

  useEffect(() => {
    if (!judgeWalkthroughActive) return;
    const jammed = runLog.some((entry) => entry.title === "FireInject:JAM_NET");
    const spoofed = runLog.some((entry) => entry.title === "FireInject:SPOOF");
    if (judgeWalkthroughStep === 0 && jammed) setJudgeWalkthroughStep(1);
    else if (judgeWalkthroughStep === 1 && spoofed) setJudgeWalkthroughStep(2);
    else if (judgeWalkthroughStep === 2 && screen === "t1") setJudgeWalkthroughStep(3);
    else if (judgeWalkthroughStep === 3 && decisionSubmitted) setJudgeWalkthroughStep(4);
    else if (judgeWalkthroughStep === 4 && screen === "aar") setJudgeWalkthroughStep(5);
    else if (judgeWalkthroughStep === 5 && screen === "aar" && aarMomentIndex > 0) setJudgeWalkthroughStep(6);
  }, [aarMomentIndex, decisionSubmitted, judgeWalkthroughActive, judgeWalkthroughStep, runLog, screen]);

  const navigateTo = (target: Screen) => {
    setScreen(target);
    const matchingSeat = Object.entries(seatViewFromKey).find(([, screenName]) => screenName === target)?.[0];
    if (matchingSeat) setSeat(matchingSeat as Seat);
    setRehearsalOpen(false);
  };

  const renderMissionCard = (forSeat: Seat | "Instructor") => {
    const copy = guidanceCopy[forSeat];
    return (
      <section className="mission-card" aria-label={`${forSeat} mission card`}>
        <div className="mission-card-kicker">YOUR MISSION · {forSeat}</div>
        <p><strong>Your role</strong>{copy.role}</p>
        <p><strong>Your goal</strong>{copy.goal}</p>
        <p><strong>Right now</strong>{copy.rightNow}</p>
        <p className="mission-next"><strong>Next step</strong>{copy.nextStep}</p>
        <details>
          <summary>Why am I doing this?</summary>
          <p>{copy.why}</p>
        </details>
      </section>
    );
  };

  const renderMapLegend = (showTruth: boolean) => legendOpen ? (
    <aside className="map-legend" aria-label="Map legend">
      <div className="legend-heading"><strong>Map legend</strong><button onClick={() => setLegendOpen(false)} aria-label="Close map legend">×</button></div>
      <span><i className="legend-friendly" /> Friendly position</span>
      <span><i className="legend-enemy" /> Fresh contact</span>
      <span><i className="legend-ghost" /> Last-known / uncertain</span>
      <span><i className="legend-ring" /> Information uncertainty</span>
      <span><i className="legend-contradiction">?</i> Contradicting reports</span>
      <span><i className="legend-lamp clear" /> Clear link · green</span>
      <span><i className="legend-lamp contested" /> Contested link · amber</span>
      <span><i className="legend-lamp lost" /> Lost link · red</span>
      {showTruth && <span><i className="legend-truth" /> Truth layer · instructor/AAR only</span>}
    </aside>
  ) : null;

  const tourCaptions = [
    `You are viewing ${seat}. Start with the role and goal in the mission card.`,
    "Use the map and report list together; only this seat's report picture belongs here.",
    "Use the controls to record an action or a decision. The exercise is scripted.",
    "Use the review to discuss what was known at the time and what remained uncertain.",
  ];

  const startJudgeWalkthrough = () => {
    if (consequenceTimer.current !== null) window.clearTimeout(consequenceTimer.current);
    sessionStarted.current = false;
    decisionSubmittedRef.current = false;
    appliedInjects.current.clear();
    autoPausedForDecision.current = false;
    commandSequence.current = 0;
    setRunLog(buildRunLogFromScenario());
    setSeatFeeds({
      T1: getInitialT1Messages().map((item) => toFeedEntry(item, "T1")),
      T2: getScenarioItemsForSeat("T2").map((item) => toFeedEntry(item, "T2")),
      T3: getScenarioItemsForSeat("T3").map((item) => toFeedEntry(item, "T3")),
    });
    setTriageStatus({});
    setDecisionSubmitted(false);
    setDecisionChoice("retask-uas");
    setDecisionRationale("");
    setCitedReports([]);
    setAarMomentIndex(0);
    setSimTimeSeconds(0);
    setPlayerPaused(false);
    setAutoDirectorEnabled(false);
    setToasts([]);
    setSeat("Instructor");
    setTargetSeat("T1");
    setJudgeWalkthroughStep(0);
    setJudgeWalkthroughActive(true);
    setTourIndex(null);
    startExercise();
    setScreen("instructor");
  };

  const renderLanding = () => (
    <div className="landing-screen">
      <section className="mission-landing">
        <div className="landing-copy">
          <div className="mission-kicker"><span className="signal-mark" /> FIELD EXERCISE 01 <span>·</span> COMMAND & CONTROL</div>
          <p className="eyebrow">Sudarshan Command Deck</p>
          <h1>When the signal<br /><em>isn't the whole story.</em></h1>
          <p className="lead">A decision exercise in delayed reports, uncertain sources, and the moment you choose to act.</p>
          <div className="landing-actions">
            <button className="primary-button launch-button" onClick={() => setScreen("setup")}>
              <span>Begin exercise</span><span aria-hidden="true">↗</span>
            </button>
            <button className="secondary-button judge-walkthrough-button" onClick={startJudgeWalkthrough}>Judge walkthrough · 90 seconds</button>
            <button className="guide-link" onClick={() => { setGuideStep(0); setScreen("guide"); }}>
              <span className="guide-icon" aria-hidden="true">?</span> Take the 2-minute field guide
            </button>
            <button className="guide-link" onClick={() => setScreen("builder")}>Scenario Builder · local</button>
          </div>
          <div className="scenario-strip">
            <span className="scenario-index">01</span>
            <div><span className="scenario-status">AVAILABLE SCENARIO</span><strong>SILENT RIDGE</strong><small>Contradictory reports · degraded comms · FORD crossing</small></div>
            <span className="scenario-arrow" aria-hidden="true">↗</span>
          </div>
          <div className="coming-strip"><span className="coming-light" /> IRON FORD <span className="coming-label">NEXT EXERCISE</span></div>
          {customScenario && <div className="custom-scenario-strip"><span>Custom</span><strong>{customScenario.title}</strong><button onClick={() => setScreen("builder")}>Open Builder</button></div>}
        </div>

        <aside className="landing-aside">
          <div className="map-heading"><span>AREA OF OPERATIONS</span><span>GRID 18 / 04</span></div>
          <div className="mission-map" aria-label="Synthetic exercise map showing the Ford, North Bridge, and Ridge">
            <div className="map-grain" />
            <div className="contour contour-one" /><div className="contour contour-two" /><div className="contour contour-three" />
            <div className="map-river" /><div className="map-trail trail-one" /><div className="map-trail trail-two" />
            <div className="map-coordinate coord-one">18.402 / 04.118</div><div className="map-coordinate coord-two">18.416 / 04.092</div>
            <div className="map-point ford-point"><span className="point-pulse" /><span>FORD</span></div>
            <div className="map-point ridge-point"><span className="point-diamond" /><span>RIDGE</span></div>
            <div className="map-point bridge-point"><span className="point-ring" /><span>N BRIDGE</span></div>
            <div className="map-unit friendly-unit"><span>+</span> T1</div>
            <div className="map-unit unknown-unit"><span>?</span> UNCONFIRMED</div>
            <div className="map-scale"><span /> 1 km</div>
            <div className="map-overlay-note"><span className="map-live-dot" /> SCENARIO PREVIEW</div>
          </div>
          <div className="map-caption"><span>THE PICTURE IS SCRIPTED.</span><span>YOUR DECISION IS YOURS.</span></div>
          <div className="seat-selector landing-seats">
            <div className="seat-selector-head"><p>Choose a station</p><span>ONE-WINDOW MODE</span></div>
            <div className="seat-grid">
              {seatTabs.map((entry) => (
                <button
                  key={entry.key}
                  className={seat === entry.key ? "seat-pill active" : "seat-pill"}
                  onClick={() => {
                    setSeat(entry.key as Seat);
                    setScreen(seatViewFromKey[entry.key] ?? "instructor");
                  }}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <div className="landing-footnote"><span>ILLUSTRATIVE SIMULATION · SCRIPTED EXERCISE</span><span>NO LIVE DATA · OFFLINE PROTOTYPE</span></div>
      </section>
    </div>
  );

  const renderGuide = () => {
    const currentStep = fieldGuideCards[guideStep];

    return (
      <section className="guide-screen">
        <div className="guide-heading">
          <div>
            <p className="eyebrow">Field guide · 02 minutes</p>
            <h2>Know your way around.</h2>
            <p>Five interactive cards introduce communication effects, report sources, and review.</p>
          </div>
          <button className="secondary-button" onClick={() => setScreen("landing")}>Back to landing</button>
        </div>
        <div className="guide-layout">
          <nav className="guide-steps" aria-label="Tutorial steps">
            {fieldGuideCards.map((step, index) => (
              <button key={step.title} className={guideStep === index ? "guide-step active" : "guide-step"} onClick={() => setGuideStep(index)}>
                <span className="guide-step-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{step.title}</span>
                <span className="guide-step-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
          <article className="guide-detail" aria-live="polite">
            <span className="guide-detail-index">FIELD NOTE {String(guideStep + 1).padStart(2, "0")} / {String(fieldGuideCards.length).padStart(2, "0")}</span>
            <h3>{currentStep.title}</h3>
            <p>{currentStep.body}</p>
            <div className="guide-station"><span>RELATED STATION</span><strong>{currentStep.station}</strong></div>
            <section className="guide-demo" aria-label={`${currentStep.title} demo`}>
              <span>TRY IT · LOCAL DEMO</span>
              {currentStep.demo === "delay" && <>
                <label>Sample report delay · {guideDelay} min<input aria-label="Sample report delay" type="range" min="0" max="8" value={guideDelay} onChange={(event) => setGuideDelay(Number(event.target.value))} /></label>
                <p>Sample: a report is shown with a {guideDelay}-minute delay.</p>
              </>}
              {currentStep.demo === "grade" && <>
                <label>Source grade<select aria-label="Sample source grade" value={guideGrade} onChange={(event) => setGuideGrade(event.target.value)}>{["A", "B", "C", "D", "E", "F"].map((grade) => <option key={grade}>{grade}</option>)}</select></label>
                <p>Sample report grade: {guideGrade}. Grade describes the source; it does not prove the report is correct.</p>
              </>}
              {currentStep.demo === "streams" && <>
                <label><input type="checkbox" checked={guideStreamsShown} onChange={(event) => setGuideStreamsShown(event.target.checked)} /> Show the two stream labels</label>
                {guideStreamsShown && <div className="guide-stream-demo"><span>T1 · perceived report feed</span><span>Instructor/AAR · scripted truth layer</span></div>}
                {!guideStreamsShown && <p>The stream contents are kept separate; use the AAR to compare them.</p>}
              </>}
              {currentStep.demo === "deadline" && <>
                <label>Decision window<select aria-label="Sample decision deadline" value={guideDeadline} onChange={(event) => setGuideDeadline(Number(event.target.value))}><option value="4">4 min</option><option value="6">6 min</option><option value="8">8 min</option></select></label>
                <p>If no choice is recorded by H+{guideDeadline}, the illustrative default is Hold at the FORD. This demo does not start a timer.</p>
              </>}
              {currentStep.demo === "aar" && <>
                <p>Use What happened, Why, Indicators, and Sustain / improve to guide a discussion.</p>
                <button className="secondary-button" onClick={() => setScreen("aar")}>Open AAR</button>
                <button className="primary-button" onClick={startJudgeWalkthrough}>Start Judge walkthrough</button>
              </>}
            </section>
            <div className="guide-controls">
              <div className="guide-pagination">
                <button aria-label="Previous guide step" disabled={guideStep === 0} onClick={() => setGuideStep((step) => step - 1)}>←</button>
                <span>{String(guideStep + 1).padStart(2, "0")} <i>/</i> 05</span>
                <button aria-label="Next guide step" disabled={guideStep === fieldGuideCards.length - 1} onClick={() => setGuideStep((step) => step + 1)}>→</button>
              </div>
              <button className="primary-button" onClick={() => setScreen(guideScreenTargets[guideStep])}>Open this station <span aria-hidden="true">↗</span></button>
            </div>
          </article>
        </div>
        <div className="guide-disclaimer">Illustrative simulation · scripted exercise <span>All scenario content is synthetic.</span></div>
      </section>
    );
  };

  const renderSetup = () => {
    const friction = profileValues.delay <= 1 && profileValues.loss < 10 && profileValues.partial < 10
      ? "Low"
      : profileValues.delay < 6 && profileValues.loss < 45 && profileValues.garble < 50
        ? "Moderate"
        : "High";
    const sampleEffects = [
      profileValues.delay > 0 ? `arrives about ${profileValues.delay} min late` : "arrives without scripted delay",
      profileValues.loss > 0 ? "a report may be missing" : "",
      profileValues.partial > 0 ? "some fields may be absent" : "",
      profileValues.garble > 0 ? "some words may be garbled" : "",
    ].filter(Boolean).join("; ");
    const presets = [
      { key: "Clear", label: "Clear", values: { delay: 0, loss: 0, partial: 0, garble: 0 }, description: "Reports arrive without scripted link effects." },
      { key: "Contested", label: "Contested", values: { delay: 4, loss: 25, partial: 30, garble: 30 }, description: "Reports may arrive late, missing, incomplete, or garbled." },
      { key: "Heavily Jammed", label: "Heavily Jammed", values: { delay: 7, loss: 60, partial: 60, garble: 70 }, description: "Most reports face severe scripted link effects." },
      { key: "Deceptive", label: "Deceptive", values: { delay: 5, loss: 20, partial: 40, garble: 45 }, description: "Reports may arrive altered alongside contradictory information." },
    ];

    return (
    <div className="setup-screen">
      <div className="header-row">
        <div>
          <p className="eyebrow">Instructor setup</p>
          <h2>Configure communication conditions</h2>
          <p className="screen-subtitle">Choose the scripted friction profile and confirm which seats are ready.</p>
        </div>
      </div>

      <div className="layout-grid">
        <div className="panel badge-panel">
          <h3>Presets</h3>
          <div className="chip-row">
            {presets.map((preset) => (
              <button
                key={preset.key}
                className={`chip${profileName === preset.label ? " active" : ""}`}
                title={preset.description}
                onClick={() => setProfile(preset.label, preset.values)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="slider-stack">
            <label>
              Delay · {profileValues.delay} min <strong>{profileValues.delay} min</strong>
              <small>Time added before a report is available to its recipient.</small>
              <input aria-label="Delay in minutes" type="range" min="0" max="12" value={profileValues.delay} onChange={(event) => updateProfileValue("delay", Number(event.target.value))} />
            </label>
            <label>
              Loss · {profileValues.loss}% <strong>{profileValues.loss}%</strong>
              <small>Chance used by the scripted profile to omit a report.</small>
              <input aria-label="Loss percent" type="range" min="0" max="100" value={profileValues.loss} onChange={(event) => updateProfileValue("loss", Number(event.target.value))} />
            </label>
            <label>
              Partial · {profileValues.partial}% <strong>{profileValues.partial}%</strong>
              <small>Chance that selected report fields are absent.</small>
              <input aria-label="Partial percent" type="range" min="0" max="100" value={profileValues.partial} onChange={(event) => updateProfileValue("partial", Number(event.target.value))} />
            </label>
            <label>
              Garble · {profileValues.garble}% <strong>{profileValues.garble}%</strong>
              <small>Chance that selected report words are garbled.</small>
              <input aria-label="Garble percent" type="range" min="0" max="100" value={profileValues.garble} onChange={(event) => updateProfileValue("garble", Number(event.target.value))} />
            </label>
          </div>
          <div className="sample-report">
            <span>LIVE SAMPLE REPORT · {profileName.toUpperCase()}</span>
            <p>{ordersCopy.sampleReport} — {sampleEffects}.</p>
          </div>
          <div className="friction-summary">
            <strong>Friction level · {friction}</strong>
            <p>{friction === "Low" ? "Most scripted reports arrive intact." : friction === "Moderate" ? "Some reports may arrive with delays or missing details." : "Expect substantial gaps and altered report details."}</p>
          </div>
          <p className="trainee-experience"><strong>What trainees will experience</strong><br />{sampleEffects} in the selected synthetic exercise.</p>
          <p className="setup-honesty">Preview only: this scenario's report outcomes remain scripted in its fixture.</p>
        </div>

        <div className="panel">
          <h3>Seat readiness</h3>
          <ul className="readiness-list">
            {seatTabs.map((entry) => (
              <li key={entry.key}>
                <span className={`lamp${readySeats.includes(entry.key as Seat) ? " ready" : ""}`} />
                {entry.label}
                <span className={`readiness-state${readySeats.includes(entry.key as Seat) ? " is-ready" : ""}`}>
                  {readySeats.includes(entry.key as Seat) ? "Ready" : "Waiting"}
                </span>
              </li>
            ))}
          </ul>
          <button className="secondary-button readiness-action" onClick={() => setReadySeats(seatTabs.map((entry) => entry.key as Seat))}>
            Mark all ready · single-window mode
          </button>
          <div className="deadline-box">
            <label>Decision deadline</label>
              <select value={decisionDeadline} onChange={(event) => { setDecisionDeadline(Number(event.target.value)); logCommand("SetLinkParam", `Decision deadline set to ${event.target.value} minutes.`); }}>
              <option value="4">4 min</option>
              <option value="6">6 min</option>
              <option value="8">8 min</option>
            </select>
          </div>
        </div>
      </div>
      <div className="setup-action-bar">
        <div><strong>Ready to begin · {profileName}</strong><span>Starts SILENT RIDGE with a {decisionDeadline}-minute decision deadline.</span></div>
        <button className="primary-button" onClick={startExercise}>Start Exercise</button>
      </div>
    </div>
    );
  };

  const renderInstructor = () => {
    const scriptedItems = scenario.segments.flatMap((segment) => segment.items);
    const trafficEntries = runLog.filter((entry) => entry.kind === "event");
    const selectedTraffic = selectedTrafficId
      ? scriptedItems.find((item) => item.id === selectedTrafficId)
      : undefined;
    const selectedDelivery = selectedTraffic
      ? selectedTraffic.delivery[selectedTraffic.to[0]] ?? selectedTraffic.delivery.T1
      : undefined;
    const deliveredCount = t1Feed.filter((entry) => !entry.outcome.dropped).length;
    const droppedCount = t1Feed.filter((entry) => entry.outcome.dropped).length;
    const delayedCount = t1Feed.filter((entry) => entry.outcome.delayMin > 0).length;
    const currentBeat = directorBeats.find((beat) => beat.card && !appliedInjects.current.has(`${beat.card}:${targetSeat}`));
    const submittedDecision = runLog.find((entry) => entry.title === "SubmitDecision");
    const advisorSuggestions = deriveAdvisorSuggestions(runLog, triageStatus, Boolean(submittedDecision?.detail.includes("basis none")))
      .filter((suggestion) => !advisorAccepted.includes(suggestion.id));
    const simTimeLabel = `H+${String(Math.floor(simTimeSeconds / 60)).padStart(2, "0")}:${String(simTimeSeconds % 60).padStart(2, "0")}`;
    const injectCards = [
      { label: "Jam Net", value: "JAM_NET", description: "T2-to-T1 report effects are defined by the scenario." },
      { label: "Spoof Contact", value: "SPOOF", description: "Adds a contradictory report to the chosen seat." },
      { label: "GPS Spoof Pl 2", value: "GPS_SPOOF", description: "Illustrative command record; no GPS segment exists in SILENT RIDGE." },
      { label: "Drone Sighting", value: "DRONE", description: "Illustrative command record; no drone segment exists in SILENT RIDGE." },
      { label: "Restore Link", value: "RESTORE", description: "Illustrative command record; no restore segment exists in SILENT RIDGE." },
    ];

    return (
      <div className="instructor-screen">
        <div className="instructor-status-strip">
          <span>SIM TIME · {simTimeLabel}</span>
          <button onClick={() => { setPlayerPaused((paused) => !paused); logCommand(playerPaused ? "Resume" : "Pause", "Playback state toggled in the local interface."); }}>{playerPaused ? "Resume" : "Pause"}</button>
          <label>Playback speed<select aria-label="Playback speed" value={playerSpeed} onChange={(event) => { const nextSpeed = Number(event.target.value) as 1 | 4 | 10; setPlayerSpeed(nextSpeed); logCommand("SetSpeed", `Playback speed set to x${nextSpeed}.`); }}><option value="1">×1</option><option value="4">×4</option><option value="10">×10</option></select></label>
          <label className="auto-director-toggle"><input aria-label="Auto-Director (Rule-based automation)" type="checkbox" checked={autoDirectorEnabled} onChange={(event) => { const enabled = event.target.checked; setAutoDirectorEnabled(enabled); autoPausedForDecision.current = false; logCommand("AutoDirectorToggled", `Rule-based Auto-Director ${enabled ? "enabled" : "disabled"}.`, `AutoDirectorToggled:${enabled}:${commandSequence.current + 1}`, "Instructor"); }} />Auto-Director · Rule-based automation</label>
          <span className="status-dot">RULE-BASED SCRIPT</span>
          <button className="end-exercise" onClick={() => setScreen("aar")}>End Exercise</button>
        </div>
        <div className="instructor-deck">
          <aside className="panel director-script">
            <div className="panel-header"><h3>Director's script</h3></div>
            {currentBeat && <p className="next-beat-banner">Next · {currentBeat.title}</p>}
            {directorBeats.map((beat) => {
              const played = Boolean(beat.card && appliedInjects.current.has(`${beat.card}:${targetSeat}`));
              return (
                <article className={`director-beat${played ? " played" : ""}`} key={beat.id}>
                  <span>{played ? "DONE" : beat.time}</span>
                  <strong>{beat.title}</strong>
                  <p>{beat.description}</p>
                  <button onClick={() => beat.card ? applyInject(beat.card, beat.title, targetSeat) : setInstructorDock("traffic")}>{beat.card ? "Play" : "Show opening reports"}</button>
                </article>
              );
            })}
          </aside>

          <section className="panel truth-map-panel">
            <div className="panel-header"><h3>Truth map · instructor only</h3><span className="status-dot">SYNTHETIC</span></div>
            <div className="map-canvas truth">
              <div className="map-road road-north" /><div className="map-road road-east" /><div className="map-river" />
              <div className="map-track track-one" /><div className="map-track track-two" /><div className="map-woods" />
              <div className="map-compass" aria-label="North">N<br />↑</div><div className="map-scale"><span /> 1 km</div>
              <span className="map-tag tag-ford">FORD</span><span className="map-tag tag-bridge">N BRIDGE</span><span className="map-tag tag-ridge">RIDGE</span><span className="map-tag tag-fup">FUP ORCHID</span>
              <span className="marker hostile" style={{ top: "33%", left: "57%" }} aria-label="Synthetic hostile contact" />
              <span className="marker friendly" style={{ top: "57%", left: "39%" }} aria-label="Friendly position" />
              {splitMap && <div className="map-split-panel"><strong>{targetSeat} PERCEIVED</strong><span className="ghost-marker" /><span>Seat-only report picture</span></div>}
              <button className="map-split-toggle" onClick={() => setSplitMap((shown) => !shown)}>{splitMap ? "Hide split view" : `Truth | ${targetSeat} picture`}</button>
              <span className="map-coordinate coord-one">18.402 / 04.118</span><span className="map-coordinate coord-two">18.416 / 04.092</span>
              {renderMissionCard("Instructor")}
              <button className="map-legend-toggle" onClick={() => setLegendOpen((open) => !open)} aria-label="Toggle map legend">L · Legend</button>
              {renderMapLegend(true)}
            </div>
            <div className="seat-peek">
              <strong>Seat peek · {targetSeat}</strong>
              <span>{seatFeeds[targetSeat].length} local report cards · selected seat only</span>
              <button onClick={() => navigateTo(seatViewFromKey[targetSeat])}>Open {targetSeat} seat</button>
            </div>
          </section>

          <aside className="panel inject-links-panel">
            <div className="panel-header"><h3>Inject deck & links</h3></div>
            <label className="target-seat-select">Target seat
              <select value={targetSeat} onChange={(event) => setTargetSeat(event.target.value as TraineeSeat)}>
                <option value="T1">T1 · Coy Cdr</option><option value="T2">T2 · Pl Cdr</option><option value="T3">T3 · Pl Cdr</option>
              </select>
            </label>
            <div className="inject-list">
              {injectCards.map((card) => (
                <button key={card.value} className={selectedCard === card.value ? "inject-card active" : "inject-card"} title={card.description}
                  onClick={() => { setSelectedCard(card.value); applyInject(card.value, card.label, targetSeat); }}>
                  <strong>{card.label}</strong><small>{card.description}</small>
                </button>
              ))}
            </div>
            <div className="link-matrix">
              <h4>Link health · {profileName}</h4>
              <div><i className={appliedInjects.current.has("JAM_NET:T1") ? "link-lamp contested" : "link-lamp clear"} />T2 → T1 <strong>{appliedInjects.current.has("JAM_NET:T1") ? "Contested" : "Clear"}</strong></div>
              <div><i className="link-lamp clear" />UAS → T1 <strong>Clear</strong></div>
              <p>Delivered {deliveredCount} · Dropped {droppedCount} · Delayed {delayedCount}</p>
            </div>
            <label className="target-seat-select">Quick profile
              <select value={profileName} onChange={(event) => {
                const presets = { Clear: { delay: 0, loss: 0, partial: 0, garble: 0 }, Contested: { delay: 4, loss: 25, partial: 30, garble: 30 }, "Heavily Jammed": { delay: 7, loss: 60, partial: 60, garble: 70 }, Deceptive: { delay: 5, loss: 20, partial: 40, garble: 45 } };
                const next = event.target.value as keyof typeof presets;
                setProfile(next, presets[next]);
              }}>
                <option>Clear</option><option>Contested</option><option>Heavily Jammed</option><option>Deceptive</option>
              </select>
            </label>
            <section className="advisor-panel" aria-label="Advisor rule-based suggestions">
              <h4>Advisor · Rule-based automation</h4>
              {advisorSuggestions.length ? advisorSuggestions.map((suggestion) => (
                <article className="advisor-suggestion" key={suggestion.id}>
                  <p>{suggestion.recommendation}</p>
                  <small>Rule: {suggestion.rule}</small>
                  <button onClick={() => {
                    setAdvisorAccepted((current) => [...current, suggestion.id]);
                    logCommand("AdvisorAccepted", `${suggestion.id}: ${suggestion.recommendation}`, `AdvisorAccepted:${suggestion.id}`, "Instructor");
                    setScreen("t1");
                  }}>{suggestion.action}</button>
                </article>
              )) : <p className="empty-state">No rule conditions currently suggest an action. New suggestions require matching run-log evidence.</p>}
            </section>
          </aside>
        </div>
        <section className="panel instructor-dock">
          <nav className="dock-tabs" aria-label="Instructor data views">
            {([["decisions", "Live decisions"], ["traffic", "Traffic"], ["runlog", "Run log"], ["signal", "Signal path"]] as const).map(([key, label]) => (
              <button key={key} className={instructorDock === key ? "active" : ""} onClick={() => setInstructorDock(key)}>{label}</button>
            ))}
          </nav>
          {instructorDock === "decisions" && <div><h4>Decision feed</h4>{runLog.filter((entry) => entry.title === "SubmitDecision").map((entry) => <p key={entry.commandId}>{entry.detail}</p>)}{!runLog.some((entry) => entry.title === "SubmitDecision") && <p className="empty-state">No decisions yet. T1's decision appears after submission.</p>}</div>}
          {instructorDock === "traffic" && <div><h4>Traffic · local run</h4>{trafficEntries.map((entry) => <button className="traffic-row" key={entry.eventId ?? entry.title} onClick={() => { setSelectedTrafficId(entry.title); setInstructorDock("signal"); }}>{entry.title} · {entry.detail}</button>)}</div>}
          {instructorDock === "runlog" && <div className="run-log" data-testid="run-log"><h4>Run log</h4>{runLog.map((entry, index) => <div key={`${entry.commandId ?? entry.eventId ?? entry.title}-${index}`} className="log-row" data-log-title={entry.title}><span className={`badge ${entry.kind}`}>{entry.kind}</span><span>{entry.title}</span><small>{entry.actor ? `${entry.actor} · ` : ""}{entry.detail}</small></div>)}</div>}
          {instructorDock === "signal" && <div className="signal-path">
            <h4>Signal path</h4>
            {selectedTraffic ? <>
              <div className="signal-nodes"><span>{selectedTraffic.from}</span><b>→</b><span>Comms effects</span><b>→</b><span>{selectedTraffic.to[0]}</span></div>
              <p>Delay: {selectedDelivery?.delayMin ?? 0} min · Loss: {selectedDelivery?.drop ? "Dropped" : "No drop"} · Partial: {selectedDelivery?.partialFields.join(", ") || "none"} · Garble: {selectedDelivery?.garble ? "yes" : "no"}</p>
              <strong>Fate: {selectedDelivery?.drop ? "Dropped" : selectedDelivery && selectedDelivery.delayMin > 0 ? "Delivered late" : selectedDelivery?.partialFields.length ? "Partial" : selectedDelivery?.garble ? "Garbled" : "Delivered"}</strong>
            </> : <p className="empty-state">Select a message in Traffic to inspect its scripted delivery fields.</p>}
          </div>}
        </section>
      </div>
    );
  };

  const renderTrainee = (seatKey: TraineeSeat) => {
    const feed = seatFeeds[seatKey];
    const recordFlag = (entry: FeedEntry, action: "Trust" | "Verify" | "Discard" | "Pin") => {
      setTriageStatus((current) => ({ ...current, [entry.id]: action }));
      logCommand("FlagItem", `${entry.id} marked ${action}.`, `FlagItem:${entry.id}:${action}`);
    };
    const recordCommsAction = (command: string, label: string, detail: string) => {
      logCommand(command, `${seatKey}: ${detail}`);
      setToasts((current) => [...current, `${label} recorded for ${seatKey}; this local screen does not simulate a new delivery.`]);
    };

    return (
      <div className="trainee-layout">
        <div className="panel large-panel">
          <div className="panel-header">
            <h3>{seatKey} console</h3>
            <span className="status-dot warning">{seatKey} · Perceived picture</span>
          </div>
          <div className="map-canvas perceived">
            <div className="map-road road-north" />
            <div className="map-road road-east" />
            <div className="map-river" />
            <div className="map-track track-one" />
            <div className="map-track track-two" />
            <div className="map-woods" />
            <span className="map-tag tag-ford">FORD</span>
            <span className="map-tag tag-ridge">RIDGE</span>
            <span className="map-tag tag-bridge">N BRIDGE</span>
            <span className="ghost-marker" style={{ top: "43%", left: "60%" }} aria-label="Uncertain last-known report marker" />
            <span className="friendly-marker" style={{ top: "62%", left: "36%" }} aria-label="Friendly position" />
            {seatKey === "T1" && feed.some((entry) => entry.id === "adjacent-bridge-spoof") && (
              <>
                <span className="ghost-marker contradiction-ghost" style={{ top: "30%", left: "72%" }} aria-label="Unconfirmed report marker" />
                <span className="contradiction-line" aria-hidden="true" />
                <span className="contradiction-mark" aria-label="Contradictory reports">?</span>
              </>
            )}
            {renderMissionCard(seatKey)}
            <button className="map-legend-toggle" onClick={() => setLegendOpen((open) => !open)} aria-label="Toggle map legend">L · Legend</button>
            {renderMapLegend(false)}
            {showConsequence && seatKey === "T1" && (
              <div className="consequence-beat" role="status">
                <span>CONSEQUENCE · SCRIPTED</span>
                <strong>{consequenceCopy.dp1[decisionChoice as keyof typeof consequenceCopy.dp1]}</strong>
                <button onClick={() => { if (consequenceTimer.current !== null) window.clearTimeout(consequenceTimer.current); setShowConsequence(false); setScreen("aar"); }}>Skip to review</button>
              </div>
            )}
          </div>
          {seatKey === "T1" && (
            <div className="comms-actions">
              {[
                ["SwitchFrequency", "Switch frequency", "Restores a link after about 3 min; scripted interference may follow."],
                ["SendRunner", "Send runner", "A runner is not jammed but needs about 9 min to arrive."],
                ["RetaskUAS", "Re-task UAS", "A new scripted UAS report would arrive in about 4 min."],
                ["Annotate", "Request EW check", "Requests a scripted communications check."],
                ["Annotate", "Verify source authentication", "Requests a scripted source check."],
              ].map(([command, label, detail]) => (
                <button key={label} title={detail} onClick={() => recordCommsAction(command, label, detail)}>{label}<small>{detail}</small></button>
              ))}
            </div>
          )}
        </div>

        <div className="panel trainee-feed-panel">
          <div className="panel-header"><h3>Radio net feed</h3><span className="mono-label">{seatKey} · LOCAL VIEW</span></div>
          <div className="feed-list">
            {feed.slice(-5).map((entry) => (
              <article key={entry.id} className="feed-card">
                <div className="feed-head">
                  <strong>{entry.source}</strong>
                  <GlossaryTerm term={entry.precedence as keyof typeof glossary}>{entry.precedence}</GlossaryTerm>
                  <span className="precedence-badge">{entry.precedence}</span>
                </div>
                <p>{entry.outcome.deliveryText || "Message dropped"}</p>
                <div className="meta-row">
                  <span><GlossaryTerm term="source grade">Grade</GlossaryTerm> {entry.grade}</span>
                  <span>Credibility {entry.grade}</span>
                  <span>{entry.location}</span>
                  <span>{entry.outcome.delayMin} min delay</span>
                </div>
                <div className="triage-row">
                  <span>{triageStatus[entry.id] ?? "Unreviewed"}</span>
                  {(["Trust", "Verify", "Discard", "Pin"] as const).map((action) => (
                    <button key={action} onClick={() => recordFlag(entry, action)}>{action === "Pin" ? "Pin to map" : action}</button>
                  ))}
                </div>
              </article>
            ))}
            {feed.length === 0 && <p className="empty-state">No reports yet. The first scripted report is scheduled at H+0.</p>}
          </div>

          {seatKey === "T1" ? (
            <div className="decision-box">
              <h4>Decision point DP-1</h4>
              <p className="know-panel"><strong>What do I currently know?</strong><br />{feed.length ? `${feed.length} report cards are available in this seat's feed.` : "No reports are available yet."}</p>
              {feed.map((entry) => (
                <label key={entry.id} className="citation-row">
                  <input type="checkbox" checked={citedReports.includes(entry.id)} onChange={(event) => setCitedReports((current) => event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id))} />
                  Cite {entry.source} · Grade {entry.grade}
                </label>
              ))}
              {listDecisionOptions().map((option) => (
                <label key={option.id} className="option-row">
                  <input type="radio" name="decision" checked={decisionChoice === option.id} onChange={() => setDecisionChoice(option.id)} />
                  {option.label}
                </label>
              ))}
              <label className="rationale-label">Rationale<textarea value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} /></label>
              <label className="confidence-label">Confidence · {confidence}%
                <input aria-label="Decision confidence" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} />
              </label>
              <button className="primary-button" onClick={submitDecision} disabled={decisionSubmitted}>Submit decision</button>
            </div>
          ) : (
            <div className="team-message-box">
              <h4>Team net · queued messages: 0</h4>
              <p className="empty-state">This seat uses its own fixture stream. No delivered reports are currently assigned to {seatKey}.</p>
              <label>Send a CONTACT / SITREP<textarea value={teamMessage} onChange={(event) => setTeamMessage(event.target.value)} placeholder="Write a concise synthetic report" /></label>
              <button className="primary-button" onClick={() => { logCommand("SendMessage", `${seatKey} sent: ${teamMessage || "CONTACT/SITREP rehearsal message"}.`); setTeamMessage(""); }}>Send message</button>
              <div className="proword-replies">
                {["ROGER", "SAY AGAIN", "WILCO", "STAND BY", "OUT"].map((reply) => (
                  <button key={reply} onClick={() => logCommand("SendMessage", `${seatKey} proword: ${reply}.`)}>{reply}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOrdersBrief = () => (
    <div className="brief-screen">
      <div className="panel full-width-panel">
        <div className="header-row">
          <div>
            <p className="eyebrow">Orders brief</p>
            <h2>OPORD · SILENT RIDGE</h2>
            <p className="screen-subtitle">Read the situation and intent, then acknowledge the brief.</p>
          </div>
        </div>

        <div className="brief-layout-grid">
          <div className="brief-copy-column">
            <div className="brief-grid">
              <div className="brief-card">
                <h3>Situation</h3>
                <p>{brief.situation} Review the <GlossaryTerm term="FUP">FUP</GlossaryTerm> and named locations before acknowledging.</p>
              </div>
              <div className="brief-card">
                <h3>Mission</h3>
                <p>{brief.mission}</p>
              </div>
              <div className="brief-card">
                <h3>Commander's intent</h3>
                <p>{brief.commanderIntent}</p>
              </div>
              <div className="brief-card">
                <h3>H-Hour</h3>
                <p className="brief-dtg">{brief.hHour}</p>
              </div>
            </div>
            <div className="key-questions">
              <h3>Key questions</h3>
              <ol>{ordersCopy.keyQuestions.map((question) => <li key={question}>{question}</li>)}</ol>
            </div>
          </div>
          <div className="brief-map panel">
            <div className="panel-header"><h3>Mission area · synthetic</h3><span className="mono-label">GRID 18 / 04</span></div>
            <div className="mission-map brief-mission-map">
              <div className="map-river" />
              <div className="map-track track-one" />
              <div className="map-woods" />
              {scenario.map.namedPlaces.slice(0, 7).map((place, index) => (
                <span className={`brief-place brief-place-${index}`} key={place.id}>{place.label}</span>
              ))}
              <span className="brief-axis">AXIS → FORD</span>
            </div>
            <div className="task-organization">
              {ordersCopy.taskOrganization.map((unit) => (
                <div key={unit.role}><span>{unit.role}</span><strong>{unit.callsign}</strong></div>
              ))}
            </div>
            <p className="setup-honesty">H-hour is the scripted scenario start; map labels are synthetic.</p>
          </div>
        </div>
        <div className="brief-actions">
          <div className="radio-check">
            <button className="secondary-button" onClick={() => { setRadioCheckComplete(true); logCommand("RadioCheck", "Local radio check completed."); playUiTick(); }}>
              {radioCheckComplete ? "Radio check complete" : "Run radio check"}
            </button>
            <div className={`radio-link-lamps${radioCheckComplete ? " checked" : ""}`} aria-label={radioCheckComplete ? "Radio links checked" : "Radio links waiting"}>
              {["T1", "T2", "T3", "UAS"].map((link, index) => <span key={link} style={{ animationDelay: `${index * 120}ms` }}><i />{link}</span>)}
            </div>
          </div>
          <span className="ready-count">{readySeats.length} of {seatTabs.length} seats ready</span>
          <button className="primary-button brief-acknowledge" onClick={() => { markReady(seat); setScreen("instructor"); }}>
            Acknowledge · {seat}
          </button>
        </div>
      </div>
    </div>
  );

  const renderAAR = () => {
    const runLogFacts = runLog.map(({ title, kind, detail, simTime, commandId, eventId, actor }) => ({
      title, kind, detail, simTime, commandId, eventId, actor,
    }));
    const exportData = createAarExportData(scenario.id, runLogFacts, keyMoments, aarNarrative);
    const exportAar = (format: "json" | "csv") => {
      try {
        const contents = format === "json"
          ? JSON.stringify(exportData, null, 2)
          : toAarCsv(runLogFacts, keyMoments, aarNarrative);
        const blob = new Blob([contents], { type: format === "json" ? "application/json" : "text/csv" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${scenario.id}-aar.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setAarExportStatus(`${format.toUpperCase()} export prepared with synthetic and unvalidated markers.`);
      } catch (error) {
        setAarExportStatus(`AAR export failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    const timelineEnd = Math.max(
      1,
      ...runLog.map((entry) => entry.simTime ?? 0),
      ...(["T1", "T2", "T3"] as const).flatMap((seatId) =>
        seatFeeds[seatId].filter((entry) => !entry.outcome.dropped)
          .map((entry) => entry.simOffset + entry.outcome.delayMin)
      ),
    );
    const informationAge = (["T1", "T2", "T3"] as const).map((seatId) => {
      const reports = seatFeeds[seatId].filter((entry) => !entry.outcome.dropped)
        .map((entry) => ({ ...entry, arrival: entry.simOffset + entry.outcome.delayMin }))
        .sort((a, b) => a.arrival - b.arrival);
      const freshest = reports[reports.length - 1];
      return {
        seatId,
        reports,
        age: freshest ? Math.max(0, timelineEnd - freshest.arrival) : null,
      };
    });
    const activeMoment = keyMoments[Math.min(aarMomentIndex, Math.max(0, keyMoments.length - 1))];
    const delayedCount = t1Feed.filter((entry) => entry.outcome.delayMin > 0 && !entry.outcome.dropped).length;
    const droppedCount = t1Feed.filter((entry) => entry.outcome.dropped).length;
    const verificationCount = Object.values(triageStatus).filter((action) => action === "Verify" || action === "Discard").length;

    return (
      <div className="aar-screen">
        <div className="header-row">
          <div>
            <p className="eyebrow">After-action review · illustrativeSimulation: true · unvalidated</p>
            <h2>What happened and why</h2>
          </div>
          <button className="secondary-button" onClick={() => setScreen("end")}>End card</button>
        </div>

        <section className="panel aar-reel" aria-label="Key moments reel">
          <div className="aar-section-heading">
            <div><p className="eyebrow">Rule-based selection · rules in docs/AAR_RULES.md</p><h3>Key moments reel</h3></div>
            <span>{keyMoments.length} moments</span>
          </div>
          {activeMoment ? (
            <>
              <p className="aar-moment-index" aria-live="polite">{activeMoment.rule} · {keyMoments.indexOf(activeMoment) + 1} of {keyMoments.length}</p>
              <p className="aar-moment-caption" aria-live="polite">{activeMoment.caption}</p>
              <div className="aar-reel-controls">
                <button className="secondary-button" disabled={aarMomentIndex <= 0} onClick={() => setAarMomentIndex((index) => Math.max(0, index - 1))}>Previous moment</button>
                <button className="secondary-button" disabled={aarMomentIndex >= keyMoments.length - 1} onClick={() => setAarMomentIndex((index) => Math.min(keyMoments.length - 1, index + 1))}>Next moment</button>
              </div>
              <ol className="aar-moment-list">{keyMoments.map((moment, index) => (
                <li key={moment.id}>
                  <button className={index === aarMomentIndex ? "active" : ""} onClick={() => setAarMomentIndex(index)}>{moment.rule}</button>
                  <p>{moment.caption}</p>
                </li>
              ))}</ol>
              <details className="debrief-prompts"><summary>Facilitator prompts</summary><ul>{debriefPrompts.default.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul></details>
            </>
          ) : <p className="empty-state">No key moments are recorded yet. Submit a decision and review delivered report outcomes to populate the reel.</p>}
        </section>

        <section className="panel aar-narrative">
          <p className="eyebrow">Rule-based summary from this run's log</p>
          <p>{aarNarrative}</p>
          <div className="aar-export-actions">
            <button className="secondary-button" onClick={() => exportAar("json")}>Export JSON</button>
            <button className="secondary-button" onClick={() => exportAar("csv")}>Export CSV</button>
            <button className="secondary-button" onClick={() => window.print()}>Print / save PDF</button>
          </div>
          {aarExportStatus && <p className="aar-export-status" role="status" aria-live="polite">{aarExportStatus}</p>}
        </section>

        <div className="aar-grid aar-context-grid">
          <section className="panel">
            <h3>Information age · simulated minutes</h3>
            {informationAge.map(({ seatId, reports, age }) => (
              <div className="information-age-row" key={seatId}>
                <strong>{seatId}</strong>
                <div className="information-age-track" aria-label={`${seatId} report arrival timeline`}>
                  {reports.map((report) => (
                    <span
                      key={report.id}
                      className="information-age-mark"
                      style={{ left: `${Math.min(98, (report.arrival / timelineEnd) * 100)}%` }}
                      title={`${report.id} arrived at H+${report.arrival}`}
                    />
                  ))}
                </div>
                <span>{age === null ? "No delivered reports" : `Freshest report age: ${age} min`}</span>
              </div>
            ))}
          </section>
          <section className="panel">
            <h3>Compare conditions · descriptive only</h3>
            <div className="aar-compare-grid">
              <div><strong>Current T1 feed</strong><span>{t1Feed.filter((entry) => !entry.outcome.dropped).length} delivered · {delayedCount} delayed · {droppedCount} dropped</span></div>
              <div><strong>Clear reference</strong><span>{t1Feed.length} delivered · 0 delayed · 0 dropped</span></div>
            </div>
            <p className="small-note">Clear reference assumes the same scripted T1 reports without link effects; it is not a separately recorded run.</p>
          </section>
        </div>

        <div className="aar-tabs">
          {[
            ["what", "What happened"],
            ["why", "Why"],
            ["indicators", "Indicators"],
            ["sustain", "Sustain / improve"],
          ].map(([key, label]) => (
            <button key={key} className={aarTab === key ? "tab-button active" : ""} onClick={() => setAarTab(key as typeof aarTab)}>{label}</button>
          ))}
        </div>

        {aarTab === "what" && (
          <div className="aar-grid">
            <div className="panel">
              <h3>What T1 knew</h3>
              {t1Feed.length ? <ul>{t1Feed.map((entry) => <li key={entry.id}>{entry.source}: {entry.outcome.deliveryText || "Dropped before delivery."}</li>)}</ul> : <p className="empty-state">No T1 reports are recorded in this run.</p>}
            </div>
            <div className="panel">
              <h3>Truth stream · AAR only</h3>
              <ul>{truthFacts.map((fact, idx) => <li key={`${fact}-${idx}`}>{fact}</li>)}</ul>
            </div>
          </div>
        )}

        {aarTab === "why" && (
          <div className="panel reveal-panel">
            <h3>Fog-of-truth comparison</h3>
            <label className="fog-control"><span>Perception vs truth</span><input type="range" min="0" max="100" value={fogLevel} onChange={(event) => setFogLevel(Number(event.target.value))} /></label>
            <p>{aarNarrative}</p>
            {scenario.aarNotes.map((note) => <p key={note.reportId}>{note.explanation}</p>)}
          </div>
        )}

        {aarTab === "indicators" && (
          <div className="panel">
            <h3>Descriptive unvalidated indicators</h3>
            <ul>
              <li>T1 feed: {t1Feed.length} report card(s), {delayedCount} delayed and {droppedCount} dropped.</li>
              <li>T1 triage: {verificationCount} Verify / Discard action(s) recorded.</li>
              <li>Run log: {runLog.length} command and event record(s).</li>
              <li>Decision submitted: {decisionLog ? "yes" : "no"}.</li>
            </ul>
          </div>
        )}

        {aarTab === "sustain" && (
          <div className="panel sustain-panel">
            <h3>Sustain / improve</h3>
            <textarea defaultValue="What helped the team maintain a shared picture despite late or missing reports?" aria-label="Sustain notes" />
            <textarea defaultValue="What verification step or communication action would you try earlier next time?" aria-label="Improve notes" />
          </div>
        )}
      </div>
    );
  };

  const renderBuilder = () => {
    const validateAndSave = () => {
      const result = parseScenarioDefinition(builderText);
      if (!result.ok) {
        setBuilderStatus(`Scenario not saved: ${result.error}`);
        setCustomScenario(null);
        setBuilderPreviewOpen(false);
        return;
      }
      setCustomScenario(result.scenario);
      setBuilderStatus(`Saved ${result.scenario.title} for this browser session.`);
      setBuilderPreviewOpen(false);
      logCommand("ScenarioImported", `Saved local synthetic scenario ${result.scenario.id}.`, `ScenarioImported:${result.scenario.id}:${commandSequence.current + 1}`, "Instructor");
    };
    const generateVariant = () => {
      const parsed = parseScenarioDefinition(builderText);
      const source = parsed.ok ? parsed.scenario : customScenario;
      if (!source) {
        setBuilderStatus(`Cannot generate a variant: ${parsed.ok ? "save a scenario first." : parsed.error}`);
        return;
      }
      try {
        const variant = generateSeededVariant(source, builderSeed);
        setBuilderText(JSON.stringify(variant, null, 2));
        setCustomScenario(variant);
        setBuilderPreviewOpen(false);
        setBuilderStatus(`Rule-based variant from seed ${builderSeed}. The same seed and source produce the same report-delay variation.`);
        logCommand("GenerateScenarioVariant", `Rule-based variant generated from seed ${builderSeed}.`, `ScenarioVariant:${source.id}:${builderSeed}`, "Instructor");
      } catch (error) {
        setBuilderStatus(`Variant generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    const exportScenario = () => {
      const parsed = parseScenarioDefinition(builderText);
      const candidate = parsed.ok ? parsed.scenario : customScenario;
      if (!candidate) {
        setBuilderStatus(`Cannot export scenario: ${parsed.ok ? "save a scenario first." : parsed.error}`);
        return;
      }
      try {
        const blob = new Blob([JSON.stringify(candidate, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${candidate.id}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setBuilderStatus(`Exported ${candidate.title} as local JSON.`);
      } catch (error) {
        setBuilderStatus(`Scenario export failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    return (
      <div className="builder-screen">
        <div className="header-row"><div><p className="eyebrow">Local fixture editor · Rule-based automation</p><h2>Scenario Builder</h2><p className="screen-subtitle">Edit a synthetic scenario definition without network access. Imported definitions are saved in this browser session.</p></div></div>
        <div className="builder-toolbar">
          <label>Variant seed<input aria-label="Variant seed" type="number" min="0" step="1" value={builderSeed} onChange={(event) => setBuilderSeed(Number(event.target.value))} /></label>
          <button className="secondary-button" onClick={generateVariant}>Generate variant</button>
          <button className="secondary-button" onClick={validateAndSave}>Validate &amp; save</button>
          <button className="secondary-button" onClick={exportScenario}>Export JSON</button>
          <label className="builder-import">Import JSON file<input type="file" accept="application/json,.json" onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              setBuilderText(text);
              setBuilderStatus(`Loaded ${file.name} into the editor. Validate it to save.`);
              setBuilderPreviewOpen(false);
            }).catch((error: unknown) => {
              setBuilderStatus(`Scenario import failed: ${error instanceof Error ? error.message : String(error)}`);
            });
          }} /></label>
        </div>
        <div className="builder-layout">
          <section className="panel builder-editor">
            <h3>Scenario definition · JSON</h3>
            <textarea aria-label="Scenario JSON editor" spellCheck={false} value={builderText} onChange={(event) => setBuilderText(event.target.value)} />
          </section>
          <aside className="panel builder-preview">
            <h3>Local preview</h3>
            <p>Rule-based variant from seed. No external services are used.</p>
            {customScenario ? (
              <>
                <strong>{customScenario.title}</strong>
                <p>{customScenario.summary}</p>
                <p>{customScenario.segments.reduce((total, segment) => total + segment.items.length, 0)} scripted item(s) · {customScenario.decisionPoints.length} decision point(s) · {customScenario.map.namedPlaces.length} named map point(s)</p>
                <button className="secondary-button" onClick={() => setBuilderPreviewOpen((open) => !open)}>{builderPreviewOpen ? "Hide definition preview" : "Preview definition"}</button>
                {builderPreviewOpen && <ul>{customScenario.segments.flatMap((segment) => segment.items).map((item) => <li key={`${customScenario.id}:${item.id}`}>H+{item.simOffset} · {item.from} · {item.text}</li>)}</ul>}
              </>
            ) : <p className="empty-state">No custom scenario is saved. Validate and save a JSON definition to show its local preview here.</p>}
            <p className="builder-limit-note">This preview summarizes the definition only; custom scenarios are not wired into the SILENT RIDGE event player.</p>
          </aside>
        </div>
        {builderStatus && <p className="builder-status" role="status" aria-live="polite">{builderStatus}</p>}
      </div>
    );
  };

  const renderEndCard = () => (
    <div className="end-card-screen">
      <div className="end-card-grid">
        <div className="panel architecture-panel">
          <h3>Built in this prototype</h3>
          <ul>
            <li>trainee, instructor and AAR interface</li>
            <li>scenario script format</li>
            <li>event and command contracts</li>
          </ul>
        </div>
        <div className="panel roadmap-panel">
          <h3>Next in our roadmap</h3>
          <ul>
            <li>deterministic simulation engine</li>
            <li>multiplayer server over LAN</li>
            <li>scenario editor</li>
            <li>3D view</li>
          </ul>
        </div>
      </div>
      <section className="panel architecture-flow-panel">
        <p className="eyebrow">Illustrative architecture</p>
        <div className="architecture-flow" aria-label="Truth stream to communication effects to perceived streams to after-action review">
          <span>Truth stream</span><i aria-hidden="true">→</i><span>Comms effects</span><i aria-hidden="true">→</i><span>Perceived streams</span><i aria-hidden="true">→</i><span>AAR</span>
        </div>
      </section>
      <p className="end-card-honesty">Illustrative simulation · scripted exercise. No live data; all scenario content is synthetic. Maps, delivery effects, and operational outcomes are illustrative only.</p>
      <div className="team-footer">
        <label>Team name<input aria-label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} /></label>
        <label>Members / roles<input aria-label="Team members and roles" value={teamRoles} onChange={(event) => setTeamRoles(event.target.value)} /></label>
        <span>SIH 26248</span>
      </div>
    </div>
  );

  return (
    <div className={`app-shell${presenterMode ? " presenter-mode" : ""}`}>
      <Atmosphere mode={effectsMode} />
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">S</span>
          <div>
            <strong>Sudarshan Command Deck</strong>
            <small>Illustrative simulation · scripted exercise</small>
          </div>
        </div>

        <nav className="phase-rail" aria-label="Exercise phases">
          {phaseSteps.map((step, index) => (
            <button
              key={step.label}
              className={`phase-step${index === currentPhase ? " current" : ""}${index < currentPhase ? " completed" : ""}`}
              aria-current={index === currentPhase ? "step" : undefined}
              disabled={index > lastUnlockedPhase}
              onClick={() => navigateTo(step.target)}
            >
              <span className="phase-number">{index < currentPhase ? "✓" : index + 1}</span>
              {step.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="seat-chip">{seat === "Instructor" ? "Instructor · White cell" : `${seat} · ${seat === "T1" ? "Coy Cdr" : "Pl Cdr"}`}</span>
          <button className="header-icon" aria-label="Help" title="Help (?)" onClick={() => setHelpOpen((open) => !open)}>?</button>
          <button className={`header-icon${soundEnabled ? " active" : ""}`} aria-label={soundEnabled ? "Mute sound" : "Enable sound"} title="Sound cues" onClick={() => { const next = !soundEnabled; setSoundEnabled(next); if (next) playUiTick(true); }}>{soundEnabled ? "♫" : "♪"}</button>
          <div className="rehearsal-menu-wrap">
            <button className="header-icon menu-trigger" aria-expanded={rehearsalOpen} aria-label="Open rehearsal menu" onClick={() => setRehearsalOpen((open) => !open)}>⋯</button>
            {rehearsalOpen && (
              <div className="rehearsal-menu">
                <strong>All screens (rehearsal)</strong>
                {rehearsalScreens.map((entry) => <button key={entry.target} onClick={() => navigateTo(entry.target)}>{entry.label}</button>)}
                <label className="effects-setting">Effects
                  <select value={effectsMode} onChange={(event) => setEffectsMode(event.target.value as EffectsMode)}>
                    <option>Full</option><option>Reduced</option><option>Off</option>
                  </select>
                </label>
                <button onClick={() => { const enabled = !presenterMode; setPresenterMode(enabled); if (enabled) setRehearsalOpen(false); }}>{presenterMode ? "Exit presenter mode" : "Presenter mode · Shift+P"}</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="content-area">
        <div className="screen-context">
          <span>PHASE {currentPhase + 1} / 5 · {phaseSteps[currentPhase].label}</span>
          <p>{screenSubtitles[screen]}</p>
          {presenterMode && <small className="presenter-hint">Presenter mode · N next beat · Space pause · 1–4 seat · Shift+R rehearsal</small>}
        </div>
        {screen === "landing" && renderLanding()}
        {screen === "guide" && renderGuide()}
        {screen === "setup" && renderSetup()}
        {screen === "instructor" && renderInstructor()}
        {screen === "t1" && renderTrainee("T1")}
        {screen === "t2" && renderTrainee("T2")}
        {screen === "t3" && renderTrainee("T3")}
        {screen === "aar" && renderAAR()}
        {screen === "end" && renderEndCard()}
        {screen === "brief" && renderOrdersBrief()}
        {screen === "builder" && renderBuilder()}
      </main>
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div className="beat-toast" key={toast}>
              <span>{toast}</span>
              <button onClick={() => { setScreen("t1"); setToasts([]); }}>Show me</button>
              <button aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item !== toast))}>×</button>
            </div>
          ))}
        </div>
      )}
      {audioCaption && <div className="audio-caption" aria-live="polite">{audioCaption}</div>}
      {judgeWalkthroughActive && (
        <section className="judge-walkthrough-card" aria-label="Judge walkthrough" role="status">
          <div className="judge-progress-heading"><strong>JUDGE WALKTHROUGH</strong><span>STEP {judgeWalkthroughStep + 1} OF {judgeWalkthrough.length}</span></div>
          <div className="judge-progress-track"><span style={{ width: `${((judgeWalkthroughStep + 1) / judgeWalkthrough.length) * 100}%` }} /></div>
          <p aria-live="polite">{judgeWalkthrough[judgeWalkthroughStep]}</p>
          <div className="judge-walkthrough-actions">
            <button className="secondary-button" onClick={() => setJudgeWalkthroughActive(false)}>Skip walkthrough</button>
            {judgeWalkthroughStep === judgeWalkthrough.length - 1 && <button className="primary-button" onClick={() => setJudgeWalkthroughActive(false)}>Finish walkthrough</button>}
          </div>
        </section>
      )}
      {helpOpen && (
        <div className="help-popover">
          <strong>Walkthrough</strong>
          <p>Use the mission card, map and reports to understand what this station should do next.</p>
          <button onClick={() => { setTourIndex(0); setHelpOpen(false); }}>Start walkthrough</button>
          <button onClick={() => setHelpOpen(false)}>Close</button>
        </div>
      )}
      {tourIndex !== null && (
        <div className="tour-backdrop" role="presentation">
          <section className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
            <div className="tour-progress">WALKTHROUGH · STEP {tourIndex + 1} OF {tourCaptions.length}</div>
            <h2 id="tour-title">A quick guide to this screen</h2>
            <p aria-live="polite">{tourCaptions[tourIndex]}</p>
            <div className="tour-actions">
              <button className="secondary-button" onClick={() => setTourIndex(null)}>Skip</button>
              <button className="primary-button" onClick={() => setTourIndex(tourIndex + 1 === tourCaptions.length ? null : tourIndex + 1)}>
                {tourIndex + 1 === tourCaptions.length ? "Finish" : "Next"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Engine, type CamMode, type Layers, type PingMark, type Quality, type Theme } from "./engine";
import { Sfx } from "./audio";
import { drawMinimap, fromMap } from "./minimap";
import { AuditChain, ROLE_CAN, checkPassphrase, newSessionId, sealPassphrase, type AuditEntry, type PassVault } from "./security";
import { CALLSIGN, DIRECTOR_BEATS, MAX_T, computeState, labelOf, missionCard, momentsFor, type Card, type Cmd, type OptionId, type SimState, type Viewer, type ViewReport } from "./sim";
import { PLACES, bearing, dist, metres, type XZ } from "./world";
import { AarPanel, Chakra, ThemeToggle, CompassStrip, DecisionPanel, DirectorPanel, Gate, Lobby, LockScreen, MissionCard, ReportsPanel, SECS_PER_MIN, fmtClock, fmtDtg } from "./panels";
import "./battleground.css";

type Phase = "gate" | "lobby" | "drop" | "live" | "review";
interface Toast { id: number; text: string; kind: "flash" | "info" | "warn"; at?: XZ }

const IDLE_MS = 5 * 60 * 1000;
const COMPASS_NAMES = ["FORD", "N BRIDGE", "RIDGE", "FUP"];
const COMPASS_POS: XZ[] = [PLACES.ford, PLACES.bridge, PLACES.ridge, PLACES.fup];

export default function Battleground({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("gate");
  const [operator, setOperator] = useState("");
  const [role, setRole] = useState<Viewer>("T1");
  const [viewer, setViewer] = useState<Viewer>("T1");
  const [locked, setLocked] = useState(false);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [auto, setAuto] = useState(true);
  const [rehearsal, setRehearsal] = useState(true);
  const [quality, setQuality] = useState<Quality>(() => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full"));
  const [sound, setSound] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => {
    try { const v = localStorage.getItem("sudarshan-theme"); if (v === "light" || v === "dark") return v; } catch { /* storage unavailable */ }
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hud, setHud] = useState<SimState | null>(null);
  const [camMode, setCamMode] = useState<CamMode>("free");
  const [selectedId, setSelectedId] = useState("t1");
  const [layers, setLayers] = useState<Layers>({ truth: true, gap: true, jam: true });
  const [pings, setPings] = useState<PingMark[]>([]);
  const [pingArmed, setPingArmed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [caption, setCaption] = useState("");
  const [nvg, setNvg] = useState(false);
  const [mapBig, setMapBig] = useState(false);
  const [legend, setLegend] = useState(false);
  const [menu, setMenu] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);
  const [highlight, setHighlight] = useState<string | undefined>();
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [altitude, setAltitude] = useState(3200);
  const [aarTruth, setAarTruth] = useState(true);
  const [runKey, setRunKey] = useState(0);

  // ---- refs shared with the render loop
  const stage = useRef<HTMLDivElement>(null);
  const labelLayer = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sfx = useRef(new Sfx());
  const auditRef = useRef(new AuditChain());
  const vault = useRef<PassVault | null>(null);
  const cmdsRef = useRef<Cmd[]>([]);
  const tRef = useRef(0);
  const cmdCounter = useRef(0);
  const compassStrip = useRef<HTMLDivElement>(null);
  const compassMarks = useRef<(HTMLDivElement | null)[]>([]);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const bigRef = useRef<HTMLCanvasElement>(null);
  const glitchRef = useRef<HTMLCanvasElement>(null);
  const lastActivity = useRef(Date.now());
  const bc = useRef<BroadcastChannel | null>(null);
  const presence = useRef<Record<string, number>>({});
  const seenReports = useRef(new Set<string>());
  const lastHud = useRef(0);
  const jamBurst = useRef(0);
  const lastBeat = useRef(0);

  const S = useRef({ phase, viewer, role, paused, speed, auto, layers, selectedId, pings, highlight, locked, replayPlaying, aarTruth, sound, rehearsal, operator, mapBig, quality, camMode, theme });
  S.current = { phase, viewer, role, paused, speed, auto, layers, selectedId, pings, highlight, locked, replayPlaying, aarTruth, sound, rehearsal, operator, mapBig, quality, camMode, theme };

  const can = ROLE_CAN[viewer];
  const stateViewer: Viewer = phase === "review" ? "Instructor" : viewer;

  // ------------------------------------------------------------------ commands
  const pushToast = useCallback((text: string, kind: Toast["kind"] = "info", at?: XZ) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind, at }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6500);
  }, []);

  const issue = useCallback((type: Cmd["type"], payload: Record<string, unknown>, actorOverride?: string): boolean => {
    const s = S.current;
    const actor = actorOverride ?? `${s.operator}@${s.viewer}`;
    const id = `${sessionIdRef.current}-${++cmdCounter.current}`;
    const authorised = actorOverride === "AUTO-DIRECTOR (rule-based)"
      || (type === "FireInject" ? ROLE_CAN[s.viewer].inject : type === "SubmitDecision" ? ROLE_CAN[s.viewer].decide : true);
    if (!authorised) {
      auditRef.current.append(id, tRef.current, actor, "DENIED", `${type} not permitted for ${s.viewer}`);
      pushToast(`Not permitted: ${type} for ${s.viewer}`, "warn");
      return false;
    }
    const cmd: Cmd = { id, at: tRef.current, actor, type, payload };
    cmdsRef.current = [...cmdsRef.current, cmd];
    auditRef.current.append(id, cmd.at, actor, type, JSON.stringify(payload).slice(0, 160));
    bc.current?.postMessage({ k: "cmd", cmd });
    return true;
  }, [pushToast]);
  const sessionIdRef = useRef(sessionId); sessionIdRef.current = sessionId;

  // ------------------------------------------------------------------ gate / lock
  const enter = useCallback(async (v: { operator: string; role: Viewer; pass: string }) => {
    vault.current = await sealPassphrase(v.pass);
    setOperator(v.operator); setRole(v.role); setViewer(v.role); setSelectedId(v.role === "T2" ? "t2" : v.role === "T3" ? "t3" : "t1");
    setLayers({ truth: v.role === "Instructor", gap: v.role === "Instructor", jam: v.role === "Instructor" });
    const sid = newSessionId(); setSessionId(sid); sessionIdRef.current = sid;
    auditRef.current.append(`${sid}-open`, 0, v.operator, "SessionOpen", `station ${v.role}; synthetic data; offline`);
    lastActivity.current = Date.now();
    setPhase("lobby");
  }, []);

  const panic = useCallback(() => {
    auditRef.current.wipe(); cmdsRef.current = []; tRef.current = 0; vault.current = null; seenReports.current.clear();
    setPings([]); setToasts([]); setMenu(false); setLocked(false); setHud(null); setChainOk(null); setPhase("gate");
  }, []);

  // ------------------------------------------------------------------ engine lifecycle
  useEffect(() => {
    if (phase === "gate" || !stage.current || !labelLayer.current) return;
    const eng = new Engine(stage.current, labelLayer.current, quality, S.current.theme);
    engineRef.current = eng;
    eng.setOrbitIdle(S.current.phase === "lobby");
    eng.onPick = (p) => {
      const s = S.current;
      if (pingArmedRef.current) { addPing(p); return; }
      const f = hudRef.current?.friendlies.filter((x) => x.kind !== "uas").map((x) => ({ x, d: dist(x.pos, p) })).sort((a, b) => a.d - b.d)[0];
      if (f && f.d < 9) setSelectedId(f.x.id === "res" ? "res" : f.x.id);
      void s;
    };
    eng.onDropProgress = (alt, done) => { setAltitude(alt); if (done) startLive(); };
    return () => { eng.dispose(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "gate", quality, runKey]);
  const pingArmedRef = useRef(false); pingArmedRef.current = pingArmed;
  const hudRef = useRef<SimState | null>(null); hudRef.current = hud;

  useEffect(() => { engineRef.current?.setOrbitIdle(phase === "lobby"); }, [phase]);
  useEffect(() => {
    engineRef.current?.setTheme(theme);
    try { localStorage.setItem("sudarshan-theme", theme); } catch { /* per-viewer convenience only */ }
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  const addPing = useCallback((p: XZ) => {
    const mark: PingMark = { id: "p" + Date.now(), pos: p, t0: performance.now() / 1000, owner: S.current.viewer === "Instructor" ? "WHITE CELL" : S.current.viewer };
    setPings((cur) => [...cur.slice(-4), mark]); setPingArmed(false);
    sfx.current.ping(); issue("Ping", { x: +p[0].toFixed(1), z: +p[1].toFixed(1), kind: "marker" });
    bc.current?.postMessage({ k: "ping", mark });
    setTimeout(() => setPings((cur) => cur.filter((x) => x.id !== mark.id)), 22000);
  }, [issue]);

  const startLive = useCallback(() => {
    if (S.current.phase === "live" || S.current.phase === "review") return;
    S.current.phase = "live"; // guard against a second call (drop finishing after Skip)
    cmdsRef.current = []; tRef.current = 0; seenReports.current.clear(); lastBeat.current = 0;
    issue("DeployStart", { viewer: S.current.viewer });
    setPaused(false); setPhase("live"); setReplayPlaying(false);
    const eng = engineRef.current;
    if (eng) { if (S.current.viewer === "Instructor") { eng.focus(PLACES.ford, 150); eng.setMode("tactical"); } else eng.follow(S.current.selectedId); }
    bc.current?.postMessage({ k: "hello", role: S.current.viewer });
  }, [issue]);

  const deploy = useCallback(() => {
    sfx.current.muted = !S.current.sound; sfx.current.start(); sfx.current.setMuted(!S.current.sound); sfx.current.drop();
    cmdsRef.current = []; tRef.current = 0;
    const e = engineRef.current; if (e) { e.setOrbitIdle(false); e.focus(PLACES.ford, 80); e.startDrop(6.5); }
    setPhase("drop");
    auditRef.current.append(`${sessionIdRef.current}-deploy-${Date.now()}`, 0, S.current.operator, "Deploy", `seat ${S.current.viewer}; auto-director ${S.current.auto ? "on" : "off"}`);
  }, []);

  // ------------------------------------------------------------------ main loop
  useEffect(() => {
    let raf = 0, last = performance.now(), frame = 0;
    const loop = (nowMs: number) => {
      raf = requestAnimationFrame(loop);
      const s = S.current; const eng = engineRef.current;
      const dt = Math.min(0.2, (nowMs - last) / 1000); last = nowMs; frame++;
      if (!eng || s.phase === "gate") return;
      if (s.locked) return;

      // clock
      if (s.phase === "live" && !s.paused) tRef.current += (dt * s.speed) / SECS_PER_MIN;
      if (s.phase === "review" && s.replayPlaying) { tRef.current += (dt * 3) / SECS_PER_MIN; }
      const sv: Viewer = s.phase === "review" ? "Instructor" : s.viewer;
      const state = computeState(cmdsRef.current, tRef.current, sv);

      // rule-based Auto-Director
      if (s.phase === "live" && s.auto && !s.paused && (s.viewer === "Instructor" || !presenceHasInstructor())) {
        for (const b of DIRECTOR_BEATS) {
          if (b.card && state.t >= b.atMinute && state.injected[b.card as Card] === undefined && !cmdsRef.current.some((c) => c.type === "FireInject" && c.payload.card === b.card)) {
            issue("FireInject", { card: b.card, target: "T2→T1" }, "AUTO-DIRECTOR (rule-based)");
            if (b.card === "JAM_NET") { jamBurst.current = 0.9; sfx.current.jam(); }
          }
        }
      }
      if (s.phase === "live" && state.over) { setPhase("review"); setPaused(true); setReplayPlaying(false); tRef.current = state.endT; setLayers({ truth: true, gap: true, jam: true }); auditRef.current.append(`${sessionIdRef.current}-end`, state.endT, "SYSTEM", "ExerciseEnd", "review opened"); }

      // default-order audit line
      if (s.phase === "live" && state.decision.defaulted) auditRef.current.append(`${sessionIdRef.current}-default`, state.decision.at ?? 0, "SYSTEM", "DefaultOrder", `window closed; ${labelOf(state.decision.optionId as OptionId)}`);

      // toasts & sounds for newly delivered reports (trainee T1 only; instructor sees injects)
      if (s.phase === "live" && s.viewer === "T1") for (const r of state.reports) {
        if (seenReports.current.has(r.id)) continue; seenReports.current.add(r.id);
        if (tRef.current > 0.05 || true) {
          sfx.current.squelch(); if (r.precedence === "FLASH") sfx.current.flash();
          setToasts((t) => [...t.slice(-3), { id: Date.now() + Math.random(), text: `${r.precedence} report from ${r.callsign}`, kind: r.precedence === "FLASH" ? "flash" : "info", at: r.pos }]);
        }
      }
      // heartbeat in the last 30 real seconds of the decision window
      if (s.phase === "live" && state.decision.status === "open" && state.decision.remaining * SECS_PER_MIN <= 30 && Math.floor(nowMs / 1000) !== lastBeat.current) { lastBeat.current = Math.floor(nowMs / 1000); sfx.current.heartbeat(); }
      const myQ = sv === "T2" ? state.friendlies[1].linkQ : sv === "T1" ? 1 - (1 - state.friendlies[1].linkQ) * 0.55 : 1;
      sfx.current.setLinkDegradation(myQ);

      // draw
      const ui = { selectedId: s.selectedId, layers: { truth: s.phase === "review" ? s.aarTruth : s.layers.truth, gap: s.phase === "review" ? s.aarTruth : s.layers.gap, jam: s.layers.jam }, pings: s.pings, highlightTrack: s.highlight, viewerSeat: s.viewer };
      eng.render(state, ui, dt);
      hudRef.current = state;

      // compass + minimap + glitch (direct DOM, every frame / every 2nd)
      const ci = eng.cameraInfo; const bear = (((-ci.yaw * 180) / Math.PI) % 360 + 360) % 360;
      if (compassStrip.current) compassStrip.current.style.transform = `translateX(${300 - (bear + 360) * 5}px)`;
      COMPASS_POS.forEach((p, i) => {
        const el = compassMarks.current[i]; if (!el) return;
        const delta = ((bearing(ci.target, p) - bear + 540) % 360) - 180;
        el.style.display = Math.abs(delta) > 59 ? "none" : ""; el.style.left = `${300 + delta * 5}px`;
        const sm = el.querySelector("small"); if (sm) sm.textContent = `${metres(dist(ci.target, p))} m`;
      });
      if (frame % 2 === 0) {
        const mini = miniRef.current; const camInfo = { target: ci.target, yaw: ci.yaw, dist: ci.dist };
        const opts = { cam: camInfo, pings: s.pings, showTruth: s.phase === "review" ? s.aarTruth : s.layers.truth, selectedId: s.selectedId };
        if (mini) drawMinimap(mini, state, opts);
        if (s.mapBig && bigRef.current) drawMinimap(bigRef.current, state, opts);
      }
      const gl = glitchRef.current;
      if (gl && frame % 5 === 0) {
        const q = s.phase === "live" ? (sv === "T2" ? state.friendlies[1].linkQ : sv === "T1" ? 1 - (1 - state.friendlies[1].linkQ) * 0.6 : 1) : 1;
        jamBurst.current = Math.max(0, jamBurst.current - dt * 5 * 1.5);
        const inten = s.quality === "off" ? 0 : Math.min(1, (1 - q) * 1.1 + jamBurst.current);
        gl.style.opacity = String(inten * 0.26);
        if (inten > 0.04) { const g = gl.getContext("2d")!; const img = g.createImageData(gl.width, gl.height); for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255; } g.putImageData(img, 0, 0); }
        gl.style.transform = inten > 0.5 && Math.random() < 0.25 ? `translateY(${(Math.random() - 0.5) * 10}px) scaleX(1.02)` : "";
      }
      // HUD state at ~8 Hz
      if (nowMs - lastHud.current > 120) { lastHud.current = nowMs; setHud(state); setCamMode(eng.mode); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue]);

  function presenceHasInstructor() { return Date.now() - (presence.current["Instructor"] ?? 0) < 4000 && S.current.viewer !== "Instructor"; }

  // ------------------------------------------------------------------ multi-window sync (same browser, no server)
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("sudarshan-battleground"); bc.current = ch;
    const seen = new Set<string>();
    ch.onmessage = (ev) => {
      const m = ev.data as { k: string; [x: string]: unknown };
      if (m.k === "presence") { presence.current[String(m.role)] = Date.now(); }
      else if (m.k === "cmd") {
        const c = m.cmd as Cmd; if (seen.has(c.id) || cmdsRef.current.some((x) => x.id === c.id)) return; seen.add(c.id);
        cmdsRef.current = [...cmdsRef.current, c]; auditRef.current.append("remote-" + c.id, c.at, c.actor, c.type, "(from another window) " + JSON.stringify(c.payload).slice(0, 120));
        if (c.type === "FireInject" && c.payload.card === "JAM_NET") { jamBurst.current = 0.9; sfx.current.jam(); }
      } else if (m.k === "clock" && S.current.viewer !== "Instructor" && S.current.phase === "live") {
        if (Math.abs(tRef.current - (m.t as number)) > 0.12) tRef.current = m.t as number;
        setPaused(!!m.paused); setSpeed(m.speed as number);
      } else if (m.k === "ping") { const mk = m.mark as PingMark; setPings((cur) => cur.some((x) => x.id === mk.id) ? cur : [...cur.slice(-4), mk]); setTimeout(() => setPings((cur) => cur.filter((x) => x.id !== mk.id)), 22000); }
      else if (m.k === "hello" && S.current.viewer === "Instructor" && S.current.phase === "live") { cmdsRef.current.forEach((c) => ch.postMessage({ k: "cmd", cmd: c })); }
    };
    const id = setInterval(() => {
      if (S.current.phase !== "gate") ch.postMessage({ k: "presence", role: S.current.viewer });
      if (S.current.phase === "live" && S.current.viewer === "Instructor") ch.postMessage({ k: "clock", t: tRef.current, paused: S.current.paused, speed: S.current.speed });
      const now = Date.now(); const o: Record<string, boolean> = {};
      for (const [r, ts] of Object.entries(presence.current)) o[r] = now - ts < 4000;
      setOnline((prev) => (JSON.stringify(prev) === JSON.stringify(o) ? prev : o));
    }, 1000);
    return () => { clearInterval(id); ch.close(); bc.current = null; };
  }, []);

  // ------------------------------------------------------------------ audit mirror, idle lock, sfx captions
  useEffect(() => { const a = auditRef.current; a.onChange = () => setAudit([...a.entries]); sfx.current.onCaption = (t) => { setCaption(t); setTimeout(() => setCaption((c) => (c === t ? "" : c)), 1400); }; }, []);
  useEffect(() => {
    const mark = () => { lastActivity.current = Date.now(); };
    window.addEventListener("pointermove", mark); window.addEventListener("keydown", mark); window.addEventListener("pointerdown", mark);
    const id = setInterval(() => { if (S.current.phase !== "gate" && !S.current.locked && vault.current && Date.now() - lastActivity.current > IDLE_MS) { setLocked(true); auditRef.current.append(`${sessionIdRef.current}-lock-${Date.now()}`, tRef.current, "SYSTEM", "SessionLocked", "idle timeout"); } }, 5000);
    return () => { window.removeEventListener("pointermove", mark); window.removeEventListener("keydown", mark); window.removeEventListener("pointerdown", mark); clearInterval(id); };
  }, []);
  useEffect(() => { sfx.current.setMuted(!sound); }, [sound]);

  // ------------------------------------------------------------------ actions
  const fireInject = useCallback((card: Card) => {
    if (issue("FireInject", { card, target: card === "JAM_NET" ? "T2→T1" : "ADJACENT→T1" })) { if (card === "JAM_NET") { jamBurst.current = 0.9; sfx.current.jam(); } else sfx.current.flash(); }
  }, [issue]);
  const submitDecision = useCallback((d: { optionId: OptionId; rationale: string; confidence: number; cites: string[] }) => {
    if (issue("SubmitDecision", d as unknown as Record<string, unknown>)) { sfx.current.ui(); pushToast(`Order issued: ${labelOf(d.optionId)}`, "info"); }
  }, [issue, pushToast]);
  const locate = useCallback((r: ViewReport) => { engineRef.current?.focus(r.pos, 42); setHighlight(r.id); setTimeout(() => setHighlight((h) => (h === r.id ? undefined : h)), 3500); }, []);
  const verify = useCallback((r: ViewReport) => { if (r.verified) return; issue("VerifyReport", { reportId: r.id, from: r.callsign }); sfx.current.ui(); pushToast(`Verification requested for ${r.callsign} report (logged)`, "info"); }, [issue, pushToast]);
  const setCam = (m: CamMode) => { engineRef.current?.setMode(m); setCamMode(m); };
  const doExport = useCallback(async () => {
    const json = await auditRef.current.exportJson({ session: sessionIdRef.current, operator: S.current.operator, station: S.current.viewer, exercise: "SILENT RIDGE", commands: cmdsRef.current.length });
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `silent-ridge-${sessionIdRef.current}-audit.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, []);
  const doVerify = useCallback(async () => { const r = await auditRef.current.verify(); setChainOk(r.ok); }, []);

  // ------------------------------------------------------------------ keyboard
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const s = S.current; if (s.phase === "gate" || s.locked) return;
      const t = e.target as HTMLElement; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey && e.shiftKey && k === "x") { e.preventDefault(); panic(); return; }
      if (k === "escape") { setMenu((m) => !m); setPingArmed(false); return; }
      if (s.phase !== "live" && s.phase !== "review") return;
      const eng = engineRef.current; const live = s.phase === "live";
      if (k === "v") { const order: CamMode[] = ["free", "follow", "tactical"]; const nxt = order[(order.indexOf(s.camMode) + 1) % 3]; if (nxt === "follow") eng?.follow(s.selectedId); else eng?.setMode(nxt); }
      else if (k === "f") eng?.follow(s.selectedId);
      else if (k === "tab") { e.preventDefault(); const ids = (hudRef.current?.friendlies ?? []).map((f) => f.id); const n = ids[(ids.indexOf(s.selectedId) + 1) % ids.length]; if (n) { setSelectedId(n); eng?.follow(n); } }
      else if (k === "m") setMapBig((b) => !b);
      else if (k === "r") setReportsOpen((b) => !b);
      else if (k === "l") setLegend((b) => !b);
      else if (k === "n") setNvg((b) => !b);
      else if (k === "x") setPingArmed((b) => !b);
      else if (k === "t" && (ROLE_CAN[s.viewer].truth || !live)) setLayers((l) => ({ ...l, truth: !l.truth }));
      else if (k === "g" && (ROLE_CAN[s.viewer].truth || !live)) setLayers((l) => ({ ...l, gap: !l.gap }));
      else if (k === "j" && ROLE_CAN[s.viewer].truth) setLayers((l) => ({ ...l, jam: !l.jam }));
      else if ((k === "p" || k === " ") && live && ROLE_CAN[s.viewer].pause) { e.preventDefault(); setPaused((p) => !p); }
      else if (/^[1-5]$/.test(k) && live) hotbarRef.current[Number(k) - 1]?.run();
    };
    window.addEventListener("keydown", kd); return () => window.removeEventListener("keydown", kd);
  }, [panic]);

  // ------------------------------------------------------------------ hotbar
  interface Slot { key: string; label: string; icon: string; run: () => void; on?: boolean; disabled?: boolean; hint?: string }
  const hotbar: Slot[] = useMemo(() => {
    const unverified = hud?.reports.filter((r) => !r.verified).sort((a, b) => b.deliveredAt - a.deliveredAt)[0];
    if (viewer === "Instructor") return [
      { key: "1", label: "Jam Net", icon: "≋", run: () => fireInject("JAM_NET"), disabled: !!hud?.injected.JAM_NET, hint: "Interfere with HAWK 2 → TIGER 1" },
      { key: "2", label: "Spoof Contact", icon: "◈", run: () => fireInject("SPOOF"), disabled: !!hud?.injected.SPOOF, hint: "Fabricated report at N BRIDGE" },
      { key: "3", label: "Truth", icon: "◉", run: () => setLayers((l) => ({ ...l, truth: !l.truth })), on: layers.truth },
      { key: "4", label: "Pic. gap", icon: "⟷", run: () => setLayers((l) => ({ ...l, gap: !l.gap })), on: layers.gap },
      { key: "5", label: "Ping", icon: "▼", run: () => setPingArmed((p) => !p), on: pingArmed },
    ];
    if (viewer === "T1") return [
      { key: "1", label: "Verify", icon: "✓", run: () => unverified && verify(unverified), disabled: !unverified, hint: "Mark the newest report for verification" },
      { key: "2", label: "Ping", icon: "▼", run: () => setPingArmed((p) => !p), on: pingArmed, hint: "Then click the ground" },
      { key: "3", label: "Request SITREP", icon: "✉", run: () => { issue("Ping", { kind: "sitrep-request", to: "HAWK 2" }); pushToast("SITREP requested from HAWK 2 (logged). Replies follow the scripted timeline.", "info"); sfx.current.squelch(); } },
      { key: "4", label: "Go to FORD", icon: "◎", run: () => engineRef.current?.focus(PLACES.ford, 55) },
      { key: "5", label: "Night vision", icon: "☾", run: () => setNvg((n) => !n), on: nvg },
    ];
    return [
      { key: "1", label: "Ping", icon: "▼", run: () => setPingArmed((p) => !p), on: pingArmed },
      { key: "2", label: "Go to FORD", icon: "◎", run: () => engineRef.current?.focus(PLACES.ford, 55) },
      { key: "3", label: "Follow me", icon: "⌖", run: () => { const id = viewer === "T2" ? "t2" : "t3"; setSelectedId(id); engineRef.current?.follow(id); } },
      { key: "4", label: "Night vision", icon: "☾", run: () => setNvg((n) => !n), on: nvg },
      { key: "5", label: "Map", icon: "▦", run: () => setMapBig((b) => !b), on: mapBig },
    ];
  }, [viewer, hud, layers, pingArmed, nvg, mapBig, fireInject, verify, issue, pushToast]);
  const hotbarRef = useRef<{ run: () => void }[]>([]); hotbarRef.current = hotbar;

  // ------------------------------------------------------------------ derived
  const card = hud ? missionCard(hud) : null;
  const moments = useMemo(() => (phase === "review" ? momentsFor(cmdsRef.current) : []), [phase, runKey, hud === null]);
  const watermark = useMemo(() => {
    const txt = `${operator || "OPERATOR"} · ${sessionId} · TRAINING · SYNTHETIC`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'><text x='20' y='120' transform='rotate(-24 210 110)' fill='${theme === "dark" ? "white" : "black"}' fill-opacity='0.05' font-family='Consolas,monospace' font-size='13' letter-spacing='2'>${txt.replace(/[<>&']/g, "")}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [operator, sessionId, theme]);
  const inLive = phase === "live" || phase === "review";
  const feedLatest = hud ? hud.feed.slice(-6) : [];
  const decisionOpen = phase === "live" && hud?.decision.status === "open";
  const canSeeDirector = viewer === "Instructor" && phase === "live";
  const reportsEmpty = hud ? (hud.t < 0.2 ? `No reports yet. First scheduled report arrives at ${fmtClock(0)}.` : "No reports have reached you yet. Silence is information too — ask: is the link up?") : "";
  const decisionSummary = hud?.decision.optionId ? `${hud.decision.defaulted ? "Window closed — default order" : "T1 ordered"}: ${labelOf(hud.decision.optionId)}. ${hud.decision.consequence ?? ""}` : "No decision was recorded.";

  return (
    <div data-theme={theme} className={"bg-root" + (nvg ? " nvg" : "") + (quality === "off" ? " fx-off" : "")} style={{ ["--wm" as string]: watermark }} data-phase={phase} data-testid="battleground">
      <div className={"bg-stage" + (locked ? " hidden" : "")} ref={stage} />
      <div className="bg-labels" ref={labelLayer} />
      <canvas className="bg-glitch" ref={glitchRef} width={320} height={180} aria-hidden="true" />
      <div className="bg-vignette" aria-hidden="true" />
      <div className="bg-watermark" aria-hidden="true" />

      {phase !== "gate" && (
        <div className="class-banner">
          <Chakra /><span className="tricolour" aria-hidden="true"><i /><i /><i /></span>
          <b>TRAINING · SYNTHETIC DATA · NOT FOR OPERATIONAL USE</b>
          <span>Illustrative simulation · scripted exercise</span>
          <span className="sess">{operator} · {sessionId} · 🔒 offline<ThemeToggle theme={theme} onToggle={toggleTheme} /></span>
        </div>
      )}

      {phase === "gate" && <><ThemeToggle floating theme={theme} onToggle={toggleTheme} /><Gate onEnter={enter} /></>}
      {phase === "lobby" && <Lobby role={viewer} online={online} auto={auto} setAuto={setAuto} rehearsal={rehearsal} setRehearsal={setRehearsal} quality={quality} setQuality={setQuality} sound={sound} setSound={setSound} onDeploy={deploy} onExit={onExit} />}

      {phase === "drop" && (
        <div className="drop-hud">
          <p className="gate-kicker">DEPLOYING · SILENT RIDGE AO</p>
          <div className="alt"><b>{altitude.toLocaleString()}</b><span>m AGL</span></div>
          <div className="alt-bar"><i style={{ height: `${Math.min(100, (altitude / 3300) * 100)}%` }} /></div>
          <button className="bg-ghost" onClick={() => { engineRef.current?.endDrop(); startLive(); }}>Skip ›</button>
        </div>
      )}

      {inLive && hud && (
        <>
          <div className="lcol">
          <div className="tl">
            <div className="clock">
              <div><b className="mono">{fmtClock(hud.t)}</b><small className="mono">{fmtDtg(hud.t)}</small></div>
              <span className={"status " + (paused ? "paused" : phase === "review" ? "review" : "live")}>{phase === "review" ? "REVIEW" : paused ? "PAUSED" : "LIVE"}</span>
              {phase === "live" && <span className="spd mono">{speed}×</span>}
            </div>
            <div className="seatline">
              <span>{viewer === "Instructor" ? "WHITE CELL" : `${viewer} · ${CALLSIGN[viewer]}`}</span>
              {rehearsal && phase === "live" && (
                <select aria-label="Switch seat (rehearsal)" value={viewer} onChange={(e) => { const v = e.target.value as Viewer; setViewer(v); auditRef.current.append(`${sessionId}-seat-${Date.now()}`, tRef.current, operator, "SeatSwitch", `rehearsal switch to ${v}`); setSelectedId(v === "T2" ? "t2" : v === "T3" ? "t3" : "t1"); setLayers({ truth: v === "Instructor", gap: v === "Instructor", jam: v === "Instructor" }); }}>
                  <option value="T1">T1</option><option value="T2">T2</option><option value="T3">T3</option><option value="Instructor">Instructor</option>
                </select>
              )}
            </div>
          </div>
                    <aside className="squad" aria-label="Squad">
            {hud.friendlies.map((f) => {
              const q = f.linkQ, cls = q > 0.7 ? "ok" : q > 0.35 ? "warn" : "bad";
              const seatOnline = f.seat === viewer || online[f.seat];
              return (
                <button key={f.id} className={"sq" + (selectedId === f.id ? " sel" : "")} onClick={() => { setSelectedId(f.id); engineRef.current?.follow(f.id); }}>
                  <span className={"bg-lamp " + (seatOnline ? "on" : "")} title={seatOnline ? "seat online" : "seat simulated by script"} />
                  <div><span className="sq-top"><b>{f.callsign}</b><em className={"st " + cls}>{q > 0.7 ? "CLEAR" : q > 0.35 ? "DEGRADED" : "LOST"}</em></span><small>{f.role}</small>
                    <div className={"linkbar " + cls}><i style={{ width: `${Math.max(6, Math.round(q * 100))}%` }} /></div>
                  </div>
                </button>
              );
            })}
          </aside>

          {card && phase === "live" && <MissionCard card={card} open={cardOpen} setOpen={setCardOpen} />}
                    <div className="minimap">
            <canvas ref={miniRef} width={300} height={259} onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); engineRef.current?.focus(fromMap(((e.clientX - r.left) / r.width) * 300, ((e.clientY - r.top) / r.height) * 259, 300, 259), 70); }} aria-label="Minimap. Click to move the camera." />
            <span className="mm-n">N</span>
            <div className="mm-bar">
              {(["free", "follow", "tactical"] as CamMode[]).map((m) => <button key={m} className={camMode === m ? "on" : ""} onClick={() => (m === "follow" ? engineRef.current?.follow(selectedId) : setCam(m))}>{m === "free" ? "Free" : m === "follow" ? "Follow" : "Top"}</button>)}
              <button onClick={() => setMapBig(true)} aria-label="Expand map">⤢</button>
            </div>
          </div>          </div>

          <CompassStrip stripRef={compassStrip} markerRefs={compassMarks} names={COMPASS_NAMES} />

          {/* right column */}
          {phase === "live" && <div className="rcol">
            <div className={"feed" + (hud.friendlies[1].linkQ < 0.4 && viewer !== "Instructor" ? " static" : "")} aria-live="polite">
              {feedLatest.length === 0 && <p className="empty">Comms feed. Messages appear here as they reach you.</p>}
              {feedLatest.map((f) => <div key={f.id} className={"fe " + f.kind + (f.precedence ? " " + f.precedence.toLowerCase() : "")}><small className="mono">{fmtClock(f.t)}</small><span>{f.text}</span></div>)}
            </div>
            {canSeeDirector && <DirectorPanel state={hud} auto={auto} setAuto={setAuto} speed={speed} setSpeed={setSpeed} paused={paused} setPaused={setPaused} fire={fireInject} canInject={can.inject} audit={audit} chainOk={chainOk} verify={doVerify} exportAudit={doExport} layers={layers} setLayers={setLayers} />}
            {phase === "live" && viewer !== "Instructor" && reportsOpen && viewer === "T1" && <ReportsPanel reports={hud.reports} now={hud.t} onLocate={locate} onVerify={verify} empty={reportsEmpty} />}
            {phase === "live" && (viewer === "T2" || viewer === "T3") && (
              <section className="reports-panel"><header><b>OUTBOX</b><span>{hud.outbox.length}</span></header>
                {hud.outbox.length === 0 && <p className="empty">Nothing sent yet. When your platoon observes something, the scripted report appears here.</p>}
                <ul>{hud.outbox.map((o) => <li key={o.id} className="rep"><div className="rep-top"><b>{fmtClock(o.t)}</b><span className={"age " + (o.status === "no-ack" ? "warn" : "")}>{o.status === "ack" ? "acknowledged" : o.status === "no-ack" ? "NO ACKNOWLEDGEMENT" : "sending…"}</span></div><p>{o.text}</p></li>)}</ul></section>
            )}
          </div>}

          {/* decision */}
          {decisionOpen && <DecisionPanel state={hud} reports={hud.reports} canDecide={can.decide} onSubmit={submitDecision} />}

          {/* review */}
          {phase === "review" && (
            <AarPanel moments={moments} t={hud.t} endT={hud.endT} setT={(t) => { tRef.current = t; }} playing={replayPlaying} setPlaying={setReplayPlaying} truth={aarTruth} setTruth={setAarTruth}
              onExport={doExport} onVerify={doVerify} chainOk={chainOk} decisionSummary={decisionSummary}
              onRestart={() => { cmdsRef.current = []; tRef.current = 0; setRunKey((k) => k + 1); setPhase("lobby"); setPaused(false); }} onExit={onExit} />
          )}

          {/* hotbar */}
          {phase === "live" && (
            <div className="hotbar" role="toolbar" aria-label="Actions">
              {hotbar.map((s) => (
                <button key={s.key} className={"slot" + (s.on ? " on" : "") + (s.disabled ? " dis" : "")} disabled={s.disabled} onClick={s.run} title={s.hint ?? s.label}>
                  <kbd>{s.key}</kbd><span className="ic" aria-hidden="true">{s.icon}</span><small>{s.label}</small>
                </button>
              ))}
            </div>
          )}

          {pingArmed && <div className="ping-hint">PING MODE — click the ground to place a marker · Esc to cancel</div>}

          <div className="toasts" aria-live="polite">
            {toasts.map((t) => <div key={t.id} className={"toast " + t.kind}><span>{t.text}</span>{t.at && <button onClick={() => engineRef.current?.focus(t.at!, 45)}>Show me</button>}</div>)}
          </div>
          {caption && <div className="caption">{caption}</div>}

          {mapBig && (
            <div className="bigmap" role="dialog" aria-label="Tactical map">
              <header><b>TACTICAL MAP · SILENT RIDGE</b><small>scale: 1 grid ≈ {metres(220 / 6)} m · click to move camera</small><button onClick={() => setMapBig(false)} aria-label="Close map">×</button></header>
              <canvas ref={bigRef} width={900} height={777} onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); engineRef.current?.focus(fromMap(((e.clientX - r.left) / r.width) * 900, ((e.clientY - r.top) / r.height) * 777, 900, 777), 70); setMapBig(false); }} />
            </div>
          )}

          {legend && (
            <div className="legend" role="dialog" aria-label="Map legend"><header><b>LEGEND</b><button onClick={() => setLegend(false)}>×</button></header>
              <ul>
                <li><i className="sw friend" /> Friendly element (link bar = how well you can hear it)</li>
                <li><i className="sw host" /> Reported contact — a diamond with a ring. The ring grows as the report ages.</li>
                <li><i className="sw stale" /> Faded contact = old report. Silence is not safety.</li>
                <li><i className="sw uas" /> UAS (EAGLE 5) with sensor cone</li>
                <li><i className="sw fordsw" /> Amber beam = objective (FORD)</li>
                {viewer === "Instructor" || phase === "review" ? (<>
                  <li><i className="sw truth" /> <span className="cy">Cyan = truth layer</span> — real positions (Instructor / review only)</li>
                  <li><i className="sw jam" /> Red dome = scripted interference zone</li>
                </>) : null}
              </ul>
            </div>
          )}
        </>
      )}

      {inLive && (
        <div className="util">
          <button onClick={() => setLegend((l) => !l)} title="Legend (L)">L</button>
          <button onClick={() => { setSound((s) => !s); }} title="Sound" aria-pressed={sound}>{sound ? "♪" : "♪̸"}</button>
          <button onClick={() => setMenu(true)} title="Menu (Esc)">⋯</button>
        </div>
      )}

      {menu && phase !== "gate" && (
        <div className="bg-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="menu-card">
            <header><h2>Menu</h2><button onClick={() => setMenu(false)} aria-label="Close menu">×</button></header>
            <div className="menu-cols">
              <section><h3>Controls</h3>
                <ul className="keys"><li><kbd>W A S D</kbd> move camera</li><li><kbd>Drag</kbd> orbit · <kbd>Shift+drag</kbd> pan</li><li><kbd>Wheel</kbd> zoom</li><li><kbd>V</kbd> view · <kbd>F</kbd> follow · <kbd>Tab</kbd> next unit</li><li><kbd>X</kbd> ping · <kbd>R</kbd> reports · <kbd>M</kbd> map · <kbd>N</kbd> night vision</li><li><kbd>1</kbd>–<kbd>5</kbd> actions · <kbd>L</kbd> legend</li><li><kbd>T</kbd> <kbd>G</kbd> <kbd>J</kbd> truth · gap · zone (Instructor)</li><li><kbd>P</kbd> pause (Instructor)</li></ul>
              </section>
              <section><h3>Security status</h3>
                <ul className="sec">
                  <li className="ok">Runtime network calls: none (offline)</li>
                  <li className="ok">Data: synthetic only · no storage written</li>
                  <li className="ok">Audit chain: {audit.length} entries · head {auditRef.current.head().slice(0, 14)}…</li>
                  <li className="ok">Role gate: {viewer === "Instructor" ? "truth layer enabled (White Cell)" : "truth withheld until review"}</li>
                  <li className="ok">Idle lock: {IDLE_MS / 60000} min · passphrase to resume</li>
                  <li className={document.querySelector('meta[http-equiv="Content-Security-Policy"]') ? "ok" : "warn"}>Content-Security-Policy: {document.querySelector('meta[http-equiv="Content-Security-Policy"]') ? "enforced (production build)" : "applied in the production build"}</li>
                  <li className="note">Client-side hardening for a training prototype. Not an accreditation; real deployment needs server-side authentication, signed builds and a formal review.</li>
                </ul>
                <div className="menu-actions">
                  <button onClick={doVerify}>Verify audit chain</button><span className={"chain " + (chainOk === null ? "" : chainOk ? "ok" : "bad")}>{chainOk === null ? "" : chainOk ? "intact ✓" : "BROKEN"}</span>
                  <button onClick={doExport}>Export sealed audit</button>
                </div>
              </section>
              <section><h3>Display</h3>
                <label className="row">Effects <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)}><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></select></label>
                <label className="row">Theme <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}><option value="dark">Dark (dusk)</option><option value="light">Light (day)</option></select></label>
                <label className="row"><input type="checkbox" checked={nvg} onChange={(e) => setNvg(e.target.checked)} /> Night vision</label>
                <label className="row"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> Sound (captions on)</label>
              </section>
            </div>
            <footer>
              <button onClick={() => { setLocked(true); setMenu(false); auditRef.current.append(`${sessionId}-lock-${Date.now()}`, tRef.current, operator, "SessionLocked", "manual"); }}>Lock now</button>
              <button className="danger" onClick={panic}>Panic wipe (Ctrl+Shift+X)</button>
              <span className="spacer" />
              <button onClick={() => { setMenu(false); onExit(); }}>Exit to Command Deck</button>
              <button className="bg-primary" onClick={() => setMenu(false)}>Resume</button>
            </footer>
          </div>
        </div>
      )}

      {locked && vault.current && <LockScreen operator={operator} onUnlock={async (p) => { const ok = await checkPassphrase(p, vault.current!); if (ok) { setLocked(false); lastActivity.current = Date.now(); auditRef.current.append(`${sessionId}-unlock-${Date.now()}`, tRef.current, operator, "SessionUnlocked", "passphrase ok"); } return ok; }} />}
    </div>
  );
}

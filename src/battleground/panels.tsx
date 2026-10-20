import { useEffect, useMemo, useRef, useState } from "react";
import type { AuditEntry } from "./security";
import { BRIEF, DP, DP_CLOSES, labelOf, type OptionId, type SimState, type Viewer, type Moment, type ViewReport } from "./sim";

const chakraUrl = new URL("./chakra.png", import.meta.url).href;
/** Ashoka Chakra used as a decorative mark (not the State Emblem). */
export function Chakra({ big }: { big?: boolean }) { return <img className={"chakra" + (big ? " big" : "")} src={chakraUrl} alt="" aria-hidden="true" draggable={false} />; }

export function ThemeToggle({ theme, onToggle, floating }: { theme: "light" | "dark"; onToggle: () => void; floating?: boolean }) {
  return (
    <button className={"theme-toggle" + (floating ? " floating" : "")} onClick={onToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Light / dark theme">
      <i aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</i>{theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}

export const SECS_PER_MIN = 5; // 1 simulated minute = 5 real seconds at 1x

export function fmtClock(t: number): string {
  const m = Math.floor(t), s = Math.floor((t - m) * 60);
  return `H+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
export function fmtDtg(t: number): string {
  const total = 10 * 60 + Math.floor(t); // H-hour 181000Z OCT
  return `18${String(Math.floor(total / 60)).padStart(2, "0")}${String(total % 60).padStart(2, "0")}Z OCT`;
}

const TERMS: Record<string, string> = {
  FLASH: "Highest precedence: act on this first.", IMMEDIATE: "High precedence: handle quickly.", ROUTINE: "Normal handling.",
  SITREP: "Situation report: a short summary of what a unit sees.", FUP: "Forming-up point where a force assembles before moving.",
  Grade: "Source reliability A–F. A grade describes the source, not whether the content is true.", Cred: "Credibility 1–6 of the report content. Descriptive, not proof.",
};
export function Term({ k, children }: { k: string; children?: React.ReactNode }) {
  return <span className="term" tabIndex={0} title={TERMS[k] ?? ""} data-tip={TERMS[k] ?? ""}>{children ?? k}</span>;
}

// ---------------------------------------------------------------- security gate
export function Gate({ onEnter }: { onEnter: (v: { operator: string; role: Viewer; pass: string }) => void }) {
  const [operator, setOperator] = useState("");
  const [role, setRole] = useState<Viewer>("T1");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = /^[A-Za-z0-9._-]{3,24}$/.test(operator) && pass.length >= 8;
  return (
    <div className="bg-gate">
      <div className="gate-card">
        <div className="brand-row"><Chakra big /><div className="tricolour" aria-hidden="true"><i /><i /><i /></div></div>
        <p className="gate-kicker">SECURE TRAINING SESSION</p>
        <h1>Sudarshan Command Deck</h1>
        <p className="gate-deva" lang="hi">सुदर्शन कमांड डेक · प्रशिक्षण अभ्यास</p>
        <p className="gate-sub">Immersive multi-domain decision trainer · degraded-communication environments · SIH PS&nbsp;26248</p>
        <form onSubmit={(e) => { e.preventDefault(); if (!ok || busy) return; setBusy(true); onEnter({ operator, role, pass }); }}>
          <label>Operator ID<input autoFocus autoComplete="off" spellCheck={false} value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="e.g. DSSC-0417" maxLength={24} /></label>
          <label>Station
            <select value={role} onChange={(e) => setRole(e.target.value as Viewer)}>
              <option value="T1">T1 · Company Commander (decides)</option>
              <option value="T2">T2 · Platoon 1 Commander</option>
              <option value="T3">T3 · Platoon 2 Commander</option>
              <option value="Instructor">Instructor · White Cell (sees truth)</option>
            </select>
          </label>
          <label>Session passphrase <small>(min 8 · unlocks after idle · kept in memory only)</small>
            <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <button className="bg-primary" disabled={!ok || busy}>{busy ? "Sealing session…" : "Authenticate & enter"}</button>
        </form>
        <ul className="gate-points">
          <li><b>Offline.</b> No network calls at runtime. Nothing leaves this browser.</li>
          <li><b>Synthetic data only.</b> No real units, places or operations.</li>
          <li><b>Tamper-evident audit.</b> Every command is SHA-256 hash-chained.</li>
          <li><b>Role-gated.</b> Truth data is withheld from trainee stations until review.</li>
        </ul>
        <p className="gate-foot">Training build · client-side session gate. Operational use would need server-side authentication and a formal security review.</p>
      </div>
    </div>
  );
}

export function LockScreen({ operator, onUnlock }: { operator: string; onUnlock: (pass: string) => Promise<boolean> }) {
  const [pass, setPass] = useState(""); const [bad, setBad] = useState(false);
  return (
    <div className="bg-lock" role="dialog" aria-modal="true" aria-label="Session locked">
      <form onSubmit={async (e) => { e.preventDefault(); const ok = await onUnlock(pass); setBad(!ok); if (!ok) setPass(""); }}>
        <p className="gate-kicker">SESSION LOCKED · IDLE</p>
        <h2>{operator}</h2>
        <p>The 3D view is hidden and the clock is paused. Enter your session passphrase.</p>
        <input autoFocus type="password" value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Passphrase" />
        {bad && <p className="bad" role="alert">Passphrase did not match.</p>}
        <button className="bg-primary">Unlock</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- lobby
export function Lobby(props: {
  role: Viewer; online: Record<string, boolean>; auto: boolean; setAuto: (b: boolean) => void; rehearsal: boolean; setRehearsal: (b: boolean) => void;
  quality: string; setQuality: (q: "full" | "reduced" | "off") => void; sound: boolean; setSound: (b: boolean) => void; onDeploy: () => void; onExit: () => void;
}) {
  const seats: { id: Viewer; name: string; line: string }[] = [
    { id: "T1", name: "T1 · TIGER 1", line: "Company Commander — decides under pressure" },
    { id: "T2", name: "T2 · HAWK 2", line: "Platoon 1 — eyes on the FORD, link under attack" },
    { id: "T3", name: "T3 · HAWK 3", line: "Platoon 2 — west flank" },
    { id: "Instructor", name: "WHITE CELL", line: "Controls friction, sees the truth" },
  ];
  return (
    <div className="bg-lobby">
      <div className="lobby-left">
        <div className="brand-row"><Chakra big /><div className="tricolour" aria-hidden="true"><i /><i /><i /></div></div>
        <p className="gate-kicker">EXERCISE · SYNTHETIC · SCRIPTED</p>
        <h1>SILENT RIDGE</h1>
        <p className="gate-deva" lang="hi">साइलेंट रिज · मौन शिखर</p>
        <dl className="brief">
          <dt>Situation</dt><dd>{BRIEF.situation}</dd>
          <dt>Mission</dt><dd>{BRIEF.mission}</dd>
          <dt>Commander's intent</dt><dd>{BRIEF.commanderIntent}</dd>
          <dt>H-hour</dt><dd className="mono">{BRIEF.hHour}</dd>
        </dl>
        <div className="keyq"><b>Key questions</b><span>What do I know?</span><span>What am I unsure of?</span><span>Who can I trust?</span></div>
        <p className="lobby-note">The picture on your screen is built only from the reports that reached you. Late, partial or false reports are part of the exercise.</p>
      </div>
      <div className="lobby-right">
        <h2>Squad lobby</h2>
        <div className="seat-cards">
          {seats.map((s) => {
            const me = s.id === props.role, on = me || props.online[s.id];
            return (
              <div key={s.id} className={"seat-card" + (me ? " me" : "")}>
                <span className={"bg-lamp " + (on ? "on" : "")} aria-hidden="true" />
                <div><b>{s.name}</b><small>{s.line}</small></div>
                <em>{me ? "YOU" : on ? "ONLINE" : "WAITING"}</em>
              </div>
            );
          })}
        </div>
        <p className="lobby-note">Open this page in more windows to fill other seats (same browser, no server). Seats not filled are simulated by the script.</p>
        <div className="toggles">
          <label><input type="checkbox" checked={props.auto} onChange={(e) => props.setAuto(e.target.checked)} /> Auto-Director <small>Rule-based automation · fires Jam Net at H+5, Spoof at H+8</small></label>
          <label><input type="checkbox" checked={props.rehearsal} onChange={(e) => props.setRehearsal(e.target.checked)} /> Rehearsal seat switching <small>single window · logged in the audit chain</small></label>
          <label><input type="checkbox" checked={props.sound} onChange={(e) => props.setSound(e.target.checked)} /> Sound <small>radio cues, captions shown</small></label>
          <label>Effects
            <select value={props.quality} onChange={(e) => props.setQuality(e.target.value as "full" | "reduced" | "off")}>
              <option value="full">Full · bloom + shadows</option><option value="reduced">Reduced</option><option value="off">Off · lowest load</option>
            </select>
          </label>
        </div>
        <div className="lobby-actions">
          <button className="bg-ghost" onClick={props.onExit}>← Back to Command Deck</button>
          <button className="bg-primary deploy" onClick={props.onDeploy}>DEPLOY<span>↘</span></button>
        </div>
        <p className="controls-hint">WASD move · drag orbit · wheel zoom · V view · Tab cycle unit · R reports · M map · Esc menu</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- compass
export function CompassStrip({ stripRef, markerRefs, names }: { stripRef: React.RefObject<HTMLDivElement>; markerRefs: React.MutableRefObject<(HTMLDivElement | null)[]>; names: string[] }) {
  const ticks = useMemo(() => {
    const out: JSX.Element[] = [];
    for (let d = 0; d < 720; d += 5) {
      const deg = d % 360; const label = ({ 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" } as Record<number, string>)[deg];
      out.push(<i key={d} className={label ? "big" : deg % 15 === 0 ? "mid" : ""} style={{ left: d * 5 }}>{label ? <b>{label}</b> : deg % 15 === 0 ? <small>{deg}</small> : null}</i>);
    }
    return out;
  }, []);
  return (
    <div className="compass" aria-label="Compass">
      <div className="compass-view">
        <div className="compass-strip" ref={stripRef}>{ticks}</div>
        {names.map((n, i) => <div key={n} className={"compass-mark" + (n === "FORD" ? " fordmk" : "")} ref={(el) => { markerRefs.current[i] = el; }}><span>◆</span><small /></div>)}
      </div>
      <div className="compass-needle" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------- mission card
export function MissionCard({ card, open, setOpen }: { card: { role: string; goal: string; now: string; next: string; why: string }; open: boolean; setOpen: (b: boolean) => void }) {
  const [why, setWhy] = useState(false);
  return (
    <aside className={"bg-mission" + (open ? "" : " collapsed")}>
      <button className="mc-head" onClick={() => setOpen(!open)} aria-expanded={open}><span>MISSION CARD</span><i>{open ? "–" : "+"}</i></button>
      {open && (<>
        <p className="mc-role">{card.role}</p>
        <p><b>Goal</b> {card.goal}</p>
        <p><b>Right now</b> {card.now}</p>
        <p className="mc-next"><b>Next</b> {card.next}</p>
        <button className="mc-why" onClick={() => setWhy(!why)}>Why am I doing this?</button>
        {why && <p className="mc-whytxt">{card.why}</p>}
      </>)}
    </aside>
  );
}

// ---------------------------------------------------------------- reports (inventory)
export function ReportsPanel({ reports, now, onLocate, onVerify, empty }: { reports: ViewReport[]; now: number; onLocate: (r: ViewReport) => void; onVerify: (r: ViewReport) => void; empty: string }) {
  const sorted = [...reports].sort((a, b) => b.deliveredAt - a.deliveredAt);
  return (
    <section className="reports-panel" aria-label="Reports held">
      <header><b>REPORTS HELD</b><span>{reports.length}</span></header>
      {sorted.length === 0 && <p className="empty">{empty}</p>}
      <ul>
        {sorted.map((r) => {
          const age = Math.max(0, now - r.createdAt);
          return (
            <li key={r.id} className={"rep " + r.precedence.toLowerCase() + (age > 8 ? " old" : "")}>
              <div className="rep-top"><Term k={r.precedence} /><b>{r.callsign}</b><span className={"age" + (age > 8 ? " warn" : "")}>{Math.floor(age)} min old</span></div>
              <p>{r.text}</p>
              <div className="chips">
                <span><Term k="Grade">Grade</Term> {r.grade}</span><span><Term k="Cred">Cred</Term> {r.credibility}</span>
                <span>origin {fmtClock(r.createdAt)}</span><span>rcvd {fmtClock(r.deliveredAt)}</span>
                {Object.entries(r.fields).filter(([, v]) => v.includes("▒")).map(([k]) => <span key={k} className="chip-bad">{k} missing</span>)}
              </div>
              <div className="rep-actions">
                <button onClick={() => onLocate(r)}>Locate</button>
                <button className={r.verified ? "on" : ""} onClick={() => onVerify(r)}>{r.verified ? "✓ Verify requested" : "Verify"}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- decision
export function DecisionPanel({ state, reports, canDecide, onSubmit }: { state: SimState; reports: ViewReport[]; canDecide: boolean; onSubmit: (d: { optionId: OptionId; rationale: string; confidence: number; cites: string[] }) => void }) {
  const [opt, setOpt] = useState<OptionId | "">("");
  const [why, setWhy] = useState("");
  const [conf, setConf] = useState(3);
  const [cites, setCites] = useState<string[]>([]);
  const secs = Math.ceil(state.decision.remaining * SECS_PER_MIN);
  const frac = Math.max(0, Math.min(1, state.decision.remaining / (DP_CLOSES - DP.opensAt)));
  const R = 26, C = 2 * Math.PI * R;
  return (
    <section className={"decision" + (canDecide ? "" : " slim")} aria-label="Decision point 1">
      <header>
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r={R} className="ring-bg" /><circle cx="32" cy="32" r={R} className="ring-fg" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - frac) }} transform="rotate(-90 32 32)" /><text x="32" y="37" textAnchor="middle">{secs}s</text></svg>
        <div><p className="gate-kicker">DECISION POINT 1 · TIGER 1</p><h3>Where do you commit the reserve?</h3>
          <small>Window closes at {fmtClock(DP_CLOSES)}. If it closes, the default order is “{labelOf(DP.defaultOption)}”.</small></div>
      </header>
      {!canDecide ? <p className="empty">T1 is deciding. This station does not take the decision.</p> : (<>
        <div className="opts" role="radiogroup" aria-label="Options">
          {DP.options.map((o, i) => (
            <button key={o.id} role="radio" aria-checked={opt === o.id} className={"opt" + (opt === o.id ? " on" : "")} onClick={() => setOpt(o.id)}>
              <b>{o.label}</b><small>{o.consequenceLabel}</small>
            </button>
          ))}
        </div>
        <div className="dec-grid">
          <label>Rationale<textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What did you rely on? What are you unsure of?" rows={3} maxLength={400} /></label>
          <div>
            <p className="lab">Reports I relied on</p>
            <div className="cites">{reports.length === 0 && <small>None held.</small>}{reports.map((r) => <label key={r.id}><input type="checkbox" checked={cites.includes(r.id)} onChange={(e) => setCites(e.target.checked ? [...cites, r.id] : cites.filter((c) => c !== r.id))} /> {r.callsign} · {Math.floor(state.t - r.createdAt)} min old</label>)}</div>
            <p className="lab">My confidence <small>(self-reported)</small></p>
            <div className="conf">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={conf === n ? "on" : ""} onClick={() => setConf(n)} aria-pressed={conf === n}>{n}</button>)}</div>
          </div>
        </div>
        <button className="bg-primary" disabled={!opt} onClick={() => opt && onSubmit({ optionId: opt, rationale: why.trim(), confidence: conf, cites })}>Issue order</button>
      </>)}
    </section>
  );
}

// ---------------------------------------------------------------- instructor
export function DirectorPanel(props: {
  state: SimState; auto: boolean; setAuto: (b: boolean) => void; speed: number; setSpeed: (n: number) => void; paused: boolean; setPaused: (b: boolean) => void;
  fire: (card: "JAM_NET" | "SPOOF") => void; canInject: boolean; audit: AuditEntry[]; chainOk: boolean | null; verify: () => void; exportAudit: () => void;
  layers: { truth: boolean; gap: boolean; jam: boolean }; setLayers: (l: { truth: boolean; gap: boolean; jam: boolean }) => void;
}) {
  const [tab, setTab] = useState<"script" | "links" | "traffic" | "audit">("script");
  const s = props.state;
  return (
    <aside className="director">
      <header><b>DIRECTOR</b><span className="rule-tag">Rule-based automation</span></header>
      <nav>{(["script", "links", "traffic", "audit"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</nav>
      {tab === "script" && (<div className="tab">
        <div className="transport">
          <button onClick={() => props.setPaused(!props.paused)} aria-pressed={props.paused}>{props.paused ? "▶ Resume" : "❚❚ Pause"}</button>
          {[1, 2, 4].map((n) => <button key={n} className={props.speed === n ? "on" : ""} onClick={() => props.setSpeed(n)}>{n}×</button>)}
        </div>
        <label className="switch"><input type="checkbox" checked={props.auto} onChange={(e) => props.setAuto(e.target.checked)} /> Auto-Director <small>fires scripted beats at suggested times</small></label>
        <ol className="beats">
          {s.beats.map((b) => (
            <li key={b.id} className={b.status}>
              <i aria-hidden="true">{b.status === "done" ? "✓" : b.status === "now" ? "●" : "○"}</i>
              <div><b>{b.title}</b><small>{b.time} — {b.description}</small></div>
              {b.card && <button disabled={b.status === "done" || !props.canInject} onClick={() => props.fire(b.card as "JAM_NET" | "SPOOF")}>Play</button>}
            </li>
          ))}
        </ol>
        <div className="layers"><b>Layers</b>
          <label><input type="checkbox" checked={props.layers.truth} onChange={(e) => props.setLayers({ ...props.layers, truth: e.target.checked })} /> <span className="cy">Truth</span></label>
          <label><input type="checkbox" checked={props.layers.gap} onChange={(e) => props.setLayers({ ...props.layers, gap: e.target.checked })} /> <span className="cy">Picture gap</span></label>
          <label><input type="checkbox" checked={props.layers.jam} onChange={(e) => props.setLayers({ ...props.layers, jam: e.target.checked })} /> Interference zone</label>
        </div>
      </div>)}
      {tab === "links" && (<div className="tab"><ul className="links">{s.linkMatrix.map((l) => (
        <li key={l.id}><span className={"lamp-dot " + l.state} /><div><b>{l.label}</b><small>{l.state.toUpperCase()} · delivered {l.delivered} · dropped {l.dropped} · delayed {l.delayed}</small></div><div className="qbar"><i style={{ width: `${Math.round(l.q * 100)}%` }} /></div></li>))}</ul></div>)}
      {tab === "traffic" && (<div className="tab">{(s.traffic ?? []).length === 0 && <p className="empty">No messages yet. First scheduled report at {fmtClock(0)}.</p>}
        <ul className="traffic">{[...(s.traffic ?? [])].reverse().map((r) => (
          <li key={r.id} className={r.fate}><div><b>{r.from}</b> <small>{fmtClock(r.t)} · {r.precedence}</small></div><p>{r.text}</p><div className="chips"><span className={"fate " + r.fate}>{r.fate}</span>{r.flags.map((f) => <span key={f} className={f === "fabricated" ? "chip-cy" : ""}>{f}</span>)}</div></li>))}</ul></div>)}
      {tab === "audit" && (<div className="tab">
        <div className="audit-actions"><button onClick={props.verify}>Verify chain</button><button onClick={props.exportAudit}>Export sealed JSON</button>
          <span className={"chain " + (props.chainOk === null ? "" : props.chainOk ? "ok" : "bad")}>{props.chainOk === null ? "not verified" : props.chainOk ? "chain intact ✓" : "CHAIN BROKEN"}</span></div>
        <ul className="audit">{[...props.audit].reverse().slice(0, 40).map((a) => <li key={a.seq}><span>#{a.seq}</span><b>{a.action}</b><small>{fmtClock(a.simT)} · {a.actor} · {a.detail}</small><code>{a.hash.slice(0, 12)}…</code></li>)}</ul>
      </div>)}
    </aside>
  );
}

// ---------------------------------------------------------------- AAR
export function AarPanel(props: { moments: Moment[]; t: number; endT: number; setT: (t: number) => void; playing: boolean; setPlaying: (b: boolean) => void; truth: boolean; setTruth: (b: boolean) => void; onExport: () => void; onVerify: () => void; chainOk: boolean | null; onRestart: () => void; onExit: () => void; decisionSummary: string }) {
  return (
    <section className="aar">
      <header><div><p className="gate-kicker">AFTER-ACTION REVIEW · DESCRIPTIVE, NO SCORE</p><h2>What you knew vs what was real</h2></div>
        <label className="switch"><input type="checkbox" checked={props.truth} onChange={(e) => props.setTruth(e.target.checked)} /> <span className="cy">Show truth layer</span></label></header>
      <p className="aar-dec">{props.decisionSummary}</p>
      <div className="scrub">
        <button onClick={() => props.setPlaying(!props.playing)} aria-label={props.playing ? "Pause replay" : "Play replay"}>{props.playing ? "❚❚" : "▶"}</button>
        <input type="range" min={0} max={props.endT} step={0.05} value={Math.min(props.t, props.endT)} onChange={(e) => { props.setPlaying(false); props.setT(parseFloat(e.target.value)); }} aria-label="Replay time" />
        <span className="mono">{fmtClock(Math.min(props.t, props.endT))}</span>
        {props.moments.map((m, i) => <i key={i} className="mark" style={{ left: `calc(46px + (100% - 46px - 78px) * ${m.t / props.endT})` }} title={m.title} />)}
      </div>
      <ol className="moments">
        {props.moments.map((m, i) => (
          <li key={i} className={props.t >= m.t ? "past" : ""} onClick={() => { props.setPlaying(false); props.setT(m.t); }}>
            <span className="mono">{fmtClock(m.t)}</span><div><b>{m.title}</b><p><u>Known to T1:</u> {m.known}</p><p className="cy"><u>Real:</u> {m.real}</p></div>
          </li>
        ))}
      </ol>
      <div className="aar-actions"><button onClick={props.onVerify}>Verify audit chain</button><button onClick={props.onExport}>Export sealed JSON</button>
        <span className={"chain " + (props.chainOk === null ? "" : props.chainOk ? "ok" : "bad")}>{props.chainOk === null ? "" : props.chainOk ? "chain intact ✓" : "CHAIN BROKEN"}</span>
        <span className="spacer" /><button onClick={props.onRestart}>New run</button><button className="bg-primary" onClick={props.onExit}>Exit to Command Deck</button></div>
      <p className="unval">All counts and times are descriptive and unvalidated. The outcome is scripted and does not measure real-world readiness.</p>
    </section>
  );
}

// ---------------------------------------------------------------- misc small
export function useInterval(fn: () => void, ms: number) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { const id = setInterval(() => ref.current(), ms); return () => clearInterval(id); }, [ms]);
}

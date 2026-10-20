// Deterministic view of the SILENT RIDGE fixture for the 3D battleground.
//
// computeState(commands, t, viewer) is a pure function: the same command log and the
// same time always give the same picture. That is what makes the AAR scrubber, the
// multi-window sync and the audit trail trustworthy.
//
// Truth and perception stay separate: anything truth-only (real enemy positions,
// jam zone, fabricated flag, dropped reports) is only produced for the Instructor
// viewer, or for every viewer once the exercise is over (review mode).

import silentRidge from "../fixtures/scenarios/silent-ridge.json";
import directorBeats from "../fixtures/copy/director-beats.json";
import consequences from "../fixtures/copy/consequences.json";
import { PLACES, dist, toWorld, type XZ } from "./world";

export type Viewer = "Instructor" | "T1" | "T2" | "T3";
export type Card = "JAM_NET" | "SPOOF";
export type OptionId = "commit-north" | "hold-ford" | "retask-uas";
export type Precedence = "FLASH" | "IMMEDIATE" | "ROUTINE";

export interface Cmd {
  id: string;
  at: number; // sim minutes
  actor: string;
  type: "FireInject" | "SubmitDecision" | "VerifyReport" | "Ping" | "Acknowledge" | "DeployStart";
  payload: Record<string, unknown>;
}

interface RawItem {
  id: string; from: string; to: string[]; simOffset: number; precedence: Precedence;
  sourceGrade: string; credibility: number; text: string; fields: Record<string, string>;
  location: [number, number]; truthRef?: string; fabricated?: boolean;
  delivery: Record<string, { delayMin: number; drop: boolean; partialFields: string[]; garble: boolean }>;
}
interface RawSegment { id: string; startsOn: { type: string; card?: string; decisionPointId?: string; optionId?: string }; items: RawItem[] }

const raw = silentRidge as unknown as {
  segments: RawSegment[];
  decisionPoints: { id: string; opensAt: number; deadlineMin: number; defaultOption: OptionId; options: { id: OptionId; label: string; consequenceLabel: string }[] }[];
  branches: { decisionPointId: string; optionId: string; segmentId: string }[];
  truthTimeline: { id: string; facts: string[] }[];
  aarNotes: { reportId: string; category: string; explanation: string }[];
  brief: { situation: string; mission: string; commanderIntent: string; hHour: string };
};

export const DP = raw.decisionPoints[0];
export const BRIEF = raw.brief;
export const DP_CLOSES = DP.opensAt + DP.deadlineMin;
export const MAX_T = 36;
const REVIEW_AFTER_DECISION = 12;

export const CALLSIGN: Record<string, string> = {
  T1: "TIGER 1", T2: "HAWK 2", T3: "HAWK 3", T5: "EAGLE 5", Adjacent: "ADJACENT", Instructor: "WHITE CELL",
};
export const SEAT_ROLE: Record<string, string> = {
  T1: "Company Commander", T2: "Platoon 1 Commander", T3: "Platoon 2 Commander", T5: "UAS Operator", Adjacent: "Adjacent Unit",
};

export const DIRECTOR_BEATS = directorBeats as { id: string; time: string; atMinute: number; title: string; description: string; card: string }[];

// ---------- helpers ----------
function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Deterministic corruption: some longer lower-case words become block characters. */
export function garbleText(text: string, seedId: string): string {
  let n = 0;
  return text.split(" ").map((w) => {
    const bare = w.replace(/[^A-Za-z]/g, "");
    if (bare.length < 4 || bare === bare.toUpperCase()) return w;
    n++;
    return (hashStr(seedId + n) % 100) < 55 ? w.replace(/[A-Za-z]/g, "▒") : w;
  }).join(" ");
}

function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }
function ease(k: number) { const c = Math.max(0, Math.min(1, k)); return c * c * (3 - 2 * c); }
function path(keys: [number, number, number][], t: number): XZ {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0, z0] = keys[i], [t1, x1, z1] = keys[i + 1];
    if (t <= t1) { const k = ease((t - t0) / (t1 - t0)); return [lerp(x0, x1, k), lerp(z0, z1, k)]; }
  }
  const l = keys[keys.length - 1];
  return [l[1], l[2]];
}
const toXZ = (p: [number, number]): XZ => toWorld(p[0], p[1]);

// ---------- output types ----------
export interface ViewReport {
  id: string; from: string; callsign: string; precedence: Precedence; grade: string; credibility: number;
  text: string; fields: Record<string, string>; pos: XZ; createdAt: number; deliveredAt: number; age: number; verified: boolean;
}
export interface Track {
  id: string; reportId: string; label: string; pos: XZ; age: number; grade: string; credibility: number; precedence: Precedence;
  radius: number; opacity: number; hostile: boolean;
  // instructor / review only
  fabricated?: boolean; truthPos?: XZ; gapUnits?: number;
}
export interface Friendly { id: string; seat: string; callsign: string; role: string; kind: "hq" | "platoon" | "reserve" | "uas"; pos: XZ; linkQ: number; heading: number; orbit?: { center: XZ; radius: number } }
export interface TrafficRow { id: string; t: number; from: string; to: string; precedence: Precedence; text: string; fate: "in-flight" | "delivered" | "dropped"; delayMin: number; flags: string[]; fabricated: boolean }
export interface FeedEvent { id: string; t: number; kind: "report" | "link" | "decision" | "inject" | "system"; text: string; precedence?: Precedence }
export interface BeatState { id: string; time: string; title: string; description: string; card: string; status: "upcoming" | "now" | "done"; atMinute: number }

export interface SimState {
  t: number; viewer: Viewer; over: boolean; revealTruth: boolean;
  friendlies: Friendly[];
  reports: ViewReport[];
  outbox: { id: string; t: number; text: string; status: "ack" | "no-ack" | "pending" }[];
  tracks: Track[];
  feed: FeedEvent[];
  decision: { status: "upcoming" | "open" | "resolved"; opensAt: number; closesAt: number; remaining: number; optionId?: OptionId; defaulted?: boolean; at?: number; consequence?: string };
  beats: BeatState[];
  injected: Record<Card, number | undefined>;
  // truth-only (undefined for trainees until review)
  truthEnemies?: { id: string; pos: XZ; heading: number }[];
  jam?: { center: XZ; radius: number; active: boolean };
  spoofAt?: XZ;
  traffic?: TrafficRow[];
  linkMatrix: { id: string; label: string; q: number; delivered: number; dropped: number; delayed: number; state: "clear" | "degraded" | "jammed" }[];
  endT: number;
}

// ---------- the enemy (truth) ----------
const ENEMY_OFFSETS: XZ[] = [[0, 0], [3.4, 1.2], [-2.8, 2.4], [1.2, -3.2]];
const ENEMY_PRE: [number, number, number][] = [[0, 8, -2.5], [6, 3, -5], [12, -2.75, -7.3]];
function enemyCentre(t: number, dec?: { at: number; optionId: OptionId }): XZ {
  if (!dec || t < dec.at) return path(ENEMY_PRE, t);
  const from = path(ENEMY_PRE, dec.at);
  const to: XZ = dec.optionId === "commit-north" ? [-17, -3] : dec.optionId === "hold-ford" ? [-7.5, -4.5] : [-2.75, -7.3];
  const dur = dec.optionId === "commit-north" ? 6 : dec.optionId === "hold-ford" ? 4 : 1;
  const k = ease((t - dec.at) / dur);
  return [lerp(from[0], to[0], k), lerp(from[1], to[1], k)];
}

// ---------- main ----------
export function firstOf(cmds: Cmd[], type: Cmd["type"], pred?: (c: Cmd) => boolean) {
  return cmds.filter((c) => c.type === type && (!pred || pred(c))).sort((a, b) => a.at - b.at)[0];
}

export function computeState(cmds: Cmd[], t: number, viewer: Viewer, opts: { forceReview?: boolean } = {}): SimState {
  const injectAt: Record<Card, number | undefined> = { JAM_NET: undefined, SPOOF: undefined };
  (["JAM_NET", "SPOOF"] as Card[]).forEach((card) => {
    const c = firstOf(cmds, "FireInject", (x) => x.payload.card === card);
    if (c && c.at <= t) injectAt[card] = c.at;
  });

  // decision: explicit, else default at the deadline
  const explicit = firstOf(cmds, "SubmitDecision");
  let dec: { at: number; optionId: OptionId; defaulted: boolean } | undefined;
  if (explicit) {
    const at = Math.min(Math.max(explicit.at, DP.opensAt), DP_CLOSES);
    if (at <= t) dec = { at, optionId: explicit.payload.optionId as OptionId, defaulted: false };
  } else if (t >= DP_CLOSES) {
    dec = { at: DP_CLOSES, optionId: DP.defaultOption, defaulted: true };
  }
  const decisionStatus: SimState["decision"]["status"] = dec ? "resolved" : t >= DP.opensAt ? "open" : "upcoming";
  const decAnyAt = explicit ? Math.min(Math.max(explicit.at, DP.opensAt), DP_CLOSES) : DP_CLOSES;
  const endT = Math.min(MAX_T, decAnyAt + REVIEW_AFTER_DECISION);
  const over = t >= endT;
  const revealTruth = viewer === "Instructor" || over || !!opts.forceReview && over;

  // released segments
  const branchSeg = dec ? raw.branches.find((b) => b.decisionPointId === DP.id && b.optionId === dec!.optionId)?.segmentId : undefined;
  const starts: Record<string, number | undefined> = {
    opening: 0,
    "jam-net-results": injectAt.JAM_NET,
    "spoof-contact": injectAt.SPOOF,
  };
  if (branchSeg && dec) starts[branchSeg] = dec.at;

  const verifiedIds = new Set(cmds.filter((c) => c.type === "VerifyReport" && c.at <= t).map((c) => String(c.payload.reportId)));

  interface Inst { item: RawItem; created: number; deliverAt: number; dropped: boolean; d: RawItem["delivery"][string] }
  const insts: Inst[] = [];
  for (const seg of raw.segments) {
    const s = starts[seg.id];
    if (s === undefined) continue;
    for (const item of seg.items) {
      const d = item.delivery.T1 ?? { delayMin: 0, drop: false, partialFields: [], garble: false };
      const created = s + item.simOffset;
      if (created > t) continue;
      insts.push({ item, created, deliverAt: created + d.delayMin, dropped: d.drop, d });
    }
  }
  insts.sort((a, b) => a.created - b.created);

  const callsign = (s: string) => CALLSIGN[s] ?? s;
  const fate = (i: Inst): TrafficRow["fate"] => (i.dropped ? "dropped" : t >= i.deliverAt ? "delivered" : "in-flight");

  // what T1 actually holds
  const delivered = insts.filter((i) => fate(i) === "delivered");
  const reports: ViewReport[] = delivered.map(({ item, created, deliverAt, d }) => {
    const fields = { ...item.fields };
    d.partialFields.forEach((f) => { fields[f] = "▒▒▒"; });
    return {
      id: item.id, from: item.from, callsign: callsign(item.from), precedence: item.precedence, grade: item.sourceGrade,
      credibility: item.credibility, text: d.garble ? garbleText(item.text, item.id) : item.text, fields,
      pos: toXZ(item.location), createdAt: created, deliveredAt: deliverAt, age: t - created, verified: verifiedIds.has(item.id),
    };
  });

  // perceived tracks, latest per (source, subject)
  const latest = new Map<string, Inst>();
  for (const i of delivered) latest.set(i.item.from + "|" + (i.item.truthRef ?? i.item.id), i);
  const truthById = new Map<string, XZ>();
  const enemyC = enemyCentre(t, dec);
  const tracks: Track[] = [...latest.values()].map(({ item, created, d }) => {
    const age = t - created;
    const base: Track = {
      id: "trk-" + item.id, reportId: item.id, label: item.fields.location ?? "CONTACT", pos: toXZ(item.location), age,
      grade: item.sourceGrade, credibility: item.credibility, precedence: item.precedence,
      radius: Math.min(15, 1.8 + age * 0.6 + (d.partialFields.length ? 2 : 0) + (d.garble ? 1.5 : 0)),
      opacity: Math.max(0.3, 1 - age / 20), hostile: true,
    };
    if (revealTruth) {
      base.fabricated = !!item.fabricated;
      if (item.truthRef) { base.truthPos = enemyC; base.gapUnits = dist(base.pos, enemyC); truthById.set(item.id, enemyC); }
    }
    return base;
  });

  // friendlies
  const jamAt = injectAt.JAM_NET;
  const jamQ = (() => {
    if (jamAt === undefined) return 1;
    const since = t - jamAt;
    if (since < 0) return 1;
    if (since < 1) return 1 - 0.85 * since;
    if (since < 11) return 0.15 + 0.05 * Math.sin(since * 2.3);
    return Math.min(0.95, 0.15 + 0.8 * ease((since - 11) / 3));
  })();
  const spoofQ = injectAt.SPOOF === undefined ? 0.9 : 0.9; // the spoofed link still *looks* healthy
  const reserveKeys: [number, number, number][] = (() => {
    const p0: XZ = [PLACES.fup[0] + 6, PLACES.fup[1] - 8];
    if (!dec) return [[0, p0[0], p0[1]]];
    const to: XZ = dec.optionId === "commit-north" ? [-30, -38] : dec.optionId === "hold-ford" ? [-14, 4] : p0;
    const dur = dec.optionId === "commit-north" ? 8 : 5;
    return [[dec.at, p0[0], p0[1]], [dec.at + dur, to[0], to[1]]];
  })();
  const reservePos = reserveKeys.length === 1 ? ([reserveKeys[0][1], reserveKeys[0][2]] as XZ) : path(reserveKeys, t);
  const uasCentre: XZ = dec && dec.optionId === "retask-uas" ? path([[dec.at, -14, -4], [dec.at + 1.5, -3, -6]], t) : [-14, -4];
  const uasRadius = dec && dec.optionId === "retask-uas" ? lerp(16, 5, ease((t - dec.at) / 1.5)) : 16;
  const friendlies: Friendly[] = [
    { id: "t1", seat: "T1", callsign: "TIGER 1", role: SEAT_ROLE.T1, kind: "hq", pos: PLACES.hq, linkQ: 1, heading: 0.6 },
    { id: "t2", seat: "T2", callsign: "HAWK 2", role: SEAT_ROLE.T2, kind: "platoon", pos: PLACES.hawk2, linkQ: jamQ, heading: -0.3 },
    { id: "t3", seat: "T3", callsign: "HAWK 3", role: SEAT_ROLE.T3, kind: "platoon", pos: PLACES.hawk3, linkQ: 0.95, heading: 0.2 },
    { id: "t5", seat: "T5", callsign: "EAGLE 5", role: SEAT_ROLE.T5, kind: "uas", pos: uasCentre, linkQ: 1, heading: 0, orbit: { center: uasCentre, radius: uasRadius } },
    { id: "res", seat: "T1", callsign: "TIGER RES", role: "Reserve", kind: "reserve", pos: reservePos, linkQ: 1, heading: 0 },
  ];

  // comms feed
  const feed: FeedEvent[] = [];
  for (const r of reports) feed.push({ id: "f-" + r.id, t: r.deliveredAt, kind: "report", text: `${r.precedence} · ${r.text}`, precedence: r.precedence });
  if (jamAt !== undefined) {
    feed.push({ id: "f-link-down", t: jamAt + 0.3, kind: "link", text: "NET ALERT: HAWK 2 link signal weak" });
    if (t >= jamAt + 11) feed.push({ id: "f-link-up", t: jamAt + 11, kind: "link", text: "NET: HAWK 2 link signal recovering" });
  }
  if (dec) feed.push({ id: "f-dec", t: dec.at, kind: "decision", text: dec.defaulted ? `Decision window closed — default order: ${labelOf(dec.optionId)}` : `T1 ordered: ${labelOf(dec.optionId)}` });
  if (viewer === "Instructor") {
    (["JAM_NET", "SPOOF"] as Card[]).forEach((c) => injectAt[c] !== undefined && feed.push({ id: "f-inj-" + c, t: injectAt[c]!, kind: "inject", text: `INJECT: ${c === "JAM_NET" ? "Jam Net · HAWK 2 → TIGER 1" : "Spoof Contact · N BRIDGE"}` }));
    insts.filter((i) => i.dropped).forEach((i) => feed.push({ id: "f-drop-" + i.item.id, t: i.created, kind: "system", text: `DROPPED before delivery: ${i.item.text}` }));
  }
  feed.sort((a, b) => a.t - b.t);

  const outbox = viewer === "T2" || viewer === "T3"
    ? insts.filter((i) => i.item.from === viewer).map((i) => ({ id: i.item.id, t: i.created, text: i.item.text, status: (i.dropped ? "no-ack" : t >= i.deliverAt ? "ack" : "pending") as "ack" | "no-ack" | "pending" }))
    : [];

  // traffic ledger
  const delayedN = insts.filter((i) => i.d.delayMin > 0).length;
  const droppedN = insts.filter((i) => i.dropped).length;
  const deliveredN = delivered.length;
  const linkMatrix: SimState["linkMatrix"] = [
    { id: "t2-t1", label: "HAWK 2 → TIGER 1", q: jamQ, delivered: delivered.filter((i) => i.item.from === "T2").length, dropped: insts.filter((i) => i.item.from === "T2" && i.dropped).length, delayed: insts.filter((i) => i.item.from === "T2" && i.d.delayMin > 0).length, state: jamQ > 0.7 ? "clear" : jamQ > 0.35 ? "degraded" : "jammed" },
    { id: "t3-t1", label: "HAWK 3 → TIGER 1", q: 0.95, delivered: 0, dropped: 0, delayed: 0, state: "clear" },
    { id: "uas-t1", label: "EAGLE 5 → TIGER 1", q: 1, delivered: delivered.filter((i) => i.item.from === "T5").length, dropped: 0, delayed: 0, state: "clear" },
    { id: "adj-t1", label: "ADJACENT → TIGER 1", q: spoofQ, delivered: delivered.filter((i) => i.item.from === "Adjacent").length, dropped: 0, delayed: 0, state: "clear" },
  ];
  void delayedN; void droppedN; void deliveredN;

  const beats: BeatState[] = DIRECTOR_BEATS.map((b) => {
    const done = b.card === "" ? t > 0.2 : injectAt[b.card as Card] !== undefined;
    return { id: b.id, time: b.time, title: b.title, description: b.description, card: b.card, atMinute: b.atMinute, status: done ? "done" : t >= b.atMinute ? "now" : "upcoming" };
  });

  const state: SimState = {
    t, viewer, over, revealTruth, friendlies, reports: viewer === "T2" || viewer === "T3" ? [] : reports, outbox, tracks: viewer === "T2" || viewer === "T3" ? [] : tracks, feed: viewer === "T2" || viewer === "T3" ? feed.filter((f) => f.kind === "link" || f.kind === "decision") : feed,
    decision: {
      status: decisionStatus, opensAt: DP.opensAt, closesAt: DP_CLOSES, remaining: Math.max(0, DP_CLOSES - t),
      optionId: dec?.optionId, defaulted: dec?.defaulted, at: dec?.at,
      consequence: dec ? (consequences as { dp1: Record<string, string> }).dp1[dec.optionId] : undefined,
    },
    beats, injected: injectAt, linkMatrix, endT,
  };

  if (revealTruth) {
    state.truthEnemies = ENEMY_OFFSETS.map((o, i) => {
      const heading = dec?.optionId === "commit-north" && t > dec.at ? Math.PI : 2.4;
      return { id: "e" + i, pos: [enemyC[0] + o[0], enemyC[1] + o[1]] as XZ, heading };
    });
    if (jamAt !== undefined) {
      const since = t - jamAt;
      state.jam = { center: [-16, 14], radius: 46 - 26 * Math.max(0, Math.min(1, since / 10)), active: since >= 0 && since < 11 };
    }
    if (injectAt.SPOOF !== undefined) state.spoofAt = PLACES.bridge;
    state.traffic = insts.map((i) => {
      const flags: string[] = [];
      if (i.d.delayMin > 0) flags.push(`delayed ${i.d.delayMin}m`);
      if (i.dropped) flags.push("dropped");
      if (i.d.partialFields.length) flags.push("partial");
      if (i.d.garble) flags.push("garbled");
      if (i.item.fabricated) flags.push("fabricated");
      return { id: i.item.id, t: i.created, from: callsign(i.item.from), to: "TIGER 1", precedence: i.item.precedence, text: i.item.text, fate: fate(i), delayMin: i.d.delayMin, flags, fabricated: !!i.item.fabricated };
    });
  }
  return state;
}

export function labelOf(id: OptionId) { return DP.options.find((o) => o.id === id)?.label ?? id; }

// ---------- rule-based mission card ----------
export function missionCard(s: SimState): { role: string; goal: string; now: string; next: string; why: string } {
  const v = s.viewer;
  const why = "Training purpose: practise deciding when the picture is late, partial or wrong — and noticing how old each piece of information is.";
  if (v === "Instructor") {
    const next = s.beats.find((b) => b.status !== "done" && b.card);
    return {
      role: "You are the White Cell — exercise control. You see the truth; the trainees do not.",
      goal: "Introduce scripted friction at the suggested times and watch what each seat believes.",
      now: s.over ? "Exercise complete. Open the review to compare what was known with what was real." : s.decision.status === "open" ? "T1's decision window is open." : `Clock H+${Math.floor(s.t)}.`,
      next: next ? `${next.status === "now" ? "Now" : next.time}: ${next.title}. Use the matching inject card.` : "Observe the decision, then end the exercise.",
      why,
    };
  }
  if (v === "T1") {
    const held = s.reports.length;
    const oldest = s.reports.reduce((m, r) => Math.max(m, r.age), 0);
    return {
      role: "You are T1 (TIGER 1), the company commander. You hold the reserve.",
      goal: "Decide where to commit the reserve without a clear picture. Deny a hostile crossing at the FORD.",
      now: s.over ? "Exercise complete." : s.decision.status === "open" ? `Decision window open — ${Math.ceil(s.decision.remaining)} min left. You hold ${held} report(s); the oldest is ${Math.floor(oldest)} min old.` : s.decision.status === "resolved" ? (s.decision.consequence ?? "") : held === 0 ? "No reports have reached you yet. First scheduled reports are due at H+0." : `You hold ${held} report(s). Check each report's age and source grade.`,
      next: s.decision.status === "open" ? "Choose an option in the Decision panel, add your rationale, then submit." : s.decision.status === "resolved" ? "Watch the picture develop, then review." : "Open the report list (R). Mark doubtful reports ‘Verify’.",
      why,
    };
  }
  return {
    role: v === "T2" ? "You are T2 (HAWK 2), Platoon 1, on the west bank near the FORD." : "You are T3 (HAWK 3), Platoon 2, on the west flank.",
    goal: "Send accurate observations to T1 — and notice when you get no acknowledgement.",
    now: s.outbox.length === 0 ? "You have nothing to send yet." : `You have sent ${s.outbox.length} report(s). ${s.outbox.filter((o) => o.status === "no-ack").length} had no acknowledgement.`,
    next: "Watch your link bar. If it drops, assume T1 may not have your report.",
    why,
  };
}

// ---------- AAR moments (rule-based, from the run) ----------
export interface Moment { t: number; title: string; known: string; real: string }
export function momentsFor(cmds: Cmd[]): Moment[] {
  const end = computeState(cmds, MAX_T, "Instructor");
  const out: Moment[] = [];
  end.traffic?.forEach((tr) => {
    const note = raw.aarNotes.find((n) => n.reportId === tr.id);
    if (note) out.push({ t: tr.t + (tr.delayMin || 0), title: `${note.category.toUpperCase()} · ${tr.from}`, known: tr.fate === "dropped" ? "Nothing reached T1." : tr.text, real: note.explanation });
  });
  const jam = firstOf(cmds, "FireInject", (c) => c.payload.card === "JAM_NET");
  if (jam) out.push({ t: jam.at, title: "Jam Net injected", known: "T1's HAWK 2 link bar fell; traffic became late, partial or missing.", real: "Scripted interference on HAWK 2 → TIGER 1." });
  const sp = firstOf(cmds, "SubmitDecision");
  const e = end.decision;
  out.push({ t: e.at ?? DP_CLOSES, title: e.defaulted ? "Window closed · default order" : "Decision recorded", known: e.optionId ? labelOf(e.optionId) : "—", real: e.consequence ?? "" });
  if (sp) out.push({ t: sp.at, title: "Rationale recorded", known: String(sp.payload.rationale ?? "(none given)"), real: `Confidence set by T1: ${sp.payload.confidence ?? "—"} / 5 (self-reported, unvalidated).` });
  cmds.filter((c) => c.type === "VerifyReport").forEach((c) => out.push({ t: c.at, title: "Verification requested", known: `Report ${c.payload.reportId} marked for verification.`, real: "Verification was logged; confirmation in this script comes from the UAS retask branch." }));
  return out.sort((a, b) => a.t - b.t);
}

export function placeLabels() { return [{ label: "FORD", pos: PLACES.ford }, { label: "N BRIDGE", pos: PLACES.bridge }, { label: "SILENT RIDGE", pos: PLACES.ridge }, { label: "FUP ORCHID", pos: PLACES.fup }]; }

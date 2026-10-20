// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeState, momentsFor, DP_CLOSES, type Cmd } from "../src/battleground/sim";
import { AuditChain } from "../src/battleground/security";

const inject = (card: string, at: number): Cmd => ({ id: `i-${card}`, at, actor: "test", type: "FireInject", payload: { card } });
const decide = (optionId: string, at: number): Cmd => ({ id: "d1", at, actor: "test", type: "SubmitDecision", payload: { optionId, rationale: "r", confidence: 3 } });

describe("battleground simulation", () => {
  it("is a pure function of commands and time", () => {
    const cmds = [inject("JAM_NET", 5), inject("SPOOF", 8), decide("retask-uas", 12)];
    expect(JSON.stringify(computeState(cmds, 20, "T1"))).toBe(JSON.stringify(computeState(cmds, 20, "T1")));
  });

  it("never gives a trainee truth-only data before the exercise ends", () => {
    const cmds = [inject("JAM_NET", 5), inject("SPOOF", 8)];
    const s = computeState(cmds, 12, "T1");
    expect(s.truthEnemies).toBeUndefined();
    expect(s.jam).toBeUndefined();
    expect(s.traffic).toBeUndefined();
    expect(s.spoofAt).toBeUndefined();
    expect(JSON.stringify(s)).not.toContain("fabricated");
    expect(s.tracks.every((t) => t.truthPos === undefined)).toBe(true);
  });

  it("gives the Instructor truth, and everyone truth once the run is over", () => {
    const cmds = [inject("JAM_NET", 5), inject("SPOOF", 8)];
    const ins = computeState(cmds, 12, "Instructor");
    expect(ins.truthEnemies?.length).toBe(4);
    expect(ins.traffic?.some((r) => r.fabricated)).toBe(true);
    const over = computeState(cmds, 36, "T1");
    expect(over.over).toBe(true);
    expect(over.truthEnemies).toBeDefined();
  });

  it("applies the fixture's delay, drop and partial effects to what T1 holds", () => {
    const cmds = [inject("JAM_NET", 5)];
    const early = computeState(cmds, 6.5, "T1");
    expect(early.reports.some((r) => r.id === "t2-late-contact")).toBe(false); // held for 4 min
    expect(early.reports.some((r) => r.id === "t2-dropped-contact")).toBe(false); // dropped
    const later = computeState(cmds, 10, "T1");
    expect(later.reports.some((r) => r.id === "t2-late-contact")).toBe(true);
    expect(later.reports.some((r) => r.id === "t2-dropped-contact")).toBe(false);
    const partial = later.reports.find((r) => r.id === "t2-partial-contact");
    expect(partial?.fields.strength).toContain("▒");
  });

  it("closes the decision window with the default order when T1 does nothing", () => {
    const s = computeState([], DP_CLOSES + 0.1, "T1");
    expect(s.decision.status).toBe("resolved");
    expect(s.decision.defaulted).toBe(true);
    expect(s.decision.optionId).toBe("hold-ford");
  });

  it("builds descriptive review moments without any score", () => {
    const cmds = [inject("JAM_NET", 5), inject("SPOOF", 8), decide("hold-ford", 12)];
    const m = momentsFor(cmds);
    expect(m.length).toBeGreaterThan(3);
    expect(JSON.stringify(m).toLowerCase()).not.toMatch(/score|points|rank/);
  });
});

describe("audit chain", () => {
  it("ignores a repeated command id", async () => {
    const a = new AuditChain();
    a.append("c1", 0, "x", "A", "d"); a.append("c1", 0, "x", "A", "d"); a.append("c2", 1, "x", "B", "d");
    await a.verify();
    expect(a.entries.length).toBe(2);
  });

  it("verifies an untouched chain and detects tampering", async () => {
    const a = new AuditChain();
    for (let i = 0; i < 5; i++) a.append("c" + i, i, "op", "Cmd", "detail " + i);
    expect((await a.verify()).ok).toBe(true);
    a.entries[2] = { ...a.entries[2], detail: "edited after the fact" };
    const r = await a.verify();
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(3);
  });

  it("exports a sealed document marked synthetic and unvalidated", async () => {
    const a = new AuditChain(); a.append("c1", 0, "op", "Cmd", "d");
    const doc = JSON.parse(await a.exportJson({ session: "t" }));
    expect(doc.meta.synthetic).toBe(true);
    expect(doc.meta.unvalidated).toBe(true);
    expect(doc.seal).toMatch(/^[0-9a-f]{64}$/);
  });
});

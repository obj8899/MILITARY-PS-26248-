import { describe, expect, it } from "vitest";
import {
  createAarExportData,
  createAarNarrative,
  selectAarKeyMoments,
  toAarCsv,
  type AarFeedItem,
  type AarLogItem,
} from "../src/aar/analysis";

const feed: AarFeedItem[] = [
  { id: "late-report", source: "T2", simOffset: 2, outcome: { delayMin: 4, dropped: false } },
  { id: "dropped-report", source: "T2", simOffset: 3, outcome: { delayMin: 0, dropped: true } },
  { id: "spoof-report", source: "Adjacent", simOffset: 4, outcome: { delayMin: 0, dropped: false } },
];

const log: AarLogItem[] = [
  { title: "SubmitDecision", kind: "command", detail: "T1 selected retask-uas.", commandId: "decision-1" },
  { title: "BranchConsequence", kind: "event", detail: "The UAS checks the FORD.", eventId: "branch-1" },
];

describe("AAR analysis", () => {
  it("selects available moments by the documented fixed rules", () => {
    const moments = selectAarKeyMoments(
      feed,
      log,
      { "spoof-report": "Verify" },
      ["spoof-report"],
    );

    expect(moments.map((moment) => moment.rule)).toEqual([
      "First delayed report",
      "First dropped report",
      "Spoof delivered",
      "Decision submitted",
      "First refutation",
      "Branch consequence",
    ]);
    expect(moments[0].simTime).toBe(6);
    expect(moments[4].caption).toContain("spoof-report Verify");
  });

  it("builds a narrative and export markers from run evidence", () => {
    const narrative = createAarNarrative(log[0], feed);
    const moments = selectAarKeyMoments(feed, log, {}, ["spoof-report"]);
    const data = createAarExportData("silent-ridge", log, moments, narrative);
    const csv = toAarCsv(log, moments, narrative);

    expect(narrative).toContain("T1 selected retask-uas.");
    expect(data).toMatchObject({
      synthetic: true,
      illustrativeSimulation: true,
      validity_status: "unvalidated",
      scenarioId: "silent-ridge",
    });
    expect(csv).toContain("First delayed report");
    expect(csv).toContain("Rule-based summary from this run's log");
    expect(csv).toContain("illustrativeSimulation");
    expect(csv).toContain("unvalidated");
  });

  it("does not invent a decision moment when the run has no decision", () => {
    expect(createAarNarrative(undefined, [])).toContain("No decision has been submitted");
    expect(selectAarKeyMoments([], [], {}, [])).toEqual([]);
  });
});

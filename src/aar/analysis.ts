export interface AarFeedItem {
  id: string;
  source: string;
  simOffset: number;
  outcome: {
    delayMin: number;
    dropped: boolean;
  };
}

export interface AarLogItem {
  title: string;
  kind: "command" | "event";
  detail: string;
  simTime?: number;
  commandId?: string;
  eventId?: string;
  actor?: string;
}

export interface AarMoment {
  id: string;
  rule: string;
  caption: string;
  simTime?: number;
}

export function createAarExportData(
  scenarioId: string,
  runLog: AarLogItem[],
  keyMoments: AarMoment[],
  narrative: string,
) {
  return {
    synthetic: true,
    illustrativeSimulation: true,
    validity_status: "unvalidated" as const,
    scenarioId,
    keyMoments,
    narrative,
    runLog,
  };
}

export function selectAarKeyMoments(
  feed: AarFeedItem[],
  log: AarLogItem[],
  triageStatus: Record<string, string>,
  refutedReportIds: string[],
): AarMoment[] {
  const moments: AarMoment[] = [];
  const delayed = feed.find((item) => item.outcome.delayMin > 0 && !item.outcome.dropped);
  if (delayed) {
    moments.push({
      id: `delayed:${delayed.id}`,
      rule: "First delayed report",
      caption: `${delayed.source} report ${delayed.id} arrived with a ${delayed.outcome.delayMin}-minute scripted delay.`,
      simTime: delayed.simOffset + delayed.outcome.delayMin,
    });
  }

  const dropped = feed.find((item) => item.outcome.dropped);
  if (dropped) {
    moments.push({
      id: `dropped:${dropped.id}`,
      rule: "First dropped report",
      caption: `${dropped.source} report ${dropped.id} was dropped by its scripted delivery rule.`,
      simTime: dropped.simOffset,
    });
  }

  const spoof = feed.find((item) => refutedReportIds.includes(item.id) && !item.outcome.dropped);
  if (spoof) {
    moments.push({
      id: `spoof:${spoof.id}`,
      rule: "Spoof delivered",
      caption: `The report ${spoof.id} was delivered to the seat. Its scripted status is available for review here.`,
      simTime: spoof.simOffset + spoof.outcome.delayMin,
    });
  }

  const decision = log.find((entry) => entry.kind === "command" && entry.title === "SubmitDecision");
  if (decision) {
    moments.push({
      id: decision.commandId ?? "decision:submitted",
      rule: "Decision submitted",
      caption: decision.detail,
      simTime: decision.simTime,
    });
  }

  const refutedReportId = refutedReportIds.find((id) =>
    triageStatus[id] === "Verify" || triageStatus[id] === "Discard"
  );
  if (refutedReportId) {
    const report = feed.find((item) => item.id === refutedReportId);
    moments.push({
      id: `refutation:${refutedReportId}`,
      rule: "First refutation",
      caption: `T1 marked ${refutedReportId} ${triageStatus[refutedReportId]}; the review identifies it as a refuted report.`,
      simTime: report?.simOffset,
    });
  }

  const consequence = log.find((entry) => entry.kind === "event" && entry.title === "BranchConsequence");
  if (consequence) {
    moments.push({
      id: consequence.eventId ?? "branch:consequence",
      rule: "Branch consequence",
      caption: consequence.detail,
      simTime: consequence.simTime,
    });
  }

  return moments;
}

export function createAarNarrative(
  decision: AarLogItem | undefined,
  feed: AarFeedItem[],
): string {
  if (!decision) return "No decision has been submitted in this run yet.";
  const latestDelay = feed.reduce((maximum, item) => Math.max(maximum, item.outcome.delayMin), 0);
  const delaySummary = latestDelay > 0
    ? `The largest scripted report delay in T1's available feed was ${latestDelay} minutes.`
    : "No delayed T1 report is recorded in the available feed.";
  return `${decision.detail} T1 had ${feed.length} report card(s) in the available feed. ${delaySummary}`;
}

export function toAarCsv(rows: AarLogItem[], moments: AarMoment[], narrative: string): string {
  const escape = (value: string | number | undefined) =>
    `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
  const lines = [
    ["metadata", "synthetic", "true", ""].map(escape).join(","),
    ["metadata", "illustrativeSimulation", "true", ""].map(escape).join(","),
    ["metadata", "validity_status", "unvalidated", ""].map(escape).join(","),
    ["record_type", "title", "sim_time", "detail", "actor"].map(escape).join(","),
    ...rows.map((row) => ["run_log", row.title, row.simTime, row.detail, row.actor].map(escape).join(",")),
    ...moments.map((moment) => ["key_moment", moment.rule, moment.simTime, moment.caption, ""].map(escape).join(",")),
    ["narrative", "Rule-based summary from this run's log", "", narrative, ""].map(escape).join(","),
  ];
  return lines.join("\r\n");
}

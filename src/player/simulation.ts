import silentRidgeScenario from "../fixtures/scenarios/silent-ridge.json";
import type { Command, RunLogEntry, Scenario, StreamEvent } from "../contracts";

export const scenario = silentRidgeScenario as unknown as Scenario;

export function resolveDecisionBranch(decisionPointId: string, optionId: string) {
  const match = scenario.branches.find(
    (branch) => branch.decisionPointId === decisionPointId && branch.optionId === optionId
  );

  return match?.segmentId ?? "";
}

export function computeDeliveryOutcome({
  fields = {},
  delayMin = 0,
  drop = false,
  partialFields = [],
  garble = false,
  text = "",
}: {
  fields?: Record<string, string>;
  delayMin?: number;
  drop?: boolean;
  partialFields?: string[];
  garble?: boolean;
  text?: string;
}) {
  const nextFields = { ...fields };

  for (const field of partialFields) {
    nextFields[field] = "—";
  }

  const cleanedText = drop ? "" : text;
  const words = cleanedText.split(/\s+/).filter(Boolean);
  const deliveryText = garble
    ? words
        .map((word, index) => (index % 2 === 0 ? word : "[BROKEN]") )
        .join(" ")
    : cleanedText;

  return {
    delayMin,
    dropped: drop,
    fields: nextFields,
    deliveryText,
  };
}

export function getScenarioItemsForSeat(seatId: "T1" | "T2" | "T3") {
  return scenario.segments.flatMap((segment) =>
    segment.items
      .filter((item) => item.to.includes(seatId))
      .map((item) => {
        const defaultDelivery = item.delivery[seatId] ?? {
          delayMin: 0,
          drop: false,
          partialFields: [],
          garble: false,
        };

        const outcome = computeDeliveryOutcome({
          fields: item.fields,
          delayMin: defaultDelivery.delayMin,
          drop: defaultDelivery.drop,
          partialFields: defaultDelivery.partialFields,
          garble: defaultDelivery.garble,
          text: item.text,
        });

        return {
          ...item,
          outcome,
        };
      })
  );
}

export function getInject(segmentCard: string) {
  const match = scenario.segments.find(
    (segment) =>
      segment.startsOn.type === "command" &&
      segment.startsOn.command === "FireInject" &&
      segment.startsOn.card === segmentCard
  );

  return match?.items ?? [];
}

export function getInitialT1Messages() {
  return getScenarioItemsForSeat("T1").slice(0, 2);
}

export function getBriefSummary() {
  return scenario.brief;
}

export function getMajorsAndText() {
  const notes = scenario.aarNotes.map((note) => note.explanation).join(" ");
  return `The truth stream is scripted for this exercise. ${notes}`;
}

export function buildRunLogFromScenario() {
  const log: Array<{ title: string; kind: "command" | "event"; detail: string }> = [
    ...scenario.segments
      .filter((segment) => segment.startsOn.type === "sessionStart")
      .flatMap((segment) =>
        segment.items.map((item) => ({
          title: item.id,
          kind: "event" as const,
          detail: `${item.from} → ${item.to.join(", ")} — ${item.text}`,
        }))
      ),
  ];

  return log;
}

export function createSessionCommand(
  sessionId: string,
  seat: "Instructor" | "T1" | "T2" | "T3" = "Instructor"
): Command {
  return {
    commandId: `create-session:${sessionId}`,
    sessionId,
    seat,
    clientSeq: 1,
    basisStreamSeq: 0,
    type: "CreateSession",
    payload: { scenarioId: scenario.id },
  };
}

export function createBriefIssuedEvent(sessionId: string): StreamEvent {
  return {
    sessionId,
    streamId: "perceived:T1",
    streamSeq: 1,
    sseq: 1,
    incarnation: 1,
    simTime: 0,
    type: "BriefIssued",
    payload: { scenarioId: scenario.id, acknowledgedBy: "T1" },
  };
}

export function appendUniqueLogEntry(
  entries: RunLogEntry[],
  entry: RunLogEntry
): RunLogEntry[] {
  if (entry.kind === "command") {
    const command = entry.data as Command;
    if (entries.some((current) =>
      current.kind === "command" && (current.data as Command).commandId === command.commandId
    )) {
      return entries;
    }
  } else {
    const event = entry.data as StreamEvent;
    const duplicate = entries.some((current) => {
      if (current.kind !== "event") return false;
      const existing = current.data as StreamEvent;
      return existing.type === event.type
        && existing.simTime === event.simTime
        && JSON.stringify(existing.payload) === JSON.stringify(event.payload);
    });
    if (duplicate) return entries;
  }

  return [...entries, entry];
}

export function listDecisionOptions() {
  return scenario.decisionPoints[0]?.options ?? [];
}

export function getDecisionPoint() {
  return scenario.decisionPoints[0];
}

export function getDecisionSummary() {
  return `Default: ${scenario.decisionPoints[0]?.defaultOption ?? "hold-ford"}`;
}

export function getTruthFacts() {
  const facts = scenario.truthTimeline.flatMap((item) => item.facts);
  return facts;
}

export function getScenarioStats() {
  return {
    itemCount: scenario.segments.reduce((count, segment) => count + segment.items.length, 0),
    decisionCount: scenario.decisionPoints.length,
    linkCount: scenario.links.length,
  };
}

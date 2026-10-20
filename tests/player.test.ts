import { describe, expect, it } from "vitest";
import {
  appendUniqueLogEntry,
  computeDeliveryOutcome,
  createBriefIssuedEvent,
  createSessionCommand,
  resolveDecisionBranch,
} from "../src/player/simulation";

describe("simulation delivery rules", () => {
  it("applies a delayed, dropped, partial and garbled message deterministically", () => {
    const outcome = computeDeliveryOutcome({
      delayMin: 4,
      drop: false,
      partialFields: ["strength"],
      garble: true,
      text: "HAWK 2 SITREP: enemy strength at FORD.",
    });

    expect(outcome.delayMin).toBe(4);
    expect(outcome.deliveryText).toContain("[BROKEN]");
    expect(outcome.fields.strength).toBe("—");
    expect(outcome.dropped).toBe(false);
  });

  it("resolves the re-task branch for T1", () => {
    const branch = resolveDecisionBranch("dp-1", "retask-uas");
    expect(branch).toBe("retask-uas-branch");
  });

  it("makes session creation idempotent by command ID", () => {
    const command = createSessionCommand("session-1");
    const entry = {
      wallTime: "2026-10-20T00:00:00.000Z",
      simTime: 0,
      kind: "command" as const,
      data: command,
    };
    const once = appendUniqueLogEntry([], entry);
    const twice = appendUniqueLogEntry(once, { ...entry, data: createSessionCommand("session-1") });

    expect(command.type).toBe("CreateSession");
    expect(twice).toHaveLength(1);
  });

  it("rejects a repeated event with the same type, sim time, and payload", () => {
    const event = createBriefIssuedEvent("session-1");
    const entry = {
      wallTime: "2026-10-20T00:00:00.000Z",
      simTime: event.simTime,
      kind: "event" as const,
      data: event,
    };
    const once = appendUniqueLogEntry([], entry);
    const twice = appendUniqueLogEntry(once, { ...entry, data: { ...event } });

    expect(twice).toHaveLength(1);
  });
});

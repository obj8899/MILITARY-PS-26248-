import type { CommandType, SeatId, StreamEventType } from "./scenario";

export interface StreamEvent<TPayload = unknown> {
  sessionId: string;
  streamId: "truth" | `perceived:${Extract<SeatId, "T1" | "T2" | "T3">}`;
  streamSeq: number;
  sseq: number;
  incarnation: number;
  simTime: number;
  type: StreamEventType;
  payload: TPayload;
}

export interface Command<TPayload = Record<string, unknown>> {
  commandId: string;
  sessionId: string;
  seat: SeatId;
  clientSeq: number;
  basisStreamSeq: number;
  type: CommandType;
  payload: TPayload;
}

export interface RunLogEntry {
  wallTime: string;
  simTime: number;
  kind: "command" | "event";
  data: Command | StreamEvent;
}

export function appendUniqueRunLogEntry(
  entries: RunLogEntry[],
  entry: RunLogEntry
): RunLogEntry[] {
  const entryId =
    entry.kind === "command"
      ? (entry.data as Command).commandId
      : `${(entry.data as StreamEvent).streamId}:${(entry.data as StreamEvent).streamSeq}`;

  const exists = entries.some((current) => {
    if (current.kind !== entry.kind) return false;
    if (current.kind === "command") {
      return (current.data as Command).commandId === entryId;
    }

    const event = current.data as StreamEvent;
    return `${event.streamId}:${event.streamSeq}` === entryId;
  });

  return exists ? entries : [...entries, entry];
}

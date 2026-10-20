export type SeatId = "Instructor" | "T1" | "T2" | "T3" | "T5" | "T6" | "Adjacent";

export type LinkProfileId = "clear" | "contested" | "heavilyJammed" | "deceptive";
export type Precedence = "FLASH" | "IMMEDIATE" | "ROUTINE";
export type StreamEventType =
  | "SessionStateChanged"
  | "BriefIssued"
  | "ReportDelivered"
  | "MessageDelivered"
  | "EntityPerceived"
  | "LinkStateChanged"
  | "InjectFired"
  | "DecisionPointOpened"
  | "DecisionRecorded"
  | "DefaultApplied"
  | "ItemFlagged"
  | "TruthUpdated";

export type CommandType =
  | "CreateSession"
  | "SetLinkProfile"
  | "SetLinkParam"
  | "FireInject"
  | "Pause"
  | "Resume"
  | "SetSpeed"
  | "EndSession"
  | "SubmitDecision"
  | "FlagItem"
  | "RetaskUAS"
  | "SendMessage"
  | "SendRunner"
  | "SwitchFrequency"
  | "Annotate"
  | "AdvisorAccepted"
  | "AutoDirectorToggled"
  | "ScenarioImported";

export type Coordinates = readonly [longitude: number, latitude: number];

export interface NamedPlace {
  id: string;
  label: string;
  coordinates: Coordinates;
  kind: "ford" | "bridge" | "ridge" | "fup" | "headquarters" | "position";
}

export interface MapDefinition {
  center: Coordinates;
  zoom: number;
  bounds: readonly [Coordinates, Coordinates];
  namedPlaces: NamedPlace[];
}

export interface LinkProfile {
  id: LinkProfileId;
  label: string;
  delayMin: readonly [minimum: number, maximum: number];
  lossPct: number;
  partialPct: number;
  garblePct: number;
}

export interface LinkDefinition {
  id: string;
  from: SeatId;
  to: SeatId;
  defaultProfile: LinkProfileId;
}

export interface TruthEntityState {
  id: string;
  label: string;
  affiliation: "friendly" | "hostile" | "unknown";
  coordinates: Coordinates;
  symbolCode: string;
  status?: string;
}

export interface TruthItem {
  id: string;
  simOffset: number;
  entities: TruthEntityState[];
  facts: string[];
}

export interface DeliveryRule {
  delayMin: number;
  drop: boolean;
  partialFields: string[];
  garble: boolean;
}

export interface ScenarioItem {
  id: string;
  kind: "report" | "message" | "truth";
  from: SeatId;
  to: SeatId[];
  simOffset: number;
  precedence?: Precedence;
  sourceGrade?: "A" | "B" | "C" | "D" | "E" | "F";
  credibility?: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  fields: Record<string, string>;
  location?: Coordinates;
  truthRef?: string;
  fabricated?: boolean;
  delivery: Partial<Record<SeatId, DeliveryRule>>;
}

export type SegmentStart =
  | { type: "sessionStart" }
  | { type: "command"; command: CommandType; card?: string }
  | { type: "branch"; decisionPointId: string; optionId: string };

export interface ScenarioSegment {
  id: string;
  startsOn: SegmentStart;
  items: ScenarioItem[];
}

export interface DecisionOption {
  id: string;
  label: string;
  consequenceLabel: string;
}

export interface DecisionPoint {
  id: string;
  seat: Extract<SeatId, "T1" | "T2" | "T3">;
  opensAt: number;
  deadlineMin: number;
  defaultOption: string;
  options: DecisionOption[];
}

export interface ScenarioBranch {
  decisionPointId: string;
  optionId: string;
  segmentId: string;
}

export interface ScenarioBrief {
  situation: string;
  mission: string;
  commanderIntent: string;
  hHour: string;
}

export interface AarNote {
  reportId: string;
  category: "delayed" | "dropped" | "partial" | "garbled" | "false";
  explanation: string;
}

export interface Scenario {
  id: string;
  title: string;
  synthetic: true;
  summary: string;
  map: MapDefinition;
  seats: SeatId[];
  links: LinkDefinition[];
  profiles: LinkProfile[];
  truthTimeline: TruthItem[];
  segments: ScenarioSegment[];
  decisionPoints: DecisionPoint[];
  branches: ScenarioBranch[];
  brief: ScenarioBrief;
  aarNotes: AarNote[];
}

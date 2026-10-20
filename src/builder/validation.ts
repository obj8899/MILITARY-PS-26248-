import type { Scenario } from "../contracts/scenario";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
}

export function isScenarioDefinition(value: unknown): value is Scenario {
  if (!isObject(value) || !isObject(value.map) || !isObject(value.brief)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    value.synthetic !== true ||
    !isStringArray(value.seats) ||
    !Array.isArray(value.links) ||
    !Array.isArray(value.profiles) ||
    !Array.isArray(value.truthTimeline) ||
    !Array.isArray(value.segments) ||
    !Array.isArray(value.decisionPoints) ||
    !Array.isArray(value.branches) ||
    !Array.isArray(value.aarNotes) ||
    !Array.isArray(value.map.namedPlaces)
  ) return false;

  if (
    !isCoordinate(value.map.center) ||
    typeof value.map.zoom !== "number" ||
    !Array.isArray(value.map.bounds) ||
    value.map.bounds.length !== 2 ||
    !value.map.bounds.every(isCoordinate) ||
    !value.map.namedPlaces.every((place) =>
      isObject(place) &&
      typeof place.id === "string" &&
      typeof place.label === "string" &&
      isCoordinate(place.coordinates) &&
      typeof place.kind === "string"
    ) ||
    typeof value.brief.situation !== "string" ||
    typeof value.brief.mission !== "string" ||
    typeof value.brief.commanderIntent !== "string" ||
    typeof value.brief.hHour !== "string"
  ) return false;

  return value.links.every((link) =>
    isObject(link) && typeof link.id === "string" && typeof link.from === "string" &&
    typeof link.to === "string" && typeof link.defaultProfile === "string"
  ) &&
    value.profiles.every((profile) =>
      isObject(profile) && typeof profile.id === "string" && typeof profile.label === "string" &&
      Array.isArray(profile.delayMin) && profile.delayMin.length === 2 &&
      profile.delayMin.every((minutes) => typeof minutes === "number") &&
      ["lossPct", "partialPct", "garblePct"].every((key) => typeof profile[key] === "number")
    ) &&
    value.truthTimeline.every((item) =>
      isObject(item) && typeof item.id === "string" && typeof item.simOffset === "number" &&
      isStringArray(item.facts) && Array.isArray(item.entities) &&
      item.entities.every((entity) =>
        isObject(entity) && typeof entity.id === "string" && typeof entity.label === "string" &&
        isCoordinate(entity.coordinates) && typeof entity.symbolCode === "string"
      )
    ) &&
    value.segments.every((segment) =>
      isObject(segment) && typeof segment.id === "string" && isObject(segment.startsOn) &&
      typeof segment.startsOn.type === "string" && Array.isArray(segment.items) &&
      segment.items.every((item) =>
        isObject(item) &&
        typeof item.id === "string" &&
        ["report", "message", "truth"].includes(String(item.kind)) &&
        typeof item.from === "string" &&
        isStringArray(item.to) &&
        typeof item.simOffset === "number" &&
        typeof item.text === "string" &&
        isObject(item.fields) &&
        Object.values(item.fields).every((field) => typeof field === "string") &&
        isObject(item.delivery) &&
        Object.values(item.delivery).every((rule) =>
          isObject(rule) && typeof rule.delayMin === "number" &&
          typeof rule.drop === "boolean" && isStringArray(rule.partialFields) &&
          typeof rule.garble === "boolean"
        )
      )
    ) &&
    value.decisionPoints.every((decision) =>
      isObject(decision) && typeof decision.id === "string" &&
      ["T1", "T2", "T3"].includes(String(decision.seat)) &&
      typeof decision.opensAt === "number" && typeof decision.deadlineMin === "number" &&
      typeof decision.defaultOption === "string" && Array.isArray(decision.options) &&
      decision.options.every((option) =>
        isObject(option) && typeof option.id === "string" &&
        typeof option.label === "string" && typeof option.consequenceLabel === "string"
      )
    ) &&
    value.branches.every((branch) =>
      isObject(branch) && typeof branch.decisionPointId === "string" &&
      typeof branch.optionId === "string" && typeof branch.segmentId === "string"
    ) &&
    value.aarNotes.every((note) =>
      isObject(note) && typeof note.reportId === "string" &&
      typeof note.category === "string" && typeof note.explanation === "string"
    );
}

export function parseScenarioDefinition(text: string):
  | { ok: true; scenario: Scenario }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!isScenarioDefinition(parsed)) {
    return { ok: false, error: "Scenario JSON is missing required synthetic scenario fields or contains malformed segments/items." };
  }
  return { ok: true, scenario: parsed };
}

export function generateSeededVariant(scenario: Scenario, seed: number): Scenario {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new RangeError("Variant seed must be a non-negative safe integer.");
  }
  const variant = structuredClone(scenario);
  const seedText = String(seed);
  for (const segment of variant.segments) {
    for (const item of segment.items) {
      for (const seat of variant.seats) {
        const rule = item.delivery[seat];
        if (!rule) continue;
        const input = `${seedText}:${item.id}:${seat}`;
        let hash = 2166136261;
        for (let index = 0; index < input.length; index += 1) {
          hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
        }
        rule.delayMin += (hash >>> 0) % 3;
      }
    }
  }
  variant.id = `${scenario.id}-variant-${seed}`;
  variant.title = `${scenario.title} · seeded variant ${seed}`;
  return variant;
}

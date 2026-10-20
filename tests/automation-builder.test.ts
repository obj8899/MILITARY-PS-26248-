import { describe, expect, it } from "vitest";
import { deriveAdvisorSuggestions } from "../src/automation/rules";
import { generateSeededVariant, parseScenarioDefinition } from "../src/builder/validation";
import { scenario } from "../src/player/simulation";

describe("rule-based instructor tools", () => {
  it("offers at most two suggestions from recorded events and state", () => {
    const suggestions = deriveAdvisorSuggestions(
      [{ title: "adjacent-bridge-spoof", kind: "event", detail: "Synthetic report delivered." }],
      {},
      true,
    );
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].rule).toContain("Verify or Discard");
    expect(suggestions[1].rule).toContain("no cited report IDs");
    expect(deriveAdvisorSuggestions([], {}, false)).toEqual([]);
    expect(deriveAdvisorSuggestions(
      [{ title: "adjacent-bridge-spoof", kind: "event", detail: "" }],
      { "adjacent-bridge-spoof": "Verify" },
      false,
    )).toEqual([]);
  });

  it("validates synthetic scenario JSON with plain errors", () => {
    const valid = parseScenarioDefinition(JSON.stringify(scenario));
    expect(valid.ok).toBe(true);
    expect(parseScenarioDefinition("{not json")).toMatchObject({ ok: false });
    expect(parseScenarioDefinition(JSON.stringify({ id: "custom", synthetic: false }))).toMatchObject({
      ok: false,
      error: expect.stringContaining("required synthetic scenario fields"),
    });
  });

  it("produces a reproducible variant without mutating its source fixture", () => {
    const before = JSON.stringify(scenario);
    const first = generateSeededVariant(scenario, 26248);
    const second = generateSeededVariant(scenario, 26248);
    expect(first).toEqual(second);
    expect(first.id).toContain("variant-26248");
    expect(JSON.stringify(scenario)).toBe(before);
    expect(() => generateSeededVariant(scenario, -1)).toThrow(RangeError);
  });
});

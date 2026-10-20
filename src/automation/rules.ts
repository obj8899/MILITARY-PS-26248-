export interface AdvisorRunEntry {
  title: string;
  detail: string;
  kind: "command" | "event";
}

export interface AdvisorSuggestion {
  id: string;
  rule: string;
  recommendation: string;
  action: string;
}

export function deriveAdvisorSuggestions(
  runLog: AdvisorRunEntry[],
  triageStatus: Record<string, string>,
  hasUncitedDecision: boolean,
): AdvisorSuggestion[] {
  const suggestions: AdvisorSuggestion[] = [];
  const spoofDelivered = runLog.some((entry) => entry.kind === "event" && entry.title === "adjacent-bridge-spoof");

  if (spoofDelivered && triageStatus["adjacent-bridge-spoof"] !== "Verify" && triageStatus["adjacent-bridge-spoof"] !== "Discard") {
    suggestions.push({
      id: "verify-contradictory-report",
      rule: "A delivered contradictory report has no Verify or Discard annotation.",
      recommendation: "Consider asking T1 to verify the adjacent-unit report.",
      action: "Open T1 console",
    });
  }

  if (hasUncitedDecision) {
    suggestions.push({
      id: "decision-without-basis",
      rule: "The decision record contains no cited report IDs.",
      recommendation: "Review the reports held by T1 and add a cited basis in a rehearsal.",
      action: "Open T1 decision",
    });
  }

  return suggestions.slice(0, 2);
}

// Plain messages for a failed search or profile load. Specific server error
// codes keep their own wording; no connection always reads as offline.

const MESSAGES: Record<string, [string, string]> = {
  invalid_zip: ["Check your ZIP code", "Enter a five-digit US ZIP code and search again."],
  invalid_area: ["Check your location", "Enter a ZIP code to search a valid US area."],
  missing_query: ["Start a search", "Enter a ZIP code or a provider name."],
  rate_limited: ["Too many requests", "Wait a minute before trying again."],
  rate_limit_unavailable: ["Search protection is unavailable", "The service is temporarily unavailable. Try again shortly."],
  area_unresolved: ["Location could not be resolved", "Enter a ZIP code instead."],
};

export function describeFailure(code: string | null, online: boolean): { kind: "offline" | "error"; title: string; body: string } {
  if (!online) return { kind: "offline", title: "You're offline", body: "Check your internet connection and try again." };
  const [title, body] = MESSAGES[code ?? ""] ?? ["Something went wrong on our end", "Try again in a moment."];
  return { kind: "error", title, body };
}

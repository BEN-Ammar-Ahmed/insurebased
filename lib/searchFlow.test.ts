import { describe, expect, it } from "vitest";
import { coverageCheckingText, panelDestination, questionSteps, repairLegacyResultsParams, resultsHref } from "./searchFlow";

describe("questionSteps", () => {
  const place = { byName: false, hasPlace: true, askInsurance: false };

  it("asks only kind of doctor and distance for Medicare", () => {
    expect(questionSteps({ ...place, category: "medicare" })).toEqual(["specialty", "distance"]);
  });

  it("asks for the exact plan for ACA", () => {
    expect(questionSteps({ ...place, category: "marketplace" })).toEqual(["plan", "specialty", "distance"]);
  });

  it("asks for the insurer for other insurance", () => {
    expect(questionSteps({ ...place, category: "other" })).toEqual(["insurer", "specialty", "distance"]);
  });

  it("asks location and insurance first when neither is known", () => {
    expect(questionSteps({ byName: false, hasPlace: false, askInsurance: true, category: null })).toEqual([
      "location", "insurance", "specialty", "distance",
    ]);
  });

  it("keeps the insurance step in the path after it is answered", () => {
    expect(questionSteps({ byName: false, hasPlace: true, askInsurance: true, category: "marketplace" })).toEqual([
      "insurance", "plan", "specialty", "distance",
    ]);
  });

  it("asks name then insurance in name mode", () => {
    expect(questionSteps({ byName: true, hasPlace: false, askInsurance: true, category: null })).toEqual(["name", "insurance"]);
  });

  it("asks name then plan in name mode with ACA", () => {
    expect(questionSteps({ byName: true, hasPlace: false, askInsurance: false, category: "marketplace" })).toEqual(["name", "plan"]);
  });
});

describe("panelDestination", () => {
  it("goes straight to results", () => {
    expect(panelDestination({ place: { zip: "60614" }, category: "medicare", more: false })).toBe("/results?zip=60614&category=medicare");
  });

  it("treats no insurance choice as skip", () => {
    expect(panelDestination({ place: { zip: "60614" }, category: null, more: false })).toBe("/results?zip=60614&category=none");
  });

  it("sends ACA to the plan question first", () => {
    expect(panelDestination({ place: { zip: "60614" }, category: "marketplace", more: false })).toBe("/search?zip=60614&category=marketplace");
  });

  it("sends More options to the question page with coordinates", () => {
    expect(panelDestination({ place: { lat: "41.923", lng: "-87.639" }, category: "none", more: true })).toBe(
      "/search?lat=41.923&lng=-87.639&category=none"
    );
  });
});

describe("resultsHref", () => {
  it("never sends a marketplace search without a plan", () => {
    expect(resultsHref({ place: { zip: "60614" }, category: "marketplace", acaPlanSkipped: true, specialty: "Cardiology", within: 5 })).toBe(
      "/results?zip=60614&category=none&noPlan=1&specialty=Cardiology&within=5"
    );
  });

  it("carries every plan detail", () => {
    const href = resultsHref({
      place: { zip: "60614" }, category: "marketplace",
      planId: "12345IL0010001", planName: "Gold PPO", issuerName: "Acme", planYear: 2026,
    });
    const q = new URL(href, "https://x.test").searchParams;
    expect(q.get("category")).toBe("marketplace");
    expect(q.get("planId")).toBe("12345IL0010001");
    expect(q.get("planName")).toBe("Gold PPO");
    expect(q.get("issuerName")).toBe("Acme");
    expect(q.get("planYear")).toBe("2026");
  });

  it("builds a name search", () => {
    expect(resultsHref({ name: "Smith", state: "IL", category: "other", insurerName: "Aetna" })).toBe(
      "/results?name=Smith&state=IL&category=other&insurerName=Aetna"
    );
  });

  it("leaves out an empty distance", () => {
    expect(resultsHref({ place: { zip: "60614" }, category: "none", within: null })).toBe("/results?zip=60614&category=none");
  });
});

describe("repairLegacyResultsParams", () => {
  it("turns an old ACA link with an empty plan into an honest no-plan search", () => {
    const fixed = repairLegacyResultsParams(new URLSearchParams("zip=60614&category=marketplace&planId=&planName=&issuerName=&planYear=2026&specialty=Cardiology"));
    expect(fixed?.toString()).toBe("zip=60614&category=none&specialty=Cardiology&noPlan=1");
  });

  it("repairs an ACA link with an impossible plan year", () => {
    expect(repairLegacyResultsParams(new URLSearchParams("zip=60614&category=marketplace&planId=12345IL0010001&planYear=1999"))?.get("noPlan")).toBe("1");
  });

  it("leaves a valid ACA link alone", () => {
    expect(repairLegacyResultsParams(new URLSearchParams("zip=60614&category=marketplace&planId=12345IL0010001&planYear=2026"))).toBeNull();
  });

  it("leaves other insurance alone", () => {
    expect(repairLegacyResultsParams(new URLSearchParams("zip=60614&category=medicare"))).toBeNull();
  });
});

describe("coverageCheckingText", () => {
  it("names what is being checked", () => {
    expect(coverageCheckingText("medicare")).toBe("Checking Medicare…");
    expect(coverageCheckingText("marketplace")).toBe("Checking your plan…");
    expect(coverageCheckingText("other")).toBe("Checking your insurance…");
  });
});

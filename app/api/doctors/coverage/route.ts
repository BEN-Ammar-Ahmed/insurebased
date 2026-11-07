import { NextRequest, NextResponse } from "next/server";
import { computeCoverage, parseInsuranceQuery } from "@/lib/insuranceCheck";
import { isValidNpi } from "@/lib/validation";
import { rateLimitResponse } from "@/lib/rateLimit";

// Coverage is checked separately from the provider list because the official
// sources (especially CMS Medicare data) can take several seconds. The list
// and profile render right away and fill in coverage when this returns.
// Both screens call this one route, so they can never disagree.
export async function GET(req: NextRequest) {
  const limited = await rateLimitResponse(req, "coverage");
  if (limited) return limited;

  const sp = req.nextUrl.searchParams;
  const npis = [...new Set((sp.get("npis") ?? "").split(",").filter(Boolean))];
  if (!npis.length || npis.length > 60 || !npis.every(isValidNpi)) {
    return NextResponse.json({ error: "invalid_npis" }, { status: 400 });
  }
  const query = parseInsuranceQuery(sp);
  if ("error" in query) return NextResponse.json({ error: query.error }, { status: 400 });

  const coverage = await computeCoverage(npis, query);
  return NextResponse.json({ coverage: Object.fromEntries(coverage) });
}

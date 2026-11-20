import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/vercelStore";

export async function GET(req: NextRequest) {
  const shortlistedOnly = req.nextUrl.searchParams.get("shortlisted_only") !== "false";
  const list = shortlistedOnly ? store.jobs.filter((j) => j.shortlisted) : store.jobs;
  return NextResponse.json({
    jobs: [...list].sort((a, b) => b.match_score - a.match_score),
  });
}

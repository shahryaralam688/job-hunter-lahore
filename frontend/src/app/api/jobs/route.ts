import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";
import { store } from "@/lib/vercelStore";

export async function GET(req: NextRequest) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;
  const shortlistedOnly = req.nextUrl.searchParams.get("shortlisted_only") !== "false";
  const list = shortlistedOnly ? store.jobs.filter((j) => j.shortlisted) : store.jobs;
  return NextResponse.json({
    jobs: [...list].sort((a, b) => b.match_score - a.match_score),
  });
}

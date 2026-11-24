import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";
import { store } from "@/lib/vercelStore";

export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;
  const before = store.jobs.length;
  store.jobs = store.jobs.filter((j) => j.source !== "mock");
  return NextResponse.json({ deleted: before - store.jobs.length });
}

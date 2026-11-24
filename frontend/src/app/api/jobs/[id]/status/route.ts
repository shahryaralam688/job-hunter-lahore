import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";
import { store } from "@/lib/vercelStore";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;
  const { id } = await context.params;
  const jobId = Number(id);
  const body = await req.json();
  const job = store.jobs.find((j) => j.id === jobId);
  if (!job) {
    return NextResponse.json({ detail: "Job not found" }, { status: 404 });
  }
  job.status = body.status;
  return NextResponse.json({ job });
}

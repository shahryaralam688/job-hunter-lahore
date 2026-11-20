import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/vercelStore";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

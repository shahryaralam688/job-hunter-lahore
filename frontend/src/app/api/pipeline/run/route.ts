import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";
import { runVercelPipeline } from "@/lib/vercelStore";

export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;
  let mockMode: boolean | undefined;
  try {
    const body = await req.json();
    if (typeof body?.mock_mode === "boolean") {
      mockMode = body.mock_mode;
    }
  } catch {
    // empty body is fine
  }
  const result = await runVercelPipeline(mockMode);
  return NextResponse.json(result);
}

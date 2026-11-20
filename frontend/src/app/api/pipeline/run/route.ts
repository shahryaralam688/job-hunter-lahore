import { NextRequest, NextResponse } from "next/server";
import { runVercelPipeline } from "@/lib/vercelStore";

export async function POST(req: NextRequest) {
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

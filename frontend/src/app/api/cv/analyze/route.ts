import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";
import { analyzeCvForVercel } from "@/lib/vercelStore";

export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;

  let cvText: string | undefined;
  let keywords: string[] | undefined;
  let mockMode: boolean | undefined;

  try {
    const body = await req.json();
    if (typeof body?.cv_text === "string") cvText = body.cv_text;
    if (Array.isArray(body?.keywords)) keywords = body.keywords;
    if (typeof body?.mock_mode === "boolean") mockMode = body.mock_mode;
  } catch {
    // empty body is fine
  }

  const analysis = await analyzeCvForVercel(cvText, keywords, mockMode);
  return NextResponse.json({ analysis });
}

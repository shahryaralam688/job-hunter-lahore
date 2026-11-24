import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";
import { getDefaultPrompts, store } from "@/lib/vercelStore";

export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;
  store.settings.prompts = getDefaultPrompts();
  return NextResponse.json({ settings: store.settings });
}

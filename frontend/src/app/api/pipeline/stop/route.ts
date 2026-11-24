import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";
import { store } from "@/lib/vercelStore";

export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;
  store.snapshot.is_running = false;
  return NextResponse.json({ stopped: true });
}

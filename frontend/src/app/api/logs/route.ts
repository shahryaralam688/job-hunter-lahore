import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";
import { store } from "@/lib/vercelStore";

export async function GET(req: NextRequest) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;
  const limit = Number(req.nextUrl.searchParams.get("limit") || "120");
  return NextResponse.json({ logs: store.logs.slice(-limit) });
}

import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/vercelStore";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || "120");
  return NextResponse.json({ logs: store.logs.slice(-limit) });
}

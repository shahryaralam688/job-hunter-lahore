import { NextResponse } from "next/server";
import { store } from "@/lib/vercelStore";

export async function POST() {
  store.snapshot.is_running = false;
  return NextResponse.json({ stopped: true });
}

import { NextResponse } from "next/server";
import { store } from "@/lib/vercelStore";

export async function GET() {
  return NextResponse.json(store.snapshot);
}

import { NextResponse } from "next/server";
import { getDefaultPrompts, store } from "@/lib/vercelStore";

export async function POST() {
  store.settings.prompts = getDefaultPrompts();
  return NextResponse.json({ settings: store.settings });
}

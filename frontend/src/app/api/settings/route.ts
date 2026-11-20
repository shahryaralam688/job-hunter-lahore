import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/vercelStore";

export async function GET() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const tgChat = process.env.TELEGRAM_CHAT_ID?.trim();
  return NextResponse.json({
    settings: store.settings,
    next_scheduled_run: null,
    gemini_configured: Boolean(key && key !== "your_gemini_api_key_here"),
    telegram_configured: Boolean(tgToken && tgChat),
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  store.settings = { ...store.settings, ...body };
  return NextResponse.json({ settings: store.settings, next_scheduled_run: null });
}

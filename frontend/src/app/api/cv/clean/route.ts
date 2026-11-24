import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/serverAuth";

function normalizeLocally(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 15000);
}

export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req);
  if (authError) return authError;

  let rawText = "";
  let mockMode = false;

  try {
    const body = await req.json();
    rawText = typeof body?.raw_text === "string" ? body.raw_text : "";
    mockMode = Boolean(body?.mock_mode);
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
  }

  const normalized = normalizeLocally(rawText);
  if (!normalized) {
    return NextResponse.json({ cleaned_text: "", used_llm: false });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!mockMode && apiKey && apiKey !== "your_gemini_api_key_here") {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: "You are a concise CV text cleaner. Reformat raw extracted CV text into clean, readable plain text sections (Name/Contact, Summary, Skills, Experience, Education). Do NOT invent or remove any facts. Return plain text only.",
                },
              ],
            },
            contents: [{ parts: [{ text: normalized.slice(0, 12000) }] }],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string" && text.trim().length >= 30) {
          return NextResponse.json({
            cleaned_text: normalizeLocally(text),
            used_llm: true,
          });
        }
      }
    } catch {
      // Fallback to local normalization
    }
  }

  return NextResponse.json({ cleaned_text: normalized, used_llm: false });
}

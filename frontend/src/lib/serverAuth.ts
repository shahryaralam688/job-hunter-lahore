import { createClient } from "@supabase/supabase-js";
import { connection, NextRequest, NextResponse } from "next/server";

function getServerSupabaseConfig() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  const configured =
    Boolean(url) &&
    Boolean(anonKey) &&
    url.startsWith("http") &&
    !url.includes("your-project-ref") &&
    anonKey !== "your_supabase_anon_key_here";

  return { url, anonKey, configured };
}

export async function requireApiAuth(req: NextRequest): Promise<NextResponse | null> {
  await connection();
  const authHeader = req.headers.get("authorization") || "";
  const { url, anonKey, configured } = getServerSupabaseConfig();
  if (!configured) {
    return null;
  }

  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return NextResponse.json(
      { detail: "Authentication required. Please sign in." },
      { status: 401 }
    );
  }

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return NextResponse.json(
      { detail: "Invalid or expired session. Please sign in again." },
      { status: 401 }
    );
  }

  return null;
}

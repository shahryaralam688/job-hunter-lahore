import { NextResponse } from "next/server";
import { store } from "@/lib/vercelStore";

export async function POST() {
  const before = store.jobs.length;
  store.jobs = store.jobs.filter((j) => j.source !== "mock");
  return NextResponse.json({ deleted: before - store.jobs.length });
}

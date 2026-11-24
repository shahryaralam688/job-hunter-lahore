import { getSupabaseClient } from "./supabase";
import type {
  CVAnalysis,
  JobItem,
  JobStatus,
  LogEntry,
  PipelineSnapshot,
  RunRecord,
  SettingsData,
  SettingsResponse,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "";

export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Unauthorized (401). Please sign in again.");
    }
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getPipelineStatus: () => request<PipelineSnapshot>("/api/pipeline/status"),
  runPipeline: (mock_mode?: boolean) =>
    request<{ started: boolean; run_id?: number; mode?: string; reason?: string }>(
      "/api/pipeline/run",
      {
        method: "POST",
        body: JSON.stringify(mock_mode === undefined ? {} : { mock_mode }),
      }
    ),
  stopPipeline: () =>
    request<{ stopped: boolean; reason?: string }>("/api/pipeline/stop", {
      method: "POST",
    }),
  getLogs: (limit = 120) =>
    request<{ logs: LogEntry[] }>(`/api/logs?limit=${limit}`),
  getJobs: (shortlistedOnly = true) =>
    request<{ jobs: JobItem[] }>(`/api/jobs?shortlisted_only=${shortlistedOnly}`),
  updateJobStatus: (jobId: number, status: JobStatus) =>
    request<{ job: JobItem }>(`/api/jobs/${jobId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  resetMockJobs: () =>
    request<{ deleted: number }>("/api/jobs/reset-mock", {
      method: "POST",
    }),
  getRuns: () => request<{ runs: RunRecord[] }>("/api/runs"),
  getSettings: () => request<SettingsResponse>("/api/settings"),
  saveSettings: (data: SettingsData) =>
    request<{ settings: SettingsData; next_scheduled_run: string | null }>(
      "/api/settings",
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    ),
  resetPrompts: () =>
    request<{ settings: SettingsData }>("/api/settings/reset-prompts", {
      method: "POST",
    }),
  analyzeCv: (payload?: { cv_text?: string; keywords?: string[]; mock_mode?: boolean }) =>
    request<{ analysis: CVAnalysis }>("/api/cv/analyze", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  cleanCvText: (payload: { raw_text: string; mock_mode?: boolean }) =>
    request<{ cleaned_text: string; used_llm: boolean }>("/api/cv/clean", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

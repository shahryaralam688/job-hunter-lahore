import type {
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
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
};

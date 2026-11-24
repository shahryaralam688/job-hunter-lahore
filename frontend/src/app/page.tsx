"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  Briefcase,
  History,
  LogOut,
  Radar,
  Settings,
} from "lucide-react";
import { api, getAccessToken, WS_BASE } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  JobItem,
  JobStatus,
  LogEntry,
  PipelineSnapshot,
  RunRecord,
  SettingsData,
} from "@/lib/types";
import { AuthScreen } from "@/components/AuthScreen";
import { PipelineMonitor } from "@/components/PipelineMonitor";
import { JobsView } from "@/components/JobsView";
import { ConfigView } from "@/components/ConfigView";
import { HistoryView } from "@/components/HistoryView";

type TabId = "monitor" | "jobs" | "config" | "history";

const DEFAULT_SNAPSHOT: PipelineSnapshot = {
  is_running: false,
  current_run_id: null,
  agents: [
    {
      name: "category_planner",
      label: "Category Planner",
      status: "IDLE",
      current_task: "Waiting for pipeline run",
      items_processed: 0,
      items_total: 0,
      execution_time_ms: 0,
    },
    {
      name: "scout",
      label: "Scout Agent",
      status: "IDLE",
      current_task: "Waiting for pipeline run",
      items_processed: 0,
      items_total: 0,
      execution_time_ms: 0,
    },
    {
      name: "recruiter",
      label: "Recruiter Agent",
      status: "IDLE",
      current_task: "Waiting for pipeline run",
      items_processed: 0,
      items_total: 0,
      execution_time_ms: 0,
    },
    {
      name: "writer",
      label: "Writer Agent",
      status: "IDLE",
      current_task: "Waiting for pipeline run",
      items_processed: 0,
      items_total: 0,
      execution_time_ms: 0,
    },
    {
      name: "dispatcher",
      label: "Dispatcher Agent",
      status: "IDLE",
      current_task: "Waiting for pipeline run",
      items_processed: 0,
      items_total: 0,
      execution_time_ms: 0,
    },
  ],
};

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(getSupabaseClient()));
  const [activeTab, setActiveTab] = useState<TabId>("monitor");
  const [snapshot, setSnapshot] = useState<PipelineSnapshot>(DEFAULT_SNAPSHOT);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [nextScheduledRun, setNextScheduledRun] = useState<string | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [wsConnected, setWsConnected] = useState(() => !WS_BASE);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [statusRes, logsRes, jobsRes, runsRes, settingsRes] = await Promise.all([
        api.getPipelineStatus(),
        api.getLogs(120),
        api.getJobs(true),
        api.getRuns(),
        api.getSettings(),
      ]);
      setSnapshot(statusRes);
      setLogs(logsRes.logs);
      setJobs(jobsRes.jobs);
      setRuns(runsRes.runs);
      setSettings(settingsRes.settings);
      setNextScheduledRun(settingsRes.next_scheduled_run);
      setGeminiConfigured(settingsRes.gemini_configured);
      setTelegramConfigured(settingsRes.telegram_configured);
      setErrorBanner(null);
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? `Backend unreachable (${err.message}). Make sure FastAPI is running on port 8000.`
          : "Backend unreachable."
      );
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      void refreshData();
    }, 0);
    return () => clearTimeout(timer);
  }, [session, refreshData]);

  // WebSocket live stream with auto-reconnect (when external WS_BASE is configured)
  useEffect(() => {
    if (!session || !WS_BASE) {
      return;
    }
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (cancelled) return;
      const token = await getAccessToken();
      if (cancelled) return;
      const wsUrl = token
        ? `${WS_BASE}/ws/pipeline?token=${encodeURIComponent(token)}`
        : `${WS_BASE}/ws/pipeline`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "snapshot") {
            setSnapshot((prev) => ({
              ...prev,
              ...msg.data,
            }));
          } else if (msg.type === "log") {
            setLogs((prev) => [...prev.slice(-199), msg.data as LogEntry]);
          } else if (msg.type === "run_finished") {
            // Refresh jobs and runs when a pipeline run completes
            api.getJobs(true).then((r) => setJobs(r.jobs)).catch(() => {});
            api.getRuns().then((r) => setRuns(r.runs)).catch(() => {});
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          setWsConnected(false);
          reconnectTimer = setTimeout(() => {
            void connect();
          }, 2500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [session]);

  const handleRun = async () => {
    try {
      await api.runPipeline(settings?.mock_mode);
      setErrorBanner(null);
      if (!WS_BASE) {
        await refreshData();
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to start pipeline");
    }
  };

  const handleStop = async () => {
    try {
      await api.stopPipeline();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to stop pipeline");
    }
  };

  const handleToggleMock = async () => {
    if (!settings) return;
    const updated = { ...settings, mock_mode: !settings.mock_mode };
    const res = await api.saveSettings(updated);
    setSettings(res.settings);
  };

  const handleToggleSchedule = async () => {
    if (!settings) return;
    const updated = {
      ...settings,
      auto_schedule_enabled: !settings.auto_schedule_enabled,
    };
    const res = await api.saveSettings(updated);
    setSettings(res.settings);
    setNextScheduledRun(res.next_scheduled_run);
  };

  const handleResetMock = async () => {
    await api.resetMockJobs();
    const jobsRes = await api.getJobs(true);
    setJobs(jobsRes.jobs);
  };

  const handleJobStatusChange = async (jobId: number, status: JobStatus) => {
    const res = await api.updateJobStatus(jobId, status);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? res.job : j)));
  };

  const handleSaveSettings = async (updated: SettingsData) => {
    const res = await api.saveSettings(updated);
    setSettings(res.settings);
    setNextScheduledRun(res.next_scheduled_run);
  };

  const handleResetPrompts = async () => {
    const res = await api.resetPrompts();
    setSettings(res.settings);
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    wsRef.current?.close();
    setSession(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090B] text-sm text-zinc-400">
        Checking session...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "monitor",
      label: "Live Agent Monitor",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      id: "jobs",
      label: "Shortlisted Jobs",
      icon: <Briefcase className="h-4 w-4" />,
      badge: jobs.length,
    },
    {
      id: "config",
      label: "Agent Control & Config",
      icon: <Settings className="h-4 w-4" />,
    },
    {
      id: "history",
      label: "Run History & Stats",
      icon: <History className="h-4 w-4" />,
      badge: runs.length,
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#09090B]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <Radar className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-zinc-100">
                Job Hunter Lahore
              </h1>
              <p className="text-xs text-zinc-400">
                Multi-Agent AI Discovery · Lahore (On-site / Hybrid) &amp; Remote
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap items-center gap-1.5">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      active
                        ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {typeof tab.badge === "number" && (
                      <span className="rounded-full bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 border-l border-zinc-800 pl-2">
              {session.user?.email && (
                <span className="hidden max-w-[160px] truncate rounded-md bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-400 sm:inline-block">
                  {session.user.email}
                </span>
              )}
              <button
                id="sign-out-btn"
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {errorBanner && (
          <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {errorBanner}
          </div>
        )}

        {activeTab === "monitor" && (
          <PipelineMonitor
            snapshot={snapshot}
            logs={logs}
            mockMode={settings?.mock_mode ?? true}
            autoSchedule={settings?.auto_schedule_enabled ?? false}
            nextScheduledRun={nextScheduledRun}
            wsConnected={wsConnected}
            onRun={handleRun}
            onStop={handleStop}
            onToggleMock={handleToggleMock}
            onToggleSchedule={handleToggleSchedule}
            onResetMock={handleResetMock}
          />
        )}

        {activeTab === "jobs" && (
          <JobsView jobs={jobs} onStatusChange={handleJobStatusChange} />
        )}

        {activeTab === "config" && settings && (
          <ConfigView
            settings={settings}
            geminiConfigured={geminiConfigured}
            telegramConfigured={telegramConfigured}
            onSave={handleSaveSettings}
            onResetPrompts={handleResetPrompts}
          />
        )}

        {activeTab === "history" && <HistoryView runs={runs} />}
      </main>
    </div>
  );
}

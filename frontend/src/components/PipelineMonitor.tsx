"use client";

import React, { useEffect, useRef } from "react";
import {
  Activity,
  ArrowRight,
  Clock,
  Cpu,
  FileText,
  Play,
  Radar,
  RotateCcw,
  Send,
  Square,
  Terminal,
  UserCheck,
} from "lucide-react";
import type { AgentState, AgentStatus, LogEntry, PipelineSnapshot } from "@/lib/types";

interface PipelineMonitorProps {
  snapshot: PipelineSnapshot;
  logs: LogEntry[];
  mockMode: boolean;
  autoSchedule: boolean;
  nextScheduledRun: string | null;
  wsConnected: boolean;
  onRun: () => void;
  onStop: () => void;
  onToggleMock: () => void;
  onToggleSchedule: () => void;
  onResetMock: () => void;
}

const AGENT_ICONS: Record<AgentState["name"], React.ReactNode> = {
  category_planner: <Cpu className="h-4 w-4 text-violet-400" />,
  scout: <Radar className="h-4 w-4 text-sky-400" />,
  recruiter: <UserCheck className="h-4 w-4 text-emerald-400" />,
  writer: <FileText className="h-4 w-4 text-amber-400" />,
  dispatcher: <Send className="h-4 w-4 text-zinc-200" />,
};

const AGENT_SUBTITLES: Record<AgentState["name"], string> = {
  category_planner: "Pakistan Top Categories · Bank · Univ · Tech",
  scout: "LinkedIn · Indeed · Google · Glassdoor · RemoteOK · Jobz.pk",
  recruiter: "Gemini AI · CV Scoring",
  writer: "ATS Bullets · Pitch · Interview Qs",
  dispatcher: "SQLite Persistence · Google Sheets",
};

function statusBadge(status: AgentStatus) {
  switch (status) {
    case "RUNNING":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/25">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          RUNNING
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/25">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          COMPLETED
        </span>
      );
    case "ERROR":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-300 ring-1 ring-inset ring-rose-500/25">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          ERROR
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400 ring-1 ring-inset ring-zinc-700/60">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
          IDLE
        </span>
      );
  }
}

function formatMs(ms: number) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function PipelineMonitor({
  snapshot,
  logs,
  mockMode,
  autoSchedule,
  nextScheduledRun,
  wsConnected,
  onRun,
  onStop,
  onToggleMock,
  onToggleSchedule,
  onResetMock,
}: PipelineMonitorProps) {
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-800/80 bg-[#111114] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {!snapshot.is_running ? (
            <button
              id="run-pipeline-btn"
              onClick={onRun}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-emerald-400 active:scale-[0.99] cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              Run Pipeline Now
            </button>
          ) : (
            <button
              id="stop-pipeline-btn"
              onClick={onStop}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/35 transition hover:bg-rose-500/25 cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop Pipeline
            </button>
          )}

          {mockMode && (
            <button
              id="reset-mock-btn"
              onClick={onResetMock}
              disabled={snapshot.is_running}
              title="Clear simulated mock jobs so you can re-run the test pipeline"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Mock Jobs
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Mock/Test Mode Toggle */}
          <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
            <button
              id="toggle-mock-mode"
              type="button"
              role="switch"
              aria-checked={mockMode}
              onClick={onToggleMock}
              disabled={snapshot.is_running}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                mockMode ? "bg-sky-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  mockMode ? "translate-x-4.5" : "translate-x-1"
                }`}
              />
            </button>
            <span className="flex items-center gap-1.5 font-medium">
              <Cpu className="h-3.5 w-3.5 text-sky-400" />
              Mock / Test Mode
            </span>
          </label>

          {/* Auto-Schedule Toggle */}
          <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
            <button
              id="toggle-auto-schedule"
              type="button"
              role="switch"
              aria-checked={autoSchedule}
              onClick={onToggleSchedule}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                autoSchedule ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  autoSchedule ? "translate-x-4.5" : "translate-x-1"
                }`}
              />
            </button>
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              Daily 9:00 AM PKT
            </span>
          </label>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
            <span
              className={`h-2 w-2 rounded-full ${
                wsConnected ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            {wsConnected ? "WS LIVE" : "RECONNECTING"}
          </div>
        </div>
      </div>

      {autoSchedule && nextScheduledRun && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2 text-xs text-emerald-300">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Auto-schedule active. Next automated run:{" "}
            <strong className="font-mono">
              {new Date(nextScheduledRun).toLocaleString()}
            </strong>{" "}
            (Asia/Karachi)
          </span>
        </div>
      )}

      {/* 4-Card Agent Pipeline */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.agents.map((agent, idx) => {
          const pct =
            agent.items_total > 0
              ? Math.min(100, Math.round((agent.items_processed / agent.items_total) * 100))
              : agent.status === "COMPLETED"
              ? 100
              : 0;

          return (
            <div key={agent.name} className="relative flex items-stretch">
              <div
                className={`flex w-full flex-col justify-between rounded-xl border p-4 transition-colors ${
                  agent.status === "RUNNING"
                    ? "border-amber-500/40 bg-[#141418]"
                    : agent.status === "COMPLETED"
                    ? "border-emerald-500/25 bg-[#111114]"
                    : agent.status === "ERROR"
                    ? "border-rose-500/40 bg-[#141114]"
                    : "border-zinc-800/80 bg-[#111114]"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
                        {AGENT_ICONS[agent.name]}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          {agent.label}
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                          {AGENT_SUBTITLES[agent.name]}
                        </p>
                      </div>
                    </div>
                    {statusBadge(agent.status)}
                  </div>

                  <p className="mt-4 min-h-[2.25rem] text-xs leading-relaxed text-zinc-300">
                    {agent.current_task}
                  </p>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
                    <div
                      className={`h-full transition-all duration-300 ${
                        agent.status === "ERROR"
                          ? "bg-rose-500"
                          : agent.status === "COMPLETED"
                          ? "bg-emerald-500"
                          : "bg-amber-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>
                      ITEMS: {agent.items_processed}
                      {agent.items_total > 0 ? `/${agent.items_total}` : ""}
                    </span>
                    <span>TIME: {formatMs(agent.execution_time_ms)}</span>
                  </div>
                </div>
              </div>

              {idx < snapshot.agents.length - 1 && (
                <div className="hidden xl:flex items-center justify-center pl-2 -mr-2 text-zinc-700">
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Terminal Activity Log */}
      <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-[#0C0C0E]">
        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#111114] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span>Live Agent Activity Log</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
            <Activity className="h-3 w-3" />
            <span>{logs.length} events</span>
          </div>
        </div>

        <div className="h-72 overflow-y-auto p-4 font-mono text-xs leading-6">
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-600">
              No agent activity yet. Click &ldquo;Run Pipeline Now&rdquo; to start.
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((entry) => {
                const time = new Date(entry.created_at).toLocaleTimeString([], {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                const levelColor =
                  entry.level === "ERROR"
                    ? "text-rose-400"
                    : entry.level === "WARN"
                    ? "text-amber-300"
                    : "text-zinc-300";
                const agentColor =
                  entry.agent === "scout"
                    ? "text-sky-400"
                    : entry.agent === "recruiter"
                    ? "text-emerald-400"
                    : entry.agent === "writer"
                    ? "text-amber-400"
                    : entry.agent === "dispatcher"
                    ? "text-zinc-200"
                    : "text-zinc-400";

                return (
                  <div key={`${entry.id}-${entry.created_at}`} className="flex gap-3">
                    <span className="shrink-0 text-zinc-600">{time}</span>
                    <span className={`w-22 shrink-0 uppercase ${agentColor}`}>
                      [{entry.agent}]
                    </span>
                    <span className={`break-words ${levelColor}`}>{entry.message}</span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

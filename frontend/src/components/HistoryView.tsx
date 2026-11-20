"use client";

import React from "react";
import { AlertCircle, CheckCircle2, History, Layers } from "lucide-react";
import type { RunRecord } from "@/lib/types";

interface HistoryViewProps {
  runs: RunRecord[];
}

function runStatusBadge(status: RunRecord["status"]) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/25">
          <CheckCircle2 className="h-3 w-3" />
          COMPLETED
        </span>
      );
    case "ERROR":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-300 ring-1 ring-inset ring-rose-500/25">
          <AlertCircle className="h-3 w-3" />
          ERROR
        </span>
      );
    case "STOPPED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/25">
          STOPPED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300 ring-1 ring-inset ring-sky-500/25">
          RUNNING
        </span>
      );
  }
}

export function HistoryView({ runs }: HistoryViewProps) {
  const totalRuns = runs.length;
  const totalScraped = runs.reduce((acc, r) => acc + r.total_scraped, 0);
  const totalNew = runs.reduce((acc, r) => acc + r.total_new, 0);
  const totalShortlisted = runs.reduce((acc, r) => acc + r.total_shortlisted, 0);
  const matchRate =
    totalNew > 0 ? `${Math.round((totalShortlisted / totalNew) * 100)}%` : "—";

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800/80 bg-[#111114] p-4">
          <div className="text-xs text-zinc-400">Total Pipeline Runs</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-zinc-100">
            {totalRuns}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-[#111114] p-4">
          <div className="text-xs text-zinc-400">Total Jobs Scraped</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-zinc-100">
            {totalScraped}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-[#111114] p-4">
          <div className="text-xs text-zinc-400">Shortlisted Kits</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-emerald-400">
            {totalShortlisted}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-[#111114] p-4">
          <div className="text-xs text-zinc-400">Shortlist Conversion</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-sky-400">
            {matchRate}
          </div>
        </div>
      </div>

      {/* Runs Table */}
      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-[#111114]/60 py-16 text-center">
          <History className="h-8 w-8 text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-300">No pipeline runs recorded yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Execute a run from the Live Agent Monitor to populate run telemetry.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-[#111114]">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/60 px-4 py-3 text-xs font-medium text-zinc-300">
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            <span>Execution History</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800/80 bg-zinc-950/40 text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Run</th>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Scraped</th>
                  <th className="px-4 py-3 font-medium text-right">New</th>
                  <th className="px-4 py-3 font-medium text-right">Shortlisted</th>
                  <th className="px-4 py-3 font-medium text-right">Duration</th>
                  <th className="px-4 py-3 font-medium">Notes / Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                      #{run.id}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-medium ${
                          run.mode === "MOCK"
                            ? "bg-sky-500/10 text-sky-300"
                            : "bg-emerald-500/10 text-emerald-300"
                        }`}
                      >
                        {run.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3">{runStatusBadge(run.status)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-300">
                      {run.total_scraped}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-300">
                      {run.total_new}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-400">
                      {run.total_shortlisted}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-400">
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-rose-300 max-w-xs truncate">
                      {run.error_message || <span className="text-zinc-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

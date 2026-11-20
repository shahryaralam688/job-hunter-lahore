"use client";

import React, { useMemo, useState } from "react";
import {
  Briefcase,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { JobItem, JobStatus } from "@/lib/types";

interface JobsViewProps {
  jobs: JobItem[];
  onStatusChange: (jobId: number, status: JobStatus) => Promise<void>;
}

const STATUS_OPTIONS: JobStatus[] = ["New", "Applied", "Interview", "Rejected"];

function statusStyle(status: JobStatus) {
  switch (status) {
    case "Applied":
      return "bg-sky-500/10 text-sky-300 ring-sky-500/25";
    case "Interview":
      return "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25";
    case "Rejected":
      return "bg-rose-500/10 text-rose-300 ring-rose-500/25";
    default:
      return "bg-zinc-800 text-zinc-300 ring-zinc-700";
  }
}

function scoreColor(score: number) {
  if (score >= 8.5) return "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30";
  if (score >= 7.0) return "text-amber-300 bg-amber-500/10 ring-amber-500/30";
  return "text-zinc-300 bg-zinc-800 ring-zinc-700";
}

export function JobsView({ jobs, onStatusChange }: JobsViewProps) {
  const [search, setSearch] = useState("");
  const [workFilter, setWorkFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return jobs
      .filter((job) => {
        if (workFilter !== "All" && job.work_type !== workFilter) return false;
        if (statusFilter !== "All" && job.status !== statusFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const hay = `${job.title} ${job.company} ${job.location} ${job.fit_reason}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.match_score - a.match_score);
  }, [jobs, workFilter, statusFilter, search]);

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-[#111114] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            id="jobs-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role, company, or stack..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            id="jobs-work-filter"
            value={workFilter}
            onChange={(e) => setWorkFilter(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
          >
            <option value="All">All Work Types</option>
            <option value="On-site">On-site</option>
            <option value="Hybrid">Hybrid</option>
            <option value="Remote">Remote</option>
          </select>

          <select
            id="jobs-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
          >
            <option value="All">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-[#111114]/60 py-16 text-center">
          <Briefcase className="h-8 w-8 text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-300">No shortlisted jobs yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Run the pipeline from the Live Agent Monitor to discover and score Lahore & Remote roles.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-[#111114]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800/80 bg-zinc-950/60 text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Match</th>
                  <th className="px-4 py-3 font-medium">Role & Company</th>
                  <th className="px-4 py-3 font-medium">Location / Type</th>
                  <th className="px-4 py-3 font-medium">Fit Summary</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Kit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className="cursor-pointer transition hover:bg-zinc-900/60"
                  >
                    <td className="px-4 py-3.5 align-top">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 font-mono text-xs font-semibold ring-1 ring-inset ${scoreColor(
                          job.match_score
                        )}`}
                      >
                        {job.match_score.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <div className="font-medium text-zinc-100">{job.title}</div>
                      <div className="mt-0.5 text-xs text-zinc-400">{job.company}</div>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                        <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <span>{job.location}</span>
                      </div>
                      <span className="mt-1 inline-block rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                        {job.work_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top max-w-sm">
                      <p className="text-xs leading-relaxed text-zinc-300 line-clamp-2">
                        {job.fit_reason}
                      </p>
                    </td>
                    <td
                      className="px-4 py-3.5 align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={job.status}
                        onChange={(e) =>
                          onStatusChange(job.id, e.target.value as JobStatus)
                        }
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset focus:outline-none cursor-pointer ${statusStyle(
                          job.status
                        )}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 align-top text-right">
                      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                        Open Kit
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-Over Detail Drawer */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-[#0E0E11] shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-6 py-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold ring-1 ring-inset ${scoreColor(
                      selectedJob.match_score
                    )}`}
                  >
                    {selectedJob.match_score.toFixed(1)} / 10
                  </span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                    {selectedJob.salary_or_type || selectedJob.work_type}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-zinc-100">
                  {selectedJob.title}
                </h2>
                <p className="text-sm text-zinc-400">
                  {selectedJob.company} · {selectedJob.location}
                </p>
              </div>
              <button
                onClick={() => setSelectedJobId(null)}
                className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {/* Actions & Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-[#141418] p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Application Status:</span>
                  <select
                    value={selectedJob.status}
                    onChange={(e) =>
                      onStatusChange(selectedJob.id, e.target.value as JobStatus)
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus:outline-none cursor-pointer ${statusStyle(
                      selectedJob.status
                    )}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
                >
                  Direct Apply Link
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {/* Fit & Missing Skills */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Recruiter Assessment
                </h3>
                <p className="text-sm text-zinc-200">{selectedJob.fit_reason}</p>
                {selectedJob.missing_skills.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-zinc-500">Gaps:</span>
                    {selectedJob.missing_skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 3 Tailored CV Bullets */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    3 Tailored ATS CV Bullets
                  </h3>
                  <button
                    onClick={() =>
                      copyText(
                        selectedJob.cv_bullets.map((b) => `• ${b}`).join("\n"),
                        "bullets"
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  >
                    {copiedKey === "bullets" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Bullets
                      </>
                    )}
                  </button>
                </div>
                <ul className="space-y-2 rounded-xl border border-zinc-800/80 bg-[#141418] p-4 text-sm text-zinc-200">
                  {selectedJob.cv_bullets.map((bullet, i) => (
                    <li key={i} className="flex gap-2.5 leading-relaxed">
                      <span className="text-emerald-400">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3-Line Cold Pitch */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Cold Pitch (LinkedIn DM / Email)
                  </h3>
                  <button
                    onClick={() => copyText(selectedJob.cold_pitch, "pitch")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  >
                    {copiedKey === "pitch" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Pitch
                      </>
                    )}
                  </button>
                </div>
                <div className="whitespace-pre-line rounded-xl border border-zinc-800/80 bg-[#141418] p-4 text-sm leading-relaxed text-zinc-200">
                  {selectedJob.cold_pitch}
                </div>
              </div>

              {/* 2 Interview Questions */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Likely Technical Interview Questions
                </h3>
                <div className="space-y-2">
                  {selectedJob.interview_questions.map((q, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-zinc-800/80 bg-[#141418] p-3.5 text-sm text-zinc-200"
                    >
                      <span className="mr-2 font-mono text-xs text-emerald-400">
                        Q{i + 1}.
                      </span>
                      {q}
                    </div>
                  ))}
                </div>
              </div>

              {/* Job Description */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Job Description
                </h3>
                <div className="whitespace-pre-line rounded-xl border border-zinc-800/80 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-400">
                  {selectedJob.description || "No description provided."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

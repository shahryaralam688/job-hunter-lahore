"use client";

import React, { useState } from "react";
import { Bell, Check, RotateCcw, Save, ScanSearch, Sliders, Sparkles, User } from "lucide-react";
import { api } from "@/lib/api";
import type { CVAnalysis, SettingsData } from "@/lib/types";

interface ConfigViewProps {
  settings: SettingsData;
  geminiConfigured: boolean;
  telegramConfigured: boolean;
  onSave: (updated: SettingsData) => Promise<void>;
  onResetPrompts: () => Promise<void>;
}

const AGENT_META: { key: string; label: string; hint: string }[] = [
  {
    key: "cv_analyzer",
    label: "CV Analyzer Agent Prompt",
    hint: "Deeply analyzes CV skills, seniority, and job search possibilities to generate keywords and full search context.",
  },
  {
    key: "category_planner",
    label: "Category Planner Agent Prompt",
    hint: "Generates top Pakistan job categories (Banking, University Professor, Govt, Tech) before searching.",
  },
  {
    key: "scout",
    label: "Scout Agent Prompt",
    hint: "Controls scraping focus and metadata hygiene.",
  },
  {
    key: "recruiter",
    label: "Recruiter Agent Prompt",
    hint: "Controls how strict Gemini is when scoring CV-to-job fit.",
  },
  {
    key: "writer",
    label: "Writer Agent Prompt",
    hint: "Controls tone & structure of CV bullets, cold pitch, and interview Qs.",
  },
  {
    key: "dispatcher",
    label: "Dispatcher Agent Prompt",
    hint: "Controls persistence and Telegram digest formatting.",
  },
];

export function ConfigView({
  settings,
  geminiConfigured,
  telegramConfigured,
  onSave,
  onResetPrompts,
}: ConfigViewProps) {
  const [prevSettings, setPrevSettings] = useState<SettingsData>(settings);
  const [draft, setDraft] = useState<SettingsData>(settings);
  const [keywordsInput, setKeywordsInput] = useState(settings.keywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [analyzingCv, setAnalyzingCv] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState<CVAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setDraft(settings);
    setKeywordsInput(settings.keywords.join(", "));
  }

  const parseKeywords = (raw: string) =>
    raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

  const handleAnalyzeCv = async () => {
    setAnalyzingCv(true);
    setAnalyzeError(null);
    try {
      const parsedKeywords = parseKeywords(keywordsInput);
      const res = await api.analyzeCv({
        cv_text: draft.cv_text,
        keywords: parsedKeywords,
        mock_mode: draft.mock_mode,
      });
      setCvAnalysis(res.analysis);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Failed to analyze CV.");
    } finally {
      setAnalyzingCv(false);
    }
  };

  const handleApplyKeywords = (keywords: string[]) => {
    setKeywordsInput(keywords.join(", "));
    setDraft((prev) => ({ ...prev, keywords }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedKeywords = parseKeywords(keywordsInput);
      await onSave({
        ...draft,
        keywords: parsedKeywords.length > 0 ? parsedKeywords : ["Swift", "React"],
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Top Status & Save Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-[#111114] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ${
              geminiConfigured
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25"
                : "bg-amber-500/10 text-amber-300 ring-amber-500/25"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                geminiConfigured ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {geminiConfigured
              ? "Gemini API Key Detected"
              : "No Gemini Key (.env) — Use Mock Mode"}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ${
              telegramConfigured
                ? "bg-sky-500/10 text-sky-300 ring-sky-500/25"
                : "bg-zinc-800 text-zinc-400 ring-zinc-700"
            }`}
          >
            {telegramConfigured
              ? "Telegram Credentials Ready"
              : "Telegram Not Configured in .env"}
          </span>
        </div>

        <button
          id="save-config-btn"
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
        >
          {savedToast ? (
            <>
              <Check className="h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save All Settings"}
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Search & Threshold Settings */}
        <div className="space-y-4 rounded-xl border border-zinc-800/80 bg-[#111114] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Sliders className="h-4 w-4 text-emerald-400" />
            <h2>Search & Threshold Parameters</h2>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">
              Search Keywords (comma-separated)
            </label>
            <input
              id="config-keywords"
              type="text"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              placeholder="Swift, iOS, React, Next.js, TypeScript, Unity AR"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="block text-xs font-medium text-zinc-400">
                Primary Location
              </label>
              <input
                id="config-location"
                type="text"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">
                Posted Within (Hours)
              </label>
              <input
                id="config-hours"
                type="number"
                min={1}
                max={720}
                value={draft.hours_old}
                onChange={(e) =>
                  setDraft({ ...draft, hours_old: Number(e.target.value) || 72 })
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">
                Min Match Score (0–10)
              </label>
              <input
                id="config-min-score"
                type="number"
                step="0.5"
                min={0}
                max={10}
                value={draft.min_match_score}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    min_match_score: Math.min(10, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </div>
          </div>

          {/* Telegram Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-3.5">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-sky-400" />
              <div>
                <div className="text-xs font-medium text-zinc-200">
                  Telegram Match Digest
                </div>
                <div className="text-[11px] text-zinc-500">
                  Send top shortlisted matches to your Telegram bot after each run.
                </div>
              </div>
            </div>
            <button
              id="config-telegram-toggle"
              type="button"
              role="switch"
              aria-checked={draft.telegram_enabled}
              onClick={() =>
                setDraft({ ...draft, telegram_enabled: !draft.telegram_enabled })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                draft.telegram_enabled ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  draft.telegram_enabled ? "translate-x-4.5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* CV / Master Profile */}
        <div className="flex flex-col space-y-3 rounded-xl border border-zinc-800/80 bg-[#111114] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <User className="h-4 w-4 text-emerald-400" />
              <h2>My CV / Master Profile</h2>
            </div>
            <button
              id="analyze-cv-btn"
              type="button"
              onClick={handleAnalyzeCv}
              disabled={analyzingCv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50 cursor-pointer"
            >
              <ScanSearch className="h-3.5 w-3.5" />
              {analyzingCv ? "Analyzing CV..." : "Analyze CV & Possibilities"}
            </button>
          </div>
          <p className="text-xs text-zinc-400">
            Analyzed by the CV Analyzer Agent to map job possibilities and search keywords, then used by Scout, Recruiter, and Writer agents.
          </p>
          <textarea
            id="config-cv-text"
            value={draft.cv_text}
            onChange={(e) => setDraft({ ...draft, cv_text: e.target.value })}
            rows={12}
            className="w-full flex-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
          />
          {analyzeError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {analyzeError}
            </div>
          )}
        </div>
      </div>

      {/* CV Intelligence & Job Search Possibilities */}
      {cvAnalysis && (
        <div className="space-y-4 rounded-xl border border-cyan-500/30 bg-[#111114] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <h2>CV Analyzer Intelligence &amp; Job Search Possibilities</h2>
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[11px] text-cyan-300 ring-1 ring-cyan-500/25">
                  {cvAnalysis.seniority_level}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-300">{cvAnalysis.candidate_summary}</p>
            </div>
            <button
              id="apply-cv-keywords-btn"
              type="button"
              onClick={() => handleApplyKeywords(cvAnalysis.search_keywords)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              Apply {cvAnalysis.search_keywords.length} Keywords to Search
            </button>
          </div>

          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-3 text-xs text-zinc-300">
            <span className="font-semibold text-cyan-300">Full Search Context: </span>
            {cvAnalysis.search_context_brief}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cvAnalysis.job_possibilities.map((pos) => (
              <div
                key={pos.role_title}
                className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-100">{pos.role_title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                      pos.fit_strength === "Primary"
                        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                        : pos.fit_strength === "Secondary"
                        ? "bg-sky-500/10 text-sky-300 ring-sky-500/30"
                        : "bg-amber-500/10 text-amber-300 ring-amber-500/30"
                    }`}
                  >
                    {pos.fit_strength}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">{pos.rationale}</p>
                <div className="flex flex-wrap gap-1.5">
                  {pos.search_keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-cyan-300 ring-1 ring-zinc-800"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-medium text-zinc-400 mr-1">Extracted Skills:</span>
            {cvAnalysis.core_skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-zinc-300 ring-1 ring-zinc-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agent System Prompts (Collapsible for simpler UI) */}
      <div className="space-y-4 rounded-xl border border-zinc-800/80 bg-[#111114] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Advanced: Agent System Prompts ({AGENT_META.length})
            </h2>
            <p className="text-xs text-zinc-400">
              Optional — tune each agent&apos;s behavior without touching code.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showPrompts && (
              <button
                id="reset-prompts-btn"
                type="button"
                onClick={onResetPrompts}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Default
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPrompts((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer"
            >
              {showPrompts ? "Hide Prompts" : "Edit Agent Prompts"}
            </button>
          </div>
        </div>

        {showPrompts && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {AGENT_META.map((agent) => (
              <div key={agent.key} className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-200">
                  {agent.label}
                </label>
                <p className="text-[11px] text-zinc-500">{agent.hint}</p>
                <textarea
                  rows={4}
                  value={draft.prompts?.[agent.key] || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      prompts: {
                        ...draft.prompts,
                        [agent.key]: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}

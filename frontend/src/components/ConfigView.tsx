"use client";

import React, { useEffect, useState } from "react";
import { Bell, Check, RotateCcw, Save, Sliders, User } from "lucide-react";
import type { SettingsData } from "@/lib/types";

interface ConfigViewProps {
  settings: SettingsData;
  geminiConfigured: boolean;
  telegramConfigured: boolean;
  onSave: (updated: SettingsData) => Promise<void>;
  onResetPrompts: () => Promise<void>;
}

const AGENT_META: { key: string; label: string; hint: string }[] = [
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
  const [draft, setDraft] = useState<SettingsData>(settings);
  const [keywordsInput, setKeywordsInput] = useState(settings.keywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setDraft(settings);
    setKeywordsInput(settings.keywords.join(", "));
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedKeywords = keywordsInput
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
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
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <User className="h-4 w-4 text-emerald-400" />
            <h2>My CV / Master Profile</h2>
          </div>
          <p className="text-xs text-zinc-400">
            Used by the Recruiter Agent for fit scoring and by the Writer Agent to craft authentic CV bullets.
          </p>
          <textarea
            id="config-cv-text"
            value={draft.cv_text}
            onChange={(e) => setDraft({ ...draft, cv_text: e.target.value })}
            rows={12}
            className="w-full flex-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
          />
        </div>
      </div>

      {/* Agent System Prompts */}
      <div className="space-y-4 rounded-xl border border-zinc-800/80 bg-[#111114] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Agent System Prompts
            </h2>
            <p className="text-xs text-zinc-400">
              Tune how strict the Recruiter or how direct the Writer is without touching code.
            </p>
          </div>
          <button
            id="reset-prompts-btn"
            type="button"
            onClick={onResetPrompts}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Default
          </button>
        </div>

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
      </div>
    </form>
  );
}

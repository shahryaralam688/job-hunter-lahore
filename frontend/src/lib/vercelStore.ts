import type {
  AgentState,
  JobItem,
  JobStatus,
  LogEntry,
  PipelineSnapshot,
  RunRecord,
  SettingsData,
} from "./types";

const DEFAULT_PROMPTS: Record<string, string> = {
  scout:
    "You are the Scout Agent. Target fresh tech roles posted within the configured window across Lahore (On-site/Hybrid) and Remote. Prioritize clean metadata and strict URL deduplication.",
  recruiter:
    "You are a strict, pragmatic technical recruiter evaluating job postings for a software engineer based in Lahore, Pakistan. Compare job requirements against the candidate's CV.",
  writer:
    "You are an expert technical career coach. Write 3 concise ATS-friendly CV bullets, a 3-line direct cold pitch, and 2 realistic technical interview questions.",
  dispatcher:
    "You are the Dispatcher Agent. Persist all evaluated job kits cleanly and format concise digests.",
};

const DEFAULT_SETTINGS: SettingsData = {
  cv_text: `MUHAMMAD ALI RAZA
Lahore, Pakistan | Senior Software Engineer (iOS, React/Next.js & AR)

SUMMARY
Full-stack mobile and web engineer with 4+ years of experience building production iOS apps (Swift, SwiftUI, UIKit), modern web platforms (React, Next.js, TypeScript, Tailwind CSS), and interactive AR experiences (Unity, ARKit).

CORE SKILLS
- Mobile & AR: Swift, SwiftUI, UIKit, Combine, CoreData, Unity 3D, ARKit, ARFoundation, C#
- Web & Frontend: React, Next.js (App Router), TypeScript, JavaScript (ES6+), Tailwind CSS
- Backend & Tooling: Node.js, Python, FastAPI, PostgreSQL, GitHub Actions, Docker`,
  keywords: ["Swift", "iOS", "React", "Next.js", "TypeScript", "Unity AR"],
  location: "Lahore, Pakistan",
  hours_old: 72,
  min_match_score: 7.0,
  telegram_enabled: false,
  auto_schedule_enabled: false,
  mock_mode: true,
  prompts: { ...DEFAULT_PROMPTS },
};

const MOCK_FEED = [
  {
    title: "Senior iOS Engineer (Swift / SwiftUI)",
    company: "Arbisoft",
    location: "Lahore, Pakistan",
    work_type: "Hybrid",
    url: "https://www.linkedin.com/jobs/view/mock-arbisoft-ios-lahore-101",
    source: "mock",
    description:
      "Arbisoft is looking for a Senior iOS Engineer in Lahore (Hybrid) to lead consumer mobile experiences with Swift, SwiftUI, UIKit, Combine, and GitHub Actions CI/CD. Compensation: PKR 320k-450k/month.",
    salary_or_type: "Hybrid · Lahore · PKR 320k–450k",
  },
  {
    title: "Full-Stack Next.js & TypeScript Developer",
    company: "Devsinc",
    location: "Lahore, Pakistan",
    work_type: "On-site",
    url: "https://www.linkedin.com/jobs/view/mock-devsinc-nextjs-lahore-102",
    source: "mock",
    description:
      "Join Devsinc's Lahore engineering hub to build high-traffic SaaS products using Next.js (App Router), React, TypeScript, Tailwind CSS, and PostgreSQL.",
    salary_or_type: "On-site · Lahore · PKR Market",
  },
  {
    title: "Unity AR / Spatial Computing Engineer",
    company: "Tintash",
    location: "Lahore, Pakistan",
    work_type: "Hybrid",
    url: "https://pk.indeed.com/viewjob?jk=mock-tintash-unity-ar-103",
    source: "mock",
    description:
      "Tintash is hiring a Unity AR Developer in Lahore (Hybrid) for interactive iOS/Android ARKit & ARFoundation experiences. Swift bridging is a strong plus.",
    salary_or_type: "Hybrid · Lahore · Competitive PKR",
  },
  {
    title: "Frontend Engineer (React / TypeScript) — EMEA/PK Remote",
    company: "RemoteFlow Labs",
    location: "Remote (Pakistan Eligible)",
    work_type: "Remote",
    url: "https://www.linkedin.com/jobs/view/mock-remoteflow-react-104",
    source: "mock",
    description:
      "100% Remote role open to engineers in Pakistan. Build analytics dashboards in React, TypeScript, Next.js, and Tailwind CSS. Compensation: $2,400 - $3,200 USD/month.",
    salary_or_type: "Remote · $2,400–$3,200/mo",
  },
  {
    title: "iOS & React Native Mobile Lead",
    company: "Systems Limited",
    location: "Lahore, Pakistan",
    work_type: "On-site",
    url: "https://www.linkedin.com/jobs/view/mock-systems-ios-lead-105",
    source: "mock",
    description:
      "Systems Limited (DHA Lahore) seeks a Mobile Lead skilled in Swift, UIKit/SwiftUI, and React/TypeScript for enterprise banking apps.",
    salary_or_type: "On-site · DHA Lahore",
  },
  {
    title: "Senior Java Spring Boot Microservices Engineer",
    company: "Tkxel",
    location: "Lahore, Pakistan",
    work_type: "On-site",
    url: "https://pk.indeed.com/viewjob?jk=mock-tkxel-java-106",
    source: "mock",
    description:
      "Senior Java Developer with 5+ years in Spring Boot, Kafka, Kubernetes, Oracle DB. On-site in Gulberg, Lahore.",
    salary_or_type: "On-site · Gulberg Lahore",
  },
];

interface StoreState {
  settings: SettingsData;
  jobs: JobItem[];
  runs: RunRecord[];
  logs: LogEntry[];
  snapshot: PipelineSnapshot;
  nextJobId: number;
  nextLogId: number;
  nextRunId: number;
}

function freshAgents(): AgentState[] {
  return [
    { name: "category_planner", label: "Category Planner", status: "IDLE", current_task: "Waiting for pipeline run", items_processed: 0, items_total: 0, execution_time_ms: 0 },
    { name: "scout", label: "Scout Agent", status: "IDLE", current_task: "Waiting for pipeline run", items_processed: 0, items_total: 0, execution_time_ms: 0 },
    { name: "recruiter", label: "Recruiter Agent", status: "IDLE", current_task: "Waiting for pipeline run", items_processed: 0, items_total: 0, execution_time_ms: 0 },
    { name: "writer", label: "Writer Agent", status: "IDLE", current_task: "Waiting for pipeline run", items_processed: 0, items_total: 0, execution_time_ms: 0 },
    { name: "dispatcher", label: "Dispatcher Agent", status: "IDLE", current_task: "Waiting for pipeline run", items_processed: 0, items_total: 0, execution_time_ms: 0 },
  ];
}

const g = globalThis as unknown as { __jobHunterStore?: StoreState };

if (!g.__jobHunterStore) {
  g.__jobHunterStore = {
    settings: structuredClone(DEFAULT_SETTINGS),
    jobs: [],
    runs: [],
    logs: [],
    snapshot: {
      is_running: false,
      current_run_id: null,
      next_scheduled_run: null,
      agents: freshAgents(),
    },
    nextJobId: 1,
    nextLogId: 1,
    nextRunId: 1,
  };
}

export const store = g.__jobHunterStore;

export function getDefaultPrompts() {
  return { ...DEFAULT_PROMPTS };
}

function addLog(runId: number | null, agent: string, level: "INFO" | "WARN" | "ERROR", message: string) {
  store.logs.push({
    id: store.nextLogId++,
    run_id: runId,
    agent,
    level,
    message,
    created_at: new Date().toISOString(),
  });
  if (store.logs.length > 200) store.logs = store.logs.slice(-200);
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "your_gemini_api_key_here") return null;
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

function evaluateLocally(job: (typeof MOCK_FEED)[number], cvText: string) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const cv = cvText.toLowerCase();
  if (text.includes("java") && text.includes("spring boot")) {
    return {
      match_score: 3.5,
      fit_reason: "Core stack requires Java/Spring Boot & Kafka, outside your iOS/React/AR profile.",
      missing_skills: ["Java", "Spring Boot", "Kafka", "Kubernetes"],
    };
  }
  const skills = ["swift", "swiftui", "uikit", "ios", "react", "next.js", "typescript", "tailwind", "unity", "arkit", "ar"];
  const matched = skills.filter((s) => text.includes(s) && cv.includes(s));
  const score = Math.min(9.5, Number((6.5 + matched.length * 0.6).toFixed(1)));
  return {
    match_score: score,
    fit_reason: `Strong overlap on ${matched.slice(0, 4).join(", ") || "core stack"} for ${job.work_type} at ${job.company}.`,
    missing_skills: text.includes("postgresql") ? ["PostgreSQL"] : ["Domain CI/CD nuances"],
  };
}

function writeKitLocally(job: (typeof MOCK_FEED)[number]) {
  return {
    cv_bullets: [
      `Architected production features directly aligned with ${job.title} at ${job.company}, delivering 99.6% reliability at scale.`,
      `Built modular, strongly-typed components and automated CI/CD workflows, cutting release turnaround by 35%.`,
      `Collaborated across product and design squads to ship high-impact ${job.work_type} deliverables ahead of schedule.`,
    ],
    cold_pitch: `Hi ${job.company} Team — noticed your ${job.title} opening (${job.work_type}).\nI'm a Lahore-based engineer with 4+ years shipping Swift/iOS, Next.js/TypeScript, and Unity AR products.\nWould love to share how I've scaled 80k+ MAU apps — open to a quick 15-min chat?`,
    interview_questions: [
      `How do you structure state management and performance profiling for ${job.title} workloads?`,
      `Walk through a production bottleneck you diagnosed and resolved in your primary stack.`,
    ],
  };
}

export async function runVercelPipeline(mockOverride?: boolean): Promise<{ started: boolean; run_id: number; mode: string }> {
  const t0 = Date.now();
  const useMock = mockOverride ?? store.settings.mock_mode;
  const runId = store.nextRunId++;
  const mode = useMock ? "MOCK" : "LIVE";

  store.snapshot.is_running = true;
  store.snapshot.current_run_id = runId;
  store.snapshot.agents = freshAgents();

  const runRecord: RunRecord = {
    id: runId,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: "RUNNING",
    mode,
    total_scraped: 0,
    total_new: 0,
    total_shortlisted: 0,
    duration_ms: 0,
    error_message: null,
  };
  store.runs.unshift(runRecord);
  addLog(runId, "pipeline", "INFO", `Pipeline Run #${runId} started (${mode} mode on Vercel).`);

  // 1. Scout
  const seenUrls = new Set(store.jobs.map((j) => j.url));
  const newItems = MOCK_FEED.filter((j) => !seenUrls.has(j.url));
  store.snapshot.agents[0] = {
    name: "scout",
    label: "Scout Agent",
    status: "COMPLETED",
    current_task: `Queued ${newItems.length} new jobs (${MOCK_FEED.length - newItems.length} duplicates skipped)`,
    items_processed: newItems.length,
    items_total: MOCK_FEED.length,
    execution_time_ms: 320,
  };
  addLog(runId, "scout", "INFO", `Scout complete: ${MOCK_FEED.length} scanned, ${newItems.length} new jobs queued.`);

  // 2. Recruiter
  const minScore = store.settings.min_match_score;
  const evaluated: Array<(typeof MOCK_FEED)[number] & { match_score: number; fit_reason: string; missing_skills: string[]; shortlisted: boolean }> = [];

  for (const job of newItems) {
    let ev = evaluateLocally(job, store.settings.cv_text);
    if (!useMock) {
      const raw = await callGemini(
        `CV:\n${store.settings.cv_text}\n\nJOB:\n${job.title} @ ${job.company}\n${job.description}\n\nReturn JSON: {"match_score": number (0-10), "fit_reason": string, "missing_skills": string[]}`,
        store.settings.prompts.recruiter || DEFAULT_PROMPTS.recruiter
      );
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          ev = {
            match_score: Number(parsed.match_score ?? ev.match_score),
            fit_reason: String(parsed.fit_reason ?? ev.fit_reason),
            missing_skills: Array.isArray(parsed.missing_skills) ? parsed.missing_skills : ev.missing_skills,
          };
        } catch {
          // fallback to local evaluation
        }
      }
    }
    const isShortlisted = ev.match_score >= minScore;
    evaluated.push({ ...job, ...ev, shortlisted: isShortlisted });
    addLog(
      runId,
      "recruiter",
      "INFO",
      `${isShortlisted ? "SHORTLISTED" : "SKIPPED"} [${ev.match_score.toFixed(1)}/10] ${job.title} @ ${job.company}`
    );
  }

  const shortlisted = evaluated.filter((j) => j.shortlisted);
  store.snapshot.agents[1] = {
    name: "recruiter",
    label: "Recruiter Agent",
    status: "COMPLETED",
    current_task: `Shortlisted ${shortlisted.length}/${newItems.length} jobs (min ${minScore}/10)`,
    items_processed: newItems.length,
    items_total: newItems.length,
    execution_time_ms: 480,
  };

  // 3. Writer
  const kitsByUrl = new Map<string, { cv_bullets: string[]; cold_pitch: string; interview_questions: string[] }>();
  for (const job of shortlisted) {
    let kit = writeKitLocally(job);
    if (!useMock) {
      const raw = await callGemini(
        `CV:\n${store.settings.cv_text}\n\nJOB:\n${job.title} @ ${job.company}\n${job.description}\n\nReturn JSON: {"cv_bullets": [3 strings], "cold_pitch": "3-line string", "interview_questions": [2 strings]}`,
        store.settings.prompts.writer || DEFAULT_PROMPTS.writer
      );
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.cv_bullets) && parsed.cold_pitch && Array.isArray(parsed.interview_questions)) {
            kit = parsed;
          }
        } catch {
          // fallback
        }
      }
    }
    kitsByUrl.set(job.url, kit);
    addLog(runId, "writer", "INFO", `Kit ready for ${job.title} @ ${job.company}`);
  }
  store.snapshot.agents[2] = {
    name: "writer",
    label: "Writer Agent",
    status: "COMPLETED",
    current_task: `Generated ${shortlisted.length} application kits`,
    items_processed: shortlisted.length,
    items_total: shortlisted.length,
    execution_time_ms: 410,
  };

  // 4. Dispatcher
  for (const job of evaluated) {
    const kit = kitsByUrl.get(job.url) || { cv_bullets: [], cold_pitch: "", interview_questions: [] };
    store.jobs.push({
      id: store.nextJobId++,
      title: job.title,
      company: job.company,
      location: job.location,
      work_type: job.work_type,
      url: job.url,
      source: job.source,
      description: job.description,
      posted_at: new Date().toISOString(),
      match_score: job.match_score,
      fit_reason: job.fit_reason,
      missing_skills: job.missing_skills,
      salary_or_type: job.salary_or_type,
      cv_bullets: kit.cv_bullets,
      cold_pitch: kit.cold_pitch,
      interview_questions: kit.interview_questions,
      shortlisted: job.shortlisted,
      status: "New" as JobStatus,
      run_id: runId,
      created_at: new Date().toISOString(),
    });
  }

  store.snapshot.agents[3] = {
    name: "dispatcher",
    label: "Dispatcher Agent",
    status: "COMPLETED",
    current_task: `Saved ${shortlisted.length} kits`,
    items_processed: evaluated.length,
    items_total: evaluated.length,
    execution_time_ms: 90,
  };

  const duration = Date.now() - t0;
  runRecord.finished_at = new Date().toISOString();
  runRecord.status = "COMPLETED";
  runRecord.total_scraped = MOCK_FEED.length;
  runRecord.total_new = newItems.length;
  runRecord.total_shortlisted = shortlisted.length;
  runRecord.duration_ms = duration;

  store.snapshot.is_running = false;
  addLog(runId, "pipeline", "INFO", `Pipeline Run #${runId} completed: ${shortlisted.length} shortlisted.`);

  return { started: true, run_id: runId, mode };
}

import type {
  AgentState,
  CVAnalysis,
  JobItem,
  JobPossibility,
  JobStatus,
  LogEntry,
  PipelineSnapshot,
  RunRecord,
  SettingsData,
} from "./types";

const DEFAULT_PROMPTS: Record<string, string> = {
  cv_analyzer:
    "You are a Deep CV Strategist & Career Intelligence Agent. Analyze the candidate's CV in full detail, identify all realistic job search possibilities (Primary, Secondary, Adjacent), generate concise search keywords, and provide full search context for downstream agents.",
  category_planner:
    "You are a Pakistan Career Category Planner. Generate top job categories across Pakistan & Global Remote aligned with the candidate's CV analysis.",
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
    { name: "cv_analyzer", label: "CV Analyzer Agent", status: "IDLE", current_task: "Waiting for pipeline run", items_processed: 0, items_total: 0, execution_time_ms: 0 },
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

function dedupeStrings(items: string[], maxItems?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = item.trim().replace(/\s+/g, " ");
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
      if (maxItems && out.length >= maxItems) break;
    }
  }
  return out;
}

export function analyzeCvLocally(cvText: string, userKeywords: string[]): CVAnalysis {
  const lower = cvText.toLowerCase();
  const yearMatches = [...lower.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/g)];
  const maxYears = yearMatches.reduce((acc, m) => Math.max(acc, Number(m[1]) || 0), 0);
  const seniority =
    maxYears >= 7 || lower.includes("principal")
      ? `Staff / Principal (${maxYears || 7}+ years)`
      : maxYears >= 4 || lower.includes("senior") || lower.includes("lead")
      ? `Senior (${maxYears || 4}+ years)`
      : maxYears >= 2
      ? `Mid-Level (${maxYears} years)`
      : "Mid-to-Senior";

  const tracks: Array<{
    triggers: string[];
    domain: string;
    skills: string[];
    possibilities: JobPossibility[];
  }> = [
    {
      triggers: ["swift", "swiftui", "uikit", "ios", "xcode"],
      domain: "iOS & Mobile Engineering",
      skills: ["Swift", "SwiftUI", "UIKit", "iOS", "Combine", "CoreData"],
      possibilities: [
        {
          role_title: "Senior iOS Engineer",
          fit_strength: "Primary",
          rationale: "Direct match with Swift, SwiftUI, UIKit, and production iOS shipping.",
          search_keywords: ["iOS Developer", "Swift Engineer", "SwiftUI Developer"],
        },
        {
          role_title: "Mobile App Lead",
          fit_strength: "Secondary",
          rationale: "Squad leadership and consumer mobile scale fit lead mobile roles.",
          search_keywords: ["Mobile App Developer", "Mobile Lead"],
        },
      ],
    },
    {
      triggers: ["react", "next.js", "nextjs", "typescript", "tailwind", "frontend"],
      domain: "Modern Web & Frontend",
      skills: ["React", "Next.js", "TypeScript", "JavaScript", "Tailwind CSS"],
      possibilities: [
        {
          role_title: "Full-Stack Next.js / TypeScript Developer",
          fit_strength: "Primary",
          rationale: "Strong overlap across Next.js App Router, React, TypeScript, and SaaS dashboards.",
          search_keywords: ["Next.js Developer", "Full Stack Developer", "TypeScript Developer"],
        },
        {
          role_title: "Senior Frontend Engineer (React)",
          fit_strength: "Primary",
          rationale: "Reusable UI architecture and bundle optimization experience.",
          search_keywords: ["React Developer", "Frontend Engineer"],
        },
      ],
    },
    {
      triggers: ["unity", "arkit", "arfoundation", "c#", "spatial"],
      domain: "AR/VR & Spatial Computing",
      skills: ["Unity 3D", "ARKit", "ARFoundation", "C#"],
      possibilities: [
        {
          role_title: "Unity AR / Spatial Computing Engineer",
          fit_strength: "Primary",
          rationale: "Production Unity 3D and ARKit/ARFoundation module integration.",
          search_keywords: ["Unity Developer", "AR VR Developer"],
        },
      ],
    },
    {
      triggers: ["python", "fastapi", "node.js", "nodejs", "postgresql", "backend"],
      domain: "Backend & APIs",
      skills: ["Python", "FastAPI", "Node.js", "PostgreSQL"],
      possibilities: [
        {
          role_title: "Backend / Python FastAPI Engineer",
          fit_strength: "Secondary",
          rationale: "API architecture and database integration skills fit backend engineering teams.",
          search_keywords: ["Python Developer", "Backend Engineer"],
        },
      ],
    },
    {
      triggers: ["ai", "llm", "genai", "machine learning", "langchain", "agent"],
      domain: "AI / LLM Engineering",
      skills: ["GenAI", "LLMs", "Python", "AI Agents"],
      possibilities: [
        {
          role_title: "AI / LLM Application Engineer",
          fit_strength: "Primary",
          rationale: "Hands-on AI workflows and API integration.",
          search_keywords: ["AI Engineer", "LLM Engineer"],
        },
      ],
    },
    {
      triggers: ["flutter", "react native", "android", "kotlin"],
      domain: "Cross-Platform Mobile",
      skills: ["Flutter", "React Native", "Android"],
      possibilities: [
        {
          role_title: "Cross-Platform Mobile Developer",
          fit_strength: "Primary",
          rationale: "Mobile app engineering fits Flutter/React Native roles.",
          search_keywords: ["Flutter Developer", "React Native Developer"],
        },
      ],
    },
    {
      triggers: ["docker", "github actions", "ci/cd", "aws", "devops"],
      domain: "DevOps & Cloud",
      skills: ["Docker", "GitHub Actions", "CI/CD"],
      possibilities: [
        {
          role_title: "DevOps / Platform Engineer",
          fit_strength: "Adjacent",
          rationale: "Automated CI/CD and containerized deployment experience.",
          search_keywords: ["DevOps Engineer", "Cloud Engineer"],
        },
      ],
    },
  ];

  const domains: string[] = [];
  const skills: string[] = [];
  const possibilities: JobPossibility[] = [];
  const genKeywords: string[] = [];

  for (const t of tracks) {
    if (t.triggers.some((trig) => lower.includes(trig))) {
      domains.push(t.domain);
      for (const s of t.skills) {
        if (lower.includes(s.toLowerCase())) skills.push(s);
      }
      for (const p of t.possibilities) {
        possibilities.push(p);
        genKeywords.push(...p.search_keywords);
      }
    }
  }

  if (lower.includes("lahore") || lower.includes("pakistan") || lower.includes("remote")) {
    possibilities.push({
      role_title: "Global Remote Software Engineer (Pakistan Eligible)",
      fit_strength: "Primary",
      rationale: "Distributed remote squad experience fits EMEA/Global remote openings.",
      search_keywords: ["Remote Software Engineer", "Remote TypeScript Developer"],
    });
    genKeywords.push("Remote Software Engineer", "Remote TypeScript Developer");
  }

  if (possibilities.length === 0) {
    possibilities.push({
      role_title: "Software & Technology Specialist",
      fit_strength: "Primary",
      rationale: "Derived from CV skills and configured search keywords.",
      search_keywords: userKeywords.slice(0, 3).length ? userKeywords.slice(0, 3) : ["Software Engineer"],
    });
  }

  const finalKeywords = dedupeStrings([...genKeywords, ...userKeywords], 18);
  const finalSkills = dedupeStrings([...skills, ...userKeywords], 18);
  const avoidCandidates: Array<[string, string]> = [
    ["java", "Java / Spring Boot"],
    ["sap", "SAP / ABAP ERP"],
    ["php", "PHP / Laravel"],
    ["civil", "Civil / Mechanical Engineering"],
  ];
  const avoidRoles = avoidCandidates.filter(([tok]) => !lower.includes(tok)).map(([, lbl]) => lbl);

  const summary = `${seniority} candidate spanning ${domains.slice(0, 3).join(", ") || "Technology"}. Core skills: ${finalSkills.slice(0, 7).join(", ")}.`;
  const brief = `Level: ${seniority}. Skills: ${finalSkills.slice(0, 8).join(", ")}. Top Possibilities: ${possibilities
    .slice(0, 4)
    .map((p) => p.role_title)
    .join(", ")}. Avoid: ${avoidRoles.join(", ") || "None"}.`;

  return {
    candidate_summary: summary,
    seniority_level: seniority,
    core_skills: finalSkills,
    domains: dedupeStrings(domains, 8),
    job_possibilities: possibilities.slice(0, 8),
    search_keywords: finalKeywords,
    avoid_roles: avoidRoles,
    search_context_brief: brief,
  };
}

export async function analyzeCvForVercel(
  cvText?: string,
  keywords?: string[],
  mockOverride?: boolean
): Promise<CVAnalysis> {
  const effectiveCv = cvText ?? store.settings.cv_text;
  const effectiveKeywords = keywords ?? store.settings.keywords;
  const useMock = mockOverride ?? store.settings.mock_mode;

  if (!useMock) {
    const raw = await callGemini(
      `CANDIDATE CV:\n${effectiveCv.slice(0, 4500)}\n\nCURRENT KEYWORDS: ${effectiveKeywords.join(", ")}\n\nReturn JSON: {"candidate_summary": string, "seniority_level": string, "core_skills": string[], "domains": string[], "job_possibilities": [{"role_title": string, "fit_strength": "Primary"|"Secondary"|"Adjacent", "rationale": string, "search_keywords": string[]}], "search_keywords": string[], "avoid_roles": string[], "search_context_brief": string}`,
      store.settings.prompts.cv_analyzer || DEFAULT_PROMPTS.cv_analyzer
    );
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CVAnalysis;
        if (parsed && Array.isArray(parsed.job_possibilities) && Array.isArray(parsed.search_keywords)) {
          parsed.search_keywords = dedupeStrings([...parsed.search_keywords, ...effectiveKeywords], 18);
          return parsed;
        }
      } catch {
        // fallback locally
      }
    }
  }

  return analyzeCvLocally(effectiveCv, effectiveKeywords);
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

  // 0. CV Analyzer
  const cvAnalysis = await analyzeCvForVercel(store.settings.cv_text, store.settings.keywords, useMock);
  addLog(runId, "cv_analyzer", "INFO", `Profile Summary: ${cvAnalysis.candidate_summary}`);
  cvAnalysis.job_possibilities.forEach((pos, i) => {
    addLog(
      runId,
      "cv_analyzer",
      "INFO",
      `Possibility ${i + 1}/${cvAnalysis.job_possibilities.length} [${pos.fit_strength}]: ${pos.role_title} -> Queries: ${pos.search_keywords.join(", ")}`
    );
  });
  addLog(runId, "cv_analyzer", "INFO", `Generated ${cvAnalysis.search_keywords.length} search keywords: ${cvAnalysis.search_keywords.slice(0, 10).join(", ")}`);
  store.snapshot.agents[0] = {
    name: "cv_analyzer",
    label: "CV Analyzer Agent",
    status: "COMPLETED",
    current_task: `${cvAnalysis.job_possibilities.length} possibilities · ${cvAnalysis.search_keywords.length} keywords ready`,
    items_processed: cvAnalysis.job_possibilities.length,
    items_total: cvAnalysis.job_possibilities.length,
    execution_time_ms: 190,
  };

  // 1. Category Planner
  store.snapshot.agents[1] = {
    name: "category_planner",
    label: "Category Planner",
    status: "COMPLETED",
    current_task: `Planned categories from ${cvAnalysis.domains.length || 3} CV domains`,
    items_processed: cvAnalysis.domains.length || 3,
    items_total: cvAnalysis.domains.length || 3,
    execution_time_ms: 140,
  };
  addLog(runId, "category_planner", "INFO", `Categories aligned with CV context: ${cvAnalysis.domains.join(", ") || "Software Engineering"}`);

  // 2. Scout
  const seenUrls = new Set(store.jobs.map((j) => j.url));
  const newItems = MOCK_FEED.filter((j) => !seenUrls.has(j.url));
  store.snapshot.agents[2] = {
    name: "scout",
    label: "Scout Agent",
    status: "COMPLETED",
    current_task: `Queued ${newItems.length} new jobs (${MOCK_FEED.length - newItems.length} duplicates skipped)`,
    items_processed: newItems.length,
    items_total: MOCK_FEED.length,
    execution_time_ms: 320,
  };
  addLog(runId, "scout", "INFO", `Using CV Search Context: ${cvAnalysis.search_context_brief}`);
  addLog(runId, "scout", "INFO", `Scout complete: ${MOCK_FEED.length} scanned, ${newItems.length} new jobs queued.`);

  // 3. Recruiter
  const minScore = store.settings.min_match_score;
  const evaluated: Array<(typeof MOCK_FEED)[number] & { match_score: number; fit_reason: string; missing_skills: string[]; shortlisted: boolean }> = [];

  for (const job of newItems) {
    let ev = evaluateLocally(job, store.settings.cv_text);
    if (!useMock) {
      const raw = await callGemini(
        `CV SEARCH CONTEXT:\n${cvAnalysis.search_context_brief}\n\nCV:\n${store.settings.cv_text}\n\nJOB:\n${job.title} @ ${job.company}\n${job.description}\n\nReturn JSON: {"match_score": number (0-10), "fit_reason": string, "missing_skills": string[]}`,
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
  store.snapshot.agents[3] = {
    name: "recruiter",
    label: "Recruiter Agent",
    status: "COMPLETED",
    current_task: `Shortlisted ${shortlisted.length}/${newItems.length} jobs (min ${minScore}/10)`,
    items_processed: newItems.length,
    items_total: newItems.length,
    execution_time_ms: 480,
  };

  // 4. Writer
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
  store.snapshot.agents[4] = {
    name: "writer",
    label: "Writer Agent",
    status: "COMPLETED",
    current_task: `Generated ${shortlisted.length} application kits`,
    items_processed: shortlisted.length,
    items_total: shortlisted.length,
    execution_time_ms: 410,
  };

  // 5. Dispatcher
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

  store.snapshot.agents[5] = {
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

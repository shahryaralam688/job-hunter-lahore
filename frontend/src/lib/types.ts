export type AgentStatus = "IDLE" | "RUNNING" | "COMPLETED" | "ERROR";

export type JobStatus = "New" | "Applied" | "Interview" | "Rejected";

export interface AgentState {
  name: "category_planner" | "scout" | "recruiter" | "writer" | "dispatcher";
  label: string;
  status: AgentStatus;
  current_task: string;
  items_processed: number;
  items_total: number;
  execution_time_ms: number;
}

export interface PipelineSnapshot {
  is_running: boolean;
  current_run_id: number | null;
  next_scheduled_run?: string | null;
  agents: AgentState[];
}

export interface LogEntry {
  id: number;
  run_id: number | null;
  agent: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  created_at: string;
}

export interface JobItem {
  id: number;
  title: string;
  company: string;
  location: string;
  work_type: string;
  url: string;
  source: string;
  description: string;
  posted_at: string | null;
  match_score: number;
  fit_reason: string;
  missing_skills: string[];
  salary_or_type: string;
  cv_bullets: string[];
  cold_pitch: string;
  interview_questions: string[];
  shortlisted: boolean;
  status: JobStatus;
  run_id: number | null;
  created_at: string;
}

export interface RunRecord {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: "RUNNING" | "COMPLETED" | "STOPPED" | "ERROR";
  mode: "LIVE" | "MOCK";
  total_scraped: number;
  total_new: number;
  total_shortlisted: number;
  duration_ms: number;
  error_message: string | null;
}

export interface SettingsData {
  cv_text: string;
  keywords: string[];
  location: string;
  hours_old: number;
  min_match_score: number;
  telegram_enabled: boolean;
  auto_schedule_enabled: boolean;
  mock_mode: boolean;
  prompts: Record<string, string>;
}

export interface SettingsResponse {
  settings: SettingsData;
  next_scheduled_run: string | null;
  gemini_configured: boolean;
  telegram_configured: boolean;
}

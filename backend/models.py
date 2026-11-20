from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class JobStatus(str, Enum):
    NEW = "New"
    APPLIED = "Applied"
    INTERVIEW = "Interview"
    REJECTED = "Rejected"


class RecruiterEvaluation(BaseModel):
    match_score: float = Field(..., ge=0, le=10, description="Match score from 0 to 10")
    fit_reason: str = Field(..., description="One-line explanation of candidate fit")
    missing_skills: List[str] = Field(default_factory=list, description="Key skills missing from CV")
    salary_or_type: str = Field(..., description="Work type and salary if mentioned, e.g. 'Hybrid · Lahore · PKR 300k'")


class WriterKit(BaseModel):
    cv_bullets: List[str] = Field(..., min_length=3, max_length=3, description="3 tailored ATS-friendly CV bullets")
    cold_pitch: str = Field(..., description="3-line direct cold pitch for hiring manager")
    interview_questions: List[str] = Field(..., min_length=2, max_length=2, description="2 likely technical interview questions")


class JobRecord(BaseModel):
    id: Optional[int] = None
    title: str
    company: str
    location: str
    work_type: str = "On-site"
    url: str
    source: str = "linkedin"
    description: str = ""
    posted_at: Optional[str] = None
    match_score: float = 0.0
    fit_reason: str = ""
    missing_skills: List[str] = Field(default_factory=list)
    salary_or_type: str = ""
    cv_bullets: List[str] = Field(default_factory=list)
    cold_pitch: str = ""
    interview_questions: List[str] = Field(default_factory=list)
    shortlisted: bool = False
    status: JobStatus = JobStatus.NEW
    run_id: Optional[int] = None
    created_at: Optional[str] = None


class JobStatusUpdate(BaseModel):
    status: JobStatus


class SettingsPayload(BaseModel):
    cv_text: str
    keywords: List[str]
    location: str
    hours_old: int = Field(ge=1, le=720)
    min_match_score: float = Field(ge=0, le=10)
    telegram_enabled: bool = False
    auto_schedule_enabled: bool = False
    mock_mode: bool = True
    prompts: dict[str, str]


class AgentStateSnapshot(BaseModel):
    name: str
    label: str
    status: AgentStatus = AgentStatus.IDLE
    current_task: str = "Waiting for pipeline run"
    items_processed: int = 0
    items_total: int = 0
    execution_time_ms: int = 0


class PipelineRunRequest(BaseModel):
    mock_mode: Optional[bool] = None

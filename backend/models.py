from enum import Enum

from pydantic import BaseModel, Field


class IssueCategory(str, Enum):
    stockout = "stockout"
    pricing = "pricing"
    product_quality = "product_quality"
    data_conflict = "data_conflict"
    safety = "safety"
    prompt_injection = "prompt_injection"
    other = "other"


class Urgency(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Evidence(BaseModel):
    from_field_update: list[str]  # only what the rep said
    from_verified_data: list[str]  # only what the system table says


class SalesAnalysis(BaseModel):
    issue_category: IssueCategory
    urgency: Urgency
    evidence: Evidence
    recommended_next_action: str
    missing_information: list[str]
    needs_human_review: bool
    review_reason: str | None


class AnalyzeRequest(BaseModel):
    field_update: str = Field(..., min_length=1, max_length=2000)
    outlet_name: str | None = None
    sku: str | None = None
    model: str | None = None


class ModelStatus(BaseModel):
    id: str
    label: str
    provider: str
    online: bool
    status_reason: str | None = None


class ModelsResponse(BaseModel):
    models: list[ModelStatus]
    default_model: str

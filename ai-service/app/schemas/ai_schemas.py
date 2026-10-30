from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Categorization
class CategorizeRequest(BaseModel):
    title: str = Field(..., min_length=2)
    description: str = Field(..., min_length=5)
    user_category: Optional[str] = None

class CategorizeResponse(BaseModel):
    predicted_category: str
    confidence_score: float
    explanation: str

# Summarization
class SummarizeRequest(BaseModel):
    title: str
    description: str
    address: Optional[str] = None

class SummarizeResponse(BaseModel):
    summary: str
    original_length: int
    summary_length: int

# Duplicates
class ComplaintRecord(BaseModel):
    id: str
    title: str
    description: str
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: Optional[str] = None

class DuplicateDetectRequest(BaseModel):
    current_complaint: ComplaintRecord
    existing_complaints: List[ComplaintRecord]
    similarity_threshold: Optional[float] = 0.45
    geo_proximity_km: Optional[float] = 1.0

class DuplicateMatch(BaseModel):
    possible_duplicate_id: str
    similarity_score: float
    duplicate_confidence: str
    explanation: str

class DuplicateDetectResponse(BaseModel):
    is_duplicate: bool
    possible_duplicates: List[DuplicateMatch]

# Priority Scoring
class PriorityRequest(BaseModel):
    title: str
    description: str
    category: str
    address: Optional[str] = None
    reported_count: Optional[int] = 1

class PriorityFactor(BaseModel):
    factor_name: str
    points: float
    rationale: str

class PriorityResponse(BaseModel):
    priority_score: float
    priority_level: str
    contributing_factors: List[PriorityFactor]
    explanation: str

# Geographic Clustering / Hotspots
class HotspotComplaint(BaseModel):
    id: str
    title: str
    category: str
    latitude: float
    longitude: float
    priority: Optional[str] = "Medium"
    created_at: Optional[str] = None

class ClusterRequest(BaseModel):
    complaints: List[HotspotComplaint]
    eps_km: Optional[float] = 0.8
    min_samples: Optional[int] = 2

class HotspotDetails(BaseModel):
    cluster_id: str
    title: str
    description: str
    location: str
    center_latitude: float
    center_longitude: float
    complaint_count: int
    most_common_category: str
    severity: str
    average_priority: str
    related_complaint_ids: List[str]

class ClusterResponse(BaseModel):
    total_hotspots: int
    hotspots: List[HotspotDetails]

# Action Briefs
class ActionBriefRequest(BaseModel):
    category: str
    priority_level: str
    complaint_count: Optional[int] = 1
    sample_descriptions: Optional[List[str]] = []
    location: Optional[str] = None

class ActionBriefResponse(BaseModel):
    recommended_department: str
    target_sla_hours: int
    immediate_containment: str
    recommended_equipment: List[str]
    suggested_action_brief: str

# Health
class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

from fastapi import APIRouter, HTTPException
from typing import List, Optional

from app.schemas.ai_schemas import (
    CategorizeRequest, CategorizeResponse,
    SummarizeRequest, SummarizeResponse,
    DuplicateDetectRequest, DuplicateDetectResponse,
    PriorityRequest, PriorityResponse,
    ClusterRequest, ClusterResponse,
    ActionBriefRequest, ActionBriefResponse,
    HealthResponse
)
from app.services.ai_engines import (
    categorize_complaint,
    summarize_complaint,
    detect_duplicates,
    compute_priority,
    cluster_hotspots,
    generate_action_brief
)

router = APIRouter(prefix="/ai", tags=["AI Engine"])

@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="healthy",
        service="Smart Civic Governance Python AI Engine",
        version="2.0.0"
    )

@router.post("/categorize", response_model=CategorizeResponse)
def api_categorize(req: CategorizeRequest):
    return categorize_complaint(req.title, req.description, req.user_category)

@router.post("/summarize", response_model=SummarizeResponse)
def api_summarize(req: SummarizeRequest):
    return summarize_complaint(req.title, req.description, req.address)

@router.post("/detect-duplicates", response_model=DuplicateDetectResponse)
def api_detect_duplicates(req: DuplicateDetectRequest):
    return detect_duplicates(
        current_complaint=req.current_complaint,
        existing_complaints=req.existing_complaints,
        similarity_threshold=req.similarity_threshold or 0.45,
        geo_proximity_km=req.geo_proximity_km or 1.0
    )

@router.post("/priority", response_model=PriorityResponse)
def api_priority(req: PriorityRequest):
    return compute_priority(
        title=req.title,
        description=req.description,
        category=req.category,
        address=req.address,
        reported_count=req.reported_count or 1
    )

@router.post("/cluster", response_model=ClusterResponse)
def api_cluster(req: ClusterRequest):
    return cluster_hotspots(
        complaints=req.complaints,
        eps_km=req.eps_km or 0.8,
        min_samples=req.min_samples or 2
    )

@router.post("/action-brief", response_model=ActionBriefResponse)
def api_action_brief(req: ActionBriefRequest):
    return generate_action_brief(
        category=req.category,
        priority_level=req.priority_level,
        complaint_count=req.complaint_count or 1,
        location=req.location
    )

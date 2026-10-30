import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.ai_router import router as ai_router
from app.schemas.ai_schemas import (
    CategorizeRequest,
    SummarizeRequest,
    DuplicateDetectRequest,
    PriorityRequest,
    ClusterRequest,
    ActionBriefRequest
)
from app.services.ai_engines import (
    categorize_complaint,
    summarize_complaint,
    detect_duplicates,
    compute_priority,
    cluster_hotspots,
    generate_action_brief
)

app = FastAPI(
    title="Smart Civic Governance AI Microservice",
    description="Python FastAPI service for categorization, summarization, duplicate detection, explainable priority scoring, DBSCAN clustering, and action briefs.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include canonical /ai endpoints
app.include_router(ai_router)

# Root health check
@app.get("/")
def root():
    return {
        "status": "healthy",
        "service": "Smart Civic Governance AI Microservice",
        "version": "2.0.0",
        "endpoints": [
            "/ai/categorize",
            "/ai/summarize",
            "/ai/detect-duplicates",
            "/ai/priority",
            "/ai/cluster",
            "/ai/action-brief",
            "/ai/health"
        ]
    }

@app.get("/health")
def top_health():
    return {"status": "healthy", "service": "Smart Civic Governance AI Microservice"}

# Top-level legacy aliases for compatibility with previous client calls
@app.post("/analyze-complaint")
def legacy_analyze(req: dict):
    title = req.get("title", "")
    description = req.get("description", "")
    address = req.get("address", "")
    user_cat = req.get("user_category")

    cat_res = categorize_complaint(title, description, user_cat)
    sum_res = summarize_complaint(title, description, address)
    pri_res = compute_priority(title, description, cat_res.predicted_category, address)
    brief_res = generate_action_brief(cat_res.predicted_category, pri_res.priority_level)

    return {
        "ai_category": cat_res.predicted_category,
        "ai_summary": sum_res.summary,
        "priority": pri_res.priority_level,
        "priority_score": pri_res.priority_score,
        "priority_explanation": pri_res.explanation,
        "recommended_department": cat_res.predicted_category,
        "action_recommendations": {
            "recommended_department": brief_res.recommended_department,
            "target_sla_hours": brief_res.target_sla_hours,
            "required_equipment": brief_res.recommended_equipment,
            "immediate_containment": brief_res.immediate_containment
        }
    }

@app.post("/detect-duplicates")
def legacy_duplicates(req: DuplicateDetectRequest):
    return detect_duplicates(
        current_complaint=req.current_complaint,
        existing_complaints=req.existing_complaints,
        similarity_threshold=req.similarity_threshold or 0.45,
        geo_proximity_km=req.geo_proximity_km or 1.0
    )

@app.post("/cluster-hotspots")
def legacy_cluster(req: ClusterRequest):
    return cluster_hotspots(
        complaints=req.complaints,
        eps_km=req.eps_km or 0.8,
        min_samples=req.min_samples or 2
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)

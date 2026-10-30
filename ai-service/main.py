import os
import re
import math
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(
    title="Smart Civic Governance Platform - AI Service",
    description="FastAPI service for complaint categorization, summarization, explainable priority scoring, duplicate detection, and geographic hotspot clustering.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standard Civic Department Names matching Supabase seed
DEPARTMENTS = [
    "Roads & Infrastructure",
    "Water Supply & Sewage",
    "Sanitation & Solid Waste",
    "Electricity & Public Lighting",
    "Public Health & Safety",
    "Parks & Urban Greenery"
]

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "Roads & Infrastructure": [
        "pothole", "road", "pavement", "footpath", "sidewalk", "asphalt", "bridge", 
        "divider", "traffic signal", "zebra crossing", "flyover", "crater", "sinkhole",
        "speed breaker", "manhole open", "caved in"
    ],
    "Water Supply & Sewage": [
        "water", "pipe", "leak", "pipeline", "drain", "drainage", "sewage", "overflow", 
        "contamination", "dirty water", "drinking water", "gutter", "clogged drain", "flooding",
        "water pressure", "burst pipe"
    ],
    "Sanitation & Solid Waste": [
        "garbage", "trash", "waste", "dump", "dustbin", "litter", "rubbish", "debris", 
        "sanitation", "cleanliness", "overflowing bin", "plastic", "compost", "stench", "rotting"
    ],
    "Electricity & Public Lighting": [
        "street light", "streetlight", "light", "pole", "wire", "cable", "transformer", 
        "spark", "electrocution", "blackout", "hanging wire", "current", "fuse", "power outage"
    ],
    "Public Health & Safety": [
        "dog", "stray", "mosquito", "dengue", "malaria", "health", "hazard", "disease", 
        "rabies", "bitten", "encroachment", "air pollution", "chemical", "fumes", "toxic",
        "dead animal", "carcass", "noise", "loudspeaker"
    ],
    "Parks & Urban Greenery": [
        "tree", "branch", "fallen tree", "park", "garden", "grass", "plants", "playground", 
        "bench", "pruning", "lawn", "overgrown"
    ]
}

HIGH_HAZARD_KEYWORDS = [
    "electrocution", "sparking", "exposed wire", "fire", "sinkhole", "deep crater", 
    "hospital", "school", "fatal", "accident", "child", "emergency", "burst pipe", 
    "severe flood", "toxic fumes", "rabid dog", "contamination", "death", "structural collapse"
]

MEDIUM_HAZARD_KEYWORDS = [
    "dark", "stagnant water", "dengue", "traffic block", "overflow", "stench", 
    "uncollected garbage", "slippery", "broken glass", "deep", "sharp"
]


class ComplaintAnalyzeRequest(BaseModel):
    title: str = Field(..., min_length=2)
    description: str = Field(..., min_length=5)
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    user_category: Optional[str] = None

class ActionRecommendation(BaseModel):
    recommended_department: str
    target_sla_hours: int
    required_equipment: List[str]
    immediate_containment: str

class ComplaintAnalyzeResponse(BaseModel):
    ai_category: str
    ai_summary: str
    priority: str
    priority_score: float
    priority_explanation: str
    recommended_department: str
    action_recommendations: ActionRecommendation

class ExistingComplaintItem(BaseModel):
    id: str
    title: str
    description: str
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class DuplicateDetectionRequest(BaseModel):
    current_complaint: ExistingComplaintItem
    existing_complaints: List[ExistingComplaintItem]
    similarity_threshold: Optional[float] = 0.45
    geo_proximity_km: Optional[float] = 1.0

class DuplicateMatch(BaseModel):
    original_complaint_id: str
    duplicate_complaint_id: str
    similarity_score: float
    explanation: str

class DuplicateDetectionResponse(BaseModel):
    is_duplicate: bool
    duplicates: List[DuplicateMatch]

class HotspotComplaintItem(BaseModel):
    id: str
    title: str
    category: str
    latitude: float
    longitude: float
    priority: Optional[str] = "Medium"
    created_at: Optional[str] = None

class HotspotClusteringRequest(BaseModel):
    complaints: List[HotspotComplaintItem]
    radius_km: Optional[float] = 1.0
    min_complaints: Optional[int] = 2

class HotspotCluster(BaseModel):
    cluster_id: str
    title: str
    description: str
    location: str
    center_latitude: float
    center_longitude: float
    complaint_count: int
    severity: str
    dominant_category: str
    related_complaint_ids: List[str]

class HotspotClusteringResponse(BaseModel):
    total_clusters: int
    hotspots: List[HotspotCluster]


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def categorize_text(text: str, user_category: Optional[str]) -> str:
    cleaned = text.lower()
    scores = {dept: 0 for dept in DEPARTMENTS}

    for dept, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', cleaned):
                scores[dept] += 2
            elif kw in cleaned:
                scores[dept] += 1

    if user_category and user_category in scores:
        scores[user_category] += 1.5

    best_dept = max(scores, key=scores.get)
    if scores[best_dept] > 0:
        return best_dept
    return user_category if (user_category in DEPARTMENTS) else "Roads & Infrastructure"


def generate_extractive_summary(title: str, description: str, address: Optional[str]) -> str:
    cleaned_desc = re.sub(r'\s+', ' ', description).strip()
    sentences = re.split(r'(?<=[.!?]) +', cleaned_desc)
    
    first_sentence = sentences[0] if sentences else cleaned_desc
    if len(first_sentence) > 160:
        first_sentence = first_sentence[:157] + "..."
    
    loc_part = f" at {address.strip()}" if address and address.strip() else ""
    return f"{title.strip()}{loc_part}: {first_sentence}"


def compute_explainable_priority(text: str, category: str) -> Dict[str, Any]:
    text_lower = text.lower()
    
    # Base score
    base_score = 35.0
    factor_explanations = []

    # Factor 1: Safety & Life Hazard Detection
    safety_hazard_points = 0.0
    matched_high = [w for w in HIGH_HAZARD_KEYWORDS if w in text_lower]
    matched_med = [w for w in MEDIUM_HAZARD_KEYWORDS if w in text_lower]

    if matched_high:
        safety_hazard_points += min(35.0, len(matched_high) * 18.0)
        factor_explanations.append(f"Critical safety hazard keywords detected ({', '.join(matched_high[:3])}) (+{safety_hazard_points:.0f} pts)")
    elif matched_med:
        safety_hazard_points += min(20.0, len(matched_med) * 10.0)
        factor_explanations.append(f"Moderate public inconvenience/risk keywords detected ({', '.join(matched_med[:3])}) (+{safety_hazard_points:.0f} pts)")
    else:
        factor_explanations.append("Routine civic maintenance request (+0 pts)")

    # Factor 2: Category Inherent Criticality
    category_weight = {
        "Electricity & Public Lighting": 20.0,
        "Water Supply & Sewage": 18.0,
        "Public Health & Safety": 18.0,
        "Roads & Infrastructure": 15.0,
        "Sanitation & Solid Waste": 12.0,
        "Parks & Urban Greenery": 8.0,
    }.get(category, 12.0)
    factor_explanations.append(f"Department baseline urgency for {category} (+{category_weight:.0f} pts)")

    # Factor 3: Scope and Sentiment Urgency
    urgency_points = 0.0
    urgency_markers = ["immediately", "danger", "urgent", "broken", "blocked", "heavy", "huge", "multiple"]
    matched_urgency = [w for w in urgency_markers if w in text_lower]
    if matched_urgency:
        urgency_points = min(15.0, len(matched_urgency) * 5.0)
        factor_explanations.append(f"High urgency phrasing ({', '.join(matched_urgency)}) (+{urgency_points:.0f} pts)")

    total_score = min(100.0, max(10.0, base_score + safety_hazard_points + category_weight + urgency_points - 15.0))
    total_score = round(total_score, 2)

    if total_score >= 80.0:
        level = "Critical"
    elif total_score >= 60.0:
        level = "High"
    elif total_score >= 40.0:
        level = "Medium"
    else:
        level = "Low"

    explanation = f"Classified as {level} Priority (Score: {total_score}/100). Breakdown: " + "; ".join(factor_explanations) + "."
    
    return {
        "score": total_score,
        "level": level,
        "explanation": explanation
    }


def generate_action_recommendation(category: str, priority_level: str) -> ActionRecommendation:
    sla_map = {
        "Critical": 12,
        "High": 24,
        "Medium": 72,
        "Low": 120
    }
    
    equipment_map = {
        "Roads & Infrastructure": ["Cold mix asphalt repair kit", "Safety barricades & reflective cones", "Compactor roller"],
        "Water Supply & Sewage": ["Submersible suction pump", "Pipe clamp & coupling set", "Drainage snake jetting unit"],
        "Sanitation & Solid Waste": ["Hydraulic compactor truck", "Sanitization disinfectant spray unit", "Heavy-duty protective gear"],
        "Electricity & Public Lighting": ["Insulated boom bucket truck", "High-voltage multi-meter", "Replacement LED luminaire units & wiring"],
        "Public Health & Safety": ["Animal control containment vehicle", "ULV mosquito fogging machine", "Larvicide distribution kit"],
        "Parks & Urban Greenery": ["Hydraulic chainsaw & pole pruner", "Wood chipper", "Tree stabilization rigging cables"]
    }
    
    containment_map = {
        "Critical": "Dispatch emergency response crew immediately; cordon off area and notify field supervisor.",
        "High": "Schedule inspection within the first 6 hours; prepare specialized repair team.",
        "Medium": "Route to daily department schedule for standard resolution inspection.",
        "Low": "Queue for routine batch maintenance and cyclic community sweep."
    }

    return ActionRecommendation(
        recommended_department=category,
        target_sla_hours=sla_map.get(priority_level, 72),
        required_equipment=equipment_map.get(category, ["Standard civic inspection kit"]),
        immediate_containment=containment_map.get(priority_level, "Route to standard inspection queue.")
    )


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Smart Civic Governance AI Microservice",
        "version": "1.0.0"
    }


@app.post("/analyze-complaint", response_model=ComplaintAnalyzeResponse)
def analyze_complaint(request: ComplaintAnalyzeRequest):
    combined_text = f"{request.title} {request.description}"
    category = categorize_text(combined_text, request.user_category)
    summary = generate_extractive_summary(request.title, request.description, request.address)
    priority_info = compute_explainable_priority(combined_text, category)
    action_rec = generate_action_recommendation(category, priority_info["level"])

    return ComplaintAnalyzeResponse(
        ai_category=category,
        ai_summary=summary,
        priority=priority_info["level"],
        priority_score=priority_info["score"],
        priority_explanation=priority_info["explanation"],
        recommended_department=category,
        action_recommendations=action_rec
    )


@app.post("/detect-duplicates", response_model=DuplicateDetectionResponse)
def detect_duplicates(request: DuplicateDetectionRequest):
    current = request.current_complaint
    existing = request.existing_complaints

    if not existing:
        return DuplicateDetectionResponse(is_duplicate=False, duplicates=[])

    current_text = f"{current.title} {current.description}".strip()
    existing_texts = [f"{e.title} {e.description}".strip() for e in existing]

    corpus = [current_text] + existing_texts

    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        tfidf_matrix = vectorizer.fit_transform(corpus)
        sim_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
    except Exception:
        sim_scores = [0.0] * len(existing)

    duplicates_found: List[DuplicateMatch] = []

    for idx, orig in enumerate(existing):
        if orig.id == current.id:
            continue

        text_score = float(sim_scores[idx])
        
        # Check geographic distance if coordinates are present
        geo_bonus = 0.0
        distance_km = None
        if (current.latitude is not None and current.longitude is not None and
            orig.latitude is not None and orig.longitude is not None):
            distance_km = haversine_distance_km(
                current.latitude, current.longitude, orig.latitude, orig.longitude
            )
            if distance_km <= request.geo_proximity_km:
                # Proximity bonus
                geo_bonus = max(0.0, 0.25 * (1.0 - (distance_km / request.geo_proximity_km)))

        effective_similarity = min(1.0, text_score + geo_bonus)

        if effective_similarity >= request.similarity_threshold:
            reasons = []
            if text_score >= 0.35:
                reasons.append(f"High contextual language similarity ({text_score * 100:.1f}%)")
            if distance_km is not None and distance_km <= request.geo_proximity_km:
                reasons.append(f"Occurred within {distance_km:.2f} km of complaint {orig.id[:8]}")
            if orig.category and current.category and orig.category == current.category:
                reasons.append(f"Shares identical civic domain: {current.category}")

            explanation = (
                f"Potential duplicate of complaint #{orig.id[:8]} with "
                f"{effective_similarity * 100:.1f}% estimated match. " + "; ".join(reasons) + "."
            )

            duplicates_found.append(
                DuplicateMatch(
                    original_complaint_id=orig.id,
                    duplicate_complaint_id=current.id,
                    similarity_score=round(effective_similarity, 4),
                    explanation=explanation
                )
            )

    duplicates_found.sort(key=lambda x: x.similarity_score, reverse=True)

    return DuplicateDetectionResponse(
        is_duplicate=len(duplicates_found) > 0,
        duplicates=duplicates_found
    )


@app.post("/cluster-hotspots", response_model=HotspotClusteringResponse)
def cluster_hotspots(request: HotspotClusteringRequest):
    complaints = request.complaints
    if not complaints:
        return HotspotClusteringResponse(total_clusters=0, hotspots=[])

    # Simple spatial clustering based on radius threshold
    clusters: List[List[HotspotComplaintItem]] = []
    visited = set()

    for i, c in enumerate(complaints):
        if c.id in visited:
            continue
        
        cluster = [c]
        visited.add(c.id)

        for j, other in enumerate(complaints):
            if other.id in visited:
                continue
            dist = haversine_distance_km(c.latitude, c.longitude, other.latitude, other.longitude)
            if dist <= request.radius_km:
                cluster.append(other)
                visited.add(other.id)

        if len(cluster) >= request.min_complaints:
            clusters.append(cluster)

    hotspots: List[HotspotCluster] = []
    
    for idx, cluster in enumerate(clusters):
        avg_lat = sum(c.latitude for c in cluster) / len(cluster)
        avg_lon = sum(c.longitude for c in cluster) / len(cluster)

        # Dominant category
        cat_counts: Dict[str, int] = {}
        for c in cluster:
            cat_counts[c.category] = cat_counts.get(c.category, 0) + 1
        dominant_cat = max(cat_counts, key=cat_counts.get)

        # Severity
        has_critical = any(c.priority == "Critical" for c in cluster)
        has_high = any(c.priority == "High" for c in cluster)
        if has_critical or len(cluster) >= 5:
            severity = "Critical"
        elif has_high or len(cluster) >= 3:
            severity = "High"
        else:
            severity = "Medium"

        cluster_id = f"hotspot-{idx + 1}"
        title = f"{severity} Hotspot: {len(cluster)} {dominant_cat} Issues"
        description = (
            f"Geographic cluster of {len(cluster)} complaints detected within {request.radius_km:.1f} km radius. "
            f"Primary issue category: {dominant_cat}. Coordinated maintenance intervention recommended."
        )

        hotspots.append(
            HotspotCluster(
                cluster_id=cluster_id,
                title=title,
                description=description,
                location=f"Lat {avg_lat:.4f}, Lon {avg_lon:.4f}",
                center_latitude=round(avg_lat, 6),
                center_longitude=round(avg_lon, 6),
                complaint_count=len(cluster),
                severity=severity,
                dominant_category=dominant_cat,
                related_complaint_ids=[c.id for c in cluster]
            )
        )

    return HotspotClusteringResponse(
        total_clusters=len(hotspots),
        hotspots=hotspots
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

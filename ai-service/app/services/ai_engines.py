import re
import math
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN

from app.schemas.ai_schemas import (
    CategorizeResponse,
    SummarizeResponse,
    DuplicateDetectResponse,
    DuplicateMatch,
    PriorityResponse,
    PriorityFactor,
    ClusterResponse,
    HotspotDetails,
    ActionBriefResponse
)

# Supported categories as specified in Master Prompt 02
SUPPORTED_CATEGORIES = [
    "Road Damage",
    "Waterlogging",
    "Waste Management",
    "Streetlight Issues",
    "Water Supply",
    "Drainage Problems",
    "Public Safety",
    "Other"
]

CATEGORY_PATTERNS: Dict[str, List[str]] = {
    "Road Damage": [
        "pothole", "crater", "sinkhole", "road", "asphalt", "tar", "pavement",
        "divider", "flyover", "bridge", "caved in", "broken road", "footpath", "speed breaker"
    ],
    "Waterlogging": [
        "waterlogging", "water accumulation", "submerged", "flooding", "stagnant water",
        "standing water", "water logging", "knee deep", "rainwater", "inundated"
    ],
    "Waste Management": [
        "garbage", "trash", "waste", "dump", "bin", "overflowing bin", "debris",
        "rubbish", "litter", "stench", "rotting", "compost", "solid waste"
    ],
    "Streetlight Issues": [
        "street light", "streetlight", "light", "pole", "dark", "no lighting",
        "blinking light", "bulb", "lamp", "blackout", "illumination"
    ],
    "Water Supply": [
        "drinking water", "water supply", "low pressure", "contaminated water",
        "dirty water", "no water", "tap", "pipeline burst", "water shortage"
    ],
    "Drainage Problems": [
        "drain", "drainage", "sewage", "sewer", "gutter", "manhole",
        "clogged drain", "overflowing drain", "choked", "stink", "foul smell"
    ],
    "Public Safety": [
        "wire", "electric wire", "spark", "transformer", "exposed wire",
        "electrocution", "stray dog", "dog bite", "hazard", "fire", "accident",
        "falling tree", "deep open manhole", "chemical", "toxic", "emergency"
    ]
}

HIGH_HAZARD_WORDS = [
    "sparking", "electrocution", "exposed wire", "fire", "sinkhole", "deep crater",
    "hospital", "school", "fatal", "accident", "emergency", "burst pipe", "severe flood",
    "toxic fumes", "rabid dog", "contamination", "death", "structural collapse"
]

MEDIUM_HAZARD_WORDS = [
    "dark", "stagnant water", "dengue", "traffic block", "overflow", "stench",
    "uncollected garbage", "slippery", "broken glass", "deep", "sharp"
]

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# 1. Automatic Categorization
def categorize_complaint(title: str, description: str, user_category: Optional[str] = None) -> CategorizeResponse:
    text = f"{title} {description}".lower()
    scores = {cat: 0.0 for cat in SUPPORTED_CATEGORIES if cat != "Other"}

    for cat, keywords in CATEGORY_PATTERNS.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', text):
                scores[cat] += 2.5
            elif kw in text:
                scores[cat] += 1.0

    total_hits = sum(scores.values())
    if total_hits > 0:
        best_cat = max(scores, key=scores.get)
        confidence = round(min(0.96, max(0.55, scores[best_cat] / total_hits)), 2)
        explanation = f"Classified as '{best_cat}' based on detected civic keywords in description (confidence: {int(confidence*100)}%)."
        return CategorizeResponse(
            predicted_category=best_cat,
            confidence_score=confidence,
            explanation=explanation
        )

    # Fallback to user category if valid
    if user_category and user_category in SUPPORTED_CATEGORIES:
        return CategorizeResponse(
            predicted_category=user_category,
            confidence_score=0.60,
            explanation=f"No high-confidence automated matches; defaulted to citizen suggested '{user_category}'."
        )

    return CategorizeResponse(
        predicted_category="Other",
        confidence_score=0.50,
        explanation="General municipal issue requiring administrative review."
    )

# 2. Summarization
def summarize_complaint(title: str, description: str, address: Optional[str] = None) -> SummarizeResponse:
    cleaned = re.sub(r'\s+', ' ', description).strip()
    sentences = re.split(r'(?<=[.!?]) +', cleaned)
    first_part = sentences[0] if sentences else cleaned

    if len(first_part) > 150:
        first_part = first_part[:147] + "..."

    location_str = f" at {address.strip()}" if address and address.strip() else ""
    summary = f"{title.strip()}{location_str}: {first_part}"

    return SummarizeResponse(
        summary=summary,
        original_length=len(cleaned),
        summary_length=len(summary)
    )

# 3. Duplicate Detection
def detect_duplicates(
    current_complaint: Any,
    existing_complaints: List[Any],
    similarity_threshold: float = 0.45,
    geo_proximity_km: float = 1.0
) -> DuplicateDetectResponse:
    if not existing_complaints:
        return DuplicateDetectResponse(is_duplicate=False, possible_duplicates=[])

    current_text = f"{current_complaint.title} {current_complaint.description}".strip()
    existing_texts = [f"{e.title} {e.description}".strip() for e in existing_complaints]

    corpus = [current_text] + existing_texts

    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=1200)
        tfidf_matrix = vectorizer.fit_transform(corpus)
        sim_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
    except Exception:
        sim_scores = [0.0] * len(existing_complaints)

    possible_matches: List[DuplicateMatch] = []

    for idx, orig in enumerate(existing_complaints):
        if orig.id == current_complaint.id:
            continue

        text_score = float(sim_scores[idx])

        # Haversine distance
        geo_bonus = 0.0
        dist_km = None
        if (current_complaint.latitude is not None and current_complaint.longitude is not None and
            orig.latitude is not None and orig.longitude is not None):
            dist_km = haversine_distance_km(
                current_complaint.latitude, current_complaint.longitude,
                orig.latitude, orig.longitude
            )
            if dist_km <= geo_proximity_km:
                geo_bonus = max(0.0, 0.25 * (1.0 - (dist_km / geo_proximity_km)))

        effective_score = min(1.0, text_score + geo_bonus)

        if effective_score >= similarity_threshold:
            conf = "High" if effective_score >= 0.70 else ("Medium" if effective_score >= 0.50 else "Low")
            reasons = []
            if text_score >= 0.35:
                reasons.append(f"Semantic match {text_score*100:.1f}%")
            if dist_km is not None and dist_km <= geo_proximity_km:
                reasons.append(f"Located within {dist_km:.2f} km")
            if orig.category and current_complaint.category and orig.category == current_complaint.category:
                reasons.append(f"Identical domain ({current_complaint.category})")

            explanation = (
                f"Potential duplicate of #{orig.id[:8]} with "
                f"{effective_score*100:.1f}% match: " + "; ".join(reasons) + "."
            )

            possible_matches.append(DuplicateMatch(
                possible_duplicate_id=orig.id,
                similarity_score=round(effective_score, 4),
                duplicate_confidence=conf,
                explanation=explanation
            ))

    possible_matches.sort(key=lambda x: x.similarity_score, reverse=True)

    return DuplicateDetectResponse(
        is_duplicate=len(possible_matches) > 0,
        possible_duplicates=possible_matches
    )

# 4. Explainable Priority Scoring (0-100 range: Critical 80-100, High 60-79, Medium 30-59, Low 0-29)
def compute_priority(
    title: str,
    description: str,
    category: str,
    address: Optional[str] = None,
    reported_count: int = 1
) -> PriorityResponse:
    text = f"{title} {description}".lower()
    factors: List[PriorityFactor] = []

    # Baseline score
    base_points = 25.0
    factors.append(PriorityFactor(
        factor_name="Baseline Urgency",
        points=base_points,
        rationale="Municipal intake baseline"
    ))

    # Factor 1: Public Safety Hazard
    safety_points = 0.0
    high_hits = [w for w in HIGH_HAZARD_WORDS if w in text]
    med_hits = [w for w in MEDIUM_HAZARD_WORDS if w in text]

    if high_hits:
        safety_points = min(40.0, len(high_hits) * 20.0)
        factors.append(PriorityFactor(
            factor_name="Critical Safety Risk",
            points=safety_points,
            rationale=f"Keywords detected: {', '.join(high_hits[:3])}"
        ))
    elif med_hits:
        safety_points = min(20.0, len(med_hits) * 10.0)
        factors.append(PriorityFactor(
            factor_name="Public Inconvenience",
            points=safety_points,
            rationale=f"Keywords detected: {', '.join(med_hits[:3])}"
        ))

    # Factor 2: Category Impact
    cat_weights = {
        "Public Safety": 25.0,
        "Water Supply": 20.0,
        "Waterlogging": 18.0,
        "Drainage Problems": 18.0,
        "Streetlight Issues": 16.0,
        "Road Damage": 15.0,
        "Waste Management": 12.0,
        "Other": 10.0
    }
    cat_points = cat_weights.get(category, 12.0)
    factors.append(PriorityFactor(
        factor_name="Service Criticality",
        points=cat_points,
        rationale=f"Standard SLA weight for '{category}'"
    ))

    # Factor 3: Repeat / Recurrence Multiplier
    if reported_count > 1:
        repeat_points = min(15.0, (reported_count - 1) * 5.0)
        factors.append(PriorityFactor(
            factor_name="Recurrence Concentration",
            points=repeat_points,
            rationale=f"{reported_count} reports registered for proximate problem"
        ))
    else:
        repeat_points = 0.0

    total_score = min(100.0, max(5.0, base_points + safety_points + cat_points + repeat_points - 10.0))
    total_score = round(total_score, 1)

    # Threshold mapping strictly adhering to master prompt table:
    # 80-100: Critical
    # 60-79: High
    # 30-59: Medium
    # 0-29: Low
    if total_score >= 80.0:
        level = "Critical"
    elif total_score >= 60.0:
        level = "High"
    elif total_score >= 30.0:
        level = "Medium"
    else:
        level = "Low"

    explanation = (
        f"{level} Priority (Score: {total_score}/100). " +
        " | ".join([f"{f.factor_name}: +{f.points:.0f} pts ({f.rationale})" for f in factors])
    )

    return PriorityResponse(
        priority_score=total_score,
        priority_level=level,
        contributing_factors=factors,
        explanation=explanation
    )

# 5. Complaint Clustering & Hotspot Detection
def cluster_hotspots(complaints: List[Any], eps_km: float = 0.8, min_samples: int = 2) -> ClusterResponse:
    if len(complaints) < min_samples:
        return ClusterResponse(total_hotspots=0, hotspots=[])

    df = pd.DataFrame([{
        "id": c.id,
        "title": c.title,
        "category": c.category,
        "lat": c.latitude,
        "lon": c.longitude,
        "priority": c.priority or "Medium"
    } for c in complaints])

    # Convert lat/lon to radians for Haversine DBSCAN
    coords_rad = np.radians(df[['lat', 'lon']].values)
    kms_per_radian = 6371.0
    epsilon = eps_km / kms_per_radian

    db = DBSCAN(eps=epsilon, min_samples=min_samples, metric='haversine')
    df['cluster'] = db.fit_predict(coords_rad)

    hotspots: List[HotspotDetails] = []
    clustered_df = df[df['cluster'] != -1]

    for cluster_label, group in clustered_df.groupby('cluster'):
        center_lat = round(float(group['lat'].mean()), 6)
        center_lon = round(float(group['lon'].mean()), 6)
        count = len(group)
        common_cat = group['category'].mode()[0] if not group['category'].empty else "Civic"

        has_crit = (group['priority'] == 'Critical').any()
        has_high = (group['priority'] == 'High').any()

        if has_crit or count >= 5:
            severity = "Critical"
            avg_priority = "Critical"
        elif has_high or count >= 3:
            severity = "High"
            avg_priority = "High"
        else:
            severity = "Medium"
            avg_priority = "Medium"

        cluster_id = f"hotspot-{cluster_label + 1}"
        title = f"{severity} Hotspot: {count} {common_cat} Reports"
        description = (
            f"Geographic cluster of {count} complaints within {eps_km} km radius. "
            f"Dominant issue: {common_cat}. Coordinated maintenance intervention recommended."
        )

        hotspots.append(HotspotDetails(
            cluster_id=cluster_id,
            title=title,
            description=description,
            location=f"Lat {center_lat:.4f}, Lon {center_lon:.4f}",
            center_latitude=center_lat,
            center_longitude=center_lon,
            complaint_count=count,
            most_common_category=common_cat,
            severity=severity,
            average_priority=avg_priority,
            related_complaint_ids=group['id'].tolist()
        ))

    return ClusterResponse(total_hotspots=len(hotspots), hotspots=hotspots)

# 6. AI Action Briefs
def generate_action_brief(
    category: str,
    priority_level: str,
    complaint_count: int = 1,
    location: Optional[str] = None
) -> ActionBriefResponse:
    sla_map = {
        "Critical": 12,
        "High": 24,
        "Medium": 48,
        "Low": 72
    }

    equipment_map = {
        "Road Damage": ["Cold mix asphalt repair kit", "Compactor roller", "Traffic safety barricades"],
        "Waterlogging": ["High-capacity dewatering pump", "Suction hose line", "Drain clearance jetting machine"],
        "Waste Management": ["Hydraulic compactor truck", "Sanitization spray unit", "Heavy-duty personal protective gear"],
        "Streetlight Issues": ["Insulated aerial boom bucket truck", "High-voltage multimeter", "Replacement LED luminaires"],
        "Water Supply": ["Submersible suction pump", "Pipe clamp coupling set", "Mobile water tanker"],
        "Drainage Problems": ["Drainage snake jetting unit", "Sludge suction tanker", "Safety harness & gas detector"],
        "Public Safety": ["Emergency barrier cones", "Insulated lineman tools", "Safety hazard tape & warning beacons"],
        "Other": ["Standard municipal inspection kit", "Digital survey tablet"]
    }

    containment_map = {
        "Critical": "Dispatch emergency response crew immediately; cordon off area and notify field supervisor.",
        "High": "Schedule priority on-site inspection within 6 hours; prepare specialized repair crew.",
        "Medium": "Route to daily department schedule for standard resolution inspection.",
        "Low": "Queue for routine maintenance sweep and cyclic area servicing."
    }

    loc_str = f" in {location}" if location else " in the affected locality"
    brief = (
        f"Recommendation: {complaint_count} {category} issue(s) reported{loc_str}. "
        f"The relevant municipal team should inspect the affected area, assess the condition, "
        f"and execute necessary repairs within {sla_map.get(priority_level, 48)} hours."
    )

    return ActionBriefResponse(
        recommended_department=category,
        target_sla_hours=sla_map.get(priority_level, 48),
        immediate_containment=containment_map.get(priority_level, "Route to standard inspection queue."),
        recommended_equipment=equipment_map.get(category, ["Standard civic inspection kit"]),
        suggested_action_brief=brief
    )

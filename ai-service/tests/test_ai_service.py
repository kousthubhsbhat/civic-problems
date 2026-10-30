import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_analyze_complaint_critical_electricity():
    payload = {
        "title": "Exposed high voltage wire sparking near elementary school",
        "description": "A live electric wire has fallen from a pole after thunderstorm and is sparking violently on the sidewalk right outside St. Jude school. Urgent electrocution danger to children!",
        "address": "142 Elm St, Near School Gate",
        "user_category": "Electricity & Public Lighting"
    }
    response = client.post("/analyze-complaint", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ai_category"] == "Electricity & Public Lighting"
    assert data["priority"] in ["High", "Critical"]
    assert data["priority_score"] >= 70.0
    assert "sparking" in data["priority_explanation"] or "Critical safety" in data["priority_explanation"]
    assert data["action_recommendations"]["recommended_department"] == "Electricity & Public Lighting"
    assert data["action_recommendations"]["target_sla_hours"] <= 24

def test_analyze_complaint_routine_pothole():
    payload = {
        "title": "Minor pothole on residential road",
        "description": "Small pothole has formed in front of house number 23. It causes bumps for bicycles.",
        "address": "23 Maple Avenue",
        "user_category": "Roads & Infrastructure"
    }
    response = client.post("/analyze-complaint", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ai_category"] == "Roads & Infrastructure"
    assert data["priority"] in ["Low", "Medium"]
    assert "pothole" in data["ai_summary"].lower()

def test_detect_duplicates():
    payload = {
        "current_complaint": {
            "id": "complaint-new-123",
            "title": "Overflowing dumpster on 5th cross road",
            "description": "The green garbage dumpster is full and trash is spilling on the street causing terrible smell.",
            "category": "Sanitation & Solid Waste",
            "latitude": 12.9716,
            "longitude": 77.5946
        },
        "existing_complaints": [
            {
                "id": "complaint-old-456",
                "title": "Garbage overflowing from bin on 5th cross",
                "description": "Dumpster full of waste spilling onto pavement and rotting stink on 5th cross road.",
                "category": "Sanitation & Solid Waste",
                "latitude": 12.9718,
                "longitude": 77.5948
            },
            {
                "id": "complaint-other-789",
                "title": "Fallen tree branch blocking walkway",
                "description": "Huge banyan tree branch cracked and blocked pedestrian path in park.",
                "category": "Parks & Urban Greenery",
                "latitude": 12.9352,
                "longitude": 77.6245
            }
        ],
        "similarity_threshold": 0.40,
        "geo_proximity_km": 0.5
    }
    response = client.post("/detect-duplicates", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_duplicate"] is True
    assert len(data["duplicates"]) >= 1
    assert data["duplicates"][0]["original_complaint_id"] == "complaint-old-456"

def test_cluster_hotspots():
    payload = {
        "complaints": [
            {
                "id": "c1",
                "title": "Burst water main",
                "category": "Water Supply & Sewage",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "priority": "High"
            },
            {
                "id": "c2",
                "title": "Low water pressure and dirty water",
                "category": "Water Supply & Sewage",
                "latitude": 12.9720,
                "longitude": 77.5950,
                "priority": "Medium"
            },
            {
                "id": "c3",
                "title": "Sewage backup in drains",
                "category": "Water Supply & Sewage",
                "latitude": 12.9718,
                "longitude": 77.5948,
                "priority": "High"
            }
        ],
        "radius_km": 1.0,
        "min_complaints": 2
    }
    response = client.post("/cluster-hotspots", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_clusters"] >= 1
    assert data["hotspots"][0]["dominant_category"] == "Water Supply & Sewage"
    assert data["hotspots"][0]["complaint_count"] == 3

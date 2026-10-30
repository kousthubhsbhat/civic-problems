import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ai_health():
    response = client.get("/ai/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Smart Civic Governance" in data["service"]

def test_ai_categorize_waterlogging():
    payload = {
        "title": "Water accumulation on main road",
        "description": "Continuous waterlogging near the junction for three days, pedestrians cannot cross the street.",
        "user_category": "Other"
    }
    response = client.post("/ai/categorize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_category"] == "Waterlogging"
    assert data["confidence_score"] > 0.5
    assert "confidence" in data["explanation"].lower()

def test_ai_summarize():
    payload = {
        "title": "Waterlogging on 5th avenue",
        "description": "There has been continuous water accumulation near the main road for three days. People are facing difficulties crossing the road, and vehicles are getting delayed.",
        "address": "5th Avenue, Sector 4"
    }
    response = client.post("/ai/summarize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "5th Avenue" in data["summary"]
    assert len(data["summary"]) > 10

def test_ai_detect_duplicates():
    payload = {
        "current_complaint": {
            "id": "c-101",
            "title": "Massive pothole causing tire damage",
            "description": "Deep asphalt crater on 8th main road damaging cars and bikes.",
            "category": "Road Damage",
            "latitude": 12.9716,
            "longitude": 77.5946
        },
        "existing_complaints": [
            {
                "id": "c-001",
                "title": "Deep pothole in 8th main",
                "description": "Large road crater on 8th main road right in front of baker store.",
                "category": "Road Damage",
                "latitude": 12.9718,
                "longitude": 77.5948
            },
            {
                "id": "c-002",
                "title": "Streetlight pole broken",
                "description": "Dark streetlight pole flickering continuously.",
                "category": "Streetlight Issues",
                "latitude": 12.9300,
                "longitude": 77.6200
            }
        ]
    }
    response = client.post("/ai/detect-duplicates", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_duplicate"] is True
    assert len(data["possible_duplicates"]) >= 1
    assert data["possible_duplicates"][0]["possible_duplicate_id"] == "c-001"

def test_ai_priority():
    payload = {
        "title": "Sparks flying from broken electrical transformer near hospital gate",
        "description": "Severe electrocution danger! Broken transformer pole sparking fire near emergency ward.",
        "category": "Public Safety",
        "address": "City Hospital Gate 2",
        "reported_count": 3
    }
    response = client.post("/ai/priority", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["priority_level"] in ["Critical", "High"]
    assert data["priority_score"] >= 70.0
    assert len(data["contributing_factors"]) >= 2
    assert "Critical Safety Risk" in [f["factor_name"] for f in data["contributing_factors"]]

def test_ai_cluster():
    payload = {
        "complaints": [
            {
                "id": "c-1",
                "title": "Clogged sewer line",
                "category": "Drainage Problems",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "priority": "High"
            },
            {
                "id": "c-2",
                "title": "Gutter overflow on pavement",
                "category": "Drainage Problems",
                "latitude": 12.9720,
                "longitude": 77.5949,
                "priority": "Medium"
            },
            {
                "id": "c-3",
                "title": "Sewage backup into homes",
                "category": "Drainage Problems",
                "latitude": 12.9718,
                "longitude": 77.5947,
                "priority": "High"
            }
        ],
        "eps_km": 0.8,
        "min_samples": 2
    }
    response = client.post("/ai/cluster", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_hotspots"] >= 1
    assert data["hotspots"][0]["most_common_category"] == "Drainage Problems"
    assert data["hotspots"][0]["complaint_count"] == 3

def test_ai_action_brief():
    payload = {
        "category": "Drainage Problems",
        "priority_level": "High",
        "complaint_count": 4,
        "location": "North Suburb Sector 7"
    }
    response = client.post("/ai/action-brief", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["recommended_department"] == "Drainage Problems"
    assert data["target_sla_hours"] <= 24
    assert len(data["recommended_equipment"]) > 0
    assert "Recommendation" in data["suggested_action_brief"]

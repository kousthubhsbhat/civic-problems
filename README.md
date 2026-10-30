# Smart Civic Governance Platform

An AI-powered municipal grievance resolution and civic intelligence platform built with **Supabase**, **Node.js/Express**, **Python FastAPI**, and a modern **React (Vite)** frontend.

---

## 🏛️ System Architecture

```
                  ┌────────────────────────────────────────┐
                  │          React Frontend (Vite)         │
                  │   Citizen • Officer • Admin Portals    │
                  └───────────────┬────────────────────────┘
                                  │ (REST + Supabase Auth Token)
                                  ▼
                  ┌────────────────────────────────────────┐
                  │          Node.js & Express API         │
                  │   Token Verification & Orchestration   │
                  └───┬───────────────────────────────┬────┘
                      │                               │
        (Internal AI Request)            (@supabase/supabase-js)
                      ▼                               ▼
       ┌─────────────────────────────┐  ┌─────────────────────────────┐
       │     Python FastAPI AI       │  │          SUPABASE           │
       │   • NLP Categorization      │  │  • PostgreSQL Database      │
       │   • Extractive Summary      │  │  • Supabase Auth (JWT)      │
       │   • Explainable Priority    │  │  • Storage (Images Bucket)  │
       │   • TF-IDF Duplicate Match  │  │  • Row Level Security (RLS) │
       │   • Geographic Clustering   │  └─────────────────────────────┘
       └─────────────────────────────┘
```

---

## 📦 Supabase Infrastructure (MANDATORY REQUIREMENT)

- **PostgreSQL Database**:
  - `profiles`: Linked to `auth.users`, role management (`citizen`, `department_officer`, `administrator`).
  - `complaints`: Citizen grievances, location coordinates, AI scores, status, and department routing.
  - `departments`: Standard civic municipal departments.
  - `complaint_history`: Audit trail tracking every status transition and official officer remark.
  - `complaint_duplicates`: Spatial and contextual duplicate complaint associations with similarity metrics.
  - `ai_insights`: Emergent geographic hotspot clusters and civic anomalies.
  - **Row Level Security (RLS)**: Enforces strict data segregation between Citizens, Officers, and Administrators.
- **Supabase Authentication**:
  - Native Email/Password signup, sign-in, session persistence, token refresh, and password reset.
  - Verified on backend with `supabase.auth.getUser(token)`. Never trusts unverified frontend user IDs.
- **Supabase Storage**:
  - Bucket: `civic-complaint-images`
  - Enforces 5MB size limit, validates JPEG/PNG/WEBP mimetypes, and generates collision-resistant unique file keys.
- **Empty State Guarantee**:
  - Zero fake complaints or default dashboard stats. The platform starts cleanly at 0 records and updates live from Supabase.

---

## 🚀 Getting Started

### 1. Database & Storage Initialization
Follow the step-by-step instructions in [`supabase/setup-instructions.md`](file:///c:/Users/KOUSTHUBH%20S%20BHAT/Documents/promptwar/supabase/setup-instructions.md) to apply [`supabase/schema.sql`](file:///c:/Users/KOUSTHUBH%20S%20BHAT/Documents/promptwar/supabase/schema.sql) and [`supabase/seed.sql`](file:///c:/Users/KOUSTHUBH%20S%20BHAT/Documents/promptwar/supabase/seed.sql).

### 2. Environment Variables Configuration
Copy all `.env.example` files to `.env` in the respective folders:
- `frontend/.env.example` ➔ `frontend/.env`
- `backend/.env.example` ➔ `backend/.env`
- `ai-service/.env.example` ➔ `ai-service/.env`

*(Service role key is kept strictly on the backend and NEVER exposed to the frontend).*

### 3. Launching Services

#### Python AI Microservice
```powershell
cd ai-service
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Node.js Backend API
```powershell
cd backend
npm.cmd run dev
```

#### React Frontend
```powershell
cd frontend
npm.cmd run dev
```

---

## 🧪 Verification & Test Suites

- **Python AI Microservice**:
  ```powershell
  cd ai-service
  python -m pytest tests/test_ai_service.py -v
  # 5/5 PASSED (Categorization, Summarization, Priority Scoring, Duplicates, Clustering)
  ```

- **Node.js Backend**:
  ```powershell
  cd backend
  npm.cmd test
  # 5/5 PASSED (Storage validation, 5MB limit, Health check, Auth route protection)
  ```

- **Frontend Compilation**:
  ```powershell
  cd frontend
  npm.cmd run build
  # Production bundle compiled cleanly in 2.6s with Vite
  ```

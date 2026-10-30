# Supabase Setup Guide for Smart Civic Governance Platform

This platform strictly requires **Supabase** for:
1. **PostgreSQL Database** (Tables: `profiles`, `complaints`, `departments`, `complaint_history`, `complaint_duplicates`, `ai_insights`)
2. **Supabase Authentication** (Email & Password registration, login, JWT token verification)
3. **Supabase Storage** (Bucket: `civic-complaint-images` for citizen photo uploads)
4. **Row Level Security (RLS)** (Strict data isolation between Citizens, Department Officers, and Administrators)

---

## Step 1: Run the Database Migrations

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Navigate to the **SQL Editor** tab from the left sidebar.
3. Open the file [`supabase/schema.sql`](./schema.sql) in this repository.
4. Copy its entire content, paste it into the Supabase SQL Editor, and click **RUN**.
   - This creates all required tables, triggers, auto-incrementing complaint number generator (`CIV-YYYYMMDD-XXXX`), RLS policies, indexes, and configures the `civic-complaint-images` storage bucket.

---

## Step 2: Seed Civic Reference Departments

1. In the Supabase **SQL Editor**, open [`supabase/seed.sql`](./seed.sql).
2. Copy and paste the script, then click **RUN**.
   - This seeds the 6 standard civic municipal departments:
     - *Roads & Infrastructure*
     - *Water Supply & Sewage*
     - *Sanitation & Solid Waste*
     - *Electricity & Public Lighting*
     - *Public Health & Safety*
     - *Parks & Urban Greenery*
3. **Note:** As required, NO fake complaints or default dashboard stats are populated. The dashboard starts empty and reflects actual database records submitted by users.

---

## Step 3: Storage Bucket Verification

1. Go to the **Storage** section in your Supabase Dashboard.
2. Confirm the bucket `civic-complaint-images` is listed.
3. The schema script automatically creates this bucket and configures RLS policies so authenticated citizens can upload photos and view resolution images.

---

## Step 4: Environment Variables Configuration

Copy the `.env.example` templates in each service directory to `.env` and fill in your Supabase credentials:

### 1. `frontend/.env`
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
VITE_BACKEND_URL=http://localhost:5000
```
> **Security Rule:** Never place the Supabase `service_role` key in frontend environment variables.

### 2. `backend/.env`
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-public-key
AI_SERVICE_URL=http://localhost:8000
PORT=5000
FRONTEND_URL=http://localhost:5173
```

### 3. `ai-service/.env`
```env
PORT=8000
AI_MODEL_PATH=
```

---

## Step 5: Start the Platform

### Terminal 1: Python AI Service
```bash
cd ai-service
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2: Node.js Backend API
```bash
cd backend
npm run dev
```

### Terminal 3: React Frontend Application
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

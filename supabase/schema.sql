-- ============================================================================
-- SMART CIVIC GOVERNANCE PLATFORM - SUPABASE SCHEMA & POLICIES
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS (Roles and Complaint Statuses)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('citizen', 'department_officer', 'administrator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_status AS ENUM ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. PROFILES TABLE (references Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'department_officer', 'administrator')),
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger to auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to auto-create profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role VARCHAR(50);
    user_name VARCHAR(255);
BEGIN
    default_role := COALESCE(NEW.raw_user_meta_data->>'role', 'citizen');
    -- Disallow non-admins from self-elevating to administrator via signup meta
    IF default_role NOT IN ('citizen', 'department_officer', 'administrator') THEN
        default_role := 'citizen';
    END IF;

    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

    INSERT INTO public.profiles (id, full_name, email, role, created_at, updated_at)
    VALUES (
        NEW.id,
        user_name,
        NEW.email,
        default_role,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- 4. COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_number VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    image_url TEXT,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    ai_category VARCHAR(100),
    ai_summary TEXT,
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    priority_score NUMERIC(5, 2) DEFAULT 50.00,
    priority_explanation TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected')),
    assigned_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS set_complaints_updated_at ON public.complaints;
CREATE TRIGGER set_complaints_updated_at
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto generate complaint_number sequence / trigger
CREATE OR REPLACE FUNCTION public.generate_complaint_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num TEXT;
BEGIN
    IF NEW.complaint_number IS NULL OR NEW.complaint_number = '' THEN
        seq_num := to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-' || upper(substr(NEW.id::text, 1, 8));
        NEW.complaint_number := 'CIV-' || seq_num;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_complaint_number ON public.complaints;
CREATE TRIGGER trg_generate_complaint_number
    BEFORE INSERT ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_complaint_number();


-- 5. COMPLAINT HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.complaint_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    remarks TEXT,
    updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);


-- 6. COMPLAINT DUPLICATES TABLE
CREATE TABLE IF NOT EXISTS public.complaint_duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    duplicate_complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5, 4) NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_complaint_pair UNIQUE (original_complaint_id, duplicate_complaint_id)
);


-- 7. AI INSIGHTS TABLE
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type VARCHAR(100) NOT NULL, -- 'Hotspot', 'Trend', 'Cluster', 'Anomaly'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),
    severity VARCHAR(50) NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    related_complaint_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);


-- 8. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON public.complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_department ON public.complaints(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_history_complaint_id ON public.complaint_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_duplicates_original ON public.complaint_duplicates(original_complaint_id);
CREATE INDEX IF NOT EXISTS idx_duplicates_duplicate ON public.complaint_duplicates(duplicate_complaint_id);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON public.ai_insights(created_at DESC);


-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS VARCHAR AS $$
    SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_department(user_id UUID)
RETURNS UUID AS $$
    SELECT department_id FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- --- DEPARTMENTS POLICIES ---
-- Any authenticated user can read departments
DROP POLICY IF EXISTS "Departments are readable by all authenticated users" ON public.departments;
CREATE POLICY "Departments are readable by all authenticated users"
    ON public.departments FOR SELECT
    TO authenticated
    USING (true);

-- Only administrators can insert/update/delete departments
DROP POLICY IF EXISTS "Admins can modify departments" ON public.departments;
CREATE POLICY "Admins can modify departments"
    ON public.departments FOR ALL
    TO authenticated
    USING (public.get_user_role(auth.uid()) = 'administrator')
    WITH CHECK (public.get_user_role(auth.uid()) = 'administrator');


-- --- PROFILES POLICIES ---
-- Users can view their own profile; admins can view all profiles; officers can view user profiles associated with complaints
DROP POLICY IF EXISTS "Users can view their own profile or Admins view all" ON public.profiles;
CREATE POLICY "Users can view their own profile or Admins view all"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id OR
        public.get_user_role(auth.uid()) IN ('administrator', 'department_officer')
    );

-- Users can update their own profile name, but CANNOT modify their role or department
DROP POLICY IF EXISTS "Users can update own profile name" ON public.profiles;
CREATE POLICY "Users can update own profile name"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    );

-- Admins can update any profile (e.g. assign role or department)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.get_user_role(auth.uid()) = 'administrator');


-- --- COMPLAINTS POLICIES ---
-- SELECT:
-- Citizens: Read their own complaint records
-- Officers: Read complaints assigned to their department or unassigned
-- Admins: Read all complaints
DROP POLICY IF EXISTS "Complaints select policy" ON public.complaints;
CREATE POLICY "Complaints select policy"
    ON public.complaints FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR
        public.get_user_role(auth.uid()) = 'administrator' OR
        (
            public.get_user_role(auth.uid()) = 'department_officer' AND
            (assigned_department_id IS NULL OR assigned_department_id = public.get_user_department(auth.uid()))
        )
    );

-- INSERT:
-- Citizens can submit complaints under their own authenticated account
-- Disallow citizens from tampering with priority, priority_score, status, or assigned department on insert
DROP POLICY IF EXISTS "Citizens can submit own complaints" ON public.complaints;
CREATE POLICY "Citizens can submit own complaints"
    ON public.complaints FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        status = 'Submitted'
    );

-- UPDATE:
-- Citizens cannot modify complaint status, administrative priorities, or department assignments
-- Officers can update status and remarks for complaints in their department
-- Admins can update any complaint field
DROP POLICY IF EXISTS "Complaints update policy" ON public.complaints;
CREATE POLICY "Complaints update policy"
    ON public.complaints FOR UPDATE
    TO authenticated
    USING (
        public.get_user_role(auth.uid()) = 'administrator' OR
        (
            public.get_user_role(auth.uid()) = 'department_officer' AND
            (assigned_department_id IS NULL OR assigned_department_id = public.get_user_department(auth.uid()))
        )
    )
    WITH CHECK (
        public.get_user_role(auth.uid()) = 'administrator' OR
        public.get_user_role(auth.uid()) = 'department_officer'
    );

-- DELETE:
-- Only administrators can delete complaints
DROP POLICY IF EXISTS "Only admins can delete complaints" ON public.complaints;
CREATE POLICY "Only admins can delete complaints"
    ON public.complaints FOR DELETE
    TO authenticated
    USING (public.get_user_role(auth.uid()) = 'administrator');


-- --- COMPLAINT HISTORY POLICIES ---
-- SELECT:
-- Visible if the user can read the parent complaint
DROP POLICY IF EXISTS "Complaint history readable by authorized complaint viewers" ON public.complaint_history;
CREATE POLICY "Complaint history readable by authorized complaint viewers"
    ON public.complaint_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_history.complaint_id AND (
                c.user_id = auth.uid() OR
                public.get_user_role(auth.uid()) = 'administrator' OR
                (
                    public.get_user_role(auth.uid()) = 'department_officer' AND
                    (c.assigned_department_id IS NULL OR c.assigned_department_id = public.get_user_department(auth.uid()))
                )
            )
        )
    );

-- INSERT:
-- Officers and admins can log history; system backend (service_role) can also log
DROP POLICY IF EXISTS "Officers and Admins can insert history" ON public.complaint_history;
CREATE POLICY "Officers and Admins can insert history"
    ON public.complaint_history FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = updated_by AND
        public.get_user_role(auth.uid()) IN ('administrator', 'department_officer')
    );


-- --- COMPLAINT DUPLICATES POLICIES ---
-- Read:
-- Admins and Officers can view duplicates; Citizens can see if their complaint has duplicates
DROP POLICY IF EXISTS "View duplicates policy" ON public.complaint_duplicates;
CREATE POLICY "View duplicates policy"
    ON public.complaint_duplicates FOR SELECT
    TO authenticated
    USING (
        public.get_user_role(auth.uid()) IN ('administrator', 'department_officer') OR
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE (c.id = complaint_duplicates.original_complaint_id OR c.id = complaint_duplicates.duplicate_complaint_id)
            AND c.user_id = auth.uid()
        )
    );


-- --- AI INSIGHTS POLICIES ---
-- Authenticated users (admins, officers, citizens) can view AI insights and hotspots
DROP POLICY IF EXISTS "AI insights readable by authenticated users" ON public.ai_insights;
CREATE POLICY "AI insights readable by authenticated users"
    ON public.ai_insights FOR SELECT
    TO authenticated
    USING (true);


-- ============================================================================
-- 10. STORAGE BUCKET CONFIGURATION & POLICIES
-- Bucket name: civic-complaint-images
-- ============================================================================

-- Ensure storage bucket exists (Supabase Storage schema)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'civic-complaint-images',
    'civic-complaint-images',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Storage RLS:
-- Authenticated users can upload images to civic-complaint-images
DROP POLICY IF EXISTS "Authenticated users can upload complaint images" ON storage.objects;
CREATE POLICY "Authenticated users can upload complaint images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'civic-complaint-images');

-- Public read access for complaint images
DROP POLICY IF EXISTS "Public can view complaint images" ON storage.objects;
CREATE POLICY "Public can view complaint images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'civic-complaint-images');

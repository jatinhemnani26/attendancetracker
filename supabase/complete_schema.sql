-- ==============================================================================
-- COMPLETE ATTENDANCE TRACKER & CAMPUS GIS DATABASE SCHEMA (BYODB)
-- ==============================================================================
-- Run this entire script in your Supabase SQL Editor if you are using your own
-- Supabase project (BYODB - Bring Your Own Database).
-- It provisions all tables, constraints, foreign keys, and Row Level Security (RLS).
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    college_name TEXT,
    default_target_threshold INTEGER DEFAULT 75,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Academic Semesters Table
CREATE TABLE IF NOT EXISTS public.academic_semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Timetable Versions Table
CREATE TABLE IF NOT EXISTS public.timetable_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    semester_id UUID REFERENCES public.academic_semesters(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
    semester_id UUID REFERENCES public.academic_semesters(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    color TEXT NOT NULL,
    target_threshold INTEGER NOT NULL DEFAULT 75,
    credits INTEGER DEFAULT 1,
    teachers TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Timetable Slots Table
CREATE TABLE IF NOT EXISTS public.timetable_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
    semester_id UUID REFERENCES public.academic_semesters(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    version_id UUID REFERENCES public.timetable_versions(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday... 6=Saturday
    start_time TEXT NOT NULL,     -- "09:00"
    end_time TEXT NOT NULL,       -- "10:00"
    room_number TEXT,
    class_type TEXT DEFAULT 'theory' CHECK (class_type IN ('theory', 'lab', 'tutorial')),
    default_teacher TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL, -- "2026-07-20"
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'cancelled', 'holiday')),
    ist_start_time TEXT,
    ist_end_time TEXT,
    duration_minutes INTEGER,
    teacher_name TEXT,
    class_type TEXT DEFAULT 'theory' CHECK (class_type IN ('theory', 'lab', 'tutorial')),
    rating NUMERIC(3,1) CHECK (rating >= 0.0 AND rating <= 10.0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Holidays Table
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.academic_semesters(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('holiday', 'exam', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Academic Tasks Table
CREATE TABLE IF NOT EXISTS public.academic_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    task_type TEXT CHECK (task_type IN ('assignment', 'exam', 'quiz')),
    priority TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Campus Wayfinding Tables
CREATE TABLE IF NOT EXISTS public.campus_buildings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.campus_floors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    building_id UUID REFERENCES public.campus_buildings(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    floor_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.campus_nodes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    floor_id UUID REFERENCES public.campus_floors(id) ON DELETE CASCADE,
    node_name TEXT NOT NULL,
    node_type TEXT,
    x_coord NUMERIC NOT NULL,
    y_coord NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.campus_edges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_node_id UUID REFERENCES public.campus_nodes(id) ON DELETE CASCADE,
    to_node_id UUID REFERENCES public.campus_nodes(id) ON DELETE CASCADE,
    weight NUMERIC DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_subjects_semester ON public.subjects(semester_id);
CREATE INDEX IF NOT EXISTS idx_slots_semester ON public.timetable_slots(semester_id);
CREATE INDEX IF NOT EXISTS idx_slots_subject ON public.timetable_slots(subject_id);
CREATE INDEX IF NOT EXISTS idx_records_subject ON public.attendance_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON public.attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_holidays_semester ON public.holidays(semester_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.academic_tasks(user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures each student can only view, insert, and modify their own data.
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_edges ENABLE ROW LEVEL SECURITY;

-- User Policies
DROP POLICY IF EXISTS "Users access own profile" ON public.profiles;
CREATE POLICY "Users access own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users access own semesters" ON public.academic_semesters;
CREATE POLICY "Users access own semesters" ON public.academic_semesters FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access own timetable versions" ON public.timetable_versions;
CREATE POLICY "Users access own timetable versions" ON public.timetable_versions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access own subjects" ON public.subjects;
CREATE POLICY "Users access own subjects" ON public.subjects FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access own timetable" ON public.timetable_slots;
CREATE POLICY "Users access own timetable" ON public.timetable_slots FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access own records" ON public.attendance_records;
CREATE POLICY "Users access own records" ON public.attendance_records FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own holidays" ON public.holidays;
CREATE POLICY "Users can manage their own holidays" ON public.holidays FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.academic_tasks;
CREATE POLICY "Users can manage their own tasks" ON public.academic_tasks FOR ALL USING (auth.uid() = user_id);

-- Campus Policies (Publicly readable for wayfinding)
DROP POLICY IF EXISTS "Public can read buildings" ON public.campus_buildings;
CREATE POLICY "Public can read buildings" ON public.campus_buildings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can read floors" ON public.campus_floors;
CREATE POLICY "Public can read floors" ON public.campus_floors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can read nodes" ON public.campus_nodes;
CREATE POLICY "Public can read nodes" ON public.campus_nodes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can read edges" ON public.campus_edges;
CREATE POLICY "Public can read edges" ON public.campus_edges FOR SELECT USING (true);

-- User auto-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

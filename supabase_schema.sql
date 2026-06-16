-- ============================================================
-- FilmLog Pro — Supabase Schema with Row Level Security (RLS)
-- ============================================================
-- Run this in the Supabase SQL Editor to set up the database.
-- Each table has RLS enabled so users can only access their own data.
-- ============================================================

-- 1. film_records
CREATE TABLE IF NOT EXISTS public.film_records (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.film_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own film records"
    ON public.film_records FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own film records"
    ON public.film_records FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own film records"
    ON public.film_records FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own film records"
    ON public.film_records FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_film_records_user_id ON public.film_records(user_id);


-- 2. dev_recipes
CREATE TABLE IF NOT EXISTS public.dev_recipes (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.dev_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dev recipes"
    ON public.dev_recipes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dev recipes"
    ON public.dev_recipes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dev recipes"
    ON public.dev_recipes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dev recipes"
    ON public.dev_recipes FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dev_recipes_user_id ON public.dev_recipes(user_id);


-- 3. reciprocity_profiles
CREATE TABLE IF NOT EXISTS public.reciprocity_profiles (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.reciprocity_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reciprocity profiles"
    ON public.reciprocity_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reciprocity profiles"
    ON public.reciprocity_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reciprocity profiles"
    ON public.reciprocity_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reciprocity profiles"
    ON public.reciprocity_profiles FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reciprocity_profiles_user_id ON public.reciprocity_profiles(user_id);

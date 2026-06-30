-- Migration: fix score constraints (1-5 → 1-10) + create habits tables
-- Applied: 2026-04-10

-- 1. Corrigir constraints de score: 1-5 → 1-10
ALTER TABLE public.daily_checkins
  DROP CONSTRAINT IF EXISTS daily_checkins_mood_score_check,
  DROP CONSTRAINT IF EXISTS daily_checkins_energy_score_check,
  DROP CONSTRAINT IF EXISTS daily_checkins_clarity_score_check,
  DROP CONSTRAINT IF EXISTS daily_checkins_irritability_score_check,
  DROP CONSTRAINT IF EXISTS daily_checkins_physical_score_check,
  DROP CONSTRAINT IF EXISTS daily_checkins_social_score_check;

ALTER TABLE public.daily_checkins
  ADD CONSTRAINT daily_checkins_mood_score_check CHECK (mood_score >= 1 AND mood_score <= 10),
  ADD CONSTRAINT daily_checkins_energy_score_check CHECK (energy_score >= 1 AND energy_score <= 10),
  ADD CONSTRAINT daily_checkins_clarity_score_check CHECK (clarity_score >= 1 AND clarity_score <= 10),
  ADD CONSTRAINT daily_checkins_irritability_score_check CHECK (irritability_score >= 1 AND irritability_score <= 10),
  ADD CONSTRAINT daily_checkins_physical_score_check CHECK (physical_score >= 1 AND physical_score <= 10),
  ADD CONSTRAINT daily_checkins_social_score_check CHECK (social_score >= 1 AND social_score <= 10);

-- 2. Tabela habits
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  icon TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  target_days INT[] NOT NULL DEFAULT '{}',
  time_of_day TEXT,
  duration_minutes INT,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_time TEXT,
  streak_count INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  total_completions INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela habit_completions
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  mood_before INT,
  mood_after INT,
  UNIQUE(habit_id, date)
);

-- 4. RLS
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS habits_own ON public.habits;
CREATE POLICY habits_own ON public.habits FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS habit_completions_own ON public.habit_completions;
CREATE POLICY habit_completions_own ON public.habit_completions
  FOR ALL USING (habit_id IN (SELECT id FROM public.habits WHERE user_id = auth.uid()));

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_habits_updated_at ON public.habits;
CREATE TRIGGER set_habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

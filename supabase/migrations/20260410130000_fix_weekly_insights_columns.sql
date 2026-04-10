-- Migration: add missing columns to weekly_insights
-- Applied: 2026-04-10

ALTER TABLE public.weekly_insights
  ADD COLUMN IF NOT EXISTS best_day TEXT,
  ADD COLUMN IF NOT EXISTS worst_day TEXT,
  ADD COLUMN IF NOT EXISTS avg_mood DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avg_energy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Trigger para updated_at (reutiliza a função já criada)
DROP TRIGGER IF EXISTS set_weekly_insights_updated_at ON public.weekly_insights;
CREATE TRIGGER set_weekly_insights_updated_at
  BEFORE UPDATE ON public.weekly_insights
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Notas do workspace de Objetivos (split Elisi). JSON na própria tabela:
-- sem tabela nova, RLS existente de objectives continua valendo.
alter table public.objectives
  add column if not exists notes jsonb not null default '[]'::jsonb;

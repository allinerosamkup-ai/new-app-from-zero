-- Aura chat and canonical memory are legitimate memory sources used by the
-- current backend. Older databases retained a restrictive legacy check.
do $$
begin
  if to_regclass('public.memory_embeddings') is not null then
    alter table public.memory_embeddings
      drop constraint if exists memory_embeddings_content_type_check;

    alter table public.memory_embeddings
      add constraint memory_embeddings_content_type_check
      check (content_type in ('journal', 'checkin_note', 'goal', 'insight', 'aura', 'canonical'));
  end if;
end
$$;

-- A natural-language check-in can faithfully record the three core signals
-- without inventing an irritability score the user did not provide.
alter table if exists public.daily_checkins
  alter column irritability_score drop not null;

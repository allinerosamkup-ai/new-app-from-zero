-- This migration predates creation of memory_embeddings in a clean install.
-- PostgreSQL's `drop policy if exists ... on relation` still errors when the
-- relation itself is absent, so the whole policy operation must be guarded.
do $$
begin
  if to_regclass('public.memory_embeddings') is not null then
    execute 'alter table public.memory_embeddings enable row level security';
    execute 'drop policy if exists "memory_embeddings_manage_own" on public.memory_embeddings';
    execute 'create policy "memory_embeddings_manage_own" on public.memory_embeddings for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

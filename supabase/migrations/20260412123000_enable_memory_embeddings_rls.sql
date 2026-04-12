alter table if exists public.memory_embeddings enable row level security;

drop policy if exists "memory_embeddings_manage_own" on public.memory_embeddings;
create policy "memory_embeddings_manage_own"
  on public.memory_embeddings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

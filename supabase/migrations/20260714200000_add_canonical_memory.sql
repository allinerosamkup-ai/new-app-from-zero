create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null,
  content_id text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_memory_embeddings_user on public.memory_embeddings(user_id);
alter table public.memory_embeddings enable row level security;
drop policy if exists "memory_embeddings_manage_own" on public.memory_embeddings;
create policy "memory_embeddings_manage_own" on public.memory_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('fact','pattern','preference','decision','context')),
  scope text not null,
  canonical_key text not null,
  content text not null,
  structured_value jsonb not null default '{}'::jsonb,
  confidence double precision not null default 0.5 check (confidence between 0 and 1),
  salience double precision not null default 0.5 check (salience between 0 and 1),
  lifecycle text not null default 'active' check (lifecycle in ('active','superseded','expired','retracted')),
  locale text not null default 'pt-BR',
  action_authority text not null default 'none' check (action_authority = 'none'),
  negative_state text check (negative_state is null or negative_state in ('completed','rejected','deleted','scheduled')),
  target_type text,
  target_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  valid_until timestamptz,
  superseded_by uuid references public.user_memories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, user_id)
);

create table if not exists public.user_memory_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  memory_id uuid not null,
  source text not null,
  source_id text,
  observed_at timestamptz not null,
  statement text not null,
  metrics jsonb not null default '{}'::jsonb,
  hash text not null,
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  unique(memory_id, hash),
  constraint user_memory_evidence_memory_owner_fk foreign key (memory_id, user_id)
    references public.user_memories(id, user_id) on delete cascade
);

create unique index if not exists ux_user_memories_active_key
  on public.user_memories(user_id, canonical_key, locale)
  where lifecycle = 'active';
create index if not exists idx_user_memories_retrieval on public.user_memories(user_id, lifecycle, kind, scope);
create index if not exists idx_user_memories_negative on public.user_memories(user_id, target_type, target_id, negative_state);
create index if not exists idx_user_memory_evidence_recent on public.user_memory_evidence(user_id, observed_at desc);

alter table public.memory_embeddings add column if not exists memory_id uuid references public.user_memories(id) on delete cascade;
create index if not exists idx_memory_embeddings_memory_id on public.memory_embeddings(memory_id);

-- Preserve the existing RAG corpus. Every legacy vector receives a canonical,
-- context-only owner before canonical retrieval becomes the default.
insert into public.user_memories (
  user_id, kind, scope, canonical_key, content, structured_value,
  confidence, salience, lifecycle, locale, action_authority,
  first_seen_at, last_seen_at
)
select
  embedding.user_id,
  'context',
  'legacy.rag',
  'legacy.rag.' || coalesce(nullif(embedding.content_id, ''), encode(digest(embedding.content, 'sha256'), 'hex')),
  embedding.content,
  jsonb_build_object('legacyEmbeddingId', embedding.id, 'legacyContentType', embedding.content_type),
  0.55,
  0.4,
  'active',
  coalesce(nullif(embedding.metadata->>'locale', ''), 'und'),
  'none',
  embedding.created_at,
  embedding.created_at
from public.memory_embeddings embedding
where embedding.memory_id is null
on conflict (user_id, canonical_key, locale) where lifecycle = 'active' do nothing;

update public.memory_embeddings embedding
set memory_id = memory.id
from public.user_memories memory
where embedding.memory_id is null
  and memory.user_id = embedding.user_id
  and memory.scope = 'legacy.rag'
  and memory.canonical_key = 'legacy.rag.' || coalesce(nullif(embedding.content_id, ''), encode(digest(embedding.content, 'sha256'), 'hex'))
  and memory.locale = coalesce(nullif(embedding.metadata->>'locale', ''), 'und')
  and memory.lifecycle = 'active';

insert into public.user_memory_evidence (
  user_id, memory_id, source, source_id, observed_at, statement, metrics, hash, locale
)
select
  embedding.user_id,
  embedding.memory_id,
  'legacy_rag',
  embedding.id::text,
  embedding.created_at,
  embedding.content,
  jsonb_build_object('contentType', embedding.content_type),
  encode(digest('legacy_rag|' || embedding.id::text || '|' || embedding.content, 'sha256'), 'hex'),
  coalesce(nullif(embedding.metadata->>'locale', ''), 'und')
from public.memory_embeddings embedding
where embedding.memory_id is not null
on conflict (memory_id, hash) do nothing;

create or replace function public.match_user_memories(
  query_user_id uuid,
  query_embedding vector(1536),
  match_count integer default 8,
  match_threshold double precision default 0.68
)
returns table (
  memory_id uuid,
  content_id text,
  content_type text,
  content text,
  metadata jsonb,
  similarity double precision,
  created_at timestamptz
)
language sql stable security invoker
as $$
  select
    me.memory_id,
    me.content_id,
    me.content_type,
    me.content,
    me.metadata,
    1 - (me.embedding <=> query_embedding) as similarity,
    me.created_at
  from public.memory_embeddings me
  join public.user_memories um on um.id = me.memory_id and um.user_id = me.user_id
  where me.user_id = query_user_id
    and me.memory_id is not null
    and um.lifecycle = 'active'
    and (um.valid_until is null or um.valid_until >= now())
    and 1 - (me.embedding <=> query_embedding) >= match_threshold
  order by me.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

alter table public.user_memories enable row level security;
alter table public.user_memory_evidence enable row level security;
drop policy if exists "user_memories_manage_own" on public.user_memories;
create policy "user_memories_manage_own" on public.user_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_memory_evidence_manage_own" on public.user_memory_evidence;
create policy "user_memory_evidence_manage_own" on public.user_memory_evidence
  for all
  using (exists (
    select 1 from public.user_memories memory
    where memory.id = memory_id and memory.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.user_memories memory
    where memory.id = memory_id and memory.user_id = auth.uid()
  ));

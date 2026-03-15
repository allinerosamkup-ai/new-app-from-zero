create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  support_goals text[] not null default '{}'::text[],
  age integer,
  current_feeling text,
  sleep_quality_note text,
  routine_text text,
  routine_summary text,
  main_energy_pressure text,
  primary_goal text,
  context_notes text,
  ai_profile_summary text,
  ai_routine_summary text,
  ai_initial_state_summary text,
  ai_top_themes text[] not null default '{}'::text[],
  ai_initial_suggestions text[] not null default '{}'::text[],
  ai_profile_payload jsonb,
  version text not null default 'v1',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  wake_time text,
  sleep_time text,
  morning_checkin_time text,
  evening_review_time text,
  notifications_on boolean not null default true,
  ai_tone text not null default 'warm',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  version text not null default 'v1',
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint consents_user_type_version_key unique (user_id, consent_type, version)
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  checkin_slot text not null,
  mood_score integer not null check (mood_score between 1 and 5),
  energy_score integer not null check (energy_score between 1 and 5),
  clarity_score integer not null check (clarity_score between 1 and 5),
  irritability_score integer not null check (irritability_score between 1 and 5),
  physical_score integer not null check (physical_score between 1 and 5),
  social_score integer not null check (social_score between 1 and 5),
  note text,
  state_label text,
  state_label_type text,
  state_summary text,
  ai_state jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_checkins_user_date_slot_key unique (user_id, local_date, checkin_slot),
  constraint daily_checkins_slot_check check (checkin_slot in ('morning', 'midday', 'evening'))
);

create table if not exists public.journal_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  status text not null default 'active',
  summary text,
  emotions text[] not null default '{}'::text[],
  themes text[] not null default '{}'::text[],
  suggestions text[] not null default '{}'::text[],
  raw_text_hash text,
  started_at timestamptz not null default timezone('utc', now()),
  finalized_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.journal_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.journal_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  content text not null,
  order_index integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint journal_messages_session_order_key unique (session_id, order_index)
);

create table if not exists public.timeline_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  title text not null,
  category text not null,
  intensity text not null,
  status text not null default 'planned',
  is_ai_suggested boolean not null default false,
  ai_reasoning text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint timeline_blocks_time_range_check check (end_at > start_at)
);

create table if not exists public.weekly_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  avg_mood double precision,
  avg_energy double precision,
  checkin_count integer not null default 0,
  insights jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint weekly_insights_user_week_key unique (user_id, week_start)
);

create index if not exists consents_user_id_consent_type_idx
  on public.consents (user_id, consent_type);

create index if not exists daily_checkins_user_id_local_date_idx
  on public.daily_checkins (user_id, local_date);

create index if not exists daily_checkins_user_id_local_date_recorded_at_idx
  on public.daily_checkins (user_id, local_date, recorded_at desc);

create index if not exists journal_sessions_user_id_local_date_idx
  on public.journal_sessions (user_id, local_date);

create index if not exists journal_sessions_user_id_status_idx
  on public.journal_sessions (user_id, status);

create index if not exists journal_messages_user_id_created_at_idx
  on public.journal_messages (user_id, created_at desc);

create index if not exists timeline_blocks_user_id_local_date_idx
  on public.timeline_blocks (user_id, local_date);

create index if not exists timeline_blocks_user_id_local_date_start_at_idx
  on public.timeline_blocks (user_id, local_date, start_at);

create index if not exists weekly_insights_user_id_week_start_idx
  on public.weekly_insights (user_id, week_start);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_onboarding_responses_updated_at on public.onboarding_responses;
create trigger set_onboarding_responses_updated_at
  before update on public.onboarding_responses
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_consents_updated_at on public.consents;
create trigger set_consents_updated_at
  before update on public.consents
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_daily_checkins_updated_at on public.daily_checkins;
create trigger set_daily_checkins_updated_at
  before update on public.daily_checkins
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_journal_sessions_updated_at on public.journal_sessions;
create trigger set_journal_sessions_updated_at
  before update on public.journal_sessions
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_timeline_blocks_updated_at on public.timeline_blocks;
create trigger set_timeline_blocks_updated_at
  before update on public.timeline_blocks
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_weekly_insights_updated_at on public.weekly_insights;
create trigger set_weekly_insights_updated_at
  before update on public.weekly_insights
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.onboarding_responses enable row level security;
alter table public.user_preferences enable row level security;
alter table public.consents enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.journal_sessions enable row level security;
alter table public.journal_messages enable row level security;
alter table public.timeline_blocks enable row level security;
alter table public.weekly_insights enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles
  for delete
  using (auth.uid() = id);

drop policy if exists "onboarding_responses_manage_own" on public.onboarding_responses;
create policy "onboarding_responses_manage_own"
  on public.onboarding_responses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_preferences_manage_own" on public.user_preferences;
create policy "user_preferences_manage_own"
  on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "consents_manage_own" on public.consents;
create policy "consents_manage_own"
  on public.consents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daily_checkins_manage_own" on public.daily_checkins;
create policy "daily_checkins_manage_own"
  on public.daily_checkins
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "journal_sessions_manage_own" on public.journal_sessions;
create policy "journal_sessions_manage_own"
  on public.journal_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "journal_messages_manage_own" on public.journal_messages;
create policy "journal_messages_manage_own"
  on public.journal_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "timeline_blocks_manage_own" on public.timeline_blocks;
create policy "timeline_blocks_manage_own"
  on public.timeline_blocks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "weekly_insights_manage_own" on public.weekly_insights;
create policy "weekly_insights_manage_own"
  on public.weekly_insights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

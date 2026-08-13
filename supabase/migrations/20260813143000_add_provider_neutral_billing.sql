alter table public.billing_accounts
  add column if not exists billing_provider text,
  add column if not exists external_customer_id text,
  add column if not exists external_subscription_id text,
  add column if not exists external_order_id text,
  add column if not exists external_offer_id text;

create index if not exists idx_billing_accounts_provider_subscription
  on public.billing_accounts(billing_provider, external_subscription_id)
  where external_subscription_id is not null;

create table if not exists public.billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  plan text not null,
  offer_id text not null,
  attempt_key text not null,
  status text not null default 'pending',
  order_id text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_checkout_attempts
  add column if not exists public_token uuid,
  add column if not exists user_id uuid,
  add column if not exists provider text,
  add column if not exists plan text,
  add column if not exists offer_id text,
  add column if not exists attempt_key text,
  add column if not exists status text default 'pending',
  add column if not exists order_id text,
  add column if not exists expires_at timestamptz,
  add column if not exists consumed_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists uq_billing_checkout_attempts_public_token
  on public.billing_checkout_attempts(public_token);
create unique index if not exists uq_billing_checkout_attempts_user_provider_key
  on public.billing_checkout_attempts(user_id, provider, attempt_key);
create index if not exists idx_billing_checkout_attempts_user_created
  on public.billing_checkout_attempts(user_id, created_at desc);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  result text,
  processed_at timestamptz not null default now(),
  unique(provider, event_id)
);

alter table public.billing_webhook_events
  add column if not exists provider text,
  add column if not exists event_id text,
  add column if not exists event_type text,
  add column if not exists result text,
  add column if not exists processed_at timestamptz default now();

create unique index if not exists uq_billing_webhook_events_provider_event
  on public.billing_webhook_events(provider, event_id);

alter table public.billing_checkout_attempts enable row level security;
alter table public.billing_webhook_events enable row level security;

revoke all on table public.billing_checkout_attempts from public;
revoke all on table public.billing_checkout_attempts from anon, authenticated;
revoke all on table public.billing_webhook_events from public;
revoke all on table public.billing_webhook_events from anon, authenticated;

grant select, insert, update, delete on table public.billing_checkout_attempts to service_role;
grant select, insert, update, delete on table public.billing_webhook_events to service_role;

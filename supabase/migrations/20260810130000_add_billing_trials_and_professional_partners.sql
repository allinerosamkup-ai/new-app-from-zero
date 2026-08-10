create table if not exists public.billing_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_plan text,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_billing_accounts_stripe_customer_id
  on public.billing_accounts(stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists uq_billing_accounts_stripe_subscription_id
  on public.billing_accounts(stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.professional_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  professional_name text not null,
  crp_region text not null,
  crp_number text not null,
  verification_status text not null default 'pending',
  verification_note text,
  verified_at timestamptz,
  last_verified_at timestamptz,
  referral_code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_professional_partners_crp unique (crp_region, crp_number),
  constraint professional_partners_verification_status_check
    check (verification_status in ('pending', 'verified', 'rejected', 'review_required', 'suspended'))
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null unique references public.profiles(id) on delete cascade,
  professional_partner_id uuid not null references public.professional_partners(id) on delete restrict,
  referral_code text not null,
  benefit_days integer not null default 14,
  claimed_at timestamptz not null default now(),
  converted_at timestamptz,
  constraint referral_attributions_benefit_days_positive check (benefit_days > 0)
);

create index if not exists idx_referral_attributions_partner_claimed
  on public.referral_attributions(professional_partner_id, claimed_at desc);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  result text,
  processed_at timestamptz not null default now()
);

create unique index if not exists uq_stripe_webhook_events_stripe_event_id
  on public.stripe_webhook_events(stripe_event_id);

drop trigger if exists set_billing_accounts_updated_at on public.billing_accounts;
create trigger set_billing_accounts_updated_at
before update on public.billing_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_professional_partners_updated_at on public.professional_partners;
create trigger set_professional_partners_updated_at
before update on public.professional_partners
for each row execute function public.set_updated_at();

alter table public.billing_accounts enable row level security;
alter table public.professional_partners enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists billing_accounts_select_own on public.billing_accounts;
create policy billing_accounts_select_own on public.billing_accounts
  for select using (auth.uid() = user_id);

drop policy if exists professional_partners_select_own on public.professional_partners;
create policy professional_partners_select_own on public.professional_partners
  for select using (auth.uid() = user_id);

drop policy if exists referral_attributions_select_own on public.referral_attributions;
create policy referral_attributions_select_own on public.referral_attributions
  for select using (auth.uid() = referred_user_id);

revoke all on table public.billing_accounts from public, anon, authenticated;
revoke all on table public.professional_partners from public, anon, authenticated;
revoke all on table public.referral_attributions from public, anon, authenticated;
revoke all on table public.stripe_webhook_events from public;
revoke all on table public.stripe_webhook_events from anon, authenticated;

grant select on table public.billing_accounts to authenticated;
grant select on table public.professional_partners to authenticated;
grant select on table public.referral_attributions to authenticated;
grant select, insert, update, delete on table public.billing_accounts to service_role;
grant select, insert, update, delete on table public.professional_partners to service_role;
grant select, insert, update, delete on table public.referral_attributions to service_role;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;

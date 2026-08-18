-- Endurece estruturas internas sem mudar o contrato do backend de serviço.
-- As quatro tabelas já tinham RLS sem políticas (negação implícita); as políticas
-- restritivas tornam essa intenção explícita e preservam o mesmo comportamento
-- para clientes anon/authenticated. O service_role continua a operar por bypass.
alter table if exists public.billing_checkout_attempts enable row level security;
drop policy if exists "billing_checkout_attempts_deny_direct_access" on public.billing_checkout_attempts;
create policy "billing_checkout_attempts_deny_direct_access"
  on public.billing_checkout_attempts
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table if exists public.billing_webhook_events enable row level security;
drop policy if exists "billing_webhook_events_deny_direct_access" on public.billing_webhook_events;
create policy "billing_webhook_events_deny_direct_access"
  on public.billing_webhook_events
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table if exists public.stripe_webhook_events enable row level security;
drop policy if exists "stripe_webhook_events_deny_direct_access" on public.stripe_webhook_events;
create policy "stripe_webhook_events_deny_direct_access"
  on public.stripe_webhook_events
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table if exists public.objective_action_recovery_claims enable row level security;
drop policy if exists "objective_action_recovery_claims_deny_direct_access" on public.objective_action_recovery_claims;
create policy "objective_action_recovery_claims_deny_direct_access"
  on public.objective_action_recovery_claims
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Views de dados pessoais devem avaliar privilégios e RLS de quem consulta,
-- não do proprietário da view. As funções de backend continuam usando suas
-- permissões próprias, mas o endpoint REST não recebe mais esse privilégio.
alter view if exists public.v_user_energy_by_weekday set (security_invoker = true);
alter view if exists public.v_user_crash_history set (security_invoker = true);
alter view if exists public.v_user_best_days set (security_invoker = true);
alter view if exists public.v_user_recurring_themes set (security_invoker = true);
alter view if exists public.current_day_state set (security_invoker = true);

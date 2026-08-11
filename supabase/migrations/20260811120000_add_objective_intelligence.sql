alter table public.objectives
  add column if not exists deadline date,
  add column if not exists paused_at timestamptz,
  add column if not exists result_definition text,
  add column if not exists current_reality text,
  add column if not exists milestones jsonb not null default '[]'::jsonb,
  add column if not exists path_version integer not null default 1,
  add column if not exists path_proposal jsonb,
  add column if not exists path_proposal_created_at timestamptz,
  add column if not exists path_status text not null default 'not_started',
  add column if not exists path_question text;

create index if not exists idx_objectives_focus
  on public.objectives (user_id, paused_at, deadline);

-- Objetivos antigos mantêm suas ações planas e ganham somente o invólucro de
-- etapa. Não há regeneração de IA nem alteração do histórico.
update public.objectives
set milestones = jsonb_build_array(jsonb_build_object(
      'id', 'legacy-current',
      'title', 'Caminho atual',
      'order', 0,
      'doneWhen', coalesce(result_definition, title),
      'actions', '[]'::jsonb
    )),
    path_status = 'ready'
where jsonb_typeof(subgoals) = 'array'
  and jsonb_array_length(subgoals) > 0
  and milestones = '[]'::jsonb;

alter table public.user_preferences
  add column if not exists primary_objective_id uuid;

update public.user_preferences
set notification_preferences = jsonb_set(
  jsonb_set(coalesce(notification_preferences, '{}'::jsonb), '{planner}', 'false'::jsonb),
  '{habits}', 'false'::jsonb
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_primary_objective_id_fkey'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_primary_objective_id_fkey
      foreign key (primary_objective_id) references public.objectives(id) on delete set null;
  end if;
end $$;

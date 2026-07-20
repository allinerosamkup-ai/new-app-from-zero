alter table if exists public.timeline_blocks
  add column if not exists adaptability_source text not null default 'default',
  add column if not exists adaptability_confidence double precision not null default 0.5;

update public.timeline_blocks
set temporal_policy = 'fixed', adaptation_permission = 'protected',
    adaptability_source = 'gcal', adaptability_confidence = 1
where gcal_event_id is not null;

update public.timeline_blocks
set temporal_policy = 'windowed', adaptation_permission = 'preview',
    adaptability_source = 'recurrence', adaptability_confidence = 0.7
where adaptability_source = 'default'
  and lower(coalesce(recurring->>'enabled', 'false')) = 'true';

update public.timeline_blocks
set temporal_policy = 'flexible', adaptation_permission = 'eligible',
    adaptability_source = 'ai', adaptability_confidence = 0.9
where adaptability_source = 'default' and is_ai_suggested = true;

update public.timeline_blocks
set temporal_policy = 'windowed', adaptation_permission = 'preview',
    adaptability_source = 'language', adaptability_confidence = 0.68
where adaptability_source = 'default'
  and title ~* '(^|[^[:alnum:]_])(reuni[aã]o|consulta|m[eé]dic[oa]|dentista|terapia|entrevista|aula|curso|plant[aã]o|turno|expediente|trabalho|atendimento|voo|viagem|appointment|meeting|class|shift|office|work)([^[:alnum:]_]|$)';

update public.timeline_blocks
set temporal_policy = 'windowed', adaptation_permission = 'preview',
    adaptability_confidence = 0.55
where adaptability_source = 'default';

alter table if exists public.timeline_blocks
  drop constraint if exists timeline_blocks_adaptability_source_check;

alter table if exists public.timeline_blocks
  add constraint timeline_blocks_adaptability_source_check
  check (adaptability_source in ('default', 'manual', 'gcal', 'recurrence', 'language', 'behavior', 'memory', 'ai'));

alter table if exists public.timeline_blocks
  drop constraint if exists timeline_blocks_adaptability_confidence_check;

alter table if exists public.timeline_blocks
  add constraint timeline_blocks_adaptability_confidence_check
  check (adaptability_confidence >= 0 and adaptability_confidence <= 1);

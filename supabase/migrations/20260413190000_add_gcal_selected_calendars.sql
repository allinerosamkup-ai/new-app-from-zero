alter table public.user_preferences
  add column if not exists gcal_selected_calendars jsonb;

update public.user_preferences
set gcal_selected_calendars = '[]'::jsonb
where gcal_selected_calendars is null;

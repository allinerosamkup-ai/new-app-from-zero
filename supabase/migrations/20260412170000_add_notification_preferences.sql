alter table if exists public.user_preferences
  add column if not exists notification_preferences jsonb not null default
  '{
    "checkin": true,
    "journal": true,
    "planner": true,
    "habits": true,
    "persistent": true,
    "aiSuggestions": true,
    "journalMorningTime": "11:00",
    "journalEveningTime": "19:00"
  }'::jsonb;

update public.user_preferences
set notification_preferences = jsonb_build_object(
  'checkin', coalesce(notifications_on, true),
  'journal', coalesce((notification_preferences ->> 'journal')::boolean, true),
  'planner', coalesce((notification_preferences ->> 'planner')::boolean, true),
  'habits', coalesce((notification_preferences ->> 'habits')::boolean, true),
  'persistent', coalesce((notification_preferences ->> 'persistent')::boolean, true),
  'aiSuggestions', coalesce((notification_preferences ->> 'aiSuggestions')::boolean, true),
  'journalMorningTime', coalesce(notification_preferences ->> 'journalMorningTime', '11:00'),
  'journalEveningTime', coalesce(notification_preferences ->> 'journalEveningTime', '19:00')
)
where notification_preferences is null
  or notification_preferences = '{}'::jsonb
  or not (notification_preferences ? 'checkin')
  or not (notification_preferences ? 'journal')
  or not (notification_preferences ? 'planner')
  or not (notification_preferences ? 'habits')
  or not (notification_preferences ? 'persistent')
  or not (notification_preferences ? 'aiSuggestions')
  or not (notification_preferences ? 'journalMorningTime')
  or not (notification_preferences ? 'journalEveningTime');

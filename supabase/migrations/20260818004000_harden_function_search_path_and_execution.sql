-- Governança de segurança: as funções abaixo não são chamadas diretamente pela
-- PWA ativa. Elas permanecem disponíveis apenas ao papel de serviço para rotinas
-- administrativas e deixam de aceitar execução aberta via PostgREST/RPC.

ALTER FUNCTION public.finalize_journal_session(uuid, text, text[], text[], boolean) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_or_create_journal_session(uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_planner_context(date) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_planner_context(date, text, text, jsonb) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_tcc_learning_context(integer) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_user_learning_context(uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_weekly_insights(date) SET search_path TO public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path TO public, pg_temp;
ALTER FUNCTION public.handle_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.match_memories(uuid, vector, integer, double precision) SET search_path TO public, pg_temp;
ALTER FUNCTION public.match_user_memories(uuid, vector, integer, double precision) SET search_path TO public, pg_temp;
ALTER FUNCTION public.save_ai_suggestions(date, uuid, jsonb) SET search_path TO public, pg_temp;
ALTER FUNCTION public.save_ai_suggestions(date, uuid, jsonb, jsonb, text[]) SET search_path TO public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.trigger_set_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_ai_background_jobs_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_objectives_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path TO public, pg_temp;

REVOKE ALL ON FUNCTION public.finalize_journal_session(uuid, text, text[], text[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_journal_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_planner_context(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_planner_context(date, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_tcc_learning_context(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_learning_context(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_weekly_insights(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_memories(uuid, vector, integer, double precision) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_user_memories(uuid, vector, integer, double precision) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_ai_suggestions(date, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_ai_suggestions(date, uuid, jsonb, jsonb, text[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_journal_session(uuid, text, text[], text[], boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_journal_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_planner_context(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_planner_context(date, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tcc_learning_context(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_learning_context(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_weekly_insights(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.match_memories(uuid, vector, integer, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_user_memories(uuid, vector, integer, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_ai_suggestions(date, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_ai_suggestions(date, uuid, jsonb, jsonb, text[]) TO service_role;

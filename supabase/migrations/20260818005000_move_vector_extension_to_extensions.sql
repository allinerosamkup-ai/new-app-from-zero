-- A extensão pgvector não precisa ficar exposta no schema público. As referências
-- de tipos e operadores são preservadas pelo Postgres ao mover os objetos membros.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- Roles que leem colunas de embedding continuam podendo resolver o tipo; dados
-- seguem protegidos por RLS nas tabelas públicas que os referenciam.
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

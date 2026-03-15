-- Manual SQL indexes for Supabase/PostgreSQL
-- Apply these in the Supabase SQL Editor if they are not already present.

-- Partial index for active journal sessions (frequent queries)
-- This cannot be represented in Prisma DSL as of now.
CREATE INDEX IF NOT EXISTS idx_journal_active ON journal_sessions(user_id, status) WHERE status = 'active';

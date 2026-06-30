# Database Package — packages/database

> Leia também o CLAUDE.md raiz do monorepo.

## Schema Prisma
Arquivo: `prisma/schema.prisma`

## Tabelas existentes
| Modelo Prisma | Tabela SQL | Descrição |
|---------------|-----------|-----------|
| `Profile` | `profiles` | Perfil do usuário (espelha `auth.users`) |
| `OnboardingResponse` | `onboarding_responses` | Respostas do onboarding |
| `UserPreference` | `user_preferences` | timezone, wakeTime, sleepTime, aiTone |
| `Consent` | `consents` | Consentimentos LGPD |
| `DailyCheckin` | `daily_checkins` | Check-ins com scores e classificação IA |
| `JournalSession` | `journal_sessions` | Sessões do diário |
| `JournalMessage` | `journal_messages` | Mensagens individuais das sessões |
| `TimelineBlock` | `timeline_blocks` | Blocos do planner diário |
| `WeeklyInsight` | `weekly_insights` | Insights semanais gerados por IA |
| `Objective` | `objectives` | Objetivos com sub-metas (subgoals em JSONB) |

## Regras de migração
1. **Sempre** habilitar RLS na nova tabela: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
2. **Sempre** criar policy de acesso: `CREATE POLICY ... USING (auth.uid() = user_id)`
3. **Sempre** criar trigger `updated_at` para tabelas com esse campo
4. Após mudar schema.prisma: rodar `npx prisma generate --schema packages/database/prisma/schema.prisma`
5. Migrações DDL: usar Supabase MCP (`apply_migration`) — não precisa de DATABASE_URL
6. `prisma generate` não precisa de DATABASE_URL, só lê o schema

## Como adicionar nova tabela (workflow)
```
1. Adicionar modelo em schema.prisma
2. Adicionar relação em Profile (se user-scoped)
3. Usar mcp__67a82d94__apply_migration com SQL da tabela + RLS + trigger
4. Rodar: npx prisma generate --schema packages/database/prisma/schema.prisma
5. Verificar com execute_sql que a tabela foi criada
```

## Convenções
- IDs: `UUID` com `gen_random_uuid()` ou `@default(uuid())`
- Timestamps: `TIMESTAMPTZ` com `DEFAULT NOW()`
- Soft delete: campo `archived BOOLEAN DEFAULT FALSE` (nunca deletar registros de usuário)
- Submodelos inline: `JSONB` (ex: subgoals em Objective) — evita joins desnecessários no MVP

# AGENTS — apps/backend

Escopo: API Express + TypeScript. Autenticação via Supabase JWT (Bearer). ORM Prisma (packages/database). Todas as queries user-scoped (RLS Supabase).

Regras rápidas
- Nenhum endpoint sem `requireAuth`; dados sempre filtrados por `userId` do token.
- Não retornar fallback de IA; respostas dinâmicas vêm do OpenAI com system prompt Aura (ver `buildAuraSystemPrompt`).
- CORS restrito a domínios autorizados; nada de wildcard em produção.
- Variáveis sensíveis só no `.env` server-side.
- Sempre alinhar contratos Zod (`src/contracts/*`) com schema Prisma.

Checklist antes de deploy
- Rodar `npm run test` (contratos/serviços) e `npm run build`.
- Confirmar RLS ativa nas tabelas novas e campos novos mapeados (ex.: ciclo menstrual em `daily_checkins`).
- Verificar logs de SSE (journal/checkin) para evitar memory leaks.


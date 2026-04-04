# AGENTS — packages/database

Escopo: schema Prisma compartilhado (prisma/schema.prisma). Banco: Supabase Postgres com RLS obrigatória.

Regras rápidas
- Toda alteração de schema deve considerar RLS já aplicada no Supabase; novos campos precisam de políticas equivalentes.
- Nomes de tabelas/colunas seguem snake_case via `@map`.
- Não remover defaults/índices sem revisar impacto em queries do backend.
- Campos de IA ficam como `Json` ou `Text` conforme necessidade; sem dados PII desnecessários.

Checklist
- Atualizar migrations Supabase após modificar o schema.
- Rodar `npm run generate` e `npm run push` quando apropriado; evitar sobrescrever dados de produção.
- Documentar mudanças relevantes no AGENTS raiz ou release notes.


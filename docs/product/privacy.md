# Privacidade — Exportação e Exclusão de Dados

Última atualização: 2026-05-10.
Dono operacional: Alline (founder). Dono regulatório: a definir antes de comunicar publicamente.

## Princípios

- A usuária pode pegar tudo (export) e pedir para sumir (delete) sem falar com humano.
- Toda saída de PII passa por uma allowlist explícita por modelo.
- Toda escrita destrutiva tem janela de graça com possibilidade de cancelamento.

## Exportação

- Endpoint: `GET /api/privacy/export`
- Auth: JWT Supabase.
- Rate-limit: 1 export por usuária a cada 24h. Excedido devolve `429 { error: "rate_limited", retryAfterSeconds }` com cabeçalho `Retry-After`.
- Persistência: cada export gera `EventLog { eventName: "privacy.export.generated", properties: { bytes } }`. Esse evento é a fonte do rate-limit.
- Conteúdo: ver `apps/backend/src/services/privacy-redaction.allowlist.ts`. A allowlist é validada por `apps/backend/src/lib/privacy-allowlist.test.ts` contra `packages/database/prisma/schema.prisma` — qualquer campo novo em modelo PII falha o teste até ser explicitamente classificado em `include[]` ou `redact[]`.
- Tokens OAuth (`gcalAccessToken`, `gcalRefreshToken`) nunca saem; o export resume como `googleCalendarConnected: boolean`.

## Exclusão

Fluxo de 3 passos com janela de graça. Estado vive em `EventLog` (sem migração de schema).

1. **Pedido** — `POST /api/privacy/delete-request`
   - Gera token de 32 chars hex e janela de confirmação de 24h.
   - Idempotente: chamadas repetidas dentro da janela devolvem o mesmo token.
   - Evento: `privacy.deletion.requested { token, confirmDeadline }`.

2. **Confirmação** — `POST /api/privacy/delete-confirm` body `{ token }`
   - Valida token e janela de 24h.
   - Agenda exclusão para 30 dias depois (`scheduledFor`).
   - Erros: `409 invalid_token`, `409 expired`, `409 no_request`.
   - Evento: `privacy.deletion.confirmed { scheduledFor }`.

3. **Cancelamento** — `POST /api/privacy/delete-cancel`
   - Permitido em qualquer estado (request ou confirmed) até `scheduledFor` passar.
   - Evento: `privacy.deletion.cancelled`.

Estado consultável em `GET /api/privacy/deletion-status`.

### Purge real (out of scope desta sprint)

Cron job a implementar:

```
- Lê EventLog mais recente por usuária com eventName ∈ privacy.deletion.*
- Para cada usuária com latest = "confirmed" e properties.scheduledFor < now:
  - Deleta Profile (cascade do Prisma remove tudo)
  - Cria EventLog "privacy.deletion.purged" antes do delete (em audit table separada se quiser histórico permanente)
```

Considerações antes de implementar o purge:
- Garantir que cron NUNCA roda contra o banco de dev/staging sem flag explícita.
- Decidir se eventos de outras usuárias que referenciem a deletada (improvável neste schema) precisam de tratamento.
- Decidir se backups manuais precisam ser purgados também (hoje Supabase mantém 7-30 dias de backup automático).

## Confirmação por email — pendente

A escolha do produto é confirmação por email; o app ainda não tem infra de email. Caminho recomendado: usar magic-link do Supabase Auth (`supabase.auth.signInWithOtp`) para validar o pedido, ou plugar Resend/Sendgrid em uma única função `sendTransactional(to, template, vars)`. Até lá, a janela de 24h em UI funciona como confirmação implícita ("voltar e clicar Confirmar dentro de 24h").

## Guardrails de teste (já no CI)

- `apps/backend/src/lib/privacy-allowlist.test.ts` — anti-drift de PII.
- `apps/backend/src/services/privacy-export.service.test.ts` — verifica redação de tokens GCal.
- `apps/backend/src/services/privacy-delete.service.test.ts` — fluxo request→confirm→cancel + idempotência + token inválido + janela expirada.

## LGPD — mapeamento mínimo

- Art. 18, I (confirmação): atendido por `GET /api/privacy/deletion-status`.
- Art. 18, II (acesso): atendido por `GET /api/privacy/export`.
- Art. 18, VI (eliminação): atendido pelo fluxo de delete acima — pendente implementar o cron de purge para fechar.
- Art. 18, IX (revogação de consentimento): a tabela `Consent` já existe; UI para revogar consent específico ainda não.

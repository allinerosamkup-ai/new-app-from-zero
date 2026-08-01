---
name: airia-notification-hygiene
description: Corrija notificacoes excessivas, atrasadas, duplicadas ou inventadas da Airia, garantindo que todo alerta seja futuro, deduplicado, permitido e ancorado em dado real da usuaria.
---

# Notificacoes Contextuais

Criar um item nao autoriza notificar. A notificacao requer dado real, horario futuro, permissao explicita, ausencia de feedback bloqueador e limite de frequencia.

1. Trace origem, agendamento, fila, permissao, timezone e entrega de cada alerta.
2. Rejeite itens passados, sem ancora, ja feitos, excluidos, rejeitados, adiados ou notificacoes equivalentes recentes.
3. Use o horario local da usuaria e cancele/recalcule alertas quando o bloco mudar ou for concluido.
4. Registre causa e identificador de deduplicacao para auditoria e testes.

**Como verificar:** simule item passado, concluido, futuro e duplicado; so o futuro elegivel pode permanecer agendado uma vez.

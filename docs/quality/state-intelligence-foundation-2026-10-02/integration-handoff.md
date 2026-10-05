# AIRIA-SI-01 — Handoff de integração

Papel independente: foundation_integration. Contexto: primeira implementação do backlog, recibo salvo independente da interpretação. Executor modifica produto; este papel altera somente evidência/fixture/revisão.

## Evidência e decisão inicial

Lidos governança, constituição, protocolo, ticket e `docs/agent-memory/VERIFICATION.md`. Reutilização: `createApp` com dependências injetadas, `CheckinApplicationService` real, app Vite completo e sessão Supabase sintética apenas no host local. Não há nova rota de demo no produto.

`integration-fixture.cjs` liga exclusivamente `127.0.0.1:4190/4191`. Repositório em memória explicitamente sintético; API real `POST /api/checkins` e `GET /api/checkins` do backend recebem o serviço real. Provedor de IA lança erro controlado. Leitura velha proposital contém marcador que jamais deve aparecer no resultado indisponível. Endpoint local `/fixture/evidence` permite ler registros e tráfego independentemente do estado do browser. Não prova Prisma, hardware, provedor ou produção.

Inventário CUA: IAB disponível; extensão Chrome falhou com `nodeRepl.fetch request failed`. Primeiro lançamento do harness falhou `MODULE_NOT_FOUND ts-node/register/transpile-only`: checkout sem `node_modules`. Coordenador notificado para coordenar instalação/reuso; nenhum acesso a banco/conta privada ocorreu.

## Próxima ação

Com dependências disponíveis: iniciar harness; completar formulário real; observar recibo indisponível PT e EN, reload e dado readback; repetir com texto sintético de crise, observar segurança; garantir ausência do marcador antigo e destinos desligados. Salvar árvores acessíveis/evidências locais, registrar nota e limitações. Ainda sem parecer de aprovação.

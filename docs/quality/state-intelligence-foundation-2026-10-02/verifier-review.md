# Parecer independente — AIRIA-SI-01

Verificador: foundation_verifier, separado do executor. Data: 2026-10-02. **PASS técnico, 9,30/10**. Aprovação deste papel não é DONE; integração, builds, prova de interface e meta-approve continuam gates próprios. Não aprova deploy ou sensores.

## Evidência executada pelo verificador

- `node docs/quality/state-intelligence-foundation-2026-10-02/independent-service-check.cjs`: exit 0. Repositório e fontes sintéticos isolados; nenhuma conta, banco privado ou provedor. Verificou escrita da fonte antes da análise; fonte preservada em erro de provedor e escrita derivada; ausência de segredos na resposta; crise preservada; retry sem duplicação; remoção de label/summary antigos no adaptador Prisma; readback seguro com cache antigo e rebuild deliberadamente falho; enum da resposta; rejeição de confirmação stale antes de qualquer mutation; rebuild indisponível com zero escritas de interpretação.
- `node -r ts-node/register/transpile-only src/services/checkin-application.service.test.ts` em `apps/backend`: exit 0, inclusive caminhos feliz/indisponível/idempotente/atualização de slot e guarda de escrita condicionada.
- `node -r ts-node/register/transpile-only src/services/airia-reading.service.test.ts` em `apps/backend`: exit 0, regressão do contrato de leitura existente.
- `git diff --check`: exit 0. Avisos de conversão CRLF não são falha de conteúdo.

## Revisão e correções exigidas

Baseline confirmou fonte gravada seguida de rejeição integral e derivação antiga mantida. A revisão encontrou caminhos concretos adicionais: GET de leitura chamava `rebuild`, que criava decisão/capacidade mesmo em indisponibilidade; POST de feedback aceitava decisão antiga depois de fonte nova. Executor corrigiu com retorno imediato de fonte/segurança sem derivação, guardas de identidade/data/revisão na leitura e feedback, erro 409 explícito e mensagem localizada. Casos foram reexecutados independentemente.

Guarda Prisma usa `id`, `recordedAt` e `aiState.sourceRevision` exclusivo, e confirma a revisão após leitura: registros com mesmo milissegundo não são tratados como a mesma revisão. `sourceFingerprint` diferencia correção de conteúdo de retry idempotente; nova nota de risco não é perdida por reutilização da chave. Marcador indisponível e segurança são gravados junto da fonte antes de qualquer interpretação. Retorno indisponível não carrega recomendações simuladas do fallback.

## Rubrica

| Dimensão | Peso | Nota | Evidência |
|---|---:|---:|---|
| Fidelidade à intenção | 20% | 9,5 | Recibo honesto sem perder fonte e sem reconstruir o aplicativo |
| Funcionamento/dados | 20% | 9,5 | Matriz independente de erros, retry, fonte alterada e readback |
| UI/UX/acessibilidade | 20% | 9,0 | Copy PT/EN e `role=status`, risco/erro visíveis; browser pertence integração |
| Segurança/privacidade | 15% | 9,5 | Crise independente da IA; retorno sanitizado; feedback stale não grava |
| IA/conteúdo | 15% | 9,0 | Indisponibilidade explícita; derivação simulada não se apresenta como leitura |
| Manutenibilidade | 10% | 9,2 | Serviço e persistência existentes, sem dependência ou migração nova |

Ponderada: **9,30**. Sem bloqueio crítico encontrado no escopo técnico revisado. Dois aspectos que ultrapassam o mínimo: (1) segurança e fonte são duráveis antes do provedor, inclusive no retry, de modo que falha técnica não apaga proteção; (2) a mesma honestidade atravessa cache, rebuild e confirmação de decisão, eliminando reaparecimento silencioso de orientação antiga em uma jornada vizinha.

## Limites e próxima ação

Repositório sintético comprova contrato e caminhos de aplicação; não comprova transação real do PostgreSQL, comportamento do provedor, eficácia clínica, sensores ou produção. Código não recebe aprovação por herdar nota do dossiê. Coordenador deve juntar typechecks/builds/regressões e prova de browser, levar ao verificador de integração e meta independente, persistir snapshot e commit/handoff. Se algum desses gates falhar, retornar ao executor; não declarar DONE com esta nota isolada.

# Handoff — AIRIA-SI-01

## Contexto e decisão

Pedido de dividir dossiê/plano e começar implementação, 2026-10-02. Nome do produto: **Airia** (correção expressa da titular). Backlog de 15 tarefas em `docs/plans/state-intelligence-tasks.md`, com cobertura dos 14 entregáveis. Primeira fatia vertical: escrita do Check-in independente da interpretação, risco e indisponibilidade visíveis nos consumidores. Fonte anterior documental aprovada não equivale a aprovação de código.

## Responsabilidades e contratos

- Coordenador root: ticket, backlog, estado operacional, dependências, protocolo serializado, Git e destino.
- Executor foundation_executor: serviço/API/contratos, consumidores web e testes da mesma fatia; não aprova entrega.
- Verificador foundation_verifier: revisão adversarial, execução independente e parecer; sem editar código.
- Integração foundation_integration: app real em ambiente local isolado com autenticação/dados sintéticos declarados; evidência de tela/readback e parecer. Não comprova provedor ou banco de produção.
- Meta: agente distinto após pareceres, autoridade de conclusão local do ticket.

Handoffs e reprovações são persistidos neste diretório. Arquivos de implementação têm executor único; sem worktree físico novo. Branch `codex/state-intelligence-foundation-2026-10-02`, base `a20500d`.

## Evidência inicial e ambiente

Verificador confirmou: upsert escreve antes de evaluate/updateEvaluation; exceção posterior vira erro; derivados anteriores persistiam no mesmo slot. Consumidores e AiriaReading exigem teste de análise/canonical rebuild indisponível e readback. Cópia de dependências locais inspecionada para reuso; instalação seletiva tentou registry e encontrou `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, encerrada sem desabilitar TLS. Reuso de node_modules de checkout conhecido, excluindo links `@app` e caches; links do workspace serão criados para código atual. Schemas Prisma local e origem possuem hashes iguais. Nenhuma escrita em banco privado.

## Critérios e próxima ação

Dependências disponíveis após reuso local: diretórios já copiados preservados; pacotes restantes e dependências web ligados ao checkout de origem, sem alterar bibliotecas ou instalar via TLS inseguro. Links `@app/shared`, `@app/database`, backend e web apontam exclusivamente ao checkout atual. `require.resolve` confirmou shared atual e database/dist atual; ts-node externo é apenas runtime de testes. Caches Vite e links antigos `@app` não foram reutilizados. Nenhuma geração ou migração de banco executada.

Ticket controla aceite. Exigir reprodução RED, GREEN, regressão, builds, UI PT/EN e crise; falha de escrita não pode simular recibo. Idempotência, correção de slot e leitura antiga são riscos específicos. Aprovação somente pelos três papéis independentes com notas e evidência. Commit local ao terminar; sem push/merge/deploy. Backlog local, conector Notion ausente; não alegar sincronização externa.

# AIRIA-SI-20261002 — Dossiê de pesquisa

- Data: 2026-10-02, America/Sao_Paulo.
- Titular: “PLEASE IMPLEMENT THIS PLAN: # Dossiê de pesquisa — Airia State Intelligence”. Correção explícita: “oplaneer e rotinas a gente não vai considerar não”.
- Branch: `codex/state-intelligence-dossier-2026-10-02`; base `5dcf2ad`.
- Checkout: `C:/Users/allin/Projetos/Apps/new-app-fron-zero`.
- Estado inicial: PLANEJADA → EM_EXECUÇÃO. Este ticket é documental; não entrega o motor funcionando.

## Intenção e resultado

Pesquisar e decidir uma evolução do produto existente para inteligência de estado e manifestação opcional. Entregar 14 componentes do dossiê, evidências primárias, limites, escolhas de arquitetura, protocolos de validação e plano posterior. Não reconstruir o app.

## Escopo e autoridade

Documentos em `docs/product/`, `docs/plans/`, pareceres neste diretório e registro operacional em `docs/agent-memory/`. Não alterar código, schema, constituição, prompts, dependências ou produção. Não reativar Planejador, Rotinas, Hábitos, Pomodoro, Agenda ou Corrida. Sem push, PR, merge ou deploy. Commit local documental está incluído na execução autorizada. Revogação: reverter apenas os commits desta tarefa; preservar alterações anteriores.

## Aceite

- [x] Os 14 entregáveis estão identificados e ligados.
- [x] Afirmações externas possuem fonte, limitação e distinção entre evidência e hipótese.
- [x] Código existente é inspecionado; planos não são tratados como implementação.
- [x] Medido/relatado/inferido/interpretativo permanecem distintos.
- [x] Fórmulas sem validação têm versão, hipótese, limite e protocolo; dados ausentes não são zero.
- [x] Segurança prevalece sobre prontidão; não há Hz espiritual, diagnóstico, garantia ou culpa.
- [x] Cenários: novos/recorrentes/baixa energia, ausência, sinal ruim, baseline imaturo, conflito, aceleração, piora e evidência contrária.
- [ ] Revisão independente de pesquisa, integração e meta-processo, notas e correções registradas.
- [ ] Links locais e diff documental conferidos; commit e branch com destino HANDOFF.

## Papéis e handoffs

Coordenador/executor de síntese: agente raiz. Executores independentes de pesquisa: ciência e referências. Verificador, integração e meta-verificador: agentes distintos em passes de leitura, com pareceres próprios. Mensagens importantes devem ser persistidas neste diretório. Nenhum executor aprova sua contribuição.

### Handoff recebido da exploração anterior

`[AIRIA-SI-20261002][fit][VERTICAL][FINDING]` research_fit → coordenador.
Contexto: skill de governança, constituição, contexto central, CheckinApplicationService, MoodCycleEngine e risk-safety.
Evidência relatada: contexto central agrega sinais de saúde, mas não HRV/PRV/qualidade/baseline por sensor; motor de ciclagem existente usa baseline individual; check-in tem persistência/idempotência; linguagem de prompts pode conflitar com prática/janela.
Decisão: HANDOFF_ACCEPTED como pista a verificar contra código nesta execução, não aprovação de produto. O passe anterior foi somente leitura; a ausência de persistência é corrigida por este registro. Próxima ação: confirmar código e documentar lacunas.

## Pesquisa/reuso antes de inventar

Consultados: skill local, protocolo, constituição, dossiê operacional, matriz humana, inventário de worktrees, status e busca `State Intelligence|state-intelligence|manifestation` em docs/skills (sem dossiê correspondente). Branch isolada no checkout atual evita duplicar worktree documental e preserva arquivos alheios. Fontes/candidatos técnicos detalhados serão registrados no dossiê e no plano.

## Verificação proporcional

Mudança exclusivamente Markdown: revisão de fontes, contratos, casos de mesa e links; não executar builds do app como falsa prova de pesquisa. Não há teste clínico, de sensor, UX com pessoas ou comportamento runtime nesta entrega. Futuras validações são gates do plano de implementação.

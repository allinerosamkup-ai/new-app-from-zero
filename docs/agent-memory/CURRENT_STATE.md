# CURRENT_STATE — trabalho em andamento

> Camada B. Estado operacional da tarefa atual. Muda o tempo todo.
>
> **Só existe conteúdo aqui quando há tarefa em andamento.** Terminou e não
> sobrou nada? Zere para o esqueleto de baixo — arquivo com trabalho velho é
> pior que arquivo vazio, porque o próximo agente acredita nele.
>
> Atualize **durante** a tarefa, não no fim. Especialmente antes de: compactação
> provável de contexto, mudança de fase, delegação para subagente, sequência
> longa de testes, ou pausa por bloqueio externo.
>
> Teste de suficiência: *"se outro agente abrir este repositório amanhã sem a
> conversa, ele continua daqui?"* Se não, falta informação.

---

## Status

`EM VERIFICAÇÃO — Stripe live configurado; release verificado e aguardando deploy/E2E`

## Objetivo

Consolidar o onboarding atual em `/comecar`, iniciar 7 dias Pro (14 por
indicação verificada), criar cadastro de profissionais parceiras sem comissão e
ativar cobrança Stripe confiável.

## Definition of Done

- [x] Todos os acessos de onboarding usam o fluxo atual.
- [x] Conclusão marca `onboardingDone` e concede o período correto uma única vez.
- [x] Assinatura, período Pro e parceria são persistidos fora do payload de onboarding.
- [x] Checkout, webhook e portal estão cobertos por testes e estados reais.
- [x] CRP pendente/verificado e indicação possuem contratos persistentes.
- [ ] Fluxo autenticado mobile, reload e regressões foram verificados em produção.
- [x] Stripe live tem preço, webhook e portal coerentes; bloqueios da conta são explícitos.
- [x] Todas as mudanças locais estão commitadas e o worktree tem destino registrado.

## O que já foi feito

- Protocolo, memória, worktrees e código atual inspecionados.
- Causa da duplicidade localizada em rotas/atalhos antigos.
- Estado anterior da Stripe foi consultado por API sem expor segredos; a
  conexão OAuth expirou antes da configuração externa.
- Design aprovado registrado em `docs/plans/2026-08-10-onboarding-stripe-professional-partners-design.md`.
- Plano TDD registrado em `docs/plans/2026-08-10-onboarding-stripe-professional-partners-implementation.md`.
- Worktree dedicado criado em `C:\Users\allin\Projetos\Apps\new-app-fron-zero\.worktrees\onboarding-stripe-partners`.
- Persistência separada criada para cobrança, período Pro, profissionais, indicações e eventos Stripe.
- Regra central de acesso criada: 7 dias padrão, 14 por indicação verificada, sem reinício no refazer.
- Endpoint autenticado `POST /api/onboarding/complete` criado e idempotente.
- Configurações agora reinicia o fluxo canônico em `/comecar`.
- Todas as rotas legadas de onboarding redirecionam para `/comecar`.
- Oferta final usa período Pro confirmado pelo servidor: 7 dias padrão ou 14
  dias por indicação profissional verificada, sem reinício ao refazer.
- Mensal R$ 29,90 e anual R$ 249 usam assinatura; vitalício R$ 99 usa pagamento
  único e pode ser desligado sem revogar compras existentes.
- Checkout, retorno confirmado no servidor, webhooks idempotentes, portal e
  estados de cobrança foram implementados sem ativação por parâmetro de URL.
- Cadastro CRP, verificação administrativa e indicação profissional foram
  implementados sem lista de pacientes nem comissão.
- Exportação/privacidade exclui payloads de webhook, IDs Stripe e notas
  administrativas.
- Revisão final encontrou e corrigiu duplicação de `/api` nas chamadas web de
  cobrança e parceria; um teste de regressão agora bloqueia esse erro.
- Tentativas de checkout agora reutilizam uma chave idempotente gerada no
  cliente quando a rede falha.
- Conta live AIRIA confirmada; a credencial live já existente no cofre local foi
  validada contra a conta sem imprimir nem copiar o segredo para o repositório.
- Produto live único preservado, sem duplicação: mensal R$ 29,90, anual R$ 249
  e vitalício R$ 99.
- Portal do cliente salvo com retorno para `https://airia.pro/billing`, histórico
  de faturas, métodos de pagamento e cancelamento ao fim do período.
- Webhook live `airia-production-billing` criado para
  `https://airia.pro/api/billing/webhook`, API `2026-07-29.dahlia`, com os seis
  eventos consumidos pelo backend.
- Segredos Stripe instalados somente em
  `/opt/airia/app/deploy/airia/.env.backend`, arquivo `0600`; todos os três IDs
  de preço e a oferta vitalícia estão definidos.
- SDK Stripe atualizado para 22.4.0 e Checkout alinhado à API atual.

## O que falta

- [x] Plano de implementação TDD.
- [x] Tasks 1–3: persistência, acesso/período e conclusão canônica.
- [x] Tasks 4–5: rotas legadas e oferta final depois da conclusão real.
- [x] Tasks 6–11: parceiros, Stripe no código, paywalls, privacidade e contratos.
- [x] Task 12: configuração Stripe externa e validação read-only.
- [ ] Task 13: browser autenticado mobile e ativação em ambiente com a migração.
- [x] Task 13 local: revisão Airia, reverificação integral e fechamento Git.

## Verificações executadas

- `npm run test -w apps/web -- src/features/aura/onboarding.test.ts src/features/routine-builder/import-routine-dialog.test.tsx` → PASS, 11 testes.
- `npm run typecheck -w apps/web` → PASS.
- `npm run generate -w packages/database` → PASS.
- `npm run build -w packages/database` → PASS.
- `npm run build -w apps/backend` → PASS.
- `npm run build -w apps/web` → PASS.
- `npm run typecheck -w apps/web` → PASS.
- `npm run test:auth -w apps/backend` → PASS.
- `npm run test -w apps/backend` após a correção final → PASS, 102 suítes.
- `npm run test -w apps/web` após a correção final → PASS, 56 arquivos e 423 testes.
- `index.billing.test.ts` após a correção final → PASS.
- Testes focados web de billing/subscription/parceiros após a correção final →
  PASS, 23 testes.
- `schema-alignment.test.ts` e `migration-chain-safety.test.ts` → PASS.
- `billing-access.service.test.ts` → PASS (precedência, 7/14 dias e idempotência).
- `index.onboarding-completion.test.ts` → PASS (usuário autenticado e repetição segura).
- `apps/web/src/features/aura/onboarding.test.ts` → PASS, 4 testes.
- Typecheck backend e web após Tasks 1–3 → PASS.
- `git diff --check origin/master...HEAD` → PASS.
- varredura por `sk_live_`, `rk_live_` e `whsec_` → PASS; apenas fixture
  `whsec_test` em teste.
- servidor confirmou `STRIPE_SECRET_KEY=SET` e modo `0600`, sem revelar valor.

## Descobertas importantes

- A conta live está `charges_enabled=false` e `payouts_enabled=false`: a Stripe
  mostra revisão pendente do representante e pagamentos/repasses pausados.
- Produtos, preços, portal e webhook estão configurados apesar dessa pausa; o
  bloqueio restante é cadastral da conta, não de integração do app.
- A API conectada do Stripe retorna `oauth_token_invalid_grant` mesmo depois do
  login bem-sucedido no painel, pois são sessões de autenticação separadas.
- A conta AIRIA foi confirmada e configurada no Chrome persistente.
- A Alline confirmou três ofertas: mensal R$ 29,90, anual R$ 249 e vitalícia
  R$ 99. A vitalícia foi criada como pagamento único e oferta controlável.

## Falha atual

O conector Stripe do Codex ainda exige reautenticação OAuth, mas o painel e a
credencial segura do app permitiram concluir a configuração. O bloqueio externo
real é a pausa de pagamentos/repasses da própria Stripe enquanto o representante
da conta não for atualizado. Nenhuma cobrança real será usada para validação.

## Tentativas já feitas

### Tentativa 1

Conector Stripe do Codex → continua `oauth_token_invalid_grant`; não é o canal
usado pelo backend.

### Tentativa 2

Dashboard autenticado e credencial do cofre local → conta, preços, portal,
webhook e variáveis live configurados sem persistir segredo no Git.

### Tentativa 3

Revisão completa local → 102 suítes backend, 56 arquivos/423 testes web,
autenticação, typecheck e builds aprovados.

## Próxima melhor ação

Integrar a branch no `master`, publicar pelo deploy oficial, aplicar a migração,
confirmar o mesmo SHA em GitHub/VPS/containers/site e abrir os três Checkouts em
produção sem concluir cobrança. Depois, a atualização cadastral do representante
precisa ser concluída na Stripe para liberar pagamentos e repasses reais.

Último trabalho registrado (2026-08-09): protocolo permanente de iteração,
memória e conclusão alinhado ao runner real do monorepo e aos eventos
`Stop`/`SubagentStop`/`TaskCompleted` do Claude Code. O guard foi exercitado com
payloads isolados: bloqueou edição sem verificação, bloqueou `TaskCompleted`,
respeitou `stop_hook_active`, liberou após tentativa de verificação e falhou
aberto com entrada inválida.

Trabalho concluído (2026-08-09): neutralização do protocolo para Codex/GPT,
Claude Code e demais agentes. A fonte canônica passou a ser
`docs/DEVELOPMENT_ITERATION_PROTOCOL.md`; `docs/CLAUDE_ITERATION_PROTOCOL.md`
permanece apenas como ponte de compatibilidade. `AGENTS.md`, `CLAUDE.md` e o
AGENTS global do Codex apontam para a mesma fonte; o hook Claude-only foi mantido.
Referências, JSON, sintaxe do hook, diff e cenários isolados foram verificados.

Trabalho concluído (2026-08-09): separação dos gates de commit e worktree no
protocolo (§22). A regra agora exige que toda alteração tenha commit, remoção
consciente ou bloqueio documentado, e que todo worktree tenha dono, branch,
estado e handoff. A auditoria inicial encontrou 24 worktrees; nenhum foi
removido sem confirmar propriedade e commits exclusivos. O inventário está em
`docs/agent-memory/WORKTREES.md` e a limpeza permanece uma tarefa separada.

Trabalho anterior (2026-08-08): inventário, mascote Airia Orbital e
redesenho do check-in. Concluído e verificado — 93 suítes no backend, 357 testes
no web, typecheck e build verdes, e cada campo do check-in rastreado até o
payload no navegador.

Sobrou uma decisão de produto, não de código: os PNGs-mestres do mascote (11,4 MB)
ficaram fora da master, só na branch `codex/airia-orbital-mascot`. Se essa branch
for apagada, a arte-fonte some e só restam os WebP de 320/640 px.

---

## Esqueleto (copie ao abrir tarefa)

```markdown
## Objetivo

## Definition of Done
- [ ] ...

## Status
IN PROGRESS | BLOQUEADO | EM VERIFICAÇÃO

## O que já foi feito
- ...

## O que falta
- [ ] ...

## Arquivos alterados
- `caminho` — o que mudou

## Verificações executadas
- `comando` → PASS / FAIL (evidência)

## Falha atual
sintoma + evidência exata

## Tentativas já feitas
### Tentativa 1
hipótese →
resultado →
o que aprendi →

### Tentativa 2
...

## Descobertas importantes
- ...

## NÃO repetir
- ...

## Próxima melhor ação
...
```

---

## Regras de uso

- **Tentativas fracassadas ficam aqui enquanto a tarefa vive.** Quando a tarefa
  fechar, o que valer para o futuro migra para `LEARNINGS.md`; o resto some.
- Descoberta reutilizável não fica presa aqui — promova para `LEARNINGS.md`,
  `KNOWN_ISSUES.md` ou `PROJECT_CONTEXT.md` assim que ficar clara.
- Subagente recebe ponteiro para os arquivos relevantes, não cópia. O que ele
  devolver, o agente principal filtra antes de virar memória — resposta de
  subagente não entra crua.
- Não registre raciocínio longo. Só estado operacional.

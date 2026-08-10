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

`IN PROGRESS — onboarding único, período Pro, parceiros CRP e Stripe`

## Objetivo

Consolidar o onboarding atual em `/comecar`, iniciar 7 dias Pro (14 por
indicação verificada), criar cadastro de profissionais parceiras sem comissão e
ativar cobrança Stripe confiável.

## Definition of Done

- [ ] Todos os acessos de onboarding usam o fluxo atual.
- [ ] Conclusão marca `onboardingDone` e concede o período correto uma única vez.
- [ ] Assinatura, período Pro e parceria são persistidos fora do payload de onboarding.
- [ ] Checkout, webhook e portal estão cobertos por testes e estados reais.
- [ ] CRP pendente/verificado e indicação possuem contratos persistentes.
- [ ] Fluxo autenticado mobile, reload e regressões foram verificados.
- [ ] Stripe live tem preço, webhook e portal coerentes; bloqueios da conta são explícitos.
- [ ] Todas as mudanças estão commitadas e o worktree tem destino registrado.

## Status

IN PROGRESS — design aprovado e baseline verde; plano TDD em elaboração.

## O que já foi feito

- Protocolo, memória, worktrees e código atual inspecionados.
- Causa da duplicidade localizada em rotas/atalhos antigos.
- Estado live da Stripe consultado por API sem expor segredos.
- Design aprovado registrado em `docs/plans/2026-08-10-onboarding-stripe-professional-partners-design.md`.
- Worktree dedicado criado em `C:\Users\allin\Projetos\Apps\new-app-fron-zero\.worktrees\onboarding-stripe-partners`.

## O que falta

- [ ] Plano de implementação TDD.
- [ ] Implementação vertical por contrato.
- [ ] Configuração Stripe externa e validação real.
- [ ] Revisão Airia, builds, browser e fechamento Git/worktree.

## Verificações executadas

- `npm run test -w apps/web -- src/features/aura/onboarding.test.ts src/features/routine-builder/import-routine-dialog.test.tsx` → PASS, 11 testes.
- `npm run typecheck -w apps/web` → PASS.
- `npm run build -w apps/backend` → PASS.

## Descobertas importantes

- `/comecar` não marca `profiles.onboarding_done`; o fluxo legado marca.
- Configurações ainda navega para `/onboarding/guiado`.
- Stripe live está com `charges_enabled=false`, capacidades pendentes, sem webhook e sem portal.
- O preço anual configurado existe; o mensal configurado não corresponde ao preço mensal ativo.
- O convite atual não tem backend nem atribuição.

## Próxima melhor ação

Escrever e commitar o plano de implementação; iniciar o primeiro teste vermelho
para a rota canônica do onboarding.

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

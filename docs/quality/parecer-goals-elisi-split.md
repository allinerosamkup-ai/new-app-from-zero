# Parecer de verificação — Airia

- **Ticket / branch:** `feat/goals-elisi-split`
- **Papel do verificador:** pendente (autor não assina)
- **Autor da mudança:** célula `/goals` nesta sessão
- **Data:** 2026-08-31

## Evidência técnica já coletada

- Pasta alinhada a `origin/master` (`9073e21`) antes da UI.
- Governança do PR #14 instalada localmente (sem merge em master).
- Causa do “ainda não”: GitHub tinha abas Agora/Caminho/Nota que se excluem. Elisi exige nota e tarefa juntas.
- Testes alvo: `goal-workspace.test.ts`, `goal-card.test.tsx`, `goals-page.test.tsx`.

## Portões

- [ ] Ponderada ≥ 8,0
- [ ] Nenhuma dimensão < 7,0
- [ ] Sem bloqueio crítico
- [ ] Testes do ticket e regressão
- [ ] Simulador humano
- [ ] Dois pontos “impressionado”
- [ ] Coordenador: jornada e núcleo íntegros

## Veredicto (primeira passagem)

**Devolver — 7,8/10.** Autor não pontua. Bloqueios: Agora abaixo da nota no mobile; testes de lista|detalhe e concluir ausentes/untracked; seleção dessincroniza ao pausar.

## Correção da célula (segunda passagem)

- Agora primeiro no DOM; CSS `agora/nota` no stacked e `nota | agora` no desktop.
- Textarea `rows={3}`.
- Workspace só escolhe objetivo **ativo**.
- `wideLayout` lê `matchMedia` no primeiro paint.
- Testes: concluir, Pronto quando, ordem DOM, pausa, media match.

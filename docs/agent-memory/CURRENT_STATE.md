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

`SEM TAREFA ATIVA`

Último trabalho registrado (2026-08-08): inventário, mascote Airia Orbital e
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

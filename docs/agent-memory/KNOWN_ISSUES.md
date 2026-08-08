# KNOWN_ISSUES — problemas conhecidos ainda abertos

> Camada C. Só problema **ainda relevante**. Item resolvido sai daqui — este
> arquivo não é depósito de bug antigo. Se virar histórico, ele deixa de ser lido.

Formato de cada item: sintoma, causa, status, contorno, arquivos, e o que **não**
confundir com isso.

---

## 1. Oito arquivos de teste do backend nunca rodam

### Sintoma
Testes existem, passam quando executados à mão, e não protegem nada: a CI e o
`npm run test -w apps/backend` não os alcançam.

### Causa
`apps/backend/package.json` → script `test` é uma lista manual de arquivos
encadeada com `&&`. Não há descoberta automática. Quem criou os arquivos não os
registrou.

### Status
**Aberto** — verificado em 2026-08-08. Órfãos:

```
src/contracts/checkin-draft.contract.test.ts
src/contracts/event-log.contract.test.ts
src/contracts/onboarding-ai.contract.test.ts
src/index.event-log.test.ts
src/services/checkin-application.service.test.ts
src/services/checkin-understanding.service.test.ts
src/services/objective-action-recovery.service.test.ts
src/services/routine-guided-transform.service.test.ts
```

### Contorno
Rodar à mão o que for relevante à tarefa:
`npx ts-node-transpile-only apps/backend/src/<arquivo>.test.ts` (~2,5s cada).

### Ao criar teste novo no backend
Adicionar o arquivo à string do script `test` **na mesma alteração**. Caso
contrário o teste nasce morto.

### Não confundir com
"Teste falhando" — eles não falham, eles não são chamados. Também não é
configuração de test runner: não existe runner, é execução direta por arquivo.

---

## 2. A suíte do backend imprime erro de runtime e ainda retorna exit 0

### Sintoma
`npm run test -w apps/backend` termina com `EXIT=0` depois de imprimir, entre
outros:

```
[micro-step] AI generation failed: TypeError: prisma.timelineBlock.update is not a function   (4x)
Error: TypeError: Cannot read properties of undefined (reading 'findFirst')                   (2x)
```

### Causa
**HIPÓTESE, não confirmada.** O stub de Prisma usado por esses testes
provavelmente não implementa `timelineBlock.update` nem o model consultado por
`findFirst`, e o caminho de erro é engolido por um `catch` que só registra log.
O teste segue verde porque a asserção não cobre esse ramo.

Parte do ruído da suíte **é intencional** e não deve ser confundida: `Error:
offline`, `"isso não é JSON" is not valid JSON`, `feedback unavailable` são
testes de caminho de erro.

### Status
**Aberto, não diagnosticado.** Ninguém investigou a fundo.

### Contorno
Ler o log, não só o exit code. Ao mexer em `timeline`, micro-steps ou geração de
ação, tratar essas linhas como sinal e verificar se o ramo está mesmo coberto.

### Arquivos relacionados
`apps/backend/src/index.ts:4405` (micro-step), `src/index.timeline.test.ts`,
`src/index.onboarding.test.ts`.

### Não confundir com
Falha de conexão real com o banco — os testes não tocam Postgres, usam stub.

---

## 3. Credenciais reais versionadas em `.claude/settings.local.json`

### Sintoma
O arquivo está rastreado pelo git (`git ls-files .claude`) e traz, dentro de
`permissions.allow`, um `EXPO_TOKEN` e a senha do Postgres/Supabase em texto puro.

### Causa
Entradas de permissão foram gravadas com o comando literal completo, segredo
incluído.

### Status
**Aberto.** Fora do escopo da tarefa que descobriu isso; existe tarefa em
segundo plano proposta para rotacionar e remover.

### Contorno
Nenhum. Rotação das credenciais é obrigatória — o segredo permanece no histórico
do git mesmo depois de removido do HEAD.

### Não confundir com
Problema de configuração de permissão do Claude Code. As permissões funcionam; o
problema é o conteúdo delas.

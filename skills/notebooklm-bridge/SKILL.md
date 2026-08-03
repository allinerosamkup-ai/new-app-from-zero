---
name: notebooklm-bridge
description: Use quando a tarefa exigir leitura pesada de documentos, pesquisa web ancorada, memoria persistente entre sessoes ou geracao de material derivado (relatorio, quiz, audio, mapa mental). Ponte entre Claude Code e o NotebookLM via MCP.
---

# NotebookLM Bridge

Ponte entre Claude Code e o NotebookLM. Serve para tirar leitura pesada e memoria de longo prazo de dentro da janela de contexto e jogar para o Gemini, que responde com citacao da fonte.

## Quando usar

- Pergunta que exige ler mais de 3 documentos longos.
- Pesquisa web que precisa virar material com fonte citada.
- Recuperar decisao antiga de produto sem reler o repo inteiro.
- Fechar sessao gravando o que foi decidido para a proxima sessao achar.
- Gerar derivado de um conjunto de fontes: briefing, estudo, audio, quiz, mapa mental.

## Quando nao usar

- Pergunta respondida por um arquivo do repo. Le o arquivo.
- Codigo. NotebookLM nao le o repositorio em tempo real.
- Dado sensivel de usuaria real da Airia. Fonte enviada ao NotebookLM sai da infra propria e entra na conta Google. Nunca subir check-in, diario, humor, conteudo de conversa com a Aura ou qualquer PII de usuaria.

## Notebooks canonicos da Airia

| Notebook | Conteudo | Uso |
|---|---|---|
| `Airia — Produto` | PRD, visao, mapa de telas, decisoes de produto | consulta de "por que decidimos assim" |
| `Airia — Memoria de Sessao` | notas de fim de sessao: decisao, bug resolvido, caminho descartado | memoria entre sessoes |
| `Airia — Pesquisa` | pesquisa web importada (TDAH, ciclotimia, ciclo hormonal, concorrentes) | fundamentacao de feature |

Nao criar notebook novo sem necessidade. Notebook solto vira lixo.

## Fluxo padrao

Consulta:

```
notebook_list                      -> descobrir o notebook
chat_ask(notebook, question)       -> resposta com citacao
```

Ingestao:

```
source_add(notebook, source_type, ...)
source_wait(notebook)              -> so perguntar depois que processou
```

Pesquisa web:

```
research_start(notebook, query, source="web", mode="deep")
research_status(notebook, task_id)
research_import(notebook, task_id)
```

Artefato:

```
artifact_generate(notebook, artifact_type)   -> retorna task_id, nao bloqueia
artifact_status(notebook, task_id)           -> poll ate completar
artifact_download(notebook, artifact_type, path)
```

## Regras de operacao

1. **Nunca deletar sem confirmacao explicita da Alline.** `notebook_delete`, `source_delete` e `note_delete` exigem `confirm=true`. A primeira chamada e sempre preview.
2. **Resposta do NotebookLM entra citada.** Ao trazer conteudo para o chat ou para um doc, dizer de qual fonte veio. Resposta sem fonte nao vale mais que palpite.
3. **Geracao e assincrona.** Nunca assumir que o artefato ficou pronto. Poll ate `complete`.
4. **`AUTH` significa sessao expirada.** Rodar `notebooklm auth refresh --quiet` no terminal Windows. Nao tentar contornar.
5. **`RATE_LIMITED` e retriable.** Recuar e tentar de novo, nao trocar de estrategia.
6. **API nao oficial.** A biblioteca usa endpoints internos do Google. Pode quebrar sem aviso. Se quebrar, o caminho e atualizar `notebooklm-py`, nao remendar.

## Fim de sessao

Quando a sessao produziu decisao, correcao relevante ou caminho descartado:

```
note_create(notebook="Airia — Memoria de Sessao",
            title="<data> — <assunto>",
            content="Decisao: ... | Motivo: ... | Descartado: ...")
```

Decisao de arquitetura tambem continua indo para `.dummy/memory/projects/mood-energy/decisions.md`. O notebook e recall, o arquivo e a fonte de verdade.

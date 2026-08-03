# NotebookLM MCP — Setup

Conecta o Claude Code ao NotebookLM. Depois disso, o Claude Code passa a ter as ferramentas `notebook_*`, `source_*`, `chat_ask`, `artifact_*` e `research_*` nativas.

## Contexto tecnico

O NotebookLM **nao tem API publica** em agosto de 2026. O Google confirmou que esta trabalhando nisso, mas nao ha beta, waitlist nem prazo. Existe API so no NotebookLM Enterprise, via Google Cloud, com acesso restrito.

A ponte usa `notebooklm-py`, biblioteca open source (MIT) que fala com os endpoints internos do NotebookLM reusando o cookie da sessao logada do navegador. Ela ja traz um servidor MCP pronto com 25 ferramentas.

Consequencia: pode quebrar quando o Google mexer nos endpoints. O conserto e atualizar a lib, nao remendar.

## O que voce precisa fazer

### 1. Autenticar (PowerShell)

```powershell
uvx --from "notebooklm-py[browser]" notebooklm login
```

Abre um Chromium, voce faz login na conta Google que tem os notebooks. Na primeira vez ele baixa o Chromium (~170 MB).

Alternativa sem abrir navegador novo, reusando o Chrome que ja esta logado:

```powershell
uvx --from "notebooklm-py[browser]" notebooklm login --browser-cookies chrome
```

Verificar:

```powershell
uvx --from "notebooklm-py[mcp]" notebooklm auth check --test --json
```

Esperado: `"status": "ok"`.

### 2. Registrar o servidor no Claude Code

```powershell
uvx --from "notebooklm-py[mcp]" notebooklm mcp install claude-code
```

Isso escreve o bloco em `~/.claude.json` (escopo de usuario, vale para todos os projetos) sem apagar os outros servidores.

Se preferir deixar so neste repositorio, adicione a mao em `.mcp.json`:

```json
"notebooklm": {
  "command": "uvx.exe",
  "args": ["--from", "notebooklm-py[mcp]", "notebooklm-mcp"]
}
```

### 3. Reiniciar o Claude Code

Cliente MCP so le config na inicializacao. Fechar e abrir.

### 4. Confirmar

No Claude Code, `/mcp` deve listar `notebooklm`. Teste rapido: pedir "lista meus notebooks".

## Manutencao

O cookie expira. Para nao ter que relogar toda hora, agendar um keepalive diario no Agendador de Tarefas do Windows:

```powershell
uvx --from "notebooklm-py[mcp]" notebooklm auth refresh --quiet
```

## Limites conhecidos

- **Cota por conta.** Uso pesado devolve `RATE_LIMITED`. E retriable, so esperar.
- **Uma conta por processo.** Se tiver mais de uma conta Google, usar `--profile`.
- **Geracao e assincrona.** Audio, video e slide deck levam minutos. O fluxo e `generate` -> `status` -> `download`.
- **Nao subir dado de usuaria da Airia.** Fonte enviada sai da infra propria e passa a viver na conta Google.

## Referencias

- [notebooklm-py — repositorio](https://github.com/teng-lin/notebooklm-py)
- [Guia do servidor MCP](https://github.com/teng-lin/notebooklm-py/blob/main/docs/mcp-guide.md)
- [Status da API oficial](https://discuss.ai.google.dev/t/how-to-access-notebooklm-via-api/5084)

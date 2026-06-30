# AI Reliability And Autonomy Plan

Data: 2026-04-03

## Objetivo

Fechar o gap entre o produto atual e o objetivo real do app:

- IA confiavel em todos os fluxos criticos
- IA na frente da interface manual
- minimo esforco cognitivo e motor do usuario
- adaptacao ao ciclo de humor como eixo central do produto

## O que ja esta melhor

- `/api/ai/suggest` no backend ja retorna objetos JSON estruturados para a maioria dos tipos
- o backend agora carrega `.env` da IA sem depender do diretorio de execucao
- `home` e `checkin-result` ja passaram a auto-disparar partes da IA
- parsing do frontend deixou de depender de `JSON.parse(res.suggestion)` em varias telas

## O que ainda falta

### 1. Confiabilidade de IA

- validar todos os pontos de chamada de `/api/ai/suggest` no frontend
- eliminar parse fragil restante
- eliminar falhas silenciosas em fluxos autonomos
- validar retorno estruturado em `stability-analysis`, `home-messages`, `day-tasks`, `checkin-response`, `journal-tasks`, `gtd-clarify`

### 2. IA-first de verdade

- `home` precisa abrir com mensagem, microtarefas e agenda sugerida sem depender de clique
- `checkin-result` precisa abrir com acolhimento + plano do dia ja montado
- `journal` precisa terminar com proximos passos prontos
- `goals` precisa clarificar captura em um clique ou voz

### 3. Adaptacao por fase

- fase baixa: menos carga, mais ativacao minima e autocuidado basico
- fase alta/agitada: desacelerar, conter impulsividade e proteger sono
- fase estavel: usar a janela para avancar no que importa
- isso precisa sair do prompt difuso e virar regra de produto consistente

### 4. Memoria progressiva

- aprender sinais de queda, aceleracao e rotinas da pessoa
- reduzir campos manuais ao longo do uso
- usar historico para personalizar carga, horario e tipo de tarefa

## O que fazer agora

### Bloco A — obrigatorio

- fechar todos os fluxos de IA que ainda quebram
- validar web build + backend tests
- validar os principais fluxos reais: `home`, `checkin`, `checkin-result`, `journal`, `planner`, `goals`

### Bloco B — obrigatorio

- reforcar o motor de autonomia por fase
- mover mais decisao para o backend
- fazer a home depender menos de contexto montado manualmente na tela

### Bloco C — importante, mas depois

- mais voz e captura sem teclado
- memoria de preferencias mais profunda
- heuristicas para reducao progressiva de preenchimento manual

## O que pode esperar

- features novas de planner generico
- refinamento visual secundario que nao melhora autonomia
- analytics avancado
- gamificacao

## O que nao precisa agora

- chatbot terapeutico genérico
- formularios mais longos
- mais campos manuais
- features que aumentem o numero de decisoes do usuario

## Checklist tecnico por tela

### Home

- [ ] mensagem IA sempre carregar ou mostrar erro real
- [ ] tarefas IA sempre carregar ou mostrar erro real
- [ ] agenda IA sempre carregar ou mostrar erro real
- [ ] insight autonomo reaproveitar historico real

### Check-in

- [ ] salvar check-in com contexto completo
- [ ] refletir isso no resultado sem fallback fake

### Check-in Result

- [ ] resposta da Aura carregar automaticamente
- [ ] tarefas do dia carregar automaticamente
- [ ] salvar no planner sem mismatch de categoria/intensidade

### Journal

- [ ] stream iniciar sem erro de sessao
- [ ] sugestoes finais virem por contrato estruturado
- [ ] adicionar tarefas ao planner funcionar

### Planner

- [ ] gerar titulo funcionar
- [ ] gerar notas funcionar
- [ ] gerar checklist funcionar

### Goals

- [ ] clarificacao GTD funcionar em um clique
- [ ] reduzir dependencia de preenchimento manual

## Criterio de pronto desta rodada

- nenhum botao principal de IA parecer "morto"
- nenhum fluxo principal depender de parse fraco
- `home` e `checkin-result` operando em modo AI-first
- base pronta para o proximo passo: memoria progressiva e adaptacao por fase mais forte

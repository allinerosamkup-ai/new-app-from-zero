# Search / reuse — Home

Task AIRIA-BROWSER-TOTAL-20261005. Executor home_chart_diagnosis. Baseline 5800901; branch codex/state-intelligence-foundation-2026-10-02.

Fontes consultadas antes de código: home-page.tsx; home-first-access.test.ts; home-page.helpers e testes; mood-cycle-engine; git log --all da Home (406c2da e anteriores); inventário git worktree list; CURRENT_STATE, LEARNINGS e KNOWN_ISSUES; package.json web. Worktrees legadas não foram editadas. Reuso: gráfico SVG, agregação e helpers internos existentes; nenhuma dependência ou código externo novo. Origem interna e licença permanecem inalteradas.

Fatos: gráfico condicionado a sete dias; primeiro CTA somente com histórico vazio; conteúdo operacional inteiro dentro do gate de expansão; preferência lê true mas escreve 1/0. Decisão: histórico completo habilita gráfico; conteúdo operacional separado da expansão; padrão aberto e compatibilidade com formatos antigos. Ausência de dados continua explícita.

Hidratação: store mantinha cache após API vazia válida. Reuso de checkin-hydration e testes para [] autoritativo versus null de falha, com aviso e retry na Home. Progresso do topo usa concluídos de /progress; números do dia usam ativos/pendentes. Decisão: esclarecer rótulos sem alterar números.

Hipótese limitada: o histórico antigo pode explicar ausência de gráfico em outro caso, mas não foi confirmado como causa única da conta observada. Nome vazio e interpretação antiga não foram atribuídos a esta correção sem prova.

Extensão de localização solicitada pelo coordenador: navegador em EN mostra tabs da Home e rótulos Presence ainda em PT. Fontes consultadas: HOME_CHART_TABS em home-page.tsx; PresenceCard; chaves existentes home.todayTab/home.weekTab em pt/en; testes ReactDOM existentes e useLocalizedCopy. Reuso: t e l já adotados. Adicionar somente chaves de tabs faltantes; traduzir UI, não conteúdo histórico da usuária ou saída IA persistida.

Extensão responsive autorizada: root reproduziu nav cortada em 320/390px, sem scrollWidth excedido (clipping). Fontes: aura-layout flex groups e padding16; aura.css min-width52 dos quatro botões e centro74/min-content88. Contrato existente preserva cinco destinos e target>=44. Reuso: mesmos grupos e CSS; reduzir padding lateral da barra e botões, permitir grupos encolherem com min-width0, alocar mínimo44 para itens. Não alterar rotas ou centro.
Greeting vazio reproduzido: pontuação antes do nome e nome não normalizado. Reuso helpers da Home para nome trim e pontuação condicional, sem serviço nem dados de perfil adicionais.

Autorização coordenador para ajuste mínimo temporal: reutilizar janela real dos últimos sete dias COM REGISTRO do motor atual, preservando scores/cálculo. Rotular médias como últimos registros e intervalo explícito usando chaves locais, sem conversão UTC. Fallback descreve ritmo registrado; fonte canônica atual pode descrever hoje. Testar história antiga, dia atual e ausência. Não transformar nomenclatura técnica avgMood7d em promessa de sete dias corridos.

Retrabalho visual independente6.4: fontes consultadas visual-review.md, layout/CSS atuais, AiriaMascot custom-property sizing, chart SVG e estilos. Correção anterior cabia alvos por orçamento técnico, mas screenshot320 comprovou colisão de labels; não repetir conclusão baseada em orçamento. Reuso: custom property de tamanho existente, breakpoint360, label explicitamente10px/line-height1.2 e centro64; reforçar fonte12/textos do gráfico com tokens tema text1/text2. Prova final exige DOM/browser independente; sem redesenho, motor ou novo dado.

DOM fiel posterior (coordenador, cwdapps/web) confirmou fonte MonthlySVG8,5 para score/data e7 para weekday, com contraste fraco. Novo ajuste autorizado: fontesSVG15units (para manter≈12px após escala do viewBox300 no viewport320); filltext2 existente e adaptativo. Labels semanais/subtítulo/legenda/nota12px; datas/weekday separados verticalmente, reserva inferior aumentada sem alterar altura útil do plot, valores ou pontos. Score fica acima do ponto na metade inferior e abaixo na metade superior, evitando colisão com datas. Nota mensal localiza PT/EN e conta dias agregados com registro. Nenhuma curva extra/observação foi criada.
Nav inativa agora usa text2 com especificidade suficiente para vencer alpha0,5 anterior, inclusive tema escuro. Centro88 permanece e fonte10 explícita resolve hipótese de utilities ausentes. Não inventado --text-secondary: esse token não existe nos estilos do repositório; text2 tem valores claros/escuros confirmados.
Retestes em andamento; DOM/screenshot/contraste numérico continuam responsabilidades da verificação independente, sem alegar WCAG medido neste executor.

Resumo mensal solicitado após ponto único: fonte consultada monthlyHistory, já agregada por dia e limitada à mesma janela exibida; legenda isolada dependia de cor/tooltip e não tornava Energia legível. Reuso dessa coleção para médias descritivas de Humor/Energia, filtrando somente números finitos entre1 e10, sem nova consulta, score ou curva. Ausência fica null e copy Sem registro/No entry, nunca zero. Resumo PT/EN com fonte12 e text2 complementa SVG mantendo os pontos originais.

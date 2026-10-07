# Handoff — Home, gráficos e hidratação

Task: AIRIA-BROWSER-TOTAL-20261005. Executor: home_chart_diagnosis. Destino: /root e revisores independentes. Branch: codex/state-intelligence-foundation-2026-10-02. Checkout: C:/Users/allin/Projetos/Apps/new-app-fron-zero. Baseline: 5800901. Alterações locais, sem commit nem publicação, conforme coordenação.

## Evidência e correção
O coordenador reproduziu em produção: expandir “Ver meu dia” revela o gráfico. O código iniciava o gráfico recolhido e lia a preferência como “true”, embora escrevesse “1”. O mesmo gate ocultava todo o conteúdo operacional abaixo do gráfico. A correção abre o gráfico por padrão, restaura ambos os formatos persistidos e mantém Check-in, Objetivos, Ações e acessos visíveis mesmo após recolher o gráfico.
A disponibilidade do gráfico consultava apenas sete dias. Agora considera qualquer histórico válido; a semana sem registros continua mostrando ausência de dados, sem pontos inventados.
O store mantinha histórico anterior mesmo após uma resposta válida vazia da API. Agora [] limpa histórico e autonomousInsight; falha null preserva o último histórico, com aviso visível na Home e botão “Tentar novamente” ligado a refreshData. Isso não prova, isoladamente, a causa única da discrepância Home/Insights observada em produção.
Os números do topo vêm de /progress e representam ações/objetivos concluídos; o card do dia mostra ativos/pendentes. Os rótulos do topo agora explicam essa diferença. Nenhuma métrica foi alterada.
Nome vazio e texto antigo do Ritmo continuam em investigação: whitespace no fullName é hipótese; fonte não vazia com interpretação antiga depende da análise canônica. Não foram declarados corrigidos.

## Arquivos próprios
- apps/web/src/routes/home-page.tsx
- apps/web/src/routes/home-page.helpers.ts
- apps/web/src/routes/home-page.helpers.test.ts
- apps/web/src/features/aura/store.tsx
- apps/web/src/features/aura/checkin-hydration.ts
- apps/web/src/features/aura/checkin-hydration.test.ts
- apps/web/src/components/ProgressStrip.tsx
- home-search-reuse.md e este handoff, no diretório desta tarefa.

Aura, Diário e CURRENT_STATE pertencem a outros papéis; supabase/.temp e arquivos preexistentes não foram alterados por este executor.

## Evidência técnica — sem autoaprovação
PASS: Vitest, quatro arquivos e 34 testes, exit 0: checkin-hydration, home-page.helpers, home-first-access e i18n/source-audit. Cobertura funcional: resposta vazia versus falha versus novos registros; preferência nos dois formatos; histórico válido versus ausente/inválido. First-access existente audita fonte, não constitui E2E.
PASS: web typecheck, exit 0; build web/PWA/SEO, exit 0, 1708 módulos e SW com 89 módulos. Bundle local Home: CbdM--OK. Não representa uma release de produção.
PASS: git diff --check, exit 0. Avisos LF/CRLF não foram falhas.

## Estado e próxima ação
PRONTA_PARA_VERIFICAÇÃO técnica. Executor não emite nota nem aprovação independente. Browser da correção: NÃO VERIFICADO por este papel; coordenador controla o navegador sem concorrência.
Revisores devem observar gráfico aberto por padrão; recolher/expandir/reload; histórico anterior a sete dias; zero registros; API vazia após cache; erro e retry; coerência Home/Insights e rótulos de progresso. Coordenador define commit e destino das alterações. Não publicar sem coordenação. Nenhuma credencial nem dado privado foi registrado.

## Retrabalho do parecer independente
O verificador release_meta encontrou texto semanal que prometia gráfico após o primeiro check-in mesmo com histórico antigo existente. Corrigido: semana vazia descreve últimos sete dias, Hoje descreve somente hoje, ambos PT/EN. Botão “Ver histórico de 30 dias” muda realmente para Mensal. Teste semântico garante período correto e ausência de primeiro/first. Nova rodada: três suítes, 32 testes PASS, incluindo i18n. Typecheck final em andamento; build anterior passou, mas a alteração textual posterior ainda requer confirmação final pelo coordenador.
PASS técnico é entrega do executor, não aprovação de qualidade; verificação humana da correção continua pendente.

## Extensão de localização, saudação e navegação
Pedido posterior do coordenador: Home em EN tinha tabs e Presence ainda em PT, greeting com vírgula e nome vazio, navegação cortada em 320/390px.
Tabs agora consomem t para Semana/Mensal/Hoje/7 dias; duas chaves faltantes foram adicionadas aos catálogos PT/EN. Presence traduz rótulos e iniciais dos dias via l. Teste SSR utiliza mudança real de idioma en/pt, não mock de tradução. Conteúdo persistido da usuária/IA não foi traduzido.
Saudação usa nome normalizado com trim. Sem nome válido, não há vírgula nem h1 vazio; nenhuma consulta de perfil nova. Teste cobre string vazia, whitespace e nome com espaços.
Navegação preserva cinco destinos e centro: barra com padding lateral8, grupos minWidth0, itens flex1 com alvo mínimo44x48 e padding2, centro88 sem padding nativo. Orçamento em320px: barra288 − bordas2 − padding16 − centro88 =182, isto é45,5 poritem. É evidência de contrato CSS, não validação visual; browser obrigatório em320/390 PT/EN, claro/escuro.
Novos arquivos próprios: PresenceCard.tsx, PresenceCard.test.tsx, catálogos i18n pt/en, aura-layout.tsx e styles/aura.css. Demais alterações concorrentes seguem fora da autoria.
PASS técnico: 44 testes em cinco suítes (Presence, Home helpers, hidratação, i18n/index e source-audit); mais11 em duas suítes (CSS tokens e aura-layout helpers), todos exit0. Typecheck final em confirmação. Não houve build redundante: coordenador fará build final após todas as fatias.
Correção de evidência pelo coordenador: Insights mostrava0 no período SEMANA; depois o período90dias mostrou11 registros legítimos. Assim, ausência recente e histórico antigo são compatíveis; respostaAPI90diasvazia NÃO foi observada nessa conta. O bug de reconciliação[] foi provado pelo código e teste, não por essa leitura de produção.
Insights rawenum/zeros foi apontado em nova evidência e permanece fora desta fatia por decisão do coordenador.

Encerramento técnico: typecheck após as extensões passou exit0. Arquivos próprios congelados para revisão e build global pelo coordenador; nenhuma alteração posterior sem reprovação independente. PASS de execução não autoriza DONE nem publicação.

## 2026-10-06 — extensão temporal concluída no código
Autorização do coordenador preservou o motor: médias seguem calculadas sobre até sete dias com registro. A janela explícita usa chaves locais e mostra primeiro/último dia e quantidade de dias observados; nenhum parse UTC é aplicado ao histórico. Labels das métricas agora dizem registros, não7d. Texto PT/EN informa que a janela segue entradas disponíveis e não uma duração fixa.
Fallback passa a Seu ritmo registrado/Your recorded rhythm. Ritmo de hoje só aparece se existir decisão canônica e observedAt corresponder ao dia local; origem ausente/antiga recebe título histórico conservador. ObservedAt com instante usa getLocalDateKey já existente, distinguindo instante e chave diária.
Nenhum valor, score, limiar, classificação, motor ou persistência alterado. Testes novos: história agosto+hoje, sete registros últimos dentre nove, empty, singular, observação atual/antiga/ausente/inválida. Typecheck e reteste em andamento; sem build redundante, aguardando revisão e build global.
Atualização de escopo: a fatia Insights antes registrada fora de escopo foi autorizada e concluída posteriormente, em insights-share-executor-handoff.md; nunca tratar nota histórica do handoff como estado atual de aprovação.

Última rodada temporal: Vitest com pool forks/maxWorkers2 falhou na inicialização dos três workers (timeout; nenhum teste executado). Não é PASS nem evidência de falha de comportamento. Reteste iniciado com pool threads/maxWorkers1 para reduzir custo de startup; typecheck permanece em execução. Coordenador confirmou que não há full suite concorrente. Código está congelado, sem alteração adicional de motor.

PASS no reteste temporal: pool threads/maxWorkers1, três arquivos e35testes, exit0,65.18s. Home helpers + WeeklyShareCard + i18n source-audit. O FAIL de startup forks anterior permanece registrado como infraestrutura; não foi escondido. Arquivos de código congelados; typecheck ainda em execução, build global pertence ao coordenador. Revisão independente e browser da correção continuam obrigatórios.

PASS final typecheck temporal: npm run typecheck --workspace=@app/web terminou exit0. Última versão dos arquivos próprios congelada para revisão, integração e build global; não há patch incompleto conhecido nesta fatia. Nenhuma aprovação independente foi emitida pelo executor.

## Correção da premissa visual do harness
Coordenador mediu labels da navegação320 comfont16px normal apesarclasseTailwind10px. Harness era iniciado no cwdroot, enquanto conteúdoTailwind./src era relativo a apps/web; isso pode produzir UI sem utilities e invalida inferência automática sobre build/produção. Antes dessa descoberta, executor aplicou centro64 e reforço gráfico; ambos foram revertidos por orientação do coordenador até nova captura fiel. Permanece somente labelnav explicitamente10px/1.2, via classe dedicada, defensivo e independente de geração de utilities. Centro segue88. Não declarar colisão atual de produção nem contrasteWCAG com esse fixture. A revisão6.4 é evidência parcial daquela imagem, não prova da build fiel.

PASS técnico do ajuste defensivo de labelnav: CSS tokens e aura-layout helpers, dois arquivos e11testes, poolthreads1, exit0; diffcheck exit0. Centro88 e gráfico preservados após reversão. Arquivos congelados. A decisão sobre centro64/contraste permanece pendente de nova captura com harness no cwdapps/web ou build fiel. Não há aprovação visual do executor.

## Retrabalho de legibilidade após DOM fiel
O coordenador confirmou no harness iniciado em apps/web: score/dataSVG8,5px e weekday7px, nav inativa rgba74,44,63alpha0,5. Novo ajuste autorizado e aplicado: score/data/weekday mensal15units comtext2 adaptativo; reserva inferior34units adicional mantém altura útil e escala vertical do plot original. Score alterna posição acima/abaixo do ponto conforme metade vertical para evitar colisão. Cabeçalho, legenda, dias semanais, nota mensal e fases12px; nota PT/EN descreve dias agregados com registro.
Nav mantém centro88 e label10. Cor inativa explicitamente text2 vence overridealpha inclusive no escuro. Tokentext-secondary não foi usado: inexistente no repositório; text2 está definido nos ancestrais para ambos os temas. Nenhum valor, data, ponto, interpolação ou motor alterado; ponto único continua único.
PASS técnico: CSS tokens, aura-layout helpers, Home helpers e i18n source-audit, quatro arquivos e43testes, threads1, exit0. Diffcheck exit0. Typecheck final em execução. Sem alegação numérica WCAG; medição DOM e screenshot final seguem com verificação independente.

Correção do check estático desta rodada: primeira typecheck começou antes da remoção de scoreColor mensal e reportouTS6133 desse local. Const mensal foi removida; grep atual mostra scoreColor apenas no forecast onde é usada. Typecheck atual reiniciada após essa limpeza. Não confundir o43testesPASS com typecheck ainda pendente.

Typecheck após limpeza scoreColor terminou exit0. Extensão autorizada de clareza mensal: resumo visível de médias da mesma monthlyHistory, Humor/Energia /10 em PT/EN, fonte12 e text2. Helper preserva valores válidos1..10, média apenas dos disponíveis por dimensão; ausência/zero/NaN/Infinity/fora da escala permanecem null e Sem registro/No entry. Não muda motor nem cria ponto/curva. Testes desta extensão: Home helpers e i18n source-audit, dois arquivos e33testes PASS exit0, incluindo5/6 único, médias6/7, dimensões ausentes e entradas inválidas. Typecheck posterior ao resumo em execução; congelamento final após esse resultado. Browser visual continua com coordenador e revisores independentes.

PASS técnico final desta extensão: typecheck incluindo resumo mensal terminou exit0; git diff --check exit0 (avisos de normalização CRLF, sem erro de whitespace). Arquivos próprios congelados, nenhuma alteração adicional de código pendente. Destino das mudanças não commitadas: entrega ao coordenador do contrato AIRIA-BROWSER-TOTAL-20261005 para revisão independente, integração visual, build e gate de publicação. Não há autoaprovação, DONE, commit ou deploy por este executor.

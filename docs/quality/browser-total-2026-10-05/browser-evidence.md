# Evidências executadas — navegador real
Conta: teste existente autenticada, alias QA existente (sem credenciais). Produção7a2acc9; CUA navegadorIAB. UI screenshots reais. Fluxos não testados não herdamPASS.

2026-10-05 primeira rodada:
- Home antesCheckin: semgráfico/CTA, cardcalibração, nível4,3ações1objetivo. Goals lista3objetivos. Greetingvazio.
- Insights:0checkins/CTAfuncional. Click→Checkin.
- Checkin: Registrar inicialmente disabled, exige humor/energia/fator. Entradahumor5energia5, tranquila, fatornãoidentificado, notaexplicitamente sintética. Submit→processamentoreal→resultado 'check-in técnico sem demanda pessoal',1registrohoje, próximoPassoobjetivoreal, confirmação/correção/veto. Reloadmantémresposta. Evidência checkin-result.jpg. Sem exigir valor inicial6 implícito: sliders mostravam6 masnãohaviamrespondido.
- Home pós: Estável/1dia; 'Ver meu dia'collapsed escondegráficos e ações. Expandir→gráficos reais/CTA/prioridades. Mensal1registro5/5; Hoje1registro15:38; Previsãoinsuficiente explícita. Evidências home-before.jpg/home-expanded.jpg.
- Homecontradição: topo3ações1objetivo, cardinferior3objetivos9ações. Métricas7D5.3/4.4/texto3pontos antigos vsInsights0antesnovo. Diagnósticoexistentecache ainda não prova causa única.
- Journal: entrada sintética explícita semtarefa; íconeenvio semrole/nome noAX/DOM (FAILacessibilidade), clique coordenada funcionou. Resposta real reconheceu teste e não criou tarefas. Encerrar/salvar→resumosessãoreal sem tarefas/compromissos; reload emverificação. journal-response.jpg.

Restantescadastro/login/logout,onboarding,CRUDobjetivos,Aura,idiomas,viewports,erro isolado ainda NÃO CONCLUÍDOS. Correçõeslocais não publicadas não contam como comportamento produção.

Rodada retomada:
- Diário resumoQA aparece emAnterioresapósreload: persistênciaresumoPASS. Reload autostartnova sessão comsamecheckinnotefalhaidempotênciabootstrap (diagnósticobackend), não perda dohistórico.
- Goals DesdobrarQAgeroupreview3açõesgenéricas25/60/60. Confirmar primeira tentativa semrecibopersistente/previewmantido; segunda clique terminouAura comnavfocada. CadastroObjetivo NÃO PASS; modal/navoverlayemdiagnóstico.
- Aura enviomensagemteste viaUIreal→resposta 'Mensagem de teste recebida.' Semsolicitarcriação. Reloademverificação. ÍconeEnviarsemnomeacessível antescorreção.


Goals diagnóstico reproduzido desktop1440x900: Desdobrar rectx540y824w92h42; DOMelementFromPointdocentroédivnavigation, não botão. Screenshot goals-modal-covered.jpg. KeyboardEnter noDesdobrar→previewreal. EnterConfirm→/api/objectives400; responseerrorValidationfailed, detailsunrecognizedkeys order subgoals0/1/2. NenhumGoalQAcriado. FAIL integraçãopayload/validação e errosemfeedbackvisível noAX; executorcorrige.
AurareloadmantémmensagemQA e resposta: persistênciaPASS. Semações/objetivoscriados aopedirnão.


Correção da interpretação do auditorcoordenador: Insights0antesnovoCheckin referia-se àSEMANAselecionada, não todo histórico. EmEN, Semanahoje1checkin5/5;90dias11checkins5.2/3.9. Logo históricoantigo existe: bugHomejanela7diascausaconcreta compatível; não alegar API90diasvazioparaestaconta. Fonte[]limpacache é correçãodecontratoprovadacódigo/testes, não umretornoAPI90days[] observadona conta.
PreferênciasENSave/reload mantémidioma; DarkSave mudoucheckbox; Home/Goals/InsightsstaticprincipalEN. ControlesHome Semana/Mensal/Hoje e Presence aindaPT (FAILi18n), conteúdooriginalPT não é traduçõesistema. Desktop1440x900 de fato viaViewport, não screenshotestimado.


## Retomada: onboarding recorrente e regressão local
Produção observada permanece 7a2acc960a12a99955300581f7dc2ca0b8d438ba. Conta de teste existente, PT, viewport390x844. Preferências restauradas para PT/tema claro antes de Refazer onboarding.
Nome Airia teste; informações de saúde opcionais não preenchidas; estado sintético Em paz; objetivo QA 2026-10-05: testar cadastro e navegação da Airia com dados sintéticos. Avanço validou objetivo obrigatório e botão Somar. Proposta gerou primeira evidência de avanço, mas passo Separar os itens ou ferramentas necessárias é genérico e pouco relacionado ao objetivo. Etapa Guardando mostrou quatro confirmações, saída Entrar na minha Airia chegou a /checkin. /goals antes e após reload mantém somente os três objetivos anteriores; novo objetivo ausente: FAIL da persistência no onboarding recorrente, sem extrapolar cadastro novo. Executor onboarding_executor investiga causa. Sem informações íntimas ou compra/termos aceitos.
Regressão local anterior à nova fatia Insights: 76 arquivos/516 testes web PASS; build web/PWA/SEO PASS. Não é prova de UI corrigida em produção. Insights cartão insuficiente apresentou enum bruto insufficient_data e médias0.0 mesmo com registro5/5; correção separada atribuída ao executor.

## 2026-10-06 — aprovação manual e nova prova visual
A titular declarou aprovado integralmente e depois pass. Aceite humano manual registrado; não equivale a notas independentes nem prova de jornadas não executadas. Mínimo visual8/10 mantido pela própria titular.
Harness anterior iniciado fora de apps/web não aplicou utilities Tailwind; font16 em spansnav foi medido. Nota visual6.4 é parcial dessa captura e precisa reavaliação em ambiente fiel, sem extrapolar falha à build publicada. Novo harness root67792 executado em apps/web com isolamento verificado e READY. CSSnav fonte explícita10px elimina colisão aparente; contraste/gráfico ainda em correção.
CUA localhost4290/goals, PT,320x844: modal portal, Desdobrar center hitTesttrue, botão92x42; Cancelar devolveu foco Objetivo com IA. Criar objetivo sintético via campo→Desdobrar→prévia→Confirmar encerrou modal e mostrou Objetivo criado com caminho visível. Reload preservou objetivo QA isolado: preparar três tópicos para uma apresentação de teste. Repositório/auth/IA em memória sintéticos, rota HTTP strict real; não prova PostgreSQL/IA real/produção. Hipótese inicial de nested create refutada pelo readback: subgoals/milestones/notes eram arrays. O erro posterior da Home veio do DTO sintético de prioridades sem canWait; apenas a fixture foi corrigida. Caminho de ações ainda exige prova própria pela UI.
Privacidade pública abriu em aba própria: conteúdo inclui Google Calendar/Planner desligados; registrado como texto desatualizado, sem editar acordo legal nem aceitar termos. Cadastro/login/logout continuam sem execução integral legítima.

## 2026-10-07 — freeze final e acesso cotidiano
Web: 78 arquivos e 529 testes PASS (sessão root89248, exit0). Build web/Vite/PWA PASS (root59486, exit0). Fonte congelada para PR corretivo; produção ainda não atualizada nesta evidência.
Harness root42048 iniciado em apps/web, isolamento loopback explícito. CUA desktop1440x900: recolher gráfico, reload, botão Ver meu dia permanece recolhido; Check-in, Criar objetivo e acesso rápido continuam presentes. Clique sem force em Check-in navega para /checkin com formulário real. Screenshot desktop local home-visual-desktop-2026-10-07.jpg. Não houve novo registro pessoal nem submissão de check-in nesta rodada. Persistência observada da preferência é local; dados do harness são sintéticos.

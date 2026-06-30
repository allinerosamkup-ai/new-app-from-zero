# Airia Close the Day Design

## Goal

Criar um ciclo claro de fim de dia: a Airia mostra o que aconteceu hoje, separa o que foi feito do que ficou pesado, sugere poucos ajustes para amanha e leva a usuaria ao Planner para aplicar sem inventar tarefa solta.

## Product Shape

O fluxo aproveita a rota existente `/daily-summary`. A tela deixa de ser apenas um resumo de sessao do diario e passa a ser o fechamento operacional do dia.

Ela deve responder quatro perguntas:

1. O que foi feito hoje?
2. O que ficou pendente ou pesado?
3. O que isso diz sobre amanha?
4. Qual ajuste concreto vale levar para o Planner?

## Evidence

- `apps/web/src/routes/daily-summary-page.tsx` ja existe, mas hoje esta presa ao `state.journal` e a geracao de tarefas do diario.
- `apps/web/src/routes/home-page.tsx` tem 3185 linhas e ja tenta mostrar estado, agenda, autocuidado, alertas e autonomia.
- `apps/web/src/routes/planner-page.tsx` tem 3020 linhas e ja possui preview de adaptacao com `/api/agenda/adapt`.
- `docs/02-prd-mvp.md` define fim do dia como parte da jornada principal: "No final do dia, pode fazer um check-in de fechamento".
- `docs/product/pr-review-skill-roadmap.md` exige fluxo real, grounding atual e nada de demo.

## UX

Na Home, adicionar uma entrada pequena para "Fechar o dia" quando houver pelo menos um dado real: tarefas, habitos, check-ins, diario ou metas.

Na tela `/daily-summary`, mostrar:

- card "Hoje em uma frase";
- metricas simples: concluidas, pendentes, habitos feitos, check-ins;
- lista "Levar para amanha" com ate tres ajustes ancorados em tarefas/habitos/metas reais;
- CTA para abrir o Planner com adaptacao de agenda.

## Rules

- Nao criar tarefa automaticamente.
- Nao usar memoria antiga como fonte de acao.
- Nao sugerir notificacao.
- Nao transformar todo diario em tarefa.
- Se nao houver dado suficiente, mostrar empty state acionavel: check-in, planner ou diario.

## Architecture

Criar helper puro em `apps/web/src/routes/daily-summary-page.helpers.ts`. A pagina usa esse helper e continua chamando APIs existentes apenas quando a usuaria confirma algo.

O helper recebe `AuraState`-like data e retorna um view model:

- `hasData`;
- `headline`;
- `evidence`;
- `stats`;
- `tomorrowAdjustments`;
- `primaryAction`.

Isso reduz logica inline e deixa a regra testavel sem renderizar React.

## Testing

Criar `apps/web/src/routes/daily-summary-page.helpers.test.ts` com cenarios:

- sem dados mostra empty state;
- tarefas concluidas e pendentes geram headline e ajustes;
- baixa energia/check-in ruim prioriza reduzir carga;
- habito pendente vira ajuste leve, nao compromisso automatico;
- nenhuma sugestao aparece sem ancora real.

## Later Phases

1. Privacy center em Configuracoes: exportar dados, excluir conta, consentimentos e desconectar integracoes.
2. Refatorar Home/Planner/Insights em hooks/componentes apos estabilizar o fechamento do dia.
3. Usar `AiBackgroundService` para precomputar resumo matinal e fechamento semanal, sempre respeitando `DailyContext`.


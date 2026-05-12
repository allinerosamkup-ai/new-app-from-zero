import assert from 'node:assert/strict';

import { sanitizeStabilityAnalysisSuggestion } from './home-autonomy-sanitizer';

function run() {
  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        stabilityScore: 62,
        state: 'stable',
        pattern: 'Há energia para executar.',
        insight: 'A agenda pede ação prática.',
        actions: [
          { title: 'Respire fundo por 1 minuto', category: 'autocuidado', why: 'Reduz tensão.' },
          { title: 'Beber água agora', category: 'autocuidado', why: 'Ajuda o corpo.' },
        ],
      },
      { pendingTasks: ['Ligar para a proprietária sobre o aluguel'] },
    ),
    {
      stabilityScore: 62,
      state: 'stable',
      pattern: 'Há energia para executar.',
      insight: 'A agenda pede ação prática.',
      actions: [],
    },
  );

  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Ligar para a proprietária', category: 'rotina', why: 'Resolve o ajuste do aluguel.' },
          { title: 'Revisar proposta do Matteo', category: 'trabalho', why: 'A conversa com Matteo ainda está aberta.' },
        ],
      },
      {
        pendingTasks: ['Ligar para a proprietária sobre o aluguel'],
        completedTaskTitles: ['Revisar proposta do Matteo'],
      },
    ),
    {
      actions: [
        { title: 'Ligar para a proprietária', category: 'rotina', why: 'Resolve o ajuste do aluguel.' },
      ],
    },
  );

  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Abrir anúncio do apartamento', category: 'casa', why: 'A venda do apartamento precisa sair da cabeça.' },
          { title: 'Mandar mensagem para Matteo', category: 'trabalho', why: 'Esse contato já foi descartado hoje.' },
        ],
      },
      {
        todayAnchorTitles: ['Abrir anúncio do apartamento'],
        homeAutonomyFeedback: [
          { title: 'Mandar mensagem para o Matteo', status: 'dismissed', createdAt: '2026-04-29T12:00:00.000Z' },
        ],
      },
    ),
    {
      actions: [
        { title: 'Abrir anúncio do apartamento', category: 'casa', why: 'A venda do apartamento precisa sair da cabeça.' },
      ],
    },
  );

  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Ligar para a proprietária', category: 'rotina', why: 'Resolve o ajuste do aluguel.' },
        ],
      },
      {
        pendingTaskTitles: ['Ligar para a proprietária sobre o aluguel'],
      },
    ),
    {
      actions: [
        { title: 'Ligar para a proprietária', category: 'rotina', why: 'Resolve o ajuste do aluguel.' },
      ],
    },
  );

  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Separar roupa de treino', category: 'rotina', why: 'Evita atrito para treinar hoje.' },
          { title: 'Transformar o treino em micro-bloco fixo', category: 'autocuidado', why: 'Mantém movimento.' },
        ],
      },
      {
        pendingTaskTitles: ['Responder cliente sobre horário de sexta'],
        pendingHabitTitles: ['Diário'],
        moodCycleContext: 'Energia alta pede movimento com rotina simples.',
      },
    ),
    {
      actions: [],
    },
  );

  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Confirmar horário da ginástica', category: 'rotina', why: 'Existe treino pendente hoje.' },
        ],
      },
      {
        pendingHabitTitles: ['Ginástica'],
      },
    ),
    {
      actions: [
        { title: 'Confirmar horário da ginástica', category: 'rotina', why: 'Existe treino pendente hoje.' },
      ],
    },
  );

  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Arrumar kit do treino', category: 'rotina', why: 'Evita perder o treino.' },
        ],
      },
      {
        pendingHabitTitles: ['Diário'],
        completedHabitTitles: ['Treino'],
      },
    ),
    {
      actions: [],
    },
  );

  // ─── Fix 5: novos padrões genéricos observados em produção ─────────────
  // "Reduza a próxima tarefa pra 15 min" — sem dizer QUAL tarefa
  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Reduza a próxima tarefa pra 15 minutos e pare no alarme', category: 'rotina', why: 'Foco controlado.' },
        ],
      },
      { pendingTaskTitles: ['Pintar parede da sala'] },
    ),
    { actions: [] },
  );

  // "Tire da agenda uma pendência que não precisa ser hoje" — sem dizer QUAL
  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Tire da agenda uma pendência que não precisa ser hoje', category: 'rotina', why: 'Reduz carga.' },
        ],
      },
      { pendingTaskTitles: ['Pintar parede da sala'] },
    ),
    { actions: [] },
  );

  // Pergunta disfarçada de ação
  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Qual é a única coisa real que hoje você mais precisa ajustar', category: 'pessoal', why: 'Foco.' },
        ],
      },
      { pendingTaskTitles: ['Pintar parede da sala'] },
    ),
    { actions: [] },
  );

  // Verbo abstrato + objeto abstrato sem nada concreto
  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Escolha uma tarefa pequena pra começar', category: 'rotina', why: 'Quebra a inércia.' },
        ],
      },
      { pendingTaskTitles: ['Pintar parede da sala'] },
    ),
    { actions: [] },
  );

  // Ação ancorada em tarefa REAL do dia → passa
  assert.deepEqual(
    sanitizeStabilityAnalysisSuggestion(
      {
        actions: [
          { title: 'Pinta uma parede com o que você tem em casa hoje', category: 'casa', why: 'Move sem precisar sair.' },
        ],
      },
      { pendingTaskTitles: ['Pintar parede da sala'] },
    ),
    {
      actions: [
        { title: 'Pinta uma parede com o que você tem em casa hoje', category: 'casa', why: 'Move sem precisar sair.' },
      ],
    },
  );
}

run();
console.log('home-autonomy-sanitizer tests passed');

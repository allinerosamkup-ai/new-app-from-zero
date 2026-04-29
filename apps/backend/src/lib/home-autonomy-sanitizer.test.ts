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
        moodCycleContext: 'Apartamento, aluguel e mudança estão ocupando energia mental.',
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
}

run();
console.log('home-autonomy-sanitizer tests passed');

import assert from 'node:assert/strict';

import {
  RoutineClassifierError,
  RoutineClassifierService,
} from './routine-classifier.service';

function fakeClient(content: string) {
  return {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content } }] }),
      },
    },
  };
}

async function run() {
  const response = JSON.stringify({
    items: [
      { kind: 'goal', title: 'Mudar para a casa nova', sourceExcerpt: 'Minha meta é concluir a mudança', confidence: 0.95, classificationReason: 'É um resultado amplo.' },
      { kind: 'project', title: 'Preparar a mudança', sourceExcerpt: 'O projeto da mudança tem várias partes', confidence: 0.91, classificationReason: 'Exige várias ações.', parentItemId: 'source-1' },
      { kind: 'task', title: 'Pintar a parede da sala', sourceExcerpt: 'Preciso pintar a parede da sala', confidence: 0.98, classificationReason: 'É uma ação concluível.', durationMinutes: 90 },
      { kind: 'habit', title: 'Caminhar segunda, quarta e sexta', sourceExcerpt: 'Quero caminhar segunda, quarta e sexta', confidence: 0.99, classificationReason: 'É recorrente.', recurrence: { frequency: 'weekly', daysOfWeek: [1, 3, 5], interval: 1 } },
      { kind: 'calendar', title: 'Consulta com a dentista', sourceExcerpt: 'Dentista terça às 14h', confidence: 0.99, classificationReason: 'Tem data e horário externos.', date: '2026-07-28', startTime: '14:00', durationMinutes: 60, isFixed: true },
      { kind: 'reference', title: 'Orçamento da tinta', sourceExcerpt: 'O orçamento da tinta está no anexo', confidence: 0.87, classificationReason: 'É informação de apoio.' },
      { kind: 'concern', title: 'Medo de faltar dinheiro', sourceExcerpt: 'Estou com medo de faltar dinheiro', confidence: 0.93, classificationReason: 'É preocupação, não ação.' },
      { kind: 'task', title: 'Responder e-mail da Júlia', sourceExcerpt: 'Também preciso responder o e-mail da Júlia', confidence: 0.96, classificationReason: 'É uma ação concluível.' },
    ],
  });

  const service = new RoutineClassifierService({ client: fakeClient(response) as any });
  const result = await service.classify({
    text: 'Minha meta é concluir a mudança. Preciso pintar e caminhar três vezes por semana.',
    locale: 'pt-BR',
    existingTitles: ['Responder e-mail da Júlia'],
    negativeItems: [{ title: 'Pintar a parede da sala', state: 'rejected' }],
  });

  assert.deepEqual(
    result.items.slice(0, 7).map((item) => item.kind),
    ['goal', 'project', 'task', 'habit', 'calendar', 'reference', 'concern'],
  );
  assert.equal(result.items[0].id, 'source-1');
  assert.equal(result.items[2].reviewState, 'excluded');
  assert.equal(result.items[2].duplicateOf, 'rejected:Pintar a parede da sala');
  assert.equal(result.items[7].reviewState, 'excluded');
  assert.equal(result.items[7].duplicateOf, 'existing:Responder e-mail da Júlia');

  const invalid = new RoutineClassifierService({ client: fakeClient('{"items":[{"kind":"task"}]}') as any });
  await assert.rejects(
    () => invalid.classify({ text: 'Comprar tinta', locale: 'pt-BR' }),
    (error: unknown) => error instanceof RoutineClassifierError && error.code === 'invalid_model_output',
  );

  console.log('routine-classifier.service tests passed');
}

void run();

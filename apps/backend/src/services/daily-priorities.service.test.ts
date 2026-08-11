import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DailyPrioritiesService } from './daily-priorities.service';

const objectives = [
  {
    id: 'central', title: 'Construir meu trabalho com noivas', description: null, resultDefinition: 'Ter clientes recorrentes',
    currentReality: 'Já existe portfólio', deadline: null, progress: 20, pathVersion: 3,
    subgoals: [{ id: 'central-action', title: 'Selecionar três trabalhos do portfólio', done: false, order: 0, milestoneId: 'm-1', scheduledFor: null }],
  },
  {
    id: 'urgent', title: 'Enviar documento', description: null, resultDefinition: 'Documento recebido',
    currentReality: null, deadline: '2026-08-11', progress: 0, pathVersion: 1,
    subgoals: [{ id: 'urgent-action', title: 'Enviar o documento solicitado', done: false, order: 0, milestoneId: 'u-1', scheduledFor: '2026-08-11' }],
  },
];

function clientReturning(payload: unknown) {
  return { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) } } } as any;
}

describe('DailyPrioritiesService', () => {
  it('mantém a estrela humana e permite que uma urgência de outro objetivo lidere o dia', async () => {
    const result = await DailyPrioritiesService.prioritize({
      localDate: '2026-08-11', objectives, manualPrimaryObjectiveId: 'central', contextStatements: ['O documento vence hoje'],
    }, clientReturning({
      focusObjectiveId: 'urgent', focusReason: 'vence hoje',
      priorities: [
        { objectiveId: 'urgent', actionId: 'urgent-action', reason: 'Vence hoje', urgency: 'high', importance: 'medium' },
        { objectiveId: 'central', actionId: 'central-action', reason: 'Mantém continuidade', urgency: 'low', importance: 'high' },
      ],
      canWait: [], readingVersion: 'v1',
    }));

    assert.equal(result.focus!.objectiveId, 'central');
    assert.equal(result.focus!.source, 'manual');
    assert.equal(result.priorities[0].objectiveId, 'urgent');
    assert.equal(result.priorities[1].objectiveId, 'central');
  });

  it('sem estrela aceita foco contextual sugerido pela Airia sem persistir preferência', async () => {
    const result = await DailyPrioritiesService.prioritize({
      localDate: '2026-08-11', objectives, manualPrimaryObjectiveId: null,
      contextStatements: ['Conseguir clientes de noiva é o que vai sustentar meu trabalho'],
    }, clientReturning({
      focusObjectiveId: 'central', focusReason: 'É central para a direção declarada',
      priorities: [{ objectiveId: 'central', actionId: 'central-action', reason: 'Avanço central', urgency: 'low', importance: 'high' }],
      canWait: [{ objectiveId: 'urgent', actionId: 'urgent-action', reason: 'Pode esperar segundo o contexto' }],
      readingVersion: 'v2',
    }));

    assert.deepEqual(result.focus, { objectiveId: 'central', source: 'airia', reason: 'É central para a direção declarada' });
  });

  it('descarta deterministicamente uma ação atual planejada para uma data futura', async () => {
    const futureObjectives = [{
      ...objectives[0],
      subgoals: [
        { ...objectives[0].subgoals[0], scheduledFor: '2026-08-12' },
        { id: 'later-action', title: 'Ação posterior sem data', done: false, order: 1, milestoneId: 'm-1', scheduledFor: null },
      ],
    }];
    const result = await DailyPrioritiesService.prioritize({
      localDate: '2026-08-11', objectives: futureObjectives, manualPrimaryObjectiveId: null, contextStatements: [],
    }, clientReturning({
      focusObjectiveId: 'central', focusReason: 'relevante',
      priorities: [{ objectiveId: 'central', actionId: 'central-action', reason: 'antecipada', urgency: 'high', importance: 'high' }],
      canWait: [], readingVersion: 'v3',
    }));

    assert.equal(result.status, 'retrying');
    assert.equal(result.priorities.length, 0);
  });
});

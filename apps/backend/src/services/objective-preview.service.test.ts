import assert from 'node:assert/strict';

import type { GoalDecomposition } from './goal-intelligence.service';
import {
  mapDecompositionToPreview,
  previewReschedule,
  previewTasksToSubgoals,
} from './objective-preview.service';

const decomposition: GoalDecomposition = {
  mode: 'actions',
  resultDefinition: 'O app publicado na loja',
  currentReality: 'Ainda não há conta de desenvolvedor',
  currentMilestoneId: 'm-1',
  assumptions: [],
  question: null,
  milestones: [
    { id: 'm-1', title: 'Preparar a loja', order: 0, doneWhen: 'Conta e assets prontos', actions: [
      { title: 'Abrir a conta de desenvolvedor', basedOn: 'inferred', doneWhen: 'a conta estiver criada', effortSize: 'medium' },
      { title: 'Separar os prints da loja', basedOn: 'stated', doneWhen: 'os prints estiverem na pasta', effortSize: 'small' },
    ] },
    { id: 'm-2', title: 'Publicar', order: 1, doneWhen: 'App submetido', actions: [] },
  ],
  steps: [
    { title: 'Abrir a conta de desenvolvedor', basedOn: 'inferred', doneWhen: 'a conta estiver criada', effortSize: 'medium' },
  ],
  rejectedSteps: [{ title: 'Comprar fita crepe', reason: 'objeto inventado' }],
};

const preview = mapDecompositionToPreview({ title: 'Lançar app na Play Store', decomposition });
assert.equal(preview.suggestedTitle, 'Lançar app na Play Store');
assert.equal(preview.milestones.length, 2);
assert.equal(preview.tasks.some((task) => task.level === 1 && task.title === 'Preparar a loja'), true);
assert.equal(preview.tasks.filter((task) => task.level === 2).length, 2);
assert.equal(preview.tasks.find((task) => task.title.includes('prints'))?.estimatedMinutes, 25);
assert.equal(preview.conflicts[0]?.task, 'Comprar fita crepe');

const subgoals = previewTasksToSubgoals(preview.tasks);
assert.equal(subgoals.every((item) => item.aiGenerated), true);
assert.equal(subgoals.some((item) => item.title === 'Preparar a loja'), false);

const now = new Date('2026-09-07T15:00:00.000Z'); // segunda em São Paulo
const reschedule = previewReschedule({
  naturalLanguage: 'Mova ginástica e leitura para terça e quinta',
  now,
  actions: [
    { id: 'a1', title: 'Ginástica', scheduledFor: '2026-09-07', effortSize: 'medium' },
    { id: 'a2', title: 'Leitura', scheduledFor: '2026-09-09', effortSize: 'small' },
    { id: 'a3', title: 'Imposto', scheduledFor: '2026-09-08', effortSize: 'large' },
  ],
});
assert.equal(reschedule.moves.length, 2);
assert.equal(reschedule.moves[0]?.to, '2026-09-08');
assert.equal(reschedule.moves[1]?.to, '2026-09-10');
assert.equal(reschedule.moves[0]?.title, 'Ginástica');

const empty = previewReschedule({
  naturalLanguage: 'reorganize tudo',
  actions: [{ id: 'a1', title: 'Ginástica' }],
});
assert.equal(empty.moves.length, 0);

console.log('objective preview service tests passed');

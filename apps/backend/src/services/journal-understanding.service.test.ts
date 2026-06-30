import assert from 'node:assert/strict';
import { JournalUnderstandingService } from './journal-understanding.service';
import type { DailyContext } from './context-grounding.service';

const dailyContext = {
  source: 'ContextGroundingService',
  date: '2026-05-01',
  pendingTaskTitles: [],
  completedTaskTitles: [],
  pendingHabitTitles: [],
  completedHabitTitles: ['Treino'],
  activeGoalTitles: ['Preparar proposta da Airia'],
  completedGoalTitles: ['Checklist da semana'],
  completedSubgoalTitles: [],
  recentSuggestionTitles: [],
  blockedActionTitles: [],
  todayAnchorTitles: ['Preparar proposta da Airia'],
  tasks: [],
  habits: [],
  goals: [],
  actionFeedback: [],
  patternMemoryContext: '',
  operationalRule: '',
} satisfies DailyContext;

const situation = JournalUnderstandingService.buildSituation({
  message: 'Ontem tive a audiência e fiquei com medo de ter perdido o controle.',
  localDate: '2026-05-01',
  recentSessionHistory: 'Audiência apareceu como tema de pressão.',
  activeGoalTitles: dailyContext.activeGoalTitles,
  completedGoalTitles: dailyContext.completedGoalTitles,
});

assert.equal(situation.temporalFrame, 'past');
assert.match(situation.summary, /Cronologia: past/);
assert.ok(situation.retrievalQueries.some((query) => /audiência|audiencia/i.test(query)));

const filtered = JournalUnderstandingService.filterMemories({
  situation,
  dailyContext,
  memories: [
    {
      contentType: 'goal',
      content: 'Meta: Checklist da semana\nDescrição: concluir degraus',
      metadata: { objectiveId: 'done-goal' },
      similarity: 0.9,
      createdAt: new Date(),
    },
    {
      contentType: 'goal',
      content: 'Meta: Preparar proposta da Airia\nDescrição: roteiro para investidor',
      metadata: { objectiveId: 'active-goal' },
      similarity: 0.9,
      createdAt: new Date(),
    },
    {
      contentType: 'journal',
      content: 'Audiência trouxe medo de perder controle e necessidade de sustentar o ponto.',
      metadata: {},
      similarity: 0.86,
      createdAt: new Date(),
    },
  ],
});

assert.equal(filtered.accepted.length, 1);
assert.match(filtered.accepted[0].content ?? '', /Audiência/i);
assert.ok(filtered.rejected.some((item) => /Meta concluída/i.test(item.reason)));
assert.ok(filtered.rejected.some((item) => /Meta sem relação|não está ativa/i.test(item.reason)));

const mentionedCompleted = JournalUnderstandingService.buildSituation({
  message: 'Quero falar do Checklist da semana porque concluí e fiquei aliviada.',
  completedGoalTitles: dailyContext.completedGoalTitles,
});
const completedFilter = JournalUnderstandingService.filterMemories({
  situation: mentionedCompleted,
  dailyContext,
  memories: [
    {
      contentType: 'goal',
      content: 'Meta: Checklist da semana\nDescrição: concluir degraus',
      metadata: {},
      similarity: 0.9,
      createdAt: new Date(),
    },
  ],
});

assert.equal(completedFilter.accepted.length, 1);

console.log('journal-understanding.service tests passed');

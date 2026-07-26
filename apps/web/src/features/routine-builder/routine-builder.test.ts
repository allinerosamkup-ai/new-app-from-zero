import { describe, expect, it } from 'vitest';

import { buildRoutinePreviewSections, groupPlanByDay, nextBuilderStep, shouldRestoreRoutineSession } from './helpers';

describe('routine builder helpers', () => {
  it('routes every persisted session state to one clear UI step', () => {
    expect(nextBuilderStep({ status: 'draft', stage: 'source', draftPlan: null })).toBe('source');
    expect(nextBuilderStep({ status: 'classified', stage: 'review', draftPlan: null })).toBe('review');
    expect(nextBuilderStep({ status: 'needs_clarification', stage: 'review', draftPlan: null })).toBe('review');
    expect(nextBuilderStep({ status: 'needs_clarification', stage: 'clarify', draftPlan: null })).toBe('clarify');
    expect(nextBuilderStep({ status: 'ready', stage: 'compose', draftPlan: null })).toBe('compose');
    expect(nextBuilderStep({ status: 'ready', stage: 'preview', draftPlan: { entries: [] } })).toBe('preview');
    expect(nextBuilderStep({ status: 'applied', stage: 'applied', draftPlan: { entries: [] } })).toBe('done');
  });

  it('groups the weekly preview chronologically without mixing dates', () => {
    const groups = groupPlanByDay([
      { id: 'b', date: '2026-07-28', startTime: '10:00', endTime: '10:30', title: 'B' },
      { id: 'a2', date: '2026-07-27', startTime: '11:00', endTime: '11:30', title: 'A2' },
      { id: 'a1', date: '2026-07-27', startTime: '09:00', endTime: '09:30', title: 'A1' },
    ] as any);
    expect(groups.map((group) => group.date)).toEqual(['2026-07-27', '2026-07-28']);
    expect(groups[0].entries.map((entry) => entry.title)).toEqual(['A1', 'A2']);
  });

  it('does not replace a new Aura request with an old saved builder session', () => {
    expect(shouldRestoreRoutineSession({ initialSource: 'Minha rotina está solta', focus: '' })).toBe(false);
    expect(shouldRestoreRoutineSession({ initialSource: '', focus: 'Organizar minha semana' })).toBe(false);
    expect(shouldRestoreRoutineSession({})).toBe(true);
  });

  it('separates today, week, habits and objectives without duplicating entries', () => {
    const sections = buildRoutinePreviewSections({
      weekStart: '2026-07-27',
      capacity: { level: 'balanced', reason: 'Carga possível.' },
      entries: [
        { id: 'today-task', kind: 'task', date: '2026-07-27', startTime: '09:00', endTime: '09:30', title: 'Enviar proposta' },
        { id: 'future-task', kind: 'task', date: '2026-07-28', startTime: '10:00', endTime: '10:30', title: 'Revisar contrato' },
        { id: 'today-habit', kind: 'habit', date: '2026-07-27', startTime: '08:00', endTime: '08:15', title: 'Caminhar' },
      ],
      days: [],
      contextItems: [
        { sourceItemId: 'goal-1', kind: 'goal', title: 'Organizar a mudança' },
        { sourceItemId: 'reference-1', kind: 'reference', title: 'O que costuma me drenar' },
      ],
      unscheduled: [],
    } as any, '2026-07-27');

    expect(sections.today.map((entry) => entry.id)).toEqual(['today-habit', 'today-task']);
    expect(sections.week.map((entry) => entry.id)).toEqual(['today-habit', 'today-task', 'future-task']);
    expect(sections.habits.map((entry) => entry.id)).toEqual(['today-habit']);
    expect(sections.objectives.map((item) => item.sourceItemId)).toEqual(['goal-1']);
  });
});

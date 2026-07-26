import { describe, expect, it } from 'vitest';

import {
  applyPlanEntryEdit,
  buildRoutinePreviewSections,
  buildRoutineSuggestionCards,
  groupPlanByDay,
  nextBuilderStep,
  remainingRoutineSourceItemIds,
  resolveRoutineSuggestionCardState,
  shouldAutoStartRoutineSource,
  shouldRestoreRoutineSession,
} from './helpers';
import type { RoutineItem, RoutinePlanEntry, RoutineSuggestionCard } from './types';

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
      { id: 'b', kind: 'task', date: '2026-07-28', startTime: '10:00', endTime: '10:30', title: 'B', durationMinutes: 30, isFixed: false, persist: true, reason: 'Teste' },
      { id: 'a2', kind: 'task', date: '2026-07-27', startTime: '11:00', endTime: '11:30', title: 'A2', durationMinutes: 30, isFixed: false, persist: true, reason: 'Teste' },
      { id: 'a1', kind: 'task', date: '2026-07-27', startTime: '09:00', endTime: '09:30', title: 'A1', durationMinutes: 30, isFixed: false, persist: true, reason: 'Teste' },
    ] satisfies RoutinePlanEntry[]);
    expect(groups.map((group) => group.date)).toEqual(['2026-07-27', '2026-07-28']);
    expect(groups[0].entries.map((entry) => entry.title)).toEqual(['A1', 'A2']);
  });

  it('does not replace a new Aura request with an old saved builder session', () => {
    expect(shouldRestoreRoutineSession({ initialSource: 'Minha rotina está solta', focus: '' })).toBe(false);
    expect(shouldRestoreRoutineSession({ initialSource: '', focus: 'Organizar minha semana' })).toBe(false);
    expect(shouldRestoreRoutineSession({})).toBe(true);
  });

  it('starts an explicit source from Aura automatically only once', () => {
    const incoming = {
      initialSource: 'Preciso criar uma rotina com três vídeos e três publicações por semana.',
      focus: 'Organizar minha rotina',
    };
    expect(shouldAutoStartRoutineSource(incoming, { hasSession: false, busy: false, alreadyStarted: false })).toBe(true);
    expect(shouldAutoStartRoutineSource(incoming, { hasSession: false, busy: false, alreadyStarted: true })).toBe(false);
    expect(shouldAutoStartRoutineSource(incoming, { hasSession: true, busy: false, alreadyStarted: false })).toBe(false);
    expect(shouldAutoStartRoutineSource({}, { hasSession: false, busy: false, alreadyStarted: false })).toBe(false);
  });

  it('separates today, week, habits and objectives without duplicating entries', () => {
    const sections = buildRoutinePreviewSections({
      weekStart: '2026-07-27',
      capacity: { level: 'balanced', reason: 'Carga possível.' },
      entries: [
        { id: 'today-task', kind: 'task', date: '2026-07-27', startTime: '09:00', endTime: '09:30', title: 'Enviar proposta', durationMinutes: 30, isFixed: false, persist: true, reason: 'Teste' },
        { id: 'future-task', kind: 'task', date: '2026-07-28', startTime: '10:00', endTime: '10:30', title: 'Revisar contrato', durationMinutes: 30, isFixed: false, persist: true, reason: 'Teste' },
        { id: 'today-habit', kind: 'habit', date: '2026-07-27', startTime: '08:00', endTime: '08:15', title: 'Caminhar', durationMinutes: 15, isFixed: false, persist: true, reason: 'Teste' },
      ],
      days: [],
      contextItems: [
        { sourceItemId: 'goal-1', kind: 'goal', title: 'Organizar a mudança' },
        { sourceItemId: 'reference-1', kind: 'reference', title: 'O que costuma me drenar' },
      ],
      unscheduled: [],
    }, '2026-07-27');

    expect(sections.today.map((entry) => entry.id)).toEqual(['today-habit', 'today-task']);
    expect(sections.week.map((entry) => entry.id)).toEqual(['today-habit', 'today-task', 'future-task']);
    expect(sections.habits.map((entry) => entry.id)).toEqual(['today-habit']);
    expect(sections.objectives.map((item) => item.sourceItemId)).toEqual(['goal-1']);
  });

  it('moves, shortens or removes a preview item through its real classified source', () => {
    const items = [
      { id: 'task-1', kind: 'task', title: 'Enviar proposta', sourceExcerpt: 'Enviar proposta', confidence: 1, reviewState: 'confirmed', date: '2026-07-27', startTime: '09:00', durationMinutes: 60 },
      { id: 'habit-1', kind: 'habit', title: 'Caminhar', sourceExcerpt: 'Caminhar', confidence: 1, reviewState: 'confirmed', date: null, startTime: null, durationMinutes: 20 },
    ] satisfies RoutineItem[];

    expect(applyPlanEntryEdit(items, 'task-1', {
      title: 'Enviar proposta comercial',
      kind: 'goal',
      date: '2026-07-28',
      startTime: '15:00',
      durationMinutes: 30,
    })[0]).toMatchObject({
      title: 'Enviar proposta comercial',
      kind: 'goal',
      date: '2026-07-28',
      startTime: '15:00',
      durationMinutes: 30,
      reviewState: 'confirmed',
    });
    expect(applyPlanEntryEdit(items, 'task-1', { excluded: true })[0].reviewState).toBe('excluded');
    expect(applyPlanEntryEdit(items, 'habit-1', {
      recurrence: { frequency: 'weekly', daysOfWeek: [1, 3, 5], timesPerWeek: 3, interval: 1 },
    })[1].recurrence).toEqual({
      frequency: 'weekly',
      daysOfWeek: [1, 3, 5],
      timesPerWeek: 3,
      interval: 1,
    });
  });

  it('turns a composed plan into one operational card per source item', () => {
    const cards = buildRoutineSuggestionCards({
      items: [
        {
          id: 'habit-1',
          kind: 'habit',
          title: 'Criar vídeo dark',
          sourceExcerpt: 'Criar vídeo três vezes por semana',
          confidence: 0.94,
          reviewState: 'confirmed',
          durationMinutes: 60,
          recurrence: { frequency: 'weekly', daysOfWeek: [1, 3, 5], timesPerWeek: 3 },
        },
        {
          id: 'task-1',
          kind: 'task',
          title: 'Publicar no perfil',
          sourceExcerpt: 'Publicar no perfil',
          confidence: 0.91,
          reviewState: 'confirmed',
        },
        {
          id: 'task-discarded',
          kind: 'task',
          title: 'Item descartado',
          sourceExcerpt: 'Não usar',
          confidence: 0.7,
          reviewState: 'excluded',
        },
      ],
      plan: {
        weekStart: '2026-07-27',
        capacity: { level: 'balanced', reason: 'Carga possível.' },
        entries: [
          { id: 'h1', sourceItemId: 'habit-1', kind: 'habit', date: '2026-07-27', startTime: '09:00', endTime: '10:00', title: 'Criar vídeo dark', durationMinutes: 60, isFixed: false, persist: true, reason: 'Primeira janela possível.' },
          { id: 'h2', sourceItemId: 'habit-1', kind: 'habit', date: '2026-07-29', startTime: '09:00', endTime: '10:00', title: 'Criar vídeo dark', durationMinutes: 60, isFixed: false, persist: true, reason: 'Mantém espaço entre as sessões.' },
          { id: 'h3', sourceItemId: 'habit-1', kind: 'habit', date: '2026-07-31', startTime: '09:00', endTime: '10:00', title: 'Criar vídeo dark', durationMinutes: 60, isFixed: false, persist: true, reason: 'Fecha a frequência semanal.' },
          { id: 't1', sourceItemId: 'task-1', kind: 'task', date: '2026-07-28', startTime: '15:00', endTime: '15:30', title: 'Publicar no perfil', durationMinutes: 30, isFixed: false, persist: true, reason: 'Cabe no período disponível.' },
        ],
        days: [],
        contextItems: [],
        unscheduled: [],
      },
      appliedSourceItemIds: ['habit-1'],
    });

    assert.equal(cards.length, 3);
    assert.equal(cards.filter((card) => card.sourceItemId === 'habit-1').length, 1);
    assert.deepEqual(cards.find((card) => card.sourceItemId === 'habit-1')?.firstOccurrence, {
      date: '2026-07-27',
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
    });
    assert.equal(cards.find((card) => card.sourceItemId === 'habit-1')?.occurrenceCount, 3);
    assert.equal(cards.find((card) => card.sourceItemId === 'habit-1')?.state, 'added');
    assert.equal(cards.find((card) => card.sourceItemId === 'task-discarded')?.state, 'discarded');
    assert.deepEqual(remainingRoutineSourceItemIds(cards), ['task-1']);
  });

  it('does not offer a habit that is already present in the real routine', () => {
    const cards = buildRoutineSuggestionCards({
      items: [{
        id: 'checkin-new',
        kind: 'habit',
        title: 'Check-in de humor e energia',
        sourceExcerpt: 'Hábito escolhido no onboarding',
        confidence: 1,
        reviewState: 'confirmed',
        recurrence: { frequency: 'daily', daysOfWeek: [] },
      }],
      plan: {
        weekStart: '2026-07-26',
        capacity: { level: 'balanced', reason: 'Carga possível.' },
        entries: [{
          id: 'existing-habit:checkin-existing:2026-07-26',
          kind: 'habit',
          date: '2026-07-26',
          startTime: '07:00',
          endTime: '07:10',
          title: 'Check-in de humor e energia',
          durationMinutes: 10,
          isFixed: false,
          persist: false,
          reason: 'Hábito já existente.',
        }],
        days: [],
        contextItems: [],
        unscheduled: [],
      },
    });

    expect(cards).toEqual([]);
  });

  it('puts an unscheduled conflict on its own editable card instead of a duplicate list', () => {
    const cards = buildRoutineSuggestionCards({
      items: [{
        id: 'task-1',
        kind: 'task',
        title: 'Anotar os gastos de ontem',
        sourceExcerpt: 'Próxima ação da meta de dinheiro',
        confidence: 0.9,
        reviewState: 'confirmed',
      }],
      plan: {
        weekStart: '2026-07-26',
        capacity: { level: 'balanced', reason: 'Carga possível.' },
        entries: [],
        days: [],
        contextItems: [],
        unscheduled: [{
          sourceItemId: 'task-1',
          title: 'Anotar os gastos de ontem',
          reason: 'Não coube sem ultrapassar a carga prevista.',
          alternatives: [],
        }],
      },
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].state).toBe('needs_adjustment');
    expect(cards[0].reason).toBe('Não coube sem ultrapassar a carga prevista.');
  });

  it('shows saving only for an available card with an active request', () => {
    const available: Pick<RoutineSuggestionCard, 'sourceItemId' | 'state'> = { sourceItemId: 'task-1', state: 'available' };
    const added: Pick<RoutineSuggestionCard, 'sourceItemId' | 'state'> = { sourceItemId: 'habit-1', state: 'added' };
    const discarded: Pick<RoutineSuggestionCard, 'sourceItemId' | 'state'> = { sourceItemId: 'task-2', state: 'discarded' };

    assert.equal(resolveRoutineSuggestionCardState(available, new Set(['task-1'])), 'saving');
    assert.equal(resolveRoutineSuggestionCardState(added, new Set(['habit-1'])), 'added');
    assert.equal(resolveRoutineSuggestionCardState(discarded, new Set(['task-2'])), 'discarded');
    assert.equal(resolveRoutineSuggestionCardState(available, new Set()), 'available');
  });
});

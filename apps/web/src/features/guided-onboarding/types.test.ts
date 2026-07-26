import { describe, expect, it } from 'vitest';

import { EMPTY_ANSWERS, WEEKDAYS, habitFromTemplate, type HabitTemplate } from './types';

function template(overrides: Partial<HabitTemplate> = {}): HabitTemplate {
  return {
    id: 'habit_move',
    title: 'Me mexer 20 minutos',
    emoji: '🏃',
    frequency: 'weekly',
    daysOfWeek: [1, 3, 5],
    timeOfDay: 'morning',
    durationMinutes: 20,
    energyCost: 3,
    ...overrides,
  };
}

describe('habitFromTemplate', () => {
  it('preserva dias e duração do template semanal', () => {
    const habit = habitFromTemplate(template());

    expect(habit.templateId).toBe('habit_move');
    expect(habit.daysOfWeek).toEqual([1, 3, 5]);
    expect(habit.durationMinutes).toBe(20);
  });

  it('deriva timesPerWeek da quantidade de dias marcados', () => {
    expect(habitFromTemplate(template()).timesPerWeek).toBe(3);
  });

  it('não define timesPerWeek em hábito diário', () => {
    const habit = habitFromTemplate(template({ frequency: 'daily', daysOfWeek: [] }));

    expect(habit.timesPerWeek).toBeNull();
    expect(habit.frequency).toBe('daily');
  });

  it('usa null quando o template semanal não fixa dias', () => {
    expect(habitFromTemplate(template({ daysOfWeek: [] })).timesPerWeek).toBeNull();
  });
});

describe('EMPTY_ANSWERS', () => {
  it('começa sem nenhuma escolha feita pela usuária', () => {
    expect(EMPTY_ANSWERS.lifeAreas).toEqual([]);
    expect(EMPTY_ANSWERS.intentions).toEqual([]);
    expect(EMPTY_ANSWERS.selectedHabits).toEqual([]);
    expect(EMPTY_ANSWERS.fixedCommitments).toEqual([]);
  });

  it('não exige texto livre para montar rotina', () => {
    expect(EMPTY_ANSWERS.freeText).toBeUndefined();
  });
});

describe('WEEKDAYS', () => {
  it('usa domingo como índice 0, igual ao contrato do backend', () => {
    expect(WEEKDAYS[0].label).toBe('Domingo');
    expect(WEEKDAYS).toHaveLength(7);
  });
});

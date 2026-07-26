import { randomUUID } from 'node:crypto';

import type { RoutineClassifiedItem, RoutineGuidedAnswers } from '../contracts/routine-builder.contract';
import {
  ENERGY_DRAINS,
  findHabitTemplate,
  findIntention,
  findRestorerBlock,
  LIFE_AREAS,
} from './routine-guided-library';

/**
 * Converte respostas do onboarding guiado em itens operacionais classificados.
 *
 * Determinístico de propósito: escolha de botão não precisa de IA para virar
 * item, e nada aqui inventa obrigação que a usuária não marcou. A IA entra
 * depois, na composição, para encaixar no dia e ajustar carga.
 */

type TransformInput = {
  answers: RoutineGuidedAnswers;
  /** Data local de hoje, YYYY-MM-DD. */
  today: string;
};

const LIFE_AREA_LABEL = new Map(LIFE_AREAS.map((area) => [area.id, area.label]));

/** `sourceExcerpt` é obrigatório no contrato e serve de rastro do que originou o item. */
function excerpt(text: string): string {
  return text.slice(0, 500);
}

function toItem(partial: Omit<RoutineClassifiedItem, 'id' | 'reviewState' | 'isFixed'> & {
  isFixed?: boolean;
}): RoutineClassifiedItem {
  return {
    id: randomUUID(),
    reviewState: 'pending',
    isFixed: partial.isFixed ?? false,
    ...partial,
  } as RoutineClassifiedItem;
}

function commitmentItems(answers: RoutineGuidedAnswers): RoutineClassifiedItem[] {
  return answers.fixedCommitments.map((commitment) => toItem({
    kind: 'calendar',
    title: commitment.title,
    description: null,
    sourceExcerpt: excerpt(`Compromisso fixo informado no onboarding: ${commitment.title}`),
    confidence: 1,
    classificationReason: 'Compromisso fixo marcado pela usuária.',
    parentItemId: null,
    durationMinutes: null,
    date: null,
    startTime: commitment.startTime,
    deadline: null,
    recurrence: { frequency: 'weekly', daysOfWeek: [commitment.dayOfWeek], timesPerWeek: null, interval: 1 },
    isFixed: true,
  }));
}

function habitItems(answers: RoutineGuidedAnswers): RoutineClassifiedItem[] {
  return answers.selectedHabits.map((habit) => {
    const template = findHabitTemplate(habit.templateId);
    const title = habit.title || template?.title || habit.templateId;

    return toItem({
      kind: 'habit',
      title,
      description: null,
      sourceExcerpt: excerpt(`Hábito escolhido no onboarding: ${title}`),
      confidence: 1,
      classificationReason: 'Hábito selecionado pela usuária.',
      parentItemId: null,
      durationMinutes: habit.durationMinutes,
      date: null,
      startTime: null,
      deadline: null,
      recurrence: {
        frequency: habit.frequency,
        daysOfWeek: habit.daysOfWeek,
        timesPerWeek: habit.timesPerWeek ?? null,
        interval: 1,
      },
    });
  });
}

/**
 * Cada intenção com resultado verificável vira um objetivo com meta e uma
 * primeira tarefa filha — sem próxima ação, objetivo é só desejo escrito.
 */
function objectiveItems(answers: RoutineGuidedAnswers, today: string): RoutineClassifiedItem[] {
  const items: RoutineClassifiedItem[] = [];

  for (const intentionId of answers.intentions) {
    const intention = findIntention(intentionId);
    if (!intention?.objective) continue;

    const objective = toItem({
      kind: 'goal',
      title: intention.objective.title,
      description: `Meta: ${intention.objective.target} ${intention.objective.metric}.`,
      sourceExcerpt: excerpt(`Intenção escolhida no onboarding: ${intention.label}`),
      confidence: 0.9,
      classificationReason: 'Direção ampla escolhida pela usuária, com resultado verificável.',
      parentItemId: null,
      durationMinutes: null,
      date: null,
      startTime: null,
      deadline: null,
      recurrence: null,
    });

    items.push(objective);
    items.push(toItem({
      kind: 'task',
      title: intention.objective.firstStep,
      description: 'Primeiro passo — pequeno e concluível hoje.',
      sourceExcerpt: excerpt(`Próxima ação do objetivo "${intention.objective.title}"`),
      confidence: 0.8,
      classificationReason: 'Próxima ação gerada para ancorar o objetivo no dia real.',
      parentItemId: objective.id,
      durationMinutes: intention.objective.firstStepMinutes,
      date: today,
      startTime: null,
      deadline: null,
      recurrence: null,
    }));
  }

  return items;
}

/**
 * Recuperação vira bloco semanal, não conselho.
 *
 * Em fase baixa a primeira coisa que a pessoa corta é o que a sustenta. Deixar
 * isso agendado é o que separa "rotina possível" de "lista de obrigações".
 * Limitado a dois: agenda cheia de autocuidado também é agenda cheia.
 */
const MAX_RECOVERY_BLOCKS = 2;

function recoveryItems(answers: RoutineGuidedAnswers): RoutineClassifiedItem[] {
  const items: RoutineClassifiedItem[] = [];

  for (const restorerId of answers.energyRestorers) {
    if (items.length >= MAX_RECOVERY_BLOCKS) break;
    const block = findRestorerBlock(restorerId);
    if (!block) continue;

    items.push(toItem({
      kind: 'habit',
      title: block.title,
      description: 'Bloco de recuperação — você marcou isso como o que te devolve energia.',
      sourceExcerpt: excerpt(`Recuperador escolhido no onboarding: ${block.title}`),
      confidence: 0.85,
      classificationReason: 'Recuperação escolhida pela usuária, agendada para não ser a primeira coisa cortada.',
      parentItemId: null,
      durationMinutes: block.durationMinutes,
      date: null,
      startTime: null,
      deadline: null,
      recurrence: { frequency: 'weekly', daysOfWeek: [], timesPerWeek: 2, interval: 1 },
    }));
  }

  return items;
}

const DRAIN_LABEL = new Map(
  ENERGY_DRAINS.flatMap((category) => category.options.map((option) => [option.id, option.label])),
);

/**
 * O que drena vira contexto nomeado para a Airia ler, nunca tarefa.
 * Sem isso ela não sabe por que um dia rendeu menos que o outro.
 */
function drainContextItem(answers: RoutineGuidedAnswers): RoutineClassifiedItem[] {
  if (answers.energyDrains.length === 0) return [];

  const labels = answers.energyDrains.map((id) => DRAIN_LABEL.get(id) ?? id);

  return [toItem({
    kind: 'reference',
    title: 'O que costuma me drenar',
    description: labels.join(', '),
    sourceExcerpt: excerpt(`Drenos informados: ${labels.join(', ')}`),
    confidence: 1,
    classificationReason: 'Contexto de energia para leitura de padrão, não é obrigação.',
    parentItemId: null,
    durationMinutes: null,
    date: null,
    startTime: null,
    deadline: null,
    recurrence: null,
  })];
}

/**
 * Áreas da vida sem compromisso de horário viram referência, não tarefa.
 * Servem de contexto para a Airia, mas nunca aparecem como obrigação.
 */
function contextItems(answers: RoutineGuidedAnswers): RoutineClassifiedItem[] {
  if (answers.lifeAreas.length === 0) return [];

  const labels = answers.lifeAreas.map((id) => LIFE_AREA_LABEL.get(id) ?? id);

  return [toItem({
    kind: 'reference',
    title: 'O que já ocupa meus dias',
    description: labels.join(', '),
    sourceExcerpt: excerpt(`Áreas da vida informadas: ${labels.join(', ')}`),
    confidence: 1,
    classificationReason: 'Contexto de rotina, não é obrigação.',
    parentItemId: null,
    durationMinutes: null,
    date: null,
    startTime: null,
    deadline: null,
    recurrence: null,
  })];
}

export function transformGuidedAnswers({ answers, today }: TransformInput): RoutineClassifiedItem[] {
  return [
    ...commitmentItems(answers),
    ...habitItems(answers),
    ...objectiveItems(answers, today),
    ...recoveryItems(answers),
    ...contextItems(answers),
    ...drainContextItem(answers),
  ];
}

import { randomUUID } from 'node:crypto';

import {
  AuraCommandPlanSchema,
  type AuraCommandOperation,
  type AuraCommandPlan,
} from '../contracts/aura-command-plan.contract';
import type { AuraCommandResponse } from '../contracts/aura-command.contract';
import {
  CommandSchedulingService,
  type CommandBusyWindow,
} from './command-scheduling.service';

type BuildInput = {
  response: AuraCommandResponse;
  userMessage?: string;
  sessionId: string;
  sourceMessageId: string;
  localDate: string;
  currentTime: string;
  defaultCalendarId: string;
  busyWindows: CommandBusyWindow[];
  phase?: string | null;
  moodScore?: number | null;
  energyScore?: number | null;
  idFactory?: () => string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function itemTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item.trim();
    return text(record(item).title) ?? text(record(item).text) ?? '';
  }).filter(Boolean);
}

function checklistItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const source = record(item);
    const title = typeof item === 'string' ? item.trim() : text(source.title) ?? text(source.text) ?? '';
    if (!title) return [];
    return [{
      id: text(source.id) ?? `item-${index + 1}`,
      title,
      done: source.done === true,
      ...(text(source.milestoneId) ? { milestoneId: text(source.milestoneId) } : {}),
      ...(text(source.doneWhen) ? { doneWhen: text(source.doneWhen) } : {}),
      ...(source.effortSize === 'small' || source.effortSize === 'medium' || source.effortSize === 'large'
        ? { effortSize: source.effortSize as 'small' | 'medium' | 'large' }
        : {}),
      ...(source.basedOn === 'stated' || source.basedOn === 'inferred'
        ? { basedOn: source.basedOn as 'stated' | 'inferred' }
        : {}),
      ...(Array.isArray(source.evidenceRefs) ? { evidenceRefs: source.evidenceRefs.filter((entry): entry is string => typeof entry === 'string') } : {}),
    }];
  });
}

function nextDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export class AuraCommandPlanBuilderService {
  static build(input: BuildInput): AuraCommandPlan {
    const makeId = input.idFactory ?? randomUUID;
    const payload = record(input.response.payload);
    const operations: AuraCommandOperation[] = [];
    const missingFields: string[] = [];
    let inferredValue = false;

    const schedule = (date: string, durationMinutes: number) => CommandSchedulingService.rankSlots({
      date,
      currentLocalDate: input.localDate,
      currentTime: input.currentTime,
      durationMinutes,
      phase: input.phase,
      moodScore: input.moodScore,
      energyScore: input.energyScore,
      busyWindows: input.busyWindows,
    });

    const pushTask = (source: Record<string, unknown>) => {
      const title = text(source.title) ?? text(source.name) ?? text(source.text);
      const date = text(source.date) ?? input.localDate;
      if (!title) {
        missingFields.push('title');
        return;
      }
      const durationMinutes = number(source.durationMinutes, 30);
      let startTime = text(source.startTime) ?? text(source.time);
      if (!startTime) {
        startTime = schedule(date, durationMinutes)[0]?.startTime ?? null;
        inferredValue = Boolean(startTime);
      }
      operations.push({
        id: makeId(),
        type: 'create_planner_task',
        status: 'proposed',
        selected: true,
        payload: {
          title,
          date,
          startTime,
          durationMinutes,
          category: text(source.category) ?? 'pessoal',
          note: text(source.note),
          checklist: checklistItems(source.checklist ?? source.items),
        },
      });
      if (!startTime) missingFields.push('startTime');
    };

    switch (input.response.action) {
      case 'create_task':
        pushTask(payload);
        break;
      case 'create_agenda': {
        const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
        blocks.forEach((block) => pushTask(record(block)));
        if (blocks.length === 0) missingFields.push('blocks');
        break;
      }
      case 'create_calendar_event': {
        const title = text(payload.title) ?? text(payload.name);
        const date = text(payload.date);
        if (!title) missingFields.push('title');
        if (!date) missingFields.push('date');
        if (!title || !date) break;
        const durationMinutes = number(payload.durationMinutes, 60);
        let startTime = text(payload.startTime) ?? text(payload.time);
        if (!startTime) {
          startTime = schedule(date, durationMinutes)[0]?.startTime ?? null;
          inferredValue = Boolean(startTime);
        }
        if (!startTime) {
          missingFields.push('startTime');
          break;
        }
        operations.push({
          id: makeId(),
          type: 'create_calendar_event',
          status: 'proposed',
          selected: true,
          payload: {
            title,
            date,
            startTime,
            durationMinutes,
            calendarId: text(payload.calendarId) ?? input.defaultCalendarId,
            location: text(payload.location),
            description: text(payload.description) ?? text(payload.note),
          },
        });
        break;
      }
      case 'create_checklist': {
        const items = checklistItems(payload.items ?? payload.steps ?? payload.checklist);
        const title = text(payload.title) ?? 'Checklist';
        if (items.length === 0) missingFields.push('items');
        else operations.push({
          id: makeId(),
          type: 'create_capture',
          status: 'proposed',
          selected: true,
          payload: { kind: 'checklist', title, content: text(payload.content) ?? '', items },
        });
        break;
      }
      case 'create_capture': {
        const kind = payload.kind === 'checklist' ? 'checklist' : 'note';
        const title = text(payload.title) ?? text(payload.content)?.slice(0, 80);
        const content = text(payload.content) ?? '';
        const items = checklistItems(payload.items);
        if (!title || (!content && items.length === 0)) missingFields.push('content');
        else operations.push({
          id: makeId(),
          type: 'create_capture',
          status: 'proposed',
          selected: true,
          payload: { kind, title, content, items },
        });
        break;
      }
      case 'create_goal': {
        const title = text(payload.title) ?? text(payload.goalTitle);
        const subgoals = checklistItems(payload.subgoals ?? payload.subtasks ?? payload.items);
        if (!title) missingFields.push('title');
        if (!title) break;
        const pathQuestion = text(payload.pathQuestion) ?? text(payload.question);
        const pathStatus = subgoals.length > 0 ? 'ready' : pathQuestion ? 'needs_answer' : 'retrying';
        operations.push({
          id: makeId(),
          type: 'create_goal',
          status: 'proposed',
          selected: true,
          payload: {
            title,
            description: text(payload.description),
            category: text(payload.category) ?? 'geral',
            subgoals,
            resultDefinition: text(payload.resultDefinition),
            currentReality: text(payload.currentReality),
            milestones: Array.isArray(payload.milestones) ? payload.milestones : [],
            pathStatus,
            pathQuestion,
            // Objetivo não cria tarefa no Planner. Data da ação pertence ao
            // próprio caminho e só muda com confirmação explícita.
            firstAction: null,
          },
        });
        break;
      }
      case 'create_habit': {
        const title = text(payload.title);
        if (!title) {
          missingFields.push('title');
          break;
        }
        operations.push({
          id: makeId(),
          type: 'create_habit',
          status: 'proposed',
          selected: true,
          payload: {
            title,
            description: text(payload.description),
            category: text(payload.category) ?? 'geral',
            frequency: payload.frequency === 'weekly' || payload.frequency === 'monthly' ? payload.frequency : 'daily',
            targetDays: Array.isArray(payload.targetDays) ? payload.targetDays.filter((day): day is number => Number.isInteger(day)) : [],
            durationMinutes: typeof payload.durationMinutes === 'number' ? payload.durationMinutes : null,
            reminderTime: text(payload.reminderTime),
          },
        });
        break;
      }
      case 'record_checkin': {
        const coreScores = ['moodScore', 'energyScore'] as const;
        coreScores.forEach((key) => {
          if (typeof payload[key] !== 'number') missingFields.push(key);
        });
        if (missingFields.length > 0) break;
        operations.push({
          id: makeId(),
          type: 'record_checkin',
          status: 'proposed',
          selected: true,
          payload: {
            localDate: text(payload.localDate) ?? text(payload.date) ?? input.localDate,
            moodScore: payload.moodScore as number,
            energyScore: payload.energyScore as number,
            clarityScore: typeof payload.clarityScore === 'number' ? payload.clarityScore : null,
            irritabilityScore: typeof payload.irritabilityScore === 'number' ? payload.irritabilityScore : null,
            physicalScore: typeof payload.physicalScore === 'number' ? payload.physicalScore : null,
            socialScore: typeof payload.socialScore === 'number' ? payload.socialScore : null,
            sleepScore: typeof payload.sleepScore === 'number' ? payload.sleepScore : null,
            sleepHours: typeof payload.sleepHours === 'number' ? payload.sleepHours : null,
            note: text(payload.note),
            emotions: itemTitles(payload.emotions).slice(0, 3),
            factors: itemTitles(payload.factors).slice(0, 12),
            source: payload.source === 'aura_voice' ? 'aura_voice' : 'aura_text',
            sourceMessageId: text(payload.sourceMessageId) ?? input.sourceMessageId,
            idempotencyKey: text(payload.idempotencyKey) ?? `${input.sessionId}:${input.sourceMessageId}`,
            rawText: text(payload.rawText) ?? text(input.userMessage),
            signalMetadata: record(payload.signalMetadata),
          },
        });
        break;
      }
      case 'log_checkin': {
        return this.build({
          ...input,
          response: {
            ...input.response,
            action: 'record_checkin',
            payload: {
              ...payload,
              clarityScore: typeof payload.clarityScore === 'number'
                ? payload.clarityScore
                : typeof payload.focusScore === 'number'
                  ? payload.focusScore
                  : null,
              source: payload.source === 'aura_voice' ? 'aura_voice' : 'aura_text',
            },
          },
        });
      }
      case 'create_checkin': {
        const legacyResponse = {
          ...input,
          response: { ...input.response, action: 'record_checkin' as const },
        };
        return this.build(legacyResponse);
      }
      case 'handoff_to_journal':
        operations.push({
          id: makeId(),
          type: 'handoff_to_journal',
          status: 'proposed',
          selected: true,
          payload: { content: text(payload.content) ?? text(input.userMessage) ?? input.response.assistantMessage },
        });
        break;
      case 'update_task': {
        const targetId = text(payload.taskId);
        const date = text(payload.newDate);
        const startTime = text(payload.newStartTime);
        if (!targetId) missingFields.push('taskId');
        if (!date) missingFields.push('newDate');
        if (!startTime) missingFields.push('newStartTime');
        if (targetId && date && startTime) operations.push({
          id: makeId(),
          type: 'update_item',
          status: 'proposed',
          selected: true,
          payload: {
            targetType: 'timeline',
            targetId,
            changes: { date, startTime },
          },
        });
        break;
      }
      case 'delete_task': {
        const targetId = text(payload.taskId);
        if (!targetId) missingFields.push('taskId');
        else operations.push({
          id: makeId(),
          type: 'delete_item',
          status: 'proposed',
          selected: true,
          payload: {
            targetType: 'timeline',
            targetId,
            changes: {},
          },
        });
        break;
      }
      case 'postpone_task': {
        const taskId = text(payload.taskId);
        if (!taskId) {
          missingFields.push('taskId');
          break;
        }
        operations.push({
          id: makeId(),
          type: 'postpone_timeline_task',
          status: 'proposed',
          selected: true,
          payload: {
            taskId,
            targetDate: text(payload.targetDate) ?? text(payload.newDate) ?? nextDate(input.localDate),
            reason: text(payload.reason),
          },
        });
        break;
      }
      case 'start_task': {
        const taskId = text(payload.taskId);
        if (!taskId) {
          missingFields.push('taskId');
          break;
        }
        operations.push({
          id: makeId(),
          type: 'start_timeline_task',
          status: 'proposed',
          selected: true,
          payload: { taskId },
        });
        break;
      }
      case 'adapt_agenda':
        operations.push({
          id: makeId(),
          type: 'adapt_agenda',
          status: 'proposed',
          selected: true,
          payload: { localDate: text(payload.localDate) ?? text(payload.date) ?? input.localDate },
        });
        break;
      case 'open_screen': {
        const screen = text(payload.screen);
        if (!screen) {
          missingFields.push('screen');
          break;
        }
        operations.push({
          id: makeId(),
          type: 'open_screen',
          status: 'proposed',
          selected: true,
          payload: { screen: screen as 'home' | 'planner' | 'habits' | 'goals' | 'insights' | 'journal' | 'checkin' },
        });
        break;
      }
      case 'complete_items': {
        const items = Array.isArray(payload.items) ? payload.items : [];
        items.forEach((item, index) => {
          const source = record(item);
          const targetId = text(source.targetId) ?? text(source.id);
          const targetType = text(source.targetType)
            ?? (source.type === 'habit' ? 'habit' : 'timeline');
          if (!targetId || !['timeline', 'goal', 'habit', 'capture'].includes(targetType)) {
            missingFields.push(`items.${index}.targetId`);
            return;
          }
          operations.push({
            id: makeId(),
            type: 'complete_item',
            status: 'proposed',
            selected: true,
            payload: {
              targetType: targetType as 'timeline' | 'goal' | 'habit' | 'capture',
              targetId,
              changes: {},
            },
          });
        });
        if (items.length === 0) missingFields.push('items');
        break;
      }
      default:
        break;
    }

    const needsReview = input.response.needsConfirmation
      || (
        inferredValue
        && input.response.action !== 'create_goal'
        && payload.autoScheduleRequested !== true
      )
      || missingFields.length > 0
      || operations.some((operation) =>
        operation.type === 'create_calendar_event'
        || operation.type === 'update_item'
        || operation.type === 'delete_item');

    return AuraCommandPlanSchema.parse({
      id: makeId(),
      sessionId: input.sessionId,
      sourceMessageId: input.sourceMessageId,
      status: operations.length > 0 ? 'proposed' : 'draft',
      executionPolicy: missingFields.includes('date') || operations.length === 0
        ? 'clarification'
        : needsReview ? 'review_required' : 'auto_apply',
      confidence: missingFields.length === 0 ? 0.9 : 0.65,
      assistantMessage: input.response.assistantMessage,
      missingFields,
      operations,
    });
  }
}

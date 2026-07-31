import type { AuraCommandAction, AuraCommandResponse } from '../contracts/aura-command.contract';
import type { CheckinSignal } from '../contracts/checkin-draft.contract';
import { CheckinUnderstandingService } from './checkin-understanding.service';

type CaptureJudgment = {
  captureAs?: string;
  captureMode?: string;
  explicitness?: string;
  allowedMutationActions: string[];
};

type RecoveryInput = {
  response: AuraCommandResponse;
  message: string;
  localDate: string;
  captureJudgment: CaptureJudgment;
};

const MUTATING_ACTIONS = new Set<AuraCommandAction>([
  'create_task',
  'create_checklist',
  'create_goal',
  'create_agenda',
  'handoff_to_journal',
  'update_task',
  'delete_task',
  'complete_items',
  'log_checkin',
  'create_checkin',
  'record_checkin',
  'create_capture',
  'create_calendar_event',
  'create_habit',
  'postpone_task',
  'start_task',
  'adapt_agenda',
]);

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function cleanTitle(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, '')
    .trim();
}

function extractTaskTitle(message: string): string | null {
  const match = /(?:tarefa|lembrete)\s+(.+?)(?=\s+(?:amanh[ãa]|hoje|depois\s+de\s+amanh[ãa])(?:\s|[.!?]|$)|[.!?](?:\s|$)|$)/i.exec(message);
  const title = cleanTitle(match?.[1] ?? '');
  return title || null;
}

function extractGoalTitle(message: string): string | null {
  const match = /(?:quero\s+como\s+meta|(?:crie|cria|adicione|adiciona|inclua|inclui)\s+(?:uma\s+)?meta(?:\s+(?:de|para))?)\s+(.+?)(?=[.!?](?:\s|$)|$)/i.exec(message);
  const title = cleanTitle(match?.[1] ?? '');
  return title || null;
}

function relativeDate(message: string, localDate: string): string {
  if (/(?:^|\s)depois\s+de\s+amanh[ãa](?=\s|[.!?,;]|$)/i.test(message)) return addDays(localDate, 2);
  if (/(?:^|\s)amanh[ãa](?=\s|[.!?,;]|$)/i.test(message)) return addDays(localDate, 1);
  return localDate;
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isExplicitTypedTaskCommand(message: string): boolean {
  return /\b(?:crie|cria|adicione|adiciona|inclua|inclui|registre)\b.{0,40}\b(?:tarefa|lembrete)\b/
    .test(normalized(message));
}

function hasExplicitTaskTime(message: string): boolean {
  const source = normalized(message);
  return /\b(?:as|a)\s+\d{1,2}(?::\d{2})?\s*h?\b|\b\d{1,2}:\d{2}\b/.test(source);
}

function extractScore(message: string, labels: string[]): number | null {
  const source = normalized(message);
  const labelPattern = labels.join('|');
  const match = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:esta|estou|em|de|:|=|-)*\\s*(10|[1-9])(?:\\s*(?:de|\\/|em)\\s*10)?\\b`, 'i').exec(source);
  return match ? Number(match[1]) : null;
}

function recoverTask(input: RecoveryInput): AuraCommandResponse | null {
  const title = extractTaskTitle(input.message);
  if (!title) return null;
  return {
    assistantMessage: 'Entendi. Vou colocar a tarefa no Planner e escolher o melhor horário livre para o seu dia.',
    intent: 'planner_task',
    action: 'create_task',
    payload: {
      title,
      date: relativeDate(input.message, input.localDate),
      autoScheduleRequested: true,
    },
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  };
}

function recoverGoal(input: RecoveryInput): AuraCommandResponse | null {
  const title = extractGoalTitle(input.message);
  if (!title) return null;
  return {
    assistantMessage: 'Entendi a meta. Vou dividi-la em ações pequenas e colocar o primeiro passo no seu dia.',
    intent: 'goal_project',
    action: 'create_goal',
    payload: {
      ...input.response.payload,
      title,
      subgoals: [
        `Definir o resultado concreto de ${title}`,
        `Reunir o que já existe para ${title}`,
        `Executar a primeira versão de ${title}`,
      ],
    },
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  };
}

function recoverCheckin(input: RecoveryInput): AuraCommandResponse | null {
  const draft = CheckinUnderstandingService.understand({
    message: input.message,
    localDate: input.localDate,
    source: 'aura_text',
    candidate: input.response.payload,
  });
  if (draft.status === 'unsupported') return null;
  if (draft.status === 'needs_clarification') {
    const missingMood = draft.mood.value === null;
    return {
      assistantMessage: missingMood
        ? 'Entendi sua energia. Como está seu humor agora, de 1 a 10 ou em uma palavra?'
        : 'Entendi seu humor. Como está sua energia agora, de 1 a 10 ou em uma palavra?',
      intent: 'clarify',
      action: 'ask_clarification',
      payload: {
        pendingIntent: 'record_checkin',
        draft,
      },
      needsConfirmation: false,
      needsClarification: true,
      clarifyingQuestion: missingMood
        ? 'Como está seu humor agora?'
        : 'Como está sua energia agora?',
    };
  }
  const observation = (signal: CheckinSignal) => ({
    provenance: signal.provenance,
    confidence: signal.confidence,
    evidence: signal.evidence,
  });
  return {
    assistantMessage: 'Entendi como você está agora. Vou registrar este check-in e ajustar a leitura do seu dia.',
    intent: 'checkin',
    action: 'record_checkin',
    payload: {
      localDate: input.localDate,
      moodScore: draft.mood.value,
      energyScore: draft.energy.value,
      clarityScore: draft.clarity.value,
      irritabilityScore: draft.irritability.value,
      physicalScore: draft.physical.value,
      socialScore: draft.social.value,
      sleepScore: draft.sleepScore.value,
      sleepHours: draft.sleepHours,
      note: draft.note,
      emotions: draft.emotions,
      factors: draft.factors,
      source: draft.source,
      sourceMessageId: draft.sourceMessageId,
      idempotencyKey: draft.idempotencyKey,
      rawText: draft.rawText,
      signalMetadata: {
        mood: observation(draft.mood),
        energy: observation(draft.energy),
        clarity: observation(draft.clarity),
        irritability: observation(draft.irritability),
        physical: observation(draft.physical),
        social: observation(draft.social),
        sleepScore: observation(draft.sleepScore),
      },
    },
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  };
}

/**
 * Dá autoridade ao entendimento determinístico quando o modelo responde ou
 * pergunta apesar de a fala atual conter uma ordem explícita e tipada.
 */
export function recoverAuraCommandResponse(input: RecoveryInput): AuraCommandResponse {
  const allowed = new Set(input.captureJudgment.allowedMutationActions);
  const typedTaskCommand = input.captureJudgment.captureAs === 'task'
    && allowed.has('create_task')
    && isExplicitTypedTaskCommand(input.message);
  if (
    MUTATING_ACTIONS.has(input.response.action)
    && allowed.has(input.response.action)
  ) {
    if (input.response.action === 'record_checkin') {
      return recoverCheckin(input) ?? input.response;
    }
    if (
      input.response.action === 'create_task'
      && typedTaskCommand
      && !hasExplicitTaskTime(input.message)
    ) {
      return recoverTask(input) ?? input.response;
    }
    return input.response;
  }
  const checkinAuthorized = input.captureJudgment.captureAs === 'checkin' && allowed.has('record_checkin');
  if (input.captureJudgment.explicitness !== 'explicit' && !typedTaskCommand && !checkinAuthorized) return input.response;

  if (allowed.has('create_goal')) return recoverGoal(input) ?? input.response;
  if (input.captureJudgment.captureAs === 'checkin' && (allowed.has('record_checkin') || allowed.has('log_checkin') || allowed.has('create_checkin'))) {
    return recoverCheckin(input) ?? input.response;
  }
  if (input.captureJudgment.captureAs === 'task' && allowed.has('create_task')) {
    return recoverTask(input) ?? input.response;
  }
  return input.response;
}

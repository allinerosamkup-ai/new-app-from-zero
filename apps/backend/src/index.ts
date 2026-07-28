Warning: truncated output (original token count: 87281)
Total output lines: 7878

import { randomUUID } from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import webpush from 'web-push';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import cron from 'node-cron';
import path from 'path';
import { PrismaClient } from '@app/database';
import { requireAuth, AuthRequest } from './middleware/auth';
import { AIService } from './services/ai.service';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { KnowledgeGraphBackfillService } from './services/knowledge-graph-backfill.service';
import { PlannerService, buildPostponeAdaptabilityUpdate, resolveTimelineAdaptability, resolveTimelineAdaptabilityProvenance, type TimelineBlockInput } from './services/planner.service';
import { InsightService } from './services/insight.service';
import { CheckinService } from './services/checkin.service';
import { GCalService } from './services/gcal.service';
import { CheckinCreateSchema } from './contracts/checkin.contract';
import { deriveCheckinSlot } from './contracts/checkin-slot';
import { PlannerSyncSchema, PlannerAISuggestionRequestSchema } from './contracts/planner.contract';
import { PlannerAIService } from './services/planner-ai.service';
import { LearningContextService } from './services/learning-context.service';
import { HabitCreateSchema, HabitPatchSchema } from './contracts/habit.contract';
import { JournalExternalMessageSchema, JournalMessageStreamSchema, JournalStartSchema } from './contracts/journal.contract';
import { EventLogCreateSchema } from './contracts/event-log.contract';
import { OnboardingProcessSchema } from './contracts/onboarding.contract';
import {
  DEFAULT_EVENING_REVIEW_TIME,
  DEFAULT_MORNING_CHECKIN_TIME,
  PreferencesPatchSchema,
  defaultNotificationPreferences,
  defaultUserPreferences,
  normalizeNotificationPreferences,
} from './contracts/preferences.contract';
import { JournalService } from './services/journal.service';
import { AuraCommandService } from './services/aura-command.service';
import { recoverAuraCommandResponse } from './services/aura-command-recovery.service';
import { AuraCommandPlanBuilderService } from './services/aura-command-plan-builder.service';
import { AuraCommandExecutorService } from './services/aura-command-executor.service';
import { AuraCommandPersistenceService } from './services/aura-command-persistence.service';
import { MemoryService } from './services/memory.service';
import { CanonicalMemoryService } from './services/canonical-memory.service';
import { AuraMemoryIngestionService, conservativeAuraExtractor } from './services/aura-memory-ingestion.service';
import { AgendaPatternRecognitionService } from './services/agenda-pattern-recognition.service';
import { ContextGroundingService } from './services/context-grounding.service';
import { ReasoningContextService } from './services/reasoning-context.service';
import { AiriaOperationalReasoningService, type AiriaActionPlan } from './services/airia-operational-reasoning.service';
import { buildCompletionReward, computeProgress, streakMessage, type ProgressEvent } from './services/progress-rewards.service';
import { TaskDecompositionService } from './services/task-decomposition.service';
import { AiriaCognitiveInterpreterService } from './services/airia-cognitive-interpreter.service';
import { AgendaAdaptationService } from './services/agenda-adaptation.service';
import { AiActionFeedbackService } from './services/ai-action-feedback.service';
import { AiBackgroundService } from './services/ai-background.service';
import { SuggestionMemoryService } from './services/suggestion-memory.service';
import { RoutineBuilderService } from './services/routine-builder.service';
import { createRoutineBuilderRouter } from './routes/routine-builder.routes';
import { getSalesHistory as getHotmartSalesHistory } from './services/hotmart.service';
import { sendPurchaseEvent as sendMetaPurchaseEvent } from './services/meta-capi.service';
import { buildPrivacyExport, type PrivacyExportPrisma } from './services/privacy-export.service';
import {
  DeletionConfirmError,
  PRIVACY_DELETION_EVENT_NAMES,
  cancelDeletion,
  confirmDeletion,
  getDeletionStatus,
  requestDeletion,
  type PrivacyDeletePrisma,
} from './services/privacy-delete.service';
import { JournalUnderstandingService, type JournalSituationModel } from './services/journal-understanding.service';
import {
  buildUnifiedSuggestContext,
  getSuggestFallback,
  resolveSuggestGenerationConfig,
} from './services/aiOrchestrator';
import {
  buildAuraSystemPrompt,
  getFirstName,
  humanizeScore,
  sanitizePromptContent,
  type AuraPromptDomain,
} from './lib/aura-prompt';
import {
  deriveAdaptiveContext as deriveAdaptiveContextFromPhase,
  inferPhaseFromRecentCheckins,
  type MoodPhase,
  type WarningFlag,
} from './services/adaptive-scheduling.service';
import { normalizeAiSuggestion, usesJsonObjectResponse } from './lib/ai-suggest-response';
import { extractJsonValue } from './lib/extract-json';
import { sanitizeStabilityAnalysisSuggestion } from './lib/home-autonomy-sanitizer';
import {
  allowsHabitNotifications,
  getSaoPauloDateContext,
  getSaoPauloDayStartUtc,
  NUDGE_EVENT_NAME,
  resolveCheckinNudgeTime,
  shouldSendCheckinNudge,
  shouldSendHabitReminderToday,
  shouldSendJournalNudge,
} from './lib/notification-filters';
import { getOpenAiMaxCompletionTokens, getOpenAiModel, openAiTemperature } from './lib/openai-config';
import { ObjectiveSubgoalsSchema } from './lib/objective-subgoals';
import { assessRiskSafety, riskSafetyPromptPolicy } from './lib/risk-safety';
import {
  AuraCommandMessageStreamSchema,
  AuraCommandStartSchema,
  type AuraCommandResponse,
} from './contracts/aura-command.contract';
import {
  AuraCommandOperationSchema,
  AuraCommandPlanApplySchema,
  AuraCommandPlanPatchSchema,
} from './contracts/aura-command-plan.contract';
import { z } from 'zod';
import { startOfDay, subDays, format } from 'date-fns';

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

// VAPID setup for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@airia.pro',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

const expo = new Expo();

const port = process.env.PORT || 3000;
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? [];
const defaultAllowed = ['localhost', '127.0.0.1', 'localhost:5051', 'localhost:5173', 'replit', 'replit.dev', 'replit.app', 'airia.pro'];
const defaultPrisma = new PrismaClient();
const DEFAULT_TIMELINE_RECURRING = { enabled: false, frequency: 'daily', days: [], everyNDays: 1 };

const MUTATING_AURA_ACTIONS = new Set<AuraCommandResponse['action']>([
  'create_task',
  'create_checklist',
  'create_goal',
  'create_agenda',
  'handoff_to_journal',
  'update_task',
  'delete_task',
  'complete_items',
  'log_checkin',
  'postpone_task',
  'start_task',
  'create_capture',
  'create_checkin',
  'create_habit',
  'create_calendar_event',
]);

/** Ações que só fazem sentido sobre um item que já existe. */
const AURA_ACTIONS_ON_EXISTING_ITEMS = new Set<AuraCommandResponse['action']>([
  'update_task',
  'delete_task',
  'complete_items',
  'postpone_task',
  'start_task',
]);

/**
 * Preenche o que a usuária não disse, para que a Airia entregue decidido.
 *
 * Data ausente vira hoje. Hora ausente vira o próximo meio-passo do relógio dentro
 * de uma janela civilizada — nunca 03h da manhã. Isso existe porque devolver
 * "que horas você quer?" para alguém que acabou de dizer o que precisa fazer é
 * transferir trabalho para quem já está sem combustível.
 */
export function completeAuraTaskTiming(
  payload: Record<string, unknown>,
  context: { localDate?: string; currentHour?: number; currentMinute?: number } = {},
): { date: string; startTime: string } {
  const now = new Date();
  const baseDate = typeof context.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(context.localDate)
    ? context.localDate
    : now.toISOString().slice(0, 10);

  const existingDate = typeof payload.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
    ? payload.date
    : null;
  const rawTime = payload.startTime ?? payload.time;
  const existingTime = typeof rawTime === 'string' && /^\d{1,2}:\d{2}$/.test(rawTime)
    ? rawTime.padStart(5, '0')
    : null;

  if (existingDate && existingTime) return { date: existingDate, startTime: existingTime };

  const hour = Number.isInteger(context.currentHour) ? (context.currentHour as number) : now.getHours();
  const minute = Number.isInteger(context.currentMinute) ? (context.currentMinute as number) : now.getMinutes();

  // Próximo bloco de 30 minutos, com 15 de folga para não cair "agora mesmo".
  let slotMinutes = (hour * 60) + minute + 15;
  slotMinutes = Math.ceil(slotMinutes / 30) * 30;

  const DAY_OPENS = 8 * 60;
  const DAY_CLOSES = 21 * 60;
  let date = existingDate ?? baseDate;

  if (!existingTime && slotMinutes >= DAY_CLOSES) {
    // Já é tarde: cai para a manhã seguinte em vez de agendar de madrugada.
    if (!existingDate) {
      const next = new Date(`${baseDate}T12:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
    }
    slotMinutes = 9 * 60;
  }
  if (!existingTime && slotMinutes < DAY_OPENS) slotMinutes = DAY_OPENS;

  const startTime = existingTime
    ?? `${String(Math.floor(slotMinutes / 60) % 24).padStart(2, '0')}:${String(slotMinutes % 60).padStart(2, '0')}`;

  return { date, startTime };
}

/**
 * Passa cada ação da fala pelo portão, uma a uma.
 *
 * Uma fala pode conter duas coisas ("marquei consulta quinta e já lavei a louça"):
 * uma pode passar e a outra não. O resultado devolve só o que sobreviveu, na ordem,
 * e a resposta ao usuário é a da primeira ação válida — ou a recusa, se nenhuma
 * sobreviver.
 */
export function enforceAuraCaptureGateAll(
  response: AuraCommandResponse,
  cognitive: { captureJudgment: { allowedMutationActions: string[]; mutationTargetText?: string | null; captureMode?: string } },
  locale = 'pt-BR',
  targetContext: {
    resolvedTaskTitle?: string | null;
    localDate?: string;
    currentHour?: number;
    currentMinute?: number;
  } = {},
): AuraCommandResponse {
  const steps = [
    { action: response.action, payload: response.payload },
    ...(response.actions ?? []),
  ];

  const survivors: Array<{ action: AuraCommandResponse['action']; payload: Record<string, unknown> }> = [];
  let firstRefusal: AuraCommandResponse | null = null;

  for (const step of steps) {
    const gated = enforceAuraCaptureGate(
      { ...response, action: step.action, payload: step.payload, actions: undefined },
      cognitive,
      locale,
      targetContext,
    );
    if (gated.action === step.action) {
      survivors.push({ action: gated.action, payload: gated.payload as Record<string, unknown> });
    } else if (!firstRefusal) {
      firstRefusal = gated;
    }
  }

  if (survivors.length === 0) {
    return firstRefusal ?? response;
  }

  const [primary, ...rest] = survivors;
  return {
    ...response,
    action: primary.action,
    payload: primary.payload,
    actions: rest.length > 0 ? rest : undefined,
  };
}

export function enforceAuraCaptureGate(
  response: AuraCommandResponse,
  cognitive: { captureJudgment: { allowedMutationActions: string[]; mutationTargetText?: string | null; captureMode?: string } },
  locale = 'pt-BR',
  targetContext: {
    resolvedTaskTitle?: string | null;
    localDate?: string;
    currentHour?: number;
    currentMinute?: number;
  } = {},
): AuraCommandResponse {
  const actionIsAllowed = cognitive.captureJudgment.allowedMutationActions.includes(response.action);
  const captureMode = cognitive.captureJudgment.captureMode ?? 'auto';
  const payload = response.payload as Record<string, unknown>;
  const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  const validDate = (value: unknown) => hasText(value) && /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const validTime = (value: unknown) => hasText(value) && /^\d{1,2}:\d{2}$/.test(String(value));
  const hasTitledItems = (value: unknown, requireType = false) => Array.isArray(value) && value.length > 0 && value.every((item) => {
    if (typeof item === 'string') return !requireType && item.trim().length > 0;
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return hasText(record.title) && (!requireType || record.type === 'task' || record.type === 'habit');
  });
  const titleFrom = (value: Record<string, unknown>) => value.title ?? value.goalTitle ?? value.name ?? value.text;
  const normalizeTarget = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:por favor|please|pra mim|para mim|for me)\b\s*$/g, '')
    .trim();
  const targetMatches = (requested: string | null | undefined, resolved: string | null | undefined) => {
    const requestText = normalizeTarget(requested ?? '');
    const resolvedText = normalizeTarget(resolved ?? '');
    if (!requestText || !resolvedText) return false;
    if (requestText === resolvedText || resolvedText.includes(requestText)) return true;
    const ignored = new Set(['a', 'o', 'as', 'os', 'the', 'my', 'de', 'da', 'do', 'of', 'task', 'tarefa']);
    const requestTokens = requestText.split(' ').filter((token) => token.length >= 3 && !ignored.has(token));
    const resolvedTokens = new Set(resolvedText.split(' ').filter((token) => token.length >= 3 && !ignored.has(token)));
    if (requestTokens.length === 0) return false;
    return requestTokens.filter((token) => resolvedTokens.has(token)).length / requestTokens.length >= 0.8;
  };
  // A Airia decide a lacuna em vez de devolver a pergunta: o gate completa a
  // data, mas deixa a hora para o ranking que enxerga agenda, humor e energia.
  const completedPayload: Record<string, unknown> = { ...payload };
  if (response.action === 'create_task' && hasText(titleFrom(payload))) {
    const date = validDate(payload.date)
      ? String(payload.date)
      : validDate(targetContext.localDate)
        ? String(targetContext.localDate)
        : completeAuraTaskTiming(payload, targetContext).date;
    completedPayload.date = date;
    if (!validTime(payload.startTime ?? payload.time)) {
      delete completedPayload.startTime;
      delete completedPayload.time;
    }
    completedPayload.timingWasInferred = !validDate(payload.date) || !validTime(payload.startTime ?? payload.time);
  }
  if (response.action === 'create_agenda' && Array.isArray(payload.blocks)) {
    let inferred = false;
    completedPayload.blocks = payload.blocks.map((block) => {
      if (!block || typeof block !== 'object') return block;
      const item = block as Record<string, unknown>;
      if (!hasText(titleFrom(item))) return block;
      const timing = completeAuraTaskTiming(item, targetContext);
      if (!validDate(item.date) || !validTime(item.startTime ?? item.time)) inferred = true;
      return { ...item, date: timing.date, startTime: timing.startTime };
    });
    completedPayload.timingWasInferred = inferred;
  }

  const payloadIsSufficient = (() => {
    switch (response.action) {
      case 'create_task':
        return hasText(titleFrom(payload));
      case 'create_checklist':
        return hasText(titleFrom(payload)) && hasTitledItems(payload.items ?? payload.steps ?? payload.checklist);
      case 'create_goal':
        return hasText(titleFrom(payload));
      case 'create_agenda':
        return Array.isArray(payload.blocks) && payload.blocks.length > 0 && payload.blocks.every((block) => {
          if (!block || typeof block !== 'object') return false;
          return hasText(titleFrom(block as Record<string, unknown>));
        });
      case 'create_capture':
        return hasText(titleFrom(payload)) && (hasText(payload.content) || hasTitledItems(payload.items));
      case 'create_checkin':
        return validDate(payload.localDate ?? payload.date)
          && ['moodScore', 'energyScore', 'clarityScore', 'irritabilityScore'].some((key) => typeof payload[key] === 'number');
      case 'create_habit':
        return hasText(titleFrom(payload));
      case 'create_calendar_event':
        return hasText(titleFrom(payload)) && validDate(payload.date);
      case 'handoff_to_journal':
        return true;
      case 'update_task':
        return hasText(payload.taskId) && validDate(payload.newDate) && validTime(payload.newStartTime)
          && targetMatches(cognitive.captureJudgment.mutationTargetText, targetContext.resolvedTaskTitle);
      case 'delete_task':
        return hasText(payload.taskId)
          && targetMatches(cognitive.captureJudgment.mutationTargetText, targetContext.resolvedTaskTitle);
      case 'complete_items':
        return hasTitledItems(payload.items, true);
      case 'log_checkin': {
        // Basta um sinal para valer um check-in. Exigir os quatro campos faria a
        // Airia perguntar o que a pessoa não falou — o oposto do objetivo.
        const score = (value: unknown) => typeof value === 'number' && value >= 1 && value <= 10;
        return score(payload.moodScore) || score(payload.energyScore)
          || score(payload.focusScore) || hasText(payload.sleepQuality);
      }
      case 'create_habit':
        return hasText(titleFrom(payload));
      case 'postpone_task':
        return hasText(payload.taskId)
          && targetMatches(cognitive.captureJudgment.mutationTargetText, targetContext.resolvedTaskTitle);
      case 'start_task':
        return hasText(payload.taskId)
          && targetMatches(cognitive.captureJudgment.mutationTargetText, targetContext.resolvedTaskTitle);
      default:
        return true;
    }
  })();

  if (!MUTATING_AURA_ACTIONS.has(response.action)) return response;

  if (actionIsAllowed && payloadIsSufficient) {
    // Proposta derivada de contexto nasce marcada, para a UI oferecer ajustar e
    // desfazer com destaque. Ela é criada de verdade — não fica esperando aceite.
    return {
      ...response,
      payload: { ...completedPayload, captureMode, inferredFromContext: captureMode === 'propose' },
    };
  }

  const english = locale.toLowerCase().startsWith('en');

  // A usuária mandou mexer em algo que já existe, mas não deu para saber em quê.
  // Isso é falta de alvo, não falta de permissão — e merece pergunta, não recusa.
  if (actionIsAllowed && AURA_ACTIONS_ON_EXISTING_ITEMS.has(response.action)) {
    const question = english
      ? 'Which one do you mean?'
      : 'Qual desses você quer que eu mexa?';
    return {
      assistantMessage: english
        ? "I couldn't tell which item you meant."
        : 'Não consegui identificar de qual item você está falando.',
      intent: 'clarify',
      action: 'ask_clarification',
      payload: {},
      needsConfirmation: false,
      needsClarification: true,
      clarifyingQuestion: question,
    };
  }

  return {
    assistantMessage: english
      ? "I'm here. I won't turn this into a task or change your schedule."
      : 'Estou te ouvindo. Não vou transformar isso em tarefa nem mexer na sua agenda.',
    intent: 'clarify',
    action: 'ask_clarification',
    payload: {},
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  };
}

const PostponeTimelineBlockSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().trim().max(240).optional(),
});

type TimelineRecurringShape = {
  enabled?: boolean;
  frequency?: unknown;
  days?: unknown;
  everyNDays?: unknown;
};

type AppDependencies = {
  prisma?: PrismaClient;
  aiService?: Pick<typeof AIService, 'summarizeJournalSession' | 'streamJournalReply' | 'generateOnboardingProfile'>;
  journalService?: Pick<typeof JournalService, 'startOrResumeSession' | 'getSessionMessages' | 'buildRoutineContext' | 'nextOrderIndex'>;
  memoryService?: Pick<MemoryService, 'store' | 'retrieve' | 'formatForPrompt' | 'deleteAll'>;
  auraMemoryIngestionService?: Pick<AuraMemoryIngestionService, 'ingest'>;
  auraCommandService?: Pick<typeof AuraCommandService, 'interpretCommand'>;
  authMiddleware?: (req: Request, res: Response, next: import('express').NextFunction) => void;
  generateJournalSuggestedTasks?: typeof generateJournalSuggestedTasks;
  routineBuilderService?: Pick<RoutineBuilderService,
    'createSession' | 'getSession' | 'ingestSource' | 'submitGuidedAnswers' | 'updateItems' | 'answerClarifications' | 'compose' | 'apply'>;
};

/**
 * Fase C — reforço de padrão a partir do feedback de uma ação sugerida.
 * Busca padrões ativos do usuário e ajusta `strength` conforme aceitação.
 */
const REINFORCE_STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'sem',
  'que', 'se', 'sua', 'seu', 'suas', 'seus', 'voce', 'você',
  'hoje', 'agora', 'fazer', 'abrir', 'ver',
]);
function normalizeForReinforce(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\w\s]/g, ' ');
}
function tokensForReinforce(text: string): Set<string> {
  return new Set(
    normalizeForReinforce(text)
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !REINFORCE_STOPWORDS.has(t)),
  );
}
async function reinforcePatternsFromActionFeedback(
  prisma: PrismaClient,
  userId: string,
  actionTitle: string,
  status: string,
): Promise<void> {
  const deltaByStatus: Record<string, number> = {
    accepted: 0.05,
    done: 0.05,
    scheduled: 0.02,
    dismissed: -0.10,
    rejected: -0.15,
    deleted: -0.15,
  };
  const delta = deltaByStatus[status];
  if (!delta) return;
  const patterns = await prisma.userPattern.findMany({
    where: { userId },
    orderBy: { strength: 'desc' },
    take: 40,
  });
  if (patterns.length === 0) return;
  const actionTokens = tokensForReinforce(actionTitle);
  if (actionTokens.size < 2) return;
  for (const pattern of patterns) {
    const patternTokens = tokensForReinforce(pattern.pattern);
    if (patternTokens.size === 0) continue;
    let overlap = 0;
    for (const t of actionTokens) if (patternTokens.has(t)) overlap += 1;
    const ratio = overlap / Math.min(actionTokens.size, patternTokens.size);
    if (ratio >= 0.4) {
      const next = Math.max(0, Math.min(1, pattern.strength + delta));
      if (Math.abs(next - pattern.strength) >= 0.005) {
        await prisma.userPattern.update({
          where: { id: pattern.id },
          data: {
            strength: next,
            lastConfirmedAt: delta > 0 ? new Date() : pattern.lastConfirmedAt,
          },
        });
      }
    }
  }
}

function buildTimelineMetadataData(block: TimelineBlockInput) {
  const metadata: Record<string, unknown> = {};

  if (block.noteMode !== undefined) metadata.noteMode = block.noteMode;
  if (block.note !== undefined) metadata.note = block.note ?? null;
  if (block.checklist !== undefined) metadata.checklist = block.checklist;
  if (block.recurring !== undefined) metadata.recurring = block.recurring;
  if (block.energyLevel !== undefined) metadata.energyLevel = block.energyLevel;
  if (block.lastResetDate !== undefined) {
    metadata.lastResetDate = block.lastResetDate ? new Date(`${block.lastResetDate}T00:00:00.000Z`) : null;
  }
  if (block.persistentReminderEnabled !== undefined) metadata.persistentReminderEnabled = block.persistentReminderEnabled;
  if (block.persistentReminderIntervalMinutes !== undefined) {
    metadata.persistentReminderIntervalMinutes = block.persistentReminderIntervalMinutes ?? null;
  }
  if (block.isAiSuggested !== undefined) metadata.isAiSuggested = block.isAiSuggested;
  if (block.aiReasoning !== undefined) metadata.aiReasoning = block.aiReasoning ?? null;
  if (block.gcalEventId !== undefined) metadata.gcalEventId = block.gcalEventId ?? null;
  if (block.temporalPolicy !== undefined) metadata.temporalPolicy = block.temporalPolicy;
  if (block.adaptationPermission !== undefined) metadata.adaptationPermission = block.adaptationPermission;
  if (block.adaptabilitySource !== undefined) metadata.adaptabilitySource = block.adaptabilitySource;
  if (block.adaptabilityConfidence !== undefined) metadata.adaptabilityConfidence = block.adaptabilityConfidence;
  if (block.icon !== undefined) metadata.icon = block.icon ?? null;
  if (block.color !== undefined) metadata.color = block.color ?? null;
  if (block.vibrateEnabled !== undefined) metadata.vibrateEnabled = block.vibrateEnabled;
  if (block.alarmEnabled !== undefined) metadata.alarmEnabled = block.alarmEnabled;
  if (block.recurringNotificationEnabled !== undefined) metadata.recurringNotificationEnabled = block.recurringNotificationEnabled;
  if (block.visualRepeatEnabled !== undefined) metadata.visualRepeatEnabled = block.visualRepeatEnabled;
  if ((block as any).taskMode !== undefined) metadata.taskMode = (block as any).taskMode ?? 'standard';

  return metadata;
}

function timelineAdaptabilityPresence(value: unknown): {
  temporalPolicy: boolean;
  adaptationPermission: boolean;
  adaptabilitySource: boolean;
  adaptabilityConfidence: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { temporalPolicy: false, adaptationPermission: false, adaptabilitySource: false, adaptabilityConfidence: false };
  }

  const block = value as Record<string, unknown>;
  const hasTemporalPolicy = Object.prototype.hasOwnProperty.call(block, 'temporalPolicy');
  const hasAdaptationPermission = Object.prototype.hasOwnProperty.call(block, 'adaptationPermission');
  const hasAdaptabilitySource = Object.prototype.hasOwnProperty.call(block, 'adaptabilitySource');
  const hasAdaptabilityConfidence = Object.prototype.hasOwnProperty.call(block, 'adaptabilityConfidence');
  const hasExternalEvent = Object.prototype.hasOwnProperty.call(block, 'gcalEventId')
    && typeof block.gcalEventId === 'string'
    && block.gcalEventId.trim().length > 0;

  return {
    temporalPolicy: hasTemporalPolicy || hasExternalEvent,
    adaptationPermission: hasAdaptationPermission || hasExternalEvent || block.temporalPolicy === 'fixed',
    adaptabilitySource: hasAdaptabilitySource || hasExternalEvent,
    adaptabilityConfidence: hasAdaptabilityConfidence || hasExternalEvent,
  };
}

function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const base = parseLocalDateInput(dateKey);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

type TimelineDeleteScope = 'this' | 'future' | 'this-and-future' | 'all';

function normalizeTimelineDeleteScope(value: unknown): TimelineDeleteScope {
  return value === 'future' || value === 'this-and-future' || value === 'all' ? value : 'this';
}

function normalizeRecurringForSeries(value: unknown) {
  if (!value || typeof value !== 'object') {
    return DEFAULT_TIMELINE_RECURRING;
  }

  const candidate = value as TimelineRecurringShape;
  const frequency = candidate.frequency === 'weekly' || candidate.frequency === 'custom' ? candidate.frequency : 'daily';
  const days = Array.isArray(candidate.days)
    ? candidate.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => a - b)
    : [];
  const everyNDays = Number.isInteger(candidate.everyNDays) && Number(candidate.everyNDays) > 0
    ? Number(candidate.everyNDays)
    : 1;

  return {
    enabled: Boolean(candidate.enabled),
    frequency,
    days,
    everyNDays,
  };
}

function sameRecurringSeries(left: unknown, right: unknown) {
  return JSON.stringify(normalizeRecurringForSeries(left)) === JSON.stringify(normalizeRecurringForSeries(right));
}

function formatUtcTime(value: Date): string {
  const h = value.getUTCHours().toString().padStart(2, '0');
  const m = value.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function writeSseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function serializeAuraCommandPlan(plan: any) {
  return {
    id: plan.id,
    sessionId: plan.sessionId,
    sourceMessageId: plan.sourceMessageId,
    status: plan.status,
    executionPolicy: plan.executionPolicy,
    confidence: plan.confidence,
    assistantMessage: plan.assistantMessage,
    missingFields: plan.missingFields ?? [],
    operations: (plan.operations ?? []).map((operation: any) => ({
      id: operation.clientOperationId ?? operation.id,
      type: operation.type,
      status: operation.status,
      selected: operation.selected,
      payload: operation.payload,
      result: operation.result ?? null,
      error: operation.error ?? null,
    })),
  };
}

/** Formata hora UTC de um Date como HH:MM */
function fmtUtcTime(d: Date): string {
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

function formatTimeInZone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

async function buildCommandBusyWindows(input: {
  prisma: PrismaClient;
  userId: string;
  date: string;
  calendarId: string;
  timezone: string;
}): Promise<Array<{ startTime: string; endTime: string }>> {
  const dayStart = new Date(`${input.date}T00:00:00.000Z`);
  const dayEnd = new Date(`${input.date}T23:59:59.999Z`);
  const blocks = await input.prisma.timelineBlock.findMany({
    where: {
      userId: input.userId,
      localDate: { gte: dayStart, lte: dayEnd },
      status: { not: 'cancelled' },
    },
    select: { startAt: true, endAt: true },
  }).catch(() => []);
  const windows = blocks.map((block) => ({
    startTime: fmtUtcTime(block.startAt),
    endTime: fmtUtcTime(block.endAt),
  }));

  try {
    const token = await GCalService.getValidToken(input.prisma, input.userId);
    if (!token) return windows;
    const timeMin = encodeURIComponent(`${input.date}T00:00:00-03:00`);
    const timeMax = encodeURIComponent(`${input.date}T23:59:59-03:00`);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) return windows;
    const body = await response.json() as {
      items?: Array<{ status?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }>;
    };
    for (const event of body.items ?? []) {
      if (event.status === 'cancelled' || !event.start?.dateTime || !event.end?.dateTime) continue;
      windows.push({
        startTime: formatTimeInZone(new Date(event.start.dateTime), input.timezone),
        endTime: formatTimeInZone(new Date(event.end.dateTime), input.timezone),
      });
    }
  } catch {
    // A agenda interna ainda permite sugerir um horário; falha externa fica visível ao aplicar.
  }
  return windows;
}

function normalizeCommandTarget(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveAuraCompletionTargets(input: {
  prisma: PrismaClient;
  userId: string;
  localDate: string;
  items: unknown;
}) {
  if (!Array.isArray(input.items)) return [];
  const dayStart = new Date(`${input.localDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${input.localDate}T23:59:59.999Z`);
  const [blocks, habits] = await Promise.all([
    input.prisma.timelineBlock.findMany({
      where: {
        userId: input.userId,
        localDate: { gte: dayStart, lte: dayEnd },
        status: { not: 'completed' },
      },
      select: { id: true, title: true },
    }),
    input.prisma.habit.findMany({
      where: { userId: input.userId, archived: false },
      select: { id: true, title: true },
    }),
  ]);

  return input.items.map((item) => {
    const source: Record<string, unknown> = item && typeof item === 'object'
      ? item as Record<string, unknown>
      : { title: item };
    if (typeof source.targetId === 'string' && source.targetId.trim()) return source;
    const title = typeof source.title === 'string' ? source.title : '';
    const normalized = normalizeCommandTarget(title);
    const isHabit = source.type === 'habit' || source.targetType === 'habit';
    const candidates = isHabit ? habits : blocks;
    const match = candidates.find((candidate) => {
      const candidateTitle = normalizeCommandTarget(candidate.title);
      return candidateTitle === normalized
        || candidateTitle.includes(normalized)
        || normalized.includes(candidateTitle);
    });
    return match
      ? {
        ...source,
        targetId: match.id,
        targetType: isHabit ? 'habit' : 'timeline',
      }
      : source;
  });
}

/**
 * Busca as tarefas de hoje do banco e do Google Calendar (se conectado)
 * e retorna um bloco de texto para injetar no prompt da Aura.
 */
async function buildTodayPlannerContext(prisma: PrismaClient, userId: string): Promise<string | null> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const dayEnd   = new Date(`${todayStr}T23:59:59.999Z`);

  const lines: string[] = [];

  // 1. Tarefas do planner interno
  const blocks = await prisma.timelineBlock.findMany({
    where: { userId, localDate: { gte: dayStart, lte: dayEnd } },
    orderBy: { startAt: 'asc' },
    select: { id: true, title: true, startAt: true, endAt: true, category: true, status: true },
  }).catch(() => []);

  for (const b of blocks) {
    const status = b.status === 'completed' ? '✓' : '·';
    lines.push(`${status} [id:${b.id}] "${b.title}" — ${fmtUtcTime(b.startAt)}–${fmtUtcTime(b.endAt)} — ${b.category}`);
  }

  // 2. Eventos do Google Calendar (se conectado e não duplicados)
  try {
    const token = await GCalService.getValidToken(prisma, userId);
    if (token) {
      const timeMin = `${todayStr}T00:00:00Z`;
      const timeMax = `${todayStr}T23:59:59Z`;
      const gcalRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (gcalRes.ok) {
        const gcalData = await gcalRes.json() as any;
        const gcalItems: any[] = gcalData.items ?? [];
        // Só adiciona eventos do GCal que não estão no planner local (sem gcalEventId match)
        const localGcalIds = new Set(blocks.map((b: any) => b.gcalEventId).filter(Boolean));
        for (const ev of gcalItems) {
          if (localGcalIds.has(ev.id)) continue; // já está no planner, não duplicar
          const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
          const end   = ev.end?.dateTime   ? new Date(ev.end.dateTime)   : null;
          const timeStr = start && end ? `${fmtUtcTime(start)}–${fmtUtcTime(end)}` : 'dia todo';
          lines.push(`· [gcal:${ev.id}] "${ev.summary ?? 'Evento'}" — ${timeStr} — google-agenda`);
        }
      }
    }
  } catch { /* GCal indisponível — não bloqueia */ }

  if (lines.length === 0) return null;
  return `AGENDA DE HOJE (${todayStr}):\n${lines.join('\n')}`;
}

async function buildTodayCompletionContext(prisma: PrismaClient, userId: string): Promise<{
  text: string | null;
  titles: string[];
}> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${todayStr}T23:59:59.999Z`);
  const lines: string[] = [];
  const titles: string[] = [];

  const [completedBlocks, completedHabits, objectives] = await Promise.all([
    prisma.timelineBlock.findMany({
      where: { userId, localDate: { gte: dayStart, lte: dayEnd }, status: 'completed' },
      orderBy: { startAt: 'asc' },
      select: { title: true, startAt: true, category: true },
    }).catch(() => []),
    prisma.habit.findMany({
      where: {
        userId,
        archived: false,
        completions: { some: { date: { gte: dayStart, lte: dayEnd } } },
      },
      select: { title: true, category: true },
    }).catch(() => []),
    prisma.objective.findMany({
      where: { userId, archived: false },
      select: { title: true, progress: true, subgoals: true },
    }).catch(() => []),
  ]);

  if (completedBlocks.length) {
    const blockTitles = completedBlocks.map((task) => task.title).filter(Boolean);
    titles.push(...blockTitles);
    lines.push(`Agenda concluída hoje: ${completedBlocks.map((task) => `"${task.title}" (${fmtUtcTime(task.startAt)}, ${task.category})`).join(' | ')}`);
  }

  if (completedHabits.length) {
    const habitTitles = completedHabits.map((habit) => habit.title).filter(Boolean);
    titles.push(...habitTitles);
    lines.push(`Hábitos feitos hoje: ${completedHabits.map((habit) => `"${habit.title}" (${habit.category})`).join(' | ')}`);
  }

  const completedGoalTitles: string[] = [];
  const completedSubgoalTitles: string[] = [];
  for (const objective of objectives) {
    if (objective.progress >= 100) completedGoalTitles.push(objective.title);
    const subgoals = Array.isArray(objective.subgoals) ? objective.subgoals : [];
    for (const subgoal of subgoals) {
      if (!subgoal || typeof subgoal !== 'object') continue;
      const item = subgoal as Record<string, unknown>;
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (title && (item.done === true || item.completed === true)) completedSubgoalTitles.push(title);
    }
  }

  if (completedGoalTitles.length) {
    titles.push(...completedGoalTitles);
    lines.push(`Metas concluídas: ${completedGoalTitles.map((title) => `"${title}"`).join(' | ')}`);
  }
  if (completedSubgoalTitles.length) {
    titles.push(...completedSubgoalTitles);
    lines.push(`Subtarefas de metas concluídas: ${completedSubgoalTitles.map((title) => `"${title}"`).join(' | ')}`);
  }

  return {
    text: lines.length ? lines.join('\n') : null,
    titles: uniqueByKey(titles),
  };
}

async function resolveAiRuntimeContext(prisma: PrismaClient, userId: string, context: Record<string, unknown>) {
  const explicitUserName = typeof context.userName === 'string' && context.userName.trim() ? context.userName.trim() : null;
  const explicitMoodCycle = typeof context.moodCycleContext === 'string' && context.moodCycleContext.trim()
    ? context.moodCycleContext.trim()
    : null;

  const [profile, onboarding, latestCheckin, routineContext, activeObjectives] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: userId },
      select: { fullName: true },
    }).catch(() => null),
    prisma.onboardingResponse.findUnique({
      where: { userId },
      select: { aiProfileSummary: true, aiProfilePayload: true, priorDiagnoses: true },
    }).catch(() => null),
    prisma.dailyCheckin.findFirst({
      where: { userId },
      orderBy: [
        { localDate: 'desc' },
        { recordedAt: 'desc' },
      ],
      select: {
        localDate: true,
        moodScore: true,
        energyScore: true,
        sleepScore: true,
        factors: true,
        note: true,
        aiState: true,
        stateLabel: true,
        stateLabelType: true,
        stateSummary: true,
      },
    }).catch(() => null),
    JournalService.buildRoutineContext(prisma, userId).catch(() => null),
    prisma.objective?.findMany
      ? prisma.objective.findMany({
          where: { userId, archived: false, progress: { lt: 100 } },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          select: { title: true, category: true, progress: true, subgoals: true, aiInsight: true },
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const derivedUserName = getFirstName(profile?.fullName);
  const fallbackMoodCycleContext = latestCheckin
    ? [
        `Último estado registrado: ${latestCheckin.stateLabel ?? 'sem rótulo definido'}.`,
        `Humor ${humanizeScore(latestCheckin.moodScore, 'mood')} e energia ${humanizeScore(latestCheckin.energyScore, 'energy')}.`,
        latestCheckin.sleepScore != null ? `Sono ${humanizeScore(latestCheckin.sleepScore, 'sleep')}.` : null,
        latestCheckin.stateSummary ? `Leitura atual: ${sanitizePromptContent(latestCheckin.stateSummary)}` : null,
      ].filter(Boolean).join(' ')
    : null;
  const routinePromptSummary = sanitizePromptContent(routineContext?.promptSummary ?? null);
  const sharedMoodCycleContext = [
    explicitMoodCycle,
    fallbackMoodCycleContext,
    routinePromptSummary,
  ].filter(Boolean).join(' ').trim();

  const aiPayload = onboarding?.aiProfilePayload as Record<string, unknown> | null | undefined;
  const longTermMemory = typeof aiPayload?.longTermMemory === 'string' && aiPayload.longTermMemory.trim()
    ? aiPayload.longTermMemory.trim()
    : null;

  const aiStatePayload = latestCheckin?.aiState as Record<string, unknown> | null | undefined;
  const activeGoalsContext = activeObjectives.length > 0
    ? activeObjectives.map((goal: any) => {
        const subgoals = Array.isArray(goal.subgoals) ? goal.subgoals : [];
        const firstPending = subgoals.find((item: any) => item && typeof item === 'object' && !item.done && !item.completed);
        const pendingTitle = typeof firstPending?.title === 'string'
          ? firstPending.title
          : typeof firstPending?.text === 'string'
            ? firstPending.text
            : null;
        return [
          `Meta: ${sanitizePromptContent(goal.title)}`,
          goal.category ? `categoria ${goal.category}` : null,
          Number.isFinite(goal.progress) ? `progresso ${goal.progress}%` : null,
          pendingTitle ? `próxima ação pendente: ${sanitizePromptContent(pendingTitle)}` : null,
          goal.aiInsight ? `leitura anterior: ${sanitizePromptContent(goal.aiInsight)}` : null,
        ].filter(Boolean).join(' | ');
      }).join('\n')
    : null;
  const latestCheckinSignals = latestCheckin
    ? {
        emotions: Array.isArray(aiStatePayload?.emotions)
          ? aiStatePayload.emotions.map((item) => String(item))
          : [],
        factors: Array.isArray(latestCheckin.factors)
          ? latestCheckin.factors.map((item) => String(item))
          : [],
        note: typeof latestCheckin.note === 'string' ? latestCheckin.note : undefined,
        moodScore: latestCheckin.moodScore ?? undefined,
        energyScore: latestCheckin.energyScore ?? undefined,
        sleepScore: latestCheckin.sleepScore ?? undefined,
        stateLabel: latestCheckin.stateLabel ?? undefined,
      }
    : null;

  return {
    userName: explicitUserName ?? derivedUserName ?? 'você',
    moodCycleContext: sharedMoodCycleContext || null,
    userProfileSummary: sanitizePromptContent(onboarding?.aiProfileSummary ?? null),
    priorDiagnoses: (onboarding?.priorDiagnoses as string[] | null | undefined) ?? null,
    longTermMemory,
    activeGoalsContext,
    latestCheckinSignals,
  };
}

const SuggestedTaskSchema = z.object({
  title: z.string().min(1),
  category: z.enum(['trabalho', 'saude', 'rotina', 'social']),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  /**
   * Quando a tarefa for pra hoje (default 0), o filtro temporal descarta `time`
   * se já passou. Quando for pra amanhã (1), aceita qualquer hora.
   */
  dayOffset: z.union([z.literal(0), z.literal(1)]).optional().default(0),
});

type SuggestedTask = z.infer<typeof SuggestedTaskSchema>;

/**
 * Descarta horários no passado em tarefas com dayOffset=0.
 * Tarefas com dayOffset=1 (amanhã) preservam o horário.
 * Tarefas com title vazio são removidas.
 */
/**
 * Extrai contexto adaptativo do req.body (phase, warningFlags, forecast, momentum, currentHour, currentMinute).
 * Frontend envia esses campos via getClientTimeContext() + getAdaptiveSnapshot() em api.ts.
 */
function extractAdaptiveFromRequest(body: any) {
  return {
    currentHour: typeof body?.currentHour === 'number' ? body.currentHour : undefined,
    currentMinute: typeof body?.currentMinute === 'number' ? body.currentMinute : undefined,
    phase: typeof body?.phase === 'string' ? body.phase : null,
    warningFlags: Array.isArray(body?.warningFlags) ? body.warningFlags : [],
    forecast7dSummary: typeof body?.forecast7dSummary === 'string' ? body.forecast7dSummary : null,
    taskMomentum7d: typeof body?.taskMomentum7d === 'number' ? body.taskMomentum7d : null,
  };
}

function filterPastTimes(
  tasks: SuggestedTask[],
  currentHour: number,
  currentMinute: number,
): SuggestedTask[] {
  const nowMinutes = currentHour * 60 + currentMinute;
  return tasks
    .map((t) => {
      if (!t.time) return t;
      if (t.dayOffset === 1) return t; // amanhã: aceita qualquer hora
      const m = t.time.match(/^(\d{2}):(\d{2})$/);
      if (!m) return { ...t, time: undefined };
      const taskMinutes = Number(m[1]) * 60 + Number(m[2]);
      if (taskMinutes < nowMinutes) {
        // Horário já passou: descarta time, mantém tarefa pra "quando der"
        return { ...t, time: undefined };
      }
      return t;
    })
    .filter((t) => t.title && t.title.trim().length > 0);
}

async function generateJournalSuggestedTasks(args: {
  systemPrompt: string;
  userName: string;
  moodCycleContext?: string | null;
  acceptedSuggestions?: string[];
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentHour?: number;
  currentMinute?: number;
}): Promise<SuggestedTask[]> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const transcript = args.recentMessages
    .slice(-8)
    .map((message) => `${message.role === 'user' ? args.userName : 'Aura'}: ${message.content}`)
    .join('\n');
  const acceptedSuggestions = (args.acceptedSuggestions ?? [])
    .map((suggestion) => suggestion.trim())
    .filter(Boolean)
    .slice(0, 3);
  const acceptedSuggestionsBlock = acceptedSuggestions.length > 0
    ? `\nSUGESTÕES CONVERSADAS E VALIDADAS PELA PESSOA:\n${acceptedSuggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`).join('\n')}\n`
    : '\nSUGESTÕES CONVERSADAS E VALIDADAS PELA PESSOA: nenhuma clara.\n';

  const completion = await openai.chat.completions.create({
    model: getOpenAiModel(),
    messages: [
      { role: 'system' as const, content: args.systemPrompt },
      {
        role: 'user' as const,
        content: `Com base nesta conversa recente, sugira de 0 a 3 tarefas pequenas e concretas.

CONVERSA:
${transcript}
${acceptedSuggestionsBlock}

REGRAS:
- Se houver SUGESTÕES CONVERSADAS E VALIDADAS, transforme essas ideias primeiro em tarefas concretas. Elas têm prioridade sobre qualquer nova sugestão.
- Só crie uma nova tarefa se ainda faltar completar até 3 itens e a conversa trouxer base real para isso.
- Se não houver sugestão validada nem próximo passo útil e gentil, retorne [].
- Use a hierarquia interna: leitura funcional profunda primeiro, TCC prática depois, exposição gradual, propósito e somática por último. Nunca cite esses nomes.
- Priorize ação concreta, organização leve, trabalho prático, exposição mínima ou contenção conforme o estado atual.
- Se não fizer sentido sugerir nada, retorne [].
- Use categorias: trabalho | saude | rotina | social.
- Se o usuário mencionou planos concretos (ex: "vou encontrar fulano", "tenho reunião", "preciso ligar para X"), inclua como tarefa com categoria adequada (social/trabalho) e horário se mencionado.
- Não transforme sugestão rejeitada ou apenas cogitada pela Aura em tarefa.
- Evite somática genérica. Corpo/respiração só entram se a conversa mostrou sinal corporal relevante ou necessidade real de aterramento.
- Misture sugestões conversadas com compromissos práticos mencionados na conversa.
- ANTI-GENÉRICO: tarefas tipo "faça uma tarefa pequena", "anote uma pendência", "escolha um próximo passo mínimo", "feche o dia organizando a agenda", "respire fundo" não têm valor — qualquer app de produtividade já faz isso. Omita.
- Se a conversa não trouxe contexto suficiente para uma sugestão concreta e específica, retorne [] (lista vazia). Não invente. É melhor perguntar à pessoa depois do que entregar genérico agora.${args.currentHour !== undefined ? `
- HORÁRIO ATUAL DO USUÁRIO (USO INTERNO — não cite no título da tarefa): ${String(args.currentHour).padStart(2, '0')}:${String(args.currentMinute ?? 0).padStart(2, '0')}. Use só para escolher e calibrar. Quando preencher o campo time, ele DEVE ser posterior ao horário atual, caber em janela livre do planner e respeitar a fase de humor. Se o horário natural da tarefa já passou, omita o campo time ou descarte a tarefa.` : ''}
- TESTE GENÉRICO OBRIGATÓRIO antes de incluir cada tarefa: "se eu trocasse o nome desta pessoa e o horário, esta tarefa ainda faria sentido pra outro usuário qualquer?". Se SIM, descarta. Se NÃO, mantém.
- Tarefa DEVE mencionar algo concreto que apareceu na conversa (audiência, Matteo, apartamento, prompt, anúncio, conta, cliente, filho — o que ela trouxe). Tarefas tipo "rotação de ombros", "anote pendência", "respire fundo", "feche o dia", "registre alívio sim/não", "beba água" são PROIBIDAS — qualquer variação delas sai.
- INSIGHT E TAREFA MESMA FAMÍLIA: se o resumo/síntese é sobre X (ex: prompt, audiência, anúncio), tarefas TÊM que ser sobre X também. Não misture insight de trabalho com tarefa de corpo.
- Campo dayOffset: 0 = hoje (default; time deve ser >= horário atual), 1 = amanhã (use SOMENTE quando o contexto deixar explícito, ex: "audiência amanhã às 14h").
- Retorne APENAS JSON no formato:
{"tasks":[{"title":"...","category":"trabalho|saude|rotina|social","time":"HH:MM","dayOffset":0}]}`,
      },
    ],
    ...openAiTemperature(getOpenAiModel(), 0.4),
    response_format: { type: 'json_object' },
    max_completion_tokens: getOpenAiMaxCompletionTokens(1500),
  });

  const content = completion.choices[0]?.message?.content?.trim() || '';
  const payload = extractJsonValue(content) as { tasks?: unknown };
  const rawTasks = Array.isArray(payload) ? payload : payload.tasks;
  if (!Array.isArray(rawTasks)) {
    return [];
  }

  const parsed = rawTasks
    .map((task) => {
      try {
        return SuggestedTaskSchema.parse(task);
      } catch {
        return null;
      }
    })
    .filter((t): t is SuggestedTask => t !== null)
    .slice(0, 3);

  // Filtro temporal: descarta horários no passado (dayOffset=0)
  if (typeof args.currentHour === 'number') {
    return filterPastTimes(parsed, args.currentHour, args.currentMinute ?? 0);
  }
  return parsed;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseLocalDateInput(localDate: string): Date {
  const direct = localDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (direct) {
    const year = Number(direct[1]);
    const month = Number(direct[2]);
    const day = Number(direct[3]);
    // Meio-dia UTC evita deslocamento de dia por fuso ao persistir em coluna DATE.
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  }

  const parsed = new Date(localDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid localDate: ${localDate}`);
  }

  return new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    12, 0, 0, 0,
  ));
}

function normalizeSuggestionKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueByKey(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = normalizeSuggestionKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

type JournalMemoryServiceLike = Pick<MemoryService, 'retrieve' | 'formatForPrompt'>;

async function retrieveJournalMemoryContext(args: {
  memoryService: JournalMemoryServiceLike;
  userId: string;
  message: string;
  situation: JournalSituationModel;
  dailyContext?: Awaited<ReturnType<ContextGroundingService['buildDailyContext']>> | null;
  routineContext: {
    promptSummary?: string;
    recentSessionHistory?: string;
    topThemes?: string[];
    activeGoals?: string[];
  };
  runtimeContext: {
    moodCycleContext?: string | null;
    longTermMemory?: string | null;
    activeGoalsContext?: string | null;
  };
}): Promise<{ ragContext: string; retrievedCount: number; usedFallback: boolean; rejectedMemoryReasons: string[] }> {
  const querySeeds = uniqueByKey([
    ...args.situation.retrievalQueries,
    `padrões recorrentes, pessoas, decisões e emoções ligados a: ${args.situation.topics.join(' ') || args.message}`,
    args.routineContext.topThemes?.length
      ? `diário temas recorrentes ${args.routineContext.topThemes.join(' ')} ${args.message}`
      : '',
    args.routineContext.recentSessionHistory
      ? `continuidade do diário e padrões recentes ${args.routineContext.recentSessionHistory.slice(0, 900)}`
      : '',
  ].filter(Boolean));

  const batches = await Promise.all(
    querySeeds.slice(0, 5).map((query) => args.memoryService.retrieve(args.userId, query, 4).catch(() => [])),
  );

  const seen = new Set<string>();
  const memories = batches
    .flat()
    .filter((memory: any) => {
      const key = normalizeSuggestionKey(`${memory.contentType ?? ''}:${memory.content ?? ''}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a: any, b: any) => Number(b.similarity ?? 0) - Number(a.similarity ?? 0))
    .slice(0, 14);

  const memoryCritic = JournalUnderstandingService.filterMemories({
    memories: memories as any,
    situation: args.situation,
    dailyContext: args.dailyContext ?? null,
  });
  const acceptedMemories = memoryCritic.accepted.slice(0, 8);
  const rejectedMemoryReasons = memoryCritic.rejected.map((item) => item.reason);

  if (acceptedMemories.length > 0) {
    // Fix H: marcar explicitamente que isto é busca direta (alta confiança).
    const directHeader = '✅ MEMÓRIAS RELEVANTES (recuperação direta da fala da pessoa em diários/check-ins anteriores). Cite pelo menos 1 elemento concreto se conectar ao relato atual:';
    return {
      ragContext: `${directHeader}\n${args.memoryService.formatForPrompt(acceptedMemories as any)}`,
      retrievedCount: acceptedMemories.length,
      usedFallback: false,
      rejectedMemoryReasons,
    };
  }

  const relatedActiveGoals = (args.dailyContext?.activeGoalTitles ?? []).filter((title) => JournalUnderstandingService.filterMemories({
    memories: [{ contentType: 'goal', content: `Meta: ${title}`, similarity: 0.9 }],
    situation: args.situation,
    dailyContext: args.dailyContext ?? null,
  }).accepted.length > 0);
  const relatedCompletedGoals = (args.dailyContext?.completedGoalTitles ?? []).filter((title) => JournalUnderstandingService.filterMemories({
    memories: [{ contentType: 'goal', content: `Meta: ${title}`, similarity: 0.9 }],
    situation: args.situation,
    dailyContext: args.dailyContext ?? null,
  }).accepted.length > 0);

  const fallbackParts = [
    args.runtimeContext.longTermMemory ? `Memória longa do perfil:\n${args.runtimeContext.longTermMemory}` : '',
    args.routineContext.recentSessionHistory ? `Histórico recente de sessões:\n${args.routineContext.recentSessionHistory}` : '',
    args.routineContext.promptSummary ? `Resumo de rotina/check-ins:\n${args.routineContext.promptSummary}` : '',
    relatedActiveGoals.length
      ? `Metas ativas relacionadas ao relato:\n${relatedActiveGoals.join(' | ')}`
      : '',
    relatedCompletedGoals.length
      ? `Metas já concluídas relacionadas ao relato (usar só como evidência histórica, não como pendência):\n${relatedCompletedGoals.join(' | ')}`
      : '',
  ].filter(Boolean);

  if (fallbackParts.length === 0) {
    console.warn('[journal/memory] RAG vazio e sem fallback reflexivo disponível.');
    return { ragContext: '', retrievedCount: 0, usedFallback: true, rejectedMemoryReasons };
  }

  console.warn('[journal/memory] RAG vetorial vazio; usando fallback reflexivo de sessões/perfil.');
  // Fix H: avisar EXPLICITAMENTE ao modelo que isso é fallback, não busca direta.
  // Sem esse aviso, o modelo tratava como evidência específica e citava errado.
  const fallbackHeader = '⚠️ ATENÇÃO: busca vetorial sem resultado direto sobre o relato atual. Memória abaixo é resumo de sessões anteriores e perfil — use SÓ como contexto longitudinal de padrão, NÃO como evidência específica do que ela disse hoje. Não escreva "lembro que você disse X" baseado nisso.';
  return {
    ragContext: `\n${fallbackHeader}\n\nMEMÓRIA LONGITUDINAL DISPONÍVEL (fallback semântico):\n${fallbackParts.join('\n\n')}`,
    retrievedCount: 0,
    usedFallback: true,
    rejectedMemoryReasons,
  };
}

function buildJournalReflectiveContext(args: {
  currentMessage: string;
  situationText: string;
  ragContext: string;
  memoryUsedFallback: boolean;
  routineContext: {
    promptSummary?: string;
    recentSessionHistory?: string;
    topThemes?: string[];
    topPlannerCategories?: string[];
    activeGoals?: string[];
  };
  runtimeContext: {
    moodCycleContext?: string | null;
    longTermMemory?: string | null;
    activeGoalsContext?: string | null;
    latestCheckinSignals?: {
      note?: string;
      emotions?: string[];
      factors?: string[];
      stateLabel?: string;
    } | null;
  };
  plannerContext?: string | null;
  groundingText?: string | null;
}): string {
  const currentMessage = sanitizePromptContent(args.currentMessage);
  const latestCheckin = args.runtimeContext.latestCheckinSignals;
  const checkinParts = latestCheckin
    ? [
        latestCheckin.stateLabel ? `estado: ${latestCheckin.stateLabel}` : null,
        latestCheckin.note ? `nota: ${sanitizePromptContent(latestCheckin.note)}` : null,
        latestCheckin.emotions?.length ? `emoções: ${latestCheckin.emotions.join(', ')}` : null,
        latestCheckin.factors?.length ? `fatores: ${latestCheckin.factors.join(', ')}` : null,
      ].filter(Boolean).join(' | ')
    : '';

  return [
    'Entrada atual é prioridade absoluta. Entenda cronologia, fato real e correções antes de usar memória.',
    `Mensagem atual: ${currentMessage}`,
    args.situationText,
    'Tarefa interna: responder com análise, não paráfrase; cruzar memória/contexto quando houver conexão real.',
    args.ragContext
      ? `Memórias recupera…57281 tokens truncated…      const savedSelectedIds = Array.isArray(pref?.gcalSelectedCalendars)
        ? (pref?.gcalSelectedCalendars as unknown[]).map((id) => String(id).trim()).filter(Boolean)
        : [];
      const requiredSelectedIds = calendars
        .filter((calendar: any) => calendar.accessRole !== 'none' && calendar.accessRole !== 'freeBusyReader' && isMinhaAgendaCalendar(calendar))
        .map((calendar: any) => calendar.id);
      const defaultSelectedIds = calendars
        .filter((calendar: any) => (calendar.selected || isMinhaAgendaCalendar(calendar)) && calendar.accessRole !== 'none' && calendar.accessRole !== 'freeBusyReader')
        .map((calendar: any) => calendar.id);
      const selectedIds = Array.from(new Set([
        ...(savedSelectedIds.length > 0 ? savedSelectedIds : defaultSelectedIds),
        ...requiredSelectedIds,
      ]));
      const writableIds = calendars
        .filter((calendar: any) => calendar.accessRole === 'owner' || calendar.accessRole === 'writer')
        .map((calendar: any) => calendar.id);
      const writeCalendarId = pref?.gcalWriteCalendarId && writableIds.includes(pref.gcalWriteCalendarId)
        ? pref.gcalWriteCalendarId
        : writableIds.includes('primary') ? 'primary' : writableIds[0] ?? 'primary';

      return res.json({ connected: true, calendars, selectedIds, writeCalendarId });
    } catch (err) {
      console.error('[gcal/calendars]', err);
      return res.json({ connected: false, calendars: [] });
    }
  });

  /**
   * PUT /api/gcal/calendars — save the user's selected calendar IDs
   */
  app.put('/api/gcal/calendars', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = z.object({
        calendarIds: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
        writeCalendarId: z.string().trim().min(1).max(500),
      }).parse(req.body);
      if (!data.calendarIds.includes(data.writeCalendarId)) {
        return res.status(400).json({ error: 'Write calendar must be included in the selected calendars' });
      }
      await prisma.userPreference.upsert({
        where: { userId },
        update: {
          gcalSelectedCalendars: data.calendarIds,
          gcalWriteCalendarId: data.writeCalendarId,
        } as any,
        create: {
          userId,
          gcalSelectedCalendars: data.calendarIds,
          gcalWriteCalendarId: data.writeCalendarId,
        } as any,
      });
      return res.json({
        ok: true,
        calendarIds: data.calendarIds,
        writeCalendarId: data.writeCalendarId,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors });
      }
      console.error('[gcal/calendars PUT]', err);
      return res.status(500).json({ error: 'Failed to save calendar selection' });
    }
  });

  app.patch('/api/gcal/events/:eventId', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { eventId } = req.params;
    const calendarId = typeof req.query.calendarId === 'string' && req.query.calendarId.trim()
      ? req.query.calendarId.trim()
      : 'primary';
    const body = req.body as {
      date?: string;
      title?: string;
      startTime?: string;
      endTime?: string;
      status?: string;
      note?: string;
    };
    const status = body.status === 'completed' ? 'completed' : body.status === 'planned' ? 'planned' : undefined;

    try {
      const updated = await GCalService.updateEvent(prisma, userId, calendarId, eventId, {
        date: body.date,
        title: typeof body.title === 'string' ? body.title.trim() : undefined,
        startTime: body.startTime,
        endTime: body.endTime,
        status,
        note: body.note,
      });

      if (!updated) {
        return res.status(502).json({ error: 'Não consegui atualizar esse evento do Google Agenda.' });
      }

      return res.json({ updated: true, event: updated });
    } catch (err) {
      console.error('[gcal/events PATCH]', err);
      return res.status(500).json({ error: 'Failed to update Google Calendar event' });
    }
  });

  app.delete('/api/gcal/events/:eventId', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { eventId } = req.params;
    const calendarId = typeof req.query.calendarId === 'string' && req.query.calendarId.trim()
      ? req.query.calendarId.trim()
      : 'primary';

    try {
      const deleted = await GCalService.deleteEvent(prisma, userId, calendarId, eventId);
      if (!deleted) {
        return res.status(502).json({ error: 'Não consegui excluir esse evento do Google Agenda.' });
      }

      return res.status(204).send();
    } catch (err) {
      console.error('[gcal/events DELETE]', err);
      return res.status(500).json({ error: 'Failed to delete Google Calendar event' });
    }
  });

  app.post('/api/gcal/disconnect', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    await prisma.userPreference.update({
      where: { userId },
      data: {
        gcalAccessToken: null,
        gcalRefreshToken: null,
        gcalSelectedCalendars: [],
        gcalWriteCalendarId: null,
      } as any,
    }).catch(() => {});
    return res.json({ disconnected: true });
  });

  /**
   * POST /api/timeline/:id/postpone
   * Move um bloco real do Planner para o dia seguinte, mantendo horário e metadados.
   * Registra o adiamento para análise de repetição e padrão.
   */
  app.post('/api/timeline/:id/postpone', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;

    try {
      const data = PostponeTimelineBlockSchema.parse(req.body ?? {});
      const block = await prisma.timelineBlock.findUnique({ where: { id } });
      if (!block || block.userId !== userId) {
        return res.status(404).json({ error: 'Block not found' });
      }

      const originalDate = formatDateOnly(block.localDate);
      if (!originalDate) {
        return res.status(400).json({ error: 'Block has invalid localDate' });
      }

      const targetDate = data.targetDate ?? addDaysToDateKey(originalDate, 1);
      const targetBaseDate = parseLocalDateInput(targetDate);
      const startTime = formatUtcTime(block.startAt);
      const endTime = formatUtcTime(block.endAt);
      const startAt = PlannerService.parseTimeToDate(targetBaseDate, startTime);
      const endAt = PlannerService.parseTimeToDate(targetBaseDate, endTime);

      const postponeCount = await prisma.eventLog.count({
        where: {
          userId,
          eventName: 'timeline.block_postponed',
          properties: {
            path: ['blockId'],
            equals: block.id,
          } as any,
        },
      }).catch(() => 0);

      const updated = await prisma.timelineBlock.update({
        where: { id: block.id },
        data: {
          localDate: targetBaseDate,
          startAt,
          endAt,
          status: 'planned',
          ...buildPostponeAdaptabilityUpdate(block),
        },
      });

      await prisma.eventLog.create({
        data: {
          userId,
          eventName: 'timeline.block_postponed',
          properties: {
            blockId: block.id,
            title: block.title,
            category: block.category,
            intensity: block.intensity,
            originalDate,
            targetDate,
            startTime,
            endTime,
            reason: data.reason || 'manual_planner_button',
            postponeCount: postponeCount + 1,
          },
          path: req.path,
          userAgent: req.get('user-agent') ?? null,
        },
      }).catch(() => null);

      await AiActionFeedbackService.append(prisma, userId, {
        title: block.title,
        status: 'scheduled',
        surface: 'planner',
        sourceType: 'timeline-postpone',
        localDate: originalDate,
      }).catch(() => null);

      // Memory: registra padrão de adiamento (fire-and-forget)
      const pCount = postponeCount + 1;
      const postponeMemory = pCount >= 3
        ? `Tarefa "${block.title}" adiada pela ${pCount}ª vez — padrão de resistência recorrente a essa atividade.`
        : `Tarefa "${block.title}" foi adiada de ${originalDate} para ${targetDate}.`;
      void memoryService.store({
        userId,
        contentType: 'checkin_note',
        contentId: `postpone-${block.id}-${pCount}`,
        content: postponeMemory,
        metadata: { source: 'task_postponed', taskId: block.id, postponeCount: pCount, category: block.category },
      }).catch(() => {});

      try {
        await GCalService.syncBlockToGcal(prisma, userId, updated, targetDate);
      } catch (e) {}

      return res.json({
        postponed: true,
        block: updated,
        originalDate,
        targetDate,
        postponeCount: postponeCount + 1,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[timeline/postpone] Error:', error);
      return res.status(500).json({ error: 'Failed to postpone timeline block' });
    }
  });

  /**
   * POST /api/timeline/:id/started
   * Registra que a pessoa INICIOU a tarefa (sem concluí-la).
   * Vira memória RAG e para os persistent reminders por 1 hora.
   */
  app.post('/api/timeline/:id/started', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;

    try {
      const block = await defaultPrisma.timelineBlock.findFirst({ where: { id, userId } });
      if (!block) return res.status(404).json({ error: 'Block not found' });

      const now = new Date();

      // Loga o evento de início
      await defaultPrisma.eventLog.create({
        data: {
          userId,
          eventName: 'timeline.block_started',
          properties: { blockId: id, title: block.title, startedAt: now.toISOString() },
        },
      }).catch(() => {});

      // Salva na memória RAG como vitória de presença
      const startMemory = `Hoje iniciou a tarefa "${block.title}" às ${now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}. Começar já é uma vitória — mesmo sem terminar.`;
      void new MemoryService(defaultPrisma).store({
        userId,
        contentType: 'checkin_note',
        contentId: `started-${id}-${now.toDateString()}`,
        content: startMemory,
        metadata: { source: 'task_started', taskId: id, category: block.category },
      }).catch(() => {});

      return res.json({ started: true, blockId: id });
    } catch (error) {
      console.error('[timeline/started] Error:', error);
      return res.status(500).json({ error: 'Failed to register task start' });
    }
  });

  /**
   * POST /api/timeline/:id/snooze
   * "Deriva com prazo" — aceita a evitação com deadline.
   * Body: { until: ISO string } — horário em que os persistent reminders voltam a disparar.
   */
  app.post('/api/timeline/:id/snooze', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    const { until } = req.body as { until?: string };

    if (!until) return res.status(400).json({ error: 'until is required' });
    const snoozedUntil = new Date(until);
    if (Number.isNaN(snoozedUntil.getTime())) return res.status(400).json({ error: 'Invalid date' });

    try {
      const block = await defaultPrisma.timelineBlock.findFirst({ where: { id, userId } });
      if (!block) return res.status(404).json({ error: 'Block not found' });

      await (defaultPrisma.timelineBlock as any).update({
        where: { id },
        data: { snoozedUntil },
      });

      await defaultPrisma.eventLog.create({
        data: {
          userId,
          eventName: 'timeline.block_snoozed',
          properties: { blockId: id, title: block.title, snoozedUntil: snoozedUntil.toISOString() },
        },
      }).catch(() => {});

      return res.json({ snoozed: true, blockId: id, until: snoozedUntil.toISOString() });
    } catch (error) {
      console.error('[timeline/snooze] Error:', error);
      return res.status(500).json({ error: 'Failed to snooze block' });
    }
  });

  /**
   * DELETE /api/timeline/:id
   * Remove um bloco do planner (hard delete, pois blocos não têm valor histórico crítico).
   */
  app.delete('/api/timeline/:id', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;

    try {
      const scope = normalizeTimelineDeleteScope(req.query.scope);
      const block = await prisma.timelineBlock.findUnique({ where: { id } });
      if (!block || block.userId !== userId) {
        return res.status(404).json({ error: 'Block not found' });
      }

      const recurring = normalizeRecurringForSeries(block.recurring);
      if (!recurring.enabled || scope === 'this') {
        await prisma.timelineBlock.delete({ where: { id } });
        return res.status(204).send();
      }

      const startTime = formatUtcTime(block.startAt);
      const endTime = formatUtcTime(block.endAt);
      const dateBoundary = block.localDate;
      const candidates = await prisma.timelineBlock.findMany({
        where: {
          userId,
          title: block.title,
          category: block.category,
          ...(scope === 'future'
            ? { localDate: { gt: dateBoundary } }
            : scope === 'this-and-future'
              ? { localDate: { gte: dateBoundary } }
              : {}),
        },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          recurring: true,
        },
      });
      const ids = candidates
        .filter((candidate) => formatUtcTime(candidate.startAt) === startTime)
        .filter((candidate) => formatUtcTime(candidate.endAt) === endTime)
        .filter((candidate) => sameRecurringSeries(candidate.recurring, block.recurring))
        .map((candidate) => candidate.id);

      if (ids.length === 0) {
        return res.json({ deletedCount: 0 });
      }

      const { count } = await prisma.timelineBlock.deleteMany({
        where: { userId, id: { in: ids } },
      });

      return res.json({ deletedCount: count });
    } catch (error: any) {
      console.error('[timeline/delete] Error:', error);
      return res.status(500).json({ error: 'Failed to delete timeline block' });
    }
  });

  // ── Endpoints de Hábitos ──────────────────────────────────────────────────

  /**
   * GET /api/habits
   * Lista os hábitos do usuário para uma data específica.
   */
  // ─── KNOWLEDGE GRAPH — Backfill + Fase B (CRUD) ──────────────────────────

  /** GET /api/me/knowledge-graph/status — quanto existe vs já processado */
  app.get('/api/me/knowledge-graph/status', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const status = await KnowledgeGraphBackfillService.getStatus(userId);
      return res.json(status);
    } catch (error) {
      console.error('[kg/status]', error);
      return res.status(500).json({ error: 'Failed to load knowledge graph status' });
    }
  });

  /** POST /api/me/knowledge-graph/backfill — processa históricos existentes
   *  Body opcional: { forceFromScratch?: boolean, limit?: number, sinceDate?: 'YYYY-MM-DD' }
   *  Roda síncrono até MAX_MESSAGES_PER_RUN — cliente pode chamar várias vezes
   *  pra processar em pedaços (cursor preservado via EventLog).
   */
  app.post('/api/me/knowledge-graph/backfill', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const body = (req.body ?? {}) as { forceFromScratch?: boolean; limit?: number; sinceDate?: string };
      const result = await KnowledgeGraphBackfillService.runForUser(userId, body);
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('[kg/backfill]', error);
      return res.status(500).json({ error: 'Backfill failed', message: (error as Error).message });
    }
  });

  /** GET /api/me/knowledge-graph — lista completa do contexto pra tela /me/contexto */
  app.get('/api/me/knowledge-graph', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const [entities, facts, patterns, decisions] = await Promise.all([
        prisma.userEntity.findMany({
          where: { userId },
          orderBy: { lastMentionAt: 'desc' },
          take: 100,
        }),
        prisma.userFact.findMany({
          where: { userId },
          orderBy: { occurredAt: 'desc' },
          take: 200,
          include: { entity: { select: { canonicalName: true } } },
        }),
        prisma.userPattern.findMany({
          where: { userId },
          orderBy: { strength: 'desc' },
          take: 50,
        }),
        prisma.userOpenDecision.findMany({
          where: { userId },
          orderBy: { raisedAt: 'desc' },
          take: 50,
        }),
      ]);
      return res.json({ entities, facts, patterns, decisions });
    } catch (error) {
      console.error('[kg/list]', error);
      return res.status(500).json({ error: 'Failed to load knowledge graph' });
    }
  });

  /** DELETE /api/me/knowledge-graph/entity/:id — remove entidade (e fatos órfãos viram null) */
  app.delete('/api/me/knowledge-graph/entity/:id', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    try {
      const entity = await prisma.userEntity.findFirst({ where: { id, userId } });
      if (!entity) return res.status(404).json({ error: 'Entity not found' });
      await prisma.userEntity.delete({ where: { id } });
      return res.json({ ok: true });
    } catch (error) {
      console.error('[kg/entity/delete]', error);
      return res.status(500).json({ error: 'Failed to delete entity' });
    }
  });

  /** PATCH /api/me/knowledge-graph/entity/:id — corrigir nome, status, etc. */
  app.patch('/api/me/knowledge-graph/entity/:id', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    const body = req.body as Partial<{ canonicalName: string; aliases: string[]; type: string; status: string }>;
    try {
      const entity = await prisma.userEntity.findFirst({ where: { id, userId } });
      if (!entity) return res.status(404).json({ error: 'Entity not found' });
      const updated = await prisma.userEntity.update({
        where: { id },
        data: {
          canonicalName: typeof body.canonicalName === 'string' ? body.canonicalName.trim() : undefined,
          aliases: Array.isArray(body.aliases) ? body.aliases : undefined,
          type: typeof body.type === 'string' ? body.type : undefined,
          status: typeof body.status === 'string' ? body.status : undefined,
        },
      });
      return res.json(updated);
    } catch (error) {
      console.error('[kg/entity/patch]', error);
      return res.status(500).json({ error: 'Failed to update entity' });
    }
  });

  /** DELETE /api/me/knowledge-graph/fact/:id — remove fato */
  app.delete('/api/me/knowledge-graph/fact/:id', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    try {
      const fact = await prisma.userFact.findFirst({ where: { id, userId } });
      if (!fact) return res.status(404).json({ error: 'Fact not found' });
      await prisma.userFact.delete({ where: { id } });
      return res.json({ ok: true });
    } catch (error) {
      console.error('[kg/fact/delete]', error);
      return res.status(500).json({ error: 'Failed to delete fact' });
    }
  });

  /** DELETE /api/me/knowledge-graph/pattern/:id — remove padrão observado */
  app.delete('/api/me/knowledge-graph/pattern/:id', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    try {
      const p = await prisma.userPattern.findFirst({ where: { id, userId } });
      if (!p) return res.status(404).json({ error: 'Pattern not found' });
      await prisma.userPattern.delete({ where: { id } });
      return res.json({ ok: true });
    } catch (error) {
      console.error('[kg/pattern/delete]', error);
      return res.status(500).json({ error: 'Failed to delete pattern' });
    }
  });

  /** POST /api/me/knowledge-graph/decision/:id/resolve — marca decisão como resolvida */
  app.post('/api/me/knowledge-graph/decision/:id/resolve', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    const { resolution } = (req.body ?? {}) as { resolution?: string };
    try {
      const d = await prisma.userOpenDecision.findFirst({ where: { id, userId } });
      if (!d) return res.status(404).json({ error: 'Decision not found' });
      await KnowledgeGraphService.markDecisionResolved(id, resolution);
      return res.json({ ok: true });
    } catch (error) {
      console.error('[kg/decision/resolve]', error);
      return res.status(500).json({ error: 'Failed to resolve decision' });
    }
  });

  app.get('/api/habits', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { date } = req.query;
    try {
      const { HabitService, parseHabitReferenceDate } = await import('./services/habit.service');
      const habits = date
        ? await HabitService.getHabitsForDate(userId, parseHabitReferenceDate(String(date)))
        : await HabitService.listHabits(userId, new Date());
      return res.json(habits);
    } catch (error) {
      console.error('[habits/list]', error);
      return res.status(500).json({ error: 'Failed to fetch habits' });
    }
  });

  /**
   * POST /api/habits
   * Cria um novo hábito.
   */
  app.post('/api/habits', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = HabitCreateSchema.parse(req.body);
      const { HabitService } = await import('./services/habit.service');
      const habit = await HabitService.createHabit({ ...data, userId });
      return res.status(201).json(habit);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[habits/create]', error);
      return res.status(500).json({ error: 'Failed to create habit' });
    }
  });

  /**
   * POST /api/habits/:id/toggle
   * Registra ou inverte a conclusão de um hábito.
   */
  app.post('/api/habits/:id/toggle', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    const { date, notes } = req.body;
    try {
      const { HabitService, parseHabitReferenceDate } = await import('./services/habit.service');
      const targetDate = parseHabitReferenceDate(date ? String(date) : undefined);
      const localDate = startOfDay(targetDate);

      // Pre-check: saber se já existia completion pra detectar nova conclusão
      const prevCompletion = await prisma.habitCompletion.findFirst({
        where: { habitId: id, date: localDate },
      }).catch(() => null);
      const wasAlreadyCompleted = Boolean(prevCompletion);

      const habit = await HabitService.toggleCompletion(id, targetDate, userId, notes);

      // Memory: registra quando hábito é concluído pela primeira vez no dia (fire-and-forget)
      if (!wasAlreadyCompleted) {
        const habitInfo = await prisma.habit.findUnique({
          where: { id },
          select: { title: true, category: true },
        }).catch(() => null);
        if (habitInfo) {
          void memoryService.store({
            userId,
            contentType: 'checkin_note',
            contentId: `habit-done-${id}-${format(localDate, 'yyyy-MM-dd')}`,
            content: `Hábito concluído: "${habitInfo.title}"${habitInfo.category ? ` [${habitInfo.category}]` : ''}`,
            metadata: { source: 'habit_completed', habitId: id, date: format(localDate, 'yyyy-MM-dd'), category: habitInfo.category },
          }).catch(() => {});
        }
      }

      // Retorno imediato de cada conclusão: é isso que fecha o ciclo e devolve
      // dopamina. Desmarcar não gera comemoração nenhuma — e também não gera recado.
      const justCompleted = !wasAlreadyCompleted;
      const reward = justCompleted
        ? buildCompletionReward({
            title: (habit as any)?.title ?? '',
            kind: 'habit_done',
            today: format(localDate, 'yyyy-MM-dd'),
          })
        : null;

      return res.json({ ...habit, reward });
    } catch (error: any) {
      console.error('[habits/toggle]', error);
      return res.status(500).json({ error: error.message || 'Failed to toggle habit' });
    }
  });

  /**
   * GET /api/habits/:id/history
   * Retorna as datas de conclusão de um hábito nos últimos N dias (padrão 28).
   */
  app.get('/api/habits/:id/history', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    const weeks = parseInt((req.query.weeks as string) || '4', 10);
    const days = weeks * 7;
    try {
      const habit = await prisma.habit.findUnique({ where: { id } });
      if (!habit || habit.userId !== userId) {
        return res.status(404).json({ error: 'Habit not found' });
      }
      const since = startOfDay(subDays(new Date(), days - 1));
      const completions = await prisma.habitCompletion.findMany({
        where: { habitId: id, date: { gte: since } },
        select: { date: true },
        orderBy: { date: 'asc' },
      });
      const dates = completions.map((c: { date: Date }) => format(c.date, 'yyyy-MM-dd'));
      return res.json({ dates, days });
    } catch (error) {
      console.error('[habits/history]', error);
      return res.status(500).json({ error: 'Failed to fetch habit history' });
    }
  });

  /**
   * PATCH /api/habits/:id
   * Atualiza ou arquiva um hábito.
   */
  app.patch('/api/habits/:id', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    try {
      const data = HabitPatchSchema.parse(req.body);
      const habit = await prisma.habit.updateMany({
        where: { id, userId },
        data,
      });
      if (habit.count === 0) return res.status(404).json({ error: 'Habit not found' });
      const updated = await prisma.habit.findUnique({ where: { id } });
      return res.json(updated);
    } catch (error) {
      console.error('[habits/update]', error);
      return res.status(500).json({ error: 'Failed to update habit' });
    }
  });

  // POST /api/push/subscribe — save push subscription
  app.post('/api/push/subscribe', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { endpoint, keys, userAgent } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Missing subscription fields' });
      }
      await prisma.pushSubscription.upsert({
        where: { endpoint },
        update: { userId, p256dhKey: keys.p256dh, authKey: keys.auth, userAgent: userAgent || null },
        create: { userId, endpoint, p256dhKey: keys.p256dh, authKey: keys.auth, userAgent: userAgent || null },
      });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/push/subscribe — remove subscription
  app.delete('/api/push/subscribe', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/push/vapid-public-key — expose public key to frontend
  app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
    return res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // ── Billing / Stripe (checkout/portal/status — atrás do requireAuth) ──────
  app.post('/api/billing/checkout', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const email = typeof req.body?.email === 'string' ? req.body.email : undefined;
      const plan = req.body?.plan === 'annual' ? 'annual' : 'monthly';
      const { StripeService } = await import('./services/stripe.service');
      const url = await StripeService.createCheckoutSession(userId, email, plan);
      res.json({ url });
    } catch {
      res.status(500).json({ error: 'checkout_failed' });
    }
  });

  app.post('/api/billing/portal', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const { StripeService } = await import('./services/stripe.service');
      const url = await StripeService.createPortalSession(userId);
      res.json({ url });
    } catch (err: any) {
      if (err.message === 'no_stripe_customer') return res.status(404).json({ error: 'no_subscription' });
      res.status(500).json({ error: 'portal_failed' });
    }
  });

  app.get('/api/billing/status', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const { StripeService } = await import('./services/stripe.service');
      const data = await StripeService.getSubscriptionStatus(userId);
      res.json(data);
    } catch {
      res.status(500).json({ error: 'status_failed' });
    }
  });

  // ── Jornada Interior (fusão do livro "Além da Solidão") ───────────────────
  app.get('/api/jornada', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const { JORNADA_STEPS } = await import('./lib/livro-essencia');
      const onboarding = await defaultPrisma.onboardingResponse.findUnique({
        where: { userId }, select: { aiProfilePayload: true },
      });
      const payload = (onboarding?.aiProfilePayload as Record<string, unknown>) ?? {};
      const jornada = (payload.jornada as { currentStep?: number; completed?: number[] }) ?? {};
      res.json({
        steps: JORNADA_STEPS,
        currentStep: jornada.currentStep ?? 1,
        completed: jornada.completed ?? [],
      });
    } catch {
      res.status(500).json({ error: 'jornada_failed' });
    }
  });

  app.post('/api/jornada/:n/complete', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const n = Math.max(1, Math.min(13, parseInt(req.params.n, 10) || 0));
      if (!n) return res.status(400).json({ error: 'invalid_step' });
      const existing = await defaultPrisma.onboardingResponse.findUnique({
        where: { userId }, select: { aiProfilePayload: true },
      });
      const payload = (existing?.aiProfilePayload as Record<string, unknown>) ?? {};
      const jornada = (payload.jornada as { currentStep?: number; completed?: number[] }) ?? {};
      const completed = Array.from(new Set([...(jornada.completed ?? []), n])).sort((a, b) => a - b);
      const currentStep = Math.min(13, Math.max(jornada.currentStep ?? 1, n + 1));
      await defaultPrisma.onboardingResponse.update({
        where: { userId },
        data: { aiProfilePayload: { ...payload, jornada: { currentStep, completed } } },
      });
      res.json({ currentStep, completed });
    } catch {
      res.status(500).json({ error: 'jornada_complete_failed' });
    }
  });

  /**
   * POST /api/ai/voice-checkin
   * Recebe transcrição de voz e extrai dados estruturados do check-in.
   */
  app.post('/api/ai/voice-checkin', requireAuth, async (req: Request, res: Response) => {
    try {
      const { transcript } = req.body as { transcript?: string };
      if (!transcript || transcript.trim().length < 3) {
        return res.status(400).json({ error: 'transcript_required' });
      }

      const EMOTION_OPTIONS = [
        'radiant','calm','happy','anxious','tired','focused',
        'sad','angry','stressed','sensitive','exhausted','agitated',
      ];
      const FACTOR_OPTIONS = [
        'Dormi bem (7h+)','Dormi pouco (<6h)','Acordei no meio da noite',
        'Tomei minha medicação','Esqueci a medicação',
        'Consegui me concentrar','Hyperfoco travado — não consigo parar',
        'Dissociada / no piloto automático','Nada parece interessante',
        'Paralisada — não consegui começar','Ansiedade alta hoje',
        'Irritabilidade fácil','Me senti sobrecarregada','Sintomas de TPM',
        'Ciclo intenso hoje','Dor física hoje','Pouca fome','Fome demais',
        'Tive um momento bom','Me conectei com alguém','Isolamento social',
        'Exercitei hoje','Saí de casa','Passei o dia em casa',
        'Trabalho pesado hoje','Reunião difícil','Conflito interpessoal',
        'Boa notícia hoje','Crise de ansiedade','Choro sem motivo claro',
        'Fiquei no celular demais','Não consegui dormir direito','Cansaço físico',
        'Clareza mental boa','Senti gratidão hoje',
      ];

      const emotionList = EMOTION_OPTIONS.join(', ');
      const factorList = FACTOR_OPTIONS.join(', ');

      const systemPrompt = [
        'Você é um extrator de dados de check-in emocional.',
        'Analise o relato da usuária e extraia as seguintes informações em JSON:',
        '{',
        '  "humor": <número 1-10, sendo 1=muito ruim e 10=excelente>,',
        '  "energia": <número 1-10, sendo 1=sem energia e 10=energia máxima>,',
        '  "sono": <horas de sono como número inteiro 3-12, ou null se não mencionado>,',
        '  "emotions": <array com 1-3 emoções da lista: ' + emotionList + '>,',
        '  "factors": <array com os fatores relevantes da lista abaixo>,',
        '  "note": <frase curta resumindo o que a pessoa disse, ou null>',
        '}',
        '',
        'Lista de fatores: ' + factorList + '.',
        '',
        'Regras:',
        '- Humor e energia são independentes.',
        '- Escolha apenas emotions claramente presentes no relato.',
        '- Escolha apenas factors claramente mencionados ou fortemente implícitos.',
        '- Se mencionar medicação tomada → "Tomei minha medicação"; se esqueceu → "Esqueci a medicação".',
        '- note deve soar natural, como a própria pessoa escreveria.',
        '- Responda APENAS com o JSON, sem markdown, sem explicação.',
      ].join('\n');

      const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Relato: "' + transcript.slice(0, 1200) + '"' },
        ],
        temperature: 0.2,
        max_tokens: 300,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.status(422).json({ error: 'parse_failed', raw });
      }

      const humor = Math.max(1, Math.min(10, Math.round(Number(parsed.humor) || 5)));
      const energia = Math.max(1, Math.min(10, Math.round(Number(parsed.energia) || 5)));
      const emotions = (Array.isArray(parsed.emotions) ? parsed.emotions : [])
        .filter((e: unknown) => typeof e === 'string' && EMOTION_OPTIONS.includes(e as string))
        .slice(0, 3);
      const factors = (Array.isArray(parsed.factors) ? parsed.factors : [])
        .filter((f: unknown) => typeof f === 'string' && FACTOR_OPTIONS.includes(f as string))
        .slice(0, 8);
      const note = typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : null;
      const sono = typeof parsed.sono === 'number' && parsed.sono >= 3 && parsed.sono <= 12 ? Math.round(parsed.sono) : null;

      return res.json({ humor, energia, sono, emotions, factors, note });
    } catch (err: unknown) {
      console.error('[voice-checkin] Error:', err);
      return res.status(500).json({ error: 'voice_checkin_failed' });
    }
  });


  /**
   * POST /api/checkins/backfill
   * Cria entradas sintéticas para dias sem check-in, baseadas na sondagem de retorno.
   * pattern: 'stable' | 'good' | 'mixed' | 'hard' | 'crisis'
   */
  app.post('/api/checkins/backfill', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const { periodStart, periodEnd, pattern, note } = req.body as {
        periodStart?: string;
        periodEnd?: string;
        pattern?: string;
        note?: string;
      };

      if (!periodStart || !periodEnd || !pattern) {
        return res.status(400).json({ error: 'periodStart, periodEnd e pattern são obrigatórios' });
      }

      const PATTERN_DELTAS: Record<string, { humor: number; energia: number }> = {
        stable: { humor: 0, energia: 0 },
        good:   { humor: 2, energia: 2 },
        mixed:  { humor: 0, energia: 0 },
        hard:   { humor: -2, energia: -2 },
        crisis: { humor: -4, energia: -3 },
      };
      const delta = PATTERN_DELTAS[pattern] ?? { humor: 0, energia: 0 };

      // Busca último check-in do usuário antes do período
      const lastCheckin = await prisma.dailyCheckin.findFirst({
        where: { userId, localDate: { lt: new Date(periodStart) } },
        orderBy: { localDate: 'desc' },
      });

      const baseHumor = lastCheckin ? lastCheckin.moodScore ?? 6 : 6;
      const baseEnergia = lastCheckin ? lastCheckin.energyScore ?? 6 : 6;

      // Gera datas entre periodStart e periodEnd (exclusive today)
      const dates: string[] = [];
      const cursor = new Date(periodStart + 'T12:00:00.000Z');
      const end = new Date(periodEnd + 'T12:00:00.000Z');
      while (cursor < end) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      let created = 0;
      for (let i = 0; i < dates.length; i++) {
        const dateKey = dates[i];
        // Evita duplicata
        const existing = await prisma.dailyCheckin.findFirst({
          where: { userId, localDate: new Date(dateKey) },
        });
        if (existing) continue;

        // Para 'mixed', alterna positivo/negativo
        const mixedSign = pattern === 'mixed' ? (i % 2 === 0 ? 1 : -1) : 1;
        const moodScore = Math.max(1, Math.min(10, baseHumor + delta.humor * mixedSign));
        const energyScore = Math.max(1, Math.min(10, baseEnergia + delta.energia * mixedSign));

        await prisma.dailyCheckin.create({
          data: {
            userId,
            localDate: new Date(dateKey),
            checkinSlot: 'midday-backfill',
            moodScore,
            energyScore,
            clarityScore: moodScore,
            irritabilityScore: Math.max(1, 10 - moodScore),
            physicalScore: energyScore,
            socialScore: moodScore,
          },
        });
        created++;
      }

      return res.json({ created, dates: dates.length });
    } catch (err: unknown) {
      console.error('[checkins/backfill] Error:', err);
      return res.status(500).json({ error: 'backfill_failed' });
    }
  });


  return app;
}

export const app = createApp();
function buildPersistentReminderMessage(
  taskTitle: string,
  note: string | null,
  fireCount: number,
  postponeCount: number,
  isAppearMode = false,
): { title: string; body: string } {
  const microStep = note?.trim() || null;

  // Modo "Só aparecer" — lembrete é sempre gentil e curtíssimo
  if (isAppearMode) {
    const appearMessages = [
      { title: `🌀 ${taskTitle}`, body: 'Só 2 minutos. Aparece e pronto.' },
      { title: `🌀 ${taskTitle}`, body: 'Não precisa terminar. Só aparecer já é uma vitória.' },
      { title: `🌀 ${taskTitle}`, body: 'Dois minutinhos. Você decide o que acontece depois.' },
    ];
    return appearMessages[fireCount % appearMessages.length];
  }

  // Avoidance memory: 3+ adiamentos = abordagem diferente
  if (postponeCount >= 3) {
    const strategies = [
      { title: `💬 ${taskTitle}`, body: 'Você adiou isso algumas vezes. O que está travando? Abre o chat.' },
      { title: `🌀 ${taskTitle}`, body: 'Tudo bem não querer. Mas vamos entender juntas o que trava. Toca aqui.' },
      { title: `🤝 ${taskTitle}`, body: 'Sem pressão. Só 2 minutos pra aparecer. Depois você decide.' },
    ];
    return strategies[fireCount % strategies.length];
  }

  // Rotação padrão por número de disparos
  if (fireCount === 1) {
    return {
      title: `📍 ${taskTitle}`,
      body: microStep ? `Primeiro passo: ${microStep}` : 'Ainda dá tempo. Como está indo?',
    };
  }
  if (fireCount === 2) {
    return {
      title: `⏳ ${taskTitle}`,
      body: 'Só 5 minutos agora. Não precisa terminar — só começar.',
    };
  }
  if (fireCount === 3) {
    return {
      title: `🎯 ${taskTitle}`,
      body: 'Qual é o menor pedaço que dá pra fazer agora mesmo?',
    };
  }
  // 4+: alterna entre ajuda e presença
  const lateMessages = [
    { title: `💬 ${taskTitle}`, body: 'Ainda aqui. Quer ajuda pra quebrar isso em partes?' },
    { title: `🌿 ${taskTitle}`, body: 'Sem cobrança. Só aparecer já conta. Toca aqui.' },
    { title: `⚡ ${taskTitle}`, body: microStep ? `Só isso: ${microStep}` : 'Uma coisa. Dois minutos. É isso.' },
  ];
  return lateMessages[(fireCount - 4) % lateMessages.length];
}

async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string; blockId?: string; actions?: Array<{ action: string; title: string }> }) {
  const subs = await defaultPrisma.pushSubscription.findMany({ where: { userId } });

  const expoMessages: ExpoPushMessage[] = [];

  await Promise.allSettled(
    subs.map(async sub => {
      if (Expo.isExpoPushToken(sub.endpoint)) {
        expoMessages.push({
          to: sub.endpoint,
          title: payload.title,
          body: payload.body,
          data: { url: payload.url || '/', blockId: payload.blockId },
          sound: 'default',
        });
        return;
      }

      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
      const data = JSON.stringify(payload);
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dhKey, auth: sub.authKey } },
        data
      ).catch(async (err: any) => {
        if (err.statusCode === 410) {
          await defaultPrisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
      });
    })
  );

  if (expoMessages.length > 0) {
    const chunks = expo.chunkPushNotifications(expoMessages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (e) {
        console.error('[expo-push] send error:', e);
      }
    }
  }
}

function getSaoPauloHHMM(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

const checkinNudgeTimeCache = new Map<string, { dateKey: string; time: string }>();

async function resolveUserCheckinNudgeTime(userId: string, preferredTime: string | null, dateKey: string): Promise<string> {
  const cached = checkinNudgeTimeCache.get(userId);
  if (cached && cached.dateKey === dateKey) return cached.time;

  let recentTimes: string[] = [];
  try {
    const recent = await defaultPrisma.dailyCheckin.findMany({
      where: { userId },
      orderBy: [{ localDate: 'desc' }, { recordedAt: 'desc' }],
      take: 10,
      select: { recordedAt: true },
    });
    recentTimes = recent.map((row) => getSaoPauloHHMM(row.recordedAt));
  } catch (e) {
    console.warn('[push-cron] falha ao ler padrão de check-in, usando horário preferido:', e);
  }

  const time = resolveCheckinNudgeTime({ preferredTime, recentCheckinTimes: recentTimes });
  checkinNudgeTimeCache.set(userId, { dateKey, time });
  return time;
}

async function countNudgesSentToday(userId: string, spDayStartUtc: Date): Promise<number> {
  try {
    return await defaultPrisma.eventLog.count({
      where: { userId, eventName: NUDGE_EVENT_NAME, createdAt: { gte: spDayStartUtc } },
    });
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

async function logNudgeSent(userId: string, kind: 'checkin' | 'journal', time: string): Promise<void> {
  try {
    await defaultPrisma.eventLog.create({
      data: { userId, eventName: NUDGE_EVENT_NAME, properties: { kind, time } },
    });
  } catch (e) {
    console.warn('[push-cron] falha ao registrar nudge enviado:', e);
  }
}

if (require.main === module) {
  cron.schedule('17 * * * *', async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentUsers = await defaultPrisma.profile.findMany({
        where: {
          OR: [
            { journalSessions: { some: { updatedAt: { gte: since } } } },
            { checkins: { some: { recordedAt: { gte: since } } } },
          ],
        },
        select: { id: true },
        take: 50,
      }).catch(() => []);

      if (recentUsers.length === 0) return;
      console.log(`[cron/kg-backfill] processando ${recentUsers.length} usuários`);

      for (const u of recentUsers) {
        try {
          const result = await KnowledgeGraphBackfillService.runForUser(u.id, { limit: 30 });
          if (result.extractionsSucceeded > 0) {
            console.log(`[cron/kg-backfill] user=${u.id} extracted=${result.extractionsSucceeded}`);
          }
        } catch (err) {
          console.warn(`[cron/kg-backfill] user=${u.id} falhou:`, err);
        }
      }
    } catch (err) {
      console.warn('[cron/kg-backfill] erro geral:', err);
    }
  });

  cron.schedule('7 * * * *', async () => {
    try {
      const purged = await new RoutineBuilderService(defaultPrisma).purgeExpiredSources();
      if (purged > 0) console.log(`[cron/routine-builder] fontes temporárias removidas=${purged}`);
    } catch (error) {
      console.warn('[cron/routine-builder] falha ao limpar fontes temporárias:', error);
    }
  });

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentTimeStr = getSaoPauloHHMM(now);
      const saoPauloToday = getSaoPauloDateContext(now);

      const habitsNow = await defaultPrisma.habit.findMany({
        where: { archived: false, reminderEnabled: true, reminderTime: currentTimeStr },
        include: {
          completions: {
            where: { date: saoPauloToday.dbDate },
            select: { completionCount: true },
          },
        },
      });
      const habitPrefsByUser = habitsNow.length > 0
        ? new Map(
            (await defaultPrisma.userPreference.findMany({
              where: { userId: { in: [...new Set(habitsNow.map((habit) => habit.userId))] } },
              select: { userId: true, notificationsOn: true, notificationPreferences: true },
            })).map((pref) => [pref.userId, pref]),
          )
        : new Map<string, { notificationsOn: boolean; notificationPreferences: any }>();
      const adaptiveCacheByUser = new Map<string, { pauseHabits: boolean; pauseReason: string | null }>();
      for (const habit of habitsNow) {
        if (!allowsHabitNotifications(habitPrefsByUser.get(habit.userId))) continue;
        if (!shouldSendHabitReminderToday(habit, saoPauloToday.weekday, saoPauloToday.dayOfMonth)) continue;
        try {
          let cached = adaptiveCacheByUser.get(habit.userId);
          if (!cached) {
            const recentCheckins = await defaultPrisma.dailyCheckin.findMany({
              where: { userId: habit.userId },
              orderBy: { localDate: 'desc' },
              take: 7,
              select: { moodScore: true, energyScore: true },
            });
            const { phase, warningFlags } = inferPhaseFromRecentCheckins(
              recentCheckins.map((c) => ({ moodScore: c.moodScore, energyScore: c.energyScore })),
            );
            const ctx = deriveAdaptiveContextFromPhase({ phase, warningFlags });
            cached = { pauseHabits: ctx.pauseHabits, pauseReason: ctx.pauseReason };
            adaptiveCacheByUser.set(habit.userId, cached);
          }
          if (cached.pauseHabits) {
            console.log(`[push-cron] habit paused for ${habit.userId} (${habit.id}): ${cached.pauseReason}`);
            continue;
          }
        } catch (e) {
          console.warn('[push-cron] adaptive check failed:', e);
        }
        await sendPushToUser(habit.userId, {
          title: `⏰ ${habit.title}`,
          body: 'Hora do seu hábito!',
          url: '/home',
          tag: `habit-${habit.id}`,
        });
      }

      const windowStart = new Date(now);
      windowStart.setUTCSeconds(0, 0);
      const windowEnd = new Date(windowStart.getTime() + 60000);
      const tasksNow = await defaultPrisma.timelineBlock.findMany({
        where: {
          startAt: { gte: windowStart, lt: windowEnd },
          status: 'planned',
          OR: [
            { isAiSuggested: false },
            { persistentReminderEnabled: true },
            { alarmEnabled: true },
            { vibrateEnabled: true },
            { recurringNotificationEnabled: true },
          ],
        },
      });
      const plannerPrefsByUser = tasksNow.length > 0
        ? new Map(
            (await defaultPrisma.userPreference.findMany({
              where: { userId: { in: [...new Set(tasksNow.map((task) => task.userId))] }, notificationsOn: true },
              select: { userId: true, notificationPreferences: true },
            })).map((pref) => [pref.userId, pref.notificationPreferences as any]),
          )
        : new Map<string, any>();
      for (const task of tasksNow) {
        const notifPrefs = plannerPrefsByUser.get(task.userId);
        if (!notifPrefs || notifPrefs.planner === false) continue;
        const isAppearMode = (task as any).taskMode === 'appear';
        const body = isAppearMode
          ? 'Só aparecer por 2 minutos. É tudo que precisa.'
          : (task.note?.trim() ? `Primeiro passo: ${task.note.trim()}` : `Começa agora — ${currentTimeStr}`);
        await sendPushToUser(task.userId, {
          title: isAppearMode ? `🌀 ${task.title}` : `📅 ${task.title}`,
          body,
          url: '/planner',
          tag: `task-${task.id}`,
          blockId: task.id,
          actions: [
            { action: 'done', title: '✅ Concluí' },
            { action: 'started', title: '🟡 Comecei' },
          ],
        });
      }

      // ─── Persistent reminders ────────────────────────────────────────────
      const persistentTasks = await defaultPrisma.timelineBlock.findMany({
        where: {
          persistentReminderEnabled: true,
          status: 'planned',
          startAt: { lt: new Date(now.getTime() - 60000) }, // mais de 1 min atrás
          localDate: saoPauloToday.dbDate,
          OR: [
            { snoozedUntil: null },
            { snoozedUntil: { lt: now } }, // snooze expirado
          ],
        } as any,
      });
      if (persistentTasks.length > 0) {
        const persistentUserIds = [...new Set(persistentTasks.map((t) => t.userId))];
        const persistentPrefsByUser = new Map(
          (await defaultPrisma.userPreference.findMany({
            where: { userId: { in: persistentUserIds }, notificationsOn: true },
            select: { userId: true, notificationPreferences: true },
          })).map((p) => [p.userId, p.notificationPreferences as any]),
        );
        const postponeEvents = await defaultPrisma.eventLog.findMany({
          where: { eventName: 'timeline.block_postponed', userId: { in: persistentUserIds } },
          select: { properties: true },
        });
        const postponeCountMap = new Map<string, number>();
        for (const ev of postponeEvents) {
          const blockId = (ev.properties as any)?.blockId;
          if (blockId) postponeCountMap.set(blockId, (postponeCountMap.get(blockId) ?? 0) + 1);
        }
        for (const task of persistentTasks) {
          const prefs = persistentPrefsByUser.get(task.userId);
          if (!prefs || (prefs as any).planner === false) continue;
          const intervalMin = task.persistentReminderIntervalMinutes ?? 30;
          const minutesPast = Math.floor((now.getTime() - task.startAt.getTime()) / 60000);
          if (minutesPast <= 0 || minutesPast % intervalMin !== 0) continue;
          const fireCount = Math.floor(minutesPast / intervalMin);
          const postponeCount = postponeCountMap.get(task.id) ?? 0;
          const isAppear = (task as any).taskMode === 'appear';
          const { title: pushTitle, body: pushBody } = buildPersistentReminderMessage(
            task.title, task.note ?? null, fireCount, postponeCount, isAppear,
          );
          await sendPushToUser(task.userId, {
            title: pushTitle,
            body: pushBody,
            url: '/planner',
            tag: `persistent-${task.id}`,
            blockId: task.id,
            actions: [
              { action: 'done', title: '✅ Concluí' },
              { action: 'started', title: '🟡 Comecei' },
              { action: 'help', title: '💬 Preciso de ajuda' },
            ],
          });
        }
      }

      const prefsCheckin = await defaultPrisma.userPreference.findMany({ where: { notificationsOn: true } });
      const spDayStartUtc = getSaoPauloDayStartUtc(saoPauloToday.dateKey);
      for (const pref of prefsCheckin) {
        const notifPrefs = (pref.notificationPreferences as any) || {};
        const journalTimes = notifPrefs.journal
          ? [notifPrefs.journalMorningTime || '10:00', notifPrefs.journalEveningTime || '21:00']
          : [];

        if (notifPrefs.checkin) {
          const nudgeTime = await resolveUserCheckinNudgeTime(pref.userId, pref.morningCheckinTime, saoPauloToday.dateKey);
          if (nudgeTime === currentTimeStr) {
            const [todayCheckin, nudgesSentToday] = await Promise.all([
              defaultPrisma.dailyCheckin.findFirst({
                where: { userId: pref.userId, localDate: saoPauloToday.dbDate },
                select: { id: true },
              }),
              countNudgesSentToday(pref.userId, spDayStartUtc),
            ]);
            const decision = shouldSendCheckinNudge({
              currentTime: currentTimeStr,
              nudgeTime,
              hasCheckinToday: Boolean(todayCheckin),
              nudgesSentToday,
            });
            if (decision.send) {
              await sendPushToUser(pref.userId, {
                title: '✨ Como você tá agora?',
                body: '1 toque e pronto — a Airia calibra seu dia.',
                url: '/checkin',
                tag: 'checkin-reminder',
              });
              await logNudgeSent(pref.userId, 'checkin', nudgeTime);
            } else {
              console.log(`[push-cron] checkin nudge skipped for ${pref.userId}: ${decision.reason}`);
            }
          }
        }

        if (journalTimes.includes(currentTimeStr)) {
          const nudgesSentToday = await countNudgesSentToday(pref.userId, spDayStartUtc);
          const decision = shouldSendJournalNudge({
            currentTime: currentTimeStr,
            journalTimes,
            nudgesSentToday,
          });
          if (decision.send) {
            await sendPushToUser(pref.userId, {
              title: 'Diário da Airia',
              body: 'Dois minutos para registrar o que mudou por dentro.',
              url: '/journal',
              tag: `journal-reminder-${currentTimeStr}`,
            });
            await logNudgeSent(pref.userId, 'journal', currentTimeStr);
          } else {
            console.log(`[push-cron] journal nudge skipped for ${pref.userId}: ${decision.reason}`);
          }
        }
      }
    } catch (e) {
      console.error('[push-cron] error:', e);
    }
  });

  cron.schedule('0 6 * * *', async () => {
    try {
      const now = new Date();
      const overdueTasks = await defaultPrisma.timelineBlock.findMany({
        where: { status: 'planned', startAt: { lt: now } },
        take: 200,
      });
      if (overdueTasks.length === 0) return;

      const byUser = new Map<string, typeof overdueTasks>();
      for (const t of overdueTasks) {
        const arr = byUser.get(t.userId) || [];
        arr.push(t);
        byUser.set(t.userId, arr);
      }

      let migrated = 0;
      let paused = 0;
      for (const [userId, tasks] of byUser.entries()) {
        const recent = await defaultPrisma.dailyCheckin.findMany({
          where: { userId },
          orderBy: { localDate: 'desc' },
          take: 7,
          select: { moodScore: true, energyScore: true },
        });
        const { phase, warningFlags } = inferPhaseFromRecentCheckins(
          recent.map((c) => ({ moodScore: c.moodScore, energyScore: c.energyScore })),
        );
        const ctx = deriveAdaptiveContextFromPhase({ phase, warningFlags });

        for (const task of tasks) {
          if (ctx.preFallActive || ctx.pauseHabits) {
            await defaultPrisma.timelineBlock
              .update({ where: { id: task.id }, data: { status: 'paused' } })
              .catch(() => null);
            paused++;
          } else {
            const newStart = new Date(now);
            newStart.setHours(task.startAt.getHours(), task.startAt.getMinutes(), 0, 0);
            const duration = task.endAt.getTime() - task.startAt.getTime();
            await defaultPrisma.timelineBlock
              .update({
                where: { id: task.id },
                data: { startAt: newStart, endAt: new Date(newStart.getTime() + duration) },
              })
              .catch(() => null);
            migrated++;
          }
        }
      }
      console.log(`[auto-reschedule] migrated=${migrated} paused=${paused}`);
    } catch (e) {
      console.error('[auto-reschedule] error:', e);
    }
  });

  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  setInterval(async () => {
    console.log('[AI Background] Processing pending jobs...');
    try {
      const { AiBackgroundService } = await import('./services/ai-background.service');
      const result = await AiBackgroundService.processPendingJobs();
      if (result.processed > 0) {
        console.log(`[AI Background] Processed ${result.processed} jobs, ${result.errors} errors`);
      }
    } catch (err) {
      console.error('[AI Background] Error:', err);
    }
  }, FIFTEEN_MINUTES);

  app.listen(port, () => {
    console.log(`[Airia Backend] Server running on port ${port}`);
  });
}

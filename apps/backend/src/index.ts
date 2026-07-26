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
import { MemoryService } from './services/memory.service';
import { CanonicalMemoryService } from './services/canonical-memory.service';
import { AuraMemoryIngestionService, conservativeAuraExtractor } from './services/aura-memory-ingestion.service';
import { AgendaPatternRecognitionService } from './services/agenda-pattern-recognition.service';
import { ContextGroundingService } from './services/context-grounding.service';
import { ReasoningContextService } from './services/reasoning-context.service';
import { AiriaOperationalReasoningService, type AiriaActionPlan } from './services/airia-operational-reasoning.service';
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
]);

/** Ações que só fazem sentido sobre um item que já existe. */
const AURA_ACTIONS_ON_EXISTING_ITEMS = new Set<AuraCommandResponse['action']>([
  'update_task',
  'delete_task',
  'complete_items',
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
  // A Airia decide a lacuna em vez de devolver a pergunta: título é o único dado
  // que ela não pode inventar; data e hora ela resolve.
  const completedPayload: Record<string, unknown> = { ...payload };
  if (response.action === 'create_task' && hasText(titleFrom(payload))) {
    const timing = completeAuraTaskTiming(payload, targetContext);
    completedPayload.date = timing.date;
    completedPayload.startTime = timing.startTime;
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

/** Formata hora UTC de um Date como HH:MM */
function fmtUtcTime(d: Date): string {
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
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
      ? `Memórias recuperadas/fallback:\n${args.ragContext}`
      : 'Memórias recuperadas/fallback: nenhuma útil; seja honesta e trabalhe só com o fato atual.',
    args.memoryUsedFallback ? 'Observação interna: RAG vetorial não trouxe fragmentos; use histórico/sumários como fallback, sem fingir lembrança específica.' : '',
    args.routineContext.recentSessionHistory ? `Sessões recentes:\n${args.routineContext.recentSessionHistory}` : '',
    args.runtimeContext.longTermMemory ? `Memória longa estruturada:\n${args.runtimeContext.longTermMemory}` : '',
    args.routineContext.promptSummary ? `Resumo de rotina/check-in:\n${args.routineContext.promptSummary}` : '',
    checkinParts ? `Check-in mais recente: ${checkinParts}` : '',
    args.runtimeContext.activeGoalsContext ? `Metas ativas:\n${args.runtimeContext.activeGoalsContext}` : '',
    args.plannerContext ? `Planner relevante (usar só se conectar ao relato):\n${args.plannerContext}` : '',
    args.groundingText ? `Chão operacional (não transformar em assunto se não conectar):\n${args.groundingText}` : '',
  ].filter(Boolean).join('\n\n');
}

const DAY_TASK_GENERIC_PATTERNS = [
  /\brespir(ar|e|acao|ação)\b/,
  /\bbeb(er|a)\s+(agua|água)\b/,
  /\bva\s+com\s+calma\b/,
  /\bvá\s+com\s+calma\b/,
  /\borganizar\s+(o\s+)?dia\b/,
  /\bplanejar\s+(o\s+)?dia\b/,
  /\bproximo\s+passo\b/,
  /\bpróximo\s+passo\b/,
  /\btarefa\s+pequena\b/,
  /\bkit(s)?\s+do\s+treino\b/,
];

const DAY_TASK_STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
  'para', 'pra', 'por', 'com', 'sem', 'que', 'se', 'sua', 'seu', 'suas', 'seus',
  'voce', 'você', 'hoje', 'agora', 'fazer', 'abrir', 'ver', 'revisar', 'criar',
  'marcar', 'organizar', 'definir', 'separar', 'colocar', 'pegar', 'min', 'minutos',
]);

function tokenOverlapForSuggestion(a: string, b: string): number {
  const left = normalizeSuggestionKey(a).split(' ').filter((token) => token.length >= 3 && !DAY_TASK_STOPWORDS.has(token));
  const right = normalizeSuggestionKey(b).split(' ').filter((token) => token.length >= 3 && !DAY_TASK_STOPWORDS.has(token));
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const common = left.filter((token) => rightSet.has(token)).length;
  return common / Math.min(left.length, right.length);
}

function isSimilarSuggestionText(a: string, b: string): boolean {
  const left = normalizeSuggestionKey(a);
  const right = normalizeSuggestionKey(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  return tokenOverlapForSuggestion(left, right) >= 0.58;
}

function isGenericDayTaskTitle(title: string, blockedTitles: string[]): boolean {
  const normalized = normalizeSuggestionKey(title);
  if (!normalized) return true;
  if (DAY_TASK_GENERIC_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  if (/\btrein(o|ar|amento)\b/.test(normalized)) {
    return blockedTitles.some((blocked) => /\btrein(o|ar|amento)\b/.test(normalizeSuggestionKey(blocked)));
  }
  return false;
}

function sanitizeAiSuggestion(type: string, suggestion: unknown, context: Record<string, unknown>): unknown {
  const recentSuggestionItems = Array.isArray(context.recentSuggestionItems)
    ? context.recentSuggestionItems.filter((item): item is { key: string; theme: string; text: string; sourceSurface: string; createdAt: string } =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as any).key === 'string' &&
        typeof (item as any).theme === 'string' &&
        typeof (item as any).text === 'string',
      )
    : [];

  if (type === 'home-messages' && suggestion && typeof suggestion === 'object') {
    const payload = suggestion as Record<string, unknown>;
    const actionPlan = context.airiaActionPlan as AiriaActionPlan | undefined;
    const plannedAction = typeof context.airiaOperationalSuggestion === 'string'
      ? context.airiaOperationalSuggestion.trim()
      : actionPlan?.action?.displayText?.trim();
    const rawAutocuidado = Array.isArray(payload.autocuidado)
      ? uniqueByKey(
          payload.autocuidado
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        )
      : [];
    if (plannedAction) {
      return {
        ...payload,
        autocuidado: [plannedAction],
        proactive: {
          emoji: '🎯',
          title: actionPlan?.decision.type === 'ask_anchor' ? 'Dar contexto' : 'Próximo movimento',
          desc: actionPlan?.visibleReason || 'A Airia escolheu uma ação ancorada no que existe hoje.',
          actionPath: actionPlan?.action?.route ?? null,
        },
      };
    }
    const novelAutocuidado = rawAutocuidado
      .filter((item) => !recentSuggestionItems.some((recent) => SuggestionMemoryService.isSimilar(item, recent)));
    const autocuidado = (novelAutocuidado.length > 0
      ? novelAutocuidado
      : rawAutocuidado.slice(0, 1).map((item) => `Retomar sugestão anterior: ${item}`))
      .slice(0, 3);

    return {
      ...payload,
      autocuidado,
    };
  }

  if (type === 'stability-analysis') {
    return sanitizeStabilityAnalysisSuggestion(suggestion, context);
  }

  if (type === 'day-tasks' && Array.isArray(suggestion)) {
    const avoidRaw = Array.isArray(context.avoidTaskTitles)
      ? context.avoidTaskTitles.filter((item): item is string => typeof item === 'string')
      : [];
    const blocked = new Set(avoidRaw.map((item) => normalizeSuggestionKey(item)));
    const seen = new Set<string>();

    const validItems = suggestion
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .filter((item) => typeof item.title === 'string' && typeof item.category === 'string');
    const filtered = validItems
      .filter((item) => {
        const title = String(item.title).trim();
        const key = normalizeSuggestionKey(title);
        if (!key || blocked.has(key) || seen.has(key)) return false;
        if (isGenericDayTaskTitle(title, avoidRaw)) return false;
        if (avoidRaw.some((blockedTitle) => isSimilarSuggestionText(title, blockedTitle))) return false;
        if (recentSuggestionItems.some((recent) => SuggestionMemoryService.isSimilar(title, recent))) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);

    return filtered;
  }

  if (type === 'agenda-blocks') {
    const targetDate = typeof context.targetAgendaDate === 'string'
      ? context.targetAgendaDate
      : (typeof context.localDate === 'string' ? context.localDate : new Date().toISOString().slice(0, 10));
    const existingBusyWindows = Array.isArray(context.existingAgendaBusyWindows)
      ? context.existingAgendaBusyWindows.filter((item): item is { startTime: string; endTime: string } =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as any).startTime === 'string' &&
          typeof (item as any).endTime === 'string',
        )
      : [];
    const externalBusyWindows = Array.isArray(context.externalBusyWindows)
      ? context.externalBusyWindows.filter((item): item is { startTime: string; endTime: string } =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as any).startTime === 'string' &&
          typeof (item as any).endTime === 'string',
        )
      : [];

    const sourceBlocks = Array.isArray(suggestion)
      ? suggestion.map((item) => {
          if (!item || typeof item !== 'object') return item;
          const block = item as Record<string, unknown>;
          if (!Array.isArray(block.tarefas_sugeridas)) return item;

          return {
            ...block,
            tarefas_sugeridas: block.tarefas_sugeridas.filter((task) =>
              typeof task === 'string' &&
              !recentSuggestionItems.some((recent) => SuggestionMemoryService.isSimilar(task, recent)),
            ),
          };
        })
      : suggestion;

    return PlannerService.scheduleAgendaSuggestions({
      targetDate,
      busyWindows: [...existingBusyWindows, ...externalBusyWindows],
      blocks: sourceBlocks,
    });
  }

  return suggestion;
}

async function extractAndSaveLongTermMemory(
  prisma: PrismaClient,
  userId: string,
  messages: Array<{ role: string; content: string }>,
  summary: { summary: string; emotions: string[]; themes: string[] },
): Promise<void> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const chatContent = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-20)
    .map((m) => `${m.role === 'user' ? 'Usuário' : 'Aura'}: ${m.content}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: getOpenAiModel(),
    messages: [
      {
        role: 'system',
        content: 'Você é um sistema de memória de IA. Extraia fatos permanentes e recorrentes de uma conversa de diário. Retorne apenas JSON.',
      },
      {
        role: 'user',
        content: `Analise e extraia APENAS informações que serão relevantes em futuras conversas (objetivos, pessoas importantes, padrões, insights pessoais). Ignore eventos únicos, detalhes do dia e conteúdo transitório.

CONVERSA:
${chatContent}

RESUMO: ${summary.summary}
TEMAS: ${summary.themes.join(', ')}

JSON APENAS: {"goals":["string"],"people":["string"],"patterns":["string"],"insights":["string"]}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: getOpenAiMaxCompletionTokens(1500),
    ...openAiTemperature(getOpenAiModel(), 0.2),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return;

  const extracted = JSON.parse(content) as {
    goals?: string[];
    people?: string[];
    patterns?: string[];
    insights?: string[];
  };

  const existing = await prisma.onboardingResponse.findUnique({
    where: { userId },
    select: { aiProfilePayload: true },
  });

  const existingPayload = (existing?.aiProfilePayload as Record<string, unknown>) ?? {};
  const existingRaw = (existingPayload.longTermMemoryRaw as Record<string, string[]>) ?? {};

  const mergeUnique = (prev: string[] = [], next: string[] = []) =>
    [...prev, ...next.filter((n) => !prev.includes(n))].slice(-20);

  const merged = {
    goals: mergeUnique(existingRaw.goals, extracted.goals),
    people: mergeUnique(existingRaw.people, extracted.people),
    patterns: mergeUnique(existingRaw.patterns, extracted.patterns),
    insights: mergeUnique(existingRaw.insights, extracted.insights),
  };

  const formatted = [
    merged.goals.length ? `Objetivos: ${merged.goals.join('; ')}` : null,
    merged.people.length ? `Pessoas importantes: ${merged.people.join('; ')}` : null,
    merged.patterns.length ? `Padrões: ${merged.patterns.join('; ')}` : null,
    merged.insights.length ? `Insights: ${merged.insights.join('; ')}` : null,
  ].filter(Boolean).join('\n');

  await prisma.onboardingResponse.upsert({
    where: { userId },
    update: { aiProfilePayload: { ...existingPayload, longTermMemory: formatted, longTermMemoryRaw: merged } },
    create: { userId, aiProfilePayload: { longTermMemory: formatted, longTermMemoryRaw: merged } },
  });
}

async function finalizeJournalSession(args: {
  prisma: PrismaClient;
  aiService: Pick<typeof AIService, 'summarizeJournalSession'>;
  journalSuggestedTasksGenerator: typeof generateJournalSuggestedTasks;
  memoryService?: Pick<MemoryService, 'store'>;
  userId: string;
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
  userName: string;
  profileSummary?: string | null;
  moodCycleContext?: string | null;
  longTermMemory?: string | null;
  activeGoalsContext?: string | null;
  recentSessionHistory?: string | null;
  currentHour?: number;
  currentMinute?: number;
  priorDiagnoses?: string[] | null;
}) {
  const summary = await args.aiService.summarizeJournalSession(args.messages, undefined as any, {
    userName: args.userName,
    profileSummary: args.profileSummary,
    moodCycleContext: args.moodCycleContext,
    longTermMemory: args.longTermMemory,
    activeGoalsContext: args.activeGoalsContext,
    recentSessionHistory: args.recentSessionHistory,
    priorDiagnoses: args.priorDiagnoses,
  });

  let suggestedTasks: SuggestedTask[] = [];
  try {
    suggestedTasks = await args.journalSuggestedTasksGenerator({
      systemPrompt: buildAuraSystemPrompt({
        userName: args.userName,
        profileSummary: args.profileSummary,
        moodCycleContext: args.moodCycleContext,
        longTermMemory: args.longTermMemory,
        activeGoalsContext: args.activeGoalsContext,
        recentSessionHistory: args.recentSessionHistory,
        domain: 'journal-finalize',
        currentHour: args.currentHour,
        currentMinute: args.currentMinute,
        priorDiagnoses: args.priorDiagnoses,
      }),
      userName: args.userName,
      moodCycleContext: args.moodCycleContext,
      currentHour: args.currentHour,
      currentMinute: args.currentMinute,
      acceptedSuggestions: summary.suggestions || [],
      recentMessages: args.messages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
    });
  } catch (error) {
    console.warn('[journal/finalize] Failed to generate suggested tasks:', error);
  }

  const updatedSession = await args.prisma.journalSession.update({
    where: { id: args.sessionId },
    data: {
      status: 'completed',
      summary: summary.summary,
      emotions: summary.emotions,
      themes: summary.themes,
      suggestions: summary.suggestions || [],
      finalizedAt: new Date(),
    },
  });

  void SuggestionMemoryService.append(
    args.prisma,
    args.userId,
    'journal',
    [
      ...(summary.suggestions || []),
      ...suggestedTasks.map((task) => task.title),
    ],
  ).catch(() => {});

  if (summary.summary.trim().length > 0) {
    void args.memoryService?.store({
      userId: args.userId,
      contentType: 'journal',
      contentId: args.sessionId,
      content: `Resumo do diário: ${summary.summary}. Temas: ${(summary.themes || []).join(', ') || 'sem tema destacado'}. Emoções: ${(summary.emotions || []).join(', ') || 'sem emoção destacada'}.`,
      metadata: {
        sessionId: args.sessionId,
        themes: summary.themes || [],
        emotions: summary.emotions || [],
      },
    }).catch(() => {});

    // Fire-and-forget: extrai e acumula memória de longo prazo no perfil do usuário
    void extractAndSaveLongTermMemory(args.prisma, args.userId, args.messages, summary).catch(() => {});
  }

  return {
    updatedSession,
    summary,
    suggestedTasks,
  };
}

async function persistAuraJournalSummary(args: {
  prisma: PrismaClient;
  aiService: Pick<typeof AIService, 'summarizeJournalSession'>;
  memoryService?: Pick<MemoryService, 'store'>;
  userId: string;
  history: Array<{ role: string; content: string }>;
  latestUserMessage: string;
  assistantMessage: string;
}) {
  const localDate = startOfUtcDay(new Date());
  const transcript = [
    ...args.history
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
    { role: 'user', content: args.latestUserMessage },
    { role: 'assistant', content: args.assistantMessage },
  ].filter((message) => message.content.trim().length > 0);

  const session = await args.prisma.journalSession.create({
    data: {
      userId: args.userId,
      localDate,
      status: 'active',
    },
  });

  for (const [index, message] of transcript.entries()) {
    await args.prisma.journalMessage.create({
      data: {
        sessionId: session.id,
        userId: args.userId,
        role: message.role,
        content: message.content,
        orderIndex: index,
      },
    });
  }

  const summary = await args.aiService.summarizeJournalSession(transcript);
  const finalized = await args.prisma.journalSession.update({
    where: { id: session.id },
    data: {
      status: 'completed',
      summary: summary.summary,
      emotions: summary.emotions,
      themes: summary.themes,
      suggestions: summary.suggestions || [],
      finalizedAt: new Date(),
    },
  });

  if (summary.summary.trim().length > 0) {
    void args.memoryService?.store({
      userId: args.userId,
      contentType: 'journal',
      contentId: finalized.id,
      content: `Resumo do diário: ${summary.summary}. Temas: ${(summary.themes || []).join(', ') || 'sem tema destacado'}. Emoções: ${(summary.emotions || []).join(', ') || 'sem emoção destacada'}.`,
      metadata: {
        sessionId: finalized.id,
        themes: summary.themes || [],
        emotions: summary.emotions || [],
      },
    }).catch(() => {});
  }

  void SuggestionMemoryService.append(
    args.prisma,
    args.userId,
    'journal',
    summary.suggestions || [],
  ).catch(() => {});

  return {
    sessionId: finalized.id,
    summary: summary.summary,
    emotions: summary.emotions,
    themes: summary.themes,
    suggestions: summary.suggestions || [],
  };
}

function getSuggestPromptDomain(type: string): AuraPromptDomain {
  if (type === 'checkin-response') {
    return 'checkin';
  }

  if (type === 'home-messages') {
    return 'home';
  }

  if (type === 'journal-tasks') {
    return 'journal-finalize';
  }

  if (type === 'task-split') {
    return 'goal-execution';
  }

  if (type === 'goal-subtasks' || type === 'goal-route' || type === 'goal-capture-dialogue' || type === 'gtd-clarify' || type === 'ai-goals') {
    return 'goal-execution';
  }

  if (type === 'weekly-insight' || type === 'stability-analysis' || type === 'phase-transition' || type === 'follow-up') {
    return 'longitudinal-insight';
  }

  return 'planning';
}

/** Retorna a intenção de busca vetorial específica para cada superfície de IA. */
function getRagIntent(type: string, context: any): string {
  switch (type) {
    case 'home-messages':
      return `padrões de humor e energia no período ${context.partOfDay || context.periodo || ''} para ${context.moodLabel || 'estado atual'}`;
    case 'checkin-response':
      return `experiências anteriores e padrões similares ao estado ${context.moodLabel || 'atual'}`;
    case 'day-tasks':
      return `metas ativas, hábitos e rotina real da pessoa`;
    case 'agenda-blocks':
      return `preferências de rotina, horários e padrões de produtividade`;
    case 'ai-goals':
      return `objetivos de vida, valores, interesses pessoais e contexto atual`;
    case 'weekly-insight':
      return `padrões de humor, energia e comportamento ao longo das semanas`;
    case 'stability-analysis':
      return `episódios de instabilidade emocional, gatilhos e períodos críticos`;
    case 'phase-transition':
      return `como a pessoa reagiu à fase ${context.toPhase || ''} em momentos anteriores`;
    case 'follow-up':
      return `comprometimento, resistência e padrões de adesão a sugestões`;
    case 'goal-subtasks':
      return `micro-ações anteriores e como a pessoa prefere executar tarefas`;
    case 'goal-capture-dialogue':
      return `metas existentes, decisões pendentes e formas anteriores de transformar ideias em próximas ações`;
    case 'journal-tasks':
      return `temas emocionais recorrentes e o que a pessoa valoriza no diário`;
    case 'task-content':
      return `como transformar o compromisso ${context.title || 'atual'} em apoio leve e executável`;
    case 'task-split':
      return `micro-passos práticos para ${context.title || 'o compromisso atual'} na área ${context.category || 'pessoal'}`;
    default:
      return context.moodCycleContext || context.moodLabel || 'estado emocional e rotina do momento';
  }
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const prisma = dependencies.prisma ?? defaultPrisma;
  const aiService = dependencies.aiService ?? AIService;
  const journalService = dependencies.journalService ?? JournalService;
  const auraCommandService = dependencies.auraCommandService ?? AuraCommandService;
  const journalSuggestedTasksGenerator = dependencies.generateJournalSuggestedTasks ?? generateJournalSuggestedTasks;
  const memoryService = dependencies.memoryService ?? new MemoryService(prisma);
  const canonicalMemoryService = new CanonicalMemoryService(prisma, {
    retrieve: (userId, query, limit) => memoryService.retrieve(userId, query, limit) as any,
    store: (input) => memoryService.store(input),
  });
  const auraMemoryIngestionService = dependencies.auraMemoryIngestionService ?? new AuraMemoryIngestionService({
    canonical: canonicalMemoryService,
    vector: memoryService,
    extractor: conservativeAuraExtractor,
  });
  const agendaPatternRecognitionService = new AgendaPatternRecognitionService(prisma, canonicalMemoryService);
  const contextGroundingService = new ContextGroundingService(prisma);
  const routineBuilderService = dependencies.routineBuilderService ?? new RoutineBuilderService(prisma);

  const matchesAllowedHost = (origin: string, allowed: string) => {
    try {
      const { hostname, host } = new URL(origin);
      return hostname === allowed || hostname.endsWith(`.${allowed}`) || host === allowed;
    } catch {
      return false;
    }
  };

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin or server-to-server

      const isDefault = defaultAllowed.some((host) => matchesAllowedHost(origin, host));
      const isExplicit = allowedOriginsEnv.some((allowed) => origin === allowed || matchesAllowedHost(origin, allowed));

      if (isDefault || isExplicit) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin ${origin}`));
      }
    },
    credentials: true,
  }));
  app.set('trust proxy', true);

  // Stripe webhook — PRECISA do corpo cru (raw) e fica fora do express.json()
  // e do requireAuth. Registrado aqui de propósito, antes de tudo.
  app.post('/api/billing/webhook', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) return res.status(400).json({ error: 'no_signature' });
    try {
      const { StripeService } = await import('./services/stripe.service');
      await StripeService.handleWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.use(express.json());

  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Healthcheck público para monitoramento externo do domínio.
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/push/vapid-public-key — rota pública (antes do requireAuth)
  app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
    return res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // POST /api/admin/push-install-reminder — envia lembrete de instalação a todos os subscribers
  app.post('/api/admin/push-install-reminder', async (req: Request, res: Response) => {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const subs = await prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'] });
      const userIds = subs.map(s => s.userId);
      let sent = 0;
      await Promise.allSettled(
        userIds.map(async userId => {
          await sendPushToUser(userId, {
            title: 'Deixe a Airia sempre à mão',
            body: 'Instale o app na sua tela inicial para acesso rápido — leva segundos.',
            url: '/',
            tag: 'install-reminder',
          });
          sent++;
        })
      );
      return res.json({ ok: true, sent, total: userIds.length });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/push-onboarding-reminder — rota admin (x-admin-key), antes do requireAuth
  app.post('/api/admin/push-onboarding-reminder', async (req: Request, res: Response) => {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const profiles = await prisma.profile.findMany({
        where: { onboardingDone: false, createdAt: { lte: twoDaysAgo } },
        select: { id: true },
      });
      const userIds = profiles.map(p => p.id);
      let sent = 0;
      await Promise.allSettled(
        userIds.map(async userId => {
          await sendPushToUser(userId, {
            title: 'Oi! Me conta mais sobre você',
            body: 'Leva só 3 minutos para ativar sua Airia do jeito certo.',
            url: '/onboarding',
            tag: 'onboarding-reminder',
          });
          sent++;
        })
      );
      return res.json({ ok: true, sent, total: userIds.length });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/hotmart/sales — vendas do livro na Hotmart (x-admin-key, antes do requireAuth)
  // Query opcional: product_id, max_results, start_date/end_date (epoch ms)
  app.get('/api/admin/hotmart/sales', async (req: Request, res: Response) => {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const productId = req.query.product_id ? Number(req.query.product_id) : undefined;
      const maxResults = req.query.max_results ? Number(req.query.max_results) : undefined;
      const startDate = req.query.start_date ? Number(req.query.start_date) : undefined;
      const endDate = req.query.end_date ? Number(req.query.end_date) : undefined;
      const result = await getHotmartSalesHistory({ productId, maxResults, startDate, endDate });
      const approved = result.sales.filter((s) => s.status === 'APPROVED');
      const revenue = approved.reduce((sum, s) => sum + s.price, 0);
      return res.json({
        ok: true,
        totalResults: result.totalResults,
        approvedCount: approved.length,
        approvedRevenue: Number(revenue.toFixed(2)),
        sales: result.sales,
      });
    } catch (e: any) {
      return res.status(502).json({ error: e.message });
    }
  });

  // POST /api/hotmart/webhook — recebe eventos da Hotmart (rota pública, validada por Hottok)
  // Ao aprovar a compra do livro, dispara Purchase server-side no Meta CAPI (fecha o funil).
  app.post('/api/hotmart/webhook', async (req: Request, res: Response) => {
    const expected = process.env.HOTMART_WEBHOOK_HOTTOK;
    const received =
      (req.headers['x-hotmart-hottok'] as string | undefined) ??
      (req.body?.hottok as string | undefined);
    if (!expected || received !== expected) {
      return res.status(401).json({ error: 'Invalid hottok' });
    }

    // Sempre responder 200 rápido para a Hotmart não reenfileirar; processa best-effort.
    const event: string = req.body?.event ?? '';
    const data = req.body?.data ?? {};
    res.json({ ok: true });

    try {
      const APPROVED_EVENTS = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];
      if (!APPROVED_EVENTS.includes(event)) return;

      const purchase = data.purchase ?? {};
      const buyer = data.buyer ?? {};
      const price = purchase.price ?? {};
      const transaction: string = purchase.transaction ?? data.transaction ?? '';
      const value = typeof price.value === 'number' ? price.value : Number(price.value) || 0;
      const currency = price.currency_value ?? price.currency_code ?? 'BRL';

      const result = await sendMetaPurchaseEvent({
        email: buyer.email,
        firstName: buyer.first_name ?? buyer.name,
        value,
        currency,
        eventId: transaction || `hotmart_${Date.now()}`,
        eventTime: purchase.approved_date ? Math.floor(purchase.approved_date / 1000) : undefined,
        eventSourceUrl: 'https://airia.pro/livro',
      });
      console.log(`[hotmart/webhook] ${event} tx=${transaction} → CAPI`, JSON.stringify(result));
    } catch (e: any) {
      console.error('[hotmart/webhook] erro ao processar:', e?.message);
    }
  });

  // Todas as rotas abaixo exigem autenticação Supabase
  app.use('/api', dependencies.authMiddleware ?? requireAuth);
  app.use('/api/routine-builder', createRoutineBuilderRouter({ service: routineBuilderService }));

  app.post('/api/onboarding/process', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = OnboardingProcessSchema.parse(req.body);
      const result = await aiService.generateOnboardingProfile(data);

      await prisma.$transaction([
        prisma.profile.upsert({
          where: { id: userId },
          update: {
            fullName: data.fullName,
            onboardingDone: true,
            cycleStart: data.cycleStart ? new Date(`${data.cycleStart}T00:00:00.000Z`) : null,
            cycleLength: data.cycleLength ?? null,
            lutealLength: data.lutealLength ?? null,
          } as any,
          create: {
            id: userId,
            fullName: data.fullName,
            onboardingDone: true,
            cycleStart: data.cycleStart ? new Date(`${data.cycleStart}T00:00:00.000Z`) : null,
            cycleLength: data.cycleLength ?? null,
            lutealLength: data.lutealLength ?? null,
          } as any,
        }),
        prisma.onboardingResponse.upsert({
          where: { userId },
          update: {
            supportGoals: data.supportGoals,
            age: data.age,
            currentFeeling: data.currentFeeling,
            sleepQualityNote: data.sleepQualityNote,
            routineText: data.routineText,
            routineSummary: result.routineSummaryNormalized,
            mainEnergyPressure: data.mainEnergyPressure,
            primaryGoal: data.primaryGoal,
            aiProfileSummary: result.profileSummary,
            aiRoutineSummary: result.routineSummaryNormalized,
            aiInitialStateSummary: result.initialStateSummary,
            aiTopThemes: result.topThemes,
            aiInitialSuggestions: result.initialSuggestions,
            aiProfilePayload: {
              ...result,
              input: data,
            },
            priorDiagnoses: data.priorDiagnoses ?? [],
            medicationCurrentlyUsing: data.medicationCurrentlyUsing ?? null,
            medicationNotes: data.medicationNotes ?? null,
          },
          create: {
            userId,
            supportGoals: data.supportGoals,
            age: data.age,
            currentFeeling: data.currentFeeling,
            sleepQualityNote: data.sleepQualityNote,
            routineText: data.routineText,
            routineSummary: result.routineSummaryNormalized,
            mainEnergyPressure: data.mainEnergyPressure,
            primaryGoal: data.primaryGoal,
            aiProfileSummary: result.profileSummary,
            aiRoutineSummary: result.routineSummaryNormalized,
            aiInitialStateSummary: result.initialStateSummary,
            aiTopThemes: result.topThemes,
            aiInitialSuggestions: result.initialSuggestions,
            aiProfilePayload: {
              ...result,
              input: data,
            },
            priorDiagnoses: data.priorDiagnoses ?? [],
            medicationCurrentlyUsing: data.medicationCurrentlyUsing ?? null,
            medicationNotes: data.medicationNotes ?? null,
          },
        }),
        prisma.userPreference.upsert({
          where: { userId },
          update: {
            wakeTime: data.wakeTime,
            sleepTime: data.sleepTime,
            morningCheckinTime: DEFAULT_MORNING_CHECKIN_TIME,
            eveningReviewTime: DEFAULT_EVENING_REVIEW_TIME,
            notificationsOn: true,
            notificationPreferences: defaultNotificationPreferences,
          },
          create: {
            userId,
            ...defaultUserPreferences,
            wakeTime: data.wakeTime,
            sleepTime: data.sleepTime,
          },
        }),
      ]);

      return res.json({ ...result, saved: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }

      console.error('[onboarding/process] Error:', error);
      return res.status(500).json({ error: 'Failed to process onboarding profile' });
    }
  });

  /**
   * POST /api/events
   * Registra um evento de produto do próprio usuário.
   */
  app.post('/api/events', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;

    try {
      const data = EventLogCreateSchema.parse(req.body);
      const event = await prisma.eventLog.create({
        data: {
          userId,
          eventName: data.eventName,
          properties: data.properties ?? {},
          path: data.path ?? null,
          userAgent: req.get('user-agent') ?? null,
        },
      });

      return res.status(201).json(event);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }

      console.error('[events/create] Error:', error);
      return res.status(500).json({ error: 'Failed to create event log' });
    }
  });

  /**
   * GET /api/events
   * Debug das próprias trilhas de eventos com limite controlado.
   */
  app.get('/api/events', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;

    try {
      const limitParam = Number(req.query.limit ?? 100);
      const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(Math.trunc(limitParam), 1), 200)
        : 100;

      const events = await prisma.eventLog.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
      });

      return res.json({ events, limit });
    } catch (error) {
      console.error('[events/list] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch event logs' });
    }
  });

  /**
   * GET /api/checkins
   * Retorna os check-ins recentes de um usuário (padrão: últimos 7 dias).
   */
  app.get('/api/checkins', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { days } = req.query;

    try {
      const daysNum = Math.min(Math.max(Number(days ?? 7), 1), 90);
      // Usa corte em UTC para evitar exclusão acidental de check-ins do dia
      // por deslocamento de fuso ao comparar com coluna DATE.
      const now = new Date();
      const fromDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysNum,
        0, 0, 0, 0,
      ));

      const checkins = await prisma.dailyCheckin.findMany({
        where: {
          userId,
          localDate: { gte: fromDate },
        },
        orderBy: [
          { localDate: 'desc' },
          { recordedAt: 'desc' },
        ],
      });
      // emotions já é coluna própria; fallback para ai_state para checkins antigos
      const payload = checkins.map((item) => {
        const emotions = item.emotions.length > 0
          ? item.emotions
          : (() => {
              const aiState = (item.aiState as Record<string, unknown> | null) ?? null;
              return Array.isArray(aiState?.emotions)
                ? (aiState.emotions as unknown[]).map((e) => String(e))
                : [];
            })();
        return { ...item, emotions };
      });

      return res.json(payload);
    } catch (error: any) {
      console.error('[checkins/list] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch check-ins' });
    }
  });

  /**
   * POST /api/checkins
   * Salva o check-in diário e dispara a IA para avaliação de estado.
   */
  app.post('/api/checkins', async (req: Request, res: Response) => {
  try {
    const data = CheckinCreateSchema.parse({ ...req.body, userId: (req as AuthRequest).userId });
    const date = parseLocalDateInput(data.localDate);
    const recordedAt = new Date();
    const checkinSlot = data.checkinSlot ?? deriveCheckinSlot(recordedAt);

    // 1. Salvar Check-in Inicial
    // Mapear campos de ciclo menstrual para colunas do schema
    const menstrualPhase = data.isFlowing
      ? (data.flowIntensity ?? 'menstruada')
      : (data.isFlowing === false ? null : undefined);
    const cycleDay = data.isFlowing ? (data.flowDay ?? null) : null;
    const physicalSymptoms: string[] = [];
    if (data.isFlowing && data.symptomLevels) {
      if (data.symptomLevels.colica) physicalSymptoms.push(`colica:${data.symptomLevels.colica}`);
      if (data.symptomLevels.dorCabeca) physicalSymptoms.push(`dorCabeca:${data.symptomLevels.dorCabeca}`);
    }

    const checkin = await prisma.dailyCheckin.upsert({
      where: {
        userId_localDate_checkinSlot: {
          userId: data.userId,
          localDate: date,
          checkinSlot,
        }
      },
      update: {
        recordedAt,
        moodScore: data.moodScore,
        energyScore: data.energyScore,
        clarityScore: data.clarityScore,
        irritabilityScore: data.irritabilityScore,
        physicalScore: data.physicalScore || 3,
        socialScore: data.socialScore || 3,
        sleepScore: data.sleepScore,
        note: data.note,
        factors: data.factors ?? [],
        emotions: data.emotions ?? [],
        ...(menstrualPhase !== undefined && { menstrualPhase }),
        ...(cycleDay !== undefined && { cycleDay }),
        ...(physicalSymptoms.length > 0 && { physicalSymptoms }),
        isFlowing: data.isFlowing,
        flowDay: data.flowDay,
        flowIntensity: data.flowIntensity,
        symptomColica: data.symptomLevels?.colica,
        symptomDorCabeca: data.symptomLevels?.dorCabeca,
        medicationTakenToday: data.medicationTakenToday ?? null,
        focusScore: data.focusScore ?? null,
        hyperfocusOccurred: data.hyperfocusOccurred ?? null,
        mixedEpisodeNote: data.mixedEpisodeNote ?? null,
        dayType: data.dayType ?? null,
      },
      create: {
        userId: data.userId,
        localDate: date,
        recordedAt,
        checkinSlot,
        moodScore: data.moodScore,
        energyScore: data.energyScore,
        clarityScore: data.clarityScore,
        irritabilityScore: data.irritabilityScore,
        physicalScore: data.physicalScore || 3,
        socialScore: data.socialScore || 3,
        sleepScore: data.sleepScore,
        note: data.note,
        factors: data.factors ?? [],
        emotions: data.emotions ?? [],
        menstrualPhase: menstrualPhase ?? null,
        cycleDay: cycleDay ?? null,
        physicalSymptoms,
        isFlowing: data.isFlowing,
        flowDay: data.flowDay,
        flowIntensity: data.flowIntensity,
        symptomColica: data.symptomLevels?.colica,
        symptomDorCabeca: data.symptomLevels?.dorCabeca,
        medicationTakenToday: data.medicationTakenToday ?? null,
        focusScore: data.focusScore ?? null,
        hyperfocusOccurred: data.hyperfocusOccurred ?? null,
        mixedEpisodeNote: data.mixedEpisodeNote ?? null,
        dayType: data.dayType ?? null,
      },
    });

    // 2. Chamar IA para Avaliar Estado (com contexto completo do dia)
    const checkinRagQuery = [
      data.note,
      data.emotions?.join(' '),
      data.factors?.join(' '),
      `humor ${data.moodScore} energia ${data.energyScore}`,
    ].filter(Boolean).join(' ');
    const riskSafety = assessRiskSafety({
      text: [data.note, data.emotions?.join(' '), data.factors?.join(' ')].filter(Boolean).join(' '),
      moodScore: data.moodScore,
      energyScore: data.energyScore,
      sleepScore: data.sleepScore,
      irritabilityScore: data.irritabilityScore,
    });
    const [checkinRuntimeContext, checkinPlannerContext, checkinCompletionContext, recentSuggestionItems, checkinMemories] = await Promise.all([
      resolveAiRuntimeContext(prisma, data.userId, {}),
      buildTodayPlannerContext(prisma, data.userId),
      buildTodayCompletionContext(prisma, data.userId),
      SuggestionMemoryService.getRecent(prisma, data.userId),
      memoryService.retrieve(data.userId, checkinRagQuery || 'check-in de hoje e padrões anteriores', 3).catch(() => []),
    ]);
    const recentSuggestionMemory = SuggestionMemoryService.formatForPrompt(recentSuggestionItems);
    const checkinRagContext = memoryService.formatForPrompt(checkinMemories);
    const checkinGroundingContext = await contextGroundingService.buildForSuggest({
      userId: data.userId,
      type: 'checkin',
      context: {
        localDate: data.localDate,
        adhdProfile: Array.isArray(checkinRuntimeContext.priorDiagnoses) && checkinRuntimeContext.priorDiagnoses.includes('adhd'),
        hyperfocusOccurred: (data as any).hyperfocusOccurred === true,
      },
      recentSuggestionItems,
      ragContext: checkinRagContext,
    });
    const checkinGroundingText = typeof checkinGroundingContext.groundingContext === 'string'
      ? checkinGroundingContext.groundingContext
      : '';
    const checkinReasoning = ReasoningContextService.buildForPrompt({
      dailyContext: checkinGroundingContext.grounding as any,
      surface: 'checkin',
      requestContext: {
        ...extractAdaptiveFromRequest(req.body),
        localDate: data.localDate,
        moodScore: data.moodScore,
        energyScore: data.energyScore,
        sleepScore: data.sleepScore,
        currentHour: (req.body as any)?.currentHour,
        currentMinute: (req.body as any)?.currentMinute,
      },
      currentMessage: data.note ?? null,
      ragContext: checkinRagContext,
      decisionBrain: (checkinGroundingContext as any).decisionBrain ?? null,
    });
    const checkinActionPlan = AiriaOperationalReasoningService.build({
      dailyContext: checkinGroundingContext.grounding as any,
      surface: 'checkin',
      requestContext: {
        ...extractAdaptiveFromRequest(req.body),
        localDate: data.localDate,
        moodScore: data.moodScore,
        energyScore: data.energyScore,
        sleepScore: data.sleepScore,
        currentHour: (req.body as any)?.currentHour,
        currentMinute: (req.body as any)?.currentMinute,
      },
      currentMessage: data.note ?? null,
      ragContext: checkinRagContext,
      decisionBrain: (checkinGroundingContext as any).decisionBrain ?? null,
      trace: checkinReasoning.trace,
    });
    const checkinCognitive = await AiriaCognitiveInterpreterService.interpret({
      surface: 'checkin',
      dailyContext: checkinGroundingContext.grounding as any,
      requestContext: {
        ...extractAdaptiveFromRequest(req.body),
        localDate: data.localDate,
        moodScore: data.moodScore,
        energyScore: data.energyScore,
        sleepScore: data.sleepScore,
        currentHour: (req.body as any)?.currentHour,
        currentMinute: (req.body as any)?.currentMinute,
      },
      currentMessage: data.note ?? null,
      ragContext: checkinRagContext,
      moodCycleContext: [checkinRuntimeContext.moodCycleContext, checkinGroundingText].filter(Boolean).join('\n'),
      plannerContext: [checkinPlannerContext, checkinGroundingText].filter(Boolean).join('\n'),
      activeGoalsContext: checkinRuntimeContext.activeGoalsContext,
      recentSuggestionMemory,
      actionPlan: checkinActionPlan,
    });
    const aiState = await CheckinService.evaluateDayState({
      checkinSlot,
      moodScore: data.moodScore,
      energyScore: data.energyScore,
      clarityScore: data.clarityScore,
      irritabilityScore: data.irritabilityScore,
      physicalScore: data.physicalScore,
      socialScore: data.socialScore,
      sleepScore: data.sleepScore,
      note: data.note,
      userName: checkinRuntimeContext.userName,
      profileSummary: checkinRuntimeContext.userProfileSummary,
      moodCycleContext: [checkinRuntimeContext.moodCycleContext, checkinGroundingText].filter(Boolean).join('\n'),
      contextualMemory: checkinRagContext,
      activeGoalsContext: checkinRuntimeContext.activeGoalsContext,
      recentSuggestionMemory,
      reasoningTraceContext: [
        riskSafetyPromptPolicy(riskSafety),
        checkinReasoning.context,
        AiriaOperationalReasoningService.formatForPrompt(checkinActionPlan),
        AiriaCognitiveInterpreterService.formatForPrompt(checkinCognitive),
      ].join('\n\n'),
      airiaActionPlan: checkinActionPlan,
      operationalRecommendation: AiriaOperationalReasoningService.visibleSuggestion(checkinActionPlan),
      completionContext: checkinCompletionContext.text,
      avoidRecommendationTitles: uniqueByKey([
        ...checkinCompletionContext.titles,
        ...((checkinGroundingContext.blockedActionTitles as string[] | undefined) ?? []),
        ...((checkinGroundingContext.completedTaskTitles as string[] | undefined) ?? []),
        ...((checkinGroundingContext.completedHabitTitles as string[] | undefined) ?? []),
        ...((checkinGroundingContext.completedGoalTitles as string[] | undefined) ?? []),
        ...((checkinGroundingContext.completedSubgoalTitles as string[] | undefined) ?? []),
      ]),
      emotions: (data as any).emotions,
      factors: data.factors,
      plannerContext: [checkinPlannerContext, checkinGroundingText].filter(Boolean).join('\n'),
      priorDiagnoses: checkinRuntimeContext.priorDiagnoses,
      ...extractAdaptiveFromRequest(req.body),
    });

    // 3. Atualizar com Resultado da IA
    const updatedCheckin = await prisma.dailyCheckin.update({
      where: { id: checkin.id },
      data: {
        stateLabel: aiState.stateLabel,
        stateLabelType: aiState.stateLabelType,
        stateSummary: aiState.analysis, // Mapeado para o novo campo analysis da IA
        aiState: {
          ...(aiState as any),
          riskSafety,
          emotions: data.emotions ?? [],
          factors: data.factors ?? [],
        } as any,
      }
    });


    // 4. Vetorizar nota do check-in (assíncrono — não bloqueia resposta)
    if (data.note && data.note.trim().length >= 10) {
      memoryService.store({
        userId: data.userId,
        contentType: 'checkin_note',
        contentId: checkin.id,
        content: `${data.localDate}: ${data.note.trim()}`,
        metadata: {
          moodScore: data.moodScore,
          energyScore: data.energyScore,
          date: data.localDate,
          stateLabel: aiState.stateLabel,
          riskLevel: riskSafety.riskLevel,
        },
      }).catch(() => {}); // fire-and-forget
    }

    SuggestionMemoryService.append(prisma, data.userId, 'checkin', aiState.recommendations).catch(() => {});

    // 5. Agendar jobs de background para manter IA atualizada
    AiBackgroundService.scheduleJob(data.userId, 'rag-indexing', '1h').catch(() => {});
    AiBackgroundService.scheduleJob(data.userId, 'profile-update', '6h').catch(() => {});

    // 6. Trigger automático de extração no Knowledge Graph quando há nota textual.
    //    Roda em background — não atrasa response.
    if (data.note && data.note.trim().length >= 12) {
      setImmediate(() => {
        void KnowledgeGraphService.extractFromMessage(data.userId, data.note!.trim(), {
          source: 'checkin',
          canonicalMemoryService,
          locale: typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR',
          sourceId: checkin.id,
          observedAt: checkin.recordedAt ?? new Date(),
        }).catch((err) => console.warn('[checkin/kg] extração falhou:', err));
      });
    }

    return res.json({ ...updatedCheckin, riskSafety });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[checkins/create] Error:', error);
    return res.status(500).json({ error: 'Failed to process check-in' });
  }
  });

  /**
   * GET /api/journal/sessions
   * Lista sessões de diário do usuário, mais recentes primeiro.
   */
  app.get('/api/journal/sessions', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { limit, q, emotion, theme } = req.query;

    try {
      const limitNum = Math.min(Number(limit ?? 30), 100);

      const sessions = await prisma.journalSession.findMany({
        where: {
          userId,
          status: 'completed',
          ...(emotion ? { emotions: { has: String(emotion) } } : {}),
          ...(theme   ? { themes:   { has: String(theme) } }   : {}),
        },
        orderBy: { localDate: 'desc' },
        take: limitNum,
      });

      // Client-side text filter on summary (Prisma doesn't do free-text without pg_trgm)
      const qStr = q ? String(q).toLowerCase() : null;
      const filtered = qStr
        ? sessions.filter(s =>
            (s.summary ?? '').toLowerCase().includes(qStr) ||
            s.themes.some(t => t.toLowerCase().includes(qStr)) ||
            s.emotions.some(e => e.toLowerCase().includes(qStr))
          )
        : sessions;

      return res.json(
        filtered.map((s) => ({
          id: s.id,
          localDate: s.localDate.toISOString().split('T')[0],
          status: s.status,
          summary: s.summary,
          emotions: s.emotions,
          themes: s.themes,
          startedAt: s.startedAt.toISOString(),
          finalizedAt: s.finalizedAt?.toISOString() ?? null,
        }))
      );
    } catch (error: any) {
      console.error('[journal/sessions] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch journal sessions' });
    }
  });

  /**
   * GET /api/journal/session/:sessionId
   * Retorna uma sessão do diário + mensagens (para integrações externas).
   * Query opcional: afterOrderIndex (number) para sync incremental.
   */
  app.get('/api/journal/session/:sessionId', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { sessionId } = req.params;

    const afterOrderIndex = req.query.afterOrderIndex !== undefined
      ? Number(req.query.afterOrderIndex)
      : null;
    if (afterOrderIndex !== null && (Number.isNaN(afterOrderIndex) || afterOrderIndex < -1)) {
      return res.status(400).json({ error: 'afterOrderIndex must be a number >= -1' });
    }

    try {
      const session = await prisma.journalSession.findUnique({
        where: { id: sessionId },
      });
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const messages = await prisma.journalMessage.findMany({
        where: {
          sessionId,
          ...(afterOrderIndex === null ? {} : { orderIndex: { gt: afterOrderIndex } }),
        },
        orderBy: { orderIndex: 'asc' },
      });

      return res.json({
        id: session.id,
        localDate: session.localDate.toISOString().split('T')[0],
        status: session.status,
        summary: session.summary,
        emotions: session.emotions,
        themes: session.themes,
        suggestions: session.suggestions,
        startedAt: session.startedAt.toISOString(),
        finalizedAt: session.finalizedAt?.toISOString() ?? null,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          orderIndex: m.orderIndex,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    } catch (error: any) {
      console.error('[journal/session] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch journal session' });
    }
  });

  /**
   * POST /api/journal/external-message
   * Cria uma mensagem "user" no diário sem SSE (para integrações).
   * Body: { sessionId?, message, referenceDate? }
   */
  app.post('/api/journal/external-message', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;

    let data: { sessionId?: string; message: string; referenceDate?: string };
    try {
      data = JournalExternalMessageSchema.parse({ ...req.body, userId });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
      let sessionId = data.sessionId;

      if (!sessionId) {
        const referenceDate = data.referenceDate ? new Date(`${data.referenceDate}T00:00:00.000Z`) : new Date();
        const { session } = await journalService.startOrResumeSession(prisma, userId, referenceDate);
        sessionId = session.id;
      } else {
        const session = await prisma.journalSession.findUnique({ where: { id: sessionId }, select: { userId: true } });
        if (!session || session.userId !== userId) {
          return res.status(404).json({ error: 'Session not found' });
        }
      }

      const existing = await prisma.journalMessage.findMany({
        where: { sessionId },
        select: { orderIndex: true },
      });
      const orderIndex = journalService.nextOrderIndex(existing);

      const created = await prisma.journalMessage.create({
        data: {
          sessionId,
          userId,
          role: 'user',
          content: data.message,
          orderIndex,
        },
        select: { id: true, orderIndex: true, createdAt: true },
      });

      return res.status(201).json({
        sessionId,
        messageId: created.id,
        orderIndex: created.orderIndex,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (error: any) {
      console.error('[journal/external-message] Error:', error);
      return res.status(500).json({ error: 'Failed to store journal message' });
    }
  });

  /**
   * POST /api/journal/start
   * Cria ou recupera uma sessão ativa e retorna contexto + histórico.
   */
  app.post('/api/journal/start', async (req: Request, res: Response) => {
    try {
      const data = JournalStartSchema.parse({ ...req.body, userId: (req as AuthRequest).userId });
      const { session, created } = await journalService.startOrResumeSession(prisma, data.userId);
      const [messages, context, runtimeContext] = await Promise.all([
       journalService.getSessionMessages(prisma, session.id),
       journalService.buildRoutineContext(prisma, data.userId),
       resolveAiRuntimeContext(prisma, data.userId, { moodCycleContext: data.moodCycleContext }),
      ]);

      // Contexto de abertura: só para sessões novas (created = true)
      let openingContext: string | null = null;
      if (created) {
        try {
          const [recentSessions, topPatterns] = await Promise.all([
            prisma.journalSession.findMany({
              where: { userId: data.userId, status: 'finalized' },
              orderBy: { startedAt: 'desc' },
              take: 1,
              select: { startedAt: true, themes: true },
            }),
            prisma.userPattern.findMany({
              where: { userId: data.userId, strength: { gt: 0.55 } },
              orderBy: { lastConfirmedAt: 'desc' },
              take: 1,
              select: { pattern: true, lastConfirmedAt: true },
            }),
          ]);

          const parts: string[] = [];

          const lastSession = recentSessions[0];
          if (lastSession) {
            const daysAgo = Math.floor((Date.now() - new Date(lastSession.startedAt).getTime()) / 86400000);
            const dayLabel = daysAgo === 0 ? 'hoje cedo' : daysAgo === 1 ? 'ontem' : `há ${daysAgo} dias`;
            const themes = Array.isArray(lastSession.themes) && lastSession.themes.length > 0
              ? ` — você escreveu sobre ${(lastSession.themes as string[]).slice(0, 2).join(' e ')}`
              : '';
            parts.push(`A última sessão foi ${dayLabel}${themes}.`);
          }

          const topPattern = topPatterns[0];
          if (topPattern) {
            const daysSince = Math.floor((Date.now() - new Date(topPattern.lastConfirmedAt).getTime()) / 86400000);
            if (daysSince <= 14) {
              parts.push(`Tenho percebido: ${topPattern.pattern.toLowerCase()}.`);
            }
          }

          if (parts.length > 0) openingContext = parts.join(' ');
        } catch {
          // silencioso — abertura sem contexto é aceitável
        }
      }

      // Se sessão recém-criada e sem mensagens, injeta nota do check-in como primeira mensagem
      if (created && messages.length === 0 && context.checkinToday?.note) {
       await prisma.journalMessage.create({
         data: {
           sessionId: session.id,
           userId: data.userId,
           role: 'user',
           content: context.checkinToday.note,
           orderIndex: 0,
         },
       });
       // Recarregar mensagens para incluir a nota injetada
       const updatedMessages = await journalService.getSessionMessages(prisma, session.id);
       return res.json({
         sessionId: session.id,
         created,
         openingContext,
         messages: updatedMessages.map((message) => ({
           id: message.id,
           role: message.role,
           content: message.content,
           createdAt: message.createdAt?.toISOString?.() ?? new Date().toISOString(),
         })),
         context: {
           ...context,
           runtimeContext,
         }
       });
      }

      return res.json({
        sessionId: session.id,
        created,
        openingContext,
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt?.toISOString?.() ?? new Date().toISOString(),
        })),
        context: {
          ...context,
          moodCycleContext: runtimeContext.moodCycleContext,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }

      console.error('[journal/start] Error:', error);
      return res.status(500).json({ error: 'Failed to start journal session' });
    }
  });

  /**
   * POST /api/journal/message/stream
   * Processa uma mensagem do diário com streaming SSE.
   */
  app.post('/api/journal/message/stream', async (req: Request, res: Response) => {
    try {
      const data = JournalMessageStreamSchema.parse({ ...req.body, userId: (req as AuthRequest).userId });
      const existingMessages = await journalService.getSessionMessages(prisma, data.sessionId);
      const [routineCtx, runtimeContext, journalPlannerContext, recentSuggestionItems] = await Promise.all([
        journalService.buildRoutineContext(prisma, data.userId),
        resolveAiRuntimeContext(prisma, data.userId, { moodCycleContext: data.moodCycleContext }),
        buildTodayPlannerContext(prisma, data.userId),
        SuggestionMemoryService.getRecent(prisma, data.userId),
      ]);
      const recentSuggestionMemory = SuggestionMemoryService.formatForPrompt(recentSuggestionItems);
      const context = { ...routineCtx, moodCycleContext: runtimeContext.moodCycleContext };
      const userOrderIndex = journalService.nextOrderIndex(existingMessages);

      const persistedUserMessage = await prisma.journalMessage.create({
        data: {
          sessionId: data.sessionId,
          userId: data.userId,
          role: 'user',
          content: data.message,
          orderIndex: userOrderIndex,
        },
      });

      // Vetoriza mensagem do usuário (fire-and-forget) — mínimo 20 chars para ter valor semântico
      if (data.message.trim().length >= 20) {
        memoryService.store({
          userId: data.userId,
          contentType: 'journal',
          contentId: `${data.sessionId}-${userOrderIndex}`,
          content: data.message.trim(),
          metadata: {
            sessionId: data.sessionId,
            moodCycleContext: data.moodCycleContext ?? null,
          },
        }).catch(() => {});
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      writeSseEvent(res, 'session.started', {
        sessionId: data.sessionId,
      });

      const journalDailyContext = await contextGroundingService.buildDailyContext({
        userId: data.userId,
        type: 'journal',
        context: {
          localDate: data.localDate,
          currentHour: data.currentHour,
          currentMinute: data.currentMinute,
          phase: data.phase ?? null,
        },
        recentSuggestionItems,
        ragContext: '',
      });
      const journalSituation = JournalUnderstandingService.buildSituation({
        message: data.message,
        localDate: data.localDate,
        recentSessionHistory: routineCtx.recentSessionHistory,
        latestCheckinNote: runtimeContext.latestCheckinSignals?.note ?? null,
        activeGoalTitles: journalDailyContext.activeGoalTitles,
        completedGoalTitles: journalDailyContext.completedGoalTitles,
      });

      // Shared Brain: entende a situação antes de buscar e filtrar memórias
      const journalMemory = await retrieveJournalMemoryContext({
        memoryService,
        userId: data.userId,
        message: data.message,
        situation: journalSituation,
        dailyContext: journalDailyContext,
        routineContext: routineCtx,
        runtimeContext,
      });
      const journalRagContext = journalMemory.ragContext;
      const journalGroundingContext = await contextGroundingService.buildForSuggest({
        userId: data.userId,
        type: 'journal',
        context: {
          localDate: data.localDate,
        },
        recentSuggestionItems,
        ragContext: journalRagContext,
      });
      const journalGroundingText = typeof journalGroundingContext.groundingContext === 'string'
        ? journalGroundingContext.groundingContext
        : '';
      const journalReasoning = ReasoningContextService.buildForPrompt({
        dailyContext: journalDailyContext,
        surface: 'journal',
        requestContext: {
          localDate: data.localDate,
          currentHour: data.currentHour,
          currentMinute: data.currentMinute,
          phase: data.phase ?? null,
          warningFlags: data.warningFlags ?? [],
        },
        currentMessage: data.message,
        situationSummary: JournalUnderstandingService.formatSituationForPrompt(
          journalSituation,
          journalMemory.rejectedMemoryReasons,
        ),
        ragContext: journalRagContext,
      });
      const journalActionPlan = AiriaOperationalReasoningService.build({
        dailyContext: journalDailyContext,
        surface: 'journal',
        requestContext: {
          localDate: data.localDate,
          currentHour: data.currentHour,
          currentMinute: data.currentMinute,
          phase: data.phase ?? null,
          warningFlags: data.warningFlags ?? [],
        },
        currentMessage: data.message,
        situationSummary: JournalUnderstandingService.formatSituationForPrompt(
          journalSituation,
          journalMemory.rejectedMemoryReasons,
        ),
        ragContext: journalRagContext,
        trace: journalReasoning.trace,
      });
      const journalCognitive = await AiriaCognitiveInterpreterService.interpret({
        surface: 'journal',
        dailyContext: journalDailyContext,
        requestContext: {
          localDate: data.localDate,
          currentHour: data.currentHour,
          currentMinute: data.currentMinute,
          phase: data.phase ?? null,
          warningFlags: data.warningFlags ?? [],
        },
        currentMessage: data.message,
        history: existingMessages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
        ragContext: journalRagContext,
        moodCycleContext: runtimeContext.moodCycleContext,
        plannerContext: journalPlannerContext,
        activeGoalsContext: runtimeContext.activeGoalsContext,
        recentSuggestionMemory,
        actionPlan: journalActionPlan,
      });
      const journalRiskSafety = assessRiskSafety({
        text: data.message,
      });

      // Fix #4 — Knowledge Graph: busca contexto estruturado da usuária pra injetar
      // no prompt. Falha silenciosa pra não quebrar resposta se serviço indisponível.
      let knowledgeGraphContext: string | null = null;
      try {
        const kgCtx = await KnowledgeGraphService.getRelevantContextForMessage(
          data.userId,
          data.message,
        );
        const formatted = KnowledgeGraphService.formatContextForPrompt(kgCtx);
        if (formatted) knowledgeGraphContext = formatted;
      } catch (kgError) {
        console.warn('[journal/kg] consulta falhou, continuando sem KG:', kgError);
      }

      const assistantContent = await aiService.streamJournalReply({
        context: {
          ...context,
          userName: runtimeContext.userName,
          userProfileSummary: runtimeContext.userProfileSummary,
          longTermMemory: runtimeContext.longTermMemory,
          activeGoalsContext: runtimeContext.activeGoalsContext,
          recentSessionHistory: routineCtx.recentSessionHistory,
          recentSuggestionMemory,
          reasoningTraceContext: [
            riskSafetyPromptPolicy(journalRiskSafety),
            journalReasoning.context,
            AiriaOperationalReasoningService.formatForPrompt(journalActionPlan),
            AiriaCognitiveInterpreterService.formatForPrompt(journalCognitive),
          ].join('\n\n'),
          ragContext: journalRagContext,
          journalContext: buildJournalReflectiveContext({
            currentMessage: data.message,
            situationText: JournalUnderstandingService.formatSituationForPrompt(
              journalSituation,
              journalMemory.rejectedMemoryReasons,
            ),
            ragContext: journalRagContext,
            memoryUsedFallback: journalMemory.usedFallback,
            routineContext: routineCtx,
            runtimeContext,
            plannerContext: journalPlannerContext,
            groundingText: journalGroundingText,
          }),
          // Fix G (12/05): plannerContext era '' — Aura no diário nunca via tarefas/hábitos
          // do dia atual. Agora passa o contexto operacional já calculado em journalPlannerContext.
          plannerContext: journalPlannerContext,
          currentHour: data.currentHour,
          currentMinute: data.currentMinute,
          phase: data.phase ?? null,
          warningFlags: data.warningFlags ?? [],
          forecast7dSummary: data.forecast7dSummary ?? null,
          taskMomentum7d: data.taskMomentum7d ?? null,
          priorDiagnoses: runtimeContext.priorDiagnoses,
          knowledgeGraphContext,
        },
        history: existingMessages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content
            .replace(/\(\d([-\s]| a )\d\)/g, '') // Remove (0-5), (0 a 5), (0 5)
            .replace(/nota \d\/\d/gi, '')
            .replace(/\d\/\d/g, '') // Remove X/5
            .replace(/\*\*/g, ''), // Tira negritos excessivos do historico também
        })),
        message: data.message,
        closingMode: false,
        onDelta: (chunk) => {
          writeSseEvent(res, 'assistant.delta', { chunk });
        },
      });

      const assistantOrderIndex = userOrderIndex + 1;
      const assistantMessage = await prisma.journalMessage.create({
        data: {
          sessionId: data.sessionId,
          userId: data.userId,
          role: 'assistant',
          content: assistantContent,
          orderIndex: assistantOrderIndex,
        },
      });

      writeSseEvent(res, 'assistant.completed', {
        sessionId: data.sessionId,
        message: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt?.toISOString?.() ?? new Date().toISOString(),
        },
        riskSafety: journalRiskSafety,
      });

      // Fix #4 — Extração assíncrona do Knowledge Graph. Roda DEPOIS da resposta
      // ir pra usuária (não bloqueia UX). Falha silenciosa.
      setImmediate(() => {
        void KnowledgeGraphService.extractFromMessage(data.userId, data.message, {
          assistantReply: assistantContent,
          source: 'journal',
          canonicalMemoryService,
          locale: typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR',
          sourceId: persistedUserMessage.id,
          observedAt: persistedUserMessage.createdAt ?? new Date(),
        }).catch((err) => {
          console.warn('[journal/kg] extração assíncrona falhou:', err);
        });
      });

      return res.end();
    } catch (error: any) {
      if (!res.headersSent) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }

        console.error('[journal/message/stream] Error:', error);
        return res.status(500).json({ error: 'Failed to stream journal message' });
      }

      writeSseEvent(res, 'error', {
        error: error instanceof Error ? error.message : 'Failed to stream journal message',
      });

      return res.end();
    }
  });

  /**
   * POST /api/aura/command/start
   * Inicia uma sessão operacional da Airia central.
   */
  app.post('/api/aura/command/start', async (req: Request, res: Response) => {
    try {
      AuraCommandStartSchema.parse({ ...req.body, userId: (req as AuthRequest).userId });

      return res.json({
        sessionId: randomUUID(),
        sessionStatus: 'ready',
        startedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }

      console.error('[aura/command/start] Error:', error);
      return res.status(500).json({ error: 'Failed to start Airia command session' });
    }
  });

  /**
   * POST /api/aura/command/stream
   * Processa um comando operacional da Airia via SSE.
   */
  app.post('/api/aura/command/stream', async (req: Request, res: Response) => {
    try {
      const data = AuraCommandMessageStreamSchema.parse({ ...req.body, userId: (req as AuthRequest).userId });
      const [runtimeContext, recentSuggestionItems] = await Promise.all([
        resolveAiRuntimeContext(prisma, data.userId, { moodCycleContext: data.moodCycleContext }),
        SuggestionMemoryService.getRecent(prisma, data.userId),
      ]);
      const recentSuggestionMemory = SuggestionMemoryService.formatForPrompt(recentSuggestionItems);

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      writeSseEvent(res, 'session.started', {
        sessionId: data.sessionId,
      });

      // Shared Brain: busca memórias relevantes antes de interpretar o comando
      const commandMemories = await canonicalMemoryService.retrieve({
        userId: data.userId,
        query: data.message,
        limit: 8,
        locale: typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR',
      }).catch(() => null);
      const commandRagContext = commandMemories ? canonicalMemoryService.formatForPrompt(commandMemories, typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR') : '';

      // Planner Brain: injeta agenda completa de hoje (planner interno + Google Calendar)
      const plannerContext = await buildTodayPlannerContext(prisma, data.userId);
      const commandGroundingContext = await contextGroundingService.buildForSuggest({
        userId: data.userId,
        type: 'aura-command',
        context: {
          localDate: typeof (req.body as any)?.localDate === 'string' ? (req.body as any).localDate : undefined,
        },
        recentSuggestionItems,
        ragContext: commandRagContext,
      });
      const commandGroundingText = typeof commandGroundingContext.groundingContext === 'string'
        ? commandGroundingContext.groundingContext
        : '';
      const commandReasoning = ReasoningContextService.buildForPrompt({
        dailyContext: commandGroundingContext.grounding as any,
        surface: 'aura-chat',
        requestContext: {
          ...extractAdaptiveFromRequest(req.body),
          localDate: typeof (req.body as any)?.localDate === 'string' ? (req.body as any).localDate : undefined,
        },
        currentMessage: data.message,
        ragContext: commandRagContext,
        decisionBrain: (commandGroundingContext as any).decisionBrain ?? null,
      });
      const commandActionPlan = AiriaOperationalReasoningService.build({
        dailyContext: commandGroundingContext.grounding as any,
        surface: 'aura-chat',
        requestContext: {
          ...extractAdaptiveFromRequest(req.body),
          localDate: typeof (req.body as any)?.localDate === 'string' ? (req.body as any).localDate : undefined,
        },
        currentMessage: data.message,
        ragContext: commandRagContext,
        decisionBrain: (commandGroundingContext as any).decisionBrain ?? null,
        trace: commandReasoning.trace,
      });
      const commandCognitive = await AiriaCognitiveInterpreterService.interpret({
        surface: 'aura-chat',
        dailyContext: commandGroundingContext.grounding as any,
        requestContext: {
          ...extractAdaptiveFromRequest(req.body),
          localDate: typeof (req.body as any)?.localDate === 'string' ? (req.body as any).localDate : undefined,
        },
        currentMessage: data.message,
        history: data.history,
        ragContext: commandRagContext,
        moodCycleContext: [runtimeContext.moodCycleContext, commandGroundingText].filter(Boolean).join('\n'),
        plannerContext: [plannerContext, commandGroundingText].filter(Boolean).join('\n'),
        activeGoalsContext: runtimeContext.activeGoalsContext,
        recentSuggestionMemory,
        actionPlan: commandActionPlan,
      });
      const commandRiskSafety = assessRiskSafety({
        text: data.message,
      });

      const rawCommandResponse = await auraCommandService.interpretCommand({
        message: data.message,
        history: data.history,
        userName: runtimeContext.userName,
        profileSummary: runtimeContext.userProfileSummary,
        moodCycleContext: [runtimeContext.moodCycleContext, commandGroundingText].filter(Boolean).join('\n'),
        recentSuggestionMemory,
        reasoningTraceContext: [
          riskSafetyPromptPolicy(commandRiskSafety),
          commandReasoning.context,
          AiriaOperationalReasoningService.formatForPrompt(commandActionPlan),
          AiriaCognitiveInterpreterService.formatForPrompt(commandCognitive),
        ].join('\n\n'),
        activeGoalsContext: runtimeContext.activeGoalsContext,
        ragContext: commandRagContext,
        plannerContext: [plannerContext, commandGroundingText].filter(Boolean).join('\n'),
        interactionMode: data.mode,
        localDate: typeof (req.body as any)?.localDate === 'string' ? (req.body as any).localDate : undefined,
        priorDiagnoses: runtimeContext.priorDiagnoses,
        ...extractAdaptiveFromRequest(req.body),
      });
      const rawTaskId = typeof rawCommandResponse.payload?.taskId === 'string'
        ? rawCommandResponse.payload.taskId.trim()
        : '';
      const resolvedCommandTask = rawTaskId && (rawCommandResponse.action === 'update_task' || rawCommandResponse.action === 'delete_task')
        ? await prisma.timelineBlock.findFirst({ where: { id: rawTaskId, userId: data.userId } })
        : null;
      const commandResponse = enforceAuraCaptureGate(
        rawCommandResponse,
        commandCognitive,
        typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR',
        {
          resolvedTaskTitle: resolvedCommandTask?.title ?? null,
          localDate: typeof (req.body as any)?.localDate === 'string' ? (req.body as any).localDate : undefined,
          currentHour: Number.isInteger((req.body as any)?.currentHour) ? (req.body as any).currentHour : undefined,
          currentMinute: Number.isInteger((req.body as any)?.currentMinute) ? (req.body as any).currentMinute : undefined,
        },
      );

      const responsePayload = { ...commandResponse.payload };

      // Executar update de tarefa existente
      if (commandResponse.action === 'update_task') {
        try {
          const { taskId, newDate, newStartTime } = commandResponse.payload as Record<string, string>;
          if (taskId && newDate && newStartTime) {
            const block = resolvedCommandTask?.id === taskId ? resolvedCommandTask : null;
            if (block) {
              const durationMs = block.endAt.getTime() - block.startAt.getTime();
              const newStartAt = new Date(`${newDate}T${newStartTime}:00.000Z`);
              const newEndAt = new Date(newStartAt.getTime() + durationMs);
              const newEndTime = fmtUtcTime(newEndAt);

              await prisma.timelineBlock.update({
                where: { id: taskId },
                data: {
                  localDate: new Date(`${newDate}T00:00:00.000Z`),
                  startAt: newStartAt,
                  endAt: newEndAt,
                },
              });

              if (block.gcalEventId) {
                await GCalService.updatePrimaryEvent(prisma, data.userId, block.gcalEventId, {
                  date: newDate,
                  title: block.title,
                  startTime: newStartTime,
                  endTime: newEndTime,
                }).catch(() => null);
              }

              Object.assign(responsePayload, {
                updatedTaskId: taskId,
                updatedBlock: { id: taskId, title: block.title, newDate, newStartTime, newEndTime },
              });
            }
          }
        } catch (updateErr) {
          console.error('[aura/command] update_task error:', updateErr);
        }
      }

      // Executar delete de tarefa existente
      if (commandResponse.action === 'delete_task') {
        try {
          const { taskId } = commandResponse.payload as Record<string, string>;
          if (taskId) {
            const block = resolvedCommandTask?.id === taskId ? resolvedCommandTask : null;
            if (block) {
              await prisma.timelineBlock.delete({ where: { id: taskId } });
              if (block.gcalEventId) {
                await GCalService.deletePrimaryEvent(prisma, data.userId, block.gcalEventId).catch(() => null);
              }
              Object.assign(responsePayload, { deletedTaskId: taskId, deletedTitle: block.title });
            }
          }
        } catch (deleteErr) {
          console.error('[aura/command] delete_task error:', deleteErr);
        }
      }

      if (commandResponse.action === 'handoff_to_journal') {
        const journalEntry = await persistAuraJournalSummary({
          prisma,
          aiService,
          memoryService,
          userId: data.userId,
          history: data.history,
          latestUserMessage: data.message,
          assistantMessage: commandResponse.assistantMessage,
        });

        Object.assign(responsePayload, {
          journalSessionId: journalEntry.sessionId,
          journalSummary: journalEntry.summary,
          journalEmotions: journalEntry.emotions,
          journalThemes: journalEntry.themes,
          journalSuggestions: journalEntry.suggestions,
        });
      }

      writeSseEvent(res, 'assistant.completed', {
        sessionId: data.sessionId,
        response: {
          ...commandResponse,
          riskSafety: commandRiskSafety,
          payload: responsePayload,
        },
      });

      // Longitudinal memory is best-effort and never delays/changes the answer.
      void auraMemoryIngestionService.ingest({
        userId: data.userId,
        messageId: `${data.sessionId}:${data.history.length}`,
        message: data.message,
        assistantReply: commandResponse.assistantMessage,
        history: data.history,
        locale: typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR',
        allowDecisions: AiriaCognitiveInterpreterService.allowsMemoryDecisionExtraction(commandCognitive),
      }).catch((error) => console.warn('[aura/memory-ingestion]', error));

      return res.end();
    } catch (error: any) {
      if (!res.headersSent) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }

        console.error('[aura/command/stream] Error:', error);
        return res.status(500).json({ error: 'Failed to process Airia command' });
      }

      writeSseEvent(res, 'error', {
        error: error instanceof Error ? error.message : 'Failed to process Airia command',
      });

      return res.end();
    }
  });

  /**
   * POST /api/aura/complete-report
   * Usuária relata o que já fez no dia. A Airia marca como concluído (ou cria já concluído)
   * e devolve uma avaliação de padrão baseada no que ficou pendente + fase de humor.
   */
  app.post('/api/aura/complete-report', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const { items, localDate, moodCycleContext } = req.body as {
        items: Array<{ title: string; type: 'task' | 'habit' }>;
        localDate?: string;
        moodCycleContext?: string | null;
      };

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items obrigatório e não pode ser vazio' });
      }

      const todayKey = typeof localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(localDate)
        ? localDate
        : new Date().toISOString().slice(0, 10);

      const dayStart = new Date(`${todayKey}T00:00:00Z`);
      const dayEnd = new Date(`${todayKey}T23:59:59Z`);

      // Busca blocos pendentes do dia
      const pendingBlocks = await prisma.timelineBlock.findMany({
        where: { userId, localDate: { gte: dayStart, lte: dayEnd }, status: { not: 'completed' } },
        select: { id: true, title: true, category: true },
      });

      function normalize(s: string): string {
        return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
      }

      const matched: string[] = [];
      const created: string[] = [];
      const now = new Date();

      for (const item of items) {
        const normItem = normalize(item.title);
        const found = pendingBlocks.find((b) => normalize(b.title ?? '').includes(normItem) || normItem.includes(normalize(b.title ?? '')));

        if (found) {
          await prisma.timelineBlock.update({ where: { id: found.id }, data: { status: 'completed' } });
          matched.push(item.title);
        } else {
          await prisma.timelineBlock.create({
            data: {
              userId,
              title: item.title,
              category: item.type === 'habit' ? 'autocuidado' : 'pessoal',
              intensity: 'media',
              status: 'completed',
              localDate: dayStart,
              startAt: now,
              endAt: now,
              isAiSuggested: false,
            },
          });
          created.push(item.title);
        }

        await AiActionFeedbackService.append(prisma, userId, {
          title: item.title,
          status: 'done',
          surface: 'aura-command',
          localDate: todayKey,
        });
      }

      // Recarrega pendentes após as atualizações para a avaliação
      const stillPending = await prisma.timelineBlock.findMany({
        where: { userId, localDate: { gte: dayStart, lte: dayEnd }, status: { not: 'completed' } },
        select: { title: true, category: true },
      });

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const evaluationPrompt = [
        'Você é a Airia. A usuária acabou de reportar o que já fez hoje.',
        '',
        `Feito agora: ${[...matched, ...created].map((t) => `"${t}"`).join(', ')}`,
        stillPending.length > 0
          ? `Ainda pendente: ${stillPending.map((b) => `"${b.title}"`).join(', ')}`
          : 'Nada mais pendente hoje.',
        moodCycleContext ? `Estado atual: ${moodCycleContext}` : '',
        '',
        'Devolva uma avaliação de padrão em 2-4 frases seguindo a estrutura: FATO (o que foi feito) → LEITURA (o que isso revela no padrão) → MOVIMENTO (próximo passo concreto se houver).',
        'Sem elogios excessivos. Se houver padrão de evitação (só fez as fáceis, a importante ficou), nomeie com cuidado e firmeza. Se fez tudo, confirme.',
        'Responda apenas o texto da avaliação, sem JSON.',
      ].filter(Boolean).join('\n');

      const evalResponse = await openai.chat.completions.create({
        model: getOpenAiModel(),
        messages: [{ role: 'user', content: evaluationPrompt }],
        max_completion_tokens: getOpenAiMaxCompletionTokens(300),
      } as any);

      const evaluation = evalResponse.choices?.[0]?.message?.content?.trim() ?? '';

      return res.json({ matched, created, evaluation });
    } catch (err: any) {
      console.error('[aura/complete-report] error:', err);
      return res.status(500).json({ error: 'Falha ao registrar conclusões' });
    }
  });

  /**
   * GET /api/insights/weekly
  ...

   */
  app.get('/api/insights/weekly', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { weekStart } = req.query;

  try {
    const today = new Date();
    const day = today.getUTCDay();
    const offsetToMonday = day === 0 ? -6 : 1 - day;
    today.setUTCDate(today.getUTCDate() + offsetToMonday);
    const defaultWeekStart = today.toISOString().slice(0, 10);
    const result = await InsightService.getWeeklyInsights(userId, String(weekStart ?? defaultWeekStart));
    return res.json(result);
  } catch (error: any) {
    console.error('[insights/weekly] Error:', error);
    return res.status(500).json({ error: 'Failed to generate weekly insights' });
  }
  });

  /**
   * POST /api/journal/finalize
  ...

   */
  const JournalFinalizeSchema = z.object({ sessionId: z.string().uuid() });

  app.post('/api/journal/finalize', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;

  let sessionId: string;
  try {
    ({ sessionId } = JournalFinalizeSchema.parse(req.body));
  } catch {
    return res.status(400).json({ error: 'sessionId must be a valid UUID' });
  }

  try {
    // Garantir que a sessão pertence ao usuário autenticado
    const session = await prisma.journalSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const messages = await prisma.journalMessage.findMany({
      where: { sessionId },
      orderBy: { orderIndex: 'asc' },
    });

    if (messages.length === 0) {
      return res.status(404).json({ error: 'No messages found for this session' });
    }

    const [runtimeContext, routineContext] = await Promise.all([
      resolveAiRuntimeContext(prisma, userId, {}),
      journalService.buildRoutineContext(prisma, userId).catch(() => null),
    ]);
    const finalization = await finalizeJournalSession({
      prisma,
      aiService,
      journalSuggestedTasksGenerator,
      memoryService,
      userId,
      sessionId,
      messages,
      userName: runtimeContext.userName,
      profileSummary: runtimeContext.userProfileSummary,
      moodCycleContext: runtimeContext.moodCycleContext,
      longTermMemory: runtimeContext.longTermMemory,
      activeGoalsContext: runtimeContext.activeGoalsContext,
      recentSessionHistory: routineContext?.recentSessionHistory,
      currentHour: typeof req.body.currentHour === 'number' ? req.body.currentHour : undefined,
      currentMinute: typeof req.body.currentMinute === 'number' ? req.body.currentMinute : undefined,
      priorDiagnoses: runtimeContext.priorDiagnoses,
    });

    // Agendar RAG indexing para absorver o que foi escrito no diário
    AiBackgroundService.scheduleJob(userId, 'rag-indexing', '1h').catch(() => {});

    return res.json({
      sessionId: finalization.updatedSession.id,
      summary: {
        text: finalization.summary.summary,
        emotions: finalization.summary.emotions,
        themes: finalization.summary.themes,
        suggestions: finalization.summary.suggestions,
      },
      suggestedTasks: finalization.suggestedTasks,
      sessionStatus: 'completed',
    });
  } catch (error: any) {
    console.error('[journal/finalize] Error:', error);
    return res.status(500).json({
      error: 'Failed to finalize session',
      details: error.message,
    });
  }
  });

  /**
   * POST /api/timeline
   * Sincroniza blocos do planner em lote com detecção preventiva de conflitos.
   */
  app.post('/api/timeline', async (req: Request, res: Response) => {
  try {
    const { userId, date, forceSave, blocks } = PlannerSyncSchema.parse({ ...req.body, userId: (req as AuthRequest).userId });
    const rawBlocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
    const baseDate = parseLocalDateInput(date);

    // Aprimoramento: Validar conflitos ANTES de salvar, a menos que forceSave = true
    const blocksForConflictCheck = blocks.map(b => ({
      title: b.title,
      startAt: PlannerService.parseTimeToDate(baseDate, b.startTime),
      endAt: PlannerService.parseTimeToDate(baseDate, b.endTime)
    }));

    const conflicts = PlannerService.detectConflicts(blocksForConflictCheck);

    if (conflicts.length > 0 && !forceSave) {
      return res.status(409).json({
        error: 'Conflitos de horário detectados. Use forceSave=true para ignorar.',
        conflicts
      });
    }

    if (!forceSave) {
      const incomingIds = new Set(blocks.map((block) => block.id).filter(Boolean));
      const existingBlocks = await prisma.timelineBlock.findMany({
        where: { userId, localDate: baseDate },
        select: { id: true, title: true, startAt: true, endAt: true },
      });

      const existingConflicts = blocksForConflictCheck.flatMap((incoming) => {
        return existingBlocks
          .filter((existing) => !incomingIds.has(existing.id))
          .filter((existing) => {
            const incomingStart = new Date(incoming.startAt).getTime();
            const incomingEnd = new Date(incoming.endAt).getTime();
            const existingStart = new Date(existing.startAt).getTime();
            const existingEnd = new Date(existing.endAt).getTime();
            return incomingStart < existingEnd && incomingEnd > existingStart;
          })
          .map((existing) => {
            const overlapStart = Math.max(new Date(incoming.startAt).getTime(), new Date(existing.startAt).getTime());
            const overlapEnd = Math.min(new Date(incoming.endAt).getTime(), new Date(existing.endAt).getTime());
            return {
              block1: incoming.title,
              block2: existing.title,
              overlapMinutes: Math.round((overlapEnd - overlapStart) / 60000),
            };
          });
      });

      if (existingConflicts.length > 0) {
        return res.status(409).json({
          error: 'Conflitos de horário detectados. Use forceSave=true para ignorar.',
          conflicts: existingConflicts,
        });
      }
    }

    // Processar Upserts em uma transação
    const savedBlocks = await prisma.$transaction(async (tx) => {
      // Se overwrite for true, remove todos os blocos do dia antes de salvar novos
      if (req.body.overwrite === true) {
        await tx.timelineBlock.deleteMany({
          where: { userId, localDate: baseDate },
        });
      }

      return Promise.all(
        blocks.map((block, index) => {
          const startAt = PlannerService.parseTimeToDate(baseDate, block.startTime);
          const endAt = PlannerService.parseTimeToDate(baseDate, block.endTime);

          const data = {
            userId,
            localDate: baseDate,
            startAt,
            endAt,
            title: block.title,
            category: block.category,
            intensity: block.intensity,
            status: block.status || 'planned',
            ...buildTimelineMetadataData(block),
          };

          if (block.id && req.body.overwrite !== true) {
            const adaptabilityPresence = timelineAdaptabilityPresence(rawBlocks[index]);
            return tx.timelineBlock.upsert({
              where: { id: block.id },
              update: {
                ...data,
                temporalPolicy: adaptabilityPresence.temporalPolicy ? block.temporalPolicy : undefined,
                adaptationPermission: adaptabilityPresence.adaptationPermission ? block.adaptationPermission : undefined,
                adaptabilitySource: adaptabilityPresence.adaptabilitySource ? block.adaptabilitySource : undefined,
                adaptabilityConfidence: adaptabilityPresence.adaptabilityConfidence ? block.adaptabilityConfidence : undefined,
              },
              create: { id: block.id, ...data },
            });
          } else {
            return tx.timelineBlock.create({
              data,
            });
          }
        })
      );
    });

    // Sync — re-fetch from DB to garantir gcalEventId atualizado (evita criar evento duplicado no GCal)
    try {
      const savedIds = savedBlocks.map(b => b.id);
      const freshBlocks = await prisma.timelineBlock.findMany({ where: { id: { in: savedIds } } });
      for (const b of freshBlocks) await GCalService.syncBlockToGcal(prisma, userId, b, date);
    } catch (e) {}

    // Auto micro-step: gera primeiro passo via AI para blocos novos sem note (fire-and-forget)
    const newBlocksWithoutNote = savedBlocks.filter(b => !b.note?.trim() && b.status === 'planned');
    if (newBlocksWithoutNote.length > 0) {
      void (async () => {
        try {
          const { default: OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          for (const b of newBlocksWithoutNote) {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              max_tokens: 60,
              temperature: 0.7,
              messages: [
                {
                  role: 'system',
                  content: 'Você é um assistente especialista em produtividade para pessoas com TDAH. Gere UM único micro-primeiro-passo concreto e muito pequeno (máx 12 palavras) para a tarefa dada. Só o micro-passo, sem explicação, sem aspas.',
                },
                { role: 'user', content: `Tarefa: "${b.title}"${b.category ? ` [${b.category}]` : ''}` },
              ],
            });
            const microStep = completion.choices[0]?.message?.content?.trim();
            if (microStep && microStep.length > 3) {
              await prisma.timelineBlock.update({
                where: { id: b.id },
                data: { note: microStep },
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('[micro-step] AI generation failed:', e);
        }
      })();
    }

    // Memory: registra tarefas concluídas (fire-and-forget)
    const completedBlocks = savedBlocks.filter(b => b.status === 'completed');
    for (const b of completedBlocks) {
      void memoryService.store({
        userId,
        contentType: 'checkin_note',
        contentId: `task-done-${b.id}`,
        content: `Tarefa concluída: "${b.title}"${b.category ? ` [${b.category}]` : ''}`,
        metadata: { source: 'task_completed', taskId: b.id, date, category: b.category },
      }).catch(() => {});
    }

    return res.json({
      savedBlocks,
      conflicts, // Retornamos conflitos de forma passiva se forceSave for true
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[timeline/sync] Error:', error);
    return res.status(500).json({ error: 'Failed to sync timeline blocks' });
  }
  });

  /**
   * DELETE /api/timeline/day/:date
   * Remove todos os blocos do planner para um dia específico.
   */
  app.delete('/api/timeline/day/:date', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ error: 'date (path, YYYY-MM-DD) is required' });
    }

    try {
      const baseDate = parseLocalDateInput(date);

      const { count } = await prisma.timelineBlock.deleteMany({
        where: { userId, localDate: baseDate },
      });
      return res.json({ deletedCount: count });
    } catch (error: any) {
      console.error('[timeline/deleteDay] Error:', error);
      return res.status(500).json({ error: 'Failed to clear timeline day' });
    }
  });

  /**
   * GET /api/preferences
   * Retorna as preferências do usuário (ou padrões se ainda não existirem).
   */
  app.get('/api/preferences', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const [prefs, profile] = await Promise.all([
        prisma.userPreference.findUnique({ where: { userId } }),
        prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true } }),
      ]);
      return res.json({
        ...(prefs ?? defaultUserPreferences),
        morningCheckinTime: prefs?.morningCheckinTime ?? DEFAULT_MORNING_CHECKIN_TIME,
        eveningReviewTime: prefs?.eveningReviewTime ?? DEFAULT_EVENING_REVIEW_TIME,
        notificationPreferences: normalizeNotificationPreferences(
          prefs?.notificationPreferences ?? defaultUserPreferences.notificationPreferences,
        ),
        fullName: profile?.fullName ?? null,
      });
    } catch (error: any) {
      console.error('[preferences/get] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  /**
   * PATCH /api/preferences
   * Cria ou atualiza as preferências do usuário.
   */
  app.patch('/api/preferences', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = PreferencesPatchSchema.parse(req.body);
      const patchData = data.notificationPreferences
        ? { ...data, notificationPreferences: normalizeNotificationPreferences(data.notificationPreferences) }
        : data;
      const prefs = await prisma.userPreference.upsert({
        where: { userId },
        update: patchData,
        create: { userId, ...defaultUserPreferences, ...patchData },
      });
      return res.json({
        ...prefs,
        notificationPreferences: normalizeNotificationPreferences(
          prefs.notificationPreferences ?? defaultUserPreferences.notificationPreferences,
        ),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[preferences/patch] Error:', error);
      return res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  /**
   * GET /api/privacy/export
   * Gera um pacote JSON com os dados pessoais da usuária.
   * Rate-limit: 1 export por 24h por usuária (anti-abuso).
   */
  const PRIVACY_EXPORT_EVENT = 'privacy.export.generated';
  const PRIVACY_EXPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

  app.get('/api/privacy/export', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const since = new Date(Date.now() - PRIVACY_EXPORT_WINDOW_MS);
      const recent = await prisma.eventLog.findFirst({
        where: { userId, eventName: PRIVACY_EXPORT_EVENT, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
      });
      if (recent) {
        const retryAfterMs =
          PRIVACY_EXPORT_WINDOW_MS - (Date.now() - recent.createdAt.getTime());
        const retryAfterSeconds = Math.max(60, Math.ceil(retryAfterMs / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          error: 'rate_limited',
          message: 'Você já exportou seus dados nas últimas 24 horas.',
          retryAfterSeconds,
        });
      }

      const payload = await buildPrivacyExport(prisma as unknown as PrivacyExportPrisma, userId);
      await prisma.eventLog.create({
        data: {
          userId,
          eventName: PRIVACY_EXPORT_EVENT,
          properties: { bytes: JSON.stringify(payload).length },
        },
      });
      res.setHeader('Content-Disposition', `attachment; filename="airia-data-${userId}.json"`);
      return res.json(payload);
    } catch (error: any) {
      console.error('[privacy/export] Error:', error);
      return res.status(500).json({ error: 'Failed to export privacy data' });
    }
  });

  /**
   * GET /api/privacy/deletion-status
   * Devolve o estado atual do pedido de exclusão.
   */
  app.get('/api/privacy/deletion-status', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const status = await getDeletionStatus(
        prisma as unknown as PrivacyDeletePrisma,
        userId,
      );
      return res.json(status);
    } catch (error: any) {
      console.error('[privacy/deletion-status] Error:', error);
      return res.status(500).json({ error: 'Failed to read deletion status' });
    }
  });

  /**
   * POST /api/privacy/delete-request
   * Inicia pedido de exclusão; devolve token de confirmação válido por 24h.
   */
  app.post('/api/privacy/delete-request', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const status = await requestDeletion(
        prisma as unknown as PrivacyDeletePrisma,
        userId,
      );
      return res.json(status);
    } catch (error: any) {
      console.error('[privacy/delete-request] Error:', error);
      return res.status(500).json({ error: 'Failed to request deletion' });
    }
  });

  /**
   * POST /api/privacy/delete-confirm
   * Confirma exclusão usando o token retornado em delete-request.
   * Body: { token: string }
   */
  const DeleteConfirmSchema = z.object({ token: z.string().min(8).max(128) });
  app.post('/api/privacy/delete-confirm', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { token } = DeleteConfirmSchema.parse(req.body ?? {});
      const status = await confirmDeletion(
        prisma as unknown as PrivacyDeletePrisma,
        userId,
        token,
      );
      return res.json(status);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      if (error instanceof DeletionConfirmError) {
        return res.status(409).json({ error: error.code });
      }
      console.error('[privacy/delete-confirm] Error:', error);
      return res.status(500).json({ error: 'Failed to confirm deletion' });
    }
  });

  /**
   * POST /api/privacy/delete-cancel
   * Cancela um pedido de exclusão (válido a qualquer momento antes do purge).
   */
  app.post('/api/privacy/delete-cancel', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const status = await cancelDeletion(
        prisma as unknown as PrivacyDeletePrisma,
        userId,
      );
      return res.json(status);
    } catch (error: any) {
      console.error('[privacy/delete-cancel] Error:', error);
      return res.status(500).json({ error: 'Failed to cancel deletion' });
    }
  });

  // Reservado para o cron de purge (out of scope desta sprint):
  // varrer EventLog por privacy.deletion.confirmed cujo properties.scheduledFor
  // já passou e deletar o Profile (cascade leva tudo).
  void PRIVACY_DELETION_EVENT_NAMES;

  /**
   * PATCH /api/profile
   * Atualiza dados básicos do perfil do usuário autenticado.
   */
  app.patch('/api/profile', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const ProfilePatchSchema = z.object({
      fullName: z.string().trim().min(1).max(80),
    });

    try {
      const data = ProfilePatchSchema.parse(req.body);
      const profile = await prisma.profile.upsert({
        where: { id: userId },
        update: { fullName: data.fullName },
        create: { id: userId, fullName: data.fullName },
        select: { fullName: true },
      });

      return res.json(profile);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[profile/patch] Error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * GET /api/objectives
   * Lista objetivos ativos do usuário.
   */
  app.get('/api/objectives', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const objectives = await prisma.objective.findMany({
        where: { userId, archived: false },
        orderBy: { createdAt: 'asc' },
      });
      return res.json(objectives.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        category: o.category,
        progress: o.progress,
        subgoals: o.subgoals,
        aiInsight: o.aiInsight,
        createdAt: o.createdAt.toISOString(),
      })));
    } catch (error: any) {
      console.error('[objectives/list] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch objectives' });
    }
  });

  /**
   * POST /api/objectives
   * Cria um novo objetivo.
   */
  app.post('/api/objectives', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const Schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.string().default('geral'),
      subgoals: ObjectiveSubgoalsSchema.default([]),
    });
    try {
      const data = Schema.parse(req.body);
      const obj = await prisma.objective.create({
        data: { userId, ...data, subgoals: data.subgoals as any },
      });
      // Vetoriza a meta (fire-and-forget)
      memoryService.store({
        userId,
        contentType: 'goal',
        contentId: obj.id,
        content: `Meta: ${data.title}${data.description ? `. ${data.description}` : ''}`,
        metadata: { category: data.category, objectiveId: obj.id, progress: obj.progress, archived: obj.archived },
      }).catch(() => {});
      return res.status(201).json({ id: obj.id, title: obj.title, category: obj.category, progress: obj.progress, subgoals: obj.subgoals, createdAt: obj.createdAt.toISOString() });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[objectives/create] Error:', error);
      return res.status(500).json({ error: 'Failed to create objective' });
    }
  });

  /**
   * PATCH /api/objectives/:id
   * Atualiza título, progresso ou sub-metas de um objetivo.
   */
  app.patch('/api/objectives/:id', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    const Schema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      progress: z.number().int().min(0).max(100).optional(),
      subgoals: ObjectiveSubgoalsSchema.optional(),
      aiInsight: z.string().nullable().optional(),
      archived: z.boolean().optional(),
    });
    try {
      const data = Schema.parse(req.body);
      const obj = await prisma.objective.updateMany({
        where: { id, userId },
        data: { ...data, subgoals: data.subgoals as any },
      });
      if (obj.count === 0) return res.status(404).json({ error: 'Objective not found' });
      const updated = await prisma.objective.findUnique({ where: { id } });
      if (updated) {
        await prisma.memoryEmbedding.updateMany({
          where: { userId, contentType: 'goal', contentId: id },
          data: {
            metadata: {
              category: updated.category,
              objectiveId: updated.id,
              progress: updated.progress,
              archived: updated.archived,
            },
          },
        }).catch(() => {});
      }
      return res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[objectives/patch] Error:', error);
      return res.status(500).json({ error: 'Failed to update objective' });
    }
  });

  /**
   * DELETE /api/objectives/:id
   * Arquiva (soft-delete) um objetivo.
   */
  app.delete('/api/objectives/:id', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    try {
      await prisma.objective.updateMany({
        where: { id, userId },
        data: { archived: true },
      });
      await prisma.memoryEmbedding.updateMany({
        where: { userId, contentType: 'goal', contentId: id },
        data: {
          metadata: {
            objectiveId: id,
            archived: true,
          },
        },
      }).catch(() => {});
      return res.status(204).send();
    } catch (error: any) {
      console.error('[objectives/delete] Error:', error);
      return res.status(500).json({ error: 'Failed to archive objective' });
    }
  });

  /**
   * GET /api/timeline/:date
   * Retorna os blocos do planner para um dia específico.
   */
  app.get('/api/timeline/:date', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ error: 'date (path, YYYY-MM-DD) is required' });
    }

    try {
      const baseDate = parseLocalDateInput(date);

      const blocks = await prisma.timelineBlock.findMany({
        where: { userId, localDate: baseDate },
        orderBy: { startAt: 'asc' },
      });

      const formatTime = (d: Date): string => {
        const h = d.getUTCHours().toString().padStart(2, '0');
        const m = d.getUTCMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      };

      return res.json(
        blocks.map((block) => ({
          ...resolveTimelineAdaptability(block),
          ...resolveTimelineAdaptabilityProvenance(block),
          id: block.id,
          title: block.title,
          startTime: formatTime(block.startAt),
          endTime: formatTime(block.endAt),
          category: block.category,
          intensity: block.intensity,
          status: block.status,
          isAiSuggested: block.isAiSuggested,
          aiReasoning: block.aiReasoning,
          noteMode: block.noteMode ?? 'text',
          note: block.note ?? '',
          checklist: Array.isArray(block.checklist) ? block.checklist : [],
          recurring: block.recurring ?? DEFAULT_TIMELINE_RECURRING,
          energyLevel: block.energyLevel ?? null,
          lastResetDate: formatDateOnly(block.lastResetDate),
          persistentReminderEnabled: block.persistentReminderEnabled ?? false,
          persistentReminderIntervalMinutes: block.persistentReminderIntervalMinutes ?? null,
          icon: (block as any).icon ?? null,
          color: (block as any).color ?? null,
          vibrateEnabled: (block as any).vibrateEnabled ?? false,
          alarmEnabled: (block as any).alarmEnabled ?? false,
          recurringNotificationEnabled: (block as any).recurringNotificationEnabled ?? false,
          visualRepeatEnabled: (block as any).visualRepeatEnabled ?? false,
          gcalEventId: block.gcalEventId ?? null,
          taskMode: (block as any).taskMode ?? 'standard',
          snoozedUntil: (block as any).snoozedUntil ? (block as any).snoozedUntil.toISOString() : null,
        }))
      );
    } catch (error: any) {
      console.error('[timeline/get] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch timeline blocks' });
    }
  });

  // ── Endpoints de Memória RAG ────────────────────────────────────────────────

  /**
   * POST /api/memory/store
   * Vetoriza e armazena um fragmento de memória manualmente (metas, insights).
   */
  app.post('/api/memory/store', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { contentType, contentId, content, metadata } = req.body;
    if (!content || !contentType) return res.status(400).json({ error: 'content and contentType required' });
    await memoryService.store({ userId, contentType, contentId, content, metadata });
    return res.json({ stored: true });
  });

  /**
   * GET /api/memory/relevant?query=...
   * Busca as memórias mais semanticamente relevantes para uma query.
   */
  app.get('/api/memory/relevant', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const query = String(req.query.query || '');
    const limit = Math.min(Number(req.query.limit ?? 4), 10);
    if (!query) return res.json({ memories: [] });
    const memories = await memoryService.retrieve(userId, query, limit);
    return res.json({ memories });
  });

  /**
   * DELETE /api/memory
   * Apaga todas as memórias do usuário (GDPR / privacidade).
   */
  app.delete('/api/memory', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    await memoryService.deleteAll(userId);
    return res.json({ deleted: true });
  });

  const DayContextQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });

  app.get('/api/context/day', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const query = DayContextQuerySchema.parse(req.query);
      const localDate = query.date ?? format(new Date(), 'yyyy-MM-dd');
      const canonicalMemories = await canonicalMemoryService.retrieve({ userId, query: `padrões e preferências operacionais para ${localDate}`, limit: 8, locale: typeof (req.query as any)?.locale === 'string' ? String((req.query as any).locale) : 'pt-BR' }).catch(() => null);
      const dailyContext = await contextGroundingService.buildDailyContext({
        userId,
        type: 'day-context',
        context: { localDate },
        recentSuggestionItems: await SuggestionMemoryService.getRecent(prisma, userId).catch(() => []),
        ragContext: canonicalMemories ? canonicalMemoryService.formatForPrompt(canonicalMemories, typeof (req.query as any)?.locale === 'string' ? String((req.query as any).locale) : 'pt-BR') : '',
      });
      const agendaPreview = AgendaAdaptationService.buildPreview({
        dailyContext,
        requestContext: {},
        mode: 'preview',
        trigger: 'manual',
      });
      return res.json({
        ...dailyContext,
        decisionBrain: agendaPreview.adaptiveAgenda.decisionBrain,
        adaptiveAgenda: agendaPreview.adaptiveAgenda,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[context/day] Error:', error);
      return res.status(500).json({ error: 'Failed to build day context' });
    }
  });

  const AiActionFeedbackSchema = z.object({
    title: z.string().trim().min(1).max(160),
    status: z.enum(['shown', 'accepted', 'done', 'dismissed', 'deleted', 'scheduled', 'rejected']),
    surface: z.string().trim().min(1).max(40).optional(),
    sourceType: z.string().trim().max(60).optional(),
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    targetType: z.string().trim().max(60).optional(),
    targetId: z.string().trim().max(180).optional(),
  });

  app.post('/api/ai/action-feedback', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = AiActionFeedbackSchema.parse(req.body);
      const item = await AiActionFeedbackService.append(prisma, userId, data);
      if (item) {
        await prisma.eventLog?.create?.({
          data: {
            userId,
            eventName: 'ai.action_feedback',
            properties: {
              title: item.title.slice(0, 120),
              status: item.status,
              surface: item.surface,
              sourceType: item.sourceType,
              localDate: item.localDate,
            },
            path: req.path,
            userAgent: req.get('user-agent') ?? null,
          },
        }).catch(() => null);

        // Fase C — reforço de padrão em ação aceita/feita ou rejeitada.
        // Heurística: busca padrões ativos do usuário, vê quais têm overlap de
        // palavras ≥ 0.4 com o título da ação, aplica delta de força:
        //   accepted/done  → +0.05  (até 1.0)
        //   dismissed      → -0.10
        //   deleted/rejected → -0.15
        // Roda em background pra não atrasar response.
        setImmediate(() => {
          void reinforcePatternsFromActionFeedback(prisma, userId, item.title, item.status).catch((err) => {
            console.warn('[kg/reinforce-from-action]', err);
          });
        });
      }
      return res.json({ stored: Boolean(item), item });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[ai/action-feedback] Error:', error);
      return res.status(500).json({ error: 'Failed to store action feedback' });
    }
  });

  const AgendaAdaptSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    mode: z.enum(['preview', 'apply']).optional().default('preview'),
    trigger: z.enum(['manual', 'checkin', 'cron', 'home', 'planner']).optional().default('manual'),
    context: z.record(z.unknown()).optional().default({}),
    selectedDecisionIds: z.array(z.string().min(1)).optional().default([]),
  });

  app.post('/api/agenda/adapt', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = AgendaAdaptSchema.parse(req.body);
      const localDate = data.date ?? format(new Date(), 'yyyy-MM-dd');
      const agendaStylePattern = await agendaPatternRecognitionService.recognize(
        userId,
        new Date(`${localDate}T12:00:00.000Z`),
        typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR',
      ).catch((error) => {
        console.warn('[agenda/pattern-recognition]', error);
        return null;
      });
      const adaptiveRequestContext = { ...data.context, agendaStylePattern };
      const recentSuggestionItems = await SuggestionMemoryService.getRecent(prisma, userId).catch(() => []);
      const canonicalMemories = await canonicalMemoryService.retrieve({ userId, query: `adaptação de agenda e rotina real em ${localDate}`, limit: 8, locale: typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR' }).catch(() => null);
      const dailyContext = await contextGroundingService.buildDailyContext({
        userId,
        type: 'agenda-adapt',
        context: { ...adaptiveRequestContext, localDate },
        recentSuggestionItems,
        ragContext: canonicalMemories ? canonicalMemoryService.formatForPrompt(canonicalMemories, typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR') : '',
      });
      const result = data.mode === 'apply'
        ? await AgendaAdaptationService.apply({
            prisma,
            userId,
            dailyContext,
            requestContext: adaptiveRequestContext,
            trigger: data.trigger,
            selectedDecisionIds: data.selectedDecisionIds,
          })
        : AgendaAdaptationService.buildPreview({
            dailyContext,
            requestContext: adaptiveRequestContext,
            mode: data.mode,
            trigger: data.trigger,
          });
      return res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[agenda/adapt] Error:', error);
      return res.status(500).json({ error: 'Failed to adapt agenda' });
    }
  });

  const AgendaRecalibrateSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    signal: z.enum(['day_hard', 'day_great', 'hyperfocus', 'energy_crash']),
    reason: z.string().max(500).optional(),
    context: z.record(z.unknown()).optional().default({}),
  });

  app.post('/api/agenda/recalibrate', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = AgendaRecalibrateSchema.parse(req.body);
      const localDate = data.date ?? format(new Date(), 'yyyy-MM-dd');
      const recentSuggestionItems = await SuggestionMemoryService.getRecent(prisma, userId).catch(() => []);
      const ragMemories = await memoryService.retrieve(userId, `ritmo e rotina em ${localDate}`, 3).catch(() => []);

      const requestContext: Record<string, unknown> = {
        ...(data.context ?? {}),
        localDate,
        recalibrationSignal: data.signal,
        recalibrationReason: data.reason ?? null,
      };

      const dailyContext = await contextGroundingService.buildDailyContext({
        userId,
        type: 'agenda-adapt',
        context: requestContext,
        recentSuggestionItems,
        ragContext: memoryService.formatForPrompt(ragMemories),
      });

      const result = AgendaAdaptationService.buildPreview({
        dailyContext,
        requestContext,
        mode: 'preview',
        trigger: `recalibrate:${data.signal}`,
      });

      await prisma.eventLog.create({
        data: {
          userId,
          eventName: 'agenda.recalibrated',
          properties: { signal: data.signal, reason: data.reason ?? null, date: localDate },
        },
      }).catch(() => {});

      return res.json({ ...result, recalibrationSignal: data.signal, recalibrationReason: data.reason ?? null });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[agenda/recalibrate] Error:', error);
      return res.status(500).json({ error: 'Failed to recalibrate agenda' });
    }
  });

  /**
   * POST /api/planner/conflicts — Sprint Frente 3
   * Detecta conflitos no dia + retorna resoluções heurísticas (sem IA).
   * Body: { date: 'YYYY-MM-DD' }
   */
  const PlannerConflictsRequestSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  app.post('/api/planner/conflicts', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = PlannerConflictsRequestSchema.parse(req.body);
      const baseDate = parseLocalDateInput(data.date);
      const blocks = await prisma.timelineBlock.findMany({
        where: { userId, localDate: baseDate, status: 'planned' },
        orderBy: { startAt: 'asc' },
      });
      const conflicts = PlannerService.detectConflicts(blocks);
      return res.json({ date: data.date, totalBlocks: blocks.length, conflicts });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[planner/conflicts]', error);
      return res.status(500).json({ error: 'Failed to detect conflicts' });
    }
  });

  /**
   * POST /api/ai/proactive-replan — Sprint Frente 3
   * Replanejamento PROATIVO do dia inteiro com base no estado atual.
   * Reusa PlannerAIService mas zera existingBlocks pra IA reconstruir do zero.
   * Body igual a /api/ai/planner-suggestions; existingBlocks pode vir vazio.
   */
  app.post('/api/ai/proactive-replan', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = PlannerAISuggestionRequestSchema.parse(req.body);
      const runtimeCtx = await resolveAiRuntimeContext(prisma, userId, req.body ?? {});

      let kgContext: string | null = null;
      try {
        const kg = await KnowledgeGraphService.getRelevantContextForMessage(
          userId,
          `Replanejamento proativo do dia ${data.date}: ${data.energyState.label}`,
        );
        kgContext = KnowledgeGraphService.formatContextForPrompt(kg) || null;
      } catch (e) {
        console.warn('[proactive-replan/kg]', e);
      }

      let learningCtx: string | null = null;
      try {
        const lc = await LearningContextService.get(userId);
        learningCtx = LearningContextService.formatForPrompt(lc) || null;
      } catch (e) {
        console.warn('[proactive-replan/learning]', e);
      }

      const result = await PlannerAIService.getSuggestions(data, {
        userName: runtimeCtx.userName,
        profileSummary: runtimeCtx.userProfileSummary,
        moodCycleContext: runtimeCtx.moodCycleContext,
        knowledgeGraphContext: kgContext,
        priorDiagnoses: runtimeCtx.priorDiagnoses,
        learningContext: learningCtx,
      });

      await prisma.eventLog.create({
        data: {
          userId,
          eventName: 'planner.ai.proactive_replan',
          properties: {
            date: data.date,
            energyLabel: data.energyState.label,
            scheduleCount: result.schedule.length,
            adjustedCount: result.adjustedExisting.length,
          },
        },
      }).catch(() => null);

      return res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.warn('[ai/proactive-replan] ZodError:', JSON.stringify(error.errors, null, 2));
        console.warn('[ai/proactive-replan] body recebido:', JSON.stringify(req.body, null, 2));
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[ai/proactive-replan]', error);
      return res.status(500).json({ error: 'Failed to replan day' });
    }
  });

  /**
   * POST /api/ai/planner-suggestions — Sprint Frente 1
   * Endpoint dedicado: gera schedule (novos blocos) + adjustedExisting (mudanças
   * propostas) sem persistir nada. Frontend confirma bloco-a-bloco via cards.
   */
  app.post('/api/ai/planner-suggestions', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = PlannerAISuggestionRequestSchema.parse(req.body);
      console.log('[planner-suggestions] OK userId=%s date=%s blocks=%d', userId, data.date, data.existingBlocks.length);

      // Reusa runtime context já existente (perfil, mood cycle, diagnoses)
      const runtimeCtx = await resolveAiRuntimeContext(prisma, userId, req.body ?? {});

      // Knowledge graph compacto (Fix #4)
      let kgContext: string | null = null;
      try {
        const kg = await KnowledgeGraphService.getRelevantContextForMessage(
          userId,
          `Planejamento do dia ${data.date}: ${data.energyState.label}`,
        );
        kgContext = KnowledgeGraphService.formatContextForPrompt(kg) || null;
      } catch (e) {
        console.warn('[planner-suggestions/kg] falhou:', e);
      }

      // Sprint Frente 2 — Learning context longitudinal via SQL views
      let learningCtx: string | null = null;
      try {
        const lc = await LearningContextService.get(userId);
        learningCtx = LearningContextService.formatForPrompt(lc) || null;
      } catch (e) {
        console.warn('[planner-suggestions/learning] falhou:', e);
      }

      const result = await PlannerAIService.getSuggestions(data, {
        userName: runtimeCtx.userName,
        profileSummary: runtimeCtx.userProfileSummary,
        moodCycleContext: runtimeCtx.moodCycleContext,
        knowledgeGraphContext: kgContext,
        priorDiagnoses: runtimeCtx.priorDiagnoses,
        learningContext: learningCtx,
      });

      // EventLog leve pra observabilidade (sem PII sensível)
      await prisma.eventLog.create({
        data: {
          userId,
          eventName: 'planner.ai.suggested',
          properties: {
            date: data.date,
            energyLabel: data.energyState.label,
            scheduleCount: result.schedule.length,
            adjustedCount: result.adjustedExisting.length,
          },
        },
      }).catch(() => null);

      return res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.warn('[ai/planner-suggestions] ZodError:', JSON.stringify(error.errors, null, 2));
        console.warn('[ai/planner-suggestions] body recebido:', JSON.stringify(req.body, null, 2));
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[ai/planner-suggestions] Error:', error);
      return res.status(500).json({ error: 'Failed to generate planner suggestions' });
    }
  });

  const HealthConnectSyncSchema = z.object({
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.literal('health_connect').optional().default('health_connect'),
    sleepMinutes: z.number().min(0).max(24 * 60).nullable().optional(),
    sleepScore: z.number().min(1).max(10).nullable().optional(),
    steps: z.number().min(0).max(200000).nullable().optional(),
    avgHeartRate: z.number().min(20).max(240).nullable().optional(),
    exerciseMinutes: z.number().min(0).max(24 * 60).nullable().optional(),
    syncedAt: z.string().datetime().optional(),
  });

  app.get('/api/health-connect/latest', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const event = await prisma.eventLog.findFirst({
        where: { userId, eventName: 'health_connect.synced' },
        orderBy: { createdAt: 'desc' },
        select: { properties: true, createdAt: true },
      });
      return res.json({
        connected: Boolean(event),
        snapshot: event?.properties ?? null,
        createdAt: event?.createdAt ?? null,
      });
    } catch (error) {
      console.error('[health-connect/latest] Error:', error);
      return res.status(500).json({ error: 'Failed to load Health Connect status' });
    }
  });

  app.post('/api/health-connect/sync', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = HealthConnectSyncSchema.parse(req.body);
      const snapshot = {
        ...data,
        source: 'health_connect',
        syncedAt: data.syncedAt ?? new Date().toISOString(),
      };
      await prisma.eventLog.create({
        data: {
          userId,
          eventName: 'health_connect.synced',
          properties: snapshot,
          path: req.path,
          userAgent: req.get('user-agent') ?? null,
        },
      });
      return res.json({ ok: true, snapshot });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[health-connect/sync] Error:', error);
      return res.status(500).json({ error: 'Failed to sync Health Connect data' });
    }
  });

  /**
   * POST /api/ai/suggest
   * Gera sugestões de IA para campos do planner (título, notas, checklist).
   */
  const AiSuggestSchema = z.object({
    type: z.string().min(1),
    context: z.record(z.unknown()).optional().default({}),
  });

  app.post('/api/ai/suggest', requireAuth, async (req: Request, res: Response) => {
    let type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let context: any;
    try {
      ({ type, context } = AiSuggestSchema.parse(req.body));
    } catch {
      return res.status(400).json({ error: 'type (string) is required' });
    }
    try {
      const userId = (req as AuthRequest).userId;
      const plainTextTypes = new Set(['task-notes', 'task-title', 'monthly-report']);
      const { userName, moodCycleContext, userProfileSummary, priorDiagnoses, longTermMemory, activeGoalsContext, latestCheckinSignals } =
        await resolveAiRuntimeContext(prisma, userId, context);

      // Shared Brain: todas as superfícies de IA buscam memória vetorial com intenção específica
      const ragQuery = getRagIntent(type, context);
      const [ragMemories, recentSuggestionItems] = await Promise.all([
        memoryService.retrieve(userId, ragQuery, 3).catch(() => []),
        SuggestionMemoryService.getRecent(prisma, userId),
      ]);
      const ragContext = memoryService.formatForPrompt(ragMemories);
      const recentSuggestionMemory = SuggestionMemoryService.formatForPrompt(recentSuggestionItems);
      context = buildUnifiedSuggestContext({
        type,
        context,
        userName,
        moodCycleContext,
        userProfileSummary,
        longTermMemory,
        activeGoalsContext,
        ragContext,
        latestCheckinSignals,
      });
      context.recentSuggestionMemory = recentSuggestionMemory;
      context.recentSuggestionItems = recentSuggestionItems;
      context = await contextGroundingService.buildForSuggest({
        userId,
        type,
        context,
        recentSuggestionItems,
        ragContext,
      });
      const suggestReasoning = ReasoningContextService.buildForPrompt({
        dailyContext: context.grounding as any,
        surface: ((context.grounding as any)?.decisionBrain?.surface ?? 'home') as any,
        requestContext: context,
        currentMessage: [
          typeof context.title === 'string' ? context.title : '',
          typeof context.currentNote === 'string' ? context.currentNote : '',
          typeof context.message === 'string' ? context.message : '',
        ].filter(Boolean).join(' | '),
        ragContext,
        decisionBrain: (context as any).decisionBrain ?? null,
      });
      const airiaActionPlan = AiriaOperationalReasoningService.build({
        dailyContext: context.grounding as any,
        surface: ((context.grounding as any)?.decisionBrain?.surface ?? 'home') as any,
        requestContext: context,
        currentMessage: [
          typeof context.title === 'string' ? context.title : '',
          typeof context.currentNote === 'string' ? context.currentNote : '',
          typeof context.message === 'string' ? context.message : '',
        ].filter(Boolean).join(' | '),
        ragContext,
        decisionBrain: (context as any).decisionBrain ?? null,
        trace: suggestReasoning.trace,
      });
      const shouldRunCognitiveSuggest = [
        'home-messages',
        'checkin-response',
        'stability-analysis',
        'weekly-insight',
        'agenda-blocks',
        'day-tasks',
        'journal-tasks',
      ].includes(type);
      const suggestCognitive = shouldRunCognitiveSuggest
        ? await AiriaCognitiveInterpreterService.interpret({
            surface: ((context.grounding as any)?.decisionBrain?.surface ?? 'home') as any,
            dailyContext: context.grounding as any,
            requestContext: context,
            currentMessage: [
              typeof context.title === 'string' ? context.title : '',
              typeof context.currentNote === 'string' ? context.currentNote : '',
              typeof context.message === 'string' ? context.message : '',
              typeof context.note === 'string' ? context.note : '',
            ].filter(Boolean).join(' | '),
            ragContext,
            moodCycleContext,
            plannerContext: typeof context.groundingContext === 'string' ? context.groundingContext : '',
            activeGoalsContext,
            recentSuggestionMemory,
            actionPlan: airiaActionPlan,
          })
        : null;
      context.airiaActionPlan = airiaActionPlan;
      context.airiaOperationalSuggestion = AiriaOperationalReasoningService.visibleSuggestion(airiaActionPlan);
      context.reasoningTraceContext = [
        suggestReasoning.context,
        AiriaOperationalReasoningService.formatForPrompt(airiaActionPlan),
        suggestCognitive ? AiriaCognitiveInterpreterService.formatForPrompt(suggestCognitive) : '',
      ].join('\n\n');

      let prompt = '';
      if (type === 'task-notes') {
        prompt = `Você é uma assistente pessoal carinhosa e organizada. Escreva observações práticas e motivadoras (2-3 frases) para a tarefa "${context.title}" (categoria: ${context.category}). Tom acolhedor, como uma amiga organizada ajudando. Responda diretamente.`;
      } else if (type === 'task-checklist') {
        prompt = `Você é uma assistente pessoal organizada. Crie 3-5 itens de checklist práticos para a tarefa "${context.title}" (categoria: ${context.category}). Passos curtos para não sobrecarregar. Retorne SOMENTE um array JSON de strings: ["Item 1", "Item 2"]. Sem explicação.`;
      } else if (type === 'task-content') {
        prompt = `${userName} está organizando o bloco "${context.title}" na área ${context.category}. Decida qual apoio combina melhor com esse compromisso agora.

REGRAS:
- Se o compromisso já estiver claro e pedir só contexto, use "note".
- Se o compromisso estiver amplo, tiver várias partes ou pedir execução passo a passo, use "checklist".
- Se fizer sentido ter os dois, use "mixed".
- A nota deve ser curta, concreta e útil.
- O checklist deve ter 2-5 micro-passos reais, simples e sem abstração.
- Respeite energia ${context.energyLevel || 'media'}.
- Se houver contexto atual, aproveite sem repetir em eco:
Nota atual: ${context.currentNote || 'vazia'}
Checklist atual: ${(context.currentChecklist || []).join(' | ') || 'vazio'}

JSON APENAS:
{"mode":"note|checklist|mixed","note":"texto opcional","items":["passo 1","passo 2"]}`;
      } else if (type === 'task-split') {
        prompt = `${userName} quer quebrar o compromisso "${context.title}" em passos pequenos da área ${context.category}.

REGRAS:
- Gere 3-6 micro-passos concretos e executáveis.
- Cada passo deve caber em poucos minutos.
- Use verbos físicos e específicos.
- Evite abstrações como "planejar", "organizar melhor", "pensar sobre".
- Respeite energia ${context.energyLevel || 'media'}: se estiver alta, pode haver mais impulso; se estiver leve ou média, mantenha passos gentis.
- Se já existir checklist, não duplique:
${(context.currentChecklist || []).join(' | ') || 'nenhum item ainda'}

JSON APENAS:
{"items":["passo 1","passo 2","passo 3"]}`;
      } else if (type === 'task-title') {
        prompt = `Sugira um título claro, motivador e específico para uma tarefa de ${context.category} às ${context.time}. Retorne SOMENTE o título, sem aspas nem explicação.`;
      } else if (type === 'day-tasks') {
        const dtHistory = (context.checkinHistory || []) as Array<{date:string;humor:number;energia:number;sono?:number}>;
        const dtHistoryLines = dtHistory.slice(0, 7).map((h: any) =>
          `- ${h.date}: ${humanizeScore(h.humor, 'mood')}, energia ${humanizeScore(h.energia, 'energy')}${h.sono != null ? `, sono ${humanizeScore(h.sono, 'sleep')}` : ''}`
        ).join('\n');
        const dtGoals = (context.goals as string[] | undefined) || [];
        const dtGoalsCtx = dtGoals.length ? `\nMetas ativas de ${userName}: ${dtGoals.map((g, i) => `${i+1}. "${g}"`).join(', ')}` : '';
        const dtPendingTasks = (context.pendingTasks as string[] | undefined) || [];
        const dtPendingCtx = dtPendingTasks.length ? `\nCompromissos pendentes HOJE: ${dtPendingTasks.join(' | ')}` : '';
        const dtAvoidTaskTitles = (context.avoidTaskTitles as string[] | undefined) || [];
        const dtAvoidCtx = dtAvoidTaskTitles.length
          ? `\nNÃO REPETIR títulos já usados/ativos: ${dtAvoidTaskTitles.join(' | ')}`
          : '';
        const dtCompletedTaskTitles = (context.completedTaskTitles as string[] | undefined) || [];
        const dtCompletedHabitTitles = (context.completedHabitTitles as string[] | undefined) || [];
        const dtCompletedGoalTitles = (context.completedGoalTitles as string[] | undefined) || [];
        const dtCompletedSubgoalTitles = (context.completedSubgoalTitles as string[] | undefined) || [];
        const dtCompletedCtx = [
          dtCompletedTaskTitles.length ? `Agenda já concluída hoje: ${dtCompletedTaskTitles.join(' | ')}` : '',
          dtCompletedHabitTitles.length ? `Hábitos já feitos hoje: ${dtCompletedHabitTitles.join(' | ')}` : '',
          dtCompletedGoalTitles.length ? `Metas já concluídas: ${dtCompletedGoalTitles.join(' | ')}` : '',
          dtCompletedSubgoalTitles.length ? `Subtarefas de metas já feitas: ${dtCompletedSubgoalTitles.join(' | ')}` : '',
        ].filter(Boolean).join('\n');
        const dtHour = context.hour ?? new Date().getHours();
        const dtMinute = typeof context.minute === 'number' ? context.minute : 0;
        const earliestHour = Math.max(Number(dtHour), 8);
        const currentClock = `${String(dtHour).padStart(2, '0')}:${String(dtMinute).padStart(2, '0')}`;
        const dtPeriodo = context.partOfDay || (dtHour < 12 ? 'manhã' : dtHour < 18 ? 'tarde' : 'noite');
        const dtWeekday = context.weekday ? ` | Dia: ${context.weekday}` : '';
        const dtLocalDate = context.localDate ? ` (${context.localDate})` : '';

        // Fatores e emoções do check-in de hoje
        const FACTOR_LABELS: Record<string, string> = {
          good_sleep: 'Sono bom', exercise: 'Exercício', healthy_meal: 'Alimentação saudável',
          fresh_air: 'Ar fresco', good_talk: 'Boa conversa', kind_words: 'Palavras gentis',
          support: 'Apoio recebido', small_win: 'Pequena vitória', finished_task: 'Tarefa concluída',
          feeling_valued: 'Me senti valorizada', music: 'Música', time_outside: 'Tempo ao ar livre',
          hobby: 'Hobby', self_trust: 'Confiança em mim', rest: 'Descanso',
          stuck: 'Travada/o', relationship_conflict: 'Briga no relacionamento',
          overwhelmed: 'Sobrecarga mental', loneliness: 'Solidão', bad_sleep: 'Sono ruim',
          work_pressure: 'Pressão no trabalho', financial_stress: 'Estresse financeiro', bad_news: 'Má notícia',
        };
        const NEGATIVE_IDS = new Set(['stuck','relationship_conflict','overwhelmed','loneliness','bad_sleep','work_pressure','financial_stress','bad_news']);
        const EMOTION_LABELS: Record<string, string> = {
          radiant: 'Radiante', calm: 'Calma', happy: 'Feliz', anxious: 'Ansiosa',
          tired: 'Cansada', focused: 'Focada', sad: 'Triste', angry: 'Irritada',
          stressed: 'Estressada', sensitive: 'Sensível', exhausted: 'Exausta', agitated: 'Agitada',
        };

        const allFactors = (context.factors as string[] | undefined) || [];
        const negFactors = allFactors.filter(id => NEGATIVE_IDS.has(id));
        const posFactors = allFactors.filter(id => !NEGATIVE_IDS.has(id));
        const emotions = (context.emotions as string[] | undefined) || [];

        const emotionCtx = emotions.length > 0
          ? `\nEMOÇÕES RELATADAS: ${emotions.map(id => EMOTION_LABELS[id] ?? id).join(', ')}`
          : '';
        const negCtx = negFactors.length > 0
          ? `\nFATORES QUE PESARAM HOJE: ${negFactors.map(id => FACTOR_LABELS[id] ?? id).join(', ')}`
          : '';
        const posCtx = posFactors.length > 0
          ? `\nFATORES QUE AJUDARAM HOJE: ${posFactors.map(id => FACTOR_LABELS[id] ?? id).join(', ')}`
          : '';

        const negRule = negFactors.length > 0
          ? `\n8. FATORES NEGATIVOS presentes (${negFactors.map(id => FACTOR_LABELS[id] ?? id).join(', ')}): pelo menos 1 tarefa deve endereçar diretamente um desses fatores com ação específica de alívio (ex: "Briga no relacionamento" → "Escrever como você se sente sobre a situação, 10 min"; "Sobrecarga mental" → "Listar no papel as 3 coisas que mais pesam agora, 5 min"; "Sono ruim" → "Deitar sem tela por 20 min às [hora]").`
          : '';
        const posRule = posFactors.length > 0
          ? `\n${negFactors.length > 0 ? '9' : '8'}. FATORES POSITIVOS presentes (${posFactors.map(id => FACTOR_LABELS[id] ?? id).join(', ')}): potencialize ao menos um desses elementos em uma tarefa.`
          : '';

        prompt = `Gere 3 tarefas para HOJE — TOTALMENTE personalizadas para ${userName}.

ESTADO HOJE: "${context.moodLabel}" (${context.mood}) | Período: ${dtPeriodo}${dtWeekday}${dtLocalDate}${emotionCtx}${negCtx}${posCtx}
${dtHistoryLines ? `HISTÓRICO RECENTE:\n${dtHistoryLines}` : ''}${dtGoalsCtx}${dtPendingCtx}${dtCompletedCtx ? `\nJÁ FEITO HOJE — use como evidência, NÃO como sugestão:\n${dtCompletedCtx}` : ''}${dtAvoidCtx}
${context.moodCycleContext ? `\nCONTEXTO VIVO:\n${context.moodCycleContext}` : ''}${context.groundingContext || ''}${ragContext}${recentSuggestionMemory}

REGRAS INVIOLÁVEIS:
0. FONTE DA VERDADE DE HOJE = listas acima de "Metas ativas" e "Compromissos pendentes HOJE". Se a memória sugerir algo fora dessas listas, IGNORE.
0.0. LEITURA TOTAL: cruze relato/check-in atual, humor atual, histórico de humor, RAG/memória, planner, metas, hábitos e ações recentes antes de criar tarefas.
0.1. NUNCA transforme item já concluído hoje em tarefa nova. Se treino/hábito já foi feito, não sugira treino, kit de treino, roupa de treino nem preparação de treino.
1. Use o histórico e as metas acima — as tarefas devem ser relevantes ao que ${userName} realmente faz, não inventadas
2. Se há metas, pelo menos 1 tarefa deve avançar uma meta específica (cite a meta no título)
2.1 Se NÃO há metas ativas, não cite nenhuma meta específica.
2.2 Se NÃO há compromissos pendentes HOJE, não cite compromisso específico inexistente.
3. Fase baixa/cansada → tarefas de 5-15min máximo, zero pressão, focadas em autocuidado/repouso
4. Fase elevada/focada → 1 tarefa de trabalho real de impacto + 1 autocuidado + 1 pessoal
5. Cada tarefa = ação que ${userName} pode fazer hoje com o que já tem em casa
6. Se for noite, priorize fechamento, autocuidado e preparação suave do próximo dia
7. ESPECIFICIDADE OBRIGATÓRIA: cada título deve ter VERBO ATIVO + DETALHE CONCRETO + DURAÇÃO estimada
8. Se não houver âncora real suficiente para 3 tarefas, retorne menos tarefas. Não preencha vazio com genérico.${negRule}${posRule}

PROIBIDO ABSOLUTAMENTE: "Descanse", "Beba água", quadro de visão, mapa de visão, planejar semana, organizar arquivos, qualquer genérico sem contexto real da pessoa.

HORÁRIOS OBRIGATÓRIOS: agora são ${currentClock}. Use apenas horários futuros entre ${String(earliestHour).padStart(2, '0')}:00 e 20:00. NUNCA sugira horário já passado, meia-noite ou madrugada.

Retorne SOMENTE array JSON: [{"title":"título específico e real","category":"trabalho|saude|rotina|social","time":"HH:MM"}]. Sem explicação.`;
      } else if (type === 'journal-tasks') {
        const nowHour = new Date().getHours();
        const timeWindow = nowHour >= 20
          ? 'ATENÇÃO: já são mais de 20h. Sugira tarefas para AMANHÃ com horários entre 08:00 e 12:00.'
          : `Sugira horários realistas entre ${Math.max(nowHour + 1, 8).toString().padStart(2, '0')}:00 e 20:00. NUNCA use horários após 20:00, meia-noite ou madrugada.`;
        prompt = `Com base nesta conversa de diário:\n\n${context.messages}

Gere 0-3 tarefas para apoiar o que foi dito, com tom gentil e ZERO abstração.

${timeWindow}

REGRAS INVIOLÁVEIS:
0. LEITURA TOTAL: cruze conversa atual, humor atual, histórico de humor, RAG/memória, planner, metas, hábitos, sugestões aceitas e sugestões rejeitadas.
1. Primeiro identifique sugestões que foram conversadas e validadas pela pessoa: concordância, escolha, pedido de aprofundamento, "faz sentido", "quero", "vamos" ou sinal claro de interesse.
2. Transforme essas sugestões aceitas nas primeiras tarefas. Não priorize ideias que só a IA lançou e a pessoa não validou.
3. Se a pessoa rejeitou, desviou ou mostrou incômodo com uma sugestão, NÃO transforme isso em tarefa.
4. Só crie tarefa nova se faltarem itens e a conversa trouxer base concreta.
5. Cada tarefa deve ter: VERBO DE AÇÃO + OBJETO CONCRETO + CONTEXTO + DURAÇÃO.
6. O título precisa ser executável imediatamente e mensurável hoje.
7. Use duração curta e explícita no título (5, 10, 15, 20 ou 30 min).
8. Use internamente esta ordem: leitura funcional profunda primeiro, TCC prática depois, exposição gradual, propósito e somática por último. Nunca cite esses nomes.
9. Evite duplicação entre tarefas.
10. Qualquer leitura de problema útil, sinal antes de queda, movimento interrompido ou efeito indireto precisa estar baseada em evidência concreta da conversa. Não invente padrão para justificar tarefa.
11. Ao escolher tarefas, cruze internamente: o que a pessoa precisa para não piorar, o que a situação permite hoje e o que ela prefere preservar. A tarefa deve caber nesse ponto, com execução pequena.
12. Se só houver memória antiga ou leitura emocional sem fato atual suficiente, retorne [] em vez de inventar tarefa.

PROIBIDO:
- "descansar", "se cuidar", "tomar água", "organizar a vida", "pensar sobre", "refletir"
- qualquer frase genérica sem objeto real
- tarefas vagas sem duração
- somática genérica quando a conversa pede ação prática, exposição mínima, contenção ou organização

EXEMPLOS DE FORMATO BOM:
- "Escrever por 10 min no bloco de notas 3 gatilhos que te esgotaram hoje"
- "Separar por 15 min a roupa e os itens da manhã de amanhã"
- "Enviar em 5 min uma mensagem objetiva pedindo ajuste de prazo"

Retorne SOMENTE um array JSON: [{"title":"tarefa concreta","category":"trabalho|saude|rotina|social","time":"HH:MM"}]. Sem explicação.`;
      } else if (type === 'goal-subtasks') {
        const existing = context.existingSubtasks?.length ? `\nSubtarefas já existentes: ${context.existingSubtasks.join(', ')}` : '';
        prompt = `${userName} pode estar com energia baixa ou oscilante. Gere micro-passos sem carga cognitiva e sem abstrações.

Meta: "${context.goalTitle}"${existing}

Gere 4-5 MICRO-AÇÕES físicas e hiper-específicas. Regras OBRIGATÓRIAS:
- Cada ação é executável em 2-10 minutos
- Comece com VERBO físico: Abrir, Separar, Mandar, Verificar, Ligar, Escrever, Pegar, Colocar, Escolher
- NUNCA use: "planejar", "organizar", "pesquisar sobre", "considerar", "preparar-se para", "pensar"
- Nomeie objetos reais, apps e locais específicos quando possível
- Cada ação = mínima unidade de esforço, zero carga cognitiva

Exemplos para "ir à praia": ["Abrir o calendário e marcar um dia nos próximos 7 dias", "Verificar a previsão do tempo no celular para esse dia", "Separar o biquíni/sunga e o protetor solar agora", "Mandar mensagem para alguém: 'Vamos à praia [dia]?'", "Abrir Google Maps e ver quanto tempo leva para chegar"]

- As ações não podem se repetir de forma disfarçada.
- A primeira ação deve ser a mais fácil de começar em menos de 2 minutos.
- Se já houver subtarefas parecidas, evite duplicar.

JSON APENAS: {"items":["micro-ação 1","micro-ação 2","micro-ação 3","micro-ação 4"]}`;
      } else if (type === 'weekly-insight') {
        prompt = `${userName} precisa de uma leitura semanal realmente útil, como uma assistente pessoal autônoma que acompanha o ciclo ao longo do tempo.

Dados da semana:
- Humor predominante: ${humanizeScore(context.avgHumor, 'mood')} (média dos últimos 7 dias)
- Energia predominante: ${humanizeScore(context.avgEnergia, 'energy')}
- Check-ins realizados: ${context.totalCheckins}
- Dia de pico de humor: ${context.peakHumorDay || 'não identificado'}
- Dia de menor energia: ${context.lowEnergyDay || 'não identificado'}

Gere:
1. "insight": 2 frases que mostrem o padrão mais importante da semana sem soar genérico.
2. "action": 1 ação concreta e preventiva para a próxima semana.
3. "category": energia|humor|rotina|autocuidado.
4. "actionTitle": título curto, específico e acionável.

REGRAS:
- Leia padrão e implicação prática; não faça só resumo bonito.
- Soe como quem conhece o histórico e consegue antecipar necessidade.
- Evite autoajuda vazia, clichê e elogio sem utilidade.
- A ação precisa ser pequena, estratégica e claramente derivada do padrão.

Retorne SOMENTE JSON: {"insight":"2 frases personalizadas e úteis sobre o padrão identificado","action":"1 ação concreta e preventiva para a próxima semana","category":"energia|humor|rotina|autocuidado","actionTitle":"título curto da ação (máx 40 chars)"}. Sem texto fora do JSON.`;
      } else if (type === 'stability-analysis') {
        const history = (context.history || []) as Array<{date:string;humor:number;energia:number;sono?:number;fisico?:number;social?:number}>;
        const goals = (context.goals as string[] | undefined) || [];
        const pendingTasks = (context.pendingTasks as string[] | undefined) || [];
        const pendingTaskTitles = (context.pendingTaskTitles as string[] | undefined) || [];
        const pendingHabitTitles = (context.pendingHabitTitles as string[] | undefined) || [];
        const todayAnchorTitles = (context.todayAnchorTitles as string[] | undefined) || [];
        const completedTaskTitles = (context.completedTaskTitles as string[] | undefined) || [];
        const completedHabitTitles = (context.completedHabitTitles as string[] | undefined) || [];
        const completedGoalTitles = (context.completedGoalTitles as string[] | undefined) || [];
        const completedSubgoalTitles = (context.completedSubgoalTitles as string[] | undefined) || [];
        const blockedActionTitles = (context.blockedActionTitles as string[] | undefined) || [];
        const homeAutonomyFeedback = Array.isArray(context.homeAutonomyFeedback)
          ? (context.homeAutonomyFeedback as unknown[])
              .filter((item): item is { title?: unknown; status?: unknown } => !!item && typeof item === 'object')
              .map((item) => {
                const title = typeof item.title === 'string' ? item.title.trim() : '';
                const status = typeof item.status === 'string' ? item.status.trim() : 'blocked';
                return title ? `${title} (${status})` : '';
              })
              .filter(Boolean)
          : [];
        const historyLines = history.map((h: any) =>
          `- ${h.date}: ${humanizeScore(h.humor, 'mood')}, energia ${humanizeScore(h.energia, 'energy')}${h.sono != null ? `, sono ${humanizeScore(h.sono, 'sleep')}` : ''}${h.fisico != null ? `, físico ${humanizeScore(h.fisico, 'generic')}` : ''}${h.social != null ? `, social ${humanizeScore(h.social, 'generic')}` : ''}`
        ).join('\n');
        const humorVals = history.map((h: any) => h.humor);
        const avgH = humorVals.reduce((a: number, b: number) => a + b, 0) / humorVals.length;
        const variance = humorVals.reduce((a: number, b: number) => a + Math.pow(b - avgH, 2), 0) / humorVals.length;
        prompt = `Analise os dados dos últimos ${history.length} dias de ${userName} como uma assistente pessoal autônoma especializada em ciclagem de humor.

${historyLines}

CONTEXTO VIVO DO USUÁRIO:
${context.moodCycleContext || 'Sem contexto adicional.'}
${goals.length ? `\nMetas ativas: ${goals.join(' | ')}` : ''}
${pendingTasks.length ? `\nCompromissos pendentes: ${pendingTasks.join(' | ')}` : ''}
${pendingTaskTitles.length ? `\nTarefas pendentes hoje: ${pendingTaskTitles.join(' | ')}` : ''}
${pendingHabitTitles.length ? `\nHábitos pendentes hoje: ${pendingHabitTitles.join(' | ')}` : ''}
${todayAnchorTitles.length ? `\nÂncoras reais de hoje para ações: ${todayAnchorTitles.join(' | ')}` : ''}
${completedTaskTitles.length ? `\nAgenda já concluída: ${completedTaskTitles.join(' | ')}` : ''}
${completedHabitTitles.length ? `\nHábitos já feitos hoje: ${completedHabitTitles.join(' | ')}` : ''}
${completedGoalTitles.length ? `\nMetas já concluídas: ${completedGoalTitles.join(' | ')}` : ''}
${completedSubgoalTitles.length ? `\nSubtarefas de metas já feitas: ${completedSubgoalTitles.join(' | ')}` : ''}
${blockedActionTitles.length ? `\nNão sugerir novamente: ${blockedActionTitles.join(' | ')}` : ''}
${homeAutonomyFeedback.length ? `\nFeedback recente do card Análise e Autonomia: ${homeAutonomyFeedback.join(' | ')}` : ''}
${context.groundingContext || ''}

Variância de humor: ${variance.toFixed(2)} (>1.5 = alta labilidade afetiva).

Com base em IPSRT, DBT e ritmo social, retorne:
1. Score de estabilidade 0-100.
2. Tendência atual (stable/rising/falling/alert).
3. "pattern": 2 frases mostrando o que está se repetindo de verdade.
4. "insight": 1 frase curta que traduza o risco ou oportunidade do momento.
5. 2-3 sugestões baseadas em evidência, preventivas e práticas. Elas podem ser micro-ações, uma tarefa objetiva ou um compromisso concreto para hoje.

REGRAS:
- LEITURA TOTAL: cruze histórico de humor, humor atual, RAG/memória, planner, metas, hábitos e ações recentes antes de sugerir.
- Não descreva só o óbvio; identifique implicação prática.
- Soe como quem monitora e antecipa, não como quem espera nova crise para reagir.
- As sugestões devem nascer dos sinais reais do histórico, não de conselhos genéricos.
- Use histórico, memória e ciclo para o "pattern" e o "insight"; para "actions", use apenas agenda pendente, hábitos pendentes hoje, metas ativas ou âncoras reais de hoje.
- Se não houver âncora real de hoje para uma ação, retorne menos ações ou "actions": [].
- Não use tema recorrente, memória antiga ou fase de humor para inventar tarefa que não existe hoje.
- Só sugira treino, exercício, ginástica, academia, roupa de treino ou kit de treino se isso aparecer explicitamente em compromissos pendentes, tarefas pendentes hoje, hábitos pendentes hoje ou âncoras reais de hoje.
- Não sugira o que já aparece como concluído em agenda, hábitos, metas ou subtarefas.
- Não transforme coisa concluída em próxima ação. Use concluídos apenas como evidência no "pattern" ou "insight".
- Não ressuscite ação que a pessoa marcou como feita, pulou, excluiu ou agendou pelo card.
- Misture quando fizer sentido: micro-ação regulatória, tarefa prática curta e compromisso simples/agendável.
- As sugestões devem reduzir atrito, estabilizar rotina, proteger energia ou conter impulsividade.
- Prefira intervenções concretas de regulação: proteger sono, reduzir carga social, fracionar tarefa, cortar estímulo, ancorar rotina, criar pausa antes de agir no automático.
- Só use corpo/respiração/água/alongamento se houver evidência explícita e atual de corpo, sede, tensão física ou sono. Do contrário, prefira ação ligada à vida real trazida no contexto.
- Se a única sugestão possível for genérica, retorne "actions": [].
- Se houver âncora real, tente entregar próximo passo, compromisso, tarefa, hábito ou ajuste de agenda aplicável.
- Se houver sinal de queda sustentada, impulsividade, compulsão, isolamento ou sobrecarga, nomeie isso no "pattern" ou no "insight" sem dramatizar.
- Cada "why" deve explicar qual risco ou padrão a ação está tentando conter.
- Redação dos títulos (obrigatório): estrutura = [verbo no imperativo] + [objeto concreto do dia desta usuária] + [escopo limitado: tempo OU quantidade OU critério de parada]. O título deve fazer sentido lido sozinho, sem conhecer o contexto. Tamanho ideal: 8 a 14 palavras.
- Exemplos BONS — use como modelo de estrutura, adapte ao contexto real da usuária, não copie literalmente:
  • "Responda o e-mail da Julia — só esse, antes do almoço." (trabalho + âncora específica + limite temporal)
  • "Faça os 15 minutos de caminhada antes das 18h — não precisa de roupa de treino." (hábito + remoção de atrito + horário)
  • "Monte os 3 primeiros slides da apresentação — pare quando tiver título e estrutura de cada um." (meta + parcial + critério de parada claro)
- Exemplos RUINS — nunca use esses padrões:
  • "Definir prioridades" — sem objeto concreto nem limite.
  • "Fecha uma caixa por 20 min" — telegráfico, sem artigo, sem contexto.
  • "Continuar no projeto" — sem começo definido nem limite de parada.
  • "Organizar a agenda" — genérico, vago, sem âncora real.
- Proibido: iniciar com verbo conjugado em 3ª pessoa ("fecha", "abre", "envia" — use imperativo: "Feche", "Abra", "Envie"). Proibido: "só..." como início de frase, fragmento sem sujeito implícito, porcentagem solta ("100%"), frase sem verbo.
- Evite linguagem clínica pesada, mas mantenha raciocínio técnico por trás.

Retorne SOMENTE JSON: {"stabilityScore":número,"state":"stable|rising|falling|alert","pattern":"2 frases úteis sobre o padrão","insight":"1 frase personalizada e empática","actions":[{"title":"[imperativo] [objeto concreto do dia] [limite: tempo, qtd ou critério de parada]","category":"trabalho|social|autocuidado|rotina|foco|pessoal","why":"razão breve"}]}. Sem texto fora do JSON.`;
      } else if (type === 'ai-goals') {
        const mood = context.mood || 'equilibrada';
        const existing = (context.existingGoals || []).join(', ') || 'nenhuma ainda';
        prompt = `${userName} quer novas metas. Estado atual: "${mood}". Metas já existentes: ${existing}.

Gere 3 metas com cara de resultado real, não slogan.

REGRAS:
- Misture vida prática, autocuidado e avanço pessoal ou profissional.
- Cada meta deve soar concluível em dias ou poucas semanas.
- Evite qualquer meta genérica como "ser mais organizada", "ter foco" ou "cuidar de mim".
- Prefira resultados observáveis como "Montar rotina de sono para dormir antes de 23h" ou "Fechar portfólio com 3 projetos publicados".
- Não repita metas muito parecidas entre si nem copie metas já existentes.

Retorne SOMENTE um array JSON de strings: ["Meta específica 1", "Meta 2", "Meta 3"]. Sem explicação.`;
      } else if (type === 'home-messages') {
        const moodLabel = context.moodLabel || 'Em Equilíbrio';
        const moodKey = context.mood || 'equilibrada';
        const taskCount = context.taskCount ?? 0;
        const pendingTaskTitles = (context.pendingTaskTitles as string[] | undefined) || [];
        const goals = (context.goals as string[] | undefined) || [];
        const previousAutocuidado = (context.previousAutocuidado as string[] | undefined) || [];
        const previousMotivacional = typeof context.previousMotivacional === 'string' ? context.previousMotivacional : '';
        const hour = context.hour ?? new Date().getHours();
        const periodo = context.partOfDay || (hour < 12 ? 'manhã' : hour < 18 ? 'tarde' : 'noite');
        const weekday = context.weekday || 'hoje';
        const localDate = context.localDate ? ` (${context.localDate})` : '';
        const EMOTION_LABELS: Record<string, string> = {
          radiant: 'Radiante', calm: 'Calma', happy: 'Feliz', anxious: 'Ansiosa',
          tired: 'Cansada', focused: 'Focada', sad: 'Triste', angry: 'Irritada',
          stressed: 'Estressada', sensitive: 'Sensível', exhausted: 'Exausta', agitated: 'Agitada',
        };
        const FACTOR_LABELS: Record<string, string> = {
          good_sleep: 'Sono bom', exercise: 'Exercício', healthy_meal: 'Alimentação saudável',
          fresh_air: 'Ar fresco', good_talk: 'Boa conversa', kind_words: 'Palavras gentis',
          support: 'Apoio recebido', small_win: 'Pequena vitória', finished_task: 'Tarefa concluída',
          feeling_valued: 'Me senti valorizada', music: 'Música', time_outside: 'Tempo ao ar livre',
          hobby: 'Hobby', self_trust: 'Confiança em mim', rest: 'Descanso',
          stuck: 'Travada/o', relationship_conflict: 'Briga no relacionamento',
          overwhelmed: 'Sobrecarga mental', loneliness: 'Solidão', bad_sleep: 'Sono ruim',
          work_pressure: 'Pressão no trabalho', financial_stress: 'Estresse financeiro', bad_news: 'Má notícia',
        };
        const emotions = (context.emotions as string[] | undefined) || [];
        const factors = (context.factors as string[] | undefined) || [];
        const currentEnergy = Number.isFinite(Number(context.energia)) ? Number(context.energia) : null;
        const checkinHumor = Number.isFinite(Number(context.checkinHumor)) ? Number(context.checkinHumor) : null;
        const checkinEnergy = Number.isFinite(Number(context.checkinEnergy)) ? Number(context.checkinEnergy) : currentEnergy;
        const sleepScore = Number.isFinite(Number(context.sleepScore)) ? Number(context.sleepScore) : null;
        const bodyScore = Number.isFinite(Number(context.bodyScore)) ? Number(context.bodyScore) : null;
        const checkinNote = typeof context.note === 'string' ? context.note.trim() : '';
        const emotionsCtx = emotions.length > 0
          ? `- Emoções do check-in atual: ${emotions.map((id) => EMOTION_LABELS[id] ?? id).join(', ')}`
          : '';
        const factorsCtx = factors.length > 0
          ? `- Fatores do check-in atual: ${factors.map((id) => FACTOR_LABELS[id] ?? id).join(', ')}`
          : '';
        const checkinScoresCtx = checkinHumor != null || checkinEnergy != null || sleepScore != null || bodyScore != null
          ? `- Check-in atual em números: ${[
              checkinHumor != null ? `humor ${checkinHumor}/10` : null,
              checkinEnergy != null ? `energia ${checkinEnergy}/10` : null,
              sleepScore != null ? `sono ${sleepScore}/10` : null,
              bodyScore != null ? `corpo ${bodyScore}/10` : null,
            ].filter(Boolean).join(', ')}`
          : '';
        prompt = `${userName} está abrindo a home agora.

SINAIS DO MOMENTO:
- Estado percebido: "${moodLabel}" (${moodKey})
- Período do dia: ${periodo}
- Dia: ${weekday}${localDate}
- Tarefas ativas hoje: ${taskCount}
${pendingTaskTitles.length ? `- Pendências abertas: ${pendingTaskTitles.join(' | ')}` : ''}
${goals.length ? `- Metas ativas: ${goals.join(' | ')}` : ''}
${checkinScoresCtx}
${emotionsCtx}
${factorsCtx}
${checkinNote ? `- Nota escrita no check-in: ${checkinNote}` : ''}
${previousMotivacional ? `- Última mensagem recente para NÃO reciclar: ${previousMotivacional}` : ''}
${previousAutocuidado.length ? `- Micro-ações recentes para NÃO repetir: ${previousAutocuidado.join(' | ')}` : ''}
${context.moodCycleContext ? `- Contexto vivo recente: ${context.moodCycleContext}` : ''}
${context.groundingContext || ''}
${ragContext}

Gere uma presença de home que pareça real, não texto de chatbot.

OBJETIVO:
1. "motivacional": 1-2 frases curtas que mostrem leitura do momento + direção suave. Não use clichês como "você consegue", "vá com calma" ou "um passo de cada vez" sem contexto.
2. "autocuidado": 1 ação principal, concreta e situada no momento atual. Ela deve seguir o PLANO OPERACIONAL DA AIRIA quando existir. Use frase natural de português brasileiro, com verbo claro + objeto + duração/limite quando fizer sentido.
3. "proactive": 1 ação para fazer AGORA dentro do app. "title" com 2-5 palavras. "desc" com 1 frase dizendo por que isso faz sentido neste momento. "actionPath" deve ser uma rota real ou null.

REGRAS:
- LEITURA TOTAL: cruze estado atual, período, emoções/fatores, histórico de humor, RAG/memória, pendências, metas e ações recentes.
- Não repita literalmente o estado na primeira frase.
- Use o nome no máximo uma vez.
- Se o estado indicar proteção ou baixa energia, reduza atrito e puxe para cuidado ou clareza.
- Se houver energia boa e poucas tarefas, puxe para movimento e ação.
- Se houver sinais recorrentes no diário ou na memória recente, aproveite isso com discrição para deixar as ações mais pessoais.
- Se houver pendências abertas ou metas ativas, conecte pelo menos 1 movimento a algo real que já exista no app.
- CRÍTICO: Se a ação mencionar uma tarefa, SEMPRE use o título exato da lista de pendências. Nunca escreva "a próxima tarefa", "uma tarefa", "sua tarefa" — escreva o nome real. Ex: se a pendência é "Revisar proposta", escreva "Revisar proposta" no autocuidado.
- Autocuidado aqui significa reduzir atrito, proteger energia ou apoiar a execução real. Não invente objetos, sujeira, café, luvas, pano, limpeza ou abas se isso não apareceu literalmente no check-in, agenda, meta ou memória.
- Se a âncora for mudança/caixas/organização, transforme em limite claro de execução: qual caixa, por quanto tempo, quando parar. Não sugira limpar superfície, mexer em poeira ou separar luvas.
- Se a âncora for ansiedade, a ação deve diminuir decisão aberta: escolher uma frente, limitar tempo, fechar um bloco ou escrever a próxima decisão.
- Se a âncora for baixa energia, reduza escopo antes de sugerir avanço.
- "proactive" deve tentar entregar ação concreta dentro do app quando houver âncora real; se não houver, use actionPath null e faça uma pergunta curta na descrição.
- "autocuidado" não é lista solta: retorne só o próximo movimento principal. Não complete array com cuidados decorativos.
- Não use escrever, anotar ou registrar fora do Diário, mensagem pronta ou pedido explícito da usuária.
- Redação das ações: escreva como instrução aplicável, não como fragmento. Bom: "🧼 Lave bem as mãos por 20 segundos." Bom: "🕯️ Escute um som baixo por 15 minutos sem aumentar o volume."
- Evite construção esquisita com dois verbos grudados, como "continue sem alternar", "separe uma categoria: só...", "definir o próximo limite".
- Não use "20s", "30s" ou abreviações quando o texto for exibido para usuária. Use "20 segundos", "30 segundos", "15 minutos".
- Se existir conteúdo recente acima, mude de verdade: não repita nem parafraseie a mesma frase, o mesmo gesto ou a mesma micro-ação.
- Evite frases que sirvam igual para qualquer pessoa em qualquer horário.
- Nada aqui pode servir igual para qualquer pessoa em qualquer horário.

JSON APENAS (sem markdown): {"motivacional":"...","autocuidado":["ação principal"],"proactive":{"emoji":"🎯","title":"...","desc":"...","actionPath":"rota da app ou null (ex: /checkin, /goals, /planner, /insights, /journal)"}}`;
      } else if (type === 'agenda-blocks') {
        const mood = context.mood || 'equilibrada';
        const moodLabel = context.moodLabel || 'Em Equilíbrio';
        const energia = context.energia ?? 3;
        const goals = (context.goals as string[] | undefined) || [];
        const pendingTaskTitles = (context.pendingTaskTitles as string[] | undefined) || [];
        const previousAgendaLabels = (context.previousAgendaLabels as string[] | undefined) || [];
        const previousAgendaTasks = (context.previousAgendaTasks as string[] | undefined) || [];
        const previousAutocuidado = (context.previousAutocuidado as string[] | undefined) || [];
        const requestedLocalDate = typeof context.localDate === 'string'
          ? context.localDate
          : new Date().toISOString().slice(0, 10);
        const requestHour = Number.isFinite(Number(context.hour)) ? Number(context.hour) : new Date().getHours();
        const targetAgendaDate = PlannerService.resolveSuggestedAgendaDate(requestedLocalDate, requestHour);
        const targetDayStart = new Date(`${targetAgendaDate}T00:00:00.000Z`);
        const targetDayEnd = new Date(`${targetAgendaDate}T23:59:59.999Z`);
        const existingAgendaBlocks = await prisma.timelineBlock.findMany({
          where: { userId, localDate: { gte: targetDayStart, lte: targetDayEnd } },
          select: { title: true, startAt: true, endAt: true },
        });
        const formatAgendaTime = (date: Date) => {
          const hours = date.getUTCHours().toString().padStart(2, '0');
          const minutes = date.getUTCMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        };
        const existingAgendaBusyWindows = existingAgendaBlocks.map((block) => ({
          title: block.title,
          startTime: formatAgendaTime(block.startAt),
          endTime: formatAgendaTime(block.endAt),
        }));
        context = {
          ...context,
          targetAgendaDate,
          existingAgendaBusyWindows,
        };
        const history = (context.history || []).slice(0, 3).map((h: any) =>
          `${h.date}: ${humanizeScore(h.humor, 'mood')}, energia ${humanizeScore(h.energia, 'energy')}`
        ).join('; ');
        const existingBusyText = existingAgendaBusyWindows.length
          ? `Horários já ocupados em ${targetAgendaDate}: ${existingAgendaBusyWindows.map((block) => `${block.startTime}-${block.endTime} ${block.title}`).join(' | ')}.`
          : `Sem blocos salvos em ${targetAgendaDate}.`;
        prompt = `Você é a Airia, assistente de rotina de ${userName}. Sugira apenas complementos opcionais para a Agenda do dia.

Estado atual: ${moodLabel} (${mood}), energia ${humanizeScore(energia, 'energy')}.
Data alvo das sugestões: ${targetAgendaDate}. ${requestHour >= 18 ? 'Como o pedido veio após 18:00, as sugestões devem ser para amanhã.' : 'As sugestões podem ser para hoje.'}
Padrão recente: ${history || 'iniciando agora'}.
${context.moodCycleContext ? `Contexto vivo recente: ${context.moodCycleContext}.` : ''}
${goals.length ? `Metas ativas: ${goals.join(' | ')}.` : ''}
${pendingTaskTitles.length ? `Pendências já abertas no planner: ${pendingTaskTitles.join(' | ')}.` : ''}
${existingBusyText}
${previousAgendaLabels.length ? `Blocos recentes para NÃO reciclar: ${previousAgendaLabels.join(' | ')}.` : ''}
${previousAgendaTasks.length ? `Tarefas recentes para NÃO repetir: ${previousAgendaTasks.join(' | ')}.` : ''}
${previousAutocuidado.length ? `Micro-ações recentes da home: ${previousAutocuidado.join(' | ')}.` : ''}
${context.requestVariant ? `Tentativa atual de geração: ${context.requestVariant}. Se for maior que 1, trate como "refazer" e entregue uma alternativa materialmente diferente.` : ''}
${context.groundingContext || ''}${ragContext}${recentSuggestionMemory}

Monte complementos, não uma rotina inteira:
- Faça leitura total antes de montar blocos: estado atual, histórico de humor, RAG/memória, agenda existente, metas, pendências e ações recentes.
- Crie 1-4 blocos opcionais, somente se acrescentarem algo útil ao que já existe
- Tipos: trabalho, autocuidado, casa, social, descanso, refeicao, flexivel
- Não cubra o dia inteiro
- Não recrie compromissos já abertos no planner
- Inclua no máximo 1 tarefa por bloco, salvo se forem micro-passos inseparáveis
- Se energia baixa/tensa → mais autocuidado e descanso, menos trabalho
- Se focada → trabalho no pico da manhã (8h-12h)
- Tarefas concretas e específicas, sem repetir títulos entre blocos
- Se já houver pendências abertas ou metas ativas, complemente ou destrave isso; não replique com frases genéricas
- Se não houver âncora real suficiente, retorne [] em vez de criar rotina genérica.
- "tarefas_sugeridas" não pode repetir a mesma ação nem a mesma ideia em blocos diferentes
- Se esta for uma nova tentativa, mude pelo menos 60% dos títulos e das tarefas em relação à tentativa anterior
- Não repita nem reescreva superficialmente itens das listas recentes acima
- Evite absolutamente: "organizar documentos", "planejar a semana", "fazer lista", "revisar prioridades", "alinhamento geral", "colocar a vida em ordem"
- Horários sugeridos pela IA devem ficar entre 08:00 e 20:00; o backend ainda vai validar e remanejar para horário livre.
- intensity deve representar o esforço: L leve, M medio, P pesado
- razao_ia: frase carinhosa de 1 linha explicando por que esse encaixe combina com o estado atual

Retorne SOMENTE array JSON:
[{"horario_inicio":"HH:MM","horario_fim":"HH:MM","tipo":"trabalho|autocuidado|casa|social|descanso|refeicao|flexivel","label":"Nome motivador do bloco","tarefas_sugeridas":["Tarefa específica"],"razao_ia":"Frase carinhosa de 1 linha","intensity":"L|M|P"}]
Sem texto fora do JSON.`;
      } else if (type === 'checkin-response') {
        const moodLabel = context.moodLabel || 'Equilíbrio';
        const nota = context.nota
          ? `NOTA ESCRITA DO CHECK-IN (SINAL PRIORITÁRIO): "${context.nota}". Use esta nota para interpretar a energia, o humor e a sugestão antes de inferir padrões pelos números. Se ela explicar doença, dor, ciclo, sono ruim ou outro contexto físico/situacional, diferencie capacidade baixa de piora emocional.`
          : '';
        const crStreak = typeof context.streak === 'number' ? context.streak : 0;
        const crHistory = (context.checkinHistory || []) as Array<{date:string;humor:number;energia:number}>;
        const crPreviousSuggestion = typeof context.previousSuggestion === 'string' ? context.previousSuggestion.trim() : '';
        const crHour = context.hour ?? new Date().getHours();
        const crPartOfDay = context.partOfDay || (crHour < 12 ? 'manhã' : crHour < 18 ? 'tarde' : 'noite');
        const crWeekday = context.weekday ? `Dia: ${context.weekday}.` : '';
        const crLocalDate = context.localDate ? `Data local: ${context.localDate}.` : '';
        const crHistoryLines = crHistory.slice(0, 5).map((h: any) =>
          `- ${h.date}: ${humanizeScore(h.humor, 'mood')}, energia ${humanizeScore(h.energia, 'energy')}`
        ).join('\n');
        const prevEntry = crHistory[1];
        const trend = prevEntry
          ? crHistory[0]?.humor > prevEntry.humor ? 'humor subindo em relação ao check-in anterior'
            : crHistory[0]?.humor < prevEntry.humor ? 'humor caindo em relação ao check-in anterior'
            : 'humor estável em relação ao check-in anterior'
          : '';
        const streakCtx = crStreak >= 3 ? `\nSequência atual: ${crStreak} dias consecutivos de check-in — ${userName} está mantendo o ritmo.` : '';
        prompt = `${userName} acabou de fazer um check-in. Estado agora: "${moodLabel}" (${context.mood}).
Período atual: ${crPartOfDay}. ${crWeekday} ${crLocalDate}
${trend ? `Tendência: ${trend}.` : ''}${streakCtx}
${crHistoryLines ? `\nHistórico recente:\n${crHistoryLines}` : ''}
${context.moodCycleContext ? `\nContexto vivo recente:\n${context.moodCycleContext}` : ''}
${crPreviousSuggestion ? `\nSugestão anterior para NÃO repetir: ${crPreviousSuggestion}` : ''}
${nota}${context.groundingContext || ''}${ragContext}${recentSuggestionMemory}

Responda como Airia, com leitura específica e útil para este momento.

REGRAS:
- Faça leitura total: check-in atual, nota, histórico de humor, RAG/memória, planner, metas, hábitos e sugestões recentes.
- "message" deve ter 2-3 frases curtas. A primeira precisa ler um padrão, contraste ou nuance do momento; não repita o rótulo do estado como eco.
- NÃO REPITA A NOTA DO USUÁRIO. Use-a apenas como contexto para sua análise.
- Se o histórico ajudar, cite o padrão real de forma natural (ex: "nos últimos dias..." ou "hoje veio mais baixo que ontem...").
- Se houver contexto vivo do diário ou da rotina, use pelo menos 1 detalhe concreto disso quando for relevante.
- Se houver NOTA ESCRITA DO CHECK-IN, ela tem prioridade sobre leitura genérica dos números; a sugestão deve responder diretamente à nuance da nota SEM parafraseá-la.
- Se streak ≥ 3 dias, mencione a sequência no máximo uma vez e só se encaixar organicamente.
- NÃO use frases genéricas de autoajuda nem conselhos óbvios como "o objetivo não é esforço extra".
- NÃO use sermão, diagnóstico ou tom maternal demais.
- "suggestion" deve ser uma micro-ação de 5-10 minutos que caiba nas próximas 2 horas.
- A sugestão deve ser específica o bastante para a pessoa começar sem precisar planejar mais nada.
- A sugestão deve virar próximo passo, tarefa, hábito, compromisso leve ou ajuste de agenda quando houver âncora real suficiente; se não houver, transforme "suggestion" em pergunta curta para localizar a âncora.
- Memória passada pode explicar o padrão, mas a sugestão operacional precisa respeitar o grounding de hoje.
- Não sugira tarefa/hábito já concluído hoje nem tarefa sem âncora real de agenda, hábito pendente ou meta ativa.
- Use o nome de forma natural, no máximo uma vez.

JSON APENAS: {"message":"2-3 frases acolhedoras e específicas sobre este momento","suggestionEmoji":"emoji","suggestion":"micro-ação concreta para as próximas 2 horas"}`;
      } else if (type === 'goal-capture-dialogue') {
        const capture = String(context.capture || '').trim();
        const previousSummary = typeof context.previousSummary === 'string' ? context.previousSummary.trim() : '';
        const answer = typeof context.answer === 'string' ? context.answer.trim() : '';
        const goals = (context.goals as string[] | undefined) || [];
        const goalsCtx = goals.length ? `\n\nMetas atuais de ${userName}:\n${goals.map((g, i) => `${i + 1}. "${g}"`).join('\n')}` : '\n\nSem metas atuais cadastradas.';
        const conversationCtx = [
          previousSummary ? `Resumo da conversa ate agora: ${previousSummary}` : null,
          answer ? `Resposta nova de ${userName}: "${answer}"` : null,
        ].filter(Boolean).join('\n');

        prompt = `Use GTD como raciocinio interno para clarificar uma captura de ${userName}, sem citar o metodo na resposta visivel.

Captura inicial: "${capture}"
${conversationCtx ? `\n${conversationCtx}` : ''}${goalsCtx}

Objetivo: decidir se isso e uma meta/projeto, uma proxima acao, algo para inbox, referencia ou algum dia. Nao crie nada ainda; apenas conduza a clarificacao.

Se ainda estiver vago, retorne "needs_clarification" com UMA pergunta curta que ajude a sair da abstracao. No maximo 3 perguntas ao longo da conversa.
Se ja estiver claro, retorne "ready" com o tipo, titulo limpo e primeiras acoes quando for meta.

Regras:
- "goal": exige 2+ acoes para concluir ou representa um resultado/projeto.
- "next_action": uma acao fisica unica, clara e executavel agora.
- "inbox": ainda esta emocional/vago demais mesmo apos a pergunta atual.
- "reference": informacao util sem acao.
- "someday": desejo/possibilidade sem compromisso agora.
- Para "goal", gere 3-5 primeiras acoes fisicas, pequenas, em ordem, com a primeira facil em ate 2 minutos.
- Para "next_action", o titulo deve comecar com verbo fisico.
- Se a proxima acao apoiar uma meta existente, use o titulo exato em "linkedGoalTitle"; senao null.
- Nao use "planejar", "organizar melhor", "pensar", "refletir" como acao.
- Perguntas precisam ser praticas: resultado desejado, prazo, contexto, primeira prova fisica ou bloqueio.

JSON APENAS:
{
  "status": "needs_clarification" | "ready",
  "question": "pergunta curta se precisar clarificar, senao null",
  "summary": "resumo operacional em uma frase",
  "kind": "goal" | "next_action" | "inbox" | "reference" | "someday",
  "title": "titulo limpo e acionavel",
  "firstActions": ["acao 1", "acao 2", "acao 3"],
  "linkedGoalTitle": "titulo exato de meta existente ou null"
}`;
      } else if (type === 'gtd-clarify') {
        const item = context.item || '';
        const goals = (context.goals as string[] | undefined) || [];
        const goalsCtx = goals.length ? `\n\nMetas atuais de ${userName}: ${goals.map((g, i) => `${i + 1}. "${g}"`).join(', ')}` : '';
        prompt = `Aplique o método GTD ao item capturado por ${userName}: "${item}"${goalsCtx}

Responda com JSON apenas:
{
  "tipo": "proxima_acao" | "projeto" | "aguardando" | "referencia" | "algum_dia" | "deletar",
  "titulo": "título claro e acionável (máx 60 chars)",
  "proxima_acao": "próximo passo físico e concreto se tipo=proxima_acao ou projeto (null caso contrário)",
  "categoria": "trabalho" | "saude" | "rotina" | "social",
  "tempo_estimado": "15min" | "30min" | "1h" | "2h+",
  "razao": "1 frase curta explicando a classificação",
  "meta_sugerida": "título exato de uma das metas listadas se este item apoia uma delas, senão null"
}

Regras GTD:
- proxima_acao: requer 1 ação física, pode ser feita agora
- projeto: requer 2+ ações para concluir → vira meta automaticamente
- aguardando: depende de outra pessoa ou evento
- referencia: informação útil, sem ação necessária
- algum_dia: seria bom fazer, sem comprometimento agora
- deletar: irrelevante ou já resolvido
- Nunca marque como proxima_acao se o texto ainda depender de decidir, pesquisar amplamente, organizar ou "pensar melhor".
- Se "proxima_acao" ou "projeto" forem escolhidos, "proxima_acao" deve começar com verbo físico e concreto.
- "titulo" deve ficar limpo, curto e acionável; sem floreio.
- "razao" deve ser breve e específica, não genérica.

Sem texto fora do JSON.`;
      } else if (type === 'goal-route') {
        const capture = context.capture || '';
        const goals = (context.goals as string[] | undefined) || [];
        const goalsCtx = goals.length ? `Metas atuais: ${goals.map((g, i) => `${i + 1}. "${g}"`).join(', ')}` : 'Sem metas ainda.';
        prompt = `${userName} capturou: "${capture}"

${goalsCtx}

Classifique esta captura e responda com JSON:
{
  "tipo": "meta" | "proxima_acao" | "inbox",
  "titulo": "versão limpa e acionável do texto (máx 60 chars)",
  "meta_sugerida": "título exato de uma das metas se este item apoia uma delas, senão null",
  "emoji": "emoji representativo"
}

Regras de classificação:
- "meta": qualquer coisa que exige 2+ ações para concluir (ex: "ir à praia", "aprender inglês", "organizar o quarto", "fazer exercício") — se tem sub-etapas, é meta
- "proxima_acao": 1 ação física ÚNICA e imediata, ligada a uma meta já existente (ex: "mandar email para Maria", "comprar protetor solar")
- "inbox": texto vago, emoção, ideia sem contexto claro
- Nunca use "proxima_acao" se o texto ainda estiver abstrato, emocional, amplo ou dependente de decisão.
- Se escolher "meta", "titulo" deve soar como resultado ou projeto claro, não frase solta.
- Se escolher "proxima_acao", "titulo" deve começar com verbo físico.
- Na dúvida entre "meta" e "proxima_acao": escolha SEMPRE "meta" — melhor quebrar em subtarefas do que deixar como ação vaga.

Sem texto fora do JSON.`;
      } else if (type === 'phase-transition') {
        const { fromPhase, toPhase, fromLabel, toLabel } = context as any;
        prompt = `Você é a Airia, assistente pessoal autônoma de ${userName}, especializada em ciclagem de humor.

A fase de humor de ${userName} acabou de mudar: de "${fromLabel}" (${fromPhase}) → "${toLabel}" (${toPhase}).

Estado atual do ciclo: ${moodCycleContext || 'sem dados adicionais'}.

Reaja a essa transição de fase:
1. "message": 2-3 frases sobre ESTA transição, mostrando que você percebeu a mudança e já está recalibrando a rota.
2. "tip": 1 ação concreta e preventiva para as próximas horas adaptada a esta nova fase.

REGRAS:
- Não descreva a transição como evento abstrato; trate como mudança operacional real na forma de conduzir o dia.
- Soe proativa: você viu a mudança e já está orientando o próximo ajuste.
- Não use tom dramático nem genérico.
- A tip deve ajudar a proteger estabilidade, aproveitar janela boa ou reduzir dano, conforme a fase.

JSON APENAS: {"message":"...","tip":"..."}`;
      } else if (type === 'follow-up') {
        const { suggestionTitle, suggestionCategory } = context as any;
        prompt = `Você é a Airia, assistente pessoal autônoma de ${userName}.

Algumas horas atrás, você sugeriu para ${userName}: "${suggestionTitle}" (categoria: ${suggestionCategory}).

Estado atual: ${moodCycleContext || 'sem dados'}.

Escreva uma mensagem curta de acompanhamento que mostre memória, iniciativa e baixa pressão.

REGRAS:
- Soe como quem acompanha o processo de verdade, não como lembrete automático.
- Pode perguntar como foi, mas com suavidade e utilidade.
- Se fizer sentido, ofereça uma bifurcação simples: continuar, reduzir, adiar ou ajustar.
- 1-2 frases apenas. Sem cobrança, sem culpa, sem discurso motivacional vazio.

JSON APENAS: {"message":"..."}`;
      } else if (type === 'monthly-report') {
        const period = context.period ?? '30d';
        const periodLabel = period === '7d' ? 'últimos 7 dias' : period === '30d' ? 'últimos 30 dias' : 'últimos 90 dias';
        prompt = `Você é a Airia, assistente de bem-estar de ${userName}. Gere um relatório pessoal de saúde mental dos ${periodLabel}.

DADOS DO PERÍODO:
- Check-ins registrados: ${context.totalCheckins ?? '—'}
- Humor médio: ${context.avgHumor ?? '—'}/10
- Energia média: ${context.avgEnergy ?? '—'}/10
- Fase atual: ${context.phaseLabel ?? context.phase ?? '—'}
- Score de estabilidade: ${context.stabilityScore ?? '—'}/100
- Alertas: ${(context.warningFlags as string[] | undefined)?.join(', ') || 'nenhum'}
- Contexto do ciclo: ${context.moodCycleContext ?? ''}

INSTRUÇÕES:
- Tom: acolhedor, honesto, como uma amiga que acompanha de verdade.
- Máximo 4 parágrafos curtos.
- Estrutura: 1) O que o período mostrou, 2) Padrões ou tendências, 3) Uma conquista ou ponto de atenção, 4) Uma sugestão concreta para o próximo período.
- Sem jargões clínicos. Sem excesso de emojis (max 3 no total).
- Responda em português, direto ao ponto.`;
      } else if (type === 'habit-recommendation') {
        const hour = new Date().getHours();
        const timeOfDay = hour < 12 ? 'manhã' : hour < 18 ? 'tarde' : 'noite';
        const suggestions = await AIService.generateHabitSuggestions({
          userName,
          profileSummary: userProfileSummary,
          moodCycleContext,
          recentSuggestionMemory,
          currentMoodLabel: String(context.moodLabel || ''),
          timeOfDay,
          currentHour: typeof (req.body as any)?.currentHour === 'number' ? (req.body as any).currentHour : undefined,
          currentMinute: typeof (req.body as any)?.currentMinute === 'number' ? (req.body as any).currentMinute : undefined,
          priorDiagnoses,
        });
        SuggestionMemoryService.append(
          prisma,
          userId,
          'habit-recommendation',
          SuggestionMemoryService.extractTextsFromSuggestion(type, suggestions),
        ).catch(() => {});
        return res.json({ suggestion: suggestions });
      } else {
        return res.status(400).json({ error: 'Unknown suggestion type' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const generationConfig = resolveSuggestGenerationConfig(type, plainTextTypes.has(type));
      const completion = await openai.chat.completions.create({
        model: getOpenAiModel(),
        messages: [
          {
            role: 'system' as const,
            content: buildAuraSystemPrompt({
              userName,
              profileSummary: userProfileSummary,
              moodCycleContext,
              longTermMemory,
              contextualMemory: ragContext,
              activeGoalsContext,
              recentSuggestionMemory,
              reasoningTraceContext: context.reasoningTraceContext,
              priorDiagnoses,
              domain: getSuggestPromptDomain(type),
              ...extractAdaptiveFromRequest(req.body),
            }),
          },
          { role: 'user' as const, content: prompt },
        ],
        max_completion_tokens: getOpenAiMaxCompletionTokens(generationConfig.maxTokens),
        ...openAiTemperature(getOpenAiModel(), generationConfig.temperature),
        ...(generationConfig.useJsonResponse && usesJsonObjectResponse(type)
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      });
      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        console.warn(`[ai/suggest] type=${type} model=${process.env.OPENAI_MODEL} finish_reason=${choice?.finish_reason} refusal=${choice?.message?.refusal} content=${JSON.stringify(choice?.message?.content)}`);
      }
      const rawSuggestion = choice?.message?.content?.trim() || '';
      const normalizedSuggestion = plainTextTypes.has(type) ? rawSuggestion : normalizeAiSuggestion(type, rawSuggestion);
      const suggestion = sanitizeAiSuggestion(type, normalizedSuggestion, context);
      SuggestionMemoryService.append(
        prisma,
        userId,
        type,
        SuggestionMemoryService.extractTextsFromSuggestion(type, suggestion),
      ).catch(() => {});
      return res.json({ suggestion });
    } catch (error: any) {
      console.error('[ai/suggest] Error:', error);
      const fallback = getSuggestFallback(type);
      if (fallback) {
        return res.json({ suggestion: fallback });
      }
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'AI suggestion failed',
      });
    }
  });

  /**
   * POST /api/profile/auto-update
   * Atualiza automaticamente o aiProfileSummary com base nos padrões recentes (#5).
   */
  const ProfileAutoUpdateSchema = z.object({
    moodCycleContext: z.string().min(1),
    recentPatterns: z.object({
      avgMood7d: z.number(),
      avgEnergy7d: z.number(),
      phase: z.string(),
      warningFlags: z.array(z.string()),
      stabilityScore: z.number(),
      checkinCount: z.number(),
    }),
  });

  app.post('/api/profile/auto-update', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    let body: z.infer<typeof ProfileAutoUpdateSchema>;
    try {
      body = ProfileAutoUpdateSchema.parse(req.body);
    } catch {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
      const [profile, existingOnboarding] = await Promise.all([
        prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true } }).catch(() => null),
        prisma.onboardingResponse.findUnique({ where: { userId }, select: { aiProfileSummary: true } }).catch(() => null),
      ]);

      const firstName = getFirstName(profile?.fullName) ?? 'você';
      const existingSummary = existingOnboarding?.aiProfileSummary ?? '';

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const { recentPatterns, moodCycleContext } = body;
      const rp = recentPatterns as any;
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: buildAuraSystemPrompt({
              userName: firstName,
              profileSummary: existingSummary,
              moodCycleContext,
              domain: 'insight',
              extraInstructions: [
                'Atualize o perfil com base em padroes recorrentes, nao em um episodio isolado.',
              ],
            }),
          },
          {
            role: 'user',
            content: `Atualize o perfil de ${firstName} com base nos padrões observados ao longo do tempo.

PERFIL ATUAL:
${existingSummary || 'Nenhum perfil anterior.'}

DADOS ACUMULADOS (${recentPatterns.checkinCount} check-ins):
- Fase atual do ciclo de humor: ${recentPatterns.phase}
- Humor médio 7d: ${humanizeScore(recentPatterns.avgMood7d, 'mood')}
- Energia média 7d: ${humanizeScore(recentPatterns.avgEnergy7d, 'energy')}
- Alertas: ${recentPatterns.warningFlags.join(', ') || 'nenhum'}
${rp.bestDay ? `- Melhor dia da semana historicamente: ${rp.bestDay}` : ''}
${rp.worstDay ? `- Dia mais difícil historicamente: ${rp.worstDay}` : ''}
${rp.moodDistribution ? `- Distribuição total de humor: ${rp.moodDistribution}` : ''}
${rp.goalsStatus ? `- Status de metas: ${rp.goalsStatus}` : ''}
- Contexto atual: ${moodCycleContext}

Gere um perfil atualizado (4-6 frases) que:
1. Registre padrões estáveis identificados (dia melhor/pior, tendências)
2. Note o estado atual do ciclo de humor
3. Mencione padrões de metas se relevante
4. Mantenha contexto relevante do perfil anterior
Tom próximo, sem diagnósticos clínicos. Use o nome ${firstName}.

JSON APENAS: {"profileSummary":"..."}`,
          },
        ],
        model: getOpenAiModel(),
        response_format: { type: 'json_object' },
        max_completion_tokens: getOpenAiMaxCompletionTokens(1500),
        ...openAiTemperature(getOpenAiModel(), 0.4),
      } as any);

      const content = completion.choices[0]?.message?.content;
      if (!content) return res.status(500).json({ error: 'AI failed to generate profile' });

      const parsed = JSON.parse(content) as { profileSummary: string };
      if (!parsed.profileSummary) return res.status(500).json({ error: 'Invalid AI response' });

      await prisma.onboardingResponse.upsert({
        where: { userId },
        update: { aiProfileSummary: parsed.profileSummary },
        create: {
          userId,
          aiProfileSummary: parsed.profileSummary,
        },
      });

      return res.json({ updated: true, profileSummary: parsed.profileSummary });
    } catch (error: any) {
      console.error('[profile/auto-update] Error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * Google Calendar Integration
   * Requires env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL
   *
   * GET  /api/gcal/auth-url  → returns OAuth URL
   * GET  /api/gcal/callback  → handles OAuth callback, stores token
   * GET  /api/gcal/events    → returns upcoming events (requires connected account)
   * POST /api/gcal/disconnect → removes stored token
   */

  app.get('/api/gcal/auth-url', async (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(503).json({ error: 'Google Calendar not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env' });
    }

    // Identifica o host e protocolo real (considerando trust proxy)
    const host = req.get('host') || 'www.airia.pro';
    const protocol = (req.protocol === 'https' || !host.includes('localhost')) ? 'https' : 'http';
    const redirectUri = `${protocol}://${host}/api/gcal/callback`;
    
    // Scopes robustos para leitura e escrita
    const scopes = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${(req as AuthRequest).userId}`;
    
    return res.json({ url: authUrl, authUrl });
  });

  app.get('/api/gcal/callback', async (req: Request, res: Response) => {
    const { code, state: userId, error } = req.query as Record<string, string>;
    
    // Identifica o origin dinamicamente para evitar perda de sessão em subdomínios
    const host = req.get('host') || 'www.airia.pro';
    const protocol = (req.protocol === 'https' || !host.includes('localhost')) ? 'https' : 'http';
    
    // Se vier de api.airia.pro, removemos o 'api.' para chegar no front
    // Se vier de airia.pro ou www.airia.pro, o host é o próprio front
    let frontendHost = host;
    if (host.startsWith('api.')) {
      frontendHost = host.substring(4);
    }
    const currentOrigin = `${protocol}://${frontendHost}`;
    
    // Log SEMPRE — essencial para diagnosticar callback em produção
    console.log(`[GCal Callback] Received callback. Host: ${host}, Protocol: ${protocol}, FrontendHost: ${frontendHost}, Origin: ${currentOrigin}`);

    // Fallback para FRONTEND_URL se estiver definido, senão usa a origem calculada
    const frontendUrl = (process.env.FRONTEND_URL || currentOrigin).replace(/\/$/, '');
    
    if (error) {
      console.error('[GCal Callback] Google OAuth Error:', error);
      return res.redirect(`${frontendUrl}/preferences?gcal=error&reason=${encodeURIComponent(error as string)}`);
    }

    if (!code || !userId) {
      console.error('[GCal Callback] Missing code or userId (state):', { code: !!code, userId: !!userId });
      return res.redirect(`${frontendUrl}/preferences?gcal=error&reason=missing_code_or_state`);
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      
      // O redirectUri aqui deve ser IDENTICO ao usado na geracao da URL de auth
      const hostForRedirect = req.get('host') || 'airia.pro';
      const protocolForRedirect = (req.protocol === 'https' || !hostForRedirect.includes('localhost')) ? 'https' : 'http';
      const redirectUri = `${protocolForRedirect}://${hostForRedirect}/api/gcal/callback`;

      console.log(`[GCal Callback] Exchanging code for user: ${userId}`);
      
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 
          code: code as string, 
          client_id: clientId, 
          client_secret: clientSecret, 
          redirect_uri: redirectUri, 
          grant_type: 'authorization_code' 
        }).toString(),
      });
      
      const tokens = await tokenRes.json() as any;
      
      if (!tokenRes.ok) {
        console.error('[GCal Callback] Error exchanging code for tokens:', tokens);
        return res.redirect(`${frontendUrl}/preferences?gcal=error&reason=${encodeURIComponent(tokens.error_description || tokens.error || 'token_exchange_failed')}`);
      }

      if (!tokens.access_token) {
        console.error('[GCal Callback] No access token in response:', tokens);
        return res.redirect(`${frontendUrl}/preferences?gcal=error&reason=no_access_token`);
      }

      // Store tokens in user preferences
      console.log(`[GCal Callback] Successfully received tokens for userId: ${userId}. Refresh token present: ${!!tokens.refresh_token}`);
      
      // Upsert robusto: não subscreve refresh_token se Google não enviou um novo (comum em reconexões)
      const updateData: any = { gcalAccessToken: tokens.access_token };
      if (tokens.refresh_token) {
        updateData.gcalRefreshToken = tokens.refresh_token;
      }

      await prisma.userPreference.upsert({
        where: { userId },
        update: updateData,
        create: { 
          userId, 
          gcalAccessToken: tokens.access_token, 
          gcalRefreshToken: tokens.refresh_token || null 
        },
      });

      console.log(`[GCal Callback] Success. Redirecting to: ${frontendUrl}/preferences?gcal=connected`);
      return res.redirect(`${frontendUrl}/preferences?gcal=connected`);
    } catch (err: any) {
      console.error('[GCal Callback] Unexpected error during callback processing:', err);
      return res.redirect(`${frontendUrl}/preferences?gcal=error&reason=internal_server_error`);
    }
  });

  app.get('/api/gcal/events', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const requestedDate = req.query.date as string;
    try {
      let token = await GCalService.getValidToken(prisma, userId);
      if (!token) return res.json({ connected: false, events: [] });

      const pref = await prisma.userPreference.findUnique({
        where: { userId },
        select: { gcalSelectedCalendars: true, gcalRefreshToken: true }
      });

      let timeMin: Date = new Date(Date.now() - 24 * 3600_000);
      let timeMax: Date = new Date(Date.now() + 14 * 24 * 3600_000);
      if (requestedDate) {
        timeMin = new Date(`${requestedDate}T00:00:00Z`);
        timeMin.setHours(timeMin.getHours() - 14);
        timeMax = new Date(`${requestedDate}T23:59:59Z`);
        timeMax.setHours(timeMax.getHours() + 14);
      }

      const fetchEventsFromCalendar = async (t: string, calendarId: string) => {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin.toISOString())}&timeMax=${encodeURIComponent(timeMax.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=100`;
        return fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      };

      const fetchCalendarList = async (t: string) =>
        fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: { Authorization: `Bearer ${t}` },
        });

      const normalizeCalendarSummary = (value: unknown) =>
        String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase();

      const isMinhaAgendaCalendar = (calendar: any) =>
        normalizeCalendarSummary(calendar?.summaryOverride || calendar?.summary) === 'minha agenda';

      const isReadableCalendar = (calendar: any) => {
        const accessRole = String(calendar?.accessRole || '').trim();
        return accessRole !== 'none' && accessRole !== 'freeBusyReader';
      };

      const uniqueCalendarIds = (ids: string[]) => Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));

      const getCalendarSelectionDefaults = async (): Promise<{ defaultIds: string[]; requiredIds: string[] }> => {
        let listRes = await fetchCalendarList(token!);

        if (listRes.status === 401 && pref?.gcalRefreshToken) {
          const newToken = await GCalService.refreshAccessToken(prisma, userId, pref.gcalRefreshToken);
          if (newToken) {
            token = newToken;
            listRes = await fetchCalendarList(newToken);
          }
        }

        if (!listRes.ok) return { defaultIds: ['primary'], requiredIds: [] };

        const data = await listRes.json() as any;
        const readableCalendars = (data.items || []).filter(isReadableCalendar);
        const requiredIds = readableCalendars
          .filter(isMinhaAgendaCalendar)
          .map((calendar: any) => String(calendar.id || '').trim())
          .filter(Boolean);
        const defaultIds = readableCalendars
          .filter((calendar: any) => calendar?.selected !== false || calendar?.primary === true || isMinhaAgendaCalendar(calendar))
          .map((calendar: any) => String(calendar.id || '').trim())
          .filter(Boolean);

        return {
          defaultIds: defaultIds.length > 0 ? uniqueCalendarIds(defaultIds) : ['primary'],
          requiredIds: uniqueCalendarIds(requiredIds),
        };
      };

      const savedCalendarIds = Array.isArray(pref?.gcalSelectedCalendars)
        ? (pref?.gcalSelectedCalendars as unknown[]).map((id) => String(id).trim()).filter(Boolean)
        : [];
      const calendarSelectionDefaults = await getCalendarSelectionDefaults();
      const selectedCalendars = uniqueCalendarIds([
        ...(savedCalendarIds.length > 0 ? savedCalendarIds : calendarSelectionDefaults.defaultIds),
        ...calendarSelectionDefaults.requiredIds,
      ]);

      // Helper to attempt fetch, auto-refresh token on 401
      const fetchWithRetry = async (calendarId: string): Promise<any[]> => {
        let eventsRes = await fetchEventsFromCalendar(token!, calendarId);
        
        if (eventsRes.status === 401 && pref?.gcalRefreshToken) {
          const newToken = await GCalService.refreshAccessToken(prisma, userId, pref.gcalRefreshToken);
          if (newToken) {
            token = newToken;
            eventsRes = await fetchEventsFromCalendar(newToken, calendarId);
          }
        }

        if (!eventsRes.ok) return [];

        const data = await eventsRes.json() as any;
        return (data.items || []).map((e: any) => ({
          id: e.id,
          summary: e.summary ?? 'Evento',
          start: { dateTime: e.start?.dateTime, date: e.start?.date },
          end: e.end ? { dateTime: e.end?.dateTime, date: e.end?.date } : undefined,
          link: e.htmlLink,
          calendarId,
          color: e.colorId || undefined,
          note: e.description || '',
          airiaStatus: e.extendedProperties?.private?.airiaStatus === 'completed' ? 'completed' : 'planned',
        }));
      };

      // Fetch from all selected calendars in parallel
      const allEventsArrays = await Promise.all(
        selectedCalendars.map(calId => fetchWithRetry(calId))
      );

      // Deduplicate events by ID (in case the same calendar is selected via multiple aliases)
      const uniqueEventsMap = new Map();
      allEventsArrays.flat().forEach(e => {
        if (!uniqueEventsMap.has(e.id)) {
          uniqueEventsMap.set(e.id, e);
        }
      });

      const events = Array.from(uniqueEventsMap.values()).sort((a: any, b: any) => {
        const aTime = a.start?.dateTime || a.start?.date || '';
        const bTime = b.start?.dateTime || b.start?.date || '';
        return aTime.localeCompare(bTime);
      });

      return res.json({ connected: true, events });
    } catch (err) {
      console.error('[gcal/events]', err);
      return res.json({ connected: false, events: [] });
    }
  });

  /**
   * GET /api/gcal/calendars — list all calendars available in the user's Google account
   */
  app.get('/api/gcal/calendars', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      let token = await GCalService.getValidToken(prisma, userId);
      if (!token) return res.json({ connected: false, calendars: [] });

      const fetchCalendarList = async (t: string) =>
        fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: { Authorization: `Bearer ${t}` },
        });

      let listRes = await fetchCalendarList(token);

      if (listRes.status === 401) {
        const pref = await prisma.userPreference.findUnique({ where: { userId }, select: { gcalRefreshToken: true } });
        if (pref?.gcalRefreshToken) {
          const newToken = await GCalService.refreshAccessToken(prisma, userId, pref.gcalRefreshToken);
          if (newToken) {
            listRes = await fetchCalendarList(newToken);
          }
        }
      }

      if (!listRes.ok) return res.json({ connected: false, calendars: [] });

      const data = await listRes.json() as any;
      const normalizeCalendarSummary = (value: unknown) =>
        String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase();
      const isMinhaAgendaCalendar = (calendar: any) =>
        normalizeCalendarSummary(calendar?.summaryOverride || calendar?.summary) === 'minha agenda';
      const calendars = (data.items || []).map((c: any) => ({
        id: c.id,
        summary: c.summary || c.id,
        description: c.description || '',
        primary: c.primary === true,
        backgroundColor: c.backgroundColor || '#4285F4',
        selected: c.selected !== false,
        accessRole: c.accessRole || 'reader',
      }));

      // Also fetch user's saved selection
      const pref = await prisma.userPreference.findUnique({
        where: { userId },
        select: { gcalSelectedCalendars: true }
      });
      const savedSelectedIds = Array.isArray(pref?.gcalSelectedCalendars)
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

      return res.json({ connected: true, calendars, selectedIds });
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
    const { calendarIds } = req.body as { calendarIds: string[] };
    if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
      return res.status(400).json({ error: 'At least one calendar must be selected' });
    }
    try {
      await prisma.userPreference.upsert({
        where: { userId },
        update: { gcalSelectedCalendars: calendarIds } as any,
        create: { userId, gcalSelectedCalendars: calendarIds } as any,
      });
      return res.json({ ok: true, calendarIds });
    } catch (err) {
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
      data: { gcalAccessToken: null, gcalRefreshToken: null, gcalSelectedCalendars: [] } as any,
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

      return res.json(habit);
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

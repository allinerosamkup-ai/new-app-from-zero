import { randomUUID } from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import webpush from 'web-push';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import cron from 'node-cron';
import path from 'path';
import { PrismaClient } from '@app/database';
import { prisma as sharedPrisma } from './lib/prisma';
import { requireAuth, AuthRequest } from './middleware/auth';
import { AIService } from './services/ai.service';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { KnowledgeGraphBackfillService } from './services/knowledge-graph-backfill.service';
import { PlannerService, buildPostponeAdaptabilityUpdate, resolveTimelineAdaptability, resolveTimelineAdaptabilityProvenance, type TimelineBlockInput } from './services/planner.service';
import { InsightService } from './services/insight.service';
import { CheckinService } from './services/checkin.service';
import { CheckinApplicationService, PrismaCheckinApplicationRepository } from './services/checkin-application.service';
import { AiriaReadingService, type AiriaDecisionStatus } from './services/airia-reading.service';
import {
  CHECKIN_CANONICAL_EMOTIONS,
  CHECKIN_CANONICAL_FACTORS,
  CheckinUnderstandingService,
} from './services/checkin-understanding.service';
import { GCalService } from './services/gcal.service';
import { CheckinCreateSchema } from './contracts/checkin.contract';
import { PlannerSyncSchema, PlannerAISuggestionRequestSchema } from './contracts/planner.contract';
import { PlannerAIService } from './services/planner-ai.service';
import { LearningContextService } from './services/learning-context.service';
import { HabitCreateSchema, HabitPatchSchema } from './contracts/habit.contract';
import { JournalExternalMessageSchema, JournalMessageStreamSchema, JournalStartSchema } from './contracts/journal.contract';
import { EventLogCreateSchema } from './contracts/event-log.contract';
import { OnboardingProcessSchema, tracksMenstrualCycle, type BiologicalSex } from './contracts/onboarding.contract';
import {
  ProfessionalApplicationSchema,
  ProfessionalVerificationSchema,
  ReferralClaimSchema,
} from './contracts/professional-partner.contract';
import {
  CONSENT_TYPES,
  CURRENT_CONSENT_VERSION,
  revokeConsent,
  summarizeConsents,
} from './services/consent.service';
import { extractJournalSignals, stripJournalSignals } from './services/journal-signals.service';
import { findEquivalentActionWithLlm } from './services/action-equivalence.service';
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
import { CanonicalMemoryService, isDecisionEligiblePattern } from './services/canonical-memory.service';
import { AuraMemoryIngestionService, conservativeAuraExtractor } from './services/aura-memory-ingestion.service';
import { AgendaPatternRecognitionService } from './services/agenda-pattern-recognition.service';
import { ContextGroundingService } from './services/context-grounding.service';
import { ReasoningContextService } from './services/reasoning-context.service';
import { AiriaOperationalReasoningService, type AiriaActionPlan } from './services/airia-operational-reasoning.service';
import { buildCompletionReward, computeGoalCounters, computeProgress, streakMessage, type ProgressEvent } from './services/progress-rewards.service';
import { TaskDecompositionService } from './services/task-decomposition.service';
import { AiriaCognitiveInterpreterService } from './services/airia-cognitive-interpreter.service';
import { AgendaAdaptationService } from './services/agenda-adaptation.service';
import { AiActionFeedbackService } from './services/ai-action-feedback.service';
import { BillingAccessService } from './services/billing-access.service';
import { createStripeServiceFromEnv, StripeService } from './services/stripe.service';
import { ProfessionalPartnerService } from './services/professional-partner.service';
import { ReferralService } from './services/referral.service';
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
  shouldSendPersistentReminder,
} from './lib/notification-filters';
import { resolveAdaptiveCheckinWindows, shouldSendCheckinSlotNudge } from './lib/checkin-windows';
import { getOpenAiMaxCompletionTokens, getOpenAiModel, openAiTemperature } from './lib/openai-config';
import { normalizeObjectiveSubgoals } from './lib/objective-subgoals';
import { PRODUCT_CAPABILITIES, type ProductCapabilities } from './contracts/product-capabilities';
import {
  ObjectiveActionRecoveryService,
  type GoalSubtasksSuggestionGenerator,
} from './services/objective-action-recovery.service';
import {
  GoalIntelligenceService,
  type GoalDecomposition,
  type GoalIntelligenceInput,
} from './services/goal-intelligence.service';
import { OperationalProfileService } from './services/operational-profile.service';
import { ObjectiveProgressionError, ObjectiveProgressionService } from './services/objective-progression.service';
import {
  ObjectivePathConflictError,
  ObjectivePathInvalidProposalError,
  ObjectivePathNotFoundError,
  ObjectivePathService,
} from './services/objective-path.service';
import { DailyPrioritiesService } from './services/daily-priorities.service';
import { ObjectiveRevisionRelevanceService } from './services/objective-revision-relevance.service';
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
// O pool do processo vem de `lib/prisma`. Continua sendo `defaultPrisma` porque
// os testes injetam um cliente próprio por `dependencies.prisma`.
const defaultPrisma = sharedPrisma;
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
  'record_checkin',
  'create_habit',
  'create_calendar_event',
  'adapt_agenda',
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
  if (response.action === 'adapt_agenda') {
    completedPayload.localDate = validDate(payload.localDate ?? payload.date)
      ? String(payload.localDate ?? payload.date)
      : validDate(targetContext.localDate)
        ? String(targetContext.localDate)
        : new Date().toISOString().slice(0, 10);
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
      case 'record_checkin':
        return validDate(payload.localDate ?? payload.date)
          && typeof payload.moodScore === 'number'
          && typeof payload.energyScore === 'number';
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
      case 'adapt_agenda':
        return validDate(completedPayload.localDate);
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
  checkinApplicationService?: Pick<CheckinApplicationService, 'record'>;
  airiaReadingService?: Pick<AiriaReadingService, 'rebuild' | 'get' | 'feedback'>;
  billingAccessService?: Pick<BillingAccessService, 'grantInitialTrial' | 'getSummary'>;
  stripeService?: Pick<StripeService,
    'createCheckoutSession' | 'createPortalSession' | 'verifyCheckoutSession' | 'handleWebhook' | 'getOfferCatalog'>;
  professionalPartnerService?: Pick<ProfessionalPartnerService, 'apply' | 'getMe' | 'verify'>;
  referralService?: Pick<ReferralService, 'claim' | 'getMine'>;
  authMiddleware?: (req: Request, res: Response, next: import('express').NextFunction) => void;
  generateJournalSuggestedTasks?: typeof generateJournalSuggestedTasks;
  generateGoalSubtasks?: GoalSubtasksSuggestionGenerator;
  goalDecompose?: (input: GoalIntelligenceInput) => Promise<GoalDecomposition>;
  capabilities?: ProductCapabilities;
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
  capabilities: ProductCapabilities;
}) {
  if (!Array.isArray(input.items)) return [];
  const unresolvedItems = input.items.map((item) => (
    item && typeof item === 'object' ? item as Record<string, unknown> : { title: item }
  ));
  if (!input.capabilities.planner && !input.capabilities.habits) return unresolvedItems;
  const dayStart = new Date(`${input.localDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${input.localDate}T23:59:59.999Z`);
  const [blocks, habits] = await Promise.all([
    input.capabilities.planner ? input.prisma.timelineBlock.findMany({
      where: {
        userId: input.userId,
        localDate: { gte: dayStart, lte: dayEnd },
        status: { not: 'completed' },
      },
      select: { id: true, title: true },
    }) : Promise.resolve([]),
    input.capabilities.habits ? input.prisma.habit.findMany({
      where: { userId: input.userId, archived: false },
      select: { id: true, title: true },
    }) : Promise.resolve([]),
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

async function buildTodayCompletionContext(
  prisma: PrismaClient,
  userId: string,
  capabilities: ProductCapabilities,
): Promise<{
  text: string | null;
  titles: string[];
}> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${todayStr}T23:59:59.999Z`);
  const lines: string[] = [];
  const titles: string[] = [];

  const [completedBlocks, completedHabits, objectives] = await Promise.all([
    capabilities.planner ? prisma.timelineBlock.findMany({
      where: { userId, localDate: { gte: dayStart, lte: dayEnd }, status: 'completed' },
      orderBy: { startAt: 'asc' },
      select: { title: true, startAt: true, category: true },
    }).catch(() => []) : Promise.resolve([]),
    capabilities.habits ? prisma.habit.findMany({
      where: {
        userId,
        archived: false,
        completions: { some: { date: { gte: dayStart, lte: dayEnd } } },
      },
      select: { title: true, category: true },
    }).catch(() => []) : Promise.resolve([]),
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

function stringList(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Cruzamento de dados antes de qualquer recomendação.
 *
 * A regra do produto é explícita: check-in atual + histórico + objetivos +
 * estado dos objetivos + ações anteriores + diário + padrões → LLM. Sem isso a
 * IA só tem o título do objetivo, e título sozinho é o que produz recomendação
 * inventada.
 *
 * A separação importante aqui é entre FATO e PADRÃO. `userStatements` são falas
 * da pessoa e podem sustentar um passo. `patternContext` (RAG/memória) explica
 * comportamento e nunca vira fato novo — por isso vai num campo separado. Um
 * padrão confirmado pode calibrar a ação, mas a elegibilidade já foi filtrada
 * pela memória canônica e o destino continua sendo o Objetivo/Ação atual.
 */
export function buildGoalIntelligenceInput(input: {
  type: string;
  context: any;
  userName?: string;
  ragContext?: string;
}): GoalIntelligenceInput {
  const context = input.context ?? {};
  const grounding = context.grounding ?? {};

  const goalTitle = String(
    context.goalTitle
    ?? context.focusGoalTitle
    ?? stringList(context.goals, 1)[0]
    ?? stringList(grounding.activeGoals, 1)[0]
    ?? '',
  ).trim();

  // Só fala da pessoa. Nota de check-in, diário e o que ela pediu à Airia.
  const userStatements = [
    typeof context.note === 'string' ? context.note : '',
    typeof context.checkinNote === 'string' ? context.checkinNote : '',
    typeof context.nota === 'string' ? context.nota : '',
    typeof context.journalExcerpt === 'string' ? context.journalExcerpt : '',
    typeof context.message === 'string' ? context.message : '',
    ...stringList(context.userStatements, 6),
  ].map((line) => line.trim()).filter(Boolean).slice(0, 8);

  return {
    goalTitle,
    existingActions: [
      ...stringList(context.existingSubtasks),
      ...stringList(context.pendingActions),
    ],
    completedActions: [
      ...stringList(context.completedSubgoalTitles),
      ...stringList(context.completedTaskTitles),
      ...stringList(grounding.completedActions),
    ],
    userName: input.userName,
    locale: typeof context.locale === 'string' ? context.locale : 'pt-BR',
    userStatements,
    moodLabel: typeof context.moodLabel === 'string' ? context.moodLabel : null,
    energyScore: typeof context.energia === 'number'
      ? context.energia
      : typeof context.energyScore === 'number' ? context.energyScore : null,
    phase: typeof context.phaseLabel === 'string' ? context.phaseLabel : null,
    capacity: context.capacity === 'quick' || context.capacity === 'moderate' || context.capacity === 'heavy'
      ? context.capacity
      : null,
    operationalProfile: (context.operationalProfile ?? null) as GoalIntelligenceInput['operationalProfile'],
    patternContext: [context.verifiedPatternContext, context.moodCycleContext]
      .filter((part) => typeof part === 'string' && part.trim())
      .join('\n')
      .slice(0, 1200) || null,
    patternEvidenceRefs: Array.isArray(context.patternEvidenceRefs)
      ? context.patternEvidenceRefs.filter((ref: unknown): ref is string => typeof ref === 'string').slice(0, 12)
      : [],
    patternBasis: Array.isArray(context.patternBasis) ? context.patternBasis.slice(0, 4) : [],
  };
}

function objectiveDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

function serializeObjective(objective: any, primaryObjectiveId: string | null = null) {
  const subgoals = normalizeObjectiveSubgoals(Array.isArray(objective.subgoals) ? objective.subgoals : []);
  const storedMilestones = Array.isArray(objective.milestones) ? objective.milestones : [];
  // Objetivos antigos entram numa etapa canônica, sem regenerar nem perder ações.
  const milestones = storedMilestones.length > 0
    ? storedMilestones
    : subgoals.length > 0
      ? [{ id: 'legacy-current', title: 'Caminho atual', order: 0, doneWhen: objective.resultDefinition ?? objective.title, actions: [] }]
      : [];
  return {
    id: objective.id,
    title: objective.title,
    description: objective.description ?? null,
    category: objective.category,
    progress: objective.progress,
    subgoals,
    aiInsight: objective.aiInsight ?? null,
    deadline: objectiveDate(objective.deadline),
    pausedAt: objective.pausedAt instanceof Date ? objective.pausedAt.toISOString() : objective.pausedAt ?? null,
    resultDefinition: objective.resultDefinition ?? null,
    currentReality: objective.currentReality ?? null,
    milestones,
    pathVersion: objective.pathVersion ?? 1,
    pathProposal: objective.pathProposal ?? null,
    pathProposalCreatedAt: objective.pathProposalCreatedAt instanceof Date
      ? objective.pathProposalCreatedAt.toISOString()
      : objective.pathProposalCreatedAt ?? null,
    pathStatus: subgoals.length > 0 && (!objective.pathStatus || objective.pathStatus === 'not_started')
      ? 'ready'
      : objective.pathStatus ?? 'not_started',
    pathQuestion: objective.pathQuestion ?? null,
    isPrimary: primaryObjectiveId === objective.id,
    createdAt: objective.createdAt instanceof Date ? objective.createdAt.toISOString() : objective.createdAt,
  };
}

export function isCurrentObjectiveContext(createdAt: unknown, now = new Date(), maxAgeHours = 48): boolean {
  const timestamp = createdAt instanceof Date ? createdAt.getTime() : new Date(String(createdAt ?? '')).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const age = now.getTime() - timestamp;
  return age >= 0 && age <= maxAgeHours * 60 * 60 * 1000;
}

async function loadObjectiveIntelligenceContext(prisma: any, userId: string, objectiveId: string) {
  const now = new Date();
  const todayKey = getSaoPauloDateContext(now).dateKey;
  const [journal, aura, decisions, memories, checkin, operationalProfile] = await Promise.all([
    prisma.journalMessage?.findMany?.({
      where: { userId, role: 'user', createdAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' }, take: 8, select: { content: true, createdAt: true },
    }).catch(() => []) ?? [],
    prisma.auraCommandMessage?.findMany?.({
      where: { userId, role: 'user', createdAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' }, take: 8, select: { content: true, createdAt: true },
    }).catch(() => []) ?? [],
    prisma.eventLog?.findMany?.({
      where: {
        userId,
        eventName: { in: ['objective_path_answered', 'objective_action_rejected', 'objective_action_deferred', 'objective_action_completed'] },
      },
      orderBy: { createdAt: 'desc' }, take: 40, select: { eventName: true, properties: true },
    }).catch(() => []) ?? [],
    prisma.userMemory?.findMany?.({
      where: { userId, lifecycle: 'active' }, orderBy: [{ salience: 'desc' }, { lastSeenAt: 'desc' }], take: 20,
      select: {
        id: true, canonicalKey: true, kind: true, content: true, confidence: true,
        structuredValue: true, validUntil: true, lastSeenAt: true,
        evidence: { select: { id: true, observedAt: true }, orderBy: { observedAt: 'desc' }, take: 12 },
      },
    }).catch(() => []) ?? [],
    prisma.dailyCheckin?.findFirst?.({
      where: { userId, localDate: getSaoPauloDateContext(now).dbDate }, orderBy: { recordedAt: 'desc' },
      select: { energyScore: true, moodScore: true, signalMetadata: true, localDate: true },
    }).catch(() => null) ?? null,
    OperationalProfileService.get(prisma, userId),
  ]);
  const objectiveDecisions = (decisions as any[]).filter((row) => (
    row?.properties && String(row.properties.objectiveId ?? '') === objectiveId
  ));
  const answers = objectiveDecisions.flatMap((row) => (
    row.eventName === 'objective_path_answered' && typeof row.properties?.answer === 'string'
      ? [row.properties.answer]
      : []
  ));
  const blockedActions = objectiveDecisions.flatMap((row) => (
    ['objective_action_rejected', 'objective_action_deferred'].includes(row.eventName)
      && typeof row.properties?.title === 'string'
      ? [row.properties.title]
      : []
  ));
  const canonicalFacts = (memories as any[])
    .filter((memory) => ['fact', 'decision', 'context', 'preference'].includes(memory.kind) && Number(memory.confidence) >= 0.6)
    .map((memory) => String(memory.content)).filter(Boolean).slice(0, 12);
  const eligiblePatterns = (memories as any[])
    .filter((memory) => memory.kind === 'pattern'
      && isDecisionEligiblePattern(memory)
      && (!memory.validUntil || new Date(memory.validUntil).getTime() >= now.getTime()))
    .slice(0, 6);
  const patterns = eligiblePatterns.map((memory) => {
      const structured = memory.structuredValue && typeof memory.structuredValue === 'object'
        ? memory.structuredValue as Record<string, unknown>
        : {};
      const evidenceCount = Number(structured.evidenceCount ?? 0);
      const distinctDays = Number(structured.distinctDays ?? 0);
      const confidence = Number(memory.confidence ?? 0);
      const metadata = evidenceCount > 0 || distinctDays > 0
        ? ` [evidências: ${evidenceCount}; dias: ${distinctDays}; confiança: ${confidence.toFixed(2)}]`
        : '';
      return `${String(memory.content)}${metadata}`;
  }).filter(Boolean);
  const patternBasis = eligiblePatterns.map((memory) => {
    const structured = memory.structuredValue && typeof memory.structuredValue === 'object'
      ? memory.structuredValue as Record<string, unknown>
      : {};
    return {
      pattern: String(memory.content),
      evidenceCount: Number(structured.evidenceCount ?? 0),
      distinctDays: Number(structured.distinctDays ?? 0),
      windowDays: Number(structured.windowDays ?? 14),
      confidence: Number(memory.confidence ?? 0),
      limitation: 'Associação observada; não prova causa nem diagnóstico.',
      impact: 'Pode calibrar prioridade, tamanho, ordem, duração, ritmo, proteção ou adiamento da Ação atual.',
    };
  });
  const patternEvidenceRefs = eligiblePatterns.flatMap((memory) => [
    memory.id ? `pattern:${memory.id}` : '',
    ...(Array.isArray(memory.evidence) ? memory.evidence.map((item: any) => item?.id ? `evidence:${item.id}` : '') : []),
  ]).filter(Boolean).slice(0, 24);
  const checkinDateKey = checkin?.localDate
    ? new Date(checkin.localDate).toISOString().slice(0, 10)
    : null;
  const currentCheckin = checkinDateKey === todayKey ? checkin : null;
  const metadata = currentCheckin?.signalMetadata && typeof currentCheckin.signalMetadata === 'object'
    ? currentCheckin.signalMetadata as Record<string, unknown>
    : {};
  const note = typeof metadata.note === 'string' ? metadata.note : '';
  const userStatements = [
    ...answers,
    note,
    ...(journal as any[]).filter((row) => isCurrentObjectiveContext(row.createdAt, now)).map((row) => String(row.content ?? '')),
    ...(aura as any[]).filter((row) => isCurrentObjectiveContext(row.createdAt, now)).map((row) => String(row.content ?? '')),
  ].map((value) => value.trim()).filter(Boolean).slice(0, 18);
  const energyScore = typeof currentCheckin?.energyScore === 'number' ? currentCheckin.energyScore : null;
  return {
    userStatements,
    blockedActions,
    canonicalFacts,
    patternContext: patterns.join('\n').slice(0, 1600) || null,
    patternEvidenceRefs,
    patternBasis,
    energyScore,
    moodLabel: typeof currentCheckin?.moodScore === 'number' ? `humor ${currentCheckin.moodScore}/10` : null,
    capacity: energyScore === null ? null : energyScore <= 3 ? 'quick' as const : energyScore >= 7 ? 'heavy' as const : 'moderate' as const,
    operationalProfile,
  };
}

function serializeProfessionalPartner(partner: any) {
  if (!partner) return null;
  return {
    id: partner.id,
    professionalName: partner.professionalName,
    crpRegion: partner.crpRegion,
    crpNumber: partner.crpNumber,
    verificationStatus: partner.verificationStatus,
    verificationNote: partner.verificationNote ?? null,
    verifiedAt: partner.verifiedAt ?? null,
    lastVerifiedAt: partner.lastVerifiedAt ?? null,
    active: partner.active,
    referralCode: partner.verificationStatus === 'verified' && partner.active
      ? partner.referralCode
      : null,
  };
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const prisma = dependencies.prisma ?? defaultPrisma;
  const capabilities = dependencies.capabilities ?? PRODUCT_CAPABILITIES;
  const billingAccessService = dependencies.billingAccessService ?? new BillingAccessService(prisma, {
    checkoutAvailable: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
  });
  const stripeService = dependencies.stripeService ?? createStripeServiceFromEnv(prisma);
  const professionalPartnerService = dependencies.professionalPartnerService ?? new ProfessionalPartnerService(prisma);
  const referralService = dependencies.referralService ?? new ReferralService(prisma);
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
  const contextGroundingService = new ContextGroundingService(prisma, capabilities);
  const objectiveProgressionService = new ObjectiveProgressionService(prisma as any);
  const persistConfirmedObjectivePath = async (transaction: any, objective: any, source: string) => {
    const actions = normalizeObjectiveSubgoals(objective.subgoals);
    const current = actions.find((action) => !action.done && action.status !== 'rejected' && action.status !== 'deferred');
    await new CanonicalMemoryService(transaction).write({
      userId: objective.userId,
      kind: 'decision',
      scope: `objective:${objective.id}`,
      canonicalKey: `objective.${objective.id}.confirmed_path`,
      content: [
        `Objetivo: ${objective.title}`,
        objective.resultDefinition ? `Resultado: ${objective.resultDefinition}` : '',
        objective.currentReality ? `Realidade atual: ${objective.currentReality}` : '',
        current ? `Ação atual: ${current.title}` : '',
      ].filter(Boolean).join('\n'),
      structuredValue: {
        objectiveId: objective.id,
        pathVersion: objective.pathVersion,
        milestones: objective.milestones,
        currentActions: current ? [{ id: current.id, title: current.title }] : [],
      },
      confidence: 1,
      salience: 0.9,
      source,
      sourceId: `${objective.id}:${objective.pathVersion}`,
      targetType: 'objective',
      targetId: objective.id,
    });
  };
  const objectivePathService = new ObjectivePathService(
    prisma as any,
    dependencies.goalDecompose,
    persistConfirmedObjectivePath,
  );
  const reviewObjectivePathsAfterContext = async (
    userId: string,
    statement: string,
    source: 'journal' | 'checkin' | 'aura',
  ) => {
    if (!statement.trim()) return [] as Array<{ objectiveId: string; reason: string }>;
    if (!prisma.objective?.findMany) return [] as Array<{ objectiveId: string; reason: string }>;
    const objectives = await prisma.objective.findMany({
      where: {
        userId,
        archived: false,
        pausedAt: null,
        pathStatus: 'ready',
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
    const proposed: Array<{ objectiveId: string; reason: string }> = [];
    for (const objective of objectives) {
      if (objective.pathProposal) continue;
      const actions = normalizeObjectiveSubgoals(objective.subgoals);
      const relevance = await ObjectiveRevisionRelevanceService.evaluate({
        objectiveTitle: objective.title,
        resultDefinition: objective.resultDefinition,
        currentReality: objective.currentReality,
        milestones: objective.milestones,
        currentActions: actions
          .filter((action) => !action.done && action.status !== 'rejected' && action.status !== 'deferred')
          .slice(0, 2)
          .map((action) => action.title),
        newContext: statement,
        source,
      });
      if (!relevance.relevant || !relevance.reason) continue;
      try {
        const context = await loadObjectiveIntelligenceContext(prisma, userId, objective.id);
        await objectivePathService.proposeRevision({
          userId,
          objectiveId: objective.id,
          locale: 'pt-BR',
          reason: relevance.reason,
          ...context,
          userStatements: [...context.userStatements, statement],
        });
        proposed.push({ objectiveId: objective.id, reason: relevance.reason });
      } catch (error) {
        // Contexto novo nunca pode impedir Diário ou Check-in de serem salvos.
        console.warn(`[objective-revision] proposta ignorada para ${objective.id}:`, error);
      }
    }
    return proposed;
  };
  const objectiveActionRecoveryService = new ObjectiveActionRecoveryService(
    prisma as any,
    dependencies.generateGoalSubtasks ?? (async (request) => {
      const context = await loadObjectiveIntelligenceContext(
        prisma,
        request.context.userId,
        request.context.objectiveId,
      );
      const decomposition = await GoalIntelligenceService.decompose({
        goalTitle: request.context.goalTitle,
        existingActions: request.context.existingSubtasks,
        locale: request.context.locale,
        ...context,
      });
      return {
        items: decomposition.steps.map((step) => step.title),
        steps: decomposition.steps,
        question: decomposition.question,
        resultDefinition: decomposition.resultDefinition,
        currentReality: decomposition.currentReality,
        milestones: decomposition.milestones,
      };
    }),
  );
  const projectObjectivePathToMemory = async (objective: any, source: string) => {
    if (!objective || objective.pathStatus !== 'ready') return;
    const actions = normalizeObjectiveSubgoals(objective.subgoals);
    const currentActions = actions.filter((action) => (
      !action.done && action.status !== 'rejected' && action.status !== 'deferred'
    ));
    await canonicalMemoryService.write({
      userId: objective.userId,
      kind: 'decision',
      scope: `objective:${objective.id}`,
      canonicalKey: `objective.${objective.id}.confirmed_path`,
      content: [
        `Objetivo: ${objective.title}`,
        objective.resultDefinition ? `Resultado: ${objective.resultDefinition}` : '',
        objective.currentReality ? `Realidade atual: ${objective.currentReality}` : '',
        currentActions[0] ? `Ação atual: ${currentActions[0].title}` : '',
      ].filter(Boolean).join('\n'),
      structuredValue: {
        objectiveId: objective.id,
        pathVersion: objective.pathVersion,
        milestones: objective.milestones,
        currentActions: currentActions.map((action) => ({ id: action.id, title: action.title })),
      },
      confidence: 1,
      salience: 0.9,
      source,
      sourceId: `${objective.id}:${objective.pathVersion}`,
      targetType: 'objective',
      targetId: objective.id,
    });
  };
  const applyAuraAgendaAdaptation = async ({
    userId,
    localDate,
  }: {
    userId: string;
    localDate: string;
    operationId: string;
    now: Date;
  }) => {
    const [recentSuggestionItems, memories] = await Promise.all([
      SuggestionMemoryService.getRecent(prisma, userId),
      canonicalMemoryService.retrieve({
        userId,
        query: `adaptação de agenda e rotina real em ${localDate}`,
        limit: 8,
      }),
    ]);
    const dailyContext = await contextGroundingService.buildDailyContext({
      userId,
      type: 'agenda-adapt',
      context: { localDate },
      recentSuggestionItems,
      ragContext: canonicalMemoryService.formatForPrompt(memories, 'pt-BR'),
    });
    const result = await AgendaAdaptationService.apply({
      prisma,
      userId,
      dailyContext,
      requestContext: { source: 'aura_command' },
      trigger: 'planner',
    });
    return {
      date: result.date,
      applied: result.applied,
      appliedChanges: result.appliedChanges.map((change) => ({ id: change.id, title: change.title, type: change.type })),
      skippedChanges: result.skippedChanges.map((change) => ({ id: change.id, title: change.title, type: change.type, reason: change.reason })),
    };
  };
  const routineBuilderService = dependencies.routineBuilderService ?? new RoutineBuilderService(prisma);
  const airiaReadingService = dependencies.airiaReadingService ?? new AiriaReadingService(prisma);
  const checkinApplicationService = dependencies.checkinApplicationService ?? new CheckinApplicationService({
    repository: new PrismaCheckinApplicationRepository(prisma),
    evaluate: async (data) => {
      const requestContext = data.applicationContext as any;
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
        sleepScore: data.sleepScore ?? undefined,
        irritabilityScore: data.irritabilityScore ?? undefined,
      });
      const [runtimeContext, plannerContext, completionContext, recentSuggestionItems, memories] = await Promise.all([
        resolveAiRuntimeContext(prisma, data.userId, {}),
        capabilities.planner || capabilities.connectedCalendar
          ? buildTodayPlannerContext(prisma, data.userId)
          : Promise.resolve(null),
        buildTodayCompletionContext(prisma, data.userId, capabilities),
        SuggestionMemoryService.getRecent(prisma, data.userId),
        memoryService.retrieve(data.userId, checkinRagQuery || 'check-in de hoje e padrões anteriores', 3).catch(() => []),
      ]);
      const recentSuggestionMemory = SuggestionMemoryService.formatForPrompt(recentSuggestionItems);
      const ragContext = memoryService.formatForPrompt(memories);
      const groundingContext = await contextGroundingService.buildForSuggest({
        userId: data.userId,
        type: 'checkin',
        context: {
          localDate: data.localDate,
          adhdProfile: Array.isArray(runtimeContext.priorDiagnoses) && runtimeContext.priorDiagnoses.includes('adhd'),
          hyperfocusOccurred: data.hyperfocusOccurred === true,
        },
        recentSuggestionItems,
        ragContext,
      });
      const groundingText = typeof groundingContext.groundingContext === 'string'
        ? groundingContext.groundingContext
        : '';
      const adaptiveContext = extractAdaptiveFromRequest(requestContext);
      const reasoning = ReasoningContextService.buildForPrompt({
        dailyContext: groundingContext.grounding as any,
        surface: 'checkin',
        requestContext: {
          ...adaptiveContext,
          localDate: data.localDate,
          moodScore: data.moodScore,
          energyScore: data.energyScore,
          sleepScore: data.sleepScore,
          currentHour: requestContext.currentHour,
          currentMinute: requestContext.currentMinute,
        },
        currentMessage: data.note ?? null,
        ragContext,
        decisionBrain: (groundingContext as any).decisionBrain ?? null,
      });
      const actionPlan = AiriaOperationalReasoningService.build({
        dailyContext: groundingContext.grounding as any,
        surface: 'checkin',
        requestContext: {
          ...adaptiveContext,
          localDate: data.localDate,
          moodScore: data.moodScore,
          energyScore: data.energyScore,
          sleepScore: data.sleepScore,
          currentHour: requestContext.currentHour,
          currentMinute: requestContext.currentMinute,
        },
        currentMessage: data.note ?? null,
        ragContext,
        decisionBrain: (groundingContext as any).decisionBrain ?? null,
        trace: reasoning.trace,
      });
      const cognitive = await AiriaCognitiveInterpreterService.interpret({
        surface: 'checkin',
        dailyContext: groundingContext.grounding as any,
        requestContext: {
          ...adaptiveContext,
          localDate: data.localDate,
          moodScore: data.moodScore,
          energyScore: data.energyScore,
          sleepScore: data.sleepScore,
          currentHour: requestContext.currentHour,
          currentMinute: requestContext.currentMinute,
        },
        currentMessage: data.note ?? null,
        ragContext,
        moodCycleContext: [runtimeContext.moodCycleContext, groundingText].filter(Boolean).join('\n'),
        plannerContext: [plannerContext, groundingText].filter(Boolean).join('\n'),
        activeGoalsContext: runtimeContext.activeGoalsContext,
        recentSuggestionMemory,
        actionPlan,
      });
      const aiState = await CheckinService.evaluateDayState({
        checkinSlot: data.checkinSlot,
        moodScore: data.moodScore,
        energyScore: data.energyScore,
        clarityScore: data.clarityScore,
        irritabilityScore: data.irritabilityScore,
        physicalScore: data.physicalScore,
        socialScore: data.socialScore,
        sleepScore: data.sleepScore,
        note: data.note,
        userName: runtimeContext.userName,
        profileSummary: runtimeContext.userProfileSummary,
        moodCycleContext: [runtimeContext.moodCycleContext, groundingText].filter(Boolean).join('\n'),
        contextualMemory: ragContext,
        activeGoalsContext: runtimeContext.activeGoalsContext,
        recentSuggestionMemory,
        reasoningTraceContext: [
          riskSafetyPromptPolicy(riskSafety),
          reasoning.context,
          AiriaOperationalReasoningService.formatForPrompt(actionPlan),
          AiriaCognitiveInterpreterService.formatForPrompt(cognitive),
        ].join('\n\n'),
        airiaActionPlan: actionPlan,
        operationalRecommendation: AiriaOperationalReasoningService.visibleSuggestion(actionPlan),
        completionContext: completionContext.text,
        avoidRecommendationTitles: uniqueByKey([
          ...completionContext.titles,
          ...((groundingContext.blockedActionTitles as string[] | undefined) ?? []),
          ...((groundingContext.completedTaskTitles as string[] | undefined) ?? []),
          ...((groundingContext.completedHabitTitles as string[] | undefined) ?? []),
          ...((groundingContext.completedGoalTitles as string[] | undefined) ?? []),
          ...((groundingContext.completedSubgoalTitles as string[] | undefined) ?? []),
        ]),
        emotions: data.emotions,
        factors: data.factors,
        plannerContext: [plannerContext, groundingText].filter(Boolean).join('\n'),
        priorDiagnoses: runtimeContext.priorDiagnoses,
        ...adaptiveContext,
      });
      return {
        stateLabel: aiState.stateLabel,
        stateLabelType: aiState.stateLabelType,
        stateSummary: aiState.analysis,
        aiState: { ...aiState, emotions: data.emotions ?? [], factors: data.factors ?? [] } as any,
        riskSafety: riskSafety as any,
      };
    },
    afterPersist: async ({ data, checkin, evaluation, applicationContext }) => {
      await airiaReadingService.rebuild({
        userId: data.userId,
        localDate: data.localDate,
        sourceCheckinId: checkin.id,
        surface: 'checkin',
      });
      if (data.note && data.note.trim().length >= 10) {
        void memoryService.store({
          userId: data.userId,
          contentType: 'checkin_note',
          contentId: checkin.id,
          content: `${data.localDate}: ${data.note.trim()}`,
          metadata: {
            moodScore: data.moodScore,
            energyScore: data.energyScore,
            date: data.localDate,
            stateLabel: evaluation.stateLabel,
            riskLevel: evaluation.riskSafety.riskLevel,
          },
        }).catch(() => {});
      }
      const recommendations = Array.isArray(evaluation.aiState.recommendations)
        ? evaluation.aiState.recommendations.map(String)
        : [];
      void SuggestionMemoryService.append(prisma, data.userId, 'checkin', recommendations).catch(() => {});
      void AiBackgroundService.scheduleJob(data.userId, 'rag-indexing', '1h').catch(() => {});
      void AiBackgroundService.scheduleJob(data.userId, 'profile-update', '6h').catch(() => {});
      if (data.note && data.note.trim().length >= 12) {
        setImmediate(() => {
          void KnowledgeGraphService.extractFromMessage(data.userId, data.note!.trim(), {
            source: 'checkin',
            canonicalMemoryService,
            locale: typeof applicationContext.locale === 'string' ? applicationContext.locale : 'pt-BR',
            sourceId: checkin.id,
            observedAt: checkin.recordedAt ?? new Date(),
          }).catch((err) => console.warn('[checkin/kg] extração falhou:', err));
        });
      }
    },
  });

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
      await stripeService.handleWebhook(req.body as Buffer, sig);
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

  // POST /api/admin/professional-partners/:partnerId/verify — verificação CRP protegida por chave administrativa
  app.post('/api/admin/professional-partners/:partnerId/verify', async (req: Request, res: Response) => {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const input = ProfessionalVerificationSchema.parse(req.body);
      const partner = await professionalPartnerService.verify(req.params.partnerId, input);
      return res.json({ partner: serializeProfessionalPartner(partner) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[professional-partners/verify] Error:', error);
      return res.status(500).json({ error: 'Failed to verify professional partner' });
    }
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
  const disabledCapability = (_req: Request, res: Response) => res.status(404).json({ error: 'capability_disabled' });
  if (!capabilities.planner) {
    app.use(['/api/timeline', '/api/planner', '/api/agenda', '/api/ai/planner-suggestions'], disabledCapability);
  }
  if (!capabilities.habits) app.use('/api/habits', disabledCapability);
  if (!capabilities.connectedCalendar) app.use('/api/gcal', disabledCapability);
  if (capabilities.planner || capabilities.habits) {
    app.use('/api/routine-builder', createRoutineBuilderRouter({ service: routineBuilderService }));
  } else {
    app.use('/api/routine-builder', disabledCapability);
  }

  /**
   * POST /api/onboarding/operational-profile
   *
   * Grava COMO a pessoa funciona — tamanho de passo, quantas opções ela
   * consegue processar, o que trava primeiro. Não é diagnóstico e não vira
   * rótulo visível: só muda o formato do que a Airia devolve.
   */
  const OperationalProfileSchema = z.object({
    blockers: z.array(z.string().trim().min(1)).max(8).optional().default([]),
    openFronts: z.number().int().min(0).max(99).nullable().optional().default(null),
    listPreference: z.enum(['one_at_a_time', 'whole_picture']).nullable().optional().default(null),
    stepSize: z.enum(['small', 'medium', 'large']).nullable().optional().default(null),
  });

  app.post('/api/onboarding/operational-profile', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const answers = OperationalProfileSchema.parse(req.body);
      const profile = await OperationalProfileService.save(prisma, userId, answers);
      return res.json({ profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[onboarding/operational-profile] Error:', error);
      return res.status(500).json({ error: 'Failed to save operational profile' });
    }
  });

  app.post('/api/onboarding/complete', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      await prisma.profile.upsert({
        where: { id: userId },
        update: { onboardingDone: true },
        create: { id: userId, onboardingDone: true },
      });
      const billing = await billingAccessService.grantInitialTrial(userId);
      return res.json({ saved: true, billing });
    } catch (error) {
      console.error('[onboarding/complete] Error:', error);
      return res.status(500).json({ error: 'Failed to complete onboarding' });
    }
  });

  app.post('/api/professional-partners/apply', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const input = ProfessionalApplicationSchema.parse(req.body);
      const partner = await professionalPartnerService.apply(userId, input);
      return res.status(201).json({ partner: serializeProfessionalPartner(partner) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      if (error instanceof Error && error.message === 'professional_crp_already_registered') {
        return res.status(409).json({ error: error.message });
      }
      console.error('[professional-partners/apply] Error:', error);
      return res.status(500).json({ error: 'Failed to submit professional application' });
    }
  });

  app.get('/api/professional-partners/me', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const partner = await professionalPartnerService.getMe(userId);
      return res.json({ partner: serializeProfessionalPartner(partner) });
    } catch (error) {
      console.error('[professional-partners/me] Error:', error);
      return res.status(500).json({ error: 'Failed to load professional application' });
    }
  });

  app.post('/api/referrals/claim', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { code } = ReferralClaimSchema.parse(req.body);
      const referral = await referralService.claim(userId, code);
      return res.json({ referral });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      if (error instanceof Error && [
        'referral_invalid_or_inactive',
        'referral_self_claim',
        'referral_already_claimed',
      ].includes(error.message)) {
        return res.status(error.message === 'referral_already_claimed' ? 409 : 400).json({ error: error.message });
      }
      console.error('[referrals/claim] Error:', error);
      return res.status(500).json({ error: 'Failed to claim referral' });
    }
  });

  app.get('/api/referrals/me', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const referral = await referralService.getMine(userId);
      return res.json({ referral });
    } catch (error) {
      console.error('[referrals/me] Error:', error);
      return res.status(500).json({ error: 'Failed to load referral' });
    }
  });

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
            biologicalSex: data.biologicalSex ?? null,
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
            biologicalSex: data.biologicalSex ?? null,
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
   * Fonte única para Home, Check-in, Diário, Aura, Padrões e Objetivos.
   * `to` é a data da leitura; `from` existe para manter o contrato das
   * superfícies longitudinais, mas a janela histórica é sempre calculada pelo
   * servidor com peso igual para cada dia observado.
   */
  app.get('/api/airia/reading', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const requestedFrom = typeof req.query.from === 'string' ? req.query.from : undefined;
    const requestedTo = typeof req.query.to === 'string' ? req.query.to : undefined;
    if ((requestedFrom && !/^\d{4}-\d{2}-\d{2}$/.test(requestedFrom)) || (requestedTo && !/^\d{4}-\d{2}-\d{2}$/.test(requestedTo))) {
      return res.status(400).json({ error: 'from/to must be YYYY-MM-DD' });
    }
    try {
      const preferences = await prisma.userPreference.findUnique({ where: { userId }, select: { timezone: true } });
      const localDate = getLocalTimeContext(new Date(), preferences?.timezone).dateKey;
      return res.json(await airiaReadingService.rebuild({
        userId,
        localDate,
        periodFrom: requestedFrom,
        periodTo: requestedTo,
        surface: 'read',
      }));
    } catch (error) {
      console.error('[airia/reading] Error:', error);
      return res.status(500).json({ error: 'Failed to build Airia reading' });
    }
  });

  app.post('/api/airia/decisions/:decisionId/feedback', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const payloadSchema = z.object({
      status: z.enum(['accepted', 'corrected', 'rejected', 'done', 'substituted']),
      correction: z.string().trim().max(1_000).optional(),
      note: z.string().trim().max(1_000).optional(),
      surface: z.string().trim().max(80).optional(),
    });
    try {
      const payload = payloadSchema.parse(req.body);
      const statusMap: Record<typeof payload.status, AiriaDecisionStatus> = {
        accepted: 'aceita', corrected: 'corrigida', rejected: 'rejeitada', done: 'concluída', substituted: 'substituída',
      };
      return res.json(await airiaReadingService.feedback({
        userId,
        decisionId: req.params.decisionId,
        status: statusMap[payload.status],
        surface: payload.surface ?? 'unknown',
        correction: payload.correction,
        note: payload.note,
      }));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      if (error instanceof Error && error.message === 'AIRIA_DECISION_NOT_FOUND') return res.status(404).json({ error: 'Decision not found' });
      console.error('[airia/decision-feedback] Error:', error);
      return res.status(500).json({ error: 'Failed to persist decision feedback' });
    }
  });

  /**
   * POST /api/checkins
   * Salva o check-in diário e dispara a IA para avaliação de estado.
   */
  app.post('/api/checkins', async (req: Request, res: Response) => {
    try {
      const data = CheckinCreateSchema.parse({ ...req.body, userId: (req as AuthRequest).userId });
      const result = await checkinApplicationService.record(data, {
        requestContext: req.body as Record<string, unknown>,
      });
      const reading = await airiaReadingService.rebuild({ userId: data.userId, localDate: data.localDate, sourceCheckinId: result.checkinId, surface: 'checkin' });
      const checkinStatement = data.note?.trim() ?? '';
      const objectivePathProposals = checkinStatement
        ? await reviewObjectivePathsAfterContext(data.userId, checkinStatement, 'checkin').catch(() => [])
        : [];
      return res.json({ ...result, reading, objectivePathProposals });
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

      const objectivePathProposals = await reviewObjectivePathsAfterContext(userId, data.message, 'journal')
        .catch((error) => {
          console.warn('[objective-revision] falha após mensagem do diário:', error);
          return [];
        });

      return res.status(201).json({
        sessionId,
        messageId: created.id,
        orderIndex: created.orderIndex,
        createdAt: created.createdAt.toISOString(),
        objectivePathProposals,
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
            prisma.userMemory.findMany({
              where: { userId: data.userId, kind: 'pattern', lifecycle: 'active' },
              orderBy: { lastSeenAt: 'desc' },
              take: 12,
              select: { content: true, lastSeenAt: true, validUntil: true, structuredValue: true },
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

          const topPattern = (topPatterns as any[]).find((pattern) => (
            isDecisionEligiblePattern({ kind: 'pattern', structuredValue: pattern.structuredValue })
            && (!pattern.validUntil || new Date(pattern.validUntil).getTime() >= Date.now())
          ));
          if (topPattern) {
            const daysSince = Math.floor((Date.now() - new Date(topPattern.lastSeenAt).getTime()) / 86400000);
            if (daysSince <= 14) {
              parts.push(`Tenho percebido: ${String(topPattern.content).toLowerCase()}.`);
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
        capabilities.planner || capabilities.connectedCalendar
          ? buildTodayPlannerContext(prisma, data.userId)
          : Promise.resolve(null),
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

      // O bloco de sinais é conversa entre o modelo e o app. Ele é lido aqui e
      // some do texto: mostrar JSON no diário seria vazar mecânica na cara de
      // quem está desabafando. O front repinta a mensagem com este conteúdo
      // limpo quando recebe `assistant.completed`.
      const journalSignals = extractJournalSignals(assistantContent);
      const visibleContent = stripJournalSignals(assistantContent);
      // localDate é opcional no schema do diário; para o check-in ele não pode
      // faltar, então cai na data do servidor como último recurso.
      const signalLocalDate = data.localDate ?? new Date().toISOString().slice(0, 10);

      const assistantOrderIndex = userOrderIndex + 1;
      const assistantMessage = await prisma.journalMessage.create({
        data: {
          sessionId: data.sessionId,
          userId: data.userId,
          role: 'assistant',
          content: visibleContent,
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

      // ── Proposta de check-in e de meta ────────────────────────────────────
      // Tudo daqui para baixo é opcional: falhar não pode cortar o diário, que
      // já entregou a resposta. Daí o try/catch mudo.
      try {
        const proposals: Array<{ action: string; payload: Record<string, unknown> }> = [];

        if (journalSignals.checkin) {
          const draft = CheckinUnderstandingService.understand({
            message: data.message,
            localDate: signalLocalDate,
            source: 'aura_text',
            sourceMessageId: persistedUserMessage.id,
            idempotencyKey: `journal:${data.sessionId}:${persistedUserMessage.id}`,
            candidate: journalSignals.checkin as Record<string, unknown>,
          });
          // Só `ready` vira proposta: o serviço valida o sinal contra léxico e
          // recusa quando a pessoa disse que só estava desabafando.
          if (draft.status === 'ready') {
            proposals.push({
              action: 'record_checkin',
              payload: {
                localDate: draft.localDate,
                moodScore: draft.mood.value,
                energyScore: draft.energy.value,
                emotions: draft.emotions,
                factors: draft.factors,
                source: draft.source,
                sourceMessageId: draft.sourceMessageId,
                idempotencyKey: draft.idempotencyKey,
                rawText: draft.rawText,
                needsConfirmation: true,
                signalMetadata: { surface: 'journal' },
              },
            });
          }
        }

        if (journalSignals.goal) {
          proposals.push({
            action: 'create_goal',
            payload: {
              title: journalSignals.goal.title,
              subgoals: journalSignals.goal.subgoals,
              // Obrigatório: sem anular, o construtor agenda por padrão um bloco
              // de 25 min no Planner — que está desligado e ninguém veria.
              firstAction: null,
              needsConfirmation: true,
            },
          });
        }

        if (proposals.length > 0) {
          // Reaproveita a sessão de comando ativa em vez de criar coluna nova em
          // JournalSession — o que exigiria migração, entrada na allowlist de
          // privacidade e edição do deploy, tudo para guardar um ponteiro.
          const session = await prisma.auraCommandSession.findFirst({
            where: { userId: data.userId, status: 'active' },
            orderBy: { createdAt: 'desc' },
          }) ?? await AuraCommandPersistenceService.createSession({
            prisma,
            userId: data.userId,
            locale: typeof (req.body as any)?.locale === 'string' ? (req.body as any).locale : 'pt-BR',
            timezone: typeof (req.body as any)?.timezone === 'string' ? (req.body as any).timezone : 'America/Sao_Paulo',
          });
          const operations = [];
          for (const proposal of proposals) {
            const plan = AuraCommandPlanBuilderService.build({
              sessionId: session.id,
              sourceMessageId: persistedUserMessage.id,
              localDate: signalLocalDate,
              currentTime: new Date().toTimeString().slice(0, 5),
              // Nenhuma das duas propostas do diário agenda bloco: check-in não
              // ocupa horário e a meta vai com firstAction nulo. Por isso
              // calendário e janelas ocupadas ficam vazios.
              defaultCalendarId: '',
              busyWindows: [],
              // O construtor exige `assistantMessage` — a frase do card de
              // confirmação. No diário quem fala é a resposta que já foi para a
              // tela, então o card recebe só o rótulo da proposta. Sem isso o
              // `parse` lança, e como este bloco inteiro está dentro de um
              // `catch` mudo, a proposta sumiria sem deixar rastro.
              response: {
                action: proposal.action,
                payload: proposal.payload,
                assistantMessage: proposal.action === 'record_checkin'
                  ? 'Registro do que você contou, se quiser confirmar.'
                  : 'Meta a partir do que você contou, se quiser confirmar.',
              } as never,
            });
            operations.push(...plan.operations);
          }

          if (operations.length > 0) {
            const plan = {
              id: randomUUID(),
              sessionId: session.id,
              sourceMessageId: persistedUserMessage.id,
              operations,
              // Diário é superfície confessional: NUNCA aplica sozinho. Quem
              // confirma é ela, no card.
              executionPolicy: 'review_required' as const,
              missingFields: [],
              createdAt: new Date().toISOString(),
            };
            await AuraCommandPersistenceService.persistPlan({ prisma, userId: data.userId, plan: plan as never });
            writeSseEvent(res, 'plan.proposed', { plan });
          }
        }
      } catch (signalError) {
        console.warn('[journal/signals] proposta não gerada:', signalError);
      }

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
      const data = AuraCommandStartSchema.parse({ ...req.body, userId: (req as AuthRequest).userId });
      const session = await AuraCommandPersistenceService.createSession({
        prisma,
        userId: data.userId,
        locale: data.locale,
        timezone: data.timezone,
      });

      return res.json({
        sessionId: session.id,
        sessionStatus: 'ready',
        startedAt: session.createdAt.toISOString(),
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
      const commandSession = await prisma.auraCommandSession.findFirst({
        where: { id: data.sessionId, userId: data.userId, status: 'active' },
      });
      if (!commandSession) {
        return res.status(404).json({ error: 'Airia command session not found' });
      }
      const sourceMessage = await AuraCommandPersistenceService.appendMessage({
        prisma,
        userId: data.userId,
        sessionId: data.sessionId,
        role: 'user',
        content: data.message,
      });
      const objectivePathProposals = await reviewObjectivePathsAfterContext(
        data.userId,
        data.message,
        'aura',
      ).catch(() => []);
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
        objectivePathProposals,
      });

      // Shared Brain: busca memórias relevantes antes de interpretar o comando
      const commandMemories = await canonicalMemoryService.retrieve({
        userId: data.userId,
        query: data.message,
        limit: 8,
        locale: data.locale,
      }).catch(() => null);
      const commandRagContext = commandMemories ? canonicalMemoryService.formatForPrompt(commandMemories, data.locale) : '';

      // Planner Brain: injeta agenda completa de hoje (planner interno + Google Calendar)
      const plannerContext = capabilities.planner || capabilities.connectedCalendar
        ? await buildTodayPlannerContext(prisma, data.userId)
        : null;
      const commandGroundingContext = await contextGroundingService.buildForSuggest({
        userId: data.userId,
        type: 'aura-command',
        context: {
          localDate: data.localDate,
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
          localDate: data.localDate,
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
          localDate: data.localDate,
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
          localDate: data.localDate,
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
        localDate: data.localDate,
        priorDiagnoses: runtimeContext.priorDiagnoses,
        ...extractAdaptiveFromRequest(req.body),
      });
      const recoveredCommandResponse = recoverAuraCommandResponse({
        response: rawCommandResponse,
        message: data.message,
        localDate: data.localDate ?? getSaoPauloDateContext(new Date()).dateKey,
        captureJudgment: commandCognitive.captureJudgment,
      });
      const rawTaskId = typeof recoveredCommandResponse.payload?.taskId === 'string'
        ? recoveredCommandResponse.payload.taskId.trim()
        : '';
      const resolvedCommandTask = rawTaskId && (
        recoveredCommandResponse.action === 'update_task'
        || recoveredCommandResponse.action === 'delete_task'
        || recoveredCommandResponse.action === 'postpone_task'
        || recoveredCommandResponse.action === 'start_task'
      )
        ? await prisma.timelineBlock.findFirst({ where: { id: rawTaskId, userId: data.userId } })
        : null;
      const gatedCommandResponse = enforceAuraCaptureGateAll(
        recoveredCommandResponse,
        commandCognitive,
        data.locale,
        {
          resolvedTaskTitle: resolvedCommandTask?.title ?? null,
          localDate: data.localDate,
          currentHour: Number.isInteger((req.body as any)?.currentHour) ? (req.body as any).currentHour : undefined,
          currentMinute: Number.isInteger((req.body as any)?.currentMinute) ? (req.body as any).currentMinute : undefined,
        },
      );

      const responsePayload = { ...gatedCommandResponse.payload };

      // Tarefa vaga ou longa já nasce quebrada: a usuária não precisa pedir para
      // dividir, e o primeiro passo já vem com o movimento físico que destrava.
      if (gatedCommandResponse.action === 'create_task') {
        const decompositionTitle = typeof responsePayload.title === 'string' ? responsePayload.title : '';
        const decompositionSteps = await TaskDecompositionService.decompose({
          title: decompositionTitle,
          durationMinutes: typeof responsePayload.durationMinutes === 'number' ? responsePayload.durationMinutes : null,
          locale: data.locale,
          // A quebra acompanha a capacidade de hoje: em fase baixa, menos passos
          // e mais curtos. Cinco passos de quinze minutos num dia ruim é o mesmo
          // que não ter quebrado.
          phase: typeof (req.body as any)?.phase === 'string' ? (req.body as any).phase : null,
          energyScore: typeof (req.body as any)?.energyScore === 'number' ? (req.body as any).energyScore : null,
          category: typeof responsePayload.category === 'string' ? responsePayload.category : null,
          note: typeof responsePayload.note === 'string' ? responsePayload.note : null,
        }).catch(() => []);
        if (decompositionSteps.length > 0) {
          Object.assign(responsePayload, {
            steps: decompositionSteps,
            // O id é obrigatório: o Planner descarta item de checklist sem id, e os
            // passos gerados sumiriam em silêncio.
            checklist: decompositionSteps.map((step, index) => ({
              id: `step-${Date.now()}-${index}`,
              text: step.title,
              done: false,
            })),
            wasDecomposed: true,
          });
        }
      }
      if (gatedCommandResponse.action === 'create_goal') {
        const goalTitle = typeof responsePayload.title === 'string'
          ? responsePayload.title
          : typeof responsePayload.goalTitle === 'string'
            ? responsePayload.goalTitle
            : '';
        const goalDecomposition = await GoalIntelligenceService.decompose({
          goalTitle,
          locale: data.locale,
          userStatements: [
            data.message,
            typeof responsePayload.description === 'string' ? responsePayload.description : '',
          ].filter(Boolean),
          completedActions: Array.isArray((commandGroundingContext as any)?.grounding?.completedSubgoalTitles)
            ? (commandGroundingContext as any).grounding.completedSubgoalTitles
            : [],
          phase: typeof (req.body as any)?.phase === 'string' ? (req.body as any).phase : null,
          energyScore: typeof (req.body as any)?.energyScore === 'number' ? (req.body as any).energyScore : null,
          capacity: (req.body as any)?.capacity === 'quick' || (req.body as any)?.capacity === 'moderate' || (req.body as any)?.capacity === 'heavy'
            ? (req.body as any).capacity
            : null,
          operationalProfile: await OperationalProfileService.get(prisma, data.userId),
          patternContext: commandRagContext || null,
        }).catch(() => null);
        if (goalDecomposition?.mode === 'actions' && goalDecomposition.steps.length > 0) {
          responsePayload.subgoals = goalDecomposition.steps.map((step, index) => ({
            id: `goal-action-${Date.now()}-${index}`,
            title: step.title,
            done: false,
            milestoneId: step.milestoneId,
            doneWhen: step.doneWhen,
            effortSize: step.effortSize,
            basedOn: step.basedOn,
            evidenceRefs: step.evidenceRefs,
          }));
          responsePayload.resultDefinition = goalDecomposition.resultDefinition;
          responsePayload.currentReality = goalDecomposition.currentReality;
          responsePayload.milestones = goalDecomposition.milestones.map((milestone) => ({
            id: milestone.id, title: milestone.title, order: milestone.order, doneWhen: milestone.doneWhen,
          }));
          responsePayload.wasDecomposed = true;
          responsePayload.pathStatus = 'ready';
          responsePayload.pathQuestion = null;
        } else if (goalDecomposition?.question) {
          responsePayload.subgoals = [];
          responsePayload.question = goalDecomposition.question;
          responsePayload.pathStatus = 'needs_answer';
          responsePayload.pathQuestion = goalDecomposition.question;
          responsePayload.wasDecomposed = false;
        } else {
          responsePayload.subgoals = [];
          responsePayload.pathStatus = 'retrying';
          responsePayload.pathQuestion = null;
          responsePayload.wasDecomposed = false;
        }
      }

      const commandResponse: AuraCommandResponse = {
        ...gatedCommandResponse,
        payload: responsePayload,
      };
      const secondaryResponses = (gatedCommandResponse.actions ?? []).map((step): AuraCommandResponse => ({
        ...gatedCommandResponse,
        action: step.action,
        payload: step.payload,
        actions: undefined,
      }));

      const now = new Date();
      const localDate = data.localDate ?? getSaoPauloDateContext(now).dateKey;
      const currentTime = data.currentTime ?? formatTimeInZone(now, commandSession.timezone);
      const planResponses = await Promise.all(
        [commandResponse, ...secondaryResponses].map(async (response) => response.action === 'complete_items'
          ? {
            ...response,
            payload: {
              ...response.payload,
              items: await resolveAuraCompletionTargets({
                prisma,
                userId: data.userId,
                localDate,
                items: response.payload.items,
                capabilities,
              }),
            },
          }
          : response),
      );
      const planResponse = planResponses[0] ?? commandResponse;
      const preference = await prisma.userPreference.findUnique({
        where: { userId: data.userId },
        select: { gcalWriteCalendarId: true },
      }).catch(() => null);
      const defaultCalendarId = preference?.gcalWriteCalendarId || 'primary';
      const rawPayload = planResponse.payload as Record<string, unknown>;
      const targetDate = [rawPayload.date, rawPayload.localDate, rawPayload.newDate, localDate]
        .find((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
        ?? localDate;
      const busyWindows = capabilities.planner || capabilities.connectedCalendar
        ? await buildCommandBusyWindows({
          prisma,
          userId: data.userId,
          date: targetDate,
          calendarId: defaultCalendarId,
          timezone: commandSession.timezone,
        })
        : [];
      const builtPlans = planResponses.map((response) => AuraCommandPlanBuilderService.build({
        response,
        userMessage: data.message,
        sessionId: data.sessionId,
        sourceMessageId: sourceMessage.id,
        localDate,
        currentTime,
        defaultCalendarId,
        busyWindows,
        phase: typeof (req.body as any)?.phase === 'string' ? (req.body as any).phase : null,
        moodScore: runtimeContext.latestCheckinSignals?.moodScore ?? null,
        energyScore: runtimeContext.latestCheckinSignals?.energyScore ?? null,
      }));
      const primaryPlan = builtPlans[0] ?? AuraCommandPlanBuilderService.build({
        response: planResponse,
        userMessage: data.message,
        sessionId: data.sessionId,
        sourceMessageId: sourceMessage.id,
        localDate,
        currentTime,
        defaultCalendarId,
        busyWindows,
      });
      const combinedOperations = builtPlans.flatMap((plan) => plan.operations).filter((operation) => {
        if (!capabilities.planner && [
          'create_planner_task', 'adapt_agenda', 'postpone_timeline_task',
        ].includes(operation.type)) return false;
        if (!capabilities.habits && operation.type === 'create_habit') return false;
        if (!capabilities.connectedCalendar && operation.type === 'create_calendar_event') return false;
        if ((operation.type === 'update_item' || operation.type === 'delete_item') && operation.payload.targetType === 'timeline') {
          return capabilities.planner;
        }
        if ((operation.type === 'update_item' || operation.type === 'delete_item') && operation.payload.targetType === 'habit') {
          return capabilities.habits;
        }
        return true;
      });
      const combinedMissingFields = [...new Set(builtPlans.flatMap((plan) => plan.missingFields))];
      const commandPlan = {
        ...primaryPlan,
        status: combinedOperations.length > 0 ? 'proposed' as const : 'draft' as const,
        executionPolicy: builtPlans.some((plan) => plan.executionPolicy === 'review_required')
          ? 'review_required' as const
          : builtPlans.some((plan) => plan.executionPolicy === 'auto_apply')
            ? 'auto_apply' as const
            : 'clarification' as const,
        confidence: builtPlans.length > 0 ? Math.min(...builtPlans.map((plan) => plan.confidence)) : primaryPlan.confidence,
        missingFields: combinedMissingFields,
        operations: combinedOperations,
      };
      // Conversa, leitura de estado e recusa protegida não são um plano. Persistir
      // um card vazio faz a UI mostrar "0 ações" como se algo tivesse dado errado.
      const persistedPlan = commandPlan.operations.length > 0
        ? await AuraCommandPersistenceService.persistPlan({
          prisma,
          userId: data.userId,
          plan: commandPlan,
        })
        : null;
      await AuraCommandPersistenceService.appendMessage({
        prisma,
        userId: data.userId,
        sessionId: data.sessionId,
        role: 'assistant',
        content: commandResponse.assistantMessage,
      });

      const execution = data.mode === 'executor'
        && commandPlan.executionPolicy === 'auto_apply'
        && commandPlan.operations.length > 0
        ? await AuraCommandExecutorService.apply({
          prisma,
          calendarGateway: GCalService,
          userId: data.userId,
          planId: commandPlan.id,
          operationIds: commandPlan.operations.filter((operation) => operation.selected).map((operation) => operation.id),
          idempotencyKey: `${data.sessionId}:${sourceMessage.id}`,
          now,
          recordCheckin: (input, context) => checkinApplicationService.record(input, context),
          adaptAgenda: applyAuraAgendaAdaptation,
        })
        : null;
      const freshPlan = execution
        ? await prisma.auraCommandPlan.findFirst({
          where: { id: commandPlan.id, userId: data.userId },
          include: { operations: { orderBy: { createdAt: 'asc' } } },
        })
        : persistedPlan;

      writeSseEvent(res, 'assistant.completed', {
        sessionId: data.sessionId,
        response: {
          ...planResponse,
          riskSafety: commandRiskSafety,
          actions: planResponses.slice(1).map((step) => ({ action: step.action, payload: step.payload })),
        },
        plan: freshPlan ? serializeAuraCommandPlan(freshPlan) : null,
        execution,
      });

      // Longitudinal memory is best-effort and never delays/changes the answer.
      void auraMemoryIngestionService.ingest({
        userId: data.userId,
        messageId: `${data.sessionId}:${data.history.length}`,
        message: data.message,
        assistantReply: commandResponse.assistantMessage,
        history: data.history,
        locale: data.locale,
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

  app.get('/api/aura/command/session/:sessionId', async (req: Request, res: Response) => {
    try {
      const session = await AuraCommandPersistenceService.getSession({
        prisma,
        userId: (req as AuthRequest).userId,
        sessionId: req.params.sessionId,
      });
      if (!session) return res.status(404).json({ error: 'Airia command session not found' });
      return res.json({
        id: session.id,
        status: session.status,
        locale: session.locale,
        timezone: session.timezone,
        messages: session.messages,
        plans: session.plans.map(serializeAuraCommandPlan),
      });
    } catch (error) {
      console.error('[aura/command/session] Error:', error);
      return res.status(500).json({ error: 'Failed to load Airia command session' });
    }
  });

  app.patch('/api/aura/command/plans/:planId', async (req: Request, res: Response) => {
    try {
      const data = AuraCommandPlanPatchSchema.parse(req.body);
      const plan = await AuraCommandPersistenceService.updatePlan({
        prisma,
        userId: (req as AuthRequest).userId,
        planId: req.params.planId,
        changes: data.operations,
      });
      return res.json({ plan: serializeAuraCommandPlan(plan) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      const message = error instanceof Error ? error.message : 'Failed to update Airia command plan';
      const status = /não encontrado|not found/i.test(message) ? 404 : /não pode/i.test(message) ? 409 : 500;
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/aura/command/plans/:planId/apply', async (req: Request, res: Response) => {
    try {
      const data = AuraCommandPlanApplySchema.parse(req.body);
      const execution = await AuraCommandExecutorService.apply({
        prisma,
        calendarGateway: GCalService,
        userId: (req as AuthRequest).userId,
        planId: req.params.planId,
        operationIds: data.operationIds,
        idempotencyKey: data.idempotencyKey,
        recordCheckin: (input, context) => checkinApplicationService.record(input, context),
        adaptAgenda: applyAuraAgendaAdaptation,
      });
      const plan = await prisma.auraCommandPlan.findFirst({
        where: { id: req.params.planId, userId: (req as AuthRequest).userId },
        include: { operations: { orderBy: { createdAt: 'asc' } } },
      });
      return res.json({ execution, plan: serializeAuraCommandPlan(plan) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      const message = error instanceof Error ? error.message : 'Failed to apply Airia command plan';
      const status = /não encontrado|not found/i.test(message) ? 404 : /clarification|nenhuma ação/i.test(message) ? 409 : 500;
      return res.status(status).json({ error: message });
    }
  });

  const CaptureCreateSchema = z.object({
    kind: z.enum(['note', 'checklist']),
    title: z.string().trim().min(1).max(500),
    content: z.string().trim().max(30000).optional().default(''),
    items: z.array(z.object({
      id: z.string().trim().min(1).max(120).optional(),
      title: z.string().trim().min(1).max(500),
      done: z.boolean().optional().default(false),
    })).max(200).optional().default([]),
  });
  const CapturePatchSchema = CaptureCreateSchema.partial().extend({
    status: z.enum(['inbox', 'completed', 'archived']).optional(),
  });

  app.get('/api/captures', async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'inbox';
    if (!['inbox', 'completed', 'archived', 'all'].includes(status)) {
      return res.status(400).json({ error: 'Invalid capture status' });
    }
    const captures = await prisma.capture.findMany({
      where: {
        userId: (req as AuthRequest).userId,
        ...(status === 'all' ? {} : { status }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(captures);
  });

  app.post('/api/captures', async (req: Request, res: Response) => {
    try {
      const data = CaptureCreateSchema.parse(req.body);
      const capture = await prisma.capture.create({
        data: {
          userId: (req as AuthRequest).userId,
          ...data,
        },
      });
      return res.status(201).json(capture);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      return res.status(500).json({ error: 'Failed to create capture' });
    }
  });

  app.patch('/api/captures/:id', async (req: Request, res: Response) => {
    try {
      const data = CapturePatchSchema.parse(req.body);
      const updated = await prisma.capture.updateMany({
        where: { id: req.params.id, userId: (req as AuthRequest).userId },
        data,
      });
      if (updated.count === 0) return res.status(404).json({ error: 'Capture not found' });
      return res.json(await prisma.capture.findUnique({ where: { id: req.params.id } }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      return res.status(500).json({ error: 'Failed to update capture' });
    }
  });

  app.delete('/api/captures/:id', async (req: Request, res: Response) => {
    const deleted = await prisma.capture.deleteMany({
      where: { id: req.params.id, userId: (req as AuthRequest).userId },
    });
    if (deleted.count === 0) return res.status(404).json({ error: 'Capture not found' });
    return res.status(204).end();
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

      // Contar o que já fez também é conquista: cada item relatado volta com
      // comemoração própria. O que ela fez sem o app ajudar continua contando.
      const clearedTheDay = stillPending.length === 0;
      const rewards = [...matched, ...created].map((title, index) => ({
        title,
        ...buildCompletionReward({
          title,
          kind: 'task_done',
          reported: true,
          clearedTheDay: clearedTheDay && index === matched.length + created.length - 1,
          today: todayKey,
        }),
      }));

      return res.json({ matched, created, evaluation, rewards, clearedTheDay });
    } catch (err: any) {
      console.error('[aura/complete-report] error:', err);
      return res.status(500).json({ error: 'Falha ao registrar conclusões' });
    }
  });

  /**
   * GET /api/insights/weekly
  ...

   */
  /**
   * GET /api/progress
   * XP, nível e sequência calculados do que já existe — sem tabela nova e sem
   * risco de o número divergir do que a pessoa realmente fez.
   */
  app.get('/api/progress', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const localDate = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : new Date().toISOString().slice(0, 10);
      const since = new Date(`${localDate}T00:00:00.000Z`);
      since.setUTCDate(since.getUTCDate() - 120);

      const GOAL_EVENT_NAMES = ['objective_action_completed', 'objective_completed'];

      const [completions, doneBlocks, checkins, journalSessions, goalEventRows, objectives] = await Promise.all([
        prisma.habitCompletion.findMany({
          where: { date: { gte: since }, habit: { userId } },
          select: { date: true },
        }).catch(() => []),
        prisma.timelineBlock.findMany({
          where: { userId, status: 'completed', localDate: { gte: since } },
          select: { localDate: true },
        }).catch(() => []),
        prisma.dailyCheckin.findMany({
          where: { userId, localDate: { gte: since } },
          select: { localDate: true, stateLabel: true },
        }).catch(() => []),
        prisma.journalSession.findMany({
          where: { userId, status: 'completed', finalizedAt: { not: null } },
          select: { finalizedAt: true },
        }).catch(() => []),
        prisma.eventLog.findMany({
          where: { userId, eventName: { in: GOAL_EVENT_NAMES }, createdAt: { gte: since } },
          select: { eventName: true, createdAt: true },
        }).catch(() => []),
        // Piso dos contadores: os eventos só passaram a ser gravados agora, então
        // sem ler o estado atual dos objetivos quem já concluiu dezenas de ações
        // veria zero. Lê só o que precisa para contar.
        prisma.objective.findMany({
          where: { userId, archived: false },
          select: { progress: true, subgoals: true },
        }).catch(() => []),
      ]);

      const dayOf = (value: Date | string | null) => (
        value ? new Date(value).toISOString().slice(0, 10) : null
      );

      const events: ProgressEvent[] = [
        ...completions.map((row: { date: Date }) => ({ date: dayOf(row.date)!, kind: 'habit_done' as const })),
        ...doneBlocks.map((row: { localDate: Date }) => ({ date: dayOf(row.localDate)!, kind: 'task_done' as const })),
        ...checkins.map((row: { localDate: Date }) => ({ date: dayOf(row.localDate)!, kind: 'checkin' as const })),
        ...journalSessions
          .map((row: { finalizedAt: Date | null }) => dayOf(row.finalizedAt))
          .filter((day): day is string => Boolean(day))
          .map((day) => ({ date: day, kind: 'journal' as const })),
      ].filter((event) => Boolean(event.date));

      // A fase de cada dia é o que decide se a sequência pausa ou continua.
      const phaseByDate: Record<string, string | undefined> = {};
      for (const checkin of checkins as Array<{ localDate: Date; stateLabel: string | null }>) {
        const day = dayOf(checkin.localDate);
        if (day && checkin.stateLabel) phaseByDate[day] = checkin.stateLabel;
      }

      const goalEvents: ProgressEvent[] = (goalEventRows as Array<{ eventName: string; createdAt: Date }>)
        .map((row) => ({
          date: dayOf(row.createdAt)!,
          kind: (row.eventName === 'objective_completed' ? 'goal_completed' : 'goal_action_done') as ProgressEvent['kind'],
        }))
        .filter((event) => Boolean(event.date));

      const objectiveRows = objectives as Array<{ progress: number; subgoals: unknown }>;
      const floor = {
        actionsCompleted: objectiveRows.reduce((total, objective) => (
          total + (Array.isArray(objective.subgoals)
            ? (objective.subgoals as Array<{ done?: boolean }>).filter((s) => s?.done).length
            : 0)
        ), 0),
        goalsCompleted: objectiveRows.filter((objective) => objective.progress >= 100).length,
      };

      // Eventos de objetivo entram no XP junto com o resto: fechar micro-ação
      // vale progresso como qualquer outra conclusão do app.
      const progress = computeProgress({ events: [...events, ...goalEvents], today: localDate, phaseByDate });
      const counters = computeGoalCounters({ goalEvents, today: localDate, phaseByDate, floor });
      return res.json({ ...progress, streakMessage: streakMessage(progress.streak), counters });
    } catch (error) {
      console.error('[progress] Error:', error);
      return res.status(500).json({ error: 'Failed to compute progress' });
    }
  });

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
    const objectivePathProposals = await reviewObjectivePathsAfterContext(
      userId,
      finalization.summary.summary,
      'journal',
    ).catch((error) => {
      console.warn('[objective-revision] falha após finalizar diário:', error);
      return [];
    });

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
      objectivePathProposals,
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
            // Modelo e temperatura vêm dos helpers, nunca fixos aqui: um
            // `model` hardcoded ignora o OPENAI_MODEL e cria uma ponta que
            // diverge do resto do app. E `temperature: 0.7` cru dava 400 em
            // qualquer modelo gpt-5/o-series, que só aceitam o default.
            const microStepModel = getOpenAiModel();
            const completion = await openai.chat.completions.create({
              model: microStepModel,
              max_completion_tokens: getOpenAiMaxCompletionTokens(60),
              ...openAiTemperature(microStepModel, 0.7),
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

    // Retorno de conclusão por bloco. O cliente sabe qual item ele acabou de
    // fechar e mostra a comemoração desse — é o que fecha o ciclo na hora.
    const clearedTheDay = savedBlocks.every((block: { status?: string }) => block.status === 'completed');
    const rewards: Record<string, ReturnType<typeof buildCompletionReward>> = {};
    for (const block of completedBlocks) {
      rewards[block.id] = buildCompletionReward({
        title: block.title,
        kind: 'task_done',
        clearedTheDay,
        today: date,
      });
    }

    return res.json({
      savedBlocks,
      conflicts, // Retornamos conflitos de forma passiva se forceSave for true
      rewards,
      clearedTheDay,
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
      const [prefs, profile, onboarding] = await Promise.all([
        prisma.userPreference.findUnique({ where: { userId } }),
        prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true } }),
        // O gate do bloco menstrual vive aqui porque /api/preferences já é
        // buscado por toda superfície que precisa dele. Um endpoint novo só
        // para um campo somaria uma requisição em cada tela.
        prisma.onboardingResponse.findUnique({
          where: { userId },
          select: { biologicalSex: true },
        }).catch(() => null),
      ]);
      const biologicalSex = (onboarding?.biologicalSex as BiologicalSex | null | undefined) ?? null;
      return res.json({
        ...(prefs ?? defaultUserPreferences),
        morningCheckinTime: prefs?.morningCheckinTime ?? DEFAULT_MORNING_CHECKIN_TIME,
        eveningReviewTime: prefs?.eveningReviewTime ?? DEFAULT_EVENING_REVIEW_TIME,
        notificationPreferences: normalizeNotificationPreferences(
          prefs?.notificationPreferences ?? defaultUserPreferences.notificationPreferences,
        ),
        fullName: profile?.fullName ?? null,
        biologicalSex,
        tracksMenstrualCycle: tracksMenstrualCycle(biologicalSex),
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
   * POST /api/actions/check-equivalent
   * Diz se uma ação nova já existe na lista, por significado.
   *
   * O cliente roda o filtro lexical antes e só chega aqui quando nada casou —
   * então esta chamada é o caso difícil: sinônimo real, que sobreposição de
   * palavras não pega ("comprar pão" x "passar na padaria").
   */
  app.post('/api/actions/check-equivalent', async (req: Request, res: Response) => {
    try {
      const data = z.object({
        candidate: z.string().trim().min(1).max(300),
        existing: z.array(z.object({
          id: z.string().trim().min(1).max(120),
          text: z.string().trim().min(1).max(300),
        })).max(60).default([]),
      }).parse(req.body ?? {});

      const result = await findEquivalentActionWithLlm({
        candidate: data.candidate,
        existing: data.existing,
      });
      return res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[actions/check-equivalent] Error:', error);
      // Falhar aqui não pode impedir a pessoa de registrar a ação dela.
      return res.json({ duplicateOf: null, reason: null, degraded: true });
    }
  });

  /**
   * GET /api/privacy/consents
   * Histórico de consentimento da usuária (LGPD Art. 9: direito a saber o que
   * consentiu, quando e em qual versão do documento).
   */
  app.get('/api/privacy/consents', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const records = await prisma.consent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      return res.json({
        currentVersion: CURRENT_CONSENT_VERSION,
        consents: summarizeConsents(records),
      });
    } catch (error: any) {
      console.error('[privacy/consents] Error:', error);
      return res.status(500).json({ error: 'Failed to read consents' });
    }
  });

  /**
   * POST /api/privacy/consents/revoke
   * Revogação de consentimento (LGPD Art. 8 §5). Marca a revogação e preserva
   * o histórico — apagar destruiria a prova de que houve consentimento antes.
   * Revogar não apaga dados: para isso existe /api/privacy/delete-request.
   */
  app.post('/api/privacy/consents/revoke', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { consentType } = z
        .object({ consentType: z.enum(CONSENT_TYPES) })
        .parse(req.body);
      const revoked = await revokeConsent(prisma.consent, userId, consentType, new Date());
      return res.json({ consentType, revoked });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[privacy/consents/revoke] Error:', error);
      return res.status(500).json({ error: 'Failed to revoke consent' });
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
  app.get('/api/capabilities', (_req: Request, res: Response) => res.json(capabilities));

  app.get('/api/objectives', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const [objectives, preferences] = await Promise.all([
        prisma.objective.findMany({ where: { userId, archived: false }, orderBy: { createdAt: 'asc' } }),
        prisma.userPreference.findUnique({ where: { userId }, select: { primaryObjectiveId: true } }),
      ]);
      return res.json(objectives.map((objective) => serializeObjective(objective, preferences?.primaryObjectiveId ?? null)));
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
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      locale: z.string().default('pt-BR'),
    }).strict();
    try {
      const data = Schema.parse(req.body);
      const obj = await prisma.objective.create({
        data: {
          userId,
          title: data.title,
          description: data.description,
          category: data.category,
          deadline: data.deadline ? new Date(`${data.deadline}T00:00:00.000Z`) : null,
          subgoals: [],
          pathStatus: 'not_started',
          milestones: [],
        },
      });
      // Vetoriza a meta (fire-and-forget)
      memoryService.store({
        userId,
        contentType: 'goal',
        contentId: obj.id,
        content: `Meta: ${data.title}${data.description ? `. ${data.description}` : ''}`,
        metadata: { category: data.category, objectiveId: obj.id, progress: obj.progress, archived: obj.archived },
      }).catch(() => {});
      let pathGenerationFailed = false;
      try {
        const context = await loadObjectiveIntelligenceContext(prisma, userId, obj.id);
        await objectivePathService.generate({ userId, objectiveId: obj.id, locale: data.locale, ...context });
      } catch (pathError) {
        pathGenerationFailed = true;
        console.warn(`[objectives/create] objetivo ${obj.id} preservado para nova tentativa:`, pathError);
        await prisma.objective.updateMany({
          where: { id: obj.id, userId },
          data: { pathStatus: 'retrying', pathQuestion: null },
        }).catch(() => ({ count: 0 }));
      }
      const created = await prisma.objective.findFirst({ where: { id: obj.id, userId } });
      return res.status(201).json(serializeObjective(pathGenerationFailed
        ? { ...(created ?? obj), pathStatus: 'retrying', pathQuestion: null }
        : (created ?? obj)));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[objectives/create] Error:', error);
      return res.status(500).json({ error: 'Failed to create objective' });
    }
  });

  app.post('/api/objectives/recover-actions', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const locale = typeof (req.body as any)?.locale === 'string'
        ? String((req.body as any).locale)
        : 'pt-BR';
      const result = await objectiveActionRecoveryService.recover({ userId, locale });
      return res.json(result);
    } catch (error) {
      console.error('[objectives/recover-actions] Error:', error);
      return res.status(500).json({ error: 'Failed to recover objective actions' });
    }
  });

  const sendObjectivePathError = (error: unknown, res: Response) => {
    if (error instanceof ObjectivePathNotFoundError) return res.status(404).json({ error: 'objective_not_found' });
    if (error instanceof ObjectivePathConflictError) return res.status(409).json({ error: 'objective_path_changed' });
    if (error instanceof ObjectivePathInvalidProposalError) return res.status(422).json({ error: error.message });
    console.error('[objective-path] Error:', error);
    return res.status(500).json({ error: 'objective_path_failed' });
  };

  app.post('/api/objectives/:id/path/generate', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { locale, userStatements } = z.object({
        locale: z.string().default('pt-BR'),
        userStatements: z.array(z.string().trim().min(1).max(2000)).max(8).optional().default([]),
      }).parse(req.body ?? {});
      const context = await loadObjectiveIntelligenceContext(prisma, userId, req.params.id);
      const result = await objectivePathService.generate({
        userId, objectiveId: req.params.id, locale, ...context,
        userStatements: [...context.userStatements, ...userStatements],
      });
      const objective = await prisma.objective.findFirst({ where: { id: req.params.id, userId } });
      return res.json({ ...result, objective: objective ? serializeObjective(objective) : null });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      return sendObjectivePathError(error, res);
    }
  });

  app.post('/api/objectives/:id/path/answer', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = z.object({ answer: z.string().trim().min(1).max(2000), locale: z.string().default('pt-BR') }).parse(req.body);
      const context = await loadObjectiveIntelligenceContext(prisma, userId, req.params.id);
      const result = await objectivePathService.answer({
        userId, objectiveId: req.params.id, locale: data.locale, answer: data.answer,
        ...context,
        userStatements: context.userStatements,
      });
      await canonicalMemoryService.write({
        userId, kind: 'context', scope: `objective:${req.params.id}`,
        canonicalKey: `objective.${req.params.id}.answer`, content: data.answer,
        confidence: 1, salience: 0.8, source: 'objective_path_answer', sourceId: `${req.params.id}:${result.pathVersion}`,
        targetType: 'objective', targetId: req.params.id,
      }).catch((error: unknown) => console.error('[objective-path/answer] canonical memory failed:', error));
      const objective = await prisma.objective.findFirst({ where: { id: req.params.id, userId } });
      return res.json({ ...result, objective: objective ? serializeObjective(objective) : null });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      return sendObjectivePathError(error, res);
    }
  });

  app.post('/api/objectives/:id/path/advance', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = z.object({ expectedVersion: z.number().int().positive(), locale: z.string().default('pt-BR') }).parse(req.body);
      const context = await loadObjectiveIntelligenceContext(prisma, userId, req.params.id);
      const result = await objectivePathService.advance({
        userId, objectiveId: req.params.id, expectedVersion: data.expectedVersion, locale: data.locale, ...context,
      });
      const objective = await prisma.objective.findFirst({ where: { id: req.params.id, userId } });
      return res.json({ ...result, objective: objective ? serializeObjective(objective) : null });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      return sendObjectivePathError(error, res);
    }
  });

  app.post('/api/objectives/:id/path/propose-revision', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = z.object({ reason: z.string().trim().min(3).max(2000), locale: z.string().default('pt-BR') }).parse(req.body);
      const context = await loadObjectiveIntelligenceContext(prisma, userId, req.params.id);
      const result = await objectivePathService.proposeRevision({
        userId, objectiveId: req.params.id, locale: data.locale, reason: data.reason, ...context,
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      return sendObjectivePathError(error, res);
    }
  });

  app.post('/api/objectives/:id/path/confirm-revision', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { expectedVersion } = z.object({ expectedVersion: z.number().int().positive() }).parse(req.body);
      const result = await objectivePathService.confirmRevision({ userId, objectiveId: req.params.id, expectedVersion });
      const objective = await prisma.objective.findFirst({ where: { id: req.params.id, userId } });
      return res.json({ ...result, objective: objective ? serializeObjective(objective) : null });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      return sendObjectivePathError(error, res);
    }
  });

  app.put('/api/objectives/primary', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { objectiveId } = z.object({ objectiveId: z.string().uuid().nullable() }).parse(req.body);
      if (objectiveId) {
        const exists = await prisma.objective.findFirst({ where: { id: objectiveId, userId, archived: false, pausedAt: null }, select: { id: true } });
        if (!exists) return res.status(404).json({ error: 'objective_not_found' });
      }
      await prisma.$transaction(async (transaction) => {
        await transaction.userPreference.upsert({
          where: { userId },
          update: { primaryObjectiveId: objectiveId },
          create: { userId, ...defaultUserPreferences, primaryObjectiveId: objectiveId },
        });
        await transaction.eventLog.create({
          data: { userId, eventName: 'objective_primary_changed', properties: { objectiveId, source: 'manual' } },
        });
      });
      return res.json({ objectiveId, source: objectiveId ? 'manual' : null });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[objectives/primary] Error:', error);
      return res.status(500).json({ error: 'Failed to update primary objective' });
    }
  });

  app.post('/api/objectives/:id/actions', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = z.object({
        expectedVersion: z.number().int().positive(),
        title: z.string().trim().min(1).max(300),
        scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      }).parse(req.body);
      const objective = await prisma.objective.findFirst({ where: { id: req.params.id, userId, archived: false } });
      if (!objective) return res.status(404).json({ error: 'objective_not_found' });
      if (objective.pathVersion !== data.expectedVersion) return res.status(409).json({ error: 'objective_path_changed' });
      const actions = normalizeObjectiveSubgoals(objective.subgoals);
      const milestones = Array.isArray(objective.milestones) ? objective.milestones as Array<{ id?: string }> : [];
      const currentMilestoneId = actions.find((action) => (
        !action.done && action.status !== 'rejected' && action.status !== 'deferred'
      ))?.milestoneId ?? milestones[0]?.id ?? 'manual-current';
      const action = {
        id: randomUUID(), title: data.title, done: false, order: actions.length, aiGenerated: false, userEdited: true,
        milestoneId: currentMilestoneId, scheduledFor: data.scheduledFor ?? null, status: 'pending' as const,
      };
      const committed = await prisma.$transaction(async (transaction) => {
        const write = await transaction.objective.updateMany({
          where: { id: objective.id, userId, pathVersion: data.expectedVersion },
          data: { subgoals: [...actions, action] as any, pathVersion: { increment: 1 }, pathStatus: 'ready' },
        });
        if (write.count !== 1) return false;
        await transaction.eventLog.create({ data: { userId, eventName: 'objective_action_created', properties: { objectiveId: objective.id, actionId: action.id, title: action.title, source: 'manual', toVersion: data.expectedVersion + 1 } } });
        await new CanonicalMemoryService(transaction).write({
          userId, kind: 'decision', scope: `objective:${objective.id}`,
          canonicalKey: `objective.${objective.id}.action.${action.id}.manual`, content: action.title,
          confidence: 1, salience: 0.8, source: 'objective_action_created', sourceId: action.id,
          targetType: 'objective_action', targetId: action.id,
        });
        return true;
      });
      if (!committed) return res.status(409).json({ error: 'objective_path_changed' });
      return res.status(201).json({ action, pathVersion: data.expectedVersion + 1 });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[objectives/action-create] Error:', error);
      return res.status(500).json({ error: 'Failed to create objective action' });
    }
  });

  app.patch('/api/objectives/:id/actions/:actionId', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const data = z.object({
        expectedVersion: z.number().int().positive(),
        title: z.string().trim().min(1).max(300).optional(),
        scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        state: z.enum(['pending', 'done', 'rejected', 'deferred']).optional(),
      }).refine((value) => value.title !== undefined || value.scheduledFor !== undefined || value.state !== undefined, 'empty action patch').parse(req.body);
      const objective = await prisma.objective.findFirst({ where: { id: req.params.id, userId, archived: false } });
      if (!objective) return res.status(404).json({ error: 'objective_not_found' });
      if (objective.pathVersion !== data.expectedVersion) return res.status(409).json({ error: 'objective_path_changed' });
      const actions = normalizeObjectiveSubgoals(objective.subgoals);
      const current = actions.find((action) => action.id === req.params.actionId);
      if (!current) return res.status(404).json({ error: 'objective_action_not_found' });
      if (current.done && (data.title !== undefined || data.scheduledFor !== undefined || (data.state && data.state !== 'done'))) {
        return res.status(409).json({ error: 'completed_action_is_protected' });
      }
      const now = new Date().toISOString();
      const updatedActions = actions.map((action) => action.id !== current.id ? action : {
        ...action,
        ...(data.title !== undefined ? { title: data.title, userEdited: true } : {}),
        ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor, userEdited: true } : {}),
        ...(data.state ? {
          status: data.state,
          done: data.state === 'done',
          rejectedAt: data.state === 'rejected' ? now : null,
          deferredAt: data.state === 'deferred' ? now : null,
        } : {}),
      });
      const eventName = data.state
        ? `objective_action_${data.state}`
        : data.scheduledFor !== undefined
          ? 'objective_action_scheduled'
          : 'objective_action_edited';
      const write = await prisma.$transaction(async (transaction) => {
        const result = await transaction.objective.updateMany({
          where: { id: objective.id, userId, pathVersion: data.expectedVersion },
          data: { subgoals: updatedActions, pathVersion: { increment: 1 }, pathProposal: null, pathProposalCreatedAt: null } as any,
        });
        if (result.count !== 1) return false;
        await transaction.eventLog.create({
          data: { userId, eventName, properties: { objectiveId: objective.id, actionId: current.id, title: data.title ?? current.title, scheduledFor: data.scheduledFor, fromVersion: data.expectedVersion, toVersion: data.expectedVersion + 1 } },
        });
        const memoryState = data.state ?? (data.scheduledFor !== undefined ? 'scheduled' : 'edited');
        const negativeState = data.state === 'rejected' ? 'rejected' : data.state === 'done' ? 'completed' : data.state === 'deferred' ? 'scheduled' : null;
        await new CanonicalMemoryService(transaction).write({
          userId, kind: 'decision', scope: `objective:${objective.id}`,
          canonicalKey: `objective.${objective.id}.action.${current.id}.${memoryState}`,
          content: [
            `${memoryState}: ${data.title ?? current.title}`,
            data.scheduledFor !== undefined ? `Data: ${data.scheduledFor ?? 'sem data'}` : '',
          ].filter(Boolean).join('\n'),
          confidence: 1, salience: 0.7, source: eventName, sourceId: `${current.id}:${data.expectedVersion + 1}`,
          negativeState, targetType: 'objective_action', targetId: current.id,
        });
        return true;
      });
      if (!write) return res.status(409).json({ error: 'objective_path_changed' });
      return res.json({ action: updatedActions.find((action) => action.id === current.id), pathVersion: data.expectedVersion + 1 });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[objectives/action-patch] Error:', error);
      return res.status(500).json({ error: 'Failed to update objective action' });
    }
  });

  app.get('/api/daily-priorities', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const { localDate } = z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query);
      const [objectives, preferences, context] = await Promise.all([
        prisma.objective.findMany({ where: { userId, archived: false, pausedAt: null, progress: { lt: 100 } }, orderBy: { updatedAt: 'desc' } }),
        prisma.userPreference.findUnique({ where: { userId }, select: { primaryObjectiveId: true } }),
        loadObjectiveIntelligenceContext(prisma, userId, ''),
      ]);
      const result = await DailyPrioritiesService.prioritize({
        localDate,
        objectives: objectives.map((objective) => ({ ...objective, deadline: objectiveDate(objective.deadline) })),
        manualPrimaryObjectiveId: preferences?.primaryObjectiveId ?? null,
        contextStatements: context.userStatements,
      });
      return res.json({ ...result, capabilities });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
      console.error('[daily-priorities] Error:', error);
      return res.status(500).json({ error: 'Failed to build daily priorities' });
    }
  });

  app.post('/api/objectives/:id/subgoals/:subgoalId/complete', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      // localDate vem do cliente porque a sequência é contada no fuso da
      // usuária. Sem isso, quem conclui às 22h no Brasil teria a ação contada
      // no dia seguinte, e a sequência quebraria sozinha.
      const { localDate } = z
        .object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
        .parse(req.body ?? {});
      const completionDate = localDate ?? new Date().toISOString().slice(0, 10);

      const result = await objectiveProgressionService.completeActiveAction({
        userId,
        objectiveId: req.params.id,
        subgoalId: req.params.subgoalId,
      });

      if (!result.completedNow) {
        return res.status(200).json({ ...result, reward: null });
      }

      const completedAction = Array.isArray(result.subgoals)
        ? (result.subgoals as Array<{ id?: string; title?: string }>).find((s) => s?.id === req.params.subgoalId)
        : undefined;
      const actionTitle = completedAction?.title ?? 'ação';

      // Telemetria de gamificação nunca pode derrubar a conclusão: o trabalho
      // da usuária já foi salvo pela transação acima. Daí o catch silencioso.
      const eventsToLog = [
        { eventName: 'objective_action_completed', properties: { objectiveId: req.params.id, subgoalId: req.params.subgoalId, title: actionTitle, localDate: completionDate } },
        ...(result.objectiveCompletedNow
          ? [{ eventName: 'objective_completed', properties: { objectiveId: req.params.id, localDate: completionDate } }]
          : []),
      ];
      await Promise.all(eventsToLog.map((event) => (
        prisma.eventLog.create({ data: { userId, eventName: event.eventName, properties: event.properties } })
          .catch((error: unknown) => { console.error('[objectives/complete-subgoal] event log failed:', error); })
      )));

      await canonicalMemoryService.write({
        userId, kind: 'decision', scope: `objective:${req.params.id}`,
        canonicalKey: `objective.${req.params.id}.action.${req.params.subgoalId}.completed`,
        content: `Concluída: ${actionTitle}`,
        confidence: 1, salience: 0.8, source: 'objective_action_completed',
        sourceId: `${req.params.subgoalId}:${completionDate}`,
        negativeState: 'completed', targetType: 'objective_action', targetId: req.params.subgoalId,
      }).catch((error: unknown) => console.error('[objectives/complete-subgoal] canonical memory failed:', error));
      const completedObjective = await prisma.objective.findFirst({ where: { id: req.params.id, userId } }).catch(() => null);
      await projectObjectivePathToMemory(completedObjective, 'objective_action_completed')
        .catch((error: unknown) => console.error('[objectives/complete-subgoal] path projection failed:', error));

      const reward = buildCompletionReward({
        title: actionTitle,
        kind: result.objectiveCompletedNow ? 'goal_completed' : 'goal_action_done',
        today: completionDate,
      });

      return res.status(200).json({ ...result, reward });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      if (error instanceof ObjectiveProgressionError) {
        return res.status(error.code === 'objective_not_found' ? 404 : 409).json({ error: error.code });
      }
      console.error('[objectives/complete-subgoal] Error:', error);
      return res.status(500).json({ error: 'Failed to complete objective action' });
    }
  });

  /**
   * PATCH /api/objectives/:id
   * Atualiza somente metadados do objetivo. Ações usam endpoints versionados.
   */
  app.patch('/api/objectives/:id', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;
    const Schema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      aiInsight: z.string().nullable().optional(),
      archived: z.boolean().optional(),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      pausedAt: z.string().datetime().nullable().optional(),
    }).strict().refine((value) => Object.keys(value).length > 0, 'empty objective patch');
    try {
      const data = Schema.parse(req.body);
      const { deadline, pausedAt, ...plainData } = data;
      const obj = await prisma.objective.updateMany({
        where: { id, userId },
        data: {
          ...plainData,
          ...(deadline !== undefined ? { deadline: deadline ? new Date(`${deadline}T00:00:00.000Z`) : null } : {}),
          ...(pausedAt !== undefined ? { pausedAt: pausedAt ? new Date(pausedAt) : null } : {}),
          pathVersion: { increment: 1 },
          pathProposal: null,
          pathProposalCreatedAt: null,
        } as any,
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
      return res.json(updated
        ? { ...updated, subgoals: normalizeObjectiveSubgoals(Array.isArray(updated.subgoals) ? updated.subgoals : []) }
        : updated);
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
    // Sem lista, a Airia aplica sozinha o que não exige aval humano. Lista vazia
    // explícita continua significando "não aplique nada".
    selectedDecisionIds: z.array(z.string().min(1)).optional(),
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

      /**
       * Objetivo e próxima ação saem do fluxo de prompt único.
       *
       * As outras superfícies fazem uma chamada e devolvem o texto. Estas duas
       * precisam de geração + guarda determinística + validação adversarial,
       * porque é aqui que a IA inventava obstáculo ("pegue um rolo de fita
       * crepe") a partir de um objetivo que ninguém detalhou. Uma chamada só
       * não tem como se auto-reprovar.
       */
      if (type === 'goal-subtasks' || type === 'checkin-next-step') {
        // O perfil vem do banco, não do corpo da requisição. Se dependesse da
        // tela mandar, cada superfície nova nasceria sem personalização e o
        // onboarding teria sido preenchido à toa.
        const operationalProfile = await OperationalProfileService.get(prisma, userId);
        const verifiedGoalMemory = await canonicalMemoryService.retrieve({
          userId,
          query: getRagIntent(type, context),
          locale: typeof context.locale === 'string' ? context.locale : 'pt-BR',
          limit: 12,
        }).catch(() => null);
        if (verifiedGoalMemory) {
          const verifiedPatterns = verifiedGoalMemory.memories.filter((memory) => memory.kind === 'pattern');
          context.verifiedPatternContext = canonicalMemoryService.formatForPrompt(verifiedGoalMemory, typeof context.locale === 'string' ? context.locale : 'pt-BR');
          context.patternEvidenceRefs = verifiedPatterns.flatMap((memory) => [
            `pattern:${memory.id}`,
            ...((memory.structuredValue?.evidenceIds as unknown[] | undefined) ?? []).filter((id): id is string => typeof id === 'string').map((id) => `evidence:${id}`),
          ]);
          context.patternBasis = verifiedPatterns.map((memory) => ({
            pattern: memory.content,
            evidenceCount: Number(memory.structuredValue?.evidenceCount ?? 0),
            distinctDays: Number(memory.structuredValue?.distinctDays ?? 0),
            windowDays: Number(memory.structuredValue?.windowDays ?? 14),
            confidence: Number(memory.confidence ?? 0),
            limitation: 'Associação observada; não prova causa nem diagnóstico.',
            impact: 'Pode calibrar prioridade, tamanho, ordem, duração, ritmo, proteção ou adiamento da Ação atual.',
          }));
        }
        const decomposition = await GoalIntelligenceService.decompose({
          ...buildGoalIntelligenceInput({ type, context, userName, ragContext }),
          operationalProfile,
        });

        const items = decomposition.steps.map((step) => step.title);
        const suggestion = {
          mode: decomposition.mode,
          items,
          question: decomposition.question,
          resultDefinition: decomposition.resultDefinition,
          assumptions: decomposition.assumptions,
        };

        if (items.length > 0) {
          SuggestionMemoryService.append(prisma, userId, type, items).catch(() => {});
        }
        if ((decomposition.rejectedSteps ?? []).length > 0) {
          console.info(
            `[ai/suggest] type=${type} descartou ${decomposition.rejectedSteps!.length} passo(s) sem lastro:`,
            decomposition.rejectedSteps!.map((item) => `${item.title} — ${item.reason}`).join(' | '),
          );
        }
        return res.json({ suggestion });
      }

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
- LEITURA TOTAL: cruze histórico de humor, estado atual, memória canônica, objetivos, ações e relatos recentes antes de sugerir. Contextos legados de planner/hábitos/agenda só valem se estiverem explicitamente habilitados pelo produto.
- Não descreva só o óbvio; identifique implicação prática.
- Soe como quem monitora e antecipa, não como quem espera nova crise para reagir.
- As sugestões devem nascer dos sinais reais do histórico, não de conselhos genéricos.
- Use histórico, memória canônica e estado atual para o "pattern" e o "insight"; para "actions", use apenas Objetivos ativos, Ações pendentes, intenção/relato atual ou âncoras reais de hoje. Um padrão verificado pode calibrar uma ação já ancorada, mas não cria sozinho um destino operacional.
- Se não houver âncora real de hoje para uma ação, retorne menos ações ou "actions": [].
- Não use tema recorrente, memória antiga ou fase de humor para inventar tarefa que não existe hoje.
- Só sugira treino, exercício, ginástica, academia, roupa de treino ou kit de treino se isso aparecer explicitamente em um Objetivo, Ação, intenção/relato atual ou âncora real de hoje.
- Não sugira o que já aparece como concluído em agenda, hábitos, metas ou subtarefas.
- Não transforme coisa concluída em próxima ação. Use concluídos apenas como evidência no "pattern" ou "insight".
- Não ressuscite ação que a pessoa marcou como feita, pulou, excluiu ou agendou pelo card.
- Misture quando fizer sentido: micro-ação regulatória, tarefa prática curta e compromisso simples/agendável.
- As sugestões devem reduzir atrito, estabilizar rotina, proteger energia ou conter impulsividade.
- Prefira intervenções concretas de regulação: proteger sono, reduzir carga social, fracionar tarefa, cortar estímulo, ancorar rotina, criar pausa antes de agir no automático.
- Só use corpo/respiração/água/alongamento se houver evidência explícita e atual de corpo, sede, tensão física ou sono. Do contrário, prefira ação ligada à vida real trazida no contexto.
- Se a única sugestão possível for genérica, retorne "actions": [].
- Se houver âncora real, tente entregar próximo passo ou ajuste aplicável ao Objetivo/Ação. Não crie tarefa, hábito ou ajuste de agenda em superfícies legadas desabilitadas.
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
        // Relatório de período. O que estava errado antes: o payload mandava a
        // FASE DE HOJE e o contexto "leitura atual", então o texto falava do dia
        // e só citava o período de passagem. Aqui nada de hoje entra — só
        // agregados da janela, e o prompt proíbe explicitamente esse desvio.
        const p = (context.periodData ?? {}) as Record<string, any>;
        const range = (p.range ?? {}) as Record<string, any>;
        const num = (value: unknown, suffix = '') => (
          value === null || value === undefined ? '—' : `${value}${suffix}`
        );
        const half = (h: any, name: string) => (
          h ? `${name}: humor ${num(h.avgMood)}/10, energia ${num(h.avgEnergy)}/10 (${num(h.observed)} dias com registro)` : `${name}: sem dados`
        );

        const samplingWarning = p.sampling === 'low'
          ? 'AMOSTRAGEM BAIXA: menos de 30% dos dias têm registro. Diga isso na primeira seção e trate toda leitura como indício, nunca como conclusão firme. Não invente padrão que os dados não sustentam.'
          : p.sampling === 'medium'
            ? 'AMOSTRAGEM PARCIAL: entre 30% e 60% dos dias têm registro. Aponte a limitação uma vez e siga.'
            : 'AMOSTRAGEM BOA: mais de 60% dos dias têm registro.';

        prompt = `Você é a Airia, acompanhando ${userName}. Escreva o relatório do período ${range.label ?? ''} (${range.start ?? '—'} a ${range.end ?? '—'}).

DADOS AGREGADOS DO PERÍODO — é a sua única base:
- Janela: ${num(p.windowDays)} dias | com registro: ${num(p.observedDays)} | sem registro: ${num(p.missingDays)} | cobertura ${num(p.coverage)}
- Humor médio do período: ${num(p.avgMood)}/10 | Energia média: ${num(p.avgEnergy)}/10
- Variabilidade no período: ${num(p.volatility)}
- ${half(p.firstHalf, 'Primeira metade')}
- ${half(p.secondHalf, 'Segunda metade')}
- Diferença entre metades: humor ${num(p.moodDelta)} | energia ${num(p.energyDelta)}
- Melhor dia: ${p.bestDay ? `${p.bestDay.date} (humor ${p.bestDay.mood}, energia ${p.bestDay.energy})` : '—'}
- Pior dia: ${p.worstDay ? `${p.worstDay.date} (humor ${p.worstDay.mood}, energia ${p.worstDay.energy})` : '—'}
- Dias com humor baixo e energia alta ao mesmo tempo: ${num(p.divergentDays)}
- Maior sequência sem registro: ${num(p.longestGapDays)} dias
- Média de humor por dia da semana: ${JSON.stringify(p.weekdayAverages ?? [])}
- Fatores associados a humor no período: ${JSON.stringify(p.topFactors ?? [])}

${samplingWarning}

REGRA QUE MANDA EM TUDO:
Este relatório analisa O PERÍODO INTEIRO. É PROIBIDO transformá-lo em leitura do dia atual — para isso existem o check-in e o resumo do dia. Só cite um dia específico quando ele for extremo do período ou parte de um padrão que você está demonstrando, e mesmo assim em uma frase.

ESTRUTURA (use estes títulos, pule seção sem dado em vez de inventar):
1. Resumo do período
2. Quantidade e consistência dos registros
3. Principais padrões identificados
4. Aspectos positivos
5. Aspectos negativos ou pontos de atenção
6. Oscilações de humor e energia
7. Comportamentos e hábitos recorrentes
8. Relação entre ações, contexto e resultados
9. Gatilhos ou fatores associados
10. Evoluções e regressões
11. Comparação entre o início e o final do período
12. Conclusões principais
13. Próximas ações recomendadas

COMO ESCREVER:
- Documento para consultar, guardar e levar a uma conversa profissional. Pode ser longo.
- Cada afirmação apoiada num número dos dados acima. Sem número, não afirme.
- Associação não é causa: escreva "aparece junto de", não "causou".
- Linguagem acessível, sem jargão clínico. Nunca nomeie transtorno nem sugira diagnóstico.
- As próximas ações recomendadas saem do que os dados mostram, sem data e sem horário.
- Português, markdown com os títulos numerados acima.`;
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
        select: { gcalSelectedCalendars: true, gcalWriteCalendarId: true }
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
      const input = z.object({
        email: z.string().email().optional(),
        plan: z.enum(['monthly', 'annual', 'lifetime']),
        attemptKey: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9:._-]+$/).optional(),
      }).parse(req.body);
      const headerKey = req.headers['idempotency-key'];
      const normalizedHeaderKey = typeof headerKey === 'string' ? headerKey.trim() : '';
      const attemptKey = normalizedHeaderKey.length >= 8
        && normalizedHeaderKey.length <= 100
        && /^[a-zA-Z0-9:._-]+$/.test(normalizedHeaderKey)
        ? normalizedHeaderKey
        : input.attemptKey ?? randomUUID();
      const url = await stripeService.createCheckoutSession(
        userId,
        input.email,
        input.plan,
        attemptKey,
      );
      return res.json({ url });
    } catch (error: any) {
      if (error instanceof z.ZodError || error?.message === 'invalid_plan') {
        return res.status(400).json({ error: 'invalid_plan' });
      }
      if (
        error?.message === 'billing_unavailable'
        || error?.message === 'billing_plan_unavailable'
        || error?.message === 'lifetime_offer_unavailable'
      ) return res.status(503).json({ error: error.message });
      return res.status(500).json({ error: 'checkout_failed' });
    }
  });

  app.post('/api/billing/portal', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const url = await stripeService.createPortalSession(userId);
      return res.json({ url });
    } catch (err: any) {
      if (err.message === 'no_stripe_customer') return res.status(404).json({ error: 'no_subscription' });
      if (err.message === 'billing_unavailable') return res.status(503).json({ error: err.message });
      return res.status(500).json({ error: 'portal_failed' });
    }
  });

  app.get('/api/billing/status', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const data = await billingAccessService.getSummary(userId);
      return res.json({ ...data, offers: stripeService.getOfferCatalog() });
    } catch {
      return res.status(500).json({ error: 'status_failed' });
    }
  });

  app.get('/api/billing/checkout-session/:sessionId', async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      const sessionId = z.string().trim().min(1).max(255).parse(req.params.sessionId);
      const result = await stripeService.verifyCheckoutSession(userId, sessionId);
      return res.json(result);
    } catch (error: any) {
      if (error?.message === 'checkout_session_forbidden') {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'invalid_session' });
      if (error?.message === 'billing_unavailable') return res.status(503).json({ error: error.message });
      return res.status(500).json({ error: 'checkout_verification_failed' });
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
  app.post('/api/ai/voice-checkin', async (req: Request, res: Response) => {
    try {
      const { transcript, localDate, sourceMessageId } = req.body as {
        transcript?: string;
        localDate?: string;
        sourceMessageId?: string;
      };
      if (!transcript || transcript.trim().length < 3) {
        return res.status(400).json({ error: 'transcript_required' });
      }

      let candidate: Record<string, unknown> = {};
      if (process.env.OPENAI_API_KEY) {
        try {
          const systemPrompt = [
            'Você extrai candidatos de um check-in emocional em JSON.',
            '{"humor":1-10|null,"energia":1-10|null,"sleepHours":0-24|null,"emotions":[],"factors":[]}',
            `Emotions permitidas: ${CHECKIN_CANONICAL_EMOTIONS.join(', ')}.`,
            `Factors permitidos: ${CHECKIN_CANONICAL_FACTORS.join(', ')}.`,
            'Não traduza IDs. Não invente sinais ausentes. Sono em horas vai somente em sleepHours.',
            'Responda apenas JSON.',
          ].join('\n');
          const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY });
          const completion = await openai.chat.completions.create({
            model: getOpenAiModel(),
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Relato: "${transcript.slice(0, 1200)}"` },
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: getOpenAiMaxCompletionTokens(500),
            ...openAiTemperature(getOpenAiModel(), 0.2),
          } as any);
          const content = completion.choices[0]?.message?.content?.trim();
          candidate = content ? JSON.parse(content) as Record<string, unknown> : {};
        } catch (modelError) {
          console.warn('[voice-checkin] extração por modelo indisponível; usando entendimento determinístico:', modelError);
        }
      }

      const now = new Date();
      const draft = CheckinUnderstandingService.understand({
        message: transcript,
        localDate: typeof localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(localDate)
          ? localDate
          : getSaoPauloDateContext(now).dateKey,
        occurredAt: now.toISOString(),
        source: 'aura_voice',
        sourceMessageId: typeof sourceMessageId === 'string' && sourceMessageId.trim()
          ? sourceMessageId.trim()
          : null,
        idempotencyKey: null,
        candidate,
      });
      const observation = (signal: typeof draft.mood) => ({
        provenance: signal.provenance,
        confidence: signal.confidence,
        evidence: signal.evidence,
      });

      return res.json({
        status: draft.status,
        humor: draft.mood.value,
        energia: draft.energy.value,
        sleepHours: draft.sleepHours,
        emotions: draft.emotions,
        factors: draft.factors,
        note: draft.note,
        source: draft.source,
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
      });
    } catch (err: unknown) {
      console.error('[voice-checkin] Error:', err);
      return res.status(500).json({ error: 'voice_checkin_failed' });
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
      body: microStep ? `Próximo passo: ${microStep}` : 'Abra a tarefa para retomar pelo próximo passo.',
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
  return getLocalTimeContext(date, 'America/Sao_Paulo').time;
}

function getLocalTimeContext(date: Date, timezone?: string | null): { dateKey: string; time: string; dbDate: Date } {
  const resolvedTimezone = typeof timezone === 'string' && timezone.trim() ? timezone : 'America/Sao_Paulo';
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: resolvedTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date);
  } catch {
    return getLocalTimeContext(date, 'America/Sao_Paulo');
  }
  const part = (type: Intl.DateTimeFormatPartTypes, fallback: string) => parts.find((entry) => entry.type === type)?.value ?? fallback;
  const dateKey = `${part('year', '1970')}-${part('month', '01')}-${part('day', '01')}`;
  return {
    dateKey,
    time: `${part('hour', '00')}:${part('minute', '00')}`,
    dbDate: new Date(`${dateKey}T00:00:00.000Z`),
  };
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
    if (!PRODUCT_CAPABILITIES.planner && !PRODUCT_CAPABILITIES.habits) return;
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
      const spDayStartUtc = getSaoPauloDayStartUtc(saoPauloToday.dateKey);

      if (PRODUCT_CAPABILITIES.habits) {
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
      }

      if (PRODUCT_CAPABILITIES.planner) {
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
        const [postponeEvents, persistentDeliveryEvents] = await Promise.all([
          defaultPrisma.eventLog.findMany({
            where: { eventName: 'timeline.block_postponed', userId: { in: persistentUserIds } },
            select: { properties: true },
          }),
          defaultPrisma.eventLog.findMany({
            where: { eventName: 'push.persistent_sent', userId: { in: persistentUserIds }, createdAt: { gte: spDayStartUtc } },
            select: { properties: true },
          }),
        ]);
        const postponeCountMap = new Map<string, number>();
        for (const ev of postponeEvents) {
          const blockId = (ev.properties as any)?.blockId;
          if (blockId) postponeCountMap.set(blockId, (postponeCountMap.get(blockId) ?? 0) + 1);
        }
        const persistentCountMap = new Map<string, number>();
        for (const event of persistentDeliveryEvents) {
          const blockId = (event.properties as any)?.blockId;
          if (typeof blockId === 'string') persistentCountMap.set(blockId, (persistentCountMap.get(blockId) ?? 0) + 1);
        }
        for (const task of persistentTasks) {
          const prefs = persistentPrefsByUser.get(task.userId);
          if (!prefs || (prefs as any).planner === false) continue;
          const intervalMin = Math.max(15, task.persistentReminderIntervalMinutes ?? 30);
          const deliveryDecision = shouldSendPersistentReminder({
            taskLocalDate: task.localDate,
            todayLocalDate: saoPauloToday.dbDate,
            startAt: task.startAt,
            now,
            intervalMinutes: intervalMin,
            sentToday: persistentCountMap.get(task.id) ?? 0,
          });
          if (!deliveryDecision.send) continue;
          const minutesPast = Math.floor((now.getTime() - task.startAt.getTime()) / 60000);
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
          await defaultPrisma.eventLog.create({
            data: { userId: task.userId, eventName: 'push.persistent_sent', properties: { blockId: task.id, localDate: saoPauloToday.dateKey, fireCount } },
          }).catch((error) => console.warn('[push-cron] falha ao registrar lembrete persistente:', error));
        }
      }
      }

      const prefsCheckin = await defaultPrisma.userPreference.findMany({ where: { notificationsOn: true } });
      for (const pref of prefsCheckin) {
        const notifPrefs = (pref.notificationPreferences as any) || {};
        const journalTimes = notifPrefs.journal
          ? [notifPrefs.journalMorningTime || '10:00', notifPrefs.journalEveningTime || '21:00']
          : [];

        if (notifPrefs.checkin) {
          const userNow = getLocalTimeContext(now, pref.timezone);
          const recent = await defaultPrisma.dailyCheckin.findMany({
            where: { userId: pref.userId, recordedAt: { gte: new Date(now.getTime() - 90 * 86_400_000) } },
            select: { checkinSlot: true, recordedAt: true },
            orderBy: { recordedAt: 'desc' },
            take: 90,
          });
          const recentBySlot: Record<'morning' | 'midday' | 'evening', string[]> = { morning: [], midday: [], evening: [] };
          for (const entry of recent) {
            const slot = String(entry.checkinSlot).split('-')[0] as keyof typeof recentBySlot;
            if (!(slot in recentBySlot)) continue;
            recentBySlot[slot].push(getLocalTimeContext(entry.recordedAt, pref.timezone).time);
          }
          const windows = resolveAdaptiveCheckinWindows({ wakeTime: pref.wakeTime, sleepTime: pref.sleepTime, recentBySlot });
          const dueWindow = windows.find((window) => window.targetTime === userNow.time);
          if (dueWindow) {
            const [todayCheckins, sentEvents] = await Promise.all([
              defaultPrisma.dailyCheckin.findMany({ where: { userId: pref.userId, localDate: userNow.dbDate }, select: { checkinSlot: true } }),
              defaultPrisma.eventLog.findMany({ where: { userId: pref.userId, eventName: NUDGE_EVENT_NAME, createdAt: { gte: new Date(now.getTime() - 30 * 60 * 60 * 1000) } }, select: { properties: true } }),
            ]);
            const completedSlots = todayCheckins.map((entry) => String(entry.checkinSlot).split('-')[0]);
            const nudgedSlots = sentEvents
              .filter((event) => (event.properties as any)?.kind === 'checkin' && (event.properties as any)?.localDate === userNow.dateKey)
              .map((event) => String((event.properties as any)?.slot ?? ''));
            const decision = shouldSendCheckinSlotNudge({ currentTime: userNow.time, window: dueWindow, completedSlots, nudgedSlots });
            if (decision.send) {
              await sendPushToUser(pref.userId, {
                title: '✨ Como você tá agora?',
                body: 'Um registro breve ajuda a Airia a entender como seu dia mudou.',
                url: '/checkin',
                tag: `checkin-reminder-${dueWindow.slot}`,
              });
              await defaultPrisma.eventLog.create({ data: { userId: pref.userId, eventName: NUDGE_EVENT_NAME, properties: { kind: 'checkin', slot: dueWindow.slot, time: dueWindow.targetTime, localDate: userNow.dateKey, timezone: pref.timezone ?? 'America/Sao_Paulo' } } });
            } else {
              console.log(`[push-cron] checkin ${dueWindow.slot} skipped for ${pref.userId}: ${decision.reason}`);
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

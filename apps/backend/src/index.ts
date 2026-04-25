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
import { PlannerService, type TimelineBlockInput } from './services/planner.service';
import { InsightService } from './services/insight.service';
import { CheckinService } from './services/checkin.service';
import { GCalService } from './services/gcal.service';
import { CheckinCreateSchema } from './contracts/checkin.contract';
import { deriveCheckinSlot } from './contracts/checkin-slot';
import { PlannerSyncSchema } from './contracts/planner.contract';
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
import { AiBackgroundService } from './services/ai-background.service';
import { SuggestionMemoryService } from './services/suggestion-memory.service';
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
import { normalizeAiSuggestion, usesJsonObjectResponse } from './lib/ai-suggest-response';
import { extractJsonValue } from './lib/extract-json';
import { getOpenAiMaxCompletionTokens, getOpenAiModel } from './lib/openai-config';
import { ObjectiveSubgoalsSchema } from './lib/objective-subgoals';
import {
  AuraCommandMessageStreamSchema,
  AuraCommandStartSchema,
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
  auraCommandService?: Pick<typeof AuraCommandService, 'interpretCommand'>;
  authMiddleware?: (req: Request, res: Response, next: import('express').NextFunction) => void;
  generateJournalSuggestedTasks?: typeof generateJournalSuggestedTasks;
};

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
  if (block.icon !== undefined) metadata.icon = block.icon ?? null;
  if (block.color !== undefined) metadata.color = block.color ?? null;
  if (block.vibrateEnabled !== undefined) metadata.vibrateEnabled = block.vibrateEnabled;
  if (block.alarmEnabled !== undefined) metadata.alarmEnabled = block.alarmEnabled;
  if (block.recurringNotificationEnabled !== undefined) metadata.recurringNotificationEnabled = block.recurringNotificationEnabled;
  if (block.visualRepeatEnabled !== undefined) metadata.visualRepeatEnabled = block.visualRepeatEnabled;

  return metadata;
}

function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
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

async function resolveAiRuntimeContext(prisma: PrismaClient, userId: string, context: Record<string, unknown>) {
  const explicitUserName = typeof context.userName === 'string' && context.userName.trim() ? context.userName.trim() : null;
  const explicitMoodCycle = typeof context.moodCycleContext === 'string' && context.moodCycleContext.trim()
    ? context.moodCycleContext.trim()
    : null;

  const [profile, onboarding, latestCheckin, routineContext] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: userId },
      select: { fullName: true },
    }).catch(() => null),
    prisma.onboardingResponse.findUnique({
      where: { userId },
      select: { aiProfileSummary: true, aiProfilePayload: true },
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
    longTermMemory,
    latestCheckinSignals,
  };
}

const SuggestedTaskSchema = z.object({
  title: z.string().min(1),
  category: z.enum(['trabalho', 'saude', 'rotina', 'social']),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
});

type SuggestedTask = z.infer<typeof SuggestedTaskSchema>;

async function generateJournalSuggestedTasks(args: {
  systemPrompt: string;
  userName: string;
  moodCycleContext?: string | null;
  acceptedSuggestions?: string[];
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentHour?: number;
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
- Misture sugestões conversadas com compromissos práticos mencionados na conversa.${args.currentHour !== undefined ? `
- A hora atual do usuário é ${args.currentHour}h. NUNCA sugira horários anteriores à hora atual. Se o horário natural de uma tarefa já passou, omita o campo time.` : ''}
- Retorne APENAS JSON no formato:
{"tasks":[{"title":"...","category":"trabalho|saude|rotina|social","time":"HH:MM"}]}`,
      },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
    max_completion_tokens: getOpenAiMaxCompletionTokens(1500),
  });

  const content = completion.choices[0]?.message?.content?.trim() || '';
  const payload = extractJsonValue(content) as { tasks?: unknown };
  const rawTasks = Array.isArray(payload) ? payload : payload.tasks;
  if (!Array.isArray(rawTasks)) {
    return [];
  }

  return rawTasks.map((task) => SuggestedTaskSchema.parse(task)).slice(0, 3);
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
    const rawAutocuidado = Array.isArray(payload.autocuidado)
      ? uniqueByKey(
          payload.autocuidado
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        )
      : [];
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
        if (recentSuggestionItems.some((recent) => SuggestionMemoryService.isSimilar(title, recent))) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);

    if (filtered.length > 0 || validItems.length === 0) {
      return filtered;
    }

    const first = validItems[0];
    return [{
      ...first,
      title: `Retomar sugestão anterior: ${String(first.title).trim()}`,
    }];
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
    temperature: 0.2,
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
  currentHour?: number;
}) {
  const summary = await args.aiService.summarizeJournalSession(args.messages);

  let suggestedTasks: SuggestedTask[] = [];
  try {
    suggestedTasks = await args.journalSuggestedTasksGenerator({
      systemPrompt: buildAuraSystemPrompt({
        userName: args.userName,
        profileSummary: args.profileSummary,
        moodCycleContext: args.moodCycleContext,
        longTermMemory: args.longTermMemory,
        domain: 'journal-finalize',
      }),
      userName: args.userName,
      moodCycleContext: args.moodCycleContext,
      currentHour: args.currentHour,
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
  const memoryService = new MemoryService(prisma);

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

  // Todas as rotas abaixo exigem autenticação Supabase
  app.use('/api', dependencies.authMiddleware ?? requireAuth);

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
      },
    });

    // 2. Chamar IA para Avaliar Estado (com contexto completo do dia)
    const [checkinRuntimeContext, checkinPlannerContext, recentSuggestionItems] = await Promise.all([
      resolveAiRuntimeContext(prisma, data.userId, {}),
      buildTodayPlannerContext(prisma, data.userId),
      SuggestionMemoryService.getRecent(prisma, data.userId),
    ]);
    const recentSuggestionMemory = SuggestionMemoryService.formatForPrompt(recentSuggestionItems);
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
      moodCycleContext: checkinRuntimeContext.moodCycleContext,
      recentSuggestionMemory,
      emotions: (data as any).emotions,
      factors: data.factors,
      plannerContext: checkinPlannerContext,
    });

    // DEBUG: Log the aiState response from CheckinService
    console.log('[DEBUG] aiState from CheckinService:', {
      stateLabel: aiState.stateLabel,
      analysis: aiState.analysis?.substring?.(0, 50),
      recommendations: aiState.recommendations,
      suggestedIntensity: aiState.suggestedIntensity,
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
          emotions: data.emotions ?? [],
          factors: data.factors ?? [],
        } as any,
      }
    });

    // DEBUG: Log what was stored and what will be returned
    console.log('[DEBUG] updatedCheckin being returned:', {
      id: updatedCheckin.id,
      stateLabel: updatedCheckin.stateLabel,
      stateSummary: updatedCheckin.stateSummary?.substring?.(0, 50),
      aiState: {
        analysis: (updatedCheckin.aiState as any)?.analysis?.substring?.(0, 50),
        recommendations: (updatedCheckin.aiState as any)?.recommendations,
        suggestedIntensity: (updatedCheckin.aiState as any)?.suggestedIntensity,
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
        },
      }).catch(() => {}); // fire-and-forget
    }

    SuggestionMemoryService.append(prisma, data.userId, 'checkin', aiState.recommendations).catch(() => {});

    // 5. Agendar jobs de background para manter IA atualizada
    AiBackgroundService.scheduleJob(data.userId, 'rag-indexing', '1h').catch(() => {});
    AiBackgroundService.scheduleJob(data.userId, 'profile-update', '6h').catch(() => {});

    return res.json(updatedCheckin);

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

      await prisma.journalMessage.create({
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

      // Shared Brain: busca memórias relevantes para enriquecer a presença no diário
      const journalMemories = await memoryService.retrieve(data.userId, data.message, 3).catch(() => []);
      const journalRagContext = memoryService.formatForPrompt(journalMemories);

      const assistantContent = await aiService.streamJournalReply({
        context: {
          ...context,
          userName: runtimeContext.userName,
          userProfileSummary: runtimeContext.userProfileSummary,
          longTermMemory: runtimeContext.longTermMemory,
          recentSessionHistory: routineCtx.recentSessionHistory,
          recentSuggestionMemory,
          ragContext: journalRagContext,
          plannerContext: journalPlannerContext,
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
      const commandMemories = await memoryService.retrieve(data.userId, data.message, 3).catch(() => []);
      const commandRagContext = memoryService.formatForPrompt(commandMemories);

      // Planner Brain: injeta agenda completa de hoje (planner interno + Google Calendar)
      const plannerContext = await buildTodayPlannerContext(prisma, data.userId);

      const commandResponse = await auraCommandService.interpretCommand({
        message: data.message,
        history: data.history,
        userName: runtimeContext.userName,
        profileSummary: runtimeContext.userProfileSummary,
        moodCycleContext: runtimeContext.moodCycleContext,
        recentSuggestionMemory,
        ragContext: commandRagContext,
        plannerContext,
      });

      const responsePayload = { ...commandResponse.payload };

      // Executar update de tarefa existente
      if (commandResponse.action === 'update_task') {
        try {
          const { taskId, newDate, newStartTime } = commandResponse.payload as Record<string, string>;
          if (taskId && newDate && newStartTime) {
            const block = await prisma.timelineBlock.findFirst({ where: { id: taskId, userId: data.userId } });
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
            const block = await prisma.timelineBlock.findFirst({ where: { id: taskId, userId: data.userId } });
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
          payload: responsePayload,
        },
      });

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

    const runtimeContext = await resolveAiRuntimeContext(prisma, userId, {});
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
      currentHour: typeof req.body.currentHour === 'number' ? req.body.currentHour : undefined,
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
        blocks.map((block) => {
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
            return tx.timelineBlock.upsert({
              where: { id: block.id },
              update: data,
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

    // Sync
    try {
      for (const b of savedBlocks) await GCalService.syncBlockToGcal(prisma, userId, b, date);
    } catch (e) {}

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
        metadata: { category: data.category, objectiveId: obj.id },
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
      const { userName, moodCycleContext, userProfileSummary, longTermMemory, latestCheckinSignals } =
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
        ragContext,
        latestCheckinSignals,
      });
      context.recentSuggestionMemory = recentSuggestionMemory;
      context.recentSuggestionItems = recentSuggestionItems;

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
        const dtHour = context.hour ?? new Date().getHours();
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
${dtHistoryLines ? `HISTÓRICO RECENTE:\n${dtHistoryLines}` : ''}${dtGoalsCtx}${dtPendingCtx}${dtAvoidCtx}
${context.moodCycleContext ? `\nCONTEXTO VIVO:\n${context.moodCycleContext}` : ''}${ragContext}${recentSuggestionMemory}

REGRAS INVIOLÁVEIS:
0. FONTE DA VERDADE DE HOJE = listas acima de "Metas ativas" e "Compromissos pendentes HOJE". Se a memória sugerir algo fora dessas listas, IGNORE.
1. Use o histórico e as metas acima — as tarefas devem ser relevantes ao que ${userName} realmente faz, não inventadas
2. Se há metas, pelo menos 1 tarefa deve avançar uma meta específica (cite a meta no título)
2.1 Se NÃO há metas ativas, não cite nenhuma meta específica.
2.2 Se NÃO há compromissos pendentes HOJE, não cite compromisso específico inexistente.
3. Fase baixa/cansada → tarefas de 5-15min máximo, zero pressão, focadas em autocuidado/repouso
4. Fase elevada/focada → 1 tarefa de trabalho real de impacto + 1 autocuidado + 1 pessoal
5. Cada tarefa = ação que ${userName} pode fazer hoje com o que já tem em casa
6. Se for noite, priorize fechamento, autocuidado e preparação suave do próximo dia
7. ESPECIFICIDADE OBRIGATÓRIA: cada título deve ter VERBO ATIVO + DETALHE CONCRETO + DURAÇÃO estimada${negRule}${posRule}

PROIBIDO ABSOLUTAMENTE: "Descanse", "Beba água", quadro de visão, mapa de visão, planejar semana, organizar arquivos, qualquer genérico sem contexto real da pessoa.

HORÁRIOS OBRIGATÓRIOS: use apenas entre 08:00 e 20:00. NUNCA sugira horários após 20:00, meia-noite ou madrugada.

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

Variância de humor: ${variance.toFixed(2)} (>1.5 = alta labilidade afetiva).

Com base em IPSRT, DBT e ritmo social, retorne:
1. Score de estabilidade 0-100.
2. Tendência atual (stable/rising/falling/alert).
3. "pattern": 2 frases mostrando o que está se repetindo de verdade.
4. "insight": 1 frase curta que traduza o risco ou oportunidade do momento.
5. 2-3 sugestões baseadas em evidência, preventivas e práticas. Elas podem ser micro-ações, uma tarefa objetiva ou um compromisso concreto para hoje.

REGRAS:
- Não descreva só o óbvio; identifique implicação prática.
- Soe como quem monitora e antecipa, não como quem espera nova crise para reagir.
- As sugestões devem nascer dos sinais reais do histórico, não de conselhos genéricos.
- Se houver metas, pendências ou temas recorrentes no contexto vivo, use isso para deixar as ações concretas e pessoais.
- Misture quando fizer sentido: micro-ação regulatória, tarefa prática curta e compromisso simples/agendável.
- As sugestões devem reduzir atrito, estabilizar rotina, proteger energia ou conter impulsividade.
- Prefira intervenções concretas de regulação: proteger sono, reduzir carga social, fracionar tarefa, cortar estímulo, ancorar rotina, criar pausa antes de agir no automático.
- Se houver sinal de queda sustentada, impulsividade, compulsão, isolamento ou sobrecarga, nomeie isso no "pattern" ou no "insight" sem dramatizar.
- Cada "why" deve explicar qual risco ou padrão a ação está tentando conter.
- Evite linguagem clínica pesada, mas mantenha raciocínio técnico por trás.

Retorne SOMENTE JSON: {"stabilityScore":número,"state":"stable|rising|falling|alert","pattern":"2 frases úteis sobre o padrão","insight":"1 frase personalizada e empática","actions":[{"title":"sugestão prática","category":"trabalho|social|autocuidado|rotina|foco|pessoal","why":"razão breve"}]}. Sem texto fora do JSON.`;
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
        const emotionsCtx = emotions.length > 0
          ? `- Emoções do check-in atual: ${emotions.map((id) => EMOTION_LABELS[id] ?? id).join(', ')}`
          : '';
        const factorsCtx = factors.length > 0
          ? `- Fatores do check-in atual: ${factors.map((id) => FACTOR_LABELS[id] ?? id).join(', ')}`
          : '';
        prompt = `${userName} está abrindo a home agora.

SINAIS DO MOMENTO:
- Estado percebido: "${moodLabel}" (${moodKey})
- Período do dia: ${periodo}
- Dia: ${weekday}${localDate}
- Tarefas ativas hoje: ${taskCount}
${pendingTaskTitles.length ? `- Pendências abertas: ${pendingTaskTitles.join(' | ')}` : ''}
${goals.length ? `- Metas ativas: ${goals.join(' | ')}` : ''}
${emotionsCtx}
${factorsCtx}
${previousMotivacional ? `- Última mensagem recente para NÃO reciclar: ${previousMotivacional}` : ''}
${previousAutocuidado.length ? `- Micro-ações recentes para NÃO repetir: ${previousAutocuidado.join(' | ')}` : ''}
${context.moodCycleContext ? `- Contexto vivo recente: ${context.moodCycleContext}` : ''}
${ragContext}

Gere uma presença de home que pareça real, não texto de chatbot.

OBJETIVO:
1. "motivacional": 1-2 frases curtas que mostrem leitura do momento + direção suave. Não use clichês como "você consegue", "vá com calma" ou "um passo de cada vez" sem contexto.
2. "autocuidado": 3 ações diferentes entre si, concretas e situadas no momento atual. Cada item deve começar com emoji e ter 4-12 palavras. Use micro-passos ligados ao corpo, ao ambiente imediato, ao foco ou a uma decisão prática leve.
3. "proactive": 1 ação para fazer AGORA dentro do app. "title" com 2-5 palavras. "desc" com 1 frase dizendo por que isso faz sentido neste momento. "actionPath" deve ser uma rota real ou null.

REGRAS:
- Não repita literalmente o estado na primeira frase.
- Use o nome no máximo uma vez.
- Se o estado indicar proteção ou baixa energia, reduza atrito e puxe para cuidado ou clareza.
- Se houver energia boa e poucas tarefas, puxe para movimento e ação.
- Se houver sinais recorrentes no diário ou na memória recente, aproveite isso com discrição para deixar as ações mais pessoais.
- Se houver pendências abertas ou metas ativas, conecte pelo menos 1 movimento a algo real que já exista no app.
- As 3 ações de "autocuidado" devem ser diferentes entre si e não podem reciclar a mesma ideia com palavras diferentes.
- Se existir conteúdo recente acima, mude de verdade: não repita nem parafraseie a mesma frase, o mesmo gesto ou a mesma micro-ação.
- Evite frases que sirvam igual para qualquer pessoa em qualquer horário.
- Nada aqui pode servir igual para qualquer pessoa em qualquer horário.

JSON APENAS (sem markdown): {"motivacional":"...","autocuidado":["...","...","..."],"proactive":{"emoji":"🎯","title":"...","desc":"...","actionPath":"rota da app ou null (ex: /checkin, /goals, /planner, /insights, /journal)"}}`;
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
${ragContext}${recentSuggestionMemory}

Monte complementos, não uma rotina inteira:
- Crie 1-4 blocos opcionais, somente se acrescentarem algo útil ao que já existe
- Tipos: trabalho, autocuidado, casa, social, descanso, refeicao, flexivel
- Não cubra o dia inteiro
- Não recrie compromissos já abertos no planner
- Inclua no máximo 1 tarefa por bloco, salvo se forem micro-passos inseparáveis
- Se energia baixa/tensa → mais autocuidado e descanso, menos trabalho
- Se focada → trabalho no pico da manhã (8h-12h)
- Tarefas concretas e específicas, sem repetir títulos entre blocos
- Se já houver pendências abertas ou metas ativas, complemente ou destrave isso; não replique com frases genéricas
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
${nota}${ragContext}${recentSuggestionMemory}

Responda como Airia, com leitura específica e útil para este momento.

REGRAS:
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
              recentSuggestionMemory,
              domain: getSuggestPromptDomain(type),
            }),
          },
          { role: 'user' as const, content: prompt },
        ],
        max_completion_tokens: getOpenAiMaxCompletionTokens(generationConfig.maxTokens),
        temperature: generationConfig.temperature,
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
        temperature: 0.4,
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

      const getDefaultCalendarIds = async (): Promise<string[]> => {
        let listRes = await fetchCalendarList(token!);

        if (listRes.status === 401 && pref?.gcalRefreshToken) {
          const newToken = await GCalService.refreshAccessToken(prisma, userId, pref.gcalRefreshToken);
          if (newToken) {
            token = newToken;
            listRes = await fetchCalendarList(newToken);
          }
        }

        if (!listRes.ok) return ['primary'];

        const data = await listRes.json() as any;
        const calendarIds = (data.items || [])
          .filter((calendar: any) => calendar?.selected !== false && calendar?.accessRole !== 'none')
          .map((calendar: any) => String(calendar.id || '').trim())
          .filter(Boolean);

        return calendarIds.length > 0 ? calendarIds : ['primary'];
      };

      const savedCalendarIds = Array.isArray(pref?.gcalSelectedCalendars)
        ? (pref?.gcalSelectedCalendars as unknown[]).map((id) => String(id).trim()).filter(Boolean)
        : [];
      const selectedCalendars = savedCalendarIds.length > 0 ? savedCalendarIds : await getDefaultCalendarIds();

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
      const defaultSelectedIds = calendars
        .filter((calendar: any) => calendar.selected && calendar.accessRole !== 'none')
        .map((calendar: any) => calendar.id);
      const selectedIds = savedSelectedIds.length > 0 ? savedSelectedIds : defaultSelectedIds;

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
  app.get('/api/habits', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { date } = req.query;
    try {
      const { HabitService } = await import('./services/habit.service');
      const habits = date
        ? await HabitService.getHabitsForDate(userId, new Date(String(date)))
        : await HabitService.listHabits(userId, new Date());
      return res.json(habits);
    } catch (error) {
      console.error('[habits/list] Falling back to empty list:', error);
      // Contingência: evitar quebrar o app quando houver mismatch de schema no banco.
      return res.json([]);
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
      const targetDate = date ? new Date(String(date)) : new Date();
      const { HabitService } = await import('./services/habit.service');
      const habit = await HabitService.toggleCompletion(id, targetDate, userId, notes);
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

  return app;
}

export const app = createApp();

async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  const subs = await defaultPrisma.pushSubscription.findMany({ where: { userId } });

  const expoMessages: ExpoPushMessage[] = [];

  await Promise.allSettled(
    subs.map(async sub => {
      if (Expo.isExpoPushToken(sub.endpoint)) {
        expoMessages.push({
          to: sub.endpoint,
          title: payload.title,
          body: payload.body,
          data: { url: payload.url || '/' },
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
        // subscription expired — remove to avoid future sends
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

if (require.main === module) {
  // Push notification cron — runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const mm = String(now.getUTCMinutes()).padStart(2, '0');
      const currentTimeStr = `${hh}:${mm}`;

      // 1. Habit reminders
      const habitsNow = await defaultPrisma.habit.findMany({
        where: { reminderEnabled: true, reminderTime: currentTimeStr },
      });
      for (const habit of habitsNow) {
        await sendPushToUser(habit.userId, {
          title: `⏰ ${habit.title}`,
          body: 'Hora do seu hábito!',
          url: '/home',
          tag: `habit-${habit.id}`,
        });
      }

      // 2. Task/planner reminders — tasks starting in the current UTC minute
      const windowStart = new Date(now);
      windowStart.setUTCSeconds(0, 0);
      const windowEnd = new Date(windowStart.getTime() + 60000);
      const tasksNow = await defaultPrisma.timelineBlock.findMany({
        where: { startAt: { gte: windowStart, lt: windowEnd }, status: 'planned' },
      });
      for (const task of tasksNow) {
        await sendPushToUser(task.userId, {
          title: `📅 ${task.title}`,
          body: `Começa agora — ${currentTimeStr}`,
          url: '/planner',
          tag: `task-${task.id}`,
        });
      }

      // 3. Check-in reminders
      const prefsCheckin = await defaultPrisma.userPreference.findMany({
        where: { notificationsOn: true },
      });
      for (const pref of prefsCheckin) {
        const notifPrefs = (pref.notificationPreferences as any) || {};
        if (!notifPrefs.checkin) continue;
        const checkinTime = pref.morningCheckinTime || '09:00';
        if (checkinTime === currentTimeStr) {
          await sendPushToUser(pref.userId, {
            title: '✨ Como você está agora?',
            body: 'Hora do check-in de humor.',
            url: '/checkin',
            tag: 'checkin-reminder',
          });
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
    console.log(`[backend]: Server is running at http://localhost:${port}`);
  });
}

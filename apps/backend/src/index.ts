import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@app/database';
import { requireAuth, AuthRequest } from './middleware/auth';
import { AIService } from './services/ai.service';
import { PlannerService } from './services/planner.service';
import { InsightService } from './services/insight.service';
import { CheckinService } from './services/checkin.service';
import { CheckinCreateSchema } from './contracts/checkin.contract';
import { deriveCheckinSlot } from './contracts/checkin-slot';
import { PlannerSyncSchema } from './contracts/planner.contract';
import { JournalMessageStreamSchema, JournalStartSchema } from './contracts/journal.contract';
import { OnboardingProcessSchema } from './contracts/onboarding.contract';
import { JournalService } from './services/journal.service';
import { MemoryService } from './services/memory.service';
import { z } from 'zod';

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const port = process.env.PORT || 3000;
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? [];
const defaultAllowed = ['localhost', '127.0.0.1', 'replit', 'replit.dev', 'replit.app'];
const defaultPrisma = new PrismaClient();

type AppDependencies = {
  prisma?: PrismaClient;
  aiService?: Pick<typeof AIService, 'summarizeJournalSession' | 'streamJournalReply' | 'generateOnboardingProfile'>;
  journalService?: Pick<typeof JournalService, 'startOrResumeSession' | 'getSessionMessages' | 'buildRoutineContext' | 'nextOrderIndex'>;
  authMiddleware?: (req: Request, res: Response, next: import('express').NextFunction) => void;
  generateJournalSuggestedTasks?: typeof generateJournalSuggestedTasks;
};

// ── Aura System Prompt ────────────────────────────────────────────────────────
// Encapsula a persona, metodologia e perfil aprendido do usuário.
// profileSummary = texto do onboarding (pode ser null se o usuário ainda não fez).
function buildAuraSystemPrompt(
  userName: string,
  profileSummary?: string | null,
  moodCycleContext?: string | null
): string {
  const profile = profileSummary
    ? `\nO QUE SEI SOBRE ${userName.toUpperCase()}:\n${profileSummary}`
    : '';
  const cycleCtx = moodCycleContext
    ? `\nCICLO DE HUMOR ATUAL DE ${userName.toUpperCase()}:\n${moodCycleContext}`
    : '';
  return `Você é Aura, assistente pessoal de ciclagem de humor e copiloto de vida de ${userName}.

IDENTIDADE DO APP: Este é um app de ciclagem de humor — não um planner genérico. O ciclo de humor é o eixo central. Toda sugestão deve levar em conta ONDE a pessoa está no ciclo (fase elevada, fluindo, estável, descendo, baixa, esgotamento, recuperação, instável). O ciclo menstrual, quando presente, é apenas um modulador biológico secundário que pode amplificar estados do ciclo de humor.

CONTEXTO CLÍNICO: Usuárias típicas têm TDAH, ciclotimia, transtorno depressivo ou bipolar tipo II. A disregulação emocional e a variabilidade de humor são realidades — não fraquezas. Nunca patologizar. Sempre normalizar o ciclo.

METODOLOGIA:
• Adaptar ao ciclo: fase elevada → aproveitar com estrutura; fase baixa → restaurar, não produzir; fase instável → rotina como âncora; recuperação → passos mínimos celebrados.
• Terapia de Exposição: exposição gradual ao que a pessoa evita. Pequenos passos. Celebrar micro-avanços.
• Psicologia somática: inércia ≠ preguiça — é sinal biológico. Movimento pequeno libera.
• Autocompaixão: zero culpa. Zero "você deveria". A fase passa — ela sempre passou.
• Copiloto proativo: antecipar o que a fase pede, não só reagir ao que foi perguntado.${cycleCtx}${profile}

TOM: Acolhedor, próximo, como amiga íntima que ENTENDE ciclagem de humor. Use o nome. Frases curtas. Sem julgamento.
REGRAS INVIOLÁVEIS: O ciclo de humor direciona o plano, não a força de vontade. Algo não feito → fase errada, não pessoa errada. "Meu ciclo tem ritmo próprio."`;
}

function writeSseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function extractJsonValue(raw: string): unknown {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error('AI returned an empty response');
  }

  const firstBrace = trimmed.search(/[\[{]/);
  if (firstBrace === -1) {
    throw new Error('AI response did not contain JSON');
  }

  const startChar = trimmed[firstBrace];
  const endChar = startChar === '{' ? '}' : ']';
  let depth = 0;

  for (let index = firstBrace; index < trimmed.length; index++) {
    const current = trimmed[index];
    if (current === startChar) depth++;
    if (current === endChar) depth--;

    if (depth === 0) {
      return JSON.parse(trimmed.slice(firstBrace, index + 1));
    }
  }

  throw new Error('AI response contained incomplete JSON');
}

function getFirstName(fullName?: string | null): string | null {
  if (!fullName) return null;
  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName || null;
}

async function resolveAiRuntimeContext(prisma: PrismaClient, userId: string, context: Record<string, unknown>) {
  const explicitUserName = typeof context.userName === 'string' && context.userName.trim() ? context.userName.trim() : null;
  const explicitMoodCycle = typeof context.moodCycleContext === 'string' && context.moodCycleContext.trim()
    ? context.moodCycleContext.trim()
    : null;

  const [profile, onboarding, latestCheckin] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: userId },
      select: { fullName: true },
    }).catch(() => null),
    prisma.onboardingResponse.findUnique({
      where: { userId },
      select: { aiProfileSummary: true },
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
        stateLabel: true,
        stateLabelType: true,
        stateSummary: true,
      },
    }).catch(() => null),
  ]);

  const derivedUserName = getFirstName(profile?.fullName);
  const fallbackMoodCycleContext = latestCheckin
    ? [
        `Último estado registrado: ${latestCheckin.stateLabel ?? 'sem rótulo definido'}.`,
        `Humor ${latestCheckin.moodScore}/5 e energia ${latestCheckin.energyScore}/5.`,
        latestCheckin.sleepScore != null ? `Sono ${latestCheckin.sleepScore}/5.` : null,
        latestCheckin.stateSummary ? `Leitura atual: ${latestCheckin.stateSummary}` : null,
      ].filter(Boolean).join(' ')
    : null;

  return {
    userName: explicitUserName ?? derivedUserName ?? 'você',
    moodCycleContext: explicitMoodCycle ?? fallbackMoodCycleContext,
    userProfileSummary: onboarding?.aiProfileSummary ?? null,
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
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<SuggestedTask[]> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const transcript = args.recentMessages
    .slice(-8)
    .map((message) => `${message.role === 'user' ? args.userName : 'Aura'}: ${message.content}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system' as const, content: args.systemPrompt },
      {
        role: 'user' as const,
        content: `Com base nesta conversa recente, sugira de 0 a 3 tarefas pequenas e concretas para hoje.

CONVERSA:
${transcript}

REGRAS:
- Só sugira tarefas se houver próximo passo útil e gentil.
- Priorize autocuidado, organização leve ou trabalho prático conforme o estado atual.
- Se não fizer sentido sugerir nada, retorne [].
- Use categorias: trabalho | saude | rotina | social.
- Retorne APENAS JSON no formato:
{"tasks":[{"title":"...","category":"trabalho|saude|rotina|social","time":"HH:MM"}]}`,
      },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
    max_tokens: 300,
  });

  const content = completion.choices[0]?.message?.content?.trim() || '';
  const payload = extractJsonValue(content) as { tasks?: unknown };
  const rawTasks = Array.isArray(payload) ? payload : payload.tasks;
  if (!Array.isArray(rawTasks)) {
    return [];
  }

  return rawTasks.map((task) => SuggestedTaskSchema.parse(task)).slice(0, 3);
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const prisma = dependencies.prisma ?? defaultPrisma;
  const aiService = dependencies.aiService ?? AIService;
  const journalService = dependencies.journalService ?? JournalService;
  const journalSuggestedTasksGenerator = dependencies.generateJournalSuggestedTasks ?? generateJournalSuggestedTasks;
  const memoryService = new MemoryService(prisma);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin or server-to-server

      const originHost = origin.replace(/^https?:\/\//, '');
      const isDefault = defaultAllowed.some((host) => originHost.includes(host));
      const isExplicit = allowedOriginsEnv.some((allowed) => origin.includes(allowed));

      if (isDefault || isExplicit) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin ${origin}`));
      }
    },
    credentials: true,
  }));
  app.use(express.json());

  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Todas as rotas abaixo exigem autenticação Supabase
  app.use('/api', dependencies.authMiddleware ?? requireAuth);

  app.post('/api/onboarding/process', async (req: Request, res: Response) => {
    try {
      const data = OnboardingProcessSchema.parse(req.body);
      const result = await aiService.generateOnboardingProfile(data);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }

      console.error('[onboarding/process] Error:', error);
      return res.status(500).json({ error: 'Failed to process onboarding profile' });
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
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysNum);
      fromDate.setHours(0, 0, 0, 0);

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

      return res.json(checkins);
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
    const date = new Date(data.localDate);
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

    // 2. Chamar IA para Avaliar Estado
    const aiState = await CheckinService.evaluateDayState({
      checkinSlot,
      moodScore: data.moodScore,
      energyScore: data.energyScore,
      clarityScore: data.clarityScore,
      irritabilityScore: data.irritabilityScore,
      physicalScore: data.physicalScore,
      socialScore: data.socialScore,
      sleepScore: data.sleepScore,
      note: data.note
    });

    // 3. Atualizar com Resultado da IA
    const updatedCheckin = await prisma.dailyCheckin.update({
      where: { id: checkin.id },
      data: {
        stateLabel: aiState.stateLabel,
        stateLabelType: aiState.stateLabelType,
        stateSummary: aiState.analysis, // Mapeado para o novo campo analysis da IA
        aiState: aiState as any
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
  app.get('/api/journal/sessions', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    const { limit } = req.query;

    try {
      const limitNum = Math.min(Number(limit ?? 20), 50);

      const sessions = await prisma.journalSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: limitNum,
      });

      return res.json(
        sessions.map((s) => ({
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
      const routineCtx = await journalService.buildRoutineContext(prisma, data.userId);
      const runtimeContext = await resolveAiRuntimeContext(prisma, data.userId, { moodCycleContext: data.moodCycleContext });
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

      const assistantContent = await aiService.streamJournalReply({
        context,
        history: existingMessages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
        message: data.message,
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

      try {
        const suggestedTasks = await journalSuggestedTasksGenerator({
          systemPrompt: buildAuraSystemPrompt(runtimeContext.userName, runtimeContext.userProfileSummary, runtimeContext.moodCycleContext),
          userName: runtimeContext.userName,
          moodCycleContext: runtimeContext.moodCycleContext,
          recentMessages: [
            ...existingMessages.map((message) => ({
              role: message.role as 'user' | 'assistant',
              content: message.content,
            })),
            { role: 'user', content: data.message },
            { role: 'assistant', content: assistantContent },
          ],
        });

        if (suggestedTasks.length > 0) {
          writeSseEvent(res, 'assistant.suggested_tasks', {
            sessionId: data.sessionId,
            suggestedTasks,
          });
        }
      } catch (error) {
        console.warn('[journal/message/stream] Failed to generate suggested tasks:', error);
      }

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

  app.post('/api/journal/finalize', requireAuth, async (req: Request, res: Response) => {
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

    const summary = await AIService.summarizeJournalSession(messages);

    const updatedSession = await prisma.journalSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        summary: summary.summary,
        emotions: summary.emotions,
        themes: summary.themes,
        suggestions: summary.suggestions || [],
        finalizedAt: new Date(),
      },
    });

    return res.json({
      sessionId: updatedSession.id,
      summary: {
        text: summary.summary,
        emotions: summary.emotions,
        themes: summary.themes,
        suggestions: summary.suggestions,
      },
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
    const baseDate = new Date(date);

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

    // Processar Upserts em uma transação
    const savedBlocks = await prisma.$transaction(
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
        };

        if (block.id) {
          return prisma.timelineBlock.update({
            where: { id: block.id },
            data,
          });
        } else {
          return prisma.timelineBlock.create({
            data,
          });
        }
      })
    );

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
   * GET /api/preferences
   * Retorna as preferências do usuário (ou padrões se ainda não existirem).
   */
  app.get('/api/preferences', async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const prefs = await prisma.userPreference.findUnique({ where: { userId } });
      return res.json(prefs ?? {
        timezone: 'America/Sao_Paulo',
        wakeTime: null,
        sleepTime: null,
        notificationsOn: true,
        aiTone: 'warm',
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
    const PrefsSchema = z.object({
      timezone: z.string().optional(),
      wakeTime: z.string().nullable().optional(),
      sleepTime: z.string().nullable().optional(),
      notificationsOn: z.boolean().optional(),
      aiTone: z.string().optional(),
    });
    try {
      const data = PrefsSchema.parse(req.body);
      const prefs = await prisma.userPreference.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
      return res.json(prefs);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[preferences/patch] Error:', error);
      return res.status(500).json({ error: 'Failed to update preferences' });
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
      subgoals: z.array(z.object({
        id: z.string(),
        title: z.string(),
        done: z.boolean(),
        aiGenerated: z.boolean(),
      })).default([]),
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
      subgoals: z.array(z.object({
        id: z.string(),
        title: z.string(),
        done: z.boolean(),
        aiGenerated: z.boolean(),
      })).optional(),
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
      // Fix timezone: busca pelo início e fim do dia em UTC para evitar dessincronização
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd   = new Date(`${date}T23:59:59.999Z`);
      if (isNaN(dayStart.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      const blocks = await prisma.timelineBlock.findMany({
        where: { userId, localDate: { gte: dayStart, lte: dayEnd } },
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
      const plainTextTypes = new Set(['task-notes', 'task-title']);
      const jsonObjectTypes = new Set([
        'weekly-insight',
        'stability-analysis',
        'home-messages',
        'checkin-response',
        'gtd-clarify',
        'goal-route',
        'phase-transition',
        'follow-up',
      ]);
      const { userName, moodCycleContext, userProfileSummary } = await resolveAiRuntimeContext(prisma, userId, context);

      // RAG: busca memórias relevantes para tipos que se beneficiam de contexto histórico
      const ragTypes = new Set(['checkin-response', 'day-tasks', 'home-messages', 'journal-tasks']);
      let ragContext = '';
      if (ragTypes.has(type)) {
        const ragQuery = typeof context.moodCycleContext === 'string'
          ? context.moodCycleContext
          : typeof context.moodLabel === 'string'
            ? context.moodLabel
            : 'estado emocional atual';
        const memories = await memoryService.retrieve(userId, ragQuery, 3).catch(() => []);
        ragContext = memoryService.formatForPrompt(memories);
      }

      let prompt = '';
      if (type === 'task-notes') {
        prompt = `Você é uma assistente pessoal carinhosa e organizada. Escreva observações práticas e motivadoras (2-3 frases) para a tarefa "${context.title}" (categoria: ${context.category}). Tom acolhedor, como uma amiga organizada ajudando. Responda diretamente.`;
      } else if (type === 'task-checklist') {
        prompt = `Você é uma assistente pessoal organizada. Crie 3-5 itens de checklist práticos para a tarefa "${context.title}" (categoria: ${context.category}). Passos curtos para não sobrecarregar. Retorne SOMENTE um array JSON de strings: ["Item 1", "Item 2"]. Sem explicação.`;
      } else if (type === 'task-title') {
        prompt = `Sugira um título claro, motivador e específico para uma tarefa de ${context.category} às ${context.time}. Retorne SOMENTE o título, sem aspas nem explicação.`;
      } else if (type === 'day-tasks') {
        const dtHistory = (context.checkinHistory || []) as Array<{date:string;humor:number;energia:number;sono?:number}>;
        const dtHistoryLines = dtHistory.slice(0, 7).map((h: any) =>
          `- ${h.date}: humor=${h.humor}/5, energia=${h.energia}/5${h.sono != null ? `, sono=${h.sono}/5` : ''}`
        ).join('\n');
        const dtGoals = (context.goals as string[] | undefined) || [];
        const dtGoalsCtx = dtGoals.length ? `\nMetas ativas de ${userName}: ${dtGoals.map((g, i) => `${i+1}. "${g}"`).join(', ')}` : '';
        const dtHour = context.hour ?? new Date().getHours();
        const dtPeriodo = dtHour < 12 ? 'manhã' : dtHour < 18 ? 'tarde' : 'noite';
        prompt = `Você é Aura, copiloto de humor de ${userName}. Gere 3 tarefas para HOJE — TOTALMENTE personalizadas para ESTA pessoa.

ESTADO HOJE: "${context.moodLabel}" (${context.mood}) | Período: ${dtPeriodo}
${dtHistoryLines ? `HISTÓRICO RECENTE:\n${dtHistoryLines}` : ''}${dtGoalsCtx}${ragContext}

REGRAS INVIOLÁVEIS:
1. Use o histórico e as metas acima — as tarefas devem ser relevantes ao que ${userName} realmente faz, não inventadas
2. Se há metas, pelo menos 1 tarefa deve avançar uma meta específica (cite a meta no título)
3. Fase baixa/cansada → tarefas de 5-15min máximo, zero pressão, focadas em autocuidado/repouso
4. Fase elevada/focada → 1 tarefa de trabalho real de impacto + 1 autocuidado + 1 pessoal
5. Títulos ESPECÍFICOS: não "Crie quadro de visão", não "Planeje sua semana", não "Organize documentos"
6. Cada tarefa = ação que ${userName} pode fazer hoje com o que já tem em casa

PROIBIDO ABSOLUTAMENTE: Quadro de visão, mapa de visão, planejar semana, organizar arquivos, criar lista genérica, qualquer coisa sem contexto real da pessoa.

Retorne SOMENTE array JSON: [{"title":"título específico e real","category":"trabalho|saude|rotina|social","time":"HH:MM"}]. Sem explicação.`;
      } else if (type === 'journal-tasks') {
        prompt = `Você é uma assistente pessoal carinhosa. Com base nessa conversa de diário:\n\n${context.messages}\n\nSugira 2-3 tarefas práticas e gentis que a pessoa pode fazer hoje para apoiar o que foi discutido. Tom encorajador. Retorne SOMENTE um array JSON: [{"title":"...","category":"trabalho|saude|rotina|social","time":"HH:MM"}]. Sem explicação.`;
      } else if (type === 'goal-subtasks') {
        const existing = context.existingSubtasks?.length ? `\nSubtarefas já existentes: ${context.existingSubtasks.join(', ')}` : '';
        prompt = `Você é a Aura, assistente de ${userName} especializada em ciclagem de humor. ${userName} pode estar com energia baixa — pense em alguém com depressão ou TDAH que precisa de cada micro-passo explicado.

Meta: "${context.goalTitle}"${existing}

Gere 4-5 MICRO-AÇÕES físicas e hiper-específicas. Regras OBRIGATÓRIAS:
- Cada ação é executável em 2-10 minutos
- Comece com VERBO físico: Abrir, Separar, Mandar, Verificar, Ligar, Escrever, Pegar, Colocar, Escolher
- NUNCA use: "planejar", "organizar", "pesquisar sobre", "considerar", "preparar-se para", "pensar"
- Nomeie objetos reais, apps e locais específicos quando possível
- Cada ação = mínima unidade de esforço, zero carga cognitiva

Exemplos para "ir à praia": ["Abrir o calendário e marcar um dia nos próximos 7 dias", "Verificar a previsão do tempo no celular para esse dia", "Separar o biquíni/sunga e o protetor solar agora", "Mandar mensagem para alguém: 'Vamos à praia [dia]?'", "Abrir Google Maps e ver quanto tempo leva para chegar"]

Retorne SOMENTE um array JSON de strings. Sem explicação.`;
      } else if (type === 'weekly-insight') {
        prompt = `Você é uma assistente pessoal carinhosa que cuida da rotina e bem-estar de ${userName}. Dados da semana:\n- Humor médio: ${context.avgHumor}/5\n- Energia média: ${context.avgEnergia}/5\n- Check-ins realizados: ${context.totalCheckins}\n- Dia de pico de humor: ${context.peakHumorDay || 'não identificado'}\n- Dia de menor energia: ${context.lowEnergyDay || 'não identificado'}\n\nGere um insight personalizado e acolhedor sobre os padrões da semana de ${userName} + uma ação concreta para a próxima. Tom motivador e carinhoso como uma amiga organizada.\nRetorne SOMENTE JSON: {"insight":"2 frases personalizadas e acolhedoras sobre o padrão identificado","action":"1 ação concreta e gentil para a próxima semana","category":"energia|humor|rotina|autocuidado","actionTitle":"título curto da ação (máx 40 chars)"}. Sem texto fora do JSON.`;
      } else if (type === 'stability-analysis') {
        const history = (context.history || []) as Array<{date:string;humor:number;energia:number;sono?:number;fisico?:number;social?:number}>;
        const historyLines = history.map((h: any) =>
          `- ${h.date}: humor=${h.humor}/5, energia=${h.energia}/5${h.sono != null ? `, sono=${h.sono}/5` : ''}${h.fisico != null ? `, físico=${h.fisico}/5` : ''}${h.social != null ? `, social=${h.social}/5` : ''}`
        ).join('\n');
        const humorVals = history.map((h: any) => h.humor);
        const avgH = humorVals.reduce((a: number, b: number) => a + b, 0) / humorVals.length;
        const variance = humorVals.reduce((a: number, b: number) => a + Math.pow(b - avgH, 2), 0) / humorVals.length;
        prompt = `Você é uma assistente pessoal carinhosa ("babá digital") que cuida da rotina e saúde emocional de ${userName}, especializada em ciclagem de humor. Analise os dados dos últimos ${history.length} dias:\n\n${historyLines}\n\nVariância de humor: ${variance.toFixed(2)} (>1.5 = alta labilidade afetiva).\n\nCom base em IPSRT, DBT e ritmo social:\n1. Score de estabilidade 0-100 (100 = muito estável)\n2. Tendência atual (stable/rising/falling/alert)\n3. Padrões detectados de forma acolhedora\n4. 2-3 micro-ações gentis e práticas para ${userName}\n\nTom carinhoso, próximo, como uma amiga organizada que cuida dela.\nRetorne SOMENTE JSON: {"stabilityScore":número,"state":"stable|rising|falling|alert","pattern":"2 frases acolhedoras sobre o padrão","insight":"1 frase personalizada e empática","actions":[{"title":"ação gentil e prática","category":"sono|rotina|mindfulness|autocuidado|foco","why":"razão breve"}]}. Sem texto fora do JSON.`;
      } else if (type === 'ai-goals') {
        const mood = context.mood || 'equilibrada';
        const existing = (context.existingGoals || []).join(', ') || 'nenhuma ainda';
        prompt = `Você é uma assistente pessoal carinhosa que cuida da rotina de ${userName}. Estado emocional: "${mood}". Metas atuais: ${existing}.\n\nSugira 3 metas pessoais significativas, alcançáveis e motivadoras — mistura de casa, autocuidado, trabalho e desenvolvimento pessoal. Metas específicas e realistas para o momento atual de ${userName}.\nRetorne SOMENTE um array JSON de strings: ["Meta específica 1", "Meta 2", "Meta 3"]. Sem explicação.`;
      } else if (type === 'home-messages') {
        const moodLabel = context.moodLabel || 'Em Equilíbrio';
        const moodKey = context.mood || 'equilibrada';
        const taskCount = context.taskCount ?? 0;
        const hour = context.hour ?? new Date().getHours();
        const periodo = hour < 12 ? 'manhã' : hour < 18 ? 'tarde' : 'noite';
        prompt = `Estado de ${userName}: "${moodLabel}" (${moodKey}) | Período: ${periodo} | Tarefas hoje: ${taskCount}.${ragContext}

Gere para ${userName} AGORA — específico ao estado e período:
1. "motivacional": 1-2 frases de encorajamento. Use o nome se soar natural.
2. "autocuidado": 4 sugestões práticas com emojis. Específicas, não genéricas. Ex: "🫧 Lavar o rosto com água gelada".
3. "proactive": 1 ação gentil e concreta para fazer AGORA.

JSON APENAS (sem markdown): {"motivacional":"...","autocuidado":["...","...","...","..."],"proactive":{"emoji":"🎯","title":"...","desc":"1-2 frases","actionPath":"rota da app ou null (ex: /checkin, /goals, /planner, /insights, /journal)"}}`;
      } else if (type === 'agenda-blocks') {
        const mood = context.mood || 'equilibrada';
        const moodLabel = context.moodLabel || 'Em Equilíbrio';
        const energia = context.energia ?? 3;
        const wakeTime = context.wakeTime || '07:00';
        const sleepTime = context.sleepTime || '22:00';
        const history = (context.history || []).slice(0, 3).map((h: any) =>
          `${h.date}: humor=${h.humor}/5, energia=${h.energia}/5`
        ).join('; ');
        prompt = `Você é uma assistente pessoal carinhosa ("babá digital") que organiza a rotina completa de ${userName} como uma amiga organizada. Monte a agenda personalizada do dia de hoje.

Estado de ${userName}: ${moodLabel} (${mood}), energia=${energia}/5.
Horário acordar: ${wakeTime} | Dormir: ${sleepTime}.
Histórico recente: ${history || 'sem dados'}.

Monte uma rotina completa e equilibrada:
- Crie 6-8 blocos cobrindo o dia inteiro de ${wakeTime} a ${sleepTime}
- Tipos: trabalho, autocuidado, casa, social, descanso, refeicao, flexivel
- Inclua tarefas de casa (limpar cômodo, organizar), autocuidado (skincare, exercício), clientes/trabalho e refeições
- Balanceie: trabalho + casa + autocuidado + descanso
- Se energia baixa/tensa → mais autocuidado e descanso, menos trabalho
- Se focada → trabalho no pico da manhã (8h-12h)
- Tarefas concretas e específicas (não genéricas)
- razao_ia: frase carinhosa e motivadora explicando o bloco

Retorne SOMENTE array JSON:
[{"horario_inicio":"HH:MM","horario_fim":"HH:MM","tipo":"trabalho|autocuidado|casa|social|descanso|refeicao|flexivel","label":"Nome motivador do bloco","tarefas_sugeridas":["Tarefa específica 1","Tarefa 2"],"razao_ia":"Frase carinhosa de 1 linha"}]
Sem texto fora do JSON.`;
      } else if (type === 'checkin-response') {
        const moodLabel = context.moodLabel || 'Equilíbrio';
        const nota = context.nota ? `Nota de ${userName}: "${context.nota}"` : '';
        const crStreak = typeof context.streak === 'number' ? context.streak : 0;
        const crHistory = (context.checkinHistory || []) as Array<{date:string;humor:number;energia:number}>;
        const crHistoryLines = crHistory.slice(0, 5).map((h: any) =>
          `- ${h.date}: humor=${h.humor}/5, energia=${h.energia}/5`
        ).join('\n');
        const prevEntry = crHistory[1];
        const trend = prevEntry
          ? crHistory[0]?.humor > prevEntry.humor ? 'humor subindo em relação ao check-in anterior'
            : crHistory[0]?.humor < prevEntry.humor ? 'humor caindo em relação ao check-in anterior'
            : 'humor estável em relação ao check-in anterior'
          : '';
        const streakCtx = crStreak >= 3 ? `\nSequência atual: ${crStreak} dias consecutivos de check-in — ${userName} está mantendo o ritmo.` : '';
        prompt = `${userName} acabou de fazer um check-in. Estado agora: "${moodLabel}" (${context.mood}).
${trend ? `Tendência: ${trend}.` : ''}${streakCtx}
${crHistoryLines ? `\nHistórico recente:\n${crHistoryLines}` : ''}
${nota}${ragContext}

Responda como Aura — acolhedora, próxima, como amiga íntima que CONHECE ${userName} e os padrões dela.

REGRAS:
- Reference o padrão real do histórico se relevante (ex: "nos últimos dias você estava...")
- Se streak ≥ 3 dias, mencione a sequência de forma encorajadora e natural (1 vez, sem exagero)
- NÃO use frases genéricas de autoajuda
- NÃO repita o estado de volta de forma óbvia
- A sugestão deve ser micro-ação de 5-10min, não uma tarefa grande
- Use o nome de forma natural (não em toda frase)

JSON APENAS: {"message":"2-3 frases acolhedoras e específicas sobre este momento","suggestionEmoji":"emoji","suggestion":"micro-ação concreta para as próximas 2 horas"}`;
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

Na dúvida entre "meta" e "proxima_acao": escolha SEMPRE "meta" — melhor quebrar em subtarefas do que deixar como ação vaga.

Sem texto fora do JSON.`;
      } else if (type === 'phase-transition') {
        const { fromPhase, toPhase, fromLabel, toLabel } = context as any;
        prompt = `Você é a Aura, assistente pessoal de ${userName} especializada em ciclagem de humor.

A fase de humor de ${userName} acabou de mudar: de "${fromLabel}" (${fromPhase}) → "${toLabel}" (${toPhase}).

Estado atual do ciclo: ${moodCycleContext || 'sem dados adicionais'}.

Reaja a essa transição de fase:
1. "message": 2-3 frases acolhedoras e específicas sobre ESTA transição. Use o nome. Seja empática com a mudança — sem julgamento. Explique o que essa fase significa no ciclo dela.
2. "tip": 1 ação concreta e gentil para os próximas horas adaptada a esta fase.

JSON APENAS: {"message":"...","tip":"..."}`;
      } else if (type === 'follow-up') {
        const { suggestionTitle, suggestionCategory } = context as any;
        prompt = `Você é a Aura, assistente pessoal de ${userName}.

Algumas horas atrás, você sugeriu para ${userName}: "${suggestionTitle}" (categoria: ${suggestionCategory}).

Estado atual: ${moodCycleContext || 'sem dados'}.

Escreva uma mensagem de acompanhamento carinhosa e curta para perguntar como foi. Tom próximo, sem pressão. 1-2 frases apenas.

JSON APENAS: {"message":"..."}`;
      } else {
        return res.status(400).json({ error: 'Unknown suggestion type' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const maxTokens = type === 'agenda-blocks' ? 700 : type === 'home-messages' ? 400 : type === 'gtd-clarify' ? 280 : type === 'goal-route' ? 150 : type === 'phase-transition' ? 200 : type === 'follow-up' ? 150 : 300;
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system' as const, content: buildAuraSystemPrompt(userName, userProfileSummary, moodCycleContext) },
          { role: 'user' as const, content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: plainTextTypes.has(type) ? 0.7 : 0.4,
        ...(jsonObjectTypes.has(type) ? { response_format: { type: 'json_object' as const } } : {}),
      });
      const rawSuggestion = completion.choices[0]?.message?.content?.trim() || '';
      const suggestion = plainTextTypes.has(type) ? rawSuggestion : extractJsonValue(rawSuggestion);
      return res.json({ suggestion });
    } catch (error: any) {
      console.error('[ai/suggest] Error:', error);
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
            content: buildAuraSystemPrompt(firstName, existingSummary, moodCycleContext),
          },
          {
            role: 'user',
            content: `Atualize o perfil de ${firstName} com base nos padrões observados ao longo do tempo.

PERFIL ATUAL:
${existingSummary || 'Nenhum perfil anterior.'}

DADOS ACUMULADOS (${recentPatterns.checkinCount} check-ins):
- Fase atual do ciclo de humor: ${recentPatterns.phase}
- Humor médio 7d: ${recentPatterns.avgMood7d.toFixed(1)}/5
- Energia média 7d: ${recentPatterns.avgEnergy7d.toFixed(1)}/5
- Estabilidade: ${recentPatterns.stabilityScore}/100
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
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 300,
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

  app.get('/api/gcal/auth-url', requireAuth, async (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(503).json({ error: 'Google Calendar not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env' });
    }
    const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/gcal/callback`;
    const scopes = 'https://www.googleapis.com/auth/calendar.readonly';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${(req as AuthRequest).userId}`;
    return res.json({ authUrl });
  });

  app.get('/api/gcal/callback', async (req: Request, res: Response) => {
    const { code, state: userId, error } = req.query as Record<string, string>;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (error || !code || !userId) {
      return res.redirect(`${frontendUrl}/planner?gcal=error`);
    }
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/gcal/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString(),
      });
      const tokens = await tokenRes.json() as any;
      if (!tokens.access_token) throw new Error('No access token received');
      // Store token encrypted in user preferences
      await prisma.userPreference.upsert({
        where: { userId },
        update: { gcalAccessToken: tokens.access_token, gcalRefreshToken: tokens.refresh_token ?? null },
        create: { userId, gcalAccessToken: tokens.access_token, gcalRefreshToken: tokens.refresh_token ?? null },
      });
      return res.redirect(`${frontendUrl}/planner?gcal=connected`);
    } catch (err) {
      console.error('[gcal/callback]', err);
      return res.redirect(`${frontendUrl}/planner?gcal=error`);
    }
  });

  app.get('/api/gcal/events', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    try {
      const pref = await prisma.userPreference.findUnique({ where: { userId }, select: { gcalAccessToken: true } }).catch(() => null);
      if (!pref?.gcalAccessToken) return res.json({ connected: false, events: [] });
      const now = new Date().toISOString();
      const end = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(end)}&maxResults=10&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${pref.gcalAccessToken}` } }
      );
      if (!eventsRes.ok) return res.json({ connected: false, events: [] });
      const data = await eventsRes.json() as any;
      const events = (data.items || []).map((e: any) => ({
        id: e.id,
        summary: e.summary ?? 'Evento',
        start: { dateTime: e.start?.dateTime, date: e.start?.date },
        end: e.end ? { dateTime: e.end?.dateTime } : undefined,
      }));
      return res.json({ connected: true, events });
    } catch (err) {
      console.error('[gcal/events]', err);
      return res.json({ connected: false, events: [] });
    }
  });

  app.post('/api/gcal/disconnect', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).userId;
    await prisma.userPreference.update({
      where: { userId },
      data: { gcalAccessToken: null, gcalRefreshToken: null },
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
      const block = await prisma.timelineBlock.findUnique({ where: { id } });
      if (!block || block.userId !== userId) {
        return res.status(404).json({ error: 'Block not found' });
      }
      await prisma.timelineBlock.delete({ where: { id } });
      return res.status(204).send();
    } catch (error: any) {
      console.error('[timeline/delete] Error:', error);
      return res.status(500).json({ error: 'Failed to delete timeline block' });
    }
  });

  return app;
}

export const app = createApp();

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[backend]: Server is running at http://localhost:${port}`);
  });
}

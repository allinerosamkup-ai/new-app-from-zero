import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@app/database';
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
import { z } from 'zod';

dotenv.config();

const port = process.env.PORT || 3000;
const defaultPrisma = new PrismaClient();

type AppDependencies = {
  prisma?: PrismaClient;
  aiService?: Pick<typeof AIService, 'summarizeJournalSession' | 'streamJournalReply' | 'generateOnboardingProfile'>;
  journalService?: Pick<typeof JournalService, 'startOrResumeSession' | 'getSessionMessages' | 'buildRoutineContext' | 'nextOrderIndex'>;
};

function writeSseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const prisma = dependencies.prisma ?? defaultPrisma;
  const aiService = dependencies.aiService ?? AIService;
  const journalService = dependencies.journalService ?? JournalService;

  app.use(cors({
    origin: (origin, callback) => {
      // Allow Replit domains, localhost, and undefined (same-origin)
      if (!origin || origin.includes('replit') || origin.includes('localhost') || origin.includes('replit.dev') || origin.includes('replit.app')) {
        callback(null, true);
      } else {
        callback(null, true); // Open for now — tighten when domain is fixed
      }
    },
    credentials: true,
  }));
  app.use(express.json());

  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

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
    const { userId, days } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const daysNum = Math.min(Math.max(Number(days ?? 7), 1), 90);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysNum);
      fromDate.setHours(0, 0, 0, 0);

      const checkins = await prisma.dailyCheckin.findMany({
        where: {
          userId: String(userId),
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
    const data = CheckinCreateSchema.parse(req.body);
    const date = new Date(data.localDate);
    const recordedAt = new Date();
    const checkinSlot = data.checkinSlot ?? deriveCheckinSlot(recordedAt);

    // 1. Salvar Check-in Inicial
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
        note: data.note,
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
        note: data.note,
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
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const limitNum = Math.min(Number(limit ?? 20), 50);

      const sessions = await prisma.journalSession.findMany({
        where: { userId: String(userId) },
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
      const data = JournalStartSchema.parse(req.body);
      const { session, created } = await journalService.startOrResumeSession(prisma, data.userId);
      const [messages, context] = await Promise.all([
        journalService.getSessionMessages(prisma, session.id),
        journalService.buildRoutineContext(prisma, data.userId),
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
        context,
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
      const data = JournalMessageStreamSchema.parse(req.body);
      const existingMessages = await journalService.getSessionMessages(prisma, data.sessionId);
      const context = await journalService.buildRoutineContext(prisma, data.userId);
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
  const { userId, weekStart } = req.query;

  if (!userId || !weekStart) {
    return res.status(400).json({ error: 'userId and weekStart (YYYY-MM-DD) are required' });
  }

  try {
    const result = await InsightService.getWeeklyInsights(String(userId), String(weekStart));
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
  app.post('/api/journal/finalize', async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
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
    const { userId, date, forceSave, blocks } = PlannerSyncSchema.parse(req.body);
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
   * GET /api/timeline/:date
   * Retorna os blocos do planner para um dia específico.
   */
  app.get('/api/timeline/:date', async (req: Request, res: Response) => {
    const { userId } = req.query;
    const { date } = req.params;

    if (!userId || !date) {
      return res.status(400).json({ error: 'userId (query) and date (path, YYYY-MM-DD) are required' });
    }

    try {
      const localDate = new Date(date);
      if (isNaN(localDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      const blocks = await prisma.timelineBlock.findMany({
        where: { userId: String(userId), localDate },
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
        }))
      );
    } catch (error: any) {
      console.error('[timeline/get] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch timeline blocks' });
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

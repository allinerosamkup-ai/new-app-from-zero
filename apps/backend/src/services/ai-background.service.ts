import { PrismaClient } from '@app/database';
import { MemoryService } from './memory.service';
import { getOpenAiModel, getOpenAiOutputLimit, openAiTemperature } from '../lib/openai-config';
import { prisma } from '../lib/prisma';

const INTERVALS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
} as const;

export type IntervalKey = keyof typeof INTERVALS;

export class AiBackgroundService {
  private static running = false;
  private static memoryService: MemoryService | null = null;

  private static getMemoryService(): MemoryService {
    if (!this.memoryService) {
      this.memoryService = new MemoryService(prisma);
    }
    return this.memoryService;
  }

  static async scheduleJob(userId: string, jobType: string, interval: IntervalKey) {
    const runAt = new Date(Date.now() + INTERVALS[interval]);

    await prisma.aiBackgroundJob.upsert({
      where: { userId_jobType: { userId, jobType } },
      create: { userId, jobType, runAt, status: 'pending' },
      update: { runAt, status: 'pending' },
    });
  }

  static async processPendingJobs(): Promise<{ processed: number; errors: number }> {
    if (this.running) return { processed: 0, errors: 0 };
    this.running = true;

    try {
      const pendingJobs = await prisma.aiBackgroundJob.findMany({
        where: { status: 'pending', runAt: { lte: new Date() } },
        take: 10,
      });

      let processed = 0, errors = 0;

      for (const job of pendingJobs) {
        try {
          await prisma.aiBackgroundJob.update({
            where: { id: job.id },
            data: { status: 'running' },
          });

          await this.executeJob(job);

          await prisma.aiBackgroundJob.update({
            where: { id: job.id },
            data: { status: 'completed', completedAt: new Date() },
          });

          processed++;
        } catch (err) {
          await prisma.aiBackgroundJob.update({
            where: { id: job.id },
            data: { status: 'failed', error: String(err) },
          });
          errors++;
        }
      }

      return { processed, errors };
    } finally {
      this.running = false;
    }
  }

  private static async executeJob(job: { userId: string; jobType: string }) {
    switch (job.jobType) {
      case 'profile-update':
        await this.updateUserProfile(job.userId);
        break;
      case 'rag-indexing':
        await this.runRagIndexing(job.userId);
        break;
      case 'insight-generation':
        await this.generateInsights(job.userId);
        break;
    }
  }

  private static async updateUserProfile(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [recentCheckins, recentBlocks] = await Promise.all([
      prisma.dailyCheckin.findMany({
        where: { userId },
        orderBy: { localDate: 'desc' },
        take: 30,
        select: { localDate: true, moodScore: true, energyScore: true, emotions: true, note: true, stateLabel: true },
      }),
      prisma.timelineBlock.findMany({
        where: { userId, localDate: { gte: thirtyDaysAgo } },
        select: { localDate: true, category: true, status: true, energyLevel: true },
      }),
    ]);

    if (recentCheckins.length < 3) return;

    // Cruzar humor com carga do planner por dia
    const blocksByDate: Record<string, { total: number; completed: number; categories: string[] }> = {};
    for (const b of recentBlocks) {
      const d = b.localDate.toISOString().split('T')[0];
      if (!blocksByDate[d]) blocksByDate[d] = { total: 0, completed: 0, categories: [] };
      blocksByDate[d].total++;
      if (b.status === 'completed') blocksByDate[d].completed++;
      if (b.category && !blocksByDate[d].categories.includes(b.category)) {
        blocksByDate[d].categories.push(b.category);
      }
    }

    const checkinsData = recentCheckins.map(c => {
      const dateKey = c.localDate.toISOString().split('T')[0];
      const dayBlocks = blocksByDate[dateKey];
      return {
        date: dateKey,
        mood: c.moodScore,
        energy: c.energyScore,
        stateLabel: c.stateLabel,
        emotions: c.emotions ?? [],
        note: c.note,
        plannerLoad: dayBlocks
          ? { taskTotal: dayBlocks.total, tasksDone: dayBlocks.completed, categories: dayBlocks.categories }
          : null,
      };
    });

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Analise os últimos ${recentCheckins.length} check-ins do usuário — incluindo dados cruzados com a carga de tarefas de cada dia (plannerLoad).
Identifique padrões reais: dias com muitas tarefas de trabalho correlacionam com humor baixo? Dias com autocuidado no planner correlacionam com energia mais alta?
Retorne JSON:
{
  "moodTrend": "descrição curta da tendência de humor nos últimos 30 dias",
  "energyPattern": "padrão de energia identificado (ex: cai às terças, sobe quando tem menos tarefas)",
  "mainTriggers": ["fator 1 com evidência", "fator 2 com evidência"],
  "plannerCorrelation": "como a carga e tipo de tarefas impacta o humor/energia",
  "recommendedActions": ["ação concreta 1", "ação concreta 2"]
}`;

    const completion = await openai.chat.completions.create({
      model: getOpenAiModel(),
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(checkinsData) },
      ],
      ...openAiTemperature(getOpenAiModel(), 0.3),
      ...getOpenAiOutputLimit(getOpenAiModel(), 4000),
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      await prisma.onboardingResponse.update({
        where: { userId },
        data: { aiProfileSummary: content },
      }).catch(() => {}); // ignora se onboarding não existir ainda
    }
  }

  private static async runRagIndexing(userId: string) {
    const oneHourAgo = new Date(Date.now() - INTERVALS['1h']);
    const memoryService = this.getMemoryService();

    // 1. Indexar mensagens novas do diário
    const newJournals = await prisma.journalMessage.findMany({
      where: { userId, createdAt: { gte: oneHourAgo }, role: 'user' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const journal of newJournals) {
      if (journal.content && journal.content.length > 10) {
        await memoryService.store({
          userId,
          contentType: 'journal',
          contentId: journal.id,
          content: journal.content,
        }).catch(() => {});
      }
    }

    // 2. Indexar notas de check-in recentes
    const recentCheckins = await prisma.dailyCheckin.findMany({
      where: { userId, createdAt: { gte: oneHourAgo }, note: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, note: true, localDate: true, moodScore: true, energyScore: true, stateLabel: true },
    });

    for (const checkin of recentCheckins) {
      if (checkin.note && checkin.note.trim().length >= 10) {
        await memoryService.store({
          userId,
          contentType: 'checkin_note',
          contentId: checkin.id,
          content: `${checkin.localDate.toISOString().split('T')[0]}: ${checkin.note.trim()}`,
          metadata: {
            moodScore: checkin.moodScore,
            energyScore: checkin.energyScore,
            stateLabel: checkin.stateLabel,
          },
        }).catch(() => {});
      }
    }

    // 3. Indexar objetivos ativos (não precisam de janela de tempo — upsert é idempotente)
    const objectives = await prisma.objective.findMany({
      where: { userId, archived: false, progress: { lt: 100 } },
      take: 10,
      select: { id: true, title: true, description: true, category: true, aiInsight: true, progress: true, archived: true },
    }).catch(() => []);

    for (const obj of objectives) {
      const content = [
        `Objetivo: ${obj.title}`,
        obj.description ? `Descrição: ${obj.description}` : null,
        obj.aiInsight ? `Insight: ${obj.aiInsight}` : null,
      ].filter(Boolean).join('\n');

      if (content.length > 10) {
        await memoryService.store({
          userId,
          contentType: 'goal',
          contentId: obj.id,
          content,
          metadata: { category: obj.category, objectiveId: obj.id, progress: obj.progress, archived: obj.archived },
        }).catch(() => {});
      }
    }
  }

  private static async generateInsights(userId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const checkins = await prisma.dailyCheckin.findMany({
      where: { userId, localDate: { gte: weekStart } },
      orderBy: { localDate: 'asc' },
    });

    if (checkins.length < 3) return;

    const avgMood = checkins.reduce((sum, c) => sum + (c.moodScore ?? 0), 0) / checkins.length;
    const avgEnergy = checkins.reduce((sum, c) => sum + (c.energyScore ?? 0), 0) / checkins.length;

    const existingInsight = await prisma.weeklyInsight.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    });

    if (existingInsight) {
      await prisma.weeklyInsight.update({
        where: { id: existingInsight.id },
        data: {
          avgMood,
          avgEnergy,
          checkinCount: checkins.length,
        },
      });
    }
  }
}

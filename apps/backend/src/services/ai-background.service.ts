import { PrismaClient } from '@app/database';
import { MemoryService } from './memory.service';
import { getOpenAiModel } from '../lib/openai-config';

const prisma = new PrismaClient();

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
    const recentCheckins = await prisma.dailyCheckin.findMany({
      where: { userId },
      orderBy: { localDate: 'desc' },
      take: 30,
    });

    if (recentCheckins.length < 3) return;

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const checkinsData = recentCheckins.map(c => ({
      date: c.localDate.toISOString().split('T')[0],
      mood: c.moodScore,
      energy: c.energyScore,
      emotions: c.emotions ?? [],
      note: c.note,
    }));

    const prompt = `Analise os últimos ${recentCheckins.length} check-ins do usuário e gere um resumo corto do perfil emocional/comportamental atual em formato JSON:
{
  "moodTrend": "descrição curta da tendência de humor",
  "energyPattern": "padrão de energia identificado",
  "mainTriggers": ["fator 1", "fator 2"],
  "recommendedActions": ["ação 1", "ação 2"]
}`;

    const completion = await openai.chat.completions.create({
      model: getOpenAiModel(),
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(checkinsData) }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      await prisma.onboardingResponse.update({
        where: { userId },
        data: { aiProfileSummary: content },
      });
    }
  }

  private static async runRagIndexing(userId: string) {
    const oneHourAgo = new Date(Date.now() - INTERVALS['1h']);
    const memoryService = this.getMemoryService();

    const newJournals = await prisma.journalMessage.findMany({
      where: { userId, createdAt: { gte: oneHourAgo } },
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
        });
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
import OpenAI from 'openai';
import { z } from 'zod';
import { PrismaClient } from '@app/database';
import { buildAuraSystemPrompt, getFirstName, humanizeScore } from '../lib/aura-prompt';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) { return (getOpenAI() as any)[prop]; },
});

const prisma = new PrismaClient();

export const WeeklyInsightSchema = z.object({
  summary: z.object({
    avgMood: z.number(),
    avgEnergy: z.number(),
    checkinCount: z.number(),
    journalSessions: z.number(),
    tasksCompleted: z.number(),
    tasksTotal: z.number(),
  }),
  patterns: z.array(z.object({
    type: z.enum(['energy', 'mood', 'productivity', 'sleep']),
    description: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  recommendations: z.array(z.object({
    category: z.enum(['planning', 'self-care', 'social']),
    text: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  aiAnalysis: z.string(),
  weeklyQuestion: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

export type WeeklyInsightData = z.infer<typeof WeeklyInsightSchema>;

export class InsightService {
  private static readonly MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  /**
   * Gera ou recupera insights semanais.
   */
  static async getWeeklyInsights(userId: string, weekStartStr: string): Promise<any> {
    const weekStart = new Date(weekStartStr);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // 1. Verificar Cache no Banco de Dados
    const existingInsight = await prisma.weeklyInsight.findUnique({
      where: {
        userId_weekStart: { userId, weekStart }
      }
    });

    // 2. Buscar Dados Brutos da Semana
    const [checkins, journalSessions, timeline, habits, profile, onboarding] = await Promise.all([
      prisma.dailyCheckin.findMany({
        where: { userId, localDate: { gte: weekStart, lt: weekEnd } },
        orderBy: { localDate: 'asc' }
      }),
      prisma.journalSession.findMany({
        where: { userId, localDate: { gte: weekStart, lt: weekEnd }, status: 'completed' },
        orderBy: { localDate: 'asc' }
      }),
      prisma.timelineBlock.findMany({
        where: { userId, localDate: { gte: weekStart, lt: weekEnd } },
        orderBy: { localDate: 'asc' }
      }),
      prisma.habit.findMany({
        where: { userId, archived: false },
        include: {
          completions: {
            where: { date: { gte: weekStart, lt: weekEnd } }
          }
        }
      }),
      prisma.profile.findUnique({
        where: { id: userId },
        select: { fullName: true },
      }),
      prisma.onboardingResponse.findUnique({
        where: { userId },
        select: { aiProfileSummary: true },
      }),
    ]);

    // Calcular correlações para hábitos ativos
    const habitCorrelations = await Promise.all(
      habits.map(async (h) => ({
        title: h.title,
        correlation: await InsightService.calculateHabitMoodCorrelation(userId, h.id)
      }))
    );

    const rawData = {
      checkins,
      journalSummaries: journalSessions.map(s => ({ date: s.localDate, summary: s.summary, emotions: s.emotions, themes: s.themes })),
      timeline: timeline.map(t => ({ title: t.title, status: t.status, intensity: t.intensity })),
      habits: habits.map(h => ({ title: h.title, completions: h.completions.length })),
      habitCorrelations
    };

    // Se já existe insight e não há novos dados relevantes (ex: checkinCount não mudou), retorna o cache
    if (existingInsight && (existingInsight.checkinCount === checkins.length)) {
      return {
        insights: existingInsight.insights as unknown as WeeklyInsightData,
        rawData
      };
    }

    // 3. Agregação de Dados para o Prompt
    const avgMood = checkins.reduce((acc, c) => acc + c.moodScore, 0) / (checkins.length || 1);
    const avgEnergy = checkins.reduce((acc, c) => acc + c.energyScore, 0) / (checkins.length || 1);
    const tasksCompleted = timeline.filter(t => t.status === 'completed').length;

    const summary = {
      avgMood: Number(avgMood.toFixed(1)),
      avgEnergy: Number(avgEnergy.toFixed(1)),
      checkinCount: checkins.length,
      journalSessions: journalSessions.length,
      tasksCompleted,
      tasksTotal: timeline.length
    };
    const latestCheckin = checkins[checkins.length - 1];
    const moodCycleContext = latestCheckin
      ? [
          latestCheckin.stateLabel ? `Ultimo estado: ${latestCheckin.stateLabel}.` : null,
          `Humor ${humanizeScore(latestCheckin.moodScore, 'mood')} e energia ${humanizeScore(latestCheckin.energyScore, 'energy')}.`,
          latestCheckin.stateSummary ? `Leitura atual: ${latestCheckin.stateSummary}` : null,
        ].filter(Boolean).join(' ')
      : null;
    const userName = getFirstName(profile?.fullName) ?? 'você';

    // 4. Chamada OpenAI para Análise de Padrões
    const habitLines = rawData.habits.map(h => `- ${h.title}: ${h.completions} conclusões`).join('\n');
    const correlationLines = rawData.habitCorrelations
      .filter(c => Math.abs(c.correlation) > 0.1)
      .map(c => `- ${c.title}: impacto de ${Math.round(c.correlation * 100)}% no humor`)
      .join('\n');

    const prompt = `
      Analise os dados semanais para identificar padrões de humor e energia de ${userName}.
      
      DADOS DA SEMANA:
      - Médias: Humor ${humanizeScore(summary.avgMood, 'mood')}, Energia ${humanizeScore(summary.avgEnergy, 'energy')}.
      - Check-ins: ${summary.checkinCount} realizados.
      - Diário: ${summary.journalSessions} sessões concluídas. Temas recorrentes: ${journalSessions.flatMap(s => s.themes).join(', ')}.
      - Planner: ${summary.tasksCompleted}/${summary.tasksTotal} tarefas concluídas.
      
      HÁBITOS:
      ${habitLines || 'Nenhum hábito registrado.'}
      
      CORRELAÇÕES IDENTIFICADAS:
      ${correlationLines || 'Ainda sem correlações significativas.'}

      REGRAS:
      1. Identifique 2-3 padrões (patterns) reais baseados nos dados (ex: queda de energia após dias produtivos, ou humor melhorando com certo hábito).
      2. Dê 2-3 recomendações práticas (recommendations) para a próxima semana.
      3. Escreva uma análise narrativa (aiAnalysis) empática de 3-5 frases.
      4. Gere uma pergunta reflexiva semanal (weeklyQuestion) — aberta, gentil, que convide a pessoa a olhar para si. Ex: "O que te surpreendeu positivamente esta semana?"
      5. Liste até 3 conquistas ou momentos positivos desta semana (highlights) — frases curtas, celebratórias, baseadas nos dados reais. Ex: "Completou 4 hábitos em um único dia", "Manteve sequência de 5 dias de meditação".

      Retorne APENAS um JSON puro no formato esperado.
    `;

    const response = await openai.chat.completions.create({
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: buildAuraSystemPrompt({
            userName,
            profileSummary: onboarding?.aiProfileSummary ?? null,
            moodCycleContext,
            domain: 'insight',
          }),
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const aiResult = WeeklyInsightSchema.parse(JSON.parse(response.choices[0].message.content || '{}'));

    // 5. Salvar/Atualizar no Cache
    const savedInsight = await prisma.weeklyInsight.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      update: {
        avgMood: summary.avgMood,
        avgEnergy: summary.avgEnergy,
        checkinCount: summary.checkinCount,
        insights: aiResult as any
      },
      create: {
        userId,
        weekStart,
        avgMood: summary.avgMood,
        avgEnergy: summary.avgEnergy,
        checkinCount: summary.checkinCount,
        insights: aiResult as any
      }
    });

    return {
      insights: aiResult,
      rawData
    };
  }

  /**
   * Calcula a correlação entre a conclusão de um hábito e o humor do usuário.
   * Retorna um score de -1 a 1.
   */
  static async calculateHabitMoodCorrelation(userId: string, habitId: string): Promise<number> {
    const [completions, checkins] = await Promise.all([
      prisma.habitCompletion.findMany({
        where: { habitId },
        orderBy: { date: 'asc' },
      }),
      prisma.dailyCheckin.findMany({
        where: { userId },
        orderBy: { localDate: 'asc' },
      }),
    ]);

    if (completions.length === 0 || checkins.length === 0) return 0;

    // Criar mapa de humor por data
    const moodMap = new Map<string, number[]>();
    checkins.forEach((c) => {
      const dateKey = format(c.localDate, 'yyyy-MM-dd');
      if (!moodMap.has(dateKey)) moodMap.set(dateKey, []);
      moodMap.get(dateKey)!.push(c.moodScore);
    });

    // Média de humor por dia
    const dailyMoodAvg = new Map<string, number>();
    moodMap.forEach((scores, date) => {
      dailyMoodAvg.set(date, scores.reduce((a, b) => a + b, 0) / scores.length);
    });

    // Separar grupos: humor em dias com hábito vs dias sem hábito
    const moodWithHabit: number[] = [];
    const moodWithoutHabit: number[] = [];

    const completionDates = new Set(completions.map((c) => format(c.date, 'yyyy-MM-dd')));

    dailyMoodAvg.forEach((avgMood, date) => {
      if (completionDates.has(date)) {
        moodWithHabit.push(avgMood);
      } else {
        moodWithoutHabit.push(avgMood);
      }
    });

    if (moodWithHabit.length === 0 || moodWithoutHabit.length === 0) return 0;

    const avgWith = moodWithHabit.reduce((a, b) => a + b, 0) / moodWithHabit.length;
    const avgWithout = moodWithoutHabit.reduce((a, b) => a + b, 0) / moodWithoutHabit.length;

    // Diferença normalizada para escala -1 a 1 (assumindo mood de 0 a 5)
    return (avgWith - avgWithout) / 5;
  }
}

// Helper para formatar data sem importar date-fns se possível, ou importar
function format(date: Date, fmt: string): string {
  const d = new Date(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

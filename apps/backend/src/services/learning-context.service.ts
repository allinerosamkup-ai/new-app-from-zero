import { PrismaClient } from '@app/database';
import { prisma } from '../lib/prisma';

const WEEKDAY_LABEL: Record<number, string> = {
  1: 'segunda',
  2: 'terça',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sábado',
  7: 'domingo',
};

export type EnergyByWeekday = {
  user_id?: string;
  weekday: number;
  avg_mood: number | string;
  avg_energy: number | string;
  samples: number;
};

export type CrashEvent = {
  user_id?: string;
  crash_date: string;
  prev_mood: number;
  new_mood: number;
  mood_delta: number;
};

export type BestDay = {
  user_id?: string;
  weekday: number;
  good_count: number;
};

export type RecurringTheme = {
  user_id?: string;
  theme: string;
  occurrences: number;
};

export type LearningContext = {
  energyByWeekday: EnergyByWeekday[];
  crashHistory: CrashEvent[];
  bestDays: BestDay[];
  recurringThemes: RecurringTheme[];
};

/**
 * LearningContextService — agrega padrões longitudinais a partir das views SQL
 * v_user_energy_by_weekday, v_user_crash_history, v_user_best_days,
 * v_user_recurring_themes (migration add_user_learning_context_views).
 *
 * Uso típico:
 *   const ctx = await LearningContextService.get(userId);
 *   const text = LearningContextService.formatForPrompt(ctx);
 *   // text vai pra extraInstructions do PlannerAIService.
 */
export class LearningContextService {
  /** Cache simples em memória (5 min) — evita chamar SQL toda vez. */
  private static cache = new Map<string, { value: LearningContext; expiresAt: number }>();
  private static readonly TTL_MS = 5 * 60 * 1000;

  static async get(userId: string, options: { skipCache?: boolean } = {}): Promise<LearningContext | null> {
    const cached = !options.skipCache ? this.cache.get(userId) : undefined;
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const rows = await prisma.$queryRaw<Array<{ ctx: LearningContext }>>`
        SELECT get_user_learning_context(${userId}::uuid) AS ctx
      `;
      const ctx = rows?.[0]?.ctx ?? null;
      if (ctx) {
        this.cache.set(userId, { value: ctx, expiresAt: Date.now() + this.TTL_MS });
      }
      return ctx;
    } catch (error) {
      console.warn('[learning-context] falha:', error);
      return null;
    }
  }

  /**
   * Serializa o contexto em formato compacto pro prompt da IA.
   * Retorna string vazia se não houver dados úteis.
   */
  static formatForPrompt(ctx: LearningContext | null): string {
    if (!ctx) return '';
    const lines: string[] = [];

    if (Array.isArray(ctx.energyByWeekday) && ctx.energyByWeekday.length > 0) {
      const parts = ctx.energyByWeekday
        .filter((e) => e.weekday >= 1 && e.weekday <= 7)
        .sort((a, b) => a.weekday - b.weekday)
        .map((e) => `${WEEKDAY_LABEL[e.weekday] ?? e.weekday} ${Number(e.avg_mood).toFixed(1)}/${Number(e.avg_energy).toFixed(1)}`);
      if (parts.length > 0) lines.push(`Humor/Energia média por dia da semana (60d): ${parts.join(', ')}.`);
    }

    if (Array.isArray(ctx.bestDays) && ctx.bestDays.length > 0) {
      const parts = ctx.bestDays
        .slice(0, 3)
        .map((b) => `${WEEKDAY_LABEL[b.weekday] ?? b.weekday} (${b.good_count} dias bons)`);
      if (parts.length > 0) lines.push(`Melhores dias (humor+energia >=4 simultaneamente, 60d): ${parts.join(', ')}.`);
    }

    if (Array.isArray(ctx.crashHistory) && ctx.crashHistory.length > 0) {
      const recent = ctx.crashHistory.slice(0, 3);
      const summary = recent.map((c) => `${c.crash_date} (${c.prev_mood}→${c.new_mood})`).join(', ');
      lines.push(`Quedas de humor recentes (>=3 pts em 24h): ${recent.length} eventos. Últimos: ${summary}.`);
    }

    if (Array.isArray(ctx.recurringThemes) && ctx.recurringThemes.length > 0) {
      const parts = ctx.recurringThemes
        .slice(0, 5)
        .map((t) => `${t.theme} (${t.occurrences}x)`);
      lines.push(`Temas recorrentes em diários (30d): ${parts.join(', ')}.`);
    }

    if (lines.length === 0) return '';
    return lines.join('\n');
  }

  /** Limpa cache (útil para testes ou após mudança grande). */
  static clearCache(userId?: string): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }
}

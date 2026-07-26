import { PrismaClient } from '@app/database';
import { startOfDay, subDays, isSameDay } from 'date-fns';

const prisma = new PrismaClient();

export function parseHabitReferenceDate(value: string | Date | undefined): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('habit_date_invalid');
    return value;
  }
  if (!value) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('habit_date_invalid');
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== Number(year)
    || parsed.getMonth() !== Number(month) - 1
    || parsed.getDate() !== Number(day)
  ) {
    throw new Error('habit_date_invalid');
  }
  return parsed;
}

export interface CreateHabitInput {
  userId: string;
  title: string;
  description?: string;
  category?: string;
  icon?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetDays?: number[];
  targetCount?: number;
  timeOfDay?: string;
  durationMinutes?: number;
  reminderEnabled?: boolean;
  reminderTime?: string;
  persistentReminderEnabled?: boolean;
  persistentReminderIntervalMinutes?: number;
}

function resolveTargetCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(24, Math.round(count)));
}

function getCompletionCount(completion: { completionCount?: number | null } | null | undefined): number {
  if (!completion) return 0;
  return Math.max(0, Number(completion.completionCount ?? 1));
}

export class HabitService {
  static async listHabits(userId: string, referenceDate: Date = new Date()) {
    return prisma.habit.findMany({
      where: {
        userId,
        archived: false,
      },
      include: {
        completions: {
          where: {
            date: startOfDay(referenceDate),
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Cria um novo hábito para o usuário.
   */
  static async createHabit(input: CreateHabitInput) {
    return prisma.habit.create({
      data: {
        userId: input.userId,
        title: input.title,
        description: input.description,
        category: input.category || 'geral',
        icon: input.icon,
        frequency: input.frequency,
        targetDays: input.targetDays || [],
        targetCount: resolveTargetCount(input.targetCount),
        timeOfDay: input.timeOfDay,
        durationMinutes: input.durationMinutes,
        reminderEnabled: input.reminderEnabled || false,
        reminderTime: input.reminderTime,
        persistentReminderEnabled: input.persistentReminderEnabled || false,
        persistentReminderIntervalMinutes: input.persistentReminderEnabled
          ? input.persistentReminderIntervalMinutes ?? 60
          : null,
      },
    });
  }

  /**
   * Lista os hábitos de um usuário que devem ser realizados em uma data específica.
   */
  static async getHabitsForDate(userId: string, date: Date) {
    const dayOfWeek = date.getDay(); // 0-6
    const habits = await this.listHabits(userId, date);

    return habits.filter(habit => {
      if (habit.frequency === 'daily') return true;
      if (habit.frequency === 'weekly') return habit.targetDays.length === 0 || habit.targetDays.includes(dayOfWeek);
      if (habit.frequency === 'monthly') return date.getDate() === 1; // Simplificado para dia 1
      return false;
    });
  }

  /**
   * Registra ou inverte a conclusão de um hábito em uma data.
   */
  static async toggleCompletion(habitId: string, date: Date, userId: string, notes?: string) {
    const localDate = startOfDay(date);

    const habit = await prisma.habit.findUnique({
      where: { id: habitId },
      include: { completions: true },
    });

    if (!habit || habit.userId !== userId) {
      throw new Error('Habit not found or access denied');
    }

    const existingCompletion = await prisma.habitCompletion.findUnique({
      where: {
        habitId_date: {
          habitId,
          date: localDate,
        },
      },
    });

    if (existingCompletion) {
      const currentCount = getCompletionCount(existingCompletion);
      const targetCount = resolveTargetCount(habit.targetCount);

      if (currentCount >= targetCount) {
        // Remover conclusão quando o hábito já estava completo.
        await prisma.habitCompletion.delete({
          where: { id: existingCompletion.id },
        });
      } else {
        await prisma.habitCompletion.update({
          where: { id: existingCompletion.id },
          data: {
            completionCount: currentCount + 1,
            notes,
            completedAt: new Date(),
          },
        });
      }
    } else {
      // Adicionar conclusão
      await prisma.habitCompletion.create({
        data: {
          habitId,
          date: localDate,
          completionCount: 1,
          notes,
        },
      });
    }

    // Recalcular streaks e totalCompletions
    return this.recalculateStats(habitId);
  }

  /**
   * Recalcula estatísticas de streak e total de conclusões.
   */
  static async recalculateStats(habitId: string) {
    const completions = await prisma.habitCompletion.findMany({
      where: { habitId },
      orderBy: { date: 'desc' },
    });

    const habit = await prisma.habit.findUnique({ where: { id: habitId } });
    const totalCompletions = completions.reduce((sum, completion) => sum + getCompletionCount(completion), 0);
    const currentStreak = this.calculateCurrentStreak(completions, resolveTargetCount(habit?.targetCount));
    const bestStreak = Math.max(habit?.bestStreak || 0, currentStreak);

    return prisma.habit.update({
      where: { id: habitId },
      data: {
        streakCount: currentStreak,
        bestStreak: bestStreak,
        totalCompletions: totalCompletions,
      },
    });
  }

  private static calculateCurrentStreak(completions: any[], targetCount: number): number {
    if (completions.length === 0) return 0;

    let streak = 0;
    const today = startOfDay(new Date());
    let checkDate = today;
    const completedOnDate = (date: Date) => completions.some(c => isSameDay(c.date, date) && getCompletionCount(c) >= targetCount);

    // Se não completou hoje, verifica se completou ontem para manter a streak ativa
    const completedToday = completedOnDate(today);
    const completedYesterday = completedOnDate(subDays(today, 1));

    if (!completedToday && !completedYesterday) return 0;
    
    if (!completedToday && completedYesterday) {
      checkDate = subDays(today, 1);
    }

    // Percorre as conclusões em ordem decrescente de data
    const sortedCompletions = [...completions].sort((a, b) => b.date.getTime() - a.date.getTime());
    
    let expectedDate = checkDate;
    for (const comp of sortedCompletions) {
      if (isSameDay(comp.date, expectedDate) && getCompletionCount(comp) >= targetCount) {
        streak++;
        expectedDate = subDays(expectedDate, 1);
      } else if (comp.date < expectedDate) {
        // Buraco na streak
        break;
      }
    }

    return streak;
  }
}

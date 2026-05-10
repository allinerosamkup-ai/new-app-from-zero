import type { AuraState, Goal, Habit, Task, CheckinEntry } from "../features/aura/types";

export type DailyCloseAdjustment = {
  title: string;
  description: string;
  source: "task" | "habit" | "goal" | "checkin";
  path: string;
};

export type DailyCloseSummary = {
  hasData: boolean;
  headline: string;
  evidence: string[];
  stats: {
    completedTasks: number;
    pendingTasks: number;
    completedHabits: number;
    pendingHabits: number;
    checkins: number;
    activeGoals: number;
  };
  tomorrowAdjustments: DailyCloseAdjustment[];
  primaryAction: {
    label: string;
    path: string;
  };
};

type DailyCloseInput = Pick<
  AuraState,
  "tasks" | "habits" | "goals" | "checkinHistory" | "journal"
>;

function habitCompletionCount(habit: Habit): number {
  const firstCompletion = habit.completions?.[0];
  if (!firstCompletion) return 0;
  return Math.max(1, Number(firstCompletion.completionCount ?? 1));
}

function habitTargetCount(habit: Habit): number {
  return Math.max(1, Number(habit.targetCount ?? 1));
}

function getLatestCheckin(checkins: CheckinEntry[]): CheckinEntry | null {
  return [...checkins].sort((a, b) => {
    const left = a.recordedAt ? new Date(a.recordedAt).getTime() : new Date(`${a.date}T12:00:00`).getTime();
    const right = b.recordedAt ? new Date(b.recordedAt).getTime() : new Date(`${b.date}T12:00:00`).getTime();
    return right - left;
  })[0] ?? null;
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildTaskAdjustment(task: Task, lowEnergy: boolean): DailyCloseAdjustment {
  return {
    title: task.title,
    description: lowEnergy
      ? "Levar para amanha com escopo menor: reduzir carga antes de tentar executar."
      : "Levar para amanha como primeiro bloco realista, sem abrir outra frente antes.",
    source: "task",
    path: "/planner",
  };
}

function buildHabitAdjustment(habit: Habit): DailyCloseAdjustment {
  return {
    title: habit.title,
    description: "Retomar como ajuste leve, sem tratar como compromisso pesado.",
    source: "habit",
    path: "/habits",
  };
}

function buildGoalAdjustment(goal: Goal): DailyCloseAdjustment {
  return {
    title: goal.title,
    description: "Escolher um avanco minimo de 20 minutos antes de planejar algo maior.",
    source: "goal",
    path: "/goals",
  };
}

export function buildDailyCloseSummary(input: DailyCloseInput): DailyCloseSummary {
  const tasks = input.tasks ?? [];
  const habits = input.habits ?? [];
  const goals = input.goals ?? [];
  const checkins = input.checkinHistory ?? [];
  const journal = input.journal?.trim() ?? "";

  const completedTasks = tasks.filter((task) => task.done).length;
  const pendingTasks = tasks.filter((task) => !task.done).length;
  const pendingTaskList = tasks.filter((task) => !task.done && task.title.trim()).slice(0, 3);
  const completedHabits = habits.filter((habit) => habitCompletionCount(habit) >= habitTargetCount(habit)).length;
  const pendingHabitList = habits
    .filter((habit) => habit.title.trim())
    .filter((habit) => habitCompletionCount(habit) < habitTargetCount(habit))
    .slice(0, 2);
  const pendingHabits = pendingHabitList.length;
  const activeGoals = goals.filter((goal) => goal.completedPct < 100).length;
  const activeGoalList = goals.filter((goal) => goal.completedPct < 100 && goal.title.trim()).slice(0, 2);
  const latestCheckin = getLatestCheckin(checkins);
  const lowEnergy = Number(latestCheckin?.energia ?? 0) > 0 && Number(latestCheckin?.energia ?? 0) <= 4;
  const hasData = completedTasks + pendingTasks + completedHabits + pendingHabits + activeGoals + checkins.length > 0 || journal.length > 0;

  if (!hasData) {
    return {
      hasData: false,
      headline: "Ainda nao ha dados suficientes para fechar o dia.",
      evidence: [],
      stats: {
        completedTasks: 0,
        pendingTasks: 0,
        completedHabits: 0,
        pendingHabits: 0,
        checkins: 0,
        activeGoals: 0,
      },
      tomorrowAdjustments: [],
      primaryAction: {
        label: "Fazer check-in",
        path: "/checkin",
      },
    };
  }

  const evidence = [
    checkins.length > 0 ? formatCount(checkins.length, "check-in", "check-ins") : null,
    latestCheckin ? `ultimo estado: humor ${latestCheckin.humor}/10 e energia ${latestCheckin.energia}/10` : null,
    pendingTasks > 0 ? `${formatCount(pendingTasks, "pendencia", "pendencias")} no Planner` : null,
    completedTasks > 0 ? `${formatCount(completedTasks, "tarefa concluida", "tarefas concluidas")}` : null,
    pendingHabits > 0 ? `${formatCount(pendingHabits, "habito devido", "habitos devidos")}` : null,
    activeGoals > 0 ? `${formatCount(activeGoals, "meta ativa", "metas ativas")}` : null,
  ].filter((item): item is string => Boolean(item));

  const adjustments = [
    ...pendingTaskList.map((task) => buildTaskAdjustment(task, lowEnergy)),
    ...pendingHabitList.map(buildHabitAdjustment),
    ...activeGoalList.map(buildGoalAdjustment),
  ].slice(0, 3);

  return {
    hasData: true,
    headline: completedTasks > 0
      ? `Hoje fechou com ${formatCount(completedTasks, "coisa concluida", "coisas concluidas")}.`
      : lowEnergy
        ? "Hoje pediu menos carga e mais recuperacao."
        : "Hoje ainda tem informacao util para ajustar amanha.",
    evidence,
    stats: {
      completedTasks,
      pendingTasks,
      completedHabits,
      pendingHabits,
      checkins: checkins.length,
      activeGoals,
    },
    tomorrowAdjustments: adjustments,
    primaryAction: {
      label: adjustments.length > 0 ? "Abrir Planner de amanha" : "Revisar Planner",
      path: "/planner",
    },
  };
}


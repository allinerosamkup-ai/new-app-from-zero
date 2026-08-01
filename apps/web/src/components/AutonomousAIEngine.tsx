// AutonomousAIEngine v2 — daemon de IA proativa
//
// Responsabilidades:
//  #1 — Passa MoodCycleReport.aiContext completo para todas as análises
//  #2 — Detecta mudança de fase e gera PhaseTransitionAlert
//  #5 — Atualiza aiProfileSummary se 7+ dias sem update e 7+ checkins
//  #7 — Follow-up loop: 2h após sugestão aceita, gera mensagem de acompanhamento
//
// Roda silenciosamente em background — sem UI.

import { useEffect, useRef } from "react";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { tryParseAiSuggestion } from "../lib/ai";
import { aggregateCheckinsByDay, computeMoodCycle, PHASE_CONFIG, type MoodPhase } from "../utils/mood-cycle-engine";
import { isProactiveNudgeDismissedToday } from "../utils/proactive-nudge-dismissal";
import { getLocalDateKey, normalizeDateKey } from "../utils/day-context";
import {
  extractBlockedHomeAutonomyTitles,
  readHomeAutonomyFeedback,
} from "../routes/home-page.helpers";
import type { AutonomousInsight, CheckinEntry, FollowUpPending, PhaseTransitionAlert, ProactiveNudge } from "../features/aura/types";

const MIN_CHECKINS = 3;
const RERUN_HOURS = 4;
const PROFILE_UPDATE_DAYS = 7;

// Fonte única de verdade para labels: PHASE_CONFIG do engine.
const phaseLabel = (phase: string): string =>
  PHASE_CONFIG[phase as MoodPhase]?.label ?? phase;

function habitCompletionCount(habit: { completions?: Array<{ completionCount?: number | null } | unknown> }): number {
  const completion = habit.completions?.[0];
  if (!completion) return 0;
  if (completion !== null && typeof completion === "object" && "completionCount" in completion) {
    const count = Number((completion as { completionCount?: number | null }).completionCount ?? 1);
    return Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
  }
  return 1;
}

function habitTargetCount(habit: { targetCount?: number | null }): number {
  const count = Number(habit.targetCount ?? 1);
  return Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
}

function habitIsDueToday(habit: { frequency?: string | null; targetDays?: number[] | null }, referenceDate = new Date()): boolean {
  const frequency = habit.frequency ?? "daily";
  if (frequency === "daily") return true;
  if (frequency === "weekly") {
    const targetDays = Array.isArray(habit.targetDays) ? habit.targetDays : [];
    return targetDays.length === 0 || targetDays.includes(referenceDate.getDay());
  }
  if (frequency === "monthly") return referenceDate.getDate() === 1;
  return true;
}

function habitCompletedToday(habit: { completions?: Array<{ date?: string; completionCount?: number | null } | unknown>; targetCount?: number | null }, today: string): boolean {
  const target = habitTargetCount(habit);
  const count = (habit.completions || []).reduce((total: number, completion) => {
    if (!completion || typeof completion !== "object") return total;
    const item = completion as { date?: string; completionCount?: number | null };
    if (normalizeDateKey(item.date) !== today) return total;
    return total + habitCompletionCount({ completions: [item] });
  }, 0);
  return count >= target;
}

function buildHomeAutonomyRuntimeContext(state: ReturnType<typeof useAuraStore>["state"]) {
  const today = getLocalDateKey();
  const now = new Date();
  const pendingTodayTasks = (state.tasks || [])
    .filter((task) => !task.done)
    .map((task) => task.title)
    .filter(Boolean);
  const completedTodayTasks = (state.tasks || [])
    .filter((task) => task.done)
    .map((task) => task.title)
    .filter(Boolean);
  const dueHabitsToday = (state.habits || [])
    .filter((habit) => habitIsDueToday(habit, now));
  const completedTodayHabits = dueHabitsToday
    .filter((habit) => habitCompletedToday(habit, today))
    .map((habit) => habit.title)
    .filter(Boolean);
  const pendingTodayHabits = dueHabitsToday
    .filter((habit) => !habitCompletedToday(habit, today))
    .map((habit) => habit.title)
    .filter(Boolean);
  const feedbackItems = readHomeAutonomyFeedback();
  const feedback = feedbackItems.map((item) => ({
    title: item.title,
    status: item.status,
    createdAt: item.createdAt,
  }));

  return {
    pendingTaskTitles: pendingTodayTasks,
    pendingHabitTitles: pendingTodayHabits,
    completedTaskTitles: completedTodayTasks,
    completedHabitTitles: completedTodayHabits,
    completedGoalTitles: (state.goals || [])
      .filter((goal) => goal.completedPct >= 100)
      .map((goal) => goal.title)
      .filter(Boolean),
    completedSubgoalTitles: (state.goals || [])
      .flatMap((goal) => goal.subtasks || [])
      .filter((subgoal) => subgoal.done)
      .map((subgoal) => subgoal.title)
      .filter(Boolean),
    blockedActionTitles: extractBlockedHomeAutonomyTitles(feedbackItems),
    homeAutonomyFeedback: feedback,
    todayAnchorTitles: [
      ...pendingTodayTasks,
      ...pendingTodayHabits,
      ...(state.goals || []).filter((goal) => goal.completedPct < 100).map((goal) => goal.title),
    ].filter(Boolean),
    localDate: today,
  };
}

function transitionSeverity(
  _from: string,
  to: string
): PhaseTransitionAlert["severity"] {
  if (to === "depleted" || to === "low") return "critical";
  if (to === "falling" || to === "mixed" || to === "elevated") return "warning";
  return "info";
}

export function AutonomousAIEngine() {
  const {
    state,
    setAutonomousInsight,
    setPhaseTransitionAlert,
    setPendingFollowUp,
    setLastProfileUpdate,
    setProactiveNudge,
  } = useAuraStore();

  const lastHistoryKeyRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const stabilityInFlightRef = useRef(false);
  const transitionInFlightRef = useRef(false);
  const profileInFlightRef = useRef(false);
  const followUpInFlightRef = useRef(false);

  // ── #1 + #2: Stability analysis + Phase Transition ────────────────────────
  useEffect(() => {
    const history = aggregateCheckinsByDay(state.checkinHistory || []);
    if (history.length < MIN_CHECKINS) return;

    const recentHistory = history.slice(-7);
    const historyKey = JSON.stringify(
      recentHistory.map((e) => [e.date, e.humor, e.energia, e.sono, e.fisico, e.social])
    );

    // #1 — Computa fase com engine completo para ter aiContext rico
    const cycleReport = computeMoodCycle(history);
    const currentPhase = cycleReport.phase;
    const latestHistoryDate = history[history.length - 1]?.date ?? null;

    // #2 — Detecta transição de fase
    const storedPhase = localStorage.getItem("aura_last_phase");
    const storedPhaseDate = localStorage.getItem("aura_last_phase_date");

    if (!initializedRef.current) {
      // Primeiro mount: apenas registra a fase atual, nunca dispara alerta
      initializedRef.current = true;
      lastPhaseRef.current = currentPhase;
      localStorage.setItem("aura_last_phase", currentPhase);
      if (latestHistoryDate) {
        localStorage.setItem("aura_last_phase_date", latestHistoryDate);
      }
    } else {
      const prevPhase = lastPhaseRef.current ?? storedPhase;
      const prevPhaseDate = storedPhaseDate;
      const hasNewDailySnapshot = Boolean(latestHistoryDate && latestHistoryDate !== prevPhaseDate);

      if (
        prevPhase &&
        hasNewDailySnapshot &&
        prevPhase !== currentPhase &&
        currentPhase !== "insufficient_data" &&
        state.notificationPreferences.aiSuggestions &&
        !transitionInFlightRef.current &&
        (!state.phaseTransitionAlert || state.phaseTransitionAlert.dismissed)
      ) {
        transitionInFlightRef.current = true;
        void runPhaseTransitionAlert(
          prevPhase,
          currentPhase,
          phaseLabel(currentPhase),
          cycleReport.aiContext,
          setPhaseTransitionAlert
        ).finally(() => {
          transitionInFlightRef.current = false;
        });
      }
      lastPhaseRef.current = currentPhase;
      localStorage.setItem("aura_last_phase", currentPhase);
      if (latestHistoryDate) {
        localStorage.setItem("aura_last_phase_date", latestHistoryDate);
      }
    }

    // #1 — Stability analysis com moodCycleContext completo
    if (state.autonomousInsight) {
      const age = Date.now() - new Date(state.autonomousInsight.generatedAt).getTime();
      if (age < RERUN_HOURS * 3600_000 && lastHistoryKeyRef.current === historyKey) return;
    }

    if (stabilityInFlightRef.current || lastHistoryKeyRef.current === historyKey) return;

    stabilityInFlightRef.current = true;
    lastHistoryKeyRef.current = historyKey;

    void runStabilityAnalysis(
      recentHistory,
      cycleReport.aiContext,
      state.goals?.filter((goal) => goal.completedPct < 100).map((goal) => goal.title) ?? [],
      state.tasks?.filter((task) => !task.done).slice(0, 5).map((task) => task.title) ?? [],
      setAutonomousInsight,
      buildHomeAutonomyRuntimeContext(state)
    ).finally(() => {
      stabilityInFlightRef.current = false;
    });
  }, [
    state.checkinHistory,
    state.goals,
    state.tasks,
    state.habits,
    state.autonomousInsight?.generatedAt,
    state.phaseTransitionAlert,
    state.notificationPreferences.aiSuggestions,
    setAutonomousInsight,
    setPhaseTransitionAlert,
  ]);

  // ── #5: Profile auto-update ────────────────────────────────────────────────
  useEffect(() => {
    const history = aggregateCheckinsByDay(state.checkinHistory || []);
    if (history.length < 7 || profileInFlightRef.current) return;

    const lastUpdate = state.lastProfileUpdate;
    const daysSinceUpdate = lastUpdate
      ? (Date.now() - new Date(lastUpdate).getTime()) / 86_400_000
      : Infinity;

    if (daysSinceUpdate < PROFILE_UPDATE_DAYS) return;

    profileInFlightRef.current = true;
    void runProfileUpdate(history, setLastProfileUpdate, state.goals || []).finally(() => {
      profileInFlightRef.current = false;
    });
  }, [state.checkinHistory, state.lastProfileUpdate, setLastProfileUpdate]);

  // ── #7: Follow-up loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const followUp = state.pendingFollowUp;
    if (!followUp || followUp.response !== null || followUp.followUpMessage !== null) return;
    if (followUpInFlightRef.current) return;

    const now = Date.now();
    const scheduledFor = new Date(followUp.scheduledFor).getTime();
    if (now < scheduledFor) return;

    followUpInFlightRef.current = true;
    const cycleReport = computeMoodCycle(state.checkinHistory || []);
    void runFollowUpGeneration(
      followUp,
      cycleReport.aiContext,
      setPendingFollowUp
    ).finally(() => {
      followUpInFlightRef.current = false;
    });
  }, [state.pendingFollowUp, state.checkinHistory, setPendingFollowUp]);

  // ── #8: Proactive Nudges (client-side, no API needed) ─────────────────────
  useEffect(() => {
    const history = state.checkinHistory || [];
    const goals = state.goals || [];
    const now = Date.now();
    const localHour = new Date(now).getHours();
    const isNudgeWindow = localHour >= 7 && localHour <= 22;

    if (!state.notificationPreferences.aiSuggestions) {
      if (state.proactiveNudge) setProactiveNudge(null);
      return;
    }

    // Priority 1: no check-in for 48h
    const latestCheckinMs = history.reduce<number>((latest, entry) => {
      const recorded = entry.recordedAt ? new Date(entry.recordedAt).getTime() : Number.NaN;
      const fallback = new Date(`${entry.date}T12:00:00`).getTime();
      const timestamp = Number.isNaN(recorded) ? fallback : recorded;
      return Math.max(latest, timestamp);
    }, Number.NEGATIVE_INFINITY);
    const daysSince = Number.isFinite(latestCheckinMs)
      ? (now - latestCheckinMs) / 86_400_000
      : Infinity;

    const shouldThrottleSameNudge = (type: ProactiveNudge["type"]) => {
      if (!state.proactiveNudge || state.proactiveNudge.type !== type) return false;
      const age = now - new Date(state.proactiveNudge.generatedAt).getTime();
      return age < 6 * 3600_000;
    };

    // Priority 1a: smart timing — notifica no horário histórico da usuária (sem check-in hoje)
    const today = getLocalDateKey();
    const todayCheckin = history.find(h => h.date === today);
    if (isNudgeWindow && !todayCheckin && history.length >= 5 && !shouldThrottleSameNudge("checkin_missing")) {
      // Descobrir a hora mais frequente de check-in nos últimos 30 registros
      const hourCounts: Record<number, number> = {};
      history.slice(-30).forEach(h => {
        if (h.recordedAt) {
          const hr = new Date(h.recordedAt).getHours();
          hourCounts[hr] = (hourCounts[hr] ?? 0) + 1;
        }
      });
      const sortedHours = Object.entries(hourCounts).sort(([, a], [, b]) => b - a);
      if (sortedHours.length > 0) {
        const preferredHour = Number(sortedHours[0][0]);
        const currentHour = new Date(now).getHours();
        // Dispara quando estiver dentro de ±1h do horário preferido
        if (Math.abs(currentHour - preferredHour) <= 1) {
          const timeLabel =
            preferredHour < 12 ? "manhã" :
            preferredHour < 18 ? "tarde" : "noite";
          const smartNudge: ProactiveNudge = {
            type: "checkin_missing",
            title: "Hora do check-in 🌿",
            message: `Costuma fazer seu registro de ${timeLabel} por volta desta hora. Leva 30 segundos.`,
            action: { label: "Fazer check-in", path: "/checkin" },
            priority: "medium",
            generatedAt: new Date().toISOString(),
          };
          if (!isProactiveNudgeDismissedToday(smartNudge)) {
            setProactiveNudge(smartNudge);
            return;
          }
        }
      }
    }

    if (isNudgeWindow && daysSince >= 2) {
      const days = Math.floor(daysSince);
      if (shouldThrottleSameNudge("checkin_missing")) return;
      const nudge: ProactiveNudge = {
        type: "checkin_missing",
        title: days >= 3 ? "Airia com saudade 💛" : "Check-in em falta",
        message: days >= 3
          ? `Faz ${days} dias sem check-in. Pequenos registros fazem toda a diferença no seu padrão.`
          : "Ontem não teve check-in. 2 minutos bastam para manter o padrão.",
        action: { label: "Fazer meu check-in", path: "/checkin" },
        priority: days >= 3 ? "high" : "medium",
        generatedAt: new Date().toISOString(),
      };
      if (isProactiveNudgeDismissedToday(nudge)) return;
      setProactiveNudge(nudge);
      return;
    }

    // Próxima ação existente da meta, nunca uma cobrança genérica ou item local sem fonte.
    const activeGoal = goals
      .map((goal) => ({ goal, action: goal.subtasks.find((subtask) => !subtask.done) }))
      .find((item) => item.action);
    if (activeGoal?.action) {
      if (shouldThrottleSameNudge("goal_stagnant")) return;
      const nudge: ProactiveNudge = {
        type: "goal_stagnant",
        title: "Próxima ação da sua meta",
        message: `"${activeGoal.action.title}" está pronta em "${activeGoal.goal.title}".`,
        action: { label: "Ver metas", path: "/goals" },
        priority: "medium",
        generatedAt: new Date().toISOString(),
      };
      if (isProactiveNudgeDismissedToday(nudge)) return;
      setProactiveNudge(nudge);
      return;
    }

    // No nudge needed — clear any stale one
    if (state.proactiveNudge) setProactiveNudge(null);
  }, [state.checkinHistory, state.goals, state.notificationPreferences.aiSuggestions, state.proactiveNudge, setProactiveNudge]);

  return null;
}

// ── Stability Analysis (#1) ─────────────────────────────────────────────────

async function runStabilityAnalysis(
  history: CheckinEntry[],
  moodCycleContext: string,
  goals: string[],
  pendingTasks: string[],
  setInsight: (i: AutonomousInsight | null) => void,
  homeAutonomyContext: Record<string, unknown>
) {
  try {
    const res = await api.post("/ai/suggest", {
      type: "stability-analysis",
      context: {
        history: history.slice(0, 7),
        moodCycleContext,
        goals,
        pendingTasks,
        ...homeAutonomyContext,
      },
    });

    const raw = tryParseAiSuggestion<Partial<AutonomousInsight>>(res.suggestion);
    if (!raw) return;

    const insight: AutonomousInsight = {
      stabilityScore: Number(raw.stabilityScore) || 50,
      state: raw.state ?? "stable",
      pattern: raw.pattern ?? "",
      insight: raw.insight ?? "",
      actions: Array.isArray(raw.actions) ? raw.actions.slice(0, 3) : [],
      generatedAt: new Date().toISOString(),
    };

    setInsight(insight);
  } catch (error) {
    console.warn("[AutonomousAIEngine] stability-analysis failed", error);
  }
}

// ── Phase Transition Alert (#2) ─────────────────────────────────────────────

async function runPhaseTransitionAlert(
  fromPhase: string,
  toPhase: string,
  toLabel: string,
  moodCycleContext: string,
  setAlert: (alert: PhaseTransitionAlert | null) => void
) {
  try {
    const res = await api.post("/ai/suggest", {
      type: "phase-transition",
      context: {
        fromPhase,
        toPhase,
        fromLabel: phaseLabel(fromPhase),
        toLabel,
        moodCycleContext,
      },
    });

    const raw = tryParseAiSuggestion<{ message: string; tip: string }>(res.suggestion);
    if (!raw?.message) return;

    setAlert({
      fromPhase,
      toPhase,
      fromLabel: phaseLabel(fromPhase),
      toLabel,
      message: raw.message,
      tip: raw.tip ?? "",
      severity: transitionSeverity(fromPhase, toPhase),
      generatedAt: new Date().toISOString(),
      dismissed: false,
    });
  } catch (error) {
    console.warn("[AutonomousAIEngine] phase-transition failed", error);
  }
}

// ── Profile Auto-Update (#5) ────────────────────────────────────────────────

async function runProfileUpdate(
  history: CheckinEntry[],
  setLastProfileUpdate: (isoDate: string) => void,
  goals: Array<{ title: string; completedPct: number }>
) {
  try {
    const cycleReport = computeMoodCycle(history);

    // Compute day-of-week patterns for longitudinal memory
    const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const groups: Record<number, number[]> = {};
    history.forEach(h => {
      const d = new Date(h.date + "T12:00:00").getDay();
      if (!groups[d]) groups[d] = [];
      groups[d].push(h.humor);
    });
    const dayPatterns = Object.entries(groups)
      .map(([d, vals]) => ({
        day: DAYS[Number(d)],
        avg: vals.reduce((a, b) => a + b) / vals.length,
        n: vals.length,
      }))
      .filter(d => d.n >= 2)
      .sort((a, b) => b.avg - a.avg);

    const bestDay  = dayPatterns[0];
    const worstDay = dayPatterns[dayPatterns.length - 1];

    // Phase distribution
    const lowDays  = history.filter(h => h.humor <= 4).length;
    const highDays = history.filter(h => h.humor >= 8).length;

    // Goals summary
    const completedGoals = goals.filter(g => g.completedPct >= 100).length;
    const activeGoals = goals.filter(g => g.completedPct < 100 && g.completedPct > 0).length;

    await api.post("/profile/auto-update", {
      moodCycleContext: cycleReport.aiContext,
      recentPatterns: {
        avgMood7d: cycleReport.avgMood7d,
        avgEnergy7d: cycleReport.avgEnergy7d,
        phase: cycleReport.phase,
        warningFlags: cycleReport.warningFlags,
        stabilityScore: cycleReport.stabilityScore,
        checkinCount: history.length,
        bestDay: bestDay ? `${bestDay.day} (média ${bestDay.avg.toFixed(1)}/10)` : null,
        worstDay: worstDay ? `${worstDay.day} (média ${worstDay.avg.toFixed(1)}/10)` : null,
        moodDistribution: `${highDays} dias altos, ${history.length - highDays - lowDays} estáveis, ${lowDays} baixos`,
        goalsStatus: `${completedGoals} concluídas, ${activeGoals} em andamento de ${goals.length} total`,
      },
    });
    setLastProfileUpdate(new Date().toISOString());
  } catch (error) {
    console.warn("[AutonomousAIEngine] profile-update failed", error);
  }
}

// ── Follow-up Generation (#7) ───────────────────────────────────────────────

async function runFollowUpGeneration(
  followUp: Pick<FollowUpPending, "suggestionTitle" | "suggestionCategory" | "source">,
  moodCycleContext: string,
  setPendingFollowUp: (f: any) => void
) {
  try {
    const res = await api.post("/ai/suggest", {
      type: "follow-up",
      context: {
        suggestionTitle: followUp.suggestionTitle,
        suggestionCategory: followUp.suggestionCategory,
        moodCycleContext,
      },
    });

    const raw = tryParseAiSuggestion<{ message: string }>(res.suggestion);
    if (!raw?.message) return;

    setPendingFollowUp((current: FollowUpPending | null) =>
      current ? { ...current, followUpMessage: raw.message } : null
    );
  } catch (error) {
    console.warn("[AutonomousAIEngine] follow-up generation failed", error);
  }
}

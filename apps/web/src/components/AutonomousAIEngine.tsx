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
  const count = (habit.completions || []).reduce((total, completion) => {
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
  const feedback = readHomeAutonomyFeedback().map((item) => ({
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
    blockedActionTitles: extractBlockedHomeAutonomyTitles(feedback),
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

    if (daysSince >= 2) {
      const days = Math.floor(daysSince);
      if (shouldThrottleSameNudge("checkin_missing")) return;
      const nudge: ProactiveNudge = {
        type: "checkin_missing",
        title: days >= 3 ? "Aura com saudade 💛" : "Check-in em falta",
        message: days >= 3
          ? `Faz ${days} dias sem check-in. Pequenos registros fazem toda a diferença no seu padrão.`
          : "Ontem não teve check-in. 2 minutos bastam para manter o padrão.",
        action: { label: "Fazer check-in agora", path: "/checkin" },
        priority: days >= 3 ? "high" : "medium",
        generatedAt: new Date().toISOString(),
      };
      if (isProactiveNudgeDismissedToday(nudge)) return;
      setProactiveNudge(nudge);
      return;
    }

    // Priority 2: GTD inbox overloaded (3+ itens sem clarificar)
    try {
      const gtdItems: Array<{ clarified?: boolean; archived?: boolean; capturedAt: string }> =
        JSON.parse(localStorage.getItem("gtd-inbox-v1") || "[]");
      const unclarified = gtdItems.filter(i => !i.clarified && !i.archived);
      const oldest = unclarified[unclarified.length - 1];
      const oldestAge = oldest
        ? (now - new Date(oldest.capturedAt).getTime()) / 86_400_000
        : 0;
      if (unclarified.length >= 3 && oldestAge >= 1) {
        if (shouldThrottleSameNudge("inbox_overdue")) return;
        const nudge: ProactiveNudge = {
          type: "inbox_overdue",
          title: `${unclarified.length} itens esperando clarificação`,
          message: "Seu inbox GTD está cheio. Clarificar agora libera espaço mental.",
          action: { label: "Ir para Metas & GTD", path: "/goals" },
          priority: unclarified.length >= 5 ? "high" : "medium",
          generatedAt: new Date().toISOString(),
        };
        if (isProactiveNudgeDismissedToday(nudge)) return;
        setProactiveNudge(nudge);
        return;
      }
    } catch {}

    // Priority 3: goal stagnant (goal com subtarefas mas 0% progresso há muito tempo)
    const stagnantGoal = goals.find(g => g.completedPct === 0 && g.subtasks.length > 0);
    if (stagnantGoal) {
      if (shouldThrottleSameNudge("goal_stagnant")) return;
      const nudge: ProactiveNudge = {
        type: "goal_stagnant",
        title: "Meta esperando por você",
        message: `"${stagnantGoal.title}" ainda não começou. Qual é o primeiro passo de hoje?`,
        action: { label: "Ver metas", path: "/goals" },
        priority: "medium",
        generatedAt: new Date().toISOString(),
      };
      if (isProactiveNudgeDismissedToday(nudge)) return;
      setProactiveNudge(nudge);
      return;
    }

    // Priority 4: weekly review (sexta, sábado ou domingo + itens pendentes)
    const weekday = new Date().getDay(); // 0=dom, 5=sex, 6=sab
    const isReviewDay = weekday === 0 || weekday === 5 || weekday === 6;
    const hasOpenGoals = goals.some(g => g.completedPct < 100);
    if (isReviewDay && hasOpenGoals && history.length > 0) {
      const lastReview = localStorage.getItem("aura_last_weekly_review");
      const daysSinceReview = lastReview
        ? (now - new Date(lastReview).getTime()) / 86_400_000
        : Infinity;
      if (daysSinceReview >= 5) {
        if (shouldThrottleSameNudge("weekly_review")) return;
        const nudge: ProactiveNudge = {
          type: "weekly_review",
          title: "Revisão semanal 📋",
          message: "Fim de semana é hora de revisar seus projetos e definir a próxima ação de cada meta.",
          action: { label: "Revisar metas", path: "/goals" },
          priority: "low",
          generatedAt: new Date().toISOString(),
        };
        if (isProactiveNudgeDismissedToday(nudge)) return;
        setProactiveNudge(nudge);
        return;
      }
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
      fromLabel: PHASE_LABELS[fromPhase] ?? fromPhase,
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

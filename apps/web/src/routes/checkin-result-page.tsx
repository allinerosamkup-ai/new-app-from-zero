import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
// CheckinResult Page v4 — Airia auto-responde ao check-in + fluxo "ajustar meu dia"
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { computeMoodCycle, computeStreak, getPhaseColor, PHASE_CONFIG } from '../utils/mood-cycle-engine';
import { PhaseLegendSheet } from '../components/PhaseLegendSheet';
import { useTranslation } from 'react-i18next';
import { api } from "../lib/api";
import { parseAiSuggestion, tryParseAiSuggestion } from "../lib/ai";
import { trackEvent } from "../lib/track";
import { useToast } from "../components/Toast";
import type { MoodOption } from "../features/aura/types";
import { AuraIcon } from "../components/AuraIcon";
import { getClientDayContext } from "../utils/day-context";
import { findSmartPlannerSlot } from "./planner-page.helpers";
import { RefreshCcw, X } from "lucide-react";
import "../styles/aura.css";

type ResultVariant = {
  emoji: string;
  label: string;
  description: string;
  tip: string;
  chipLabel: string;
  bg: string;
  accent: string;
};

const variants: Record<MoodOption, ResultVariant> = {
  focada: {
    emoji: "✨",
    label: "Energia Radiante",
    description: "Humor e energy em equilíbrio. Clareza mental acima da média.",
    tip: "Aproveite o pico para suas tarefas mais importantes antes das 14h.",
    chipLabel: "Focada",
    bg: "linear-gradient(180deg, #F5E9E7 0%, #FAF2F0 50%, #FAF6F2 100%)",
    accent: "var(--accent-peach)",
  },
  equilibrada: {
    emoji: "😌",
    label: "Em Equilíbrio",
    description: "Ritmo tranquilo e constante. Boa base para tarefas do dia.",
    tip: "Comece com tarefas leves e vá aumentando o ritmo gradualmente.",
    chipLabel: "Em equilíbrio",
    bg: "linear-gradient(180deg, #E6F2EC 0%, #EDF6F2 50%, #FAF6F2 100%)",
    accent: "var(--accent-sage)",
  },
  tensa: {
    emoji: "😰",
    label: "Dia Tenso",
    description: "Tensão elevada detectada. Preste atenção ao seu ritmo.",
    tip: "Faça pausas curtas e evite decisões importantes agora.",
    chipLabel: "Tensa",
    bg: "linear-gradient(180deg, #F3E8E5 0%, #FAF0EE 50%, #FAF6F2 100%)",
    accent: "var(--accent-peach)",
  },
  cansada: {
    emoji: "😴",
    label: "Dia Cansativo",
    description: "Energia baixa hoje. Respeite seu ritmo.",
    tip: "Se possível, inclua 20 min de descanso no seu planner hoje.",
    chipLabel: "Cansada",
    bg: "linear-gradient(180deg, #E6F2EC 0%, #EDF6F2 50%, #FAF6F2 100%)",
    accent: "var(--accent-sage)",
  },
  sensivel: {
    emoji: "🌸",
    label: "Dia Sensível",
    description: "Energia pede cuidado extra. Sensibilidade elevada hoje.",
    tip: "Priorize autocuidado e evite decisões importantes agora.",
    chipLabel: "Delicado",
    bg: "linear-gradient(180deg, #F3E8E5 0%, #FAF0EE 50%, #FAF6F2 100%)",
    accent: "var(--accent-peach)",
  },
  sobrecarregada: {
    emoji: "😤",
    label: "Dia Difícil",
    description: "Indicadores pedem descanso. Sobrecarga detectada.",
    tip: "Cancele o que puder e reserve espaço para recuperação.",
    chipLabel: "Intenso",
    bg: "linear-gradient(180deg, #F0E4E2 0%, #F7EEEC 50%, #FAF6F2 100%)",
    accent: "var(--accent-peach)",
  },
};

type AuraMsg = { message: string; suggestionEmoji: string; suggestion: string };

type StoredGtdInboxItem = {
  id: string;
  text: string;
  titulo: string;
  tipo: "proxima_acao";
  clarified: boolean;
  done: boolean;
  archived: boolean;
  sentToGoal: boolean;
  createdAt: string;
  source: string;
};
type AiTask = { title: string; category: string; time: string; date?: string; isNextDay?: boolean; discarded: boolean };
type AiPhase = "idle" | "loading" | "preview" | "done";

const CAT_COLOR: Record<string, string> = {
  trabalho: "var(--accent-sky)",
  saude: "var(--accent-sage)",
  autocuidado: "var(--accent-sage)",
  rotina: "var(--accent-peach)",
  social: "var(--social-color)",
};

function parseTimeToMinutes(time: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function addMinutes(time: string, minutesToAdd: number): string {
  const total = (parseTimeToMinutes(time) ?? 0) + minutesToAdd;
  const normalized = ((total % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function resolveSuggestedTaskTime(
  rawTime: unknown,
  existingTasks: Array<{ time: string; endTime?: string | null }>,
  referenceDate = new Date(),
): string {
  const fallback = findSmartPlannerSlot(existingTasks, referenceDate).time;
  if (typeof rawTime !== "string") return fallback;

  const trimmed = rawTime.trim();
  const minutes = parseTimeToMinutes(trimmed);
  if (minutes === null) return fallback;

  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  const dayEndMinutes = 18 * 60;

  if (minutes <= currentMinutes || minutes < 6 * 60 || minutes > dayEndMinutes) {
    return fallback;
  }

  return trimmed;
}

function resolveSuggestedTaskSchedule(
  rawTime: unknown,
  existingTasks: Array<{ time: string; endTime?: string | null }>,
  referenceDate = new Date(),
): { time: string; date?: string; isNextDay?: boolean } {
  const fallback = findSmartPlannerSlot(existingTasks, referenceDate);
  const resolvedTime = resolveSuggestedTaskTime(rawTime, existingTasks, referenceDate);

  if (resolvedTime === fallback.time) {
    return fallback;
  }

  return { time: resolvedTime, date: undefined, isNextDay: false };
}

function normalizeTextKey(value: unknown): string {
  return typeof value === "string"
    ? value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    : "";
}

const CHECKIN_STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "do", "da", "dos", "das", "e", "em",
  "para", "pra", "por", "com", "sem", "que", "se", "sua", "seu", "suas", "seus",
  "voce", "você", "hoje", "agora", "fazer", "abrir", "ver", "revisar", "criar",
  "marcar", "organizar", "definir", "separar", "colocar", "pegar", "min", "minutos",
]);

function tokenOverlap(a: unknown, b: unknown): number {
  const left = normalizeTextKey(a).split(" ").filter((token) => token.length >= 3 && !CHECKIN_STOPWORDS.has(token));
  const right = normalizeTextKey(b).split(" ").filter((token) => token.length >= 3 && !CHECKIN_STOPWORDS.has(token));
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const common = left.filter((token) => rightSet.has(token)).length;
  return common / Math.min(left.length, right.length);
}

function isSimilarText(a: unknown, b: unknown): boolean {
  const left = normalizeTextKey(a);
  const right = normalizeTextKey(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  return tokenOverlap(left, right) >= 0.58;
}

function normalizeDateKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, 10);
}

function isGenericCheckinSuggestion(value: string, blockedTitles: string[]): boolean {
  const text = normalizeTextKey(value);
  if (!text) return true;
  if (/\b(respirar|respire|respiracao|respiração|beba agua|beba água|va com calma|vá com calma|organizar o dia|planejar o dia)\b/.test(text)) {
    return true;
  }
  if (/\btrein(o|ar|amento)\b|\bkit(s)? do treino\b/.test(text)) {
    return blockedTitles.some((title) => /\btrein(o|ar|amento)\b/.test(normalizeTextKey(title)));
  }
  return false;
}

function filterSuggestionsAgainstCompleted(items: string[], blockedTitles: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((item) => {
      const key = normalizeTextKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      if (isGenericCheckinSuggestion(item, blockedTitles)) return false;
      return !blockedTitles.some((title) => isSimilarText(item, title));
    });
}

export function CheckinResultPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  console.log('[DEBUG] location.state in checkin-result-page:', location.state);
  const checkinAI = (location.state as {
    stateLabel?: string | null;
    analysis?: string | null;
    recommendations?: string[];
    suggestedIntensity?: string | null;
    riskSafety?: {
      riskLevel?: string;
      signals?: string[];
      route?: string;
      message?: string;
    };
  } | null) ?? null;
  const { state, addTask, prepareJournalFromMood, refreshData, hydrated } = useAuraStore();
  const { showError, showSuccess } = useToast();

  const v = variants[state.mood] ?? variants.equilibrada;
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);
  const dayContext = useMemo(() => getClientDayContext(), []);
  const [phaseLegendOpen, setPhaseLegendOpen] = useState(false);

  // Airia auto-response ao check-in
  const [auraMsg, setAuraMsg] = useState<AuraMsg | null>(null);
  const [auraMsgLoading, setAuraMsgLoading] = useState(!checkinAI?.analysis);
  const auraMsgRan = useRef(false);
  const autoTasksRan = useRef(false);
  const viewedTrackedRef = useRef(false);

  const recentHistory = useMemo(
    () => (state.checkinHistory || []).slice(0, 7).map(h => ({ date: h.date, humor: h.humor, energia: h.energia, sono: h.sono })),
    [state.checkinHistory]
  );
  const streak = useMemo(() => computeStreak(state.checkinHistory || []), [state.checkinHistory]);
  const goalTitles = useMemo(
    () => (state.goals || []).filter(g => g.completedPct < 100).map(g => g.title),
    [state.goals]
  );
  const pendingTaskTitles = useMemo(
    () => (state.tasks || []).filter((task) => !task.done).slice(0, 8).map((task) => task.title),
    [state.tasks],
  );
  const completedTaskTitles = useMemo(
    () => (state.tasks || []).filter((task) => task.done).map((task) => task.title).filter(Boolean),
    [state.tasks],
  );
  const completedHabitTitles = useMemo(
    () => (state.habits || [])
      .filter((habit) => (habit.completions || []).some((completion) => normalizeDateKey(completion.date) === dayContext.localDate))
      .map((habit) => habit.title)
      .filter(Boolean),
    [dayContext.localDate, state.habits],
  );
  const completedGoalTitles = useMemo(
    () => (state.goals || [])
      .filter((goal) => goal.completedPct >= 100)
      .map((goal) => goal.title)
      .filter(Boolean),
    [state.goals],
  );
  const completedSubgoalTitles = useMemo(
    () => (state.goals || [])
      .flatMap((goal) => goal.subtasks || [])
      .filter((subtask) => subtask.done)
      .map((subtask) => subtask.title)
      .filter(Boolean),
    [state.goals],
  );
  // Fatores e emoções do check-in mais recente — alimentam a IA com contexto real
  const todayFactors = useMemo(() => (state.checkinHistory || [])[0]?.factors ?? [], [state.checkinHistory]);
  const todayEmotions = useMemo(() => (state.checkinHistory || [])[0]?.emotions ?? [], [state.checkinHistory]);
  const todayNote = useMemo(() => (state.checkinHistory || [])[0]?.note ?? "", [state.checkinHistory]);
  const previousCheckinSuggestion = useMemo(
    () => localStorage.getItem("aura_last_checkin_suggestion") ?? "",
    [],
  );
  const blockedTaskTitles = useMemo(() => {
    const existingPlanner = (state.tasks || []).map((task) => task.title.trim()).filter(Boolean);
    const lastAiTasks = (localStorage.getItem("aura_last_day_tasks") ?? "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set([
      ...existingPlanner,
      ...completedHabitTitles,
      ...completedGoalTitles,
      ...completedSubgoalTitles,
      ...lastAiTasks,
    ]));
  }, [completedGoalTitles, completedHabitTitles, completedSubgoalTitles, state.tasks]);
  const visibleCheckinRecommendations = useMemo(
    () => filterSuggestionsAgainstCompleted(checkinAI?.recommendations ?? [], blockedTaskTitles),
    [blockedTaskTitles, checkinAI?.recommendations],
  );

  useEffect(() => {
    if (auraMsgRan.current) return;
    auraMsgRan.current = true;

    // DEBUG: Log router state
    console.log('[DEBUG] checkin-result-page received checkinAI from router state:', checkinAI);

    // Se o backend já retornou análise via router state, usar diretamente
    if (checkinAI?.analysis) {
      console.log('[DEBUG] Using backend analysis directly');
      setAuraMsgLoading(false);
      return;
    }
    console.log('[DEBUG] checkinAI?.analysis is falsy, falling back to generic /ai/suggest call');
    api.post("/ai/suggest", {
      type: "checkin-response",
      context: {
        mood: state.mood,
        moodLabel: v.label,
        moodCycleContext: cycleReport.aiContext,
        checkinHistory: recentHistory,
        nota: todayNote || state.journal,
        streak,
        hour: dayContext.hour,
        minute: dayContext.minute,
        partOfDay: dayContext.partOfDay,
        weekday: dayContext.weekday,
        localDate: dayContext.localDate,
        previousSuggestion: previousCheckinSuggestion,
      },
    }).then((res: any) => {
      try {
        const parsed = parseAiSuggestion<AuraMsg>(res.suggestion);
        if (parsed?.message) {
          setAuraMsg(parsed);
          if (parsed.suggestion?.trim()) {
            localStorage.setItem("aura_last_checkin_suggestion", parsed.suggestion.trim());
          }
        }
      } catch { /* mantém null */ }
    }).catch((error) => {
      console.warn("Aura check-in auto-response failed:", error);
    }).finally(() => setAuraMsgLoading(false));
  }, []);

  useEffect(() => {
    if (viewedTrackedRef.current) return;
    viewedTrackedRef.current = true;
    trackEvent("checkin_result_viewed", {
      has_router_state: Boolean(checkinAI),
      has_analysis: Boolean(checkinAI?.analysis),
      recommendations_count: checkinAI?.recommendations?.length ?? 0,
      mood: state.mood,
    });
  }, []);

  const [phase, setPhase] = useState<AiPhase>("idle");
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [savingTasks, setSavingTasks] = useState(false);
  const [syncingContext, setSyncingContext] = useState(true);

  useEffect(() => {
    let mounted = true;
    setSyncingContext(true);
    refreshData()
      .catch(() => null)
      .finally(() => {
        if (mounted) setSyncingContext(false);
      });
    return () => {
      mounted = false;
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated || syncingContext) return;
    if (autoTasksRan.current || auraMsgLoading || phase !== "idle") return;
    autoTasksRan.current = true;
    void fetchDayTasks();
  }, [auraMsgLoading, phase, hydrated, syncingContext]);

  function normalizeTaskSuggestions(payload: unknown): AiTask[] {
    if (!Array.isArray(payload)) return [];
    const seen = new Set<string>();
    const normalized: AiTask[] = [];
    const virtualTasks = [...(state.tasks || [])];
    const now = new Date();
    for (const raw of payload) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as { title?: unknown; category?: unknown; time?: unknown };
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (isGenericCheckinSuggestion(title, blockedTaskTitles)) continue;
      if (blockedTaskTitles.some((blockedTitle) => isSimilarText(title, blockedTitle))) continue;
      const category = typeof item.category === "string" ? item.category.trim().toLowerCase() : "rotina";
      const schedule = resolveSuggestedTaskSchedule(item.time, virtualTasks, now);
      normalized.push({ title, category, time: schedule.time, date: schedule.date, isNextDay: schedule.isNextDay, discarded: false });
      virtualTasks.push({ time: schedule.time, endTime: addMinutes(schedule.time, 30) });
      if (normalized.length >= 3) break;
    }
    return normalized;
  }

  async function fetchDayTasks() {
    setPhase("loading");
    try {
      const res = await api.post("/ai/suggest", {
        type: "day-tasks",
        context: {
          mood: state.mood,
          moodLabel: v.label,
          moodCycleContext: cycleReport.aiContext,
          checkinHistory: recentHistory,
          goals: goalTitles,
          pendingTasks: pendingTaskTitles,
          nota: state.journal,
          hour: dayContext.hour,
          minute: dayContext.minute,
          partOfDay: dayContext.partOfDay,
          weekday: dayContext.weekday,
          localDate: dayContext.localDate,
          factors: todayFactors,
          emotions: todayEmotions,
          avoidTaskTitles: blockedTaskTitles,
          completedTaskTitles,
          completedHabitTitles,
          completedGoalTitles,
          completedSubgoalTitles,
        },
      });
      const parsed = tryParseAiSuggestion<unknown>(res.suggestion);
      const normalized = normalizeTaskSuggestions(parsed);
      if (normalized.length === 0) {
        throw new Error("A IA não retornou tarefas válidas agora.");
      }
      setTasks(normalized);
      localStorage.setItem("aura_last_day_tasks", normalized.map((task) => task.title).join("|"));
      setPhase("preview");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel gerar ajustes para o dia.");
      setPhase("idle");
    }
  }

  function handleAdjustDayClick() {
    trackEvent("adjust_day_clicked", {
      has_router_state: Boolean(checkinAI),
      has_analysis: Boolean(checkinAI?.analysis),
    });
    void fetchDayTasks();
  }

  async function regenTask(idx: number) {
    setRegenIdx(idx);
    try {
      const res = await api.post("/ai/suggest", {
        type: "day-tasks",
        context: {
          mood: state.mood,
          moodLabel: v.label,
          moodCycleContext: cycleReport.aiContext,
          checkinHistory: recentHistory,
          goals: goalTitles,
          pendingTasks: pendingTaskTitles,
          nota: state.journal,
          hour: dayContext.hour,
          minute: dayContext.minute,
          partOfDay: dayContext.partOfDay,
          weekday: dayContext.weekday,
          localDate: dayContext.localDate,
          factors: todayFactors,
          emotions: todayEmotions,
          avoidTaskTitles: blockedTaskTitles,
          completedTaskTitles,
          completedHabitTitles,
          completedGoalTitles,
          completedSubgoalTitles,
        },
      });
      const parsed = tryParseAiSuggestion<unknown>(res.suggestion);
      const normalized = normalizeTaskSuggestions(parsed);
      if (normalized[0]) {
        setTasks((prev) =>
          prev.map((t, i) => (i === idx ? normalized[0] : t))
        );
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel regenerar a sugestao.");
    } finally {
      setRegenIdx(null);
    }
  }

  function toggleDiscard(idx: number) {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, discarded: !t.discarded } : t))
    );
  }

  async function confirmTasks() {
    const accepted = tasks.filter((t) => !t.discarded);
    if (accepted.length === 0 || savingTasks) return;

    setSavingTasks(true);
    let savedCount = 0;
    let nextDayCount = 0;
    let lastError: unknown = null;

    // Snapshot das tarefas atuais para calcular slots sem conflito entre si
    let currentTasks = [...(state.tasks || [])];

    for (const task of accepted) {
      try {
        const now = new Date();
        const taskTimeMins = task.time ? (parseInt(task.time.split(":")[0]) * 60 + parseInt(task.time.split(":")[1])) : -1;
        const nowMins = now.getHours() * 60 + now.getMinutes();

        // Usa o horário sugerido pela IA se for futuro; caso contrário, acha slot livre
        const useAiTime = taskTimeMins > nowMins;
        const slot = task.isNextDay
          ? { time: task.time, date: task.date, isNextDay: true }
          : useAiTime
          ? { time: task.time, date: task.date, isNextDay: false }
          : findSmartPlannerSlot(currentTasks, now);

        const saved = await addTask(task.title, slot.time, task.category, {
          forceSave: true,
          ...(slot.date ? { date: slot.date } : {}),
        });

        if (saved) {
          savedCount += 1;
          if (slot.isNextDay) nextDayCount += 1;
          // Adicionar ao snapshot local para evitar conflito com a próxima tarefa
          currentTasks = [...currentTasks, saved as any];
        } else {
          lastError = new Error("A tarefa nao foi aceita pelo planner.");
        }
      } catch (error) {
        lastError = error;
      }
    }

    setSavingTasks(false);

    if (savedCount > 0) {
      setPhase("done");
      trackEvent("tasks_added_to_planner", {
        source: "checkin_result",
        accepted_count: accepted.length,
        saved_count: savedCount,
        next_day_count: nextDayCount,
      });
      const baseMsg = savedCount === accepted.length
        ? "Sugestoes adicionadas ao planner."
        : `${savedCount} sugest${savedCount > 1 ? "oes foram" : "ao foi"} adicionada${savedCount > 1 ? "s" : ""} ao planner.`;
      const nextDayMsg = nextDayCount > 0
        ? ` (${nextDayCount} para amanhã — hoje já está cheio)`
        : "";
      showSuccess(baseMsg + nextDayMsg);
    }

    if (savedCount < accepted.length) {
      showError(
        lastError instanceof Error
          ? lastError.message
          : "Algumas sugestoes nao puderam ser salvas no planner.",
      );
    }
  }

  const acceptedCount = tasks.filter((t) => !t.discarded).length;
  const isMenuthe = v.accent === "var(--accent-sage)";
  const hasAgendaAnchor = pendingTaskTitles.length > 0;
  const hasSoftAnchor = goalTitles.length > 0 || (state.habits || []).some((habit) => !(habit.completions || []).some((completion) => normalizeDateKey(completion.date) === dayContext.localDate));
  const adaptivePlannerLabel = hasAgendaAnchor
    ? "Ver ajustes sugeridos"
    : hasSoftAnchor
      ? "Montar um bloco possível"
      : "Abrir Planner";

  async function finalizeAndGo(path: "/planner" | "/home" | "/journal", navState?: Record<string, unknown>) {
    try {
      await refreshData();
    } catch {
      // mantém navegação mesmo com erro de sync
    }
    navigate(path, { replace: true, state: navState });
  }

  function sendSuggestionToActions(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;

    try {
      const raw = JSON.parse(localStorage.getItem("gtd-inbox-v1") || "[]");
      const list: StoredGtdInboxItem[] = Array.isArray(raw) ? raw : [];
      const key = cleanText.toLowerCase().replace(/\s+/g, " ");
      const alreadyExists = list.some((item) => {
        const itemText = String(item.titulo || item.text || "").trim().toLowerCase().replace(/\s+/g, " ");
        return itemText === key && !item.archived && !item.done;
      });

      if (!alreadyExists) {
        const item: StoredGtdInboxItem = {
          id: `checkin-${Date.now()}`,
          text: cleanText,
          titulo: cleanText,
          tipo: "proxima_acao",
          clarified: true,
          done: false,
          archived: false,
          sentToGoal: false,
          createdAt: new Date().toISOString(),
          source: "checkin-result",
        };
        localStorage.setItem("gtd-inbox-v1", JSON.stringify([item, ...list]));
        showSuccess("Sugestão enviada para Ações.");
        return;
      }

      showSuccess("Essa sugestão já está em Ações.");
    } catch {
      showError("Não foi possível enviar para Ações agora.");
    }
  }

  function buildCheckinJournalDraft() {
    return todayNote.trim();
  }

  return (
    <div className="result-shell" style={{ background: v.bg }}>
      <div className="screen-content result-screen">

        {/* Ícone checkmark */}
        <div
          className="result-hero-icon"
          style={{ background: isMenuthe ? "rgba(180,185,169,.18)" : "rgba(197,165,147,.15)" }}
        >
          {v.emoji}
        </div>

        {/* Título */}
        <div className="result-header">
          <p className="result-header-kicker" style={{ color: v.accent }}>
            CHECK-IN REGISTRADO
          </p>
          <h1 className="result-header-title">{v.label}</h1>
          <p className="result-header-copy">{v.description}</p>
        </div>

        {/* HERO — Fase de humor e energia */}
        {cycleReport.phase !== "insufficient_data" ? (() => {
          const phaseColor = getPhaseColor(cycleReport.phase);
          const phaseLabel = t(`phases.${cycleReport.phase}.label`, cycleReport.phaseLabel);
          const phaseDescription = t(`phases.${cycleReport.phase}.description`, cycleReport.phaseDescription);
          const phaseTip = t(`phases.${cycleReport.phase}.tip`, cycleReport.phaseTip);
          return (
            <div
              style={{
                marginBottom: 18,
                padding: "20px 18px 18px",
                borderRadius: 22,
                background: `${phaseColor}15`,
                border: `1.5px solid ${phaseColor}55`,
                boxShadow: `0 6px 20px ${phaseColor}20`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <span style={{ fontSize: 44, lineHeight: 1 }} aria-hidden>{cycleReport.phaseEmoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: phaseColor }}>
                    {t("phases.yourPhaseKicker", "Sua fase do ciclo")}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 800, color: "#2A2A2A", fontFamily: "var(--font-sans, sans-serif)", lineHeight: 1.1, letterSpacing: 0 }}>
                    {phaseLabel}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: "#6B5E5A" }}>
                    {cycleReport.daysInPhase === 1 ? "1º dia nesta fase" : `${cycleReport.daysInPhase} dias nesta fase`}
                  </p>
                </div>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "#3a2f2c" }}>
                {phaseDescription}
              </p>
              <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: phaseColor, fontStyle: "italic", fontWeight: 600 }}>
                💡 {phaseTip}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.45, color: "#6B5E5A", fontWeight: 600 }}>
                Base pessoal: {cycleReport.personalTrendLabel} · baseline {cycleReport.baselineComposite.toFixed(1)}/10 · EWMA {cycleReport.currentComposite.toFixed(1)}/10
              </p>
              <button
                type="button"
                onClick={() => setPhaseLegendOpen(true)}
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: `${phaseColor}25`,
                  border: `1px solid ${phaseColor}55`,
                  color: phaseColor,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-sans, sans-serif)",
                }}
              >
                {t("phases.viewAll", "ver as 8 fases")}
              </button>
            </div>
          );
        })() : (
          <div
            style={{
              marginBottom: 18,
              padding: "16px 16px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.55)",
              border: "1px dashed rgba(74,59,55,0.18)",
              fontFamily: "var(--font-sans, sans-serif)",
            }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-3)" }}>
              {t("phases.yourPhaseKicker", "Sua fase do ciclo")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-2)" }}>
              {t("phases.unlockHint", "Continue fazendo check-ins por alguns dias para destravar a leitura da sua fase.")}
            </p>
          </div>
        )}

        {/* Card Airia diz — resposta personalizada ao check-in */}
        <div className="aura-card" style={{ marginBottom: 16, borderLeft: `3px solid ${v.accent}`, background: "rgba(255,253,250,.9)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: v.accent, margin: 0 }}>
              Airia diz
            </p>
            {!auraMsgLoading && (checkinAI?.analysis || auraMsg) && (
              <span style={{ fontSize: 9, background: isMenuthe ? "rgba(180,185,169,.15)" : "var(--accent-peach-a3)", color: v.accent, borderRadius: 999, padding: "2px 6px", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                <AuraIcon size={8} /> IA
              </span>
            )}
            {checkinAI?.stateLabel && !auraMsgLoading && (
              <span style={{ fontSize: 9, background: "rgba(0,0,0,.05)", color: "var(--text-2)", borderRadius: 999, padding: "2px 7px", fontWeight: 600 }}>
                {checkinAI.stateLabel}
              </span>
            )}
            {checkinAI?.suggestedIntensity && !auraMsgLoading && (
              <span style={{
                fontSize: 9, borderRadius: 999, padding: "2px 7px", fontWeight: 700,
                background: checkinAI.suggestedIntensity === "P" ? "rgba(99,152,169,.15)" : checkinAI.suggestedIntensity === "M" ? "rgba(150,199,179,.15)" : "rgba(215,137,127,.15)",
                color: checkinAI.suggestedIntensity === "P" ? "var(--accent-sky)" : checkinAI.suggestedIntensity === "M" ? "var(--accent-sage)" : "var(--accent-peach)",
              }}>
                {checkinAI.suggestedIntensity === "P" ? "Ritmo intenso" : checkinAI.suggestedIntensity === "M" ? "Ritmo médio" : "Ritmo leve"}
              </span>
            )}
            {checkinAI?.riskSafety?.riskLevel && checkinAI.riskSafety.riskLevel !== "none" && !auraMsgLoading && (
              <span style={{
                fontSize: 9,
                borderRadius: 999,
                padding: "2px 7px",
                fontWeight: 800,
                background: "rgba(161,125,108,.12)",
                color: "#8A5D4B",
              }}>
                Segurança: {checkinAI.riskSafety.route === "crisis_protocol" ? "crise" : "atenção"}
              </span>
            )}
            {auraMsgLoading && (
              <span style={{ fontSize: 9, color: "var(--text-3)", fontStyle: "italic" }}>gerando...</span>
            )}
          </div>
          {auraMsgLoading ? (
            <>
              <div style={{ height: 9, width: "92%", background: "rgba(0,0,0,.05)", borderRadius: 5, marginBottom: 5 }} />
              <div style={{ height: 9, width: "75%", background: "rgba(0,0,0,.05)", borderRadius: 5, marginBottom: 5 }} />
              <div style={{ height: 9, width: "60%", background: "rgba(0,0,0,.05)", borderRadius: 5 }} />
            </>
          ) : checkinAI?.analysis ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65, fontStyle: "italic", marginBottom: visibleCheckinRecommendations.length ? 10 : 0 }}>
                {checkinAI.analysis}
              </p>
              {visibleCheckinRecommendations.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {visibleCheckinRecommendations.map((rec, i) => (
                    <div
                      key={i}
                      onClick={() => sendSuggestionToActions(rec)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 7,
                        padding: "7px 10px",
                        borderRadius: 8,
                        background: isMenuthe ? "rgba(180,185,169,.08)" : "var(--accent-peach-a3)",
                        border: `1px solid ${v.accent}25`,
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 11, color: v.accent, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
                      <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.5, flex: 1 }}>{rec}</p>
                      <span style={{ fontSize: 9, color: v.accent, fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap", marginTop: 1 }}>
                        Ações
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {checkinAI.riskSafety?.route === "human_support" || checkinAI.riskSafety?.route === "crisis_protocol" ? (
                <div style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(161,125,108,.08)",
                  border: "1px solid rgba(161,125,108,.22)",
                }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#6F4D40", lineHeight: 1.55, fontWeight: 700 }}>
                    A Airia não substitui ajuda humana. Se existir risco imediato, procure emergência local ou alguém de confiança agora.
                  </p>
                </div>
              ) : null}
            </>
          ) : auraMsg ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65, fontStyle: "italic", marginBottom: 10 }}>
                {auraMsg.message}
              </p>
              <div
                onClick={() => sendSuggestionToActions(auraMsg.suggestion)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 9,
                  background: isMenuthe ? "rgba(180,185,169,.08)" : "var(--accent-peach-a3)",
                  border: `1px solid ${v.accent}30`,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{auraMsg.suggestionEmoji}</span>
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.5, flex: 1 }}>{auraMsg.suggestion}</p>
                <span style={{ fontSize: 9, color: v.accent, fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  Ações
                </span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, fontStyle: "italic" }}>
              {v.tip}
            </p>
          )}
        </div>

        {/* Chip de estado */}
        <div className="result-chip-row">
          <span
            className="result-state-chip"
            style={{
              background: isMenuthe ? "rgba(180,185,169,.15)" : "rgba(197,165,147,.13)",
              color: v.accent,
              border: `1.5px solid ${isMenuthe ? "rgba(180,185,169,.3)" : "rgba(197,165,147,.3)"}`,
            }}
          >
            {v.chipLabel}
          </span>
        </div>

        <div
          style={{
            background: "rgba(255,253,250,.92)",
            borderRadius: 14,
            border: `1.5px solid ${v.accent}28`,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: v.accent }}>
            Agenda adaptativa
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
            A Airia pode usar esse check-in, a hora atual e seus blocos do dia para sugerir o que mover, reduzir, pausar ou encaixar.
          </p>
          <AuraButtonV2
            className="btn btn-ghost btn-full"
            onClick={() => { void finalizeAndGo("/planner", { openAgendaAdaptation: true }); }}
          >
            {adaptivePlannerLabel}
          </AuraButtonV2>
        </div>

        {/* ─── BLOCO IA ─── */}
        {phase === "idle" && !syncingContext && (
          <AuraButtonV2
            useAuraIcon
            className={`btn btn-full ${isMenuthe ? "btn-sage" : "btn-primary"}`}
            onClick={handleAdjustDayClick}
            style={{ marginBottom: 10 }}
          >
            Ajustar meu dia
          </AuraButtonV2>
        )}

        {syncingContext && (
          <div className="aura-panel-soft" style={{
            background: "rgba(255,253,250,.9)", borderRadius: 12, padding: 16,
            marginBottom: 10, textAlign: "center", border: "1.5px solid var(--warm-border)",
          }}>
            <div className="aura-inline-spinner" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 12, color: "var(--text-2)", fontStyle: "italic" }}>
              Sincronizando metas e compromissos atuais...
            </p>
          </div>
        )}

        {phase === "loading" && (
          <div className="aura-panel-soft" style={{
            background: "rgba(255,253,250,.9)", borderRadius: 12, padding: 20,
            marginBottom: 10, textAlign: "center", border: "1.5px solid var(--warm-border)",
          }}>
            <div className="aura-inline-spinner" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13, color: "var(--text-2)", fontStyle: "italic" }}>
              Lendo seu estado e montando sugestões personalizadas...
            </p>
          </div>
        )}

        {(phase === "preview" || phase === "done") && (
          <div style={{
            background: "rgba(255,253,250,.95)", borderRadius: 14, padding: 16,
            marginBottom: 10, border: `1.5px solid ${isMenuthe ? "rgba(180,185,169,.3)" : "rgba(197,165,147,.3)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: v.accent }}>
                Tarefas sugeridas
              </p>
              {phase === "preview" && (
                <p style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {acceptedCount}/{tasks.length} selecionadas
                </p>
              )}
              {phase === "done" && (
                <span style={{ fontSize: 11, color: "var(--accent-sage)", fontWeight: 700 }}>✓ Salvo no Planner</span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: phase === "preview" ? 14 : 0 }}>
              {tasks.map((task, idx) => {
                const cor = CAT_COLOR[task.category] ?? "var(--accent-peach)";
                return (
                  <div key={idx} className="result-task-card" style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: task.discarded ? "rgba(0,0,0,.04)" : "var(--warm-bg)",
                    border: `1.5px solid ${task.discarded ? "var(--warm-border)" : cor + "40"}`,
                    opacity: task.discarded ? 0.5 : 1,
                    transition: "all 150ms",
                  }}>
                    {/* dot cor */}
                    <span className="result-task-dot" style={{ background: cor }} />

                    {/* info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, color: "var(--text-1)",
                        textDecoration: task.discarded ? "line-through" : "none",
                        wordBreak: "break-word",
                      }}>
                        {task.title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {task.isNextDay ? `amanhã ${task.time}` : task.time} · {task.category}
                      </p>
                    </div>

                    {/* ações */}
                    {phase === "preview" && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {/* regenerar */}
                        <button
                          type="button"
                          onClick={() => regenTask(idx)}
                          disabled={regenIdx === idx}
                          title="Gerar outra sugestão"
                          style={{
                            width: 32, height: 32, borderRadius: 10, border: "1.5px solid var(--warm-border-2)",
                            background: "transparent", cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            opacity: regenIdx === idx ? 0.4 : 1,
                          }}
                        >
                          {regenIdx === idx ? (
                            <RefreshCcw size={14} className="animate-spin" />
                          ) : (
                            <RefreshCcw size={14} color="var(--text-3)" />
                          )}
                        </button>
                        {/* aceitar / descartar */}
                        <button
                          type="button"
                          onClick={() => toggleDiscard(idx)}
                          title={task.discarded ? "Incluir" : "Descartar"}
                          style={{
                            width: 32, height: 32, borderRadius: 10,
                            border: `1.5px solid ${task.discarded ? "var(--accent-sage)" : "var(--accent-peach)40"}`,
                            background: task.discarded ? "var(--accent-sage)10" : "var(--accent-peach)08",
                            cursor: "pointer", display: "flex", alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {task.discarded ? (
                            <RefreshCcw size={14} color="var(--accent-sage)" />
                          ) : (
                            <X size={14} color="var(--accent-peach)" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {phase === "preview" && (
              <div style={{ display: "flex", gap: 8 }}>
                <AuraButtonV2
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => setPhase("idle")}
                >
                  Cancelar
                </AuraButtonV2>
                <AuraButtonV2
                  className={`btn ${isMenuthe ? "btn-sage" : "btn-primary"}`}
                  style={{ flex: 2 }}
                  onClick={confirmTasks}
                  disabled={acceptedCount === 0 || savingTasks}
                >
                  {savingTasks
                    ? "Salvando..."
                    : `Adicionar ${acceptedCount > 0 ? `${acceptedCount} tarefa${acceptedCount > 1 ? "s" : ""}` : ""} ao Planner`}
                </AuraButtonV2>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            background: "rgba(255,253,250,.9)",
            borderRadius: 14,
            border: `1.5px solid ${v.accent}28`,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: v.accent }}>
            Depois do check-in
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
            Se quiser descarregar melhor o que apareceu agora, leve esse estado para o diário e deixe a Airia guardar o resumo da sessão.
          </p>
          <AuraButtonV2
            className="btn btn-ghost btn-full"
            onClick={() => {
              prepareJournalFromMood();
              void finalizeAndGo("/journal", {
                initialDraft: buildCheckinJournalDraft(),
                contextLabel: "check-in",
              });
            }}
          >
            Abrir meu diário
          </AuraButtonV2>
        </div>

        {/* Botões de navegação */}
        <div className="result-nav-stack" style={{ marginTop: phase === "idle" ? 0 : 4 }}>
          {phase !== "idle" && (
            <AuraButtonV2
              className="btn btn-ghost btn-full"
              onClick={() => { void finalizeAndGo("/planner"); }}
            >
              Ver meu Planner
            </AuraButtonV2>
          )}
          <AuraButtonV2
            className={`btn btn-full ${isMenuthe ? "btn-sage" : "btn-primary"}`}
            onClick={() => { void finalizeAndGo("/home"); }}
          >
            Ir para o inicio
          </AuraButtonV2>
        </div>

      </div>
      <PhaseLegendSheet
        open={phaseLegendOpen}
        onClose={() => setPhaseLegendOpen(false)}
        currentPhase={cycleReport.phase}
      />
    </div>
  );
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialAuraState, labelMood } from "./data";
import type { AuraState, AutonomousInsight, CheckinEntry, FollowUpPending, MoodOption, PhaseTransitionAlert, ProactiveNudge } from "./types";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { getLocalDateKey, normalizeDateKey } from "../../utils/day-context";

function normalizeTaskCategory(category?: string): 'trabalho' | 'pessoal' | 'autocuidado' | 'social' | 'outro' {
  const value = (category ?? 'pessoal').trim().toLowerCase();

  if (value === 'trabalho') return 'trabalho';
  if (value === 'social') return 'social';
  if (value === 'autocuidado' || value === 'saude' || value === 'saúde') return 'autocuidado';
  if (value === 'geral' || value === 'rotina' || value === 'pessoal') return 'pessoal';
  return 'outro';
}

function deriveCheckinSlotToken(recordedAt: Date): string {
  const hour = recordedAt.getHours();
  const minute = recordedAt.getMinutes();
  const second = recordedAt.getSeconds();
  const baseSlot = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'midday' : 'evening';
  return `${baseSlot}-${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}${String(second).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutesToAdd: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const nextMinutes = (normalized % 60).toString().padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

function toScore(value: unknown, fallback = 5): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function diffMinutes(startTime: string, endTime?: string | null): number {
  if (!endTime) {
    return 30;
  }

  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;
  const delta = endTotal - startTotal;

  return delta > 0 ? delta : 30;
}

type AuraStoreContextValue = {
  state: AuraState;
  hydrated: boolean;
  loading: boolean;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
  setMood: (value: MoodOption) => void;
  setJournal: (value: string) => void;
  toggleTask: (id: string | number) => Promise<void>;
  toggleQuietMode: () => void;
  toggleCheckinReminder: () => void;
  toggleTheme: () => void;
  nextOnboardingStep: () => void;
  prevOnboardingStep: () => void;
  prepareJournalFromMood: () => void;
  addCheckin: (entry: Omit<CheckinEntry, "date">) => Promise<void>;
  addGoal: (title: string) => Promise<void>;
  addSubGoals: (goalId: string | number, titles: string[]) => Promise<void>;
  setGoalStatus: (goalId: string | number, progress: number) => Promise<void>;
  toggleSubGoal: (goalId: string | number, subGoalId: string | number) => Promise<void>;
  removeGoal: (goalId: string | number) => Promise<void>;
  addTask: (
    title: string,
    time: string,
    category?: string,
    options?: { date?: string; forceSave?: boolean }
  ) => Promise<{ id: string | number; title: string; time: string; endTime: string; done: boolean; category?: string; intensity?: string } | null>;
  updateTask: (id: string | number, updates: { title?: string; time?: string; category?: string }) => Promise<void>;
  removeTask: (id: string | number) => Promise<void>;
  reorderTasks: (fromIdx: number, toIdx: number) => void;
  toggleHabit: (habitId: string) => Promise<void>;
  archiveHabit: (habitId: string) => Promise<void>;
  addHabit: (habit: { title: string; category: string; frequency: string; icon?: string; timeOfDay?: string; description?: string; durationMinutes?: number; reminderEnabled?: boolean; reminderTime?: string }) => Promise<void>;
  setAutonomousInsight: (insight: AutonomousInsight | null) => void;
  setPhaseTransitionAlert: (alert: PhaseTransitionAlert | null) => void;
  dismissPhaseTransitionAlert: () => void;
  setPendingFollowUp: (followUp: FollowUpPending | null) => void;
  resolveFollowUp: (response: "done" | "skip") => void;
  setLastProfileUpdate: (isoDate: string) => void;
  setProactiveNudge: (nudge: ProactiveNudge | null) => void;
  refreshData: () => Promise<void>;
};

const AuraStoreContext = createContext<AuraStoreContextValue | null>(null);

export function AuraStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuraState>(initialAuraState);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refreshData = async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const run = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setHydrated(true);
      return;
    }
    setLoading(true);
    try {
      const today = getLocalDateKey();
      const [checkinsRaw, timelineRaw, objectivesRaw, preferencesRaw, habitsRaw] = await Promise.all([
        api.get('/checkins?days=45').catch(e => { console.error(e); return null; }),
        api.get(`/timeline/${today}`).catch(e => { console.error(e); return null; }),
        api.get('/objectives').catch(e => { console.error(e); return null; }),
        api.get('/preferences').catch(e => { console.error(e); return null; }),
        api.get('/habits').catch(e => { console.error(e); return null; })
      ]);

      const checkins = Array.isArray(checkinsRaw) ? checkinsRaw : null;
      const mappedCheckins = checkins
        ? checkins.map((c: any) => ({
          date: normalizeDateKey(c.localDate ?? c.recordedAt ?? c.date),
          recordedAt: c.recordedAt,
          checkinSlot: c.checkinSlot,
          humor: toScore(c.moodScore),
          energia: toScore(c.energyScore),
          emotion: c.stateLabelType || 'calm',
          emotions: Array.isArray(c.emotions)
            ? c.emotions
            : (Array.isArray(c.aiState?.emotions) ? c.aiState.emotions : undefined),
          fisico: c.physicalScore != null ? toScore(c.physicalScore) : undefined,
          social: c.socialScore != null ? toScore(c.socialScore) : undefined,
          sono: c.sleepScore != null ? toScore(c.sleepScore) : undefined,
          factors: Array.isArray(c.factors) && c.factors.length > 0 ? c.factors : undefined,
          note: typeof c.note === 'string' ? c.note : undefined,
          })).filter((entry) => Boolean(entry.date))
        : null;
      const timeline = Array.isArray(timelineRaw) ? timelineRaw : null;
      const objectives = Array.isArray(objectivesRaw) ? objectivesRaw : null;
      const preferences = (preferencesRaw && typeof preferencesRaw === 'object') ? preferencesRaw : null;
      const habits = Array.isArray(habitsRaw) ? habitsRaw : null;

      setState(current => ({
        ...current,
        name: (preferences as any)?.fullName ?? session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? current.name,
        checkinHistory: mappedCheckins && mappedCheckins.length > 0
          ? mappedCheckins
          : current.checkinHistory,
        tasks: timeline
          ? timeline.map((t: any) => ({
          id: t.id,
          title: t.title,
          time: t.startTime,
          endTime: t.endTime,
          done: t.status === 'completed',
          category: t.category,
          intensity: t.intensity,
          }))
          : current.tasks,
        goals: objectives
          ? objectives.map((o: any) => ({
          id: o.id,
          title: o.title,
          progress: o.description || 'Em andamento',
          completedPct: o.progress,
          subtasks: Array.isArray(o.subgoals) ? o.subgoals.map((s: any) => ({
            id: s.id,
            title: s.title,
            done: s.done
          })) : []
          }))
          : current.goals,
        habits: habits
          ? habits.map((h: any) => ({
          id: h.id,
          title: h.title,
          description: h.description,
          category: h.category,
          icon: h.icon,
          frequency: h.frequency,
          targetDays: h.targetDays,
          streakCount: h.streakCount,
          bestStreak: h.bestStreak,
          totalCompletions: h.totalCompletions,
          completions: Array.isArray(h.completions) ? h.completions : [],
          reminderEnabled: h.reminderEnabled ?? false,
          reminderTime: h.reminderTime ?? null,
          }))
          : current.habits,
        theme: (preferences as any)?.aiTone === 'warm' ? 'Tema suave' : current.theme,
        quietMode: typeof (preferences as any)?.notificationsOn === 'boolean'
          ? !(preferences as any).notificationsOn
          : current.quietMode
      }));
    } catch (err) {
      console.error("Failed to sync with backend:", err);
    } finally {
      setLoading(false);
      setHydrated(true);
    }
    })();

    refreshInFlightRef.current = run;
    try {
      await run;
    } finally {
      refreshInFlightRef.current = null;
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const value = useMemo<AuraStoreContextValue>(
    () => ({
      state,
      hydrated,
      loading,
      setName: (value) => setState((current) => ({ ...current, name: value })),
      setEmail: (value) => setState((current) => ({ ...current, email: value })),
      setMood: (value) => setState((current) => ({ ...current, mood: value })),
      setJournal: (value) =>
        setState((current) => ({ ...current, journal: value })),
      toggleTask: async (id) => {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        
        const newStatus = !task.done ? 'completed' : 'planned';
        const today = getLocalDateKey();
        await api.post('/timeline', {
          date: today,
          blocks: [{
            id: String(id),
            title: task.title,
            startTime: task.time,
            endTime: task.endTime ?? addMinutesToTime(task.time, 30),
            category: normalizeTaskCategory(task.category),
            intensity: task.intensity ?? 'M',
            status: newStatus
          }]
        });
        await refreshData();
      },
      toggleQuietMode: () =>
        setState((current) => ({
          ...current,
          quietMode: !current.quietMode,
        })),
      toggleCheckinReminder: () =>
        setState((current) => ({
          ...current,
          checkinReminder: !current.checkinReminder,
        })),
      toggleTheme: () =>
        setState((current) => ({
          ...current,
          theme: current.theme === "Tema claro" ? "Tema suave" : "Tema claro",
        })),
      nextOnboardingStep: () =>
        setState((current) => ({
          ...current,
          onboardingStep: Math.min(6, current.onboardingStep + 1),
        })),
      prevOnboardingStep: () =>
        setState((current) => ({
          ...current,
          onboardingStep: Math.max(1, current.onboardingStep - 1),
        })),
      prepareJournalFromMood: () =>
        setState((current) => ({
          ...current,
          journal:
            current.journal ||
            `Hoje me sinto ${labelMood(current.mood).toLowerCase()} e quero organizar meu dia com mais gentileza.`,
        })),
      addCheckin: async (entry) => {
        const today = getLocalDateKey();
        const recordedAtDate = new Date();
        const recordedAt = recordedAtDate.toISOString();
        const checkinSlot = deriveCheckinSlotToken(recordedAtDate);

        // Atualiza estado local para o fluxo seguir mesmo sem sessão/sem backend
        setState((current) => ({
          ...current,
          checkinHistory: [
            { date: today, recordedAt, checkinSlot, ...entry },
            ...current.checkinHistory.filter((c) => !(c.date === today && c.checkinSlot === checkinSlot)),
          ],
        }));

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
          await api.post('/checkins', {
            localDate: today,
            checkinSlot,
            moodScore: entry.humor,
            energyScore: entry.energia,
            clarityScore: 5,
            irritabilityScore: 5,
            physicalScore: entry.fisico,
            socialScore: entry.social,
            sleepScore: entry.sono,
            note: entry.note ?? state.journal,
            factors: entry.factors,
            emotions: entry.emotions,
            isFlowing: entry.isFlowing,
            flowDay: entry.flowDay,
            flowIntensity: entry.flowIntensity,
            symptomLevels: entry.symptomLevels,
          });
          await refreshData();
        } catch (err) {
          console.error("Failed to persist checkin; kept local copy.", err);
        }
      },
      addGoal: async (title) => {
        await api.post('/objectives', {
          title,
          category: 'geral',
          subgoals: []
        });
        await refreshData();
      },
      addSubGoals: async (goalId, titles) => {
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;
        const existing = goal.subtasks.map(s => ({ id: String(s.id), title: s.title, done: s.done, aiGenerated: false }));
        const newSubs = titles.map((t, i) => ({ id: `ai-${Date.now()}-${i}`, title: t, done: false, aiGenerated: true }));
        const merged = [...existing, ...newSubs];
        const pct = merged.length > 0 ? Math.round(merged.filter(s => s.done).length / merged.length * 100) : 0;
        await api.patch(`/objectives/${goalId}`, { progress: pct, subgoals: merged });
        await refreshData();
      },
      setGoalStatus: async (goalId, progress) => {
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;
        await api.patch(`/objectives/${goalId}`, {
          progress,
          subgoals: goal.subtasks.map(s => ({ id: String(s.id), title: s.title, done: progress === 100 ? true : s.done }))
        });
        await refreshData();
      },
      toggleSubGoal: async (goalId, subGoalId) => {
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;

        const subtasks = goal.subtasks.map((s) =>
          s.id === subGoalId ? { ...s, done: !s.done } : s
        );
        const done = subtasks.filter((s) => s.done).length;
        const pct = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0;

        await api.patch(`/objectives/${goalId}`, {
          progress: pct,
          subgoals: subtasks.map(s => ({ ...s, id: String(s.id), aiGenerated: false }))
        });
        await refreshData();
      },
      removeGoal: async (goalId) => {
        await api.delete(`/objectives/${goalId}`);
        await refreshData();
      },
      addTask: async (title, time, category = 'geral', options) => {
        const today = options?.date ?? getLocalDateKey();
        const normalizedCategory = normalizeTaskCategory(category);
        const endTime = addMinutesToTime(time, 30);
        const result = await api.post('/timeline', {
          date: today,
          forceSave: options?.forceSave ?? false,
          blocks: [{
            title,
            startTime: time,
            endTime,
            category: normalizedCategory,
            intensity: 'M'
          }]
        });
        if (today === getLocalDateKey()) {
          await refreshData();
        }
        const savedBlock = Array.isArray((result as any)?.savedBlocks) ? (result as any).savedBlocks[0] : null;
        return savedBlock
          ? {
              id: savedBlock.id,
              title,
              time,
              endTime,
              done: false,
              category: normalizedCategory,
              intensity: 'M',
            }
          : null;
      },
      updateTask: async (id, updates) => {
        const today = getLocalDateKey();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        const startTime = updates.time ?? task.time;
        const endTime = addMinutesToTime(startTime, diffMinutes(task.time, task.endTime));
        await api.post('/timeline', {
          date: today,
          blocks: [{
            id: String(id),
            title: updates.title ?? task.title,
            startTime,
            endTime,
            category: normalizeTaskCategory(updates.category ?? task.category),
            intensity: task.intensity ?? 'M'
          }]
        });
        await refreshData();
      },
      removeTask: async (id) => {
        await api.delete(`/timeline/${id}`);
        await refreshData();
      },
      reorderTasks: (fromIdx, toIdx) => {
        // Local only for now, could be synced in batch
        setState((current) => {
          const tasks = [...current.tasks];
          const [moved] = tasks.splice(fromIdx, 1);
          tasks.splice(toIdx, 0, moved);
          return { ...current, tasks };
        });
      },
      toggleHabit: async (habitId) => {
        const today = getLocalDateKey();
        await api.post(`/habits/${habitId}/toggle`, { date: today });
        await refreshData();
      },
      archiveHabit: async (habitId) => {
        await api.patch(`/habits/${habitId}`, { archived: true });
        await refreshData();
      },
      addHabit: async (habit) => {
        await api.post('/habits', habit);
        await refreshData();
      },
      setAutonomousInsight: (insight) =>
        setState((current) => ({ ...current, autonomousInsight: insight })),
      setPhaseTransitionAlert: (alert) =>
        setState((current) => ({ ...current, phaseTransitionAlert: alert })),
      dismissPhaseTransitionAlert: () =>
        setState((current) => ({
          ...current,
          phaseTransitionAlert: current.phaseTransitionAlert
            ? { ...current.phaseTransitionAlert, dismissed: true }
            : null,
        })),
      setPendingFollowUp: (followUp) =>
        setState((current) => ({ ...current, pendingFollowUp: followUp })),
      resolveFollowUp: (response) =>
        setState((current) => ({
          ...current,
          pendingFollowUp: current.pendingFollowUp
            ? { ...current.pendingFollowUp, response, followUpMessage: null }
            : null,
        })),
      setLastProfileUpdate: (isoDate) =>
        setState((current) => ({ ...current, lastProfileUpdate: isoDate })),
      setProactiveNudge: (nudge) =>
        setState((current) => ({ ...current, proactiveNudge: nudge })),
      refreshData
    }),
    [state, hydrated, loading]
  );

  return (
    <AuraStoreContext.Provider value={value}>
      {children}
    </AuraStoreContext.Provider>
  );
}

export function useAuraStore() {
  const context = useContext(AuraStoreContext);

  if (!context) {
    throw new Error("useAuraStore must be used inside AuraStoreProvider");
  }

  return context;
}

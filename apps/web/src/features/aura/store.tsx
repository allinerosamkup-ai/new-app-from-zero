import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { initialAuraState, labelMood } from "./data";
import type { AuraState, AutonomousInsight, CheckinEntry, FollowUpPending, MoodOption, PhaseTransitionAlert, ProactiveNudge } from "./types";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";

function normalizeTaskCategory(category?: string): 'trabalho' | 'pessoal' | 'autocuidado' | 'social' | 'outro' {
  const value = (category ?? 'pessoal').trim().toLowerCase();

  if (value === 'trabalho') return 'trabalho';
  if (value === 'social') return 'social';
  if (value === 'autocuidado' || value === 'saude' || value === 'saúde') return 'autocuidado';
  if (value === 'geral' || value === 'rotina' || value === 'pessoal') return 'pessoal';
  return 'outro';
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
  addTask: (title: string, time: string, category?: string) => Promise<void>;
  updateTask: (id: string | number, updates: { title?: string; time?: string; category?: string }) => Promise<void>;
  removeTask: (id: string | number) => Promise<void>;
  reorderTasks: (fromIdx: number, toIdx: number) => void;
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

  const refreshData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setHydrated(true);
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [checkins, timeline, objectives, preferences] = await Promise.all([
        api.get('/checkins?days=7'),
        api.get(`/timeline/${today}`),
        api.get('/objectives'),
        api.get('/preferences')
      ]);

      setState(current => ({
        ...current,
        checkinHistory: checkins.map((c: any) => ({
          date: c.localDate.split('T')[0],
          humor: c.moodScore,
          energia: c.energyScore,
          emotion: c.stateLabelType || 'calm',
          fisico: c.physicalScore ?? undefined,
          social: c.socialScore ?? undefined,
          sono: c.sleepScore ?? undefined,
        })),
        tasks: timeline.map((t: any) => ({
          id: t.id,
          title: t.title,
          time: t.startTime,
          done: t.status === 'completed'
        })),
        goals: objectives.map((o: any) => ({
          id: o.id,
          title: o.title,
          progress: o.description || 'Em andamento',
          completedPct: o.progress,
          subtasks: o.subgoals.map((s: any) => ({
            id: s.id,
            title: s.title,
            done: s.done
          }))
        })),
        theme: preferences.aiTone === 'warm' ? 'Tema suave' : 'Tema claro',
        quietMode: !preferences.notificationsOn
      }));
    } catch (err) {
      console.error("Failed to sync with backend:", err);
    } finally {
      setLoading(false);
      setHydrated(true);
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
        // Encontrar os dados originais do bloco para o sync
        const today = new Date().toISOString().split('T')[0];
        await api.post('/timeline', {
          date: today,
          blocks: [{
            id: id,
            title: task.title,
            startTime: task.time,
            endTime: task.time, // Simplificação para o MVP
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
        const today = new Date().toISOString().split('T')[0];

        // Atualiza estado local para o fluxo seguir mesmo sem sessão/sem backend
        setState((current) => ({
          ...current,
          checkinHistory: [
            { date: today, ...entry },
            ...current.checkinHistory.filter((c) => c.date !== today),
          ],
        }));

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
          const hour = new Date().getHours();
          const checkinSlot = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'midday' : 'evening';
          await api.post('/checkins', {
            localDate: today,
            checkinSlot,
            moodScore: entry.humor,
            energyScore: entry.energia,
            clarityScore: 3,
            irritabilityScore: 3,
            physicalScore: entry.fisico,
            socialScore: entry.social,
            sleepScore: entry.sono,
            note: state.journal,
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
        const existing = goal.subtasks.map(s => ({ id: String(s.id), title: s.title, done: s.done }));
        const newSubs = titles.map((t, i) => ({ id: `ai-${Date.now()}-${i}`, title: t, done: false }));
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
      addTask: async (title, time, category = 'geral') => {
        const today = new Date().toISOString().split('T')[0];
        await api.post('/timeline', {
          date: today,
          blocks: [{
            title,
            startTime: time,
            endTime: time,
            category: normalizeTaskCategory(category),
            intensity: 'M'
          }]
        });
        await refreshData();
      },
      updateTask: async (id, updates) => {
        const today = new Date().toISOString().split('T')[0];
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        await api.post('/timeline', {
          date: today,
          blocks: [{
            id: String(id),
            title: updates.title ?? task.title,
            startTime: updates.time ?? task.time,
            endTime: updates.time ?? task.time,
            category: normalizeTaskCategory(updates.category),
            intensity: 'M'
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

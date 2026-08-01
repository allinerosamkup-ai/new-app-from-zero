import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialAuraState, labelMood } from "./data";
import type { AuraState, AutonomousInsight, CheckinEntry, FollowUpPending, Goal, MoodOption, NotificationPreferences, PhaseTransitionAlert, ProactiveNudge } from "./types";
import { createEmptyOnboardingDraft, type OnboardingDraft } from "./onboarding";
import { normalizeReminderPreferences } from "./settings";
import { api } from "../../lib/api";
import { queueCheckin } from "../../lib/offline-checkin";
import { supabase } from "../../lib/supabase";
import { getLocalDateKey, normalizeDateKey } from "../../utils/day-context";
import { successHaptic, tapHaptic } from "../../utils/haptics";
import { postNativeShellMessage } from "../../utils/native-shell";
import { buildCheckinSubmission } from "./checkin-submission";
import { resolveMoodFromCheckin } from "./checkin-mood";
import { hydrateCheckinEntry } from "./checkin-hydration";

function normalizeTaskCategory(category?: string): 'trabalho' | 'pessoal' | 'autocuidado' | 'social' | 'casa' | 'outro' {
  const value = (category ?? 'pessoal').trim().toLowerCase();

  if (value === 'trabalho') return 'trabalho';
  if (value === 'social') return 'social';
  if (value === 'casa') return 'casa';
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

export type GoalActionRecoveryResult = {
  eligible: number;
  attempted: number;
  recovered: number;
  failed: number;
  deferred: number;
  retryAfterMs: number | null;
};

export class GoalActionRecoveryError extends Error {
  constructor(public readonly result: GoalActionRecoveryResult) {
    const retrySeconds = result.retryAfterMs && result.retryAfterMs > 0
      ? ` Tente novamente em ${Math.ceil(result.retryAfterMs / 1000)} segundos.`
      : ' Tente novamente para continuar.';
    super(`Ainda faltam micro-ações em ${result.eligible - result.recovered} objetivo(s).${retrySeconds}`);
  }
}

function parseGoalActionRecoveryResult(value: unknown): GoalActionRecoveryResult {
  if (!value || typeof value !== 'object') throw new Error('Resposta inválida ao recuperar ações dos objetivos.');
  const payload = value as Record<string, unknown>;
  const numericKeys = ['eligible', 'attempted', 'recovered', 'failed', 'deferred'] as const;
  for (const key of numericKeys) {
    if (!Number.isInteger(payload[key]) || Number(payload[key]) < 0) {
      throw new Error('Resposta inválida ao recuperar ações dos objetivos.');
    }
  }
  if (payload.retryAfterMs !== null && (!Number.isFinite(payload.retryAfterMs) || Number(payload.retryAfterMs) < 0)) {
    throw new Error('Resposta inválida ao recuperar ações dos objetivos.');
  }
  const result = payload as unknown as GoalActionRecoveryResult;
  if (
    result.recovered + result.failed + result.deferred !== result.eligible
    || result.attempted > result.eligible
    || result.attempted < result.recovered + result.failed
  ) {
    throw new Error('Resposta inválida ao recuperar ações dos objetivos.');
  }
  return result;
}

function mapCanonicalObjectives(value: unknown): Goal[] {
  if (!Array.isArray(value)) throw new Error('Não foi possível carregar os objetivos atualizados.');
  return value.map((objective: any) => ({
    id: objective.id,
    title: objective.title,
    progress: objective.description || 'Em andamento',
    completedPct: objective.progress,
    subtasks: Array.isArray(objective.subgoals) ? objective.subgoals.map((subgoal: any, index: number) => ({
      id: subgoal.id,
      title: subgoal.title,
      done: subgoal.done ?? subgoal.completed ?? false,
      order: subgoal.order ?? index,
      plannerBlockId: subgoal.plannerBlockId ?? null,
    })) : [],
  }));
}

export async function recoverGoalActionsWithCanonicalHydration(input: {
  recover: () => Promise<unknown>;
  loadObjectives: () => Promise<unknown>;
  commitObjectives: (objectives: Goal[]) => Promise<void>;
}): Promise<GoalActionRecoveryResult> {
  const result = parseGoalActionRecoveryResult(await input.recover());
  const objectives = mapCanonicalObjectives(await input.loadObjectives());
  await input.commitObjectives(objectives);
  if (result.failed > 0 || result.deferred > 0 || result.recovered < result.eligible) {
    throw new GoalActionRecoveryError(result);
  }
  return result;
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
  toggleCheckinReminder: () => Promise<void>;
  setCheckinReminderTimes: (times: { morning?: string; evening?: string }) => Promise<void>;
  updateNotificationPreferences: (patch: Partial<NotificationPreferences>) => Promise<void>;
  toggleTheme: () => void;
  nextOnboardingStep: () => void;
  prevOnboardingStep: () => void;
  updateOnboardingDraft: (patch: Partial<OnboardingDraft>) => void;
  resetOnboardingDraft: () => void;
  saveProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  prepareJournalFromMood: () => void;
  addCheckin: (entry: Omit<CheckinEntry, "date">) => Promise<{ stateLabel: string | null; analysis: string | null; recommendations: string[]; suggestedIntensity: string | null; riskSafety?: unknown } | null>;
  addGoal: (title: string) => Promise<void>;
  addGoalWithSubGoals: (title: string, subgoals: string[]) => Promise<void>;
  addSubGoals: (goalId: string | number, titles: string[]) => Promise<void>;
  linkGoalActionToPlannerBlock: (goalId: string | number, subGoalId: string | number, plannerBlockId: string | number) => Promise<void>;
  setGoalStatus: (goalId: string | number, progress: number) => Promise<void>;
  toggleSubGoal: (goalId: string | number, subGoalId: string | number) => Promise<GoalActionCompletion | null>;
  removeGoal: (goalId: string | number) => Promise<void>;
  updateGoal: (goalId: string | number, updates: Partial<{ title: string; progress: number }>) => Promise<void>;
  addTask: (
    title: string,
    time: string,
    category?: string,
    options?: { 
      date?: string; 
      forceSave?: boolean;
      note?: string;
      persistentReminderEnabled?: boolean;
      persistentReminderIntervalMinutes?: number | null;
    }
  ) => Promise<{ id: string | number; title: string; time: string; endTime: string; done: boolean; category?: string; intensity?: string; isAiSuggested?: boolean; aiReasoning?: string | null; note?: string | null; persistentReminderEnabled?: boolean; persistentReminderIntervalMinutes?: number | null } | null>;
  updateTask: (id: string | number, updates: { title?: string; time?: string; category?: string; note?: string; persistentReminderEnabled?: boolean; persistentReminderIntervalMinutes?: number | null; done?: boolean }) => Promise<void>;
  removeTask: (id: string | number) => Promise<void>;
  reorderTasks: (fromIdx: number, toIdx: number) => void;
  /** Devolve a comemoração quando o hábito acabou de ser concluído. */
  toggleHabit: (habitId: string) => Promise<{
    headline: string; detail: string | null; animation: string; intensity: string;
  } | null>;
  archiveHabit: (habitId: string) => Promise<void>;
  unarchiveHabit: (habitId: string) => Promise<void>;
  updateHabit: (habitId: string, habit: Partial<{
    title: string;
    category: string;
    frequency: string;
    targetDays: number[];
    targetCount: number;
    icon: string;
    timeOfDay: string;
    description: string;
    durationMinutes: number;
    reminderEnabled: boolean;
    reminderTime: string;
    persistentReminderEnabled: boolean;
    persistentReminderIntervalMinutes: number;
  }>) => Promise<void>;
  addHabit: (habit: {
    title: string;
    category: string;
    frequency: string;
    targetDays?: number[];
    targetCount?: number;
    icon?: string;
    timeOfDay?: string;
    description?: string;
    durationMinutes?: number;
    reminderEnabled?: boolean;
    reminderTime?: string;
    persistentReminderEnabled?: boolean;
    persistentReminderIntervalMinutes?: number;
  }) => Promise<void>;
  setAutonomousInsight: (insight: AutonomousInsight | null) => void;
  setPhaseTransitionAlert: (alert: PhaseTransitionAlert | null) => void;
  dismissPhaseTransitionAlert: () => void;
  setPendingFollowUp: (followUp: FollowUpPending | null) => void;
  resolveFollowUp: (response: "done" | "skip") => void;
  setLastProfileUpdate: (isoDate: string) => void;
  setProactiveNudge: (nudge: ProactiveNudge | null) => void;
  recoverGoalActions: () => Promise<GoalActionRecoveryResult>;
  refreshData: () => Promise<void>;
};

export type GoalActionCompletion = {
  objectiveId: string;
  progress: number;
  nextAction: { id: string; title: string; order: number; plannerBlockId?: string | null } | null;
  completedNow: boolean;
  objectiveCompletedNow: boolean;
};

const AuraStoreContext = createContext<AuraStoreContextValue | null>(null);

function getInitialTheme() {
  try {
    const stored = localStorage.getItem("airia_theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return initialAuraState.theme;
}

export function AuraStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuraState>(() => ({
    ...initialAuraState,
    theme: getInitialTheme(),
  }));
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const objectiveCommitResolversRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const isDark = state.theme === "dark" || state.theme === "Tema escuro";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    try {
      localStorage.setItem("airia_theme", isDark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [state.theme]);

  useEffect(() => {
    const resolvers = objectiveCommitResolversRef.current.splice(0);
    resolvers.forEach((resolve) => resolve());
  }, [state.goals]);

  const refreshData = useCallback(async () => {
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
        const [checkinsRaw, timelineRaw, objectivesRaw, preferencesRaw, habitsRaw, profileRaw] = await Promise.all([
          api.get('/checkins?days=90').catch(e => { console.error(e); return null; }),
          api.get(`/timeline/${today}`).catch(e => { console.error(e); return null; }),
          api.get('/objectives').catch(e => { console.error(e); return null; }),
          api.get('/preferences').catch(e => { console.error(e); return null; }),
          api.get('/habits').catch(e => { console.error(e); return null; }),
          (async () => {
            try {
              const r = await supabase.from('profiles').select('cycle_start, cycle_length, luteal_length, onboarding_done, created_at').eq('id', session.user.id).maybeSingle();
              return r.data;
            } catch (e) { console.error(e); return null; }
          })(),
        ]);

        const checkins = Array.isArray(checkinsRaw) ? checkinsRaw : null;
        const mappedCheckins = checkins
          ? checkins.map((c: any) => hydrateCheckinEntry(c)).filter((entry) => Boolean(entry.date))
          : null;

        const timeline = Array.isArray(timelineRaw) ? timelineRaw : null;
        const objectives = Array.isArray(objectivesRaw) ? objectivesRaw : null;
        const preferences = (preferencesRaw && typeof preferencesRaw === 'object') ? preferencesRaw : null;
        const habits = Array.isArray(habitsRaw) ? habitsRaw : null;
        const profile = (profileRaw && typeof profileRaw === 'object') ? profileRaw as { cycle_start: string | null; cycle_length: number | null; luteal_length: number | null; onboarding_done: boolean | null; created_at?: string | null } : null;

        setState(current => ({
          ...current,
          name: (preferences as any)?.fullName ?? session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? current.name,
          email: session.user.email ?? current.email,
          accountCreatedAt: profile?.created_at ?? session.user.created_at ?? current.accountCreatedAt ?? null,
          checkinHistory: mappedCheckins && mappedCheckins.length > 0
            ? mappedCheckins
            : current.checkinHistory,
          mood: mappedCheckins && mappedCheckins.length > 0
            ? resolveMoodFromCheckin(mappedCheckins[0], current.mood)
            : current.mood,
          tasks: timeline
            ? timeline.map((t: any) => ({
              id: t.id,
              title: t.title,
              time: t.startTime,
              endTime: t.endTime,
              done: t.status === 'completed',
              category: t.category,
              intensity: t.intensity,
              persistentReminderEnabled: t.persistentReminderEnabled ?? false,
              persistentReminderIntervalMinutes: t.persistentReminderIntervalMinutes ?? null,
              isAiSuggested: t.isAiSuggested ?? false,
              aiReasoning: t.aiReasoning ?? null,
              note: t.note ?? null,
            }))
            : current.tasks,
          goals: objectives ? mapCanonicalObjectives(objectives) : current.goals,
          habits: habits
            ? habits.map((h: any) => ({
              id: h.id,
              title: h.title,
              description: h.description,
              category: h.category,
              icon: h.icon,
              frequency: h.frequency,
              targetDays: h.targetDays,
              targetCount: h.targetCount ?? 1,
              timeOfDay: h.timeOfDay ?? null,
              durationMinutes: h.durationMinutes ?? null,
              streakCount: h.streakCount,
              bestStreak: h.bestStreak,
              totalCompletions: h.totalCompletions,
              completions: Array.isArray(h.completions)
                ? h.completions.map((completion: any) => ({
                  ...completion,
                  completionCount: completion.completionCount ?? 1,
                }))
                : [],
              reminderEnabled: h.reminderEnabled ?? false,
              reminderTime: h.reminderTime ?? null,
              persistentReminderEnabled: h.persistentReminderEnabled ?? false,
              persistentReminderIntervalMinutes: h.persistentReminderIntervalMinutes ?? null,
            }))
            : current.habits,
          theme: current.theme,
          cycleStart: profile?.cycle_start ? profile.cycle_start.slice(0, 10) : current.cycleStart,
          cycleLength: profile?.cycle_length ?? current.cycleLength,
          lutealLength: profile?.luteal_length ?? current.lutealLength,
          onboardingDone: profile?.onboarding_done ?? current.onboardingDone,
          ...normalizeReminderPreferences(preferences, {
            morningCheckinTime: current.morningCheckinTime,
            eveningCheckinTime: current.eveningCheckinTime,
            checkinReminder: current.checkinReminder,
            notificationPreferences: current.notificationPreferences,
          }),
        }));
      } catch (err) {
        console.error('Error refreshing AuraStore data:', err);
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
  }, []);

  useEffect(() => {
    try {
      const storedQuietMode = window.localStorage.getItem("airia.quietMode");
      if (storedQuietMode === "true" || storedQuietMode === "false") {
        setState((current) => ({ ...current, quietMode: storedQuietMode === "true" }));
      }
    } catch {}

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
        // Pequena vitória sentida na hora; desfazer é neutro (sem "punição").
        if (newStatus === 'completed') successHaptic(); else tapHaptic();
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
            persistentReminderEnabled: task.persistentReminderEnabled ?? false,
            persistentReminderIntervalMinutes: task.persistentReminderIntervalMinutes ?? null,
            isAiSuggested: task.isAiSuggested ?? false,
            aiReasoning: task.aiReasoning ?? null,
            note: task.note,
            status: newStatus
          }]
        });
        await refreshData();
      },
      toggleQuietMode: () =>
        setState((current) => {
          const quietMode = !current.quietMode;
          try {
            window.localStorage.setItem("airia.quietMode", String(quietMode));
          } catch {}
          return { ...current, quietMode };
        }),
      toggleCheckinReminder: async () => {
        const next = !state.checkinReminder;
        const notificationPreferences = {
          ...state.notificationPreferences,
          checkin: next,
        };
        setState((current) => ({
          ...current,
          checkinReminder: next,
          notificationPreferences,
        }));
        try {
          await api.patch('/preferences', {
            notificationsOn: next,
            morningCheckinTime: state.morningCheckinTime,
            eveningReviewTime: state.eveningCheckinTime,
            notificationPreferences,
          });
        } catch (err) {
          console.error("Failed to persist check-in reminder preference.", err);
          setState((current) => ({
            ...current,
            checkinReminder: !next,
            notificationPreferences: {
              ...current.notificationPreferences,
              checkin: !next,
            },
          }));
        }
      },
      setCheckinReminderTimes: async (times) => {
        const morningCheckinTime = times.morning ?? state.morningCheckinTime;
        const eveningCheckinTime = times.evening ?? state.eveningCheckinTime;

        setState((current) => ({
          ...current,
          morningCheckinTime,
          eveningCheckinTime,
        }));

        try {
          await api.patch('/preferences', {
            morningCheckinTime,
            eveningReviewTime: eveningCheckinTime,
            notificationPreferences: state.notificationPreferences,
          });
        } catch (err) {
          console.error("Failed to persist check-in reminder times.", err);
          await refreshData();
        }
      },
      updateNotificationPreferences: async (patch) => {
        const next = {
          ...state.notificationPreferences,
          ...patch,
        };

        setState((current) => ({
          ...current,
          checkinReminder: next.checkin,
          notificationPreferences: next,
        }));

        try {
          await api.patch('/preferences', {
            notificationsOn: next.checkin,
            morningCheckinTime: state.morningCheckinTime,
            eveningReviewTime: state.eveningCheckinTime,
            notificationPreferences: next,
          });
        } catch (err) {
          console.error("Failed to persist notification preferences.", err);
          await refreshData();
        }
      },
      toggleTheme: () =>
        setState((current) => ({
          ...current,
          theme: current.theme === "dark" || current.theme === "Tema escuro" ? "light" : "dark",
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
      updateOnboardingDraft: (patch) =>
        setState((current) => ({
          ...current,
          name: typeof patch.fullName === "string" ? patch.fullName : current.name,
          onboardingDraft: {
            ...current.onboardingDraft,
            ...patch,
          },
        })),
      resetOnboardingDraft: () =>
        setState((current) => ({
          ...current,
          onboardingStep: 0,
          onboardingDraft: createEmptyOnboardingDraft(),
        })),
      saveProfile: async () => {
        const fullName = state.name.trim();
        if (!fullName) return;
        await api.patch('/profile', { fullName });
        await refreshData();
      },
      signOut: async () => {
        await supabase.auth.signOut();
        postNativeShellMessage({ type: "auth.signOut" });
        setState({
          ...initialAuraState,
          onboardingDraft: createEmptyOnboardingDraft(),
          checkinHistory: [],
          tasks: [],
          goals: [],
          habits: [],
        });
        setHydrated(true);
      },
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
        if (!session) return null;

        try {
          const checkinResponse = await api.post('/checkins', buildCheckinSubmission({
            localDate: today,
            checkinSlot,
            entry,
          })) as any;

          await refreshData();

          // Sincronizar nota com o Diário (Journal)
          if (entry.note && entry.note.trim().length > 0) {
            try {
              await api.post('/journal/external-message', {
                message: entry.note.trim(),
                referenceDate: today
              });
            } catch (journalErr) {
              console.warn('[Sync] Falha ao enviar nota para o diário:', journalErr);
            }
          }

          // Retorna dados ricos da IA para uso na tela de resultado
          const extracted = {
            stateLabel: checkinResponse?.stateLabel ?? null,
            analysis: checkinResponse?.stateSummary ?? (checkinResponse?.aiState as any)?.analysis ?? null,
            recommendations: (checkinResponse?.aiState as any)?.recommendations ?? [],
            suggestedIntensity: (checkinResponse?.aiState as any)?.suggestedIntensity ?? null,
            riskSafety: checkinResponse?.riskSafety ?? (checkinResponse?.aiState as any)?.riskSafety,
          };
          return extracted;
        } catch (err) {
          console.error("Failed to persist checkin; kept local copy.", err);
          // Salva na fila offline para sincronizar quando a conexão voltar
          if (!navigator.onLine) {
queueCheckin({
              date: today,
              humor: entry.humor,
              energia: entry.energia,
              sono: entry.sono,
              checkinSlot,
            });
            console.log("[offline-sync] Check-in enfileirado para sync posterior.");
          }
          return null;
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
      addGoalWithSubGoals: async (title, subgoals) => {
        const normalizedSubgoals = subgoals
          .map((item, index) => ({
            id: `ai-${Date.now()}-${index}`,
            title: item.trim(),
            done: false,
            order: index,
            aiGenerated: true,
          }))
          .filter((item) => item.title.length > 0);

        await api.post('/objectives', {
          title,
          category: 'geral',
          subgoals: normalizedSubgoals,
        });
        await refreshData();
      },
      addSubGoals: async (goalId, titles) => {
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;
        const existing = goal.subtasks.map((s, index) => ({
          id: String(s.id), title: s.title, done: s.done, order: s.order ?? index,
          plannerBlockId: s.plannerBlockId ?? null, aiGenerated: false,
        }));
        const newSubs = titles.map((t, i) => ({
          id: `ai-${Date.now()}-${i}`, title: t, done: false, order: existing.length + i, aiGenerated: true,
        }));
        const merged = [...existing, ...newSubs];
        const pct = merged.length > 0 ? Math.round(merged.filter(s => s.done).length / merged.length * 100) : 0;
        await api.patch(`/objectives/${goalId}`, { progress: pct, subgoals: merged });
        await refreshData();
      },
      linkGoalActionToPlannerBlock: async (goalId, subGoalId, plannerBlockId) => {
        const goal = state.goals.find((item) => item.id === goalId);
        if (!goal) return;
        await api.patch(`/objectives/${goalId}`, {
          subgoals: goal.subtasks.map((subgoal, index) => ({
            id: String(subgoal.id),
            title: subgoal.title,
            done: subgoal.done,
            order: subgoal.order ?? index,
            plannerBlockId: String(subgoal.id) === String(subGoalId)
              ? String(plannerBlockId)
              : subgoal.plannerBlockId ?? null,
            aiGenerated: false,
          })),
        });
        await refreshData();
      },
      setGoalStatus: async (goalId, progress) => {
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;
        await api.patch(`/objectives/${goalId}`, {
          progress,
          subgoals: goal.subtasks.map((s, index) => ({
            id: String(s.id), title: s.title, done: progress === 100 ? true : s.done,
            order: s.order ?? index, plannerBlockId: s.plannerBlockId ?? null,
          }))
        });
        await refreshData();
      },
      toggleSubGoal: async (goalId, subGoalId) => {
        const result = await api.post(`/objectives/${goalId}/subgoals/${subGoalId}/complete`, {}) as GoalActionCompletion;
        await refreshData();
        return result;
      },
      removeGoal: async (goalId) => {
        await api.delete(`/objectives/${goalId}`);
        await refreshData();
      },
      updateGoal: async (goalId, updates) => {
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;
        await api.patch(`/objectives/${goalId}`, {
          title: updates.title ?? goal.title,
          progress: updates.progress ?? goal.completedPct,
          subgoals: goal.subtasks.map((s, index) => ({ ...s, id: String(s.id), order: s.order ?? index, aiGenerated: false }))
        });
        await refreshData();
      },
      recoverGoalActions: async () => {
        const refreshAlreadyRunning = refreshInFlightRef.current;
        if (refreshAlreadyRunning) await refreshAlreadyRunning;
        return recoverGoalActionsWithCanonicalHydration({
          recover: () => api.post('/objectives/recover-actions', {}),
          loadObjectives: () => api.get('/objectives'),
          commitObjectives: (objectives) => new Promise<void>((resolve) => {
            objectiveCommitResolversRef.current.push(resolve);
            setState((current) => ({ ...current, goals: objectives }));
          }),
        });
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
            intensity: 'M',
            isAiSuggested: options?.forceSave ?? false,
            aiReasoning: options?.forceSave ? 'Criado por sugestão da Airia.' : undefined,
            note: options?.note,
            persistentReminderEnabled: options?.persistentReminderEnabled ?? false,
            persistentReminderIntervalMinutes: options?.persistentReminderIntervalMinutes ?? null,
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
              isAiSuggested: options?.forceSave ?? false,
              aiReasoning: options?.forceSave ? 'Criado por sugestão da Airia.' : undefined,
              note: savedBlock.note ?? options?.note ?? null,
              persistentReminderEnabled: savedBlock.persistentReminderEnabled ?? options?.persistentReminderEnabled ?? false,
              persistentReminderIntervalMinutes: savedBlock.persistentReminderIntervalMinutes ?? options?.persistentReminderIntervalMinutes ?? null,
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
            intensity: task.intensity ?? 'M',
            persistentReminderEnabled: updates.persistentReminderEnabled ?? task.persistentReminderEnabled ?? false,
            persistentReminderIntervalMinutes: updates.persistentReminderIntervalMinutes === undefined ? task.persistentReminderIntervalMinutes : updates.persistentReminderIntervalMinutes,
            isAiSuggested: task.isAiSuggested ?? false,
            aiReasoning: task.aiReasoning ?? null,
            note: updates.note ?? task.note,
            status: updates.done !== undefined ? (updates.done ? 'completed' : 'planned') : (task.done ? 'completed' : 'planned'),
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
        // Feedback tátil imediato — o refresh chega depois, a sensação chega já.
        const habit = state.habits.find((h) => h.id === habitId);
        const alreadyDoneToday = habit?.completions?.some(
          (completion: { date?: string }) => normalizeDateKey(completion.date ?? "") === today,
        );
        if (alreadyDoneToday) tapHaptic(); else successHaptic();
        const result = await api.post(`/habits/${habitId}/toggle`, { date: today }) as {
          reward?: { headline: string; detail: string | null; animation: string; intensity: string } | null;
        };
        await refreshData();
        return result?.reward ?? null;
      },
      archiveHabit: async (habitId) => {
        await api.patch(`/habits/${habitId}`, { archived: true });
        await refreshData();
      },
      unarchiveHabit: async (habitId) => {
        await api.patch(`/habits/${habitId}`, { archived: false });
        await refreshData();
      },
      updateHabit: async (habitId, habit) => {
        await api.patch(`/habits/${habitId}`, habit);
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

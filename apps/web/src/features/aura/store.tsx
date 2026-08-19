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
import type { AuraState, AutonomousInsight, CheckinEntry, FollowUpPending, Goal, Habit, MoodOption, NotificationPreferences, PhaseTransitionAlert, ProactiveNudge, SubGoal, Task } from "./types";
import { createEmptyOnboardingDraft, type OnboardingDraft } from "./onboarding";
import { normalizeReminderPreferences } from "./settings";
import { api } from "../../lib/api";
import {
  queueCheckin,
  registerOfflineSync,
  syncPendingCheckins,
  type QueuedCheckinReceipt,
} from "../../lib/offline-checkin";
import { supabase } from "../../lib/supabase";
import { getLocalDateKey, normalizeDateKey } from "../../utils/day-context";
import { successHaptic, tapHaptic } from "../../utils/haptics";
import { postNativeShellMessage } from "../../utils/native-shell";
import { buildCheckinSubmission, type CheckinSubmission } from "./checkin-submission";
import { resolveMoodFromCheckin } from "./checkin-mood";
import { hydrateCheckinEntry } from "./checkin-hydration";
import { FEATURES } from "../../config/features";

type ApiGoalAction = Partial<SubGoal> & Pick<SubGoal, 'id' | 'title'>;
type ApiGoal = {
  id: Goal['id'];
  title: string;
  progress: number;
  description?: string | null;
  resultDefinition?: string | null;
  currentReality?: string | null;
  subgoals?: unknown[];
  milestones?: Goal['milestones'];
  pathVersion?: number;
  pathStatus?: Goal['pathStatus'];
  pathQuestion?: string | null;
  needsActionReview?: boolean;
  deadline?: string | null;
  pausedAt?: string | null;
  isPrimary?: boolean;
  pathProposal?: unknown;
};
type ApiTimelineTask = Partial<Task> & Pick<Task, 'id' | 'title'> & {
  startTime?: string;
  status?: string;
};
type ApiHabitCompletion = Habit['completions'] extends Array<infer Completion> | undefined ? Completion : never;
type ApiHabit = Partial<Habit> & Pick<Habit, 'id' | 'title' | 'category' | 'frequency' | 'targetDays' | 'streakCount' | 'bestStreak' | 'totalCompletions' | 'reminderEnabled'> & {
  completions?: ApiHabitCompletion[];
};
type ApiPreferences = {
  fullName?: string;
  biologicalSex?: AuraState['biologicalSex'];
  medicationCurrentlyUsing?: AuraState['medicationCurrentlyUsing'];
};
type ApiCheckinResponse = {
  checkinId?: string | number;
  id?: string | number;
  stateLabel?: string | null;
  stateSummary?: string | null;
  riskSafety?: unknown;
  aiState?: {
    analysis?: string | null;
    recommendations?: string[];
    suggestedIntensity?: string | null;
    riskSafety?: unknown;
  };
};
type ApiSavedTimelineBlock = Pick<Task, 'id'> & Partial<Pick<Task, 'note' | 'persistentReminderEnabled' | 'persistentReminderIntervalMinutes'>>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

/**
 * Proteção de leitura para uma versão de API ainda anterior ao contrato atual.
 * O backend permanece a fonte canônica de qualidade; aqui apenas recusamos
 * renderizar como ação operacional qualquer registro sem evidência de término.
 */
function isVisibleGoalAction(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  return typeof action.title === "string"
    && action.title.trim().length > 0
    && typeof action.doneWhen === "string"
    && action.doneWhen.trim().length > 0;
}

function needsGoalActionReview(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((item) => {
    if (!item || typeof item !== "object") return false;
    const action = item as Record<string, unknown>;
    return action.done !== true
      && action.status !== "rejected"
      && action.status !== "deferred"
      && !isVisibleGoalAction(action);
  });
}

function normalizeTaskCategory(category?: string): 'trabalho' | 'pessoal' | 'autocuidado' | 'social' | 'casa' | 'outro' {
  const value = (category ?? 'pessoal').trim().toLowerCase();

  if (value === 'trabalho') return 'trabalho';
  if (value === 'social') return 'social';
  if (value === 'casa') return 'casa';
  if (value === 'autocuidado' || value === 'saude' || value === 'saúde') return 'autocuidado';
  if (value === 'geral' || value === 'rotina' || value === 'pessoal') return 'pessoal';
  return 'outro';
}

function deriveCheckinBaseSlot(recordedAt: Date): "morning" | "midday" | "evening" {
  const hour = recordedAt.getHours();
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'midday' : 'evening';
}

function deriveCheckinSlotToken(recordedAt: Date): string {
  const baseSlot = deriveCheckinBaseSlot(recordedAt);
  const minute = recordedAt.getMinutes();
  const second = recordedAt.getSeconds();
  const hour = recordedAt.getHours();
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
  return value.map((rawObjective) => {
    const objective = rawObjective as ApiGoal;
    return {
    id: objective.id,
    title: objective.title,
    progress: objective.description || 'Em andamento',
    completedPct: objective.progress,
    subtasks: Array.isArray(objective.subgoals) ? objective.subgoals
      .filter(isVisibleGoalAction)
      .map((rawSubgoal, index: number) => {
      const subgoal = rawSubgoal as ApiGoalAction;
      return {
      id: subgoal.id,
      title: subgoal.title,
      done: subgoal.done ?? ('completed' in subgoal && subgoal.completed === true),
      order: subgoal.order ?? index,
      plannerBlockId: subgoal.plannerBlockId ?? null,
      milestoneId: subgoal.milestoneId ?? null,
      scheduledFor: subgoal.scheduledFor ?? null,
      doneWhen: subgoal.doneWhen ?? null,
      effortSize: subgoal.effortSize ?? null,
      basedOn: subgoal.basedOn,
      aiGenerated: subgoal.aiGenerated ?? false,
      userEdited: subgoal.userEdited ?? false,
      status: subgoal.status,
      };
    }) : [],
    description: objective.description ?? null,
    resultDefinition: objective.resultDefinition ?? null,
    currentReality: objective.currentReality ?? null,
    milestones: Array.isArray(objective.milestones) ? objective.milestones : [],
    pathVersion: objective.pathVersion ?? 1,
    pathStatus: objective.pathStatus ?? 'not_started',
    pathQuestion: objective.pathQuestion ?? null,
    needsActionReview: objective.needsActionReview === true || needsGoalActionReview(objective.subgoals),
    deadline: objective.deadline ?? null,
    pausedAt: objective.pausedAt ?? null,
    isPrimary: objective.isPrimary ?? false,
    pathProposal: objective.pathProposal ?? null,
    };
  });
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
  addCheckin: (entry: Omit<CheckinEntry, "date">) => Promise<QueuedCheckinReceipt | {
    status: "persisted";
    checkinId: string;
    stateLabel: string | null;
    analysis: string | null;
    recommendations: string[];
    suggestedIntensity: string | null;
    riskSafety?: unknown;
  }>;
  addGoal: (title: string) => Promise<void>;
  addSubGoals: (goalId: string | number, titles: string[]) => Promise<void>;
  /** Corrige o texto de uma ação sem mexer em progresso nem em ordem. */
  updateSubGoalTitle: (goalId: string | number, subGoalId: string | number, title: string) => Promise<void>;
  toggleSubGoal: (goalId: string | number, subGoalId: string | number) => Promise<GoalActionCompletion | null>;
  removeGoal: (goalId: string | number) => Promise<void>;
  updateGoal: (goalId: string | number, updates: Partial<{ title: string }>) => Promise<void>;
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
  refreshData: (historyDays?: number) => Promise<void>;
};

export type GoalActionCompletion = {
  objectiveId: string;
  progress: number;
  nextAction: { id: string; title: string; order: number; plannerBlockId?: string | null } | null;
  completedNow: boolean;
  objectiveCompletedNow: boolean;
  /** Vem do backend, para o texto ser o mesmo em toda superfície. Null quando
   *  a ação já estava concluída e nada mudou agora. */
  reward?: {
    xpEarned: number;
    headline: string;
    detail: string | null;
    animation: string;
    intensity: string;
  } | null;
};

/** Avisa quem mostra progresso que os números mudaram. Sem isso a faixa só
 *  atualizaria no próximo carregamento da tela. */
export const PROGRESS_UPDATED_EVENT = "airia:progress-updated";

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

  const refreshData = useCallback(async (historyDays = 90) => {
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
        const requestedHistoryDays = Math.min(Math.max(Math.ceil(historyDays), 1), 180);
        const [checkinsRaw, timelineRaw, objectivesRaw, preferencesRaw, habitsRaw, profileRaw] = await Promise.all([
          api.get(`/checkins?days=${requestedHistoryDays}`).catch(e => { console.error(e); return null; }),
          FEATURES.planner
            ? api.get(`/timeline/${today}`).catch(e => { console.error(e); return null; })
            : Promise.resolve([]),
          api.get('/objectives').catch(e => { console.error(e); return null; }),
          api.get('/preferences').catch(e => { console.error(e); return null; }),
          FEATURES.habits
            ? api.get('/habits').catch(e => { console.error(e); return null; })
            : Promise.resolve([]),
          (async () => {
            try {
              const r = await supabase.from('profiles').select('cycle_start, cycle_length, luteal_length, onboarding_done, created_at').eq('id', session.user.id).maybeSingle();
              return r.data;
            } catch (e) { console.error(e); return null; }
          })(),
        ]);

        const checkins = Array.isArray(checkinsRaw) ? checkinsRaw : null;
        const mappedCheckins = checkins
          ? checkins.map((checkin) => hydrateCheckinEntry(checkin as Record<string, unknown>)).filter((entry) => Boolean(entry.date))
          : null;

        const timeline = Array.isArray(timelineRaw) ? timelineRaw : null;
        const objectives = Array.isArray(objectivesRaw) ? objectivesRaw : null;
        const preferences = asRecord(preferencesRaw) as ApiPreferences | null;
        const habits = Array.isArray(habitsRaw) ? habitsRaw : null;
        const profile = (profileRaw && typeof profileRaw === 'object') ? profileRaw as { cycle_start: string | null; cycle_length: number | null; luteal_length: number | null; onboarding_done: boolean | null; created_at?: string | null } : null;

        setState(current => ({
          ...current,
          name: preferences?.fullName ?? session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? current.name,
          email: session.user.email ?? current.email,
          accountCreatedAt: profile?.created_at ?? session.user.created_at ?? current.accountCreatedAt ?? null,
          checkinHistory: mappedCheckins && mappedCheckins.length > 0
            ? mappedCheckins
            : current.checkinHistory,
          mood: mappedCheckins && mappedCheckins.length > 0
            ? resolveMoodFromCheckin(mappedCheckins[0], current.mood)
            : current.mood,
          tasks: timeline
            ? timeline.map((rawTask) => {
              const task = rawTask as ApiTimelineTask;
              return {
              id: task.id,
              title: task.title,
              time: task.startTime ?? '',
              endTime: task.endTime,
              done: task.status === 'completed',
              category: task.category,
              intensity: task.intensity,
              persistentReminderEnabled: task.persistentReminderEnabled ?? false,
              persistentReminderIntervalMinutes: task.persistentReminderIntervalMinutes ?? null,
              isAiSuggested: task.isAiSuggested ?? false,
              aiReasoning: task.aiReasoning ?? null,
              note: task.note ?? undefined,
              };
            })
            : current.tasks,
          goals: objectives ? mapCanonicalObjectives(objectives) : current.goals,
          habits: habits
            ? habits.map((rawHabit) => {
              const habit = rawHabit as ApiHabit;
              return {
              id: habit.id,
              title: habit.title,
              description: habit.description,
              category: habit.category,
              icon: habit.icon,
              frequency: habit.frequency,
              targetDays: habit.targetDays,
              targetCount: habit.targetCount ?? 1,
              timeOfDay: habit.timeOfDay ?? null,
              durationMinutes: habit.durationMinutes ?? null,
              streakCount: habit.streakCount,
              bestStreak: habit.bestStreak,
              totalCompletions: habit.totalCompletions,
              completions: Array.isArray(habit.completions)
                ? habit.completions.map((completion) => ({
                  ...completion,
                  completionCount: completion.completionCount ?? 1,
                }))
                : [],
              reminderEnabled: habit.reminderEnabled ?? false,
              reminderTime: habit.reminderTime ?? null,
              persistentReminderEnabled: habit.persistentReminderEnabled ?? false,
              persistentReminderIntervalMinutes: habit.persistentReminderIntervalMinutes ?? null,
              };
            })
            : current.habits,
          theme: current.theme,
          cycleStart: profile?.cycle_start ? profile.cycle_start.slice(0, 10) : current.cycleStart,
          cycleLength: profile?.cycle_length ?? current.cycleLength,
          lutealLength: profile?.luteal_length ?? current.lutealLength,
          biologicalSex: preferences?.biologicalSex ?? current.biologicalSex,
          medicationCurrentlyUsing: preferences?.medicationCurrentlyUsing ?? current.medicationCurrentlyUsing,
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
    const submitQueuedCheckin = async (payload: CheckinSubmission) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão necessária para sincronizar o check-in.");
      await api.post('/checkins', payload);
      await refreshData();
    };
    const unregisterOnlineSync = registerOfflineSync(submitQueuedCheckin);
    /**
     * Sessão que chega depois precisa disparar a carga dos dados.
     *
     * `refreshData` roda uma vez na montagem e desiste em silêncio quando não há
     * sessão. Na abertura a frio do PWA o SDK ainda está restaurando a sessão do
     * armazenamento, então essa primeira tentativa sai vazia — e nada refazia a
     * busca depois. O app renderizava a casca de usuário logado **sem nenhum
     * dado**, indefinidamente: 177 check-ins no banco e a tela dizendo que a
     * conta não tem nada.
     *
     * `INITIAL_SESSION` é o evento que fechava o buraco: é ele que o SDK emite
     * quando termina de restaurar do armazenamento, exatamente o momento em que
     * a primeira tentativa já falhou. `refreshData` deduplica chamadas em voo,
     * então quando a sessão vem a tempo isto não custa requisição extra.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void syncPendingCheckins(submitQueuedCheckin);
      }
      if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        void refreshData();
      }
    });
    return () => {
      unregisterOnlineSync();
      subscription.unsubscribe();
    };
  }, [refreshData]);

  useEffect(() => {
    try {
      const storedQuietMode = window.localStorage.getItem("airia.quietMode");
      if (storedQuietMode === "true" || storedQuietMode === "false") {
        setState((current) => ({ ...current, quietMode: storedQuietMode === "true" }));
      }
    } catch {
      // A preferência é opcional quando o armazenamento local não está disponível.
    }

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
          } catch {
            // A interação continua mesmo se o armazenamento local estiver indisponível.
          }
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
        const baseSlot = deriveCheckinBaseSlot(recordedAtDate);
        const checkinSlot = deriveCheckinSlotToken(recordedAtDate);
        // O primeiro registro de cada janela é a observação principal. Outros
        // são bem-vindos, mas não podem inflar cobertura ou confiança do dia.
        const checkinPurpose = state.checkinHistory.some((checkin) => (
          checkin.date === today && checkin.checkinSlot?.startsWith(baseSlot)
        )) ? "extra" as const : "window" as const;
        const payload = buildCheckinSubmission({
          localDate: today,
          checkinSlot,
          checkinPurpose,
          entry,
        });

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão necessária para salvar o check-in.");

        let checkinResponse: ApiCheckinResponse;
        try {
          checkinResponse = await api.post('/checkins', payload) as ApiCheckinResponse;
        } catch (err) {
          console.error("Failed to persist checkin.", err);
          // Preserve o payload canônico completo, sem anunciar persistência remota.
          if (!navigator.onLine) {
            const queued = queueCheckin(payload);
            console.log("[offline-sync] Check-in enfileirado para sync posterior.");
            return queued;
          }
          throw err;
        }

        try {
          await refreshData();
        } catch (refreshErr) {
          console.warn("[Sync] Check-in salvo, mas o histórico ainda não foi atualizado.", refreshErr);
        }

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
        return {
          status: "persisted" as const,
          checkinId: String(checkinResponse?.checkinId ?? checkinResponse?.id),
          stateLabel: checkinResponse?.stateLabel ?? null,
          analysis: checkinResponse?.stateSummary ?? checkinResponse?.aiState?.analysis ?? null,
          recommendations: checkinResponse?.aiState?.recommendations ?? [],
          suggestedIntensity: checkinResponse?.aiState?.suggestedIntensity ?? null,
          riskSafety: checkinResponse?.riskSafety ?? checkinResponse?.aiState?.riskSafety,
        };
      },
      addGoal: async (title) => {
        await api.post('/objectives', {
          title,
          category: 'geral',
        });
        await refreshData();
      },
      addSubGoals: async (goalId, titles) => {
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;
        let expectedVersion = goal.pathVersion ?? 1;
        for (const title of titles.map((item) => item.trim()).filter(Boolean)) {
          const result = await api.post(`/objectives/${goalId}/actions`, { expectedVersion, title }) as { pathVersion: number };
          expectedVersion = result.pathVersion;
        }
        await refreshData();
      },
      /**
       * Renomeia uma ação.
       *
       * A ação nasce da leitura da IA e nem sempre sai com as palavras dela. Sem
       * poder corrigir o texto, a alternativa é apagar e recriar — o que perde a
       * ordem e o vínculo com o objetivo. Só o título muda aqui: `done`, `order`
       * e o progresso ficam exatamente como estavam.
       */
      updateSubGoalTitle: async (goalId, subGoalId, title) => {
        const clean = title.trim();
        if (!clean) return;
        const goal = state.goals.find((item) => item.id === goalId);
        if (!goal) return;

        await api.patch(`/objectives/${goalId}/actions/${subGoalId}`, {
          expectedVersion: goal.pathVersion ?? 1,
          title: clean,
        });
        await refreshData();
      },
      toggleSubGoal: async (goalId, subGoalId) => {
        // localDate no fuso da pessoa: sem isso a sequência usaria a data do
        // servidor e quem conclui às 22h no Brasil teria a ação contada amanhã.
        const result = await api.post(
          `/objectives/${goalId}/subgoals/${subGoalId}/complete`,
          { localDate: getLocalDateKey() },
        ) as GoalActionCompletion;
        await refreshData();
        if (result?.completedNow) {
          window.dispatchEvent(new CustomEvent(PROGRESS_UPDATED_EVENT));
        }
        return result;
      },
      removeGoal: async (goalId) => {
        await api.delete(`/objectives/${goalId}`);
        await refreshData();
      },
      updateGoal: async (goalId, updates) => {
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;
        if (updates.title !== undefined) await api.patch(`/objectives/${goalId}`, { title: updates.title });
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
        const resultRecord = asRecord(result);
        const savedBlocks = resultRecord && Array.isArray(resultRecord.savedBlocks)
          ? resultRecord.savedBlocks as ApiSavedTimelineBlock[]
          : [];
        const savedBlock = savedBlocks[0] ?? null;
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

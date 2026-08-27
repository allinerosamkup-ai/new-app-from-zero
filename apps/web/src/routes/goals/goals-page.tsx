import { FEATURES } from "../../config/features";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePause,
  Plus,
  Target,
} from "lucide-react";

import { useToast } from "../../components/Toast";
import { RewardBurst, type Reward } from "../../components/RewardBurst";
import { AiriaMascot } from "../../components/airia/AiriaMascot";
import { computeMoodCycle } from "../../utils/mood-cycle-engine";
import { GoalActionRecoveryError, useAuraStore } from "../../features/aura/store";
import { useLocalizedCopy } from "../../i18n";
import { api, ApiRequestError } from "../../lib/api";
import { trackProductEvent } from "../../lib/track";
import { useAiriaReading } from "../../lib/airia-reading";
import { SafetyProtocolCard } from "../../components/aura/SafetyProtocolCard";
import { buildGoalNotePatch } from "../../utils/goal-workspace";
import "../../styles/aura.css";
import "../../styles/editorial.css";
import { cardStyle, quietButtonStyle, type GoalLike } from "./goal-model";
import { GoalCard } from "./goal-card";
import { CreationSheet } from "./creation-sheet";
import { GoalRecoveryNotice, recoverGoalActionsOnce } from "./goal-recovery";

export { GoalRecoveryNotice, recoverGoalActionsOnce } from "./goal-recovery";

export function GoalsPage() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    state,
    refreshObjectives,
    toggleSubGoal,
    removeGoal,
    updateGoal,
    recoverGoalActions,
  } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const { reading: canonicalReading } = useAiriaReading();

  const [creationOpen, setCreationOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [pausedOpen, setPausedOpen] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | number | null>(null);
  const [completingActionId, setCompletingActionId] = useState<string | number | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const recoveryGuardRef = useRef<{ status: 'idle' | 'inFlight' | 'completed' }>({ status: 'idle' });
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveringGoals, setRecoveringGoals] = useState(false);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string[]>>({});

  const focusedGoalId = (location.state as { openGoalId?: string | number } | null)?.openGoalId;
  const goals = state.goals as unknown as GoalLike[];
  const goalsOpenedRef = useRef(false);

  useEffect(() => {
    if (goalsOpenedRef.current) return;
    goalsOpenedRef.current = true;
    trackProductEvent("goals.opened.v1", "goals", {
      activeGoalsCount: goals.filter((goal) => goal.completedPct < 100 && !goal.pausedAt).length,
    });
  }, [goals]);

  useEffect(() => {
    if (!goals.some((goal) => goal.pathStatus === 'generating')) return;
    let stopped = false;
    let inFlight = false;
    const refreshWhenReady = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        await refreshObjectives();
      } finally {
        inFlight = false;
      }
    };
    void refreshWhenReady();
    const timer = window.setInterval(() => { void refreshWhenReady(); }, 1800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [goals, refreshObjectives]);

  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);
  const activeGoals = useMemo(() => goals.filter((goal) => goal.completedPct < 100 && !goal.pausedAt), [goals]);
  const pausedGoals = useMemo(() => goals.filter((goal) => goal.completedPct < 100 && Boolean(goal.pausedAt)), [goals]);
  const completedGoals = useMemo(() => goals.filter((goal) => goal.completedPct >= 100), [goals]);

  async function executeGoalRecovery() {
    await recoverGoalActionsOnce(recoveryGuardRef.current, async () => {
      setRecoveringGoals(true);
      setRecoveryError(null);
      try {
        await recoverGoalActions();
      } catch (error) {
        const message = error instanceof GoalActionRecoveryError
          ? l(
              `Ainda faltam microa\u00e7\u00f5es em ${error.result.eligible - error.result.recovered} objetivo(s). Tente novamente para continuar.`,
              `${error.result.eligible - error.result.recovered} goal(s) still need micro-actions. Try again to continue.`,
            )
          : error instanceof Error
            ? error.message
            : l('N\u00e3o foi poss\u00edvel atualizar os passos dos objetivos antigos agora.', 'Could not update older goal actions right now.');
        setRecoveryError(message);
        showError(message);
        throw error;
      } finally {
        setRecoveringGoals(false);
      }
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void executeGoalRecovery().catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!focusedGoalId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`goal-${focusedGoalId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusedGoalId]);

  async function createGoal(result: string, deadline: string | null) {
    setCreating(true);
    try {
      const objective = await api.post('/objectives', {
        title: result,
        category: 'geral',
        deadline,
        locale: navigator.language || 'pt-BR',
      }) as GoalLike;
      await refreshObjectives();
      setCreationOpen(false);
      trackProductEvent("goal.created.v1", "goals", {
        goalId: String(objective.id),
        creationMode: "manual",
        hasDeadline: Boolean(deadline),
      });
      showSuccess(l('Objetivo criado.', 'Goal created.'));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("N\u00e3o foi poss\u00edvel criar o objetivo.", "Could not create the goal."));
    } finally {
      setCreating(false);
    }
  }

  async function requestSuggestion(goal: GoalLike) {
    setLoadingSuggestion(goal.id);
    try {
      const response = await api.post(`/objectives/${goal.id}/path/generate`, {
        locale: navigator.language || 'pt-BR',
        userStatements: [],
      }) as { status: string };
      await refreshObjectives();
      if (response.status === 'ready') showSuccess(l('O caminho foi atualizado.', 'The path was updated.'));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("N\u00e3o foi poss\u00edvel gerar op\u00e7\u00f5es agora.", "Could not generate options right now."));
    } finally {
      setLoadingSuggestion(null);
    }
  }

  async function addAction(goalId: string | number, action: { title: string; doneWhen: string }) {
    const goal = goals.find((item) => String(item.id) === String(goalId));
    if (!goal) return;
    try {
      await api.post(`/objectives/${goalId}/actions`, { ...action, expectedVersion: goal.pathVersion ?? 1 });
      await refreshObjectives();
      trackProductEvent("goal.action_changed.v1", "goals", {
        goalId: String(goalId),
        actionId: "created",
        changeType: "created",
      });
      setSuggestionDrafts((current) => ({ ...current, [String(goalId)]: [] }));
      showSuccess(l("Pr\u00f3xima a\u00e7\u00e3o adicionada.", "Next action added."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("N\u00e3o foi poss\u00edvel adicionar a a\u00e7\u00e3o.", "Could not add the action."));
    }
  }

  async function togglePaused(goalId: string | number) {
    const goal = goals.find((item) => String(item.id) === String(goalId));
    if (!goal) return;
    await api.patch(`/objectives/${goalId}`, { pausedAt: goal.pausedAt ? null : new Date().toISOString() });
    await refreshObjectives();
  }

  async function archiveGoal(goal: GoalLike) {
    const confirmed = window.confirm(l(`Arquivar \u201c${goal.title}\u201d?`, `Archive \u201c${goal.title}\u201d?`));
    if (!confirmed) return;
    try {
      await api.patch(`/objectives/${goal.id}`, { archived: true });
      await refreshObjectives();
      showSuccess(l("Objetivo arquivado.", "Goal archived."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("N\u00e3o foi poss\u00edvel arquivar.", "Could not archive."));
    }
  }

  async function deleteGoal(goal: GoalLike) {
    const confirmed = window.confirm(l(`Excluir \u201c${goal.title}\u201d definitivamente?`, `Delete \u201c${goal.title}\u201d permanently?`));
    if (!confirmed) return;
    try {
      await removeGoal(goal.id);
      showSuccess(l("Objetivo exclu\u00eddo.", "Goal deleted."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("N\u00e3o foi poss\u00edvel excluir o objetivo.", "Could not delete the goal."));
    }
  }

  const renderGoal = (goal: GoalLike) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      paused={Boolean(goal.pausedAt)}
      focused={focusedGoalId != null && String(focusedGoalId) === String(goal.id)}
      loadingSuggestion={loadingSuggestion === goal.id}
      suggestionDraft={suggestionDrafts[String(goal.id)] ?? []}
      completingActionId={completingActionId}
      onToggleAction={async (actionId) => {
        if (completingActionId !== null) return;
        setCompletingActionId(actionId);
        try {
          const outcome = await toggleSubGoal(goal.id, actionId);
          trackProductEvent("goal.action_changed.v1", "goals", {
            goalId: String(goal.id),
            actionId: String(actionId),
            changeType: "completed",
          });
          if (outcome?.completedNow) {
            setReward(outcome.reward ?? { headline: l("Feito.", "Done."), detail: null, animation: "spark", intensity: "small" });
          }
        } catch (error) {
          if (error instanceof ApiRequestError && error.status === 422) {
            showSuccess(l("Quase l\u00e1 \u2014 ajusta o que falta e marca de novo.", "Almost there \u2014 adjust what is missing and mark it again."));
          } else {
            showError(error instanceof Error ? error.message : l("N\u00e3o foi poss\u00edvel atualizar a a\u00e7\u00e3o.", "Could not update the action."));
          }
        } finally {
          setCompletingActionId(null);
        }
      }}
      onAddAction={(action) => addAction(goal.id, action)}
      onRequestSuggestion={() => requestSuggestion(goal)}
      onAcceptSuggestion={(title) => addAction(goal.id, { title, doneWhen: l('a evid\u00eancia combinada estiver registrada', 'the agreed evidence is recorded') })}
      onUpdateAction={async (actionId, patch) => {
        try {
          await api.patch(`/objectives/${goal.id}/actions/${actionId}`, { expectedVersion: goal.pathVersion ?? 1, ...patch });
          await refreshObjectives();
        } catch (error) {
          showError(error instanceof Error ? error.message : l('N\u00e3o foi poss\u00edvel atualizar a a\u00e7\u00e3o.', 'Could not update the action.'));
        }
      }}
      onAdvance={async () => {
        try {
          await api.post(`/objectives/${goal.id}/path/advance`, { expectedVersion: goal.pathVersion ?? 1, locale: navigator.language || 'pt-BR' });
          await refreshObjectives();
        } catch (error) {
          showError(error instanceof Error ? error.message : l('N\u00e3o foi poss\u00edvel abrir a pr\u00f3xima etapa.', 'Could not open the next stage.'));
        }
      }}
      onConfirmRevision={async () => {
        try {
          await api.post(`/objectives/${goal.id}/path/confirm-revision`, { expectedVersion: goal.pathVersion ?? 1 });
          await refreshObjectives();
        } catch (error) {
          showError(error instanceof Error ? error.message : l('O objetivo mudou; gere uma nova proposta.', 'The goal changed; generate a new proposal.'));
        }
      }}
      onEditResult={async (title) => {
        try {
          await updateGoal(goal.id, { title });
          showSuccess(l("Resultado atualizado.", "Result updated."));
        } catch (error) {
          showError(error instanceof Error ? error.message : l("N\u00e3o foi poss\u00edvel atualizar.", "Could not update."));
        }
      }}
      onPause={() => { void togglePaused(goal.id); }}
      onArchive={() => archiveGoal(goal)}
      onDelete={() => deleteGoal(goal)}
      onEditDeadline={async (deadline) => {
        try {
          await api.patch(`/objectives/${goal.id}`, { deadline });
          await refreshObjectives();
        } catch (error) {
          showError(error instanceof Error ? error.message : l('N\u00e3o foi poss\u00edvel atualizar o prazo.', 'Could not update the deadline.'));
        }
      }}
      onSaveNote={async (note) => {
        try {
          await api.patch(`/objectives/${goal.id}`, buildGoalNotePatch(note));
          await refreshObjectives();
          showSuccess(l("Nota guardada neste objetivo.", "Note saved on this goal."));
        } catch (error) {
          showError(error instanceof Error ? error.message : l("N\u00e3o foi poss\u00edvel guardar a nota.", "Could not save the note."));
        }
      }}
    />
  );

  return (
    <div className="page-shell" style={{ minHeight: "100%", background: "var(--warm-bg)" }}>
      <div className="screen-content" style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 118 }}>
        <SafetyProtocolCard riskSafety={canonicalReading?.riskSafety} surface="goals" />
        <header style={{ padding: "18px 2px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AiriaMascot phase={cycleReport.phase} motion="action" size={56} decorative />
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 5px", color: "var(--lagune)", fontSize: 11, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>{l("Dire\u00e7\u00e3o e movimento", "Direction and movement")}</p>
              <h1 style={{ margin: "0 0 7px", color: "var(--text-1)", fontSize: 28 }}>{l("Objetivos", "Goals")}</h1>
              <p style={{ margin: 0, color: "var(--text-2)", fontSize: 13 }}>{l("Resultados com um pr\u00f3ximo passo poss\u00edvel.", "Results with a possible next step.")}</p>
            </div>
            <button onClick={() => setCreationOpen(true)} style={{ minHeight: 44, border: 0, borderRadius: 14, background: "var(--nectarine)", color: "#fff", padding: "10px 14px", fontWeight: 850 }}>
              <Plus size={17} /> {l("Criar objetivo", "Create goal")}
            </button>
          </div>
        </header>

        {recoveryError && (
          <GoalRecoveryNotice
            message={recoveryError}
            retryLabel={l('Tentar novamente', 'Try again')}
            retrying={recoveringGoals}
            onRetry={() => { void executeGoalRecovery().catch(() => {}); }}
          />
        )}

        <main style={{ display: "grid", gap: 12 }}>
          {activeGoals.length === 0 ? (
            <section style={{ ...cardStyle, padding: "24px 18px", textAlign: "center" }}>
              <Target size={24} color="var(--nectarine)" />
              <h2 style={{ color: "var(--text-1)", fontSize: 18 }}>{l("Escolha algo que merece virar realidade", "Choose something worth making real")}</h2>
              <button onClick={() => setCreationOpen(true)} style={{ ...quietButtonStyle, background: "var(--nectarine)", color: "#fff" }}>
                <Plus size={16} /> {l("Criar meu primeiro objetivo", "Create my first goal")}
              </button>
            </section>
          ) : activeGoals.map(renderGoal)}
        </main>

        {pausedGoals.length > 0 && (
          <section style={{ marginTop: 18 }}>
            <button onClick={() => setPausedOpen((value) => !value)} style={{ ...quietButtonStyle, width: "100%" }}>
              <CirclePause size={16} /> {l("Objetivos pausados", "Paused goals")} \u00b7 {pausedGoals.length}
              {pausedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {pausedOpen && <div style={{ display: "grid", gap: 12, marginTop: 8 }}>{pausedGoals.map(renderGoal)}</div>}
          </section>
        )}

        {completedGoals.length > 0 && (
          <section style={{ marginTop: 12 }}>
            <button onClick={() => setCompletedOpen((value) => !value)} style={{ ...quietButtonStyle, width: "100%" }}>
              <CheckCircle2 size={16} /> {l("Resultados alcan\u00e7ados", "Achieved results")} \u00b7 {completedGoals.length}
              {completedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {completedOpen && <div style={{ display: "grid", gap: 12, marginTop: 8 }}>{completedGoals.map(renderGoal)}</div>}
          </section>
        )}

        {FEATURES.planner && activeGoals.length > 0 && (
          <button onClick={() => navigate("/planner")} style={{ ...quietButtonStyle, width: "100%", marginTop: 18 }}>
            {l("Ver as a\u00e7\u00f5es que j\u00e1 est\u00e3o no meu dia", "See actions already in my day")} <ArrowRight size={15} />
          </button>
        )}
      </div>
      <CreationSheet open={creationOpen} saving={creating} onClose={() => !creating && setCreationOpen(false)} onCreate={createGoal} />
      <RewardBurst reward={reward} onDone={() => setReward(null)} />
    </div>
  );
}

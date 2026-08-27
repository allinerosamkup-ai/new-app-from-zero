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
import { useAuraStore } from "../../features/aura/store";
import { useLocalizedCopy } from "../../i18n";
import { api, ApiRequestError } from "../../lib/api";
import { trackProductEvent } from "../../lib/track";
import { useAiriaReading } from "../../lib/airia-reading";
import { SafetyProtocolCard } from "../../components/aura/SafetyProtocolCard";
import { buildGoalCardModel } from "../../utils/goal-priority-actions";
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
  const recoveryGuardRef = useRef<{ status: "idle" | "inFlight" | "completed" }>({ status: "idle" });
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveringGoals, setRecoveringGoals] = useState(false);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string[]>>({});

  const focusedGoalId = (location.state as { openGoalId?: string | number } | null)?.openGoalId;
  const goals = state.goals as unknown as GoalLike[];

  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);
  const activeGoals = useMemo(() => goals.filter((goal) => goal.completedPct < 100 && !goal.pausedAt), [goals]);
  const pausedGoals = useMemo(() => goals.filter((goal) => goal.completedPct < 100 && Boolean(goal.pausedAt)), [goals]);
  const completedGoals = useMemo(() => goals.filter((goal) => goal.completedPct >= 100), [goals]);
  const goalsWithAction = activeGoals.filter((goal) => buildGoalCardModel(goal).nextAction).length;

  useEffect(() => {
    if (!goals.some((goal) => goal.pathStatus === "generating")) return;
    let stopped = false;
    const timer = window.setInterval(() => {
      if (!stopped) void refreshObjectives();
    }, 1800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [goals, refreshObjectives]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void recoverGoalActionsOnce(recoveryGuardRef.current, async () => {
        setRecoveringGoals(true);
        setRecoveryError(null);
        try {
          await recoverGoalActions();
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : l("Não foi possível atualizar os passos dos objetivos antigos agora.", "Could not update older goal actions right now.");
          setRecoveryError(message);
          showError(message);
          throw error;
        } finally {
          setRecoveringGoals(false);
        }
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  async function createGoal(result: string, deadline: string | null) {
    setCreating(true);
    try {
      const objective = await api.post("/objectives", {
        title: result,
        category: "geral",
        deadline,
        locale: navigator.language || "pt-BR",
      }) as GoalLike;
      await refreshObjectives();
      setCreationOpen(false);
      trackProductEvent("goal.created.v1", "goals", {
        goalId: String(objective.id),
        creationMode: "manual",
        hasDeadline: Boolean(deadline),
      });
      showSuccess(l("Objetivo criado.", "Goal created."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível criar o objetivo.", "Could not create the goal."));
    } finally {
      setCreating(false);
    }
  }

  async function requestSuggestion(goal: GoalLike) {
    setLoadingSuggestion(goal.id);
    try {
      const response = await api.post(`/objectives/${goal.id}/path/generate`, {
        locale: navigator.language || "pt-BR",
        userStatements: [],
      }) as { status: string };
      await refreshObjectives();
      if (response.status === "ready") showSuccess(l("O caminho foi atualizado.", "The path was updated."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível gerar opções agora.", "Could not generate options right now."));
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
      setSuggestionDrafts((current) => ({ ...current, [String(goalId)]: [] }));
      showSuccess(l("Próxima ação adicionada.", "Next action added."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível adicionar a ação.", "Could not add the action."));
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
          if (outcome?.completedNow) {
            setReward(outcome.reward ?? { headline: l("Feito.", "Done."), detail: null, animation: "spark", intensity: "small" });
          }
        } catch (error) {
          if (error instanceof ApiRequestError && error.status === 422) {
            showSuccess(l("Quase lá — ajusta o que falta e marca de novo.", "Almost there — adjust what is missing and mark it again."));
          } else {
            showError(error instanceof Error ? error.message : l("Não foi possível atualizar a ação.", "Could not update the action."));
          }
        } finally {
          setCompletingActionId(null);
        }
      }}
      onAddAction={(action) => addAction(goal.id, action)}
      onRequestSuggestion={() => requestSuggestion(goal)}
      onAcceptSuggestion={(title) => addAction(goal.id, { title, doneWhen: l("a evidência combinada estiver registrada", "the agreed evidence is recorded") })}
      onSaveNote={async (note) => {
        try {
          await api.patch(`/objectives/${goal.id}`, buildGoalNotePatch(note));
          await refreshObjectives();
          showSuccess(l("Nota guardada neste objetivo.", "Note saved on this goal."));
        } catch (error) {
          showError(error instanceof Error ? error.message : l("Não foi possível guardar a nota.", "Could not save the note."));
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
              <p style={{ margin: "0 0 5px", color: "var(--lagune)", fontSize: 11, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>{l("Direção e movimento", "Direction and movement")}</p>
              <h1 style={{ margin: "0 0 7px", color: "var(--text-1)", fontSize: 28 }}>{l("Objetivos", "Goals")}</h1>
              <p style={{ margin: 0, color: "var(--text-2)", fontSize: 13 }}>{l("Resultados com um próximo passo possível.", "Results with a possible next step.")}</p>
            </div>
            <button onClick={() => setCreationOpen(true)} style={{ minHeight: 44, border: 0, borderRadius: 14, background: "var(--nectarine)", color: "#fff", padding: "10px 14px", fontWeight: 850 }}>
              <Plus size={17} /> {l("Criar objetivo", "Create goal")}
            </button>
          </div>
        </header>

        {activeGoals.length > 0 && (
          <section style={{ ...cardStyle, marginBottom: 14, padding: "14px 15px" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 820 }}>
              {goalsWithAction === activeGoals.length
                ? l("Todos os objetivos têm um próximo passo", "Every goal has a next step")
                : l(`${goalsWithAction} de ${activeGoals.length} objetivos têm um próximo passo`, `${goalsWithAction} of ${activeGoals.length} goals have a next step`)}
            </p>
          </section>
        )}

        {recoveryError && (
          <GoalRecoveryNotice
            message={recoveryError}
            retryLabel={l("Tentar novamente", "Try again")}
            retrying={recoveringGoals}
            onRetry={() => { void recoverGoalActions().catch(() => {}); }}
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
              <CirclePause size={16} /> {l("Objetivos pausados", "Paused goals")} · {pausedGoals.length}
              {pausedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {pausedOpen && <div style={{ display: "grid", gap: 12, marginTop: 8 }}>{pausedGoals.map(renderGoal)}</div>}
          </section>
        )}

        {completedGoals.length > 0 && (
          <section style={{ marginTop: 12 }}>
            <button onClick={() => setCompletedOpen((value) => !value)} style={{ ...quietButtonStyle, width: "100%" }}>
              <CheckCircle2 size={16} /> {l("Resultados alcançados", "Achieved results")} · {completedGoals.length}
              {completedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {completedOpen && <div style={{ display: "grid", gap: 12, marginTop: 8 }}>{completedGoals.map(renderGoal)}</div>}
          </section>
        )}

        {FEATURES.planner && activeGoals.length > 0 && (
          <button onClick={() => navigate("/planner")} style={{ ...quietButtonStyle, width: "100%", marginTop: 18 }}>
            {l("Ver as ações que já estão no meu dia", "See actions already in my day")} <ArrowRight size={15} />
          </button>
        )}
      </div>
      <CreationSheet open={creationOpen} saving={creating} onClose={() => !creating && setCreationOpen(false)} onCreate={createGoal} />
      <RewardBurst reward={reward} onDone={() => setReward(null)} />
    </div>
  );
}

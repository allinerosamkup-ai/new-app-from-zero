import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, RefreshCw, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuraStore } from "../../features/aura/store";
import type { Goal } from "../../features/aura/types";
import { useLocalizedCopy } from "../../i18n";
import { api } from "../../lib/api";
import type { AiriaCapacity } from "../../lib/airia-reading";
import { tapHaptic } from "../../utils/haptics";

type DailyAction = {
  objectiveId: string;
  objectiveTitle: string;
  actionId: string;
  actionTitle: string;
  reason: string;
  urgency?: "low" | "medium" | "high";
  importance?: "low" | "medium" | "high";
};

type DailyPriorities = {
  status: "ready" | "retrying";
  priorities: DailyAction[];
};

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function actionLimit(capacity?: AiriaCapacity | null) {
  if (capacity?.size === "quick") return 1;
  if (capacity?.size === "heavy") return 3;
  return 2;
}

/**
 * O planejamento do dia é composto de ações já existentes nos objetivos.
 * O check-in apenas regula o número de ações visíveis; ele não inventa uma
 * tarefa nem substitui a direção escolhida pela pessoa.
 */
export function TodayGoalActionsCard({ capacity }: { capacity?: AiriaCapacity | null }) {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state, toggleSubGoal } = useAuraStore();
  const [priorities, setPriorities] = useState<DailyPriorities | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [completing, setCompleting] = useState<string | null>(null);
  const goalVersionKey = useMemo(
    () => (state.goals ?? []).map((goal: Goal) => `${goal.id}:${goal.pathVersion ?? 1}:${goal.completedPct ?? 0}`).join("|"),
    [state.goals],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/daily-priorities?localDate=${localDateKey()}`)
      .then((response) => { if (active) setPriorities(response as DailyPriorities); })
      .catch(() => { if (active) setPriorities(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [goalVersionKey]);

  const ranked = priorities?.priorities ?? [];
  const limit = actionLimit(capacity);
  const start = ranked.length > limit ? offset % ranked.length : 0;
  const actions = ranked.length > limit
    ? Array.from({ length: limit }, (_, index) => ranked[(start + index) % ranked.length])
    : ranked.slice(0, limit);
  const hasGoals = (state.goals ?? []).some((goal) => (goal.completedPct ?? 0) < 100);

  async function complete(action: DailyAction) {
    if (completing) return;
    tapHaptic();
    setCompleting(action.actionId);
    try {
      await toggleSubGoal(action.objectiveId, action.actionId);
    } finally {
      setCompleting(null);
    }
  }

  return (
    <section className="today-goal-actions" aria-busy={loading}>
      <header className="today-goal-actions__header">
        <div>
          <p className="today-goal-actions__eyebrow">{l("O que cabe hoje", "What fits today")}</p>
          <h2 className="today-goal-actions__title">{l("Ações dos seus objetivos", "Actions from your goals")}</h2>
        </div>
        {ranked.length > limit && (
          <button type="button" className="today-goal-actions__refresh" onClick={() => setOffset((current) => current + limit)}>
            <RefreshCw size={14} /> {l("Trocar", "Swap")}
          </button>
        )}
      </header>

      {capacity?.size === "quick" && (
        <p className="today-goal-actions__context">{l("Separei um passo curto para preservar seu ritmo hoje.", "I picked one short step to protect your pace today.")}</p>
      )}

      {!loading && !hasGoals && (
        <div className="today-goal-actions__empty">
          <Target size={17} />
          <p>{l("Quando você tiver um objetivo ativo, organizo aqui o próximo passo possível.", "When you have an active goal, I’ll organize its next possible step here.")}</p>
          <button type="button" onClick={() => navigate("/goals")}>{l("Criar objetivo", "Create goal")} <ArrowRight size={15} /></button>
        </div>
      )}

      {!loading && hasGoals && actions.length === 0 && (
        <div className="today-goal-actions__empty">
          <Target size={17} />
          <p>{l("Seus objetivos precisam de um próximo passo definido para eu organizar o dia.", "Your goals need a next step before I can organize the day.")}</p>
          <button type="button" onClick={() => navigate("/goals")}>{l("Definir próximo passo", "Define next step")} <ArrowRight size={15} /></button>
        </div>
      )}

      {loading && <p className="today-goal-actions__loading">{l("Organizando os próximos passos dos seus objetivos…", "Organizing the next steps from your goals…")}</p>}

      {actions.length > 0 && (
        <div className="today-goal-actions__list">
          {actions.map((action) => (
            <article className="today-goal-actions__item" key={`${action.objectiveId}:${action.actionId}`}>
              <button
                type="button"
                className="today-goal-actions__open"
                onClick={() => navigate("/goals", { state: { objectiveId: action.objectiveId, actionId: action.actionId } })}
              >
                <span className="today-goal-actions__goal">{action.objectiveTitle}</span>
                <strong>{action.actionTitle}</strong>
                {action.reason && <span className="today-goal-actions__reason">{action.reason}</span>}
              </button>
              <button
                type="button"
                aria-label={l(`Concluir ${action.actionTitle}`, `Complete ${action.actionTitle}`)}
                className="today-goal-actions__complete"
                disabled={Boolean(completing)}
                onClick={() => void complete(action)}
              >
                <Check size={15} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

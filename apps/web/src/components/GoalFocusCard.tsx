import { useState } from "react";
import { ArrowRight, Check, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useLocalizedCopy } from "../i18n";
import { useAuraStore } from "../features/aura/store";
import { RewardBurst, type Reward } from "./RewardBurst";
import { parsePausedGoalIds, selectFocusGoal } from "../utils/goal-priority-actions";

/**
 * O objetivo em foco e os demais, no lugar onde antes ficava a agenda do dia.
 *
 * A pergunta que a Home responde mudou: era "o que tenho hoje" e virou "o que
 * eu faço agora". Por isso o card grande mostra UMA ação — a próxima da fila do
 * objetivo mais adiantado — com o botão de concluir ali mesmo, sem passar pela
 * página de objetivos.
 *
 * Nenhuma busca nova acontece aqui: os objetivos já vêm hidratados no store.
 */

const PAUSED_GOALS_KEY = "airia-paused-goals-v1";

function readPausedIds(): string[] {
  try {
    return parsePausedGoalIds(localStorage.getItem(PAUSED_GOALS_KEY));
  } catch {
    return [];
  }
}

export function GoalFocusCard() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state, toggleSubGoal } = useAuraStore();
  const [completingId, setCompletingId] = useState<string | number | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);

  const { focus, others } = selectFocusGoal(state.goals ?? [], { pausedIds: readPausedIds() });

  // Sem objetivo nenhum a Home não mostra caixa vazia: mostra o convite para
  // criar o primeiro, com destino real (botão que não faz nada é reprovado
  // pelos guardrails de produto, e com razão).
  if (!focus && others.length === 0) {
    return (
      <section style={cardStyle}>
        <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Target size={16} color="var(--accent-peach-ink)" aria-hidden="true" />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-1)" }}>
            {l("Seus objetivos", "Your goals")}
          </h2>
        </header>
        <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, color: "var(--text-2)" }}>
          {l(
            "Um objetivo aqui vira uma sequência de passos pequenos, e o app mostra só o próximo.",
            "A goal here becomes a sequence of small steps, and the app shows only the next one.",
          )}
        </p>
        <button type="button" onClick={() => navigate("/goals")} style={primaryButtonStyle}>
          {l("Criar meu primeiro objetivo", "Create my first goal")}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>
    );
  }

  async function completeFocusAction() {
    if (!focus?.nextAction || completingId !== null) return;
    setCompletingId(focus.nextAction.id);
    try {
      const outcome = await toggleSubGoal(focus.id, focus.nextAction.id);
      if (outcome?.completedNow && outcome.reward) {
        setReward(outcome.reward as Reward);
      }
    } catch {
      // O backend recusa conclusão fora de ordem com 409. Isso não é erro da
      // pessoa — é corrida de toque duplo — então não vira alerta na tela.
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <>
      {focus && (
        <section style={cardStyle}>
          <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Target size={16} color="var(--accent-peach-ink)" aria-hidden="true" />
            <span style={eyebrowStyle}>{l("Objetivo em foco", "Goal in focus")}</span>
          </header>

          <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, lineHeight: 1.25, color: "var(--text-1)" }}>
            {focus.result}
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
            {focus.completedActions}/{focus.totalActions} {l("ações", "actions")}
          </p>

          <ProgressBar completed={focus.completedActions} total={focus.totalActions} />

          {focus.nextAction && (
            <div style={{ marginTop: 16 }}>
              <p style={{ ...eyebrowStyle, margin: "0 0 6px" }}>{l("Próxima ação", "Next action")}</p>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: "var(--text-1)" }}>
                {focus.nextAction.title}
              </p>
              <button
                type="button"
                onClick={completeFocusAction}
                disabled={completingId !== null}
                style={{ ...primaryButtonStyle, opacity: completingId !== null ? 0.6 : 1 }}
              >
                <Check size={16} aria-hidden="true" />
                {completingId !== null ? l("Registrando...", "Saving...") : l("Concluir", "Complete")}
              </button>
            </div>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section style={{ ...cardStyle, marginTop: 12 }}>
          <p style={{ ...eyebrowStyle, margin: "0 0 10px" }}>
            {l("Outros objetivos", "Other goals")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {others.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => navigate("/goals", { state: { openGoalId: model.id } })}
                style={rowStyle}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {model.result}
                  </span>
                  <ProgressBar completed={model.completedActions} total={model.totalActions} compact />
                </span>
                <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {model.completedActions}/{model.totalActions}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <RewardBurst reward={reward} onDone={() => setReward(null)} />
    </>
  );
}

function ProgressBar({ completed, total, compact }: { completed: number; total: number; compact?: boolean }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: compact ? 4 : 6,
        marginTop: compact ? 6 : 0,
        borderRadius: 999,
        background: "rgba(169,210,187,.20)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          borderRadius: 999,
          background: "var(--accent-primary-strong, #8FC0A4)",
          transition: "width 420ms cubic-bezier(.16,1,.3,1)",
        }}
      />
    </div>
  );
}

const cardStyle = {
  padding: "16px 16px 18px",
  borderRadius: 22,
  background: "rgba(255,255,255,.72)",
  border: "1px solid rgba(255,255,255,.84)",
  boxShadow: "0 12px 28px rgba(169,210,187,.08)",
} as const;

const eyebrowStyle = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--text-3)",
} as const;

const primaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  width: "100%",
  minHeight: 46,
  borderRadius: 999,
  border: 0,
  background: "var(--accent-primary-strong, #8FC0A4)",
  color: "#2C5340",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  minHeight: 44,
  padding: "8px 12px",
  borderRadius: 14,
  border: "1px solid rgba(17,24,39,.06)",
  background: "rgba(255,255,255,.6)",
  cursor: "pointer",
  textAlign: "left",
} as const;

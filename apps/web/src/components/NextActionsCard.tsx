import { useEffect, useState } from "react";
import { Check, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useLocalizedCopy } from "../i18n";
import { useAuraStore } from "../features/aura/store";
import {
  buildNextActions,
  markStoredGtdActionDone,
  readStoredGtdActions,
  type GoalPriorityAction,
} from "../utils/goal-priority-actions";

/**
 * Próximas ações — o que fazer agora, sem data nenhuma.
 *
 * Substituiu "Tarefas sugeridas", que vinha do fluxo do Planner e prendia tudo
 * a horário. Aqui a regra é conclusão: a ação fica na caixa até ser concluída,
 * e nada some porque "passou do dia".
 *
 * A lista combina o próximo passo de cada objetivo com os itens do Inbox, e
 * passa por dedupe semântico — a mesma ação escrita de dois jeitos aparece uma
 * vez só.
 */

const INBOX_UPDATED_EVENT = "gtd-inbox-updated";

export function NextActionsCard() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state, toggleSubGoal } = useAuraStore();
  const [inboxTick, setInboxTick] = useState(0);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // O Inbox vive no armazenamento local, fora do store. Sem ouvir o evento, um
  // item registrado pelo diário só apareceria no próximo carregamento da tela.
  useEffect(() => {
    const bump = () => setInboxTick((tick) => tick + 1);
    window.addEventListener(INBOX_UPDATED_EVENT, bump);
    return () => window.removeEventListener(INBOX_UPDATED_EVENT, bump);
  }, []);

  const actions = buildNextActions(state.goals ?? [], {
    // inboxTick força a releitura; o valor em si não é usado.
    gtdItems: inboxTick >= 0 ? readStoredGtdActions() : undefined,
  });

  if (actions.length === 0) return null;

  async function complete(action: GoalPriorityAction) {
    if (completingId) return;
    setCompletingId(action.id);
    try {
      if (action.source === "goal" && action.goalId !== undefined && action.subId !== undefined) {
        await toggleSubGoal(action.goalId, action.subId);
      } else if (action.gtdId) {
        markStoredGtdActionDone(action.gtdId);
        setInboxTick((tick) => tick + 1);
      }
    } catch {
      // Conclusão fora de ordem é recusada pelo backend com 409. Não é erro da
      // pessoa — é toque duplo — e não vira alerta na tela.
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <section
      style={{
        padding: "16px 16px 18px",
        borderRadius: 22,
        background: "rgba(255,255,255,.72)",
        border: "1px solid rgba(255,255,255,.84)",
        boxShadow: "0 12px 28px rgba(169,210,187,.08)",
        marginBottom: 12,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <ListChecks size={16} color="var(--accent-peach-ink)" aria-hidden="true" />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-1)" }}>
          {l("Próximas ações", "Next actions")}
        </h2>
      </header>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--text-3)" }}>
        {l("Ficam aqui até você concluir. Sem prazo.", "They stay here until you complete them. No deadline.")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actions.map((action) => (
          <div
            key={action.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 44,
              padding: "8px 12px",
              borderRadius: 14,
              border: "1px solid rgba(17,24,39,.06)",
              background: "rgba(255,255,255,.6)",
            }}
          >
            <button
              type="button"
              aria-label={l(`Concluir: ${action.text}`, `Complete: ${action.text}`)}
              onClick={() => complete(action)}
              disabled={completingId !== null}
              style={{
                width: 26,
                height: 26,
                flexShrink: 0,
                borderRadius: "50%",
                border: "1.5px solid var(--accent-primary-strong, #8FC0A4)",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: completingId ? "wait" : "pointer",
                opacity: completingId === action.id ? 0.5 : 1,
                padding: 0,
              }}
            >
              <Check size={14} color="var(--accent-primary-strong, #8FC0A4)" aria-hidden="true" />
            </button>

            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.35 }}>
                {action.text}
              </span>
              {action.goalTitle && (
                <span style={{ display: "block", fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                  {action.goalTitle}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate("/goals")}
        style={{
          marginTop: 12,
          width: "100%",
          minHeight: 40,
          borderRadius: 999,
          border: "1px solid rgba(17,24,39,.08)",
          background: "transparent",
          color: "var(--text-2)",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {l("Ver todos os objetivos", "See all goals")}
      </button>
    </section>
  );
}

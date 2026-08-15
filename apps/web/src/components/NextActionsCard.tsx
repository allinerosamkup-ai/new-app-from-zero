import { useState } from "react";
import { Check, ListChecks, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useLocalizedCopy } from "../i18n";
import { useAuraStore } from "../features/aura/store";
import { useFocusGoal } from "../features/aura/use-focus-goal";
import {
  buildNextActions,
  type GoalPriorityAction,
} from "../utils/goal-priority-actions";
import { tapHaptic } from "../utils/haptics";

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

export function NextActionsCard() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state, toggleSubGoal, updateSubGoalTitle } = useAuraStore();
  const [completingId, setCompletingId] = useState<string | null>(null);
  // Ação em edição e o texto sendo digitado. A ação nasce da leitura da IA e nem
  // sempre sai com as palavras dela; sem poder corrigir, a saída seria apagar e
  // recriar, perdendo ordem e vínculo com o objetivo.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // A primeira ação do objetivo principal já está no card acima. Passar o id do
  // foco faz esta lista mostrar a SEGUINTE dele, em vez de repetir a mesma coisa
  // duas vezes na mesma tela.
  const { focus } = useFocusGoal(state.goals ?? []);
  const actions = buildNextActions(state.goals ?? [], {
    focusGoalId: focus?.id ?? null,
  });

  if (actions.length === 0) return null;

  async function saveEdit(action: GoalPriorityAction) {
    const clean = draft.trim();
    setEditingId(null);
    if (!clean || clean === action.text) return;

    try {
      if (action.source === "goal" && action.goalId !== undefined && action.subId !== undefined) {
        await updateSubGoalTitle(action.goalId, action.subId, clean);
      }
    } catch {
      // Falhou ao gravar: o texto antigo continua na tela, que é a verdade.
    }
  }

  async function complete(action: GoalPriorityAction) {
    if (completingId) return;
    tapHaptic();
    setCompletingId(action.id);
    try {
      if (action.source === "goal" && action.goalId !== undefined && action.subId !== undefined) {
        await toggleSubGoal(action.goalId, action.subId);
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
              {editingId === action.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => { void saveEdit(action); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); void saveEdit(action); }
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  maxLength={140}
                  aria-label={l("Editar a ação", "Edit the action")}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-1)",
                    padding: "4px 8px",
                    borderRadius: 9,
                    border: "1.5px solid var(--accent-primary-strong, #8FC0A4)",
                    background: "#fff",
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.35 }}>
                  {action.text}
                </span>
              )}
              {action.goalTitle && editingId !== action.id && (
                <span style={{ display: "block", fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                  {action.goalTitle}
                </span>
              )}
            </span>

            {editingId !== action.id && (
              <button
                type="button"
                aria-label={l(`Editar: ${action.text}`, `Edit: ${action.text}`)}
                onClick={() => { tapHaptic(); setDraft(action.text); setEditingId(action.id); }}
                style={{
                  width: 30,
                  height: 30,
                  flexShrink: 0,
                  borderRadius: 9,
                  border: 0,
                  background: "transparent",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            )}
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

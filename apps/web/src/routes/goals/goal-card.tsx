import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { useLocalizedCopy } from "../../i18n";
import { buildGoalCardModel } from "../../utils/goal-priority-actions";
import {
  GOAL_WORKSPACE_PANES,
  buildGoalNotePatch,
  resolveGoalNoteDraft,
  shouldShowGoalPathPane,
  type GoalWorkspacePane,
} from "../../utils/goal-workspace";
import {
  cardStyle,
  quietButtonStyle,
  type GoalLike,
} from "./goal-model";

export function GoalCard({
  goal,
  paused,
  focused,
  loadingSuggestion,
  suggestionDraft,
  completingActionId,
  onToggleAction,
  onAddAction,
  onRequestSuggestion,
  onAcceptSuggestion,
  onSaveNote,
}: {
  goal: GoalLike;
  paused: boolean;
  focused: boolean;
  loadingSuggestion: boolean;
  suggestionDraft: string[];
  completingActionId: string | number | null;
  onToggleAction: (actionId: string | number) => Promise<void>;
  onAddAction: (action: { title: string; doneWhen: string }) => Promise<void>;
  onRequestSuggestion: () => Promise<void>;
  onAcceptSuggestion: (title: string) => Promise<void>;
  onSaveNote: (note: string) => Promise<void>;
}) {
  const l = useLocalizedCopy();
  const model = buildGoalCardModel(goal);
  const [open, setOpen] = useState(focused || !paused);
  const [workspacePane, setWorkspacePane] = useState<GoalWorkspacePane>("agora");
  const [noteDraft, setNoteDraft] = useState(() => resolveGoalNoteDraft(goal));
  const [savingNote, setSavingNote] = useState(false);
  const [addingAction, setAddingAction] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [actionDoneWhen, setActionDoneWhen] = useState("");

  useEffect(() => {
    if (focused) setOpen(true);
  }, [focused]);

  useEffect(() => {
    setNoteDraft(resolveGoalNoteDraft(goal));
  }, [goal.description, goal.progress]);

  const orderedActions = [...goal.subtasks]
    .map((action, index) => ({ action, index }))
    .sort((left, right) => (left.action.order ?? left.index) - (right.action.order ?? right.index) || left.index - right.index)
    .map(({ action }) => action);
  const milestones = [...(goal.milestones ?? [])].sort((left, right) => left.order - right.order);

  return (
    <article id={`goal-${goal.id}`} style={{ ...cardStyle, overflow: "hidden", opacity: paused ? 0.78 : 1 }}>
      <button
        onClick={() => setOpen((value) => !value)}
        style={{ width: "100%", border: 0, background: "transparent", padding: "16px", display: "flex", gap: 12, textAlign: "left", cursor: "pointer" }}
      >
        <span style={{ width: 38, height: 38, borderRadius: 14, flexShrink: 0, background: model.completed ? "rgba(150,199,179,.20)" : "var(--nectarine-a3)", display: "grid", placeItems: "center", color: model.completed ? "var(--menthe)" : "var(--nectarine)" }}>
          {model.completed ? <CheckCircle2 size={19} /> : <Target size={19} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", marginBottom: 4, color: "var(--text-3)", fontSize: 10, fontWeight: 850, letterSpacing: ".09em", textTransform: "uppercase" }}>{l("Seu foco", "Your focus")}</span>
          <span style={{ display: "block", color: "var(--text-1)", fontSize: 16, fontWeight: 820, lineHeight: 1.32 }}>{goal.title}</span>
        </span>
        {open ? <ChevronUp size={18} color="var(--text-3)" /> : <ChevronDown size={18} color="var(--text-3)" />}
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <p style={{ margin: "0 0 5px", color: "var(--text-3)", fontSize: 10, fontWeight: 900, letterSpacing: ".09em", textTransform: "uppercase" }}>{l("Resultado", "Outcome")}</p>
          <p style={{ margin: "0 0 12px", color: "var(--text-1)", fontSize: 14, fontWeight: 750, lineHeight: 1.45 }}>{goal.resultDefinition || goal.title}</p>

          <div role="tablist" aria-label={l("Workspace do objetivo", "Goal workspace")} style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {GOAL_WORKSPACE_PANES.map((pane) => {
              const active = workspacePane === pane.id;
              const disabled = pane.id === "caminho" && !shouldShowGoalPathPane(goal);
              return (
                <button
                  key={pane.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={disabled}
                  onClick={() => setWorkspacePane(pane.id)}
                  style={{
                    flex: 1,
                    minHeight: 36,
                    borderRadius: 11,
                    border: active ? "1px solid rgba(150,199,179,.55)" : "1px solid rgba(54,96,74,.12)",
                    background: active ? "rgba(150,199,179,.18)" : "rgba(255,255,255,.72)",
                    color: disabled ? "var(--text-3)" : "var(--text-1)",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled ? 0.55 : 1,
                  }}
                >
                  {l(pane.pt, pane.en)}
                </button>
              );
            })}
          </div>

          {workspacePane === "nota" && (
            <div style={{ borderRadius: 18, border: "1px solid rgba(99,152,169,.28)", background: "rgba(255,255,255,.84)", padding: 13 }}>
              <p style={{ margin: "0 0 8px", color: "var(--text-3)", fontSize: 10, fontWeight: 900, letterSpacing: ".09em", textTransform: "uppercase" }}>{l("Nota deste objetivo", "Note for this goal")}</p>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                aria-label={l("Nota ligada a este objetivo", "Note attached to this goal")}
                placeholder={l("O que precisa ficar junto desta meta — sem virar outra lista.", "What should stay with this goal — without becoming another list.")}
                rows={5}
                style={{ width: "100%", border: "1px solid rgba(99,152,169,.28)", borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.45, resize: "vertical", boxSizing: "border-box" }}
              />
              <button
                type="button"
                disabled={savingNote || noteDraft.trim() === resolveGoalNoteDraft(goal)}
                onClick={async () => {
                  setSavingNote(true);
                  try {
                    await onSaveNote(buildGoalNotePatch(noteDraft).description);
                  } finally {
                    setSavingNote(false);
                  }
                }}
                style={{ marginTop: 10, minHeight: 40, width: "100%", borderRadius: 12, border: "none", background: "var(--menthe)", color: "#fff", fontWeight: 800 }}
              >
                {savingNote ? l("Salvando…", "Saving…") : l("Guardar nota", "Save note")}
              </button>
            </div>
          )}

          {workspacePane === "agora" && (
            <div style={{ borderRadius: 18, border: "1px solid rgba(150,199,179,.34)", background: "rgba(150,199,179,.10)", padding: 13 }}>
              <p style={{ margin: "0 0 8px", color: "var(--menthe)", fontSize: 10, fontWeight: 900, letterSpacing: ".09em", textTransform: "uppercase" }}>{l("Agora", "Now")}</p>
              {model.nextAction ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <button
                    aria-label={l("Marcar ação como concluída", "Mark action as completed")}
                    disabled={completingActionId !== null}
                    onClick={() => onToggleAction(model.nextAction!.id)}
                    style={{ width: 26, height: 26, borderRadius: 9, border: "1.5px solid var(--menthe)", background: "#fff", color: "var(--menthe)", display: "grid", placeItems: "center", flexShrink: 0 }}
                  >
                    <Check size={15} />
                  </button>
                  <p style={{ margin: 0, color: "var(--text-1)", fontSize: 14, fontWeight: 750, lineHeight: 1.45 }}>{model.nextAction.title}</p>
                </div>
              ) : (
                <>
                  <p style={{ margin: "0 0 11px", color: "var(--text-2)", fontSize: 13, lineHeight: 1.45 }}>
                    {l("Ainda falta escolher uma ação concreta. Você pode escrever a primeira ou pedir ideias à Airia.", "A concrete action still needs to be chosen. You can write the first one or ask Airia for ideas.")}
                  </p>
                  {!addingAction && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => setAddingAction(true)} style={{ ...quietButtonStyle, flex: 1 }}><Plus size={14} /> {l("Definir próxima ação", "Define next action")}</button>
                      <button disabled={loadingSuggestion} onClick={onRequestSuggestion} style={{ ...quietButtonStyle, flex: 1 }}><Sparkles size={14} /> {loadingSuggestion ? l("Pensando…", "Thinking…") : l("Pedir opções à Airia", "Ask Airia for options")}</button>
                    </div>
                  )}
                </>
              )}
              {addingAction && (
                <div style={{ marginTop: 10 }}>
                  <input value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} placeholder={l("Verbo + objeto concreto", "Verb + concrete object")} style={{ width: "100%", minHeight: 44, boxSizing: "border-box", border: "1.5px solid rgba(150,199,179,.55)", borderRadius: 12, padding: "10px 12px" }} />
                  <input value={actionDoneWhen} onChange={(event) => setActionDoneWhen(event.target.value)} placeholder={l("Pronto quando…", "Done when…")} style={{ width: "100%", minHeight: 44, boxSizing: "border-box", marginTop: 8, border: "1.5px solid rgba(150,199,179,.55)", borderRadius: 12, padding: "10px 12px" }} />
                  <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                    <button
                      disabled={actionTitle.trim().length < 3 || actionDoneWhen.trim().length < 3}
                      onClick={async () => {
                        await onAddAction({ title: actionTitle.trim(), doneWhen: actionDoneWhen.trim() });
                        setActionTitle("");
                        setActionDoneWhen("");
                        setAddingAction(false);
                      }}
                      style={{ ...quietButtonStyle, flex: 1, background: "var(--menthe)", borderColor: "var(--menthe)", color: "#fff" }}
                    >
                      {l("Salvar ação", "Save action")}
                    </button>
                    <button onClick={() => setAddingAction(false)} style={quietButtonStyle}>{l("Cancelar", "Cancel")}</button>
                  </div>
                </div>
              )}
              {suggestionDraft.length > 0 && !model.nextAction && (
                <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
                  {suggestionDraft.slice(0, 3).map((suggestion) => (
                    <button key={suggestion} onClick={() => onAcceptSuggestion(suggestion)} style={{ minHeight: 43, borderRadius: 12, border: "1px solid rgba(134,183,154,.30)", background: "#fff", padding: "9px 11px", textAlign: "left", fontSize: 12 }}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {workspacePane === "caminho" && shouldShowGoalPathPane(goal) && (
            <div style={{ display: "grid", gap: 10 }}>
              <p style={{ margin: 0, color: "var(--text-3)", fontSize: 11, fontWeight: 750 }}>{l("Caminho", "Path")} · {model.completedActions}/{model.totalActions}</p>
              {milestones.map((milestone) => (
                <div key={milestone.id} style={{ borderLeft: "2px solid var(--menthe)", padding: "5px 0 5px 10px" }}>
                  <strong style={{ display: "block", color: "var(--text-2)", fontSize: 12 }}>{milestone.title}</strong>
                </div>
              ))}
              {orderedActions.map((action) => (
                <div key={action.id} style={{ display: "flex", gap: 9, color: action.done ? "var(--text-3)" : "var(--text-2)", textDecoration: action.done ? "line-through" : "none", fontSize: 12 }}>
                  <span>{action.done ? "✓" : "○"}</span>
                  <span>{action.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

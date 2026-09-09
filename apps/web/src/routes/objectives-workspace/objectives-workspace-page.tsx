import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { useToast } from "../../components/Toast";
import { useAuraStore } from "../../features/aura/store";
import { useLocalizedCopy } from "../../i18n";
import { api } from "../../lib/api";
import { trackProductEvent } from "../../lib/track";
import { GoalRecoveryNotice, recoverGoalActionsOnce } from "./goal-recovery";
import {
  buildTaskTree,
  isAiBrokenDown,
  pickActiveGoal,
  previewToSubgoals,
  readComposerMode,
  readWideLayout,
  resolveNotes,
  type ComposerMode,
  type PreviewTask,
  type TreeNode,
} from "./helpers";
import { SplitLayout } from "./split-layout";
import "./objectives-workspace.css";

export function GoalsPage() {
  return <ObjectivesWorkspacePage />;
}

type BreakdownResponse = {
  suggestedTitle: string;
  resultDefinition: string | null;
  currentReality: string | null;
  question: string | null;
  milestones: Array<{ id: string; title: string; order: number; doneWhen: string }>;
  tasks: PreviewTask[];
  suggestedSubgoals: ReturnType<typeof previewToSubgoals>;
  conflicts?: Array<{ task: string; reason: string }>;
};

type RescheduleResponse = {
  moves: Array<{ actionId: string; title: string; from: string | null; to: string; objectiveId: string | null }>;
  conflicts: Array<{ actionId: string; reason: string }>;
};

export function ObjectivesWorkspacePage() {
  const l = useLocalizedCopy();
  const location = useLocation();
  const { showError, showSuccess } = useToast();
  const { state, refreshObjectives, toggleSubGoal, recoverGoalActions } = useAuraStore();
  const opened = readComposerMode(location.state);
  const goals = state.goals;
  const activeGoals = useMemo(() => goals.filter((goal) => goal.completedPct < 100 && !goal.pausedAt), [goals]);
  const [selectedId, setSelectedId] = useState<string | number | null>(opened.openGoalId);
  const [wide, setWide] = useState(() => typeof window === "undefined" ? false : readWideLayout(window.matchMedia("(min-width: 768px)")));
  const [composer, setComposer] = useState<ComposerMode>(opened.mode);
  const [draft, setDraft] = useState(opened.noteDraft);
  const [deadline, setDeadline] = useState("");
  const [preview, setPreview] = useState<BreakdownResponse | null>(null);
  const [reschedule, setReschedule] = useState<RescheduleResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [previewIntent, setPreviewIntent] = useState<"create" | "replace" | "expand">("create");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const recoveryGuard = useRef<{ status: "idle" | "inFlight" | "completed" }>({ status: "idle" });
  const openedRef = useRef(false);

  const selected = useMemo(() => pickActiveGoal(activeGoals, selectedId, opened.openGoalId), [activeGoals, selectedId, opened.openGoalId]);
  const tree = selected ? buildTaskTree(selected) : [];
  const notes = selected ? resolveNotes(selected) : [];
  const selectedAction = selected?.subtasks.find((action) => String(action.id) === selectedActionId) ?? null;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(readWideLayout(media));
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    trackProductEvent("goals.opened.v1", "goals", { activeGoalsCount: activeGoals.length });
  }, [activeGoals.length]);

  useEffect(() => {
    if (selected) setSelectedId(selected.id);
  }, [selected]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void recoverGoalActionsOnce(recoveryGuard.current, async () => {
        try {
          await recoverGoalActions();
        } catch (error) {
          setRecoveryError(error instanceof Error ? error.message : l("Nao deu para atualizar os passos agora.", "Could not update the steps right now."));
          throw error;
        }
      }).catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
  }, [l, recoverGoalActions]);

  async function runBreakdown(title: string, extra?: { note?: string; objectiveId?: string; intent?: "create" | "replace" | "expand" }) {
    setPreviewIntent(extra?.intent ?? "create");
    setBusy("preview");
    try {
      const response = await api.post("/objectives/preview-breakdown", {
        title,
        note: extra?.note,
        objectiveId: extra?.objectiveId,
        locale: navigator.language || "pt-BR",
      }) as BreakdownResponse;
      setPreview(response);
    } catch (error) {
      showError(error instanceof Error ? error.message : l("A IA nao respondeu. Dá para criar na mao.", "AI did not answer. You can create it by hand."));
      setComposer("manual");
    } finally {
      setBusy(null);
    }
  }

  async function confirmCreate() {
    if (!preview) return;
    setBusy("save");
    try {
      const created = await api.post("/objectives", {
        title: preview.suggestedTitle || draft,
        deadline: deadline || null,
        locale: navigator.language || "pt-BR",
        resultDefinition: preview.resultDefinition,
        currentReality: preview.currentReality,
        subgoals: preview.suggestedSubgoals ?? previewToSubgoals(preview.tasks),
        notes: composer === "note" && draft.trim()
          ? [{ id: `origin-${Date.now()}`, content: draft.trim(), createdAt: new Date().toISOString(), source: "origin" }]
          : undefined,
      }) as { id: string | number };
      await refreshObjectives();
      setSelectedId(created.id);
      setPreview(null);
      setComposer(null);
      setDraft("");
      trackProductEvent("goal.created.v1", "goals", { goalId: String(created.id), creationMode: "ai", hasDeadline: Boolean(deadline) });
      showSuccess(l("Objetivo criado com o caminho visivel.", "Goal created with a visible path."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Nao foi possivel criar o objetivo.", "Could not create the goal."));
    } finally {
      setBusy(null);
    }
  }

  async function confirmBreakdownOnSelected() {
    if (!preview || !selected) return;
    setBusy("save");
    try {
      await api.post(`/objectives/${selected.id}/path/apply-preview`, {
        expectedVersion: selected.pathVersion ?? 1,
        resultDefinition: preview.resultDefinition,
        currentReality: preview.currentReality,
        milestones: preview.milestones,
        subgoals: preview.suggestedSubgoals ?? previewToSubgoals(preview.tasks),
      });
      await refreshObjectives();
      setPreview(null);
      showSuccess(l("Caminho aplicado.", "Path applied."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Nao foi possivel aplicar o desdobramento.", "Could not apply the breakdown."));
    } finally {
      setBusy(null);
    }
  }

  async function confirmExpand() {
    if (!preview || !selected || !selectedActionId) return;
    setBusy("save");
    try {
      const steps = (preview.suggestedSubgoals ?? previewToSubgoals(preview.tasks)).slice(0, 5);
      let version = selected.pathVersion ?? 1;
      for (const step of steps) {
        await api.post(`/objectives/${selected.id}/actions`, {
          expectedVersion: version,
          title: step.title,
          doneWhen: step.doneWhen,
          parentId: selectedActionId,
        });
        version += 1;
      }
      await refreshObjectives();
      setPreview(null);
      showSuccess(l("Passos adicionados embaixo desta acao.", "Steps added under this action."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Nao deu para expandir agora.", "Could not expand right now."));
    } finally {
      setBusy(null);
    }
  }

  async function confirmReschedule() {
    if (!reschedule) return;
    setBusy("save");
    try {
      for (const move of reschedule.moves) {
        if (!move.objectiveId) continue;
        const goal = goals.find((item) => String(item.id) === String(move.objectiveId));
        await api.patch(`/objectives/${move.objectiveId}/actions/${move.actionId}`, {
          expectedVersion: goal?.pathVersion ?? 1,
          scheduledFor: move.to,
        });
      }
      await refreshObjectives();
      setReschedule(null);
      setComposer(null);
      showSuccess(l("Datas atualizadas.", "Dates updated."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Nao foi possivel reagendar.", "Could not reschedule."));
    } finally {
      setBusy(null);
    }
  }

  async function saveNote() {
    if (!selected) {
      showError(l("Selecione um objetivo para guardar a nota.", "Select a goal to keep the note."));
      return;
    }
    if (!noteDraft.trim()) return;
    const next = [...notes, { id: `note-${Date.now()}`, content: noteDraft.trim(), createdAt: new Date().toISOString(), source: "manual" as const }];
    try {
      await api.patch(`/objectives/${selected.id}`, { notes: next });
      await refreshObjectives();
      setNoteDraft("");
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Nao foi possivel salvar a nota.", "Could not save the note."));
    }
  }

  return (
    <div className="ow-root">
      {recoveryError ? (
        <GoalRecoveryNotice
          message={recoveryError}
          retryLabel={l("Tentar de novo", "Try again")}
          retrying={false}
          onRetry={() => {
            setRecoveryError(null);
            recoveryGuard.current.status = "idle";
          }}
        />
      ) : null}

      <div className="ow-toolbar">
        <button type="button" className="ow-btn" onClick={() => { setComposer("note"); setDraft(""); }}>{l("Anotar", "Note")}</button>
        <button type="button" className="ow-btn ow-btn--primary" onClick={() => { setComposer("ai-goal"); setDraft(""); }}>{l("Objetivo com IA", "Goal with AI")}</button>
        <button type="button" className="ow-btn" onClick={() => { setComposer("reschedule"); setDraft(""); }}>{l("Reagendar", "Reschedule")}</button>
        {selected && !isAiBrokenDown(selected) ? (
          <button type="button" className="ow-btn" disabled={busy !== null} onClick={() => void runBreakdown(selected.title, { objectiveId: String(selected.id), intent: "replace" })}>
            {l("Desdobrar com IA", "Break down with AI")}
          </button>
        ) : null}
        {selected ? (
          <button
            type="button"
            className="ow-btn"
            disabled={busy !== null}
            onClick={() => {
              setBusy("optimize");
              api.post(`/objectives/${selected.id}/path/propose-revision`, {
                reason: l("Otimizar duplicatas e priorizar o proximo passo concreto.", "Deduplicate and prioritize the next concrete step."),
                locale: navigator.language || "pt-BR",
              }).then(async () => {
                await refreshObjectives();
                showSuccess(l("Proposta pronta. Confirme no caminho se fizer sentido.", "Proposal ready. Confirm it on the path if it fits."));
              }).catch((error) => {
                showError(error instanceof Error ? error.message : l("Nao foi possivel otimizar agora.", "Could not optimize right now."));
              }).finally(() => setBusy(null));
            }}
          >
            {l("Otimizar com IA", "Optimize with AI")}
          </button>
        ) : null}
      </div>

      <SplitLayout
        wide={wide}
        leftLabel={l("Objetivos e caminho", "Goals and path")}
        rightLabel={l("Notas e detalhe", "Notes and detail")}
        left={(
          <>
            <div>
              <p className="ow-empty" style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{l("Objetivos", "Goals")}</p>
              {activeGoals.length === 0 ? (
                <p className="ow-empty">{l("Nenhum objetivo ativo. Comece por Objetivo com IA.", "No active goal. Start with Goal with AI.")}</p>
              ) : activeGoals.map((goal) => (
                <button
                  key={String(goal.id)}
                  type="button"
                  className="ow-item"
                  aria-selected={selected != null && String(selected.id) === String(goal.id)}
                  onClick={() => { setSelectedId(goal.id); setSelectedActionId(null); }}
                >
                  <span style={{ flex: 1 }}>{goal.title}</span>
                  <span className="ow-badge">{isAiBrokenDown(goal) ? l("IA desdobrado", "AI broken down") : l("Manual", "Manual")}</span>
                </button>
              ))}
            </div>
            {selected ? (
              <div>
                <p className="ow-empty" style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{l("Caminho", "Path")}</p>
                {tree.length === 0 ? (
                  <p className="ow-empty">{l("Ainda sem tarefas. Desdobre com IA.", "No tasks yet. Break it down with AI.")}</p>
                ) : tree.map((node) => (
                  <TreeBlock
                    key={node.id}
                    node={node}
                    selectedActionId={selectedActionId}
                    onSelect={setSelectedActionId}
                    conflictLabel={l("sobrecarga no dia", "day overload")}
                    onToggle={async (actionId) => {
                      if (!selected) return;
                      await toggleSubGoal(selected.id, actionId);
                      trackProductEvent("goal.action_changed.v1", "goals", {
                        goalId: String(selected.id),
                        actionId,
                        changeType: "completed",
                      });
                    }}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
        right={(
          <>
            {selectedAction ? (
              <div>
                <p className="ow-empty" style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{l("Acao selecionada", "Selected action")}</p>
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{selectedAction.title}</h2>
                <p className="ow-empty">{selectedAction.doneWhen}</p>
                {selectedAction.scheduledFor ? <p className="ow-empty">{selectedAction.scheduledFor}</p> : null}
                <button
                  type="button"
                  className="ow-btn"
                  style={{ marginTop: 10 }}
                  onClick={() => void runBreakdown(selectedAction.title, { objectiveId: selected ? String(selected.id) : undefined, intent: "expand" })}
                >
                  {l("Expandir com IA", "Expand with AI")}
                </button>
              </div>
            ) : (
              <div>
                <p className="ow-empty" style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{l("Notas", "Notes")}</p>
                {notes.length === 0 ? <p className="ow-empty">{l("Nenhuma nota neste objetivo.", "No notes on this goal.")}</p> : notes.map((note) => (
                  <article key={note.id} className="ow-item" style={{ display: "block" }}>
                    <p style={{ margin: 0 }}>{note.content}</p>
                    <button
                      type="button"
                      className="ow-btn"
                      style={{ marginTop: 8 }}
                      onClick={() => { setComposer("note"); setDraft(note.content); void runBreakdown(note.content, { note: note.content, intent: "create" }); }}
                    >
                      {l("Transformar em objetivo", "Turn into a goal")}
                    </button>
                  </article>
                ))}
                {selected ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <textarea className="ow-field" rows={3} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder={l("Nova nota", "New note")} />
                    <button type="button" className="ow-btn ow-btn--primary" onClick={() => void saveNote()}>{l("Salvar", "Save")}</button>
                  </div>
                ) : <p className="ow-empty">{l("Selecione um objetivo para ver notas e detalhes juntos.", "Select a goal to see notes and details together.")}</p>}
              </div>
            )}
          </>
        )}
      />

      {composer && !preview && !reschedule ? (
        <div className="ow-modal" role="dialog" aria-modal="true">
          <div className="ow-modal__card">
            <strong>{composer === "reschedule" ? l("Reagendar com IA", "Reschedule with AI") : composer === "note" ? l("Anotar", "Note") : l("Objetivo com IA", "Goal with AI")}</strong>
            <textarea className="ow-field" rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} />
            {composer !== "reschedule" && composer !== "note" ? (
              <input className="ow-field" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} aria-label={l("Prazo", "Deadline")} />
            ) : null}
            <div className="ow-toolbar">
              <button type="button" className="ow-btn" onClick={() => setComposer(null)}>{l("Cancelar", "Cancel")}</button>
              {composer === "note" ? (
                <button type="button" className="ow-btn" onClick={() => void saveNote()}>{l("Salvar nota", "Save note")}</button>
              ) : null}
              <button
                type="button"
                className="ow-btn ow-btn--primary"
                disabled={busy !== null || draft.trim().length < 3}
                onClick={() => {
                  if (composer === "reschedule") {
                    setBusy("preview");
                    api.post("/objectives/preview-reschedule", { naturalLanguage: draft })
                      .then((response) => setReschedule(response as RescheduleResponse))
                      .catch((error) => showError(error instanceof Error ? error.message : l("Nao foi possivel ler o pedido.", "Could not read the request.")))
                      .finally(() => setBusy(null));
                    return;
                  }
                  void runBreakdown(draft, { note: composer === "note" ? draft : undefined, intent: "create" });
                }}
              >
                {busy === "preview" ? <span className="ow-spinner" aria-hidden /> : null}
                {composer === "reschedule" ? l("Ver datas", "See dates") : l("Desdobrar", "Break down")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="ow-modal" role="dialog" aria-modal="true">
          <div className="ow-modal__card">
            <strong>{preview.suggestedTitle}</strong>
            {preview.question ? <p className="ow-empty">{preview.question}</p> : null}
            {preview.tasks.filter((task) => task.level !== 1).map((task) => (
              <label key={task.id} className="ow-item">
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={(event) => {
                    if (event.target.checked) return;
                    setPreview({
                      ...preview,
                      tasks: preview.tasks.filter((item) => item.id !== task.id),
                      suggestedSubgoals: (preview.suggestedSubgoals ?? []).filter((item) => item.id !== task.id),
                    });
                  }}
                />
                <span>{task.title} · {task.estimatedMinutes} min</span>
              </label>
            ))}
            {preview.conflicts?.map((item) => <p key={item.task} className="ow-conflict">{item.task}: {item.reason}</p>)}
            <div className="ow-toolbar">
              <button type="button" className="ow-btn" onClick={() => { setPreview(null); setComposer("manual"); }}>{l("Criar na mao", "Create by hand")}</button>
              <button type="button" className="ow-btn ow-btn--primary" disabled={busy !== null} onClick={() => void (previewIntent === "replace" ? confirmBreakdownOnSelected() : previewIntent === "expand" ? confirmExpand() : confirmCreate())}>
                {busy === "save" ? <span className="ow-spinner" aria-hidden /> : null}
                {l("Confirmar", "Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reschedule ? (
        <div className="ow-modal" role="dialog" aria-modal="true">
          <div className="ow-modal__card">
            <strong>{l("Novo calendario", "New dates")}</strong>
            {reschedule.moves.length === 0 ? <p className="ow-empty">{l("Nao encontrei essas acoes. Tente o nome exatamente como esta no caminho.", "Those actions were not found. Try the name as it appears on the path.")}</p> : reschedule.moves.map((move) => (
              <p key={move.actionId}>{move.title}: {move.from ?? l("sem data", "no date")} → {move.to}</p>
            ))}
            {reschedule.conflicts.map((item) => <p key={item.actionId} className="ow-conflict">{item.reason}</p>)}
            <div className="ow-toolbar">
              <button type="button" className="ow-btn" onClick={() => setReschedule(null)}>{l("Cancelar", "Cancel")}</button>
              <button type="button" className="ow-btn ow-btn--primary" disabled={busy !== null || reschedule.moves.length === 0} onClick={() => void confirmReschedule()}>{l("Confirmar", "Confirm")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TreeBlock({
  node,
  selectedActionId,
  conflictLabel,
  onSelect,
  onToggle,
}: {
  node: TreeNode;
  selectedActionId: string | null;
  conflictLabel: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => Promise<void>;
}) {
  return (
    <>
      <div
        className={`ow-tree-item ow-tree-item--l${node.level}`}
        aria-selected={selectedActionId === node.actionId}
      >
        {node.actionId ? (
          <input type="checkbox" checked={node.done} onChange={() => void onToggle(node.actionId!)} aria-label={node.title} />
        ) : null}
        <button type="button" className="ow-item" style={{ padding: 0, flex: 1 }} onClick={() => node.actionId && onSelect(node.actionId)}>
          <span>{node.title}</span>
          {node.level !== 1 ? <span className="ow-empty">{node.estimatedMinutes} min</span> : null}
          {node.conflict ? <span className="ow-conflict">{conflictLabel}</span> : null}
        </button>
      </div>
      {node.children.map((child) => (
        <TreeBlock key={child.id} node={child} selectedActionId={selectedActionId} conflictLabel={conflictLabel} onSelect={onSelect} onToggle={onToggle} />
      ))}
    </>
  );
}

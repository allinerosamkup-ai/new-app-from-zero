// Goals & GTD v8 — Glass design + Next Action highlight + depth
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import { useToast } from "../components/Toast";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useNavigate, useLocation } from "react-router-dom";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import {
  Plus, Mic, Trash2, ChevronDown, ChevronUp,
  Link, X, Zap, Inbox, Edit2, RefreshCw,
} from "lucide-react";
import { AuraIcon } from "../components/AuraIcon";
import { normalizeSuggestionText } from "../utils/goal-suggestion-routing";
import { buildGoalPriorityActions, type GoalPriorityAction } from "../utils/goal-priority-actions";
import "../styles/aura.css";
import "../styles/editorial.css";

// ── Types ─────────────────────────────────────────────────────

type GTDTipo =
  | "proxima_acao" | "projeto" | "aguardando"
  | "referencia" | "algum_dia" | "deletar";

type GTDItem = {
  id: string;
  text: string;
  capturedAt: string;
  clarifying?: boolean;
  clarified?: boolean;
  tipo?: GTDTipo;
  titulo?: string;
  proxima_acao?: string;
  categoria?: string;
  tempo_estimado?: string;
  razao?: string;
  meta_sugerida?: string | null;
  done?: boolean;
  linkedGoalId?: number | string | null;
  sentToGoal?: boolean;
  archived?: boolean;
};

type CaptureDialogueResult = {
  status: "needs_clarification" | "ready";
  question?: string | null;
  summary?: string | null;
  kind: "goal" | "next_action" | "inbox" | "reference" | "someday";
  title?: string | null;
  firstActions?: string[];
  linkedGoalTitle?: string | null;
};

type CaptureSession = {
  initial: string;
  summary: string;
  question: string | null;
  turns: number;
  pending: CaptureDialogueResult | null;
};

// ── XP storage (background) ───────────────────────────────────
function awardXP(amount: number, isTask = false) {
  try {
    const g = JSON.parse(localStorage.getItem("aura-gami-v1") || "{}");
    const xp = (g.xp || 0) + amount;
    const totalDone = isTask ? (g.totalDone || 0) + 1 : (g.totalDone || 0);
    localStorage.setItem("aura-gami-v1", JSON.stringify({ ...g, xp, totalDone }));
  } catch {}
}

// ── Cores por índice de meta ───────────────────────────────────
const GOAL_COLORS = [
  { accent: "var(--accent-sky)",    bg: "rgba(99,152,169,.12)"  },
  { accent: "var(--accent-sage)",    bg: "rgba(150,199,179,.12)" },
  { accent: "var(--accent-peach)", bg: "rgba(215,137,127,.12)" },
];

// ── Checkbox quadrado (GTD) ────────────────────────────────────
function TaskBox({ done, onClick, isNext = false }: { done: boolean; onClick: () => void; isNext?: boolean }) {
  const [animating, setAnimating] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (done) {
       onClick();
       return;
    }
    setAnimating(true);
    setTimeout(() => {
      onClick();
      setAnimating(false);
    }, 450);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: "pointer",
        background: (done || animating) ? "var(--accent-sage)" : isNext ? "rgba(215,137,127,0.15)" : "transparent",
        border: (done || animating) ? "none" : isNext ? "1.5px solid var(--accent-peach)" : "1.5px solid var(--text-3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: animating ? 'scale(1.2)' : 'scale(1)'
      }}
    >
      {(done || animating) && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

// ── GoalCard v8 ───────────────────────────────────────────────
function GoalCard({
  goal,
  colorIndex,
  onToggleSubtask,
  onBreakDown,
  onAddSubtask,
  onRemove,
  loadingBreakdown,
  onJournalReflect,
  onUpdateTitle,
  onConvertToTask,
  initiallyOpen = true,
  highlightedSubtaskId,
  highlightedText,
}: {
  goal: { id: number | string; title: string; completedPct: number; subtasks: Array<{ id: number | string; title: string; done: boolean }> };
  colorIndex: number;
  onToggleSubtask: (subId: number | string) => void;
  onBreakDown: () => void;
  onAddSubtask: (text: string) => void;
  onRemove: () => void;
  loadingBreakdown: boolean;
  onJournalReflect: () => void;
  onUpdateTitle: (newTitle: string) => void;
  onConvertToTask: (goal: any) => void;
  initiallyOpen?: boolean;
  highlightedSubtaskId?: number | string;
  highlightedText?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [addingTask, setAddingTask] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(goal.title);
  const [newTask, setNewTask] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const color = GOAL_COLORS[colorIndex % GOAL_COLORS.length];
  const pct = goal.completedPct;
  const done = pct >= 100;
  const doneSubs = goal.subtasks.filter(s => s.done).length;
  // GTD: first uncompleted subtask = Next Action
  const nextActionIdx = goal.subtasks.findIndex(s => !s.done);
  const normalizedHighlightText = highlightedText ? normalizeSuggestionText(highlightedText) : "";

  useEffect(() => { if (addingTask) inputRef.current?.focus(); }, [addingTask]);
  useEffect(() => { if (isEditingTitle) editInputRef.current?.focus(); }, [isEditingTitle]);
  useEffect(() => {
    if (!initiallyOpen) return;
    setOpen(true);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [initiallyOpen]);

  const handleTitleSubmit = () => {
    if (editedTitle.trim() && editedTitle !== goal.title) {
      onUpdateTitle(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div ref={cardRef} style={{
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      background: "rgba(255,255,255,0.62)",
      border: "1px solid rgba(255,255,255,0.80)",
      borderLeft: `4px solid ${color.accent}`,
      borderRadius: 18,
      marginBottom: 10,
      overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 14px 12px", cursor: "pointer" }}
      >
        {/* Icon box */}
        <div style={{
          width: 36, height: 36, borderRadius: 11, background: color.bg,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <AuraIcon size={17} style={{ color: color.accent }} />
        </div>

        {/* Title + progress bar */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              background: color.bg, border: `1px solid ${color.accent}44`,
              borderRadius: 999, padding: "1px 7px",
              fontSize: 9, fontWeight: 800, letterSpacing: ".07em",
              color: color.accent, textTransform: "uppercase" as const,
            }}>🎯 Meta</span>
          </div>

          {isEditingTitle ? (
            <input
              ref={editInputRef}
              value={editedTitle}
              onChange={e => setEditedTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={e => e.key === 'Enter' && handleTitleSubmit()}
              style={{
                width: '100%',
                padding: '4px 8px',
                borderRadius: '8px',
                border: `2px solid ${color.accent}`,
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-1)',
                background: '#fff',
                marginBottom: '6px',
                outline: 'none'
              }}
            />
          ) : (
            <p style={{
              fontSize: 14, fontWeight: 700, margin: "0 0 6px",
              color: done ? "var(--accent-sage)" : "var(--text-1)",
              textDecoration: done ? "line-through" : "none",
              lineHeight: 1.4,
            }}>
              {done ? "✓ " : ""}{goal.title}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 999, background: color.bg, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`, borderRadius: 999,
                background: color.accent, transition: "width 0.4s ease",
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: color.accent, flexShrink: 0 }}>
              {doneSubs}/{goal.subtasks.length}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setIsEditingTitle(true); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4, borderRadius: 6 }}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onConvertToTask(goal); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4, borderRadius: 6 }}
            title="Converter em tarefa diária"
          >
            <RefreshCw size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4, borderRadius: 6 }}>
            <Trash2 size={13} />
          </button>
          {open
            ? <ChevronUp size={14} style={{ color: "var(--text-3)" }} />
            : <ChevronDown size={14} style={{ color: "var(--text-3)" }} />}
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{ padding: "0 14px 14px", marginLeft: 46 }}>

          {/* Subtasks label */}
          {goal.subtasks.length > 0 && (
            <p style={{
              fontSize: "9.5px", fontWeight: 700, letterSpacing: ".1em",
              textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 6px",
            }}>
              Subtarefas ({doneSubs}/{goal.subtasks.length})
            </p>
          )}

          {/* Loading */}
          {loadingBreakdown && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 0",
              color: "var(--accent-peach)", fontSize: "calc(var(--a) * 0.83)",
            }}>
              <AuraIcon size={14} /> Airia está gerando próximas ações...
            </div>
          )}

          {/* Empty state */}
          {goal.subtasks.length === 0 && !loadingBreakdown && (
            <div style={{
              padding: "10px 12px", borderRadius: 10, marginBottom: 8,
              background: "rgba(0,0,0,0.03)",
              textAlign: "center", color: "var(--text-3)", fontSize: "calc(var(--a) * 0.85)",
            }}>
              Sem próximas ações. Use <strong style={{ color: "var(--accent-peach)" }}>Airia quebrar</strong> para gerar.
            </div>
          )}

          {/* Subtask rows */}
          {goal.subtasks.map((s, idx) => {
            const isNext = idx === nextActionIdx;
            const isHighlighted = highlightedSubtaskId != null
              ? s.id === highlightedSubtaskId
              : normalizedHighlightText.length > 0 && normalizeSuggestionText(s.title) === normalizedHighlightText;
            return (
              <div key={s.id}>
                {/* GTD: Next Action badge */}
                {isNext && !done && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(215,137,127,0.12)",
                    border: "1px solid rgba(215,137,127,0.30)",
                    borderRadius: 999, padding: "2px 8px",
                    fontSize: "9px", fontWeight: 700, letterSpacing: ".06em",
                    color: "var(--accent-peach)", textTransform: "uppercase",
                    marginBottom: 4,
                  }}>
                    ▶ Fazer agora
                  </div>
                )}
                <div
                  onClick={() => onToggleSubtask(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: isNext && !done ? "7px 10px" : "5px 0",
                    borderRadius: isNext && !done ? 10 : 0,
                    background: isHighlighted
                      ? "rgba(99,152,169,0.12)"
                      : isNext && !done
                        ? "rgba(215,137,127,0.06)"
                        : "transparent",
                    border: isHighlighted
                      ? "1px solid rgba(99,152,169,0.35)"
                      : isNext && !done
                        ? "1px solid rgba(215,137,127,0.20)"
                        : "none",
                    cursor: "pointer", marginBottom: 4,
                    transition: "background 0.15s",
                    boxShadow: isHighlighted ? "0 0 0 1px rgba(99,152,169,0.08)" : "none",
                  }}
                >
                  <TaskBox done={s.done} isNext={isNext && !done} onClick={() => onToggleSubtask(s.id)} />
                  <span style={{
                    flex: 1, fontSize: "11.5px", lineHeight: 1.4,
                    color: s.done ? "var(--text-3)" : isNext ? "var(--text-1)" : "var(--text-2)",
                    textDecoration: s.done ? "line-through" : "none",
                    fontWeight: isNext && !done ? 600 : 400,
                  }}>
                    {s.title}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Add subtask inline */}
          {addingTask && (
            <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
              <input
                ref={inputRef}
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newTask.trim()) {
                    onAddSubtask(newTask.trim()); setNewTask(""); setAddingTask(false);
                  }
                  if (e.key === "Escape") { setAddingTask(false); setNewTask(""); }
                }}
                placeholder="Próxima ação concreta..."
                style={{
                  flex: 1, background: "rgba(255,255,255,0.8)",
                  border: "1.5px solid var(--accent-peach)", borderRadius: 10,
                  padding: "7px 10px", color: "var(--text-1)",
                  fontSize: "calc(var(--a) * 0.88)", outline: "none",
                }}
              />
              <button onClick={() => { setAddingTask(false); setNewTask(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
                <X size={15} />
              </button>
            </div>
          )}

          {/* Meta concluída → CTA de reflexão no diário */}
          {done && (
            <div style={{
              background: "rgba(150,199,179,0.12)",
              border: "1px solid rgba(150,199,179,0.35)",
              borderRadius: 12, padding: "10px 12px", marginTop: 10,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: "1.1rem" }}>🎉</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-sage)", margin: "0 0 2px" }}>Meta concluída!</p>
                <p style={{ fontSize: 11, color: "var(--text-2)", margin: 0 }}>Que tal registrar essa conquista no diário?</p>
              </div>
              <button
                onClick={onJournalReflect}
                style={{
                  background: "var(--accent-sage)", color: "#fff",
                  border: "none", borderRadius: 10, padding: "6px 12px",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}
              >
                Refletir
              </button>
            </div>
          )}

          {/* Actions */}
          {!done && <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => setAddingTask(true)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "8px", background: "rgba(255,255,255,0.5)",
                backdropFilter: "blur(8px)", border: "1px dashed rgba(0,0,0,0.14)",
                borderRadius: 10, color: "var(--text-2)",
                fontSize: "calc(var(--a) * 0.82)", cursor: "pointer", fontWeight: 500,
              }}
            >
              <Plus size={13} /> Adicionar
            </button>
            <button
              onClick={onBreakDown}
              disabled={loadingBreakdown}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "8px", background: "rgba(215,137,127,0.08)",
                backdropFilter: "blur(8px)", border: "1px solid rgba(215,137,127,0.45)",
                borderRadius: 10, color: "var(--accent-peach)",
                fontSize: "calc(var(--a) * 0.82)", cursor: loadingBreakdown ? "default" : "pointer",
                opacity: loadingBreakdown ? 0.5 : 1, fontWeight: 600,
              }}
            >
              <AuraIcon size={13} />
              {loadingBreakdown ? "Gerando..." : "Airia quebrar"}
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export function GoalsPage() {
  const { state, addGoal, addGoalWithSubGoals, addSubGoals, toggleSubGoal, removeGoal, updateGoal, addTask, addHabit } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);
  const isLowPhase = cycleReport.phase === "low" || cycleReport.phase === "depleted";

  const [gtdItems, setGtdItems] = useState<GTDItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("gtd-inbox-v1") || "[]"); } catch { return []; }
  });

  const [captureInput, setCaptureInput] = useState("");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureReply, setCaptureReply] = useState<string | null>(null);
  const [captureSession, setCaptureSession] = useState<CaptureSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const [metasOpen, setMetasOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [loadingBreakdown, setLoadingBreakdown] = useState<number | string | null>(null);
  const [linkingItem, setLinkingItem] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const capturingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"metas" | "acoes">("metas");
  const navState = (location.state as {
    activeTab?: "capturar" | "metas" | "acoes";
    openGoalId?: string | number;
    openSubtaskId?: string | number;
    highlightText?: string;
  } | null) ?? null;

  useEffect(() => {
    if (navState?.activeTab && navState.activeTab !== "capturar") setActiveTab(navState.activeTab);
    if (navState?.openGoalId) {
      setActiveTab("metas");
      setMetasOpen(true);
    }
  }, [navState]);

  useEffect(() => {
    localStorage.setItem("gtd-inbox-v1", JSON.stringify(gtdItems));
  }, [gtdItems]);

  const goals = state.goals;

  const standaloneActions = gtdItems.filter(i =>
    !i.archived && !i.sentToGoal && i.clarified &&
    i.tipo === "proxima_acao" && !i.linkedGoalId
  );

  const priorityActions = useMemo(
    () => buildGoalPriorityActions(goals, { gtdItems }),
    [goals, gtdItems]
  );

  const inbox = gtdItems.filter(i =>
    !i.archived && !i.sentToGoal && !i.clarified
  );

  const parked = gtdItems.filter(i =>
    !i.archived && !i.sentToGoal && i.clarified &&
    (i.tipo === "aguardando" || i.tipo === "referencia" || i.tipo === "algum_dia")
  );

  // ── Voice ────────────────────────────────────────────────
  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop(); setIsRecording(false); return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setCaptureInput(prev => prev ? `${prev} ${t}` : t);
    };
    rec.onend = () => setIsRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }

  // ── Break goal down ───────────────────────────────────────
  async function breakGoalDown(goalId: number | string) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    setLoadingBreakdown(goalId);
    try {
      const res: any = await api.post("/ai/suggest", {
        type: "goal-subtasks",
        context: { goalTitle: goal.title, existingSubtasks: goal.subtasks.map(s => s.title) },
      });
      const parsed = parseAiSuggestion<{ items?: string[] } | string[]>(res.suggestion);
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
          ? parsed.items
          : [];

      if (items.length > 0) {
        await addSubGoals(goalId, items);
      } else {
        showError("A Airia não conseguiu gerar subtarefas agora.");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Erro ao gerar próximas ações.");
    } finally {
      setLoadingBreakdown(null);
    }
  }

  // ── Smart capture ─────────────────────────────────────────
  async function handleCapture() {
    const text = captureInput.trim();
    if (!text || capturingRef.current) return;
    capturingRef.current = true;
    setCaptureInput("");
    setCaptureLoading(true);
    try {
      const initial = captureSession?.initial ?? text;
      const res: any = await api.post("/ai/suggest", {
        type: "goal-capture-dialogue",
        context: {
          capture: initial,
          answer: captureSession ? text : "",
          previousSummary: captureSession?.summary ?? "",
          goals: goals.map(g => g.title),
        },
      });
      const parsed = parseAiSuggestion<CaptureDialogueResult>(res.suggestion);
      const safeSummary = parsed.summary?.trim() || captureSession?.summary || initial;
      const turns = (captureSession?.turns ?? 0) + 1;

      if (parsed.status === "needs_clarification" && parsed.question && turns < 3) {
        setCaptureSession({
          initial,
          summary: safeSummary,
          question: parsed.question,
          turns,
          pending: null,
        });
        setCaptureReply(null);
        return;
      }

      setCaptureSession({
        initial,
        summary: safeSummary,
        question: null,
        turns,
        pending: {
          ...parsed,
          status: "ready",
          title: parsed.title?.trim() || safeSummary,
          firstActions: Array.isArray(parsed.firstActions) ? parsed.firstActions.filter(Boolean) : [],
        },
      });
      setCaptureReply(null);
    } catch (err) {
      const itemId = `gtd-${Date.now()}`;
      setGtdItems(prev => [{ id: itemId, text, capturedAt: new Date().toISOString() }, ...prev]);
      const msg = err instanceof Error ? err.message : "";
      const isRateLimit = msg.includes("429") || msg.includes("rate") || msg.includes("limit");
      setCaptureReply(isRateLimit
        ? `A IA está sobrecarregada agora. Guardei na aba Ações para você revisar depois.`
        : `Guardei para revisão. Você pode clarificar depois na aba Capturar.`
      );
      if (!isRateLimit) showError("Erro ao classificar. Item salvo para revisão.");
    } finally {
      setCaptureLoading(false);
      capturingRef.current = false;
      setTimeout(() => {
        captureInputRef.current?.focus();
      }, 80);
    }
  }

  async function confirmCaptureResult() {
    const pending = captureSession?.pending;
    if (!pending) return;
    const title = pending.title?.trim() || captureSession.summary;
    const firstActions = Array.isArray(pending.firstActions)
      ? pending.firstActions.map((item) => item.trim()).filter(Boolean)
      : [];

    try {
      if (pending.kind === "goal") {
        await addGoalWithSubGoals(title, firstActions);
        awardXP(20);
        setMetasOpen(true);
        setActiveTab("metas");
        setCaptureReply(`Meta criada com próximas ações: "${title}".`);
      } else if (pending.kind === "next_action") {
        const goalMatch = pending.linkedGoalTitle
          ? goals.find(g => normalizeSuggestionText(g.title) === normalizeSuggestionText(pending.linkedGoalTitle || ""))
          : null;
        if (goalMatch) {
          await addSubGoals(goalMatch.id, [title]);
          setCaptureReply(`Adicionei como próxima ação em "${goalMatch.title}".`);
        } else {
          setGtdItems(prev => [{
            id: `gtd-${Date.now()}`,
            text: captureSession.initial,
            capturedAt: new Date().toISOString(),
            clarified: true,
            tipo: "proxima_acao",
            titulo: title,
            meta_sugerida: pending.linkedGoalTitle ?? null,
          }, ...prev]);
          setActionsOpen(true);
          setActiveTab("acoes");
          setCaptureReply("Próxima ação registrada.");
        }
        awardXP(10);
      } else if (pending.kind === "reference" || pending.kind === "someday") {
        setGtdItems(prev => [{
          id: `gtd-${Date.now()}`,
          text: captureSession.initial,
          capturedAt: new Date().toISOString(),
          clarified: true,
          tipo: pending.kind === "reference" ? "referencia" : "algum_dia",
          titulo: title,
          razao: captureSession.summary,
        }, ...prev]);
        setCaptureReply(pending.kind === "reference" ? "Guardei como referência." : "Guardei em algum dia.");
      } else {
        setGtdItems(prev => [{
          id: `gtd-${Date.now()}`,
          text: title,
          capturedAt: new Date().toISOString(),
        }, ...prev]);
        setInboxOpen(true);
        setCaptureReply("Guardei na caixa de entrada.");
      }
      setCaptureSession(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Não foi possível salvar essa captura.");
    }
  }

  function resetCaptureConversation() {
    setCaptureSession(null);
    setCaptureReply(null);
    setCaptureInput("");
    setTimeout(() => captureInputRef.current?.focus(), 50);
  }

  // Auto-breakdown
  useEffect(() => {
    const flag = sessionStorage.getItem("aura-auto-break-goal");
    if (!flag) return;
    const newGoal = goals.find(g => g.title === flag && g.subtasks.length === 0);
    if (newGoal) {
      sessionStorage.removeItem("aura-auto-break-goal");
      breakGoalDown(newGoal.id);
    }
  }, [goals]);

  // ── GTD Clarify ───────────────────────────────────────────
  async function clarifyItem(id: string) {
    const item = gtdItems.find(i => i.id === id);
    if (!item || item.clarifying) return;
    setGtdItems(prev => prev.map(i => i.id === id ? { ...i, clarifying: true } : i));
    try {
      const res: any = await api.post("/ai/suggest", {
        type: "gtd-clarify",
        context: { item: item.text, goals: goals.map(g => g.title) },
      });
      const parsed = parseAiSuggestion<Partial<GTDItem>>(res.suggestion);
      setGtdItems(prev => prev.map(i => i.id === id ? { ...i, clarifying: false, clarified: true, ...parsed } : i));

      if (parsed?.tipo === "projeto" && parsed.titulo) {
        await addGoal(parsed.titulo);
        setGtdItems(prev => prev.map(i => i.id === id ? { ...i, sentToGoal: true } : i));
        setMetasOpen(true);
        sessionStorage.setItem("aura-auto-break-goal", parsed.titulo);
      }
      if (parsed?.tipo === "proxima_acao" && (parsed as any).meta_sugerida) {
        const goalMatch = goals.find(g => g.title === (parsed as any).meta_sugerida);
        if (goalMatch) {
          await addSubGoals(goalMatch.id, [parsed.titulo || item.text]);
          setGtdItems(prev => prev.map(i => i.id === id ? { ...i, sentToGoal: true, linkedGoalId: goalMatch.id } : i));
        }
      }
      awardXP(5);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Erro ao clarificar.");
      setGtdItems(prev => prev.map(i => i.id === id ? { ...i, clarifying: false } : i));
    }
  }

  function toggleStandaloneAction(id: string) {
    setGtdItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const nowDone = !i.done;
      if (nowDone) awardXP(10, true);
      return { ...i, done: nowDone };
    }));
  }

  async function completePriorityAction(action: GoalPriorityAction) {
    if (action.source === "goal" && action.goalId != null && action.subId != null) {
      await toggleSubGoal(action.goalId, action.subId);
      awardXP(15, true);
      return;
    }

    if (action.source === "capture" && action.gtdId) {
      toggleStandaloneAction(action.gtdId);
    }
  }

  async function linkToGoal(itemId: string, goalId: string | number) {
    const item = gtdItems.find(i => i.id === itemId);
    if (!item) return;

    try {
      await addSubGoals(goalId, [item.titulo || item.text]);
      setGtdItems(prev => prev.map(i => i.id === itemId ? { ...i, sentToGoal: true, linkedGoalId: goalId } : i));
      setLinkingItem(null);
      showSuccess("Ação vinculada à meta.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Erro ao vincular ação.");
    }
  }

  async function handleUpdateGoalTitle(goalId: string | number, newTitle: string) {
    try {
      await updateGoal(goalId, { title: newTitle });
      showSuccess("Título da meta atualizado.");
    } catch (err) {
      showError("Erro ao atualizar título.");
    }
  }

  async function handleConvertToTask(goal: any) {
    const confirm = window.confirm(`Deseja transformar a meta "${goal.title}" em um checklist diário? A meta original será removida.`);
    if (!confirm) return;

    try {
      // 1. Cria o Hábito (Checklist Diário)
      await addHabit({
        title: goal.title,
        category: 'pessoal',
        frequency: 'daily',
        description: goal.subtasks.map((s: any) => `- ${s.title}`).join('\n'),
      });

      // 2. Remove a Meta original
      await removeGoal(goal.id);
      
      showSuccess("Meta convertida em hábito diário com sucesso!");
    } catch (err) {
      showError("Erro ao converter meta.");
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="aura-layout-content">
      <div className="screen-content" style={{ paddingBottom: "calc(var(--a) * 6)" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 18,
        }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 2px" }}>Seus objetivos</p>
            <h1 style={{
              fontFamily: "'Poppins', 'Plus Jakarta Sans', sans-serif",
              fontSize: 20, fontWeight: 800, color: "var(--text-1)", margin: 0,
            }}>
              Metas & GTD
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-3)", lineHeight: 1.4 }}>
              Grandes objetivos, divididos em pequenos passos.
            </p>
          </div>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "rgba(215,137,127,0.12)",
            border: "1.5px solid rgba(215,137,127,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-peach)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
        </div>

        {/* ── Phase warning — contexto cruzado ─────────────── */}
        {isLowPhase && (
          <div style={{
            background: "rgba(215,137,127,0.08)",
            border: "1.5px solid rgba(215,137,127,0.25)",
            borderRadius: 14, padding: "10px 14px", marginBottom: 14,
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-peach)", margin: "0 0 2px" }}>
                Fase {cycleReport.phaseLabel} detectada
              </p>
              <p style={{ fontSize: 11.5, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                Prefira metas leves hoje. Adiar tarefas de alta energia não é fraqueza — é inteligência.
              </p>
            </div>
          </div>
        )}

        {/* ── Tab bar ─────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 20,
          background: "rgba(0,0,0,0.04)", borderRadius: 14, padding: 4,
        }}>
          {([
            { key: "metas" as const, label: "Metas", count: goals.length },
            { key: "acoes" as const, label: "Ações", count: priorityActions.filter(i => i.source === "goal" || i.source === "capture").length },
          ] as const).map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                flex: 1, padding: "8px 6px", borderRadius: 10, border: "none",
                background: isActive ? "white" : "transparent",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                cursor: "pointer", fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--text-1)" : "var(--text-3)",
                transition: "all 200ms",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    background: isActive ? "var(--accent-peach)" : "rgba(0,0,0,0.10)",
                    color: isActive ? "white" : "var(--text-3)",
                    borderRadius: 999, padding: "0 5px",
                    fontSize: 10, fontWeight: 700, lineHeight: "16px",
                  }}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Captura conversacional GTD ── */}
        <div style={{ marginBottom: 24 }}>

          {/* Bubble da Airia — pergunta ou confirmação */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
            <div style={{ flexShrink: 0, opacity: captureLoading ? 0.6 : 1, transition: "opacity 300ms" }}>
              <AuraIcon size={26} />
            </div>
            <div style={{
              background: captureReply ? "rgba(150,199,179,.15)" : "rgba(244,168,150,.10)",
              border: `1px solid ${captureReply ? "rgba(150,199,179,.3)" : "rgba(244,168,150,.22)"}`,
              borderRadius: "14px 14px 14px 4px",
              padding: "9px 13px",
              fontSize: 13, color: "var(--text-1)", lineHeight: 1.55,
              maxWidth: "82%",
              transition: "background 300ms, border-color 300ms",
            }}>
              {captureLoading
                ? <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>
                    Entendendo o que você capturou...
                  </span>
                : captureReply
                  ? <span>{captureReply}</span>
                  : captureSession?.pending
                    ? <span>
                        Revise antes de salvar: <strong>{captureSession.pending.title || captureSession.summary}</strong>
                        <br />
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {captureSession.pending.kind === "goal" ? "Isso parece uma meta com próximas ações." :
                            captureSession.pending.kind === "next_action" ? "Isso parece uma próxima ação." :
                            captureSession.pending.kind === "reference" ? "Isso parece uma referência." :
                            captureSession.pending.kind === "someday" ? "Isso parece algo para algum dia." :
                            "Isso ainda fica melhor na caixa de entrada."}
                        </span>
                      </span>
                    : captureSession?.question
                      ? <span>{captureSession.question}</span>
                      : <span>O que está na sua mente agora?<br />
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                        Uma ideia, meta, tarefa ou qualquer coisa que precise sair da cabeça.
                      </span>
                    </span>
              }
            </div>
          </div>

          {captureSession?.pending?.firstActions && captureSession.pending.firstActions.length > 0 && (
            <div style={{ paddingLeft: 34, marginBottom: 10 }}>
              <div style={{
                background: "rgba(255,255,255,.70)",
                border: "1px solid rgba(0,0,0,.07)",
                borderRadius: 12,
                padding: "9px 12px",
              }}>
                {captureSession.pending.firstActions.slice(0, 5).map((item, index) => (
                  <div key={`${item}-${index}`} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--text-2)", lineHeight: 1.45, marginBottom: index < captureSession.pending!.firstActions!.length - 1 ? 5 : 0 }}>
                    <span style={{ color: "var(--accent-peach)", fontWeight: 800 }}>{index + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resposta do usuário — input ou confirmação visual */}
          {!captureReply && !captureLoading && !captureSession?.pending && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", paddingLeft: 34 }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 6,
                background: "white",
                border: "1.5px solid rgba(0,0,0,.09)",
                borderRadius: "14px 14px 4px 14px",
                padding: "0 12px",
                boxShadow: "0 2px 10px rgba(0,0,0,.05)",
              }}>
                <input
                  ref={captureInputRef}
                  value={captureInput}
                  onChange={e => setCaptureInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !captureLoading && handleCapture()}
                  placeholder={captureSession?.question ? "Responda aqui..." : "Escreva ou dite..."}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: "var(--text-1)", padding: "11px 0",
                  }}
                />
                <button
                  onClick={toggleVoice}
                  style={{
                    background: isRecording ? "var(--accent-peach)" : "transparent",
                    border: "none", cursor: "pointer",
                    color: isRecording ? "#fff" : "var(--text-3)",
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 200ms",
                  }}
                >
                  <Mic size={13} />
                </button>
              </div>

              {/* Botão enviar */}
              <button
                onClick={handleCapture}
                disabled={!captureInput.trim()}
                style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0, border: "none",
                  background: captureInput.trim() ? "var(--accent-peach)" : "rgba(0,0,0,.07)",
                  color: captureInput.trim() ? "#fff" : "var(--text-3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: captureInput.trim() ? "pointer" : "default",
                  transition: "background 200ms, color 200ms",
                  boxShadow: captureInput.trim() ? "0 4px 14px rgba(244,168,150,.4)" : "none",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          )}

          {/* Estado: processando */}
          {captureLoading && (
            <div style={{ paddingLeft: 34 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "white", border: "1.5px solid rgba(0,0,0,.07)",
                borderRadius: "14px 14px 4px 14px", padding: "9px 14px",
                fontSize: 12, color: "var(--text-3)",
              }}>
                <span style={{ fontStyle: "italic" }}>{captureInput || "..."}</span>
              </div>
            </div>
          )}

          {/* Estado: confirmado — "continuar" */}
          {captureSession?.pending && !captureLoading && (
            <div style={{ paddingLeft: 34, display: "flex", gap: 8 }}>
              <button
                onClick={confirmCaptureResult}
                style={{
                  background: "var(--accent-peach)", border: "none",
                  borderRadius: "14px 14px 4px 14px", padding: "9px 14px",
                  fontSize: 12, color: "#fff",
                  cursor: "pointer", fontWeight: 700,
                }}
              >
                Salvar
              </button>
              <button
                onClick={resetCaptureConversation}
                style={{
                  background: "rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.08)",
                  borderRadius: "14px", padding: "9px 14px",
                  fontSize: 12, color: "var(--text-2)",
                  cursor: "pointer", fontWeight: 600,
                }}
              >
                Descartar
              </button>
            </div>
          )}

          {captureReply && !captureLoading && !captureSession?.pending && (
            <div style={{ paddingLeft: 34 }}>
              <button
                onClick={resetCaptureConversation}
                style={{
                  background: "rgba(244,168,150,.12)", border: "1px solid rgba(244,168,150,.25)",
                  borderRadius: "14px 14px 4px 14px", padding: "9px 14px",
                  fontSize: 12, color: "var(--accent-peach-ink)",
                  cursor: "pointer", fontWeight: 600,
                }}
              >
                + Capturar outra
              </button>
            </div>
          )}
        </div>

        {/* ── METAS ──────────────────────────────────────── */}
        {activeTab === "metas" && (<>
        <button
          onClick={() => setMetasOpen(o => !o)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,0.07)",
            padding: "6px 0 10px", marginBottom: 12, cursor: "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
          </svg>
          <span style={{ flex: 1, fontWeight: 700, fontSize: "calc(var(--a) * 0.9)", color: "var(--text-1)", textAlign: "left" }}>
            Metas & Projetos
          </span>
          {goals.length > 0 && (
            <span style={{
              background: "var(--accent-peach)", color: "#fff",
              borderRadius: 99, padding: "1px 8px",
              fontSize: "calc(var(--a) * 0.75)", fontWeight: 700,
            }}>
              {goals.length}
            </span>
          )}
          {metasOpen
            ? <ChevronUp size={14} style={{ color: "var(--text-3)" }} />
            : <ChevronDown size={14} style={{ color: "var(--text-3)" }} />}
        </button>

        {metasOpen && (
          goals.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "20px 0 8px",
              color: "var(--text-3)", fontSize: "calc(var(--a) * 0.88)", fontStyle: "italic",
            }}>
              Capture algo acima — a Airia classifica e gera os passos automaticamente 🎯
            </div>
          ) : (
            goals.map((goal, idx) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                colorIndex={idx}
                onToggleSubtask={subId => {
                  const sub = goal.subtasks.find(s => s.id === subId);
                  if (sub && !sub.done) awardXP(15, true);
                  toggleSubGoal(goal.id, subId);
                }}
                onBreakDown={() => breakGoalDown(goal.id)}
                onAddSubtask={text => addSubGoals(goal.id, [text])}
                onRemove={() => removeGoal(goal.id)}
                loadingBreakdown={loadingBreakdown === goal.id}
                onJournalReflect={() => navigate("/journal")}
                onUpdateTitle={newTitle => handleUpdateGoalTitle(goal.id, newTitle)}
                onConvertToTask={handleConvertToTask}
                initiallyOpen={navState?.openGoalId ? navState.openGoalId === goal.id : undefined}
                highlightedSubtaskId={navState?.openGoalId === goal.id ? navState.openSubtaskId : undefined}
                highlightedText={navState?.openGoalId === goal.id ? navState.highlightText : undefined}
              />
            ))
          )
        )}
        </>)}

        {/* ── PRÓXIMAS AÇÕES ───────────────────── */}
        {activeTab === "acoes" && (
          <>
            <div style={{ height: 8 }} />
            <button
              onClick={() => setActionsOpen(o => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,0.07)",
                padding: "6px 0 10px", marginBottom: 12, cursor: "pointer",
              }}
            >
              <Zap size={15} style={{ color: "var(--accent-sky)" }} />
              <span style={{ flex: 1, fontWeight: 700, fontSize: "calc(var(--a) * 0.9)", color: "var(--text-1)", textAlign: "left" }}>
                Próximas ações
              </span>
              <span style={{
                background: "var(--accent-sky)", color: "#fff",
                borderRadius: 99, padding: "1px 8px",
                fontSize: "calc(var(--a) * 0.75)", fontWeight: 700,
              }}>
                {priorityActions.length}
              </span>
              {actionsOpen
                ? <ChevronUp size={14} style={{ color: "var(--text-3)" }} />
                : <ChevronDown size={14} style={{ color: "var(--text-3)" }} />}
            </button>

            {actionsOpen && priorityActions.length === 0 && (
              <div style={{
                textAlign: "center", padding: "18px 0 8px",
                color: "var(--text-3)", fontSize: "calc(var(--a) * 0.88)", fontStyle: "italic",
              }}>
                Nenhuma próxima ação pendente agora.
              </div>
            )}

            {actionsOpen && priorityActions.map(action => {
              const linkedItem = action.source === "capture" ? standaloneActions.find(item => item.id === action.gtdId) : null;
              return (
              <div key={action.id}>
                <div style={{
                  backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.78)",
                  borderRadius: 14, padding: "10px 12px", marginBottom: 8,
                  display: "flex", alignItems: "flex-start", gap: 10,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                }}>
                  <TaskBox done={false} onClick={() => void completePriorityAction(action)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 2 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        background: action.source === "goal" ? "rgba(215,137,127,0.10)" : "rgba(99,152,169,0.10)",
                        border: action.source === "goal" ? "1px solid rgba(215,137,127,0.25)" : "1px solid rgba(99,152,169,0.25)",
                        borderRadius: 999, padding: "1px 7px",
                        fontSize: 9, fontWeight: 800, letterSpacing: ".07em",
                        color: action.source === "goal" ? "var(--accent-peach)" : "var(--accent-sky)",
                        textTransform: "uppercase" as const,
                      }}>{action.source === "goal" ? "🎯 Meta" : "⚡ Tarefa"}</span>
                    </div>
                    <div style={{
                      fontSize: "calc(var(--a) * 0.9)", fontWeight: 500,
                      color: "var(--text-1)",
                    }}>
                      {action.text}
                    </div>
                    {action.source === "goal" && action.goalTitle && (
                      <div style={{ fontSize: "calc(var(--a) * 0.78)", color: "var(--text-3)", marginTop: 2 }}>
                        {action.goalTitle}
                      </div>
                    )}
                    {linkedItem?.razao && (
                      <div style={{ fontSize: "calc(var(--a) * 0.78)", color: "var(--text-3)", marginTop: 2 }}>
                        {linkedItem.razao}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {action.source === "capture" && linkedItem && goals.length > 0 && (
                      <button
                        onClick={() => setLinkingItem(linkingItem === linkedItem.id ? null : linkedItem.id)}
                        style={{
                          background: linkingItem === linkedItem.id ? "var(--accent-sky)" : "rgba(99,152,169,0.10)",
                          border: "1px solid rgba(99,152,169,0.30)",
                          borderRadius: 8, cursor: "pointer",
                          color: linkingItem === linkedItem.id ? "#fff" : "var(--accent-sky)",
                          padding: "3px 7px", fontSize: "calc(var(--a) * 0.78)",
                          display: "flex", alignItems: "center", gap: 3, fontWeight: 600,
                        }}
                      >
                        <Link size={11} /> Meta
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (action.source === "goal") {
                          navigate("/goals", { state: { openGoalId: action.goalId, openSubtaskId: action.subId } });
                        } else if (action.gtdId) {
                          setGtdItems(prev => prev.map(i => i.id === action.gtdId ? { ...i, archived: true } : i));
                        }
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                    >
                      {action.source === "goal" ? <Link size={13} /> : <X size={13} />}
                    </button>
                  </div>
                </div>

                {linkedItem && linkingItem === linkedItem.id && (
                  <div style={{
                    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                    background: "rgba(255,255,255,0.78)",
                    border: "1.5px solid rgba(215,137,127,0.35)",
                    borderRadius: 14, padding: "12px",
                    marginTop: -4, marginBottom: 8,
                  }}>
                    <div style={{ fontSize: "calc(var(--a) * 0.82)", color: "var(--text-2)", marginBottom: 8, fontWeight: 600 }}>
                      Vincular à qual meta?
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {goals.map(g => (
                        <button key={g.id} onClick={() => linkToGoal(linkedItem.id, g.id)}
                          style={{
                            background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)",
                            borderRadius: 10, padding: "7px 10px", cursor: "pointer",
                            textAlign: "left", fontSize: "calc(var(--a) * 0.85)", color: "var(--text-1)",
                          }}
                        >
                          🎯 {g.title}
                        </button>
                      ))}
                      <button onClick={() => setLinkingItem(null)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "calc(var(--a) * 0.82)", color: "var(--text-3)", textAlign: "center", padding: 4 }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )})}
          </>
        )}

        {/* ── INBOX ─────────────────────────────────────── */}
        {inbox.length > 0 && (
          <>
            <div style={{ height: 8 }} />
            <button
              onClick={() => setInboxOpen(o => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,0.07)",
                padding: "6px 0 10px", marginBottom: 12, cursor: "pointer",
              }}
            >
              <Inbox size={15} style={{ color: "var(--accent-sage)" }} />
              <span style={{ flex: 1, fontWeight: 700, fontSize: "calc(var(--a) * 0.9)", color: "var(--text-1)", textAlign: "left" }}>
                Inbox — Clarificando
              </span>
              <span style={{
                background: "var(--accent-sage)", color: "#fff",
                borderRadius: 99, padding: "1px 8px",
                fontSize: "calc(var(--a) * 0.75)", fontWeight: 700,
              }}>
                {inbox.length}
              </span>
              {inboxOpen
                ? <ChevronUp size={14} style={{ color: "var(--text-3)" }} />
                : <ChevronDown size={14} style={{ color: "var(--text-3)" }} />}
            </button>

            {inboxOpen && inbox.map(item => (
              <div key={item.id} style={{
                backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.78)",
                borderRadius: 14, padding: "12px", marginBottom: 8,
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0 }}>📥</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "calc(var(--a) * 0.9)", color: "var(--text-1)" }}>{item.text}</div>
                    {item.clarifying && (
                      <div style={{ fontSize: "calc(var(--a) * 0.8)", color: "var(--accent-sage)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <AuraIcon size={12} /> Airia clarificando...
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setGtdItems(prev => prev.map(i => i.id === item.id ? { ...i, archived: true } : i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2, flexShrink: 0 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <AuraButtonV2
                  variant="outline"
                  size="sm"
                  onClick={() => clarifyItem(item.id)}
                  disabled={item.clarifying}
                  leftIcon={<AuraIcon size={12} />}
                  style={{ width: "100%", borderRadius: 10, justifyContent: "center" }}
                >
                  {item.clarifying ? "Clarificando..." : "Clarificar com Airia"}
                </AuraButtonV2>
              </div>
            ))}
          </>
        )}

        {/* ── PARKED ────────────────────────────────────── */}
        {activeTab === "acoes" && parked.length > 0 && (
          <>
            <div style={{ height: 8 }} />
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 0 10px", borderBottom: "1px solid rgba(0,0,0,0.07)",
            }}>
              <span style={{ fontSize: "0.9rem" }}>🗂️</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: "calc(var(--a) * 0.9)", color: "var(--text-2)" }}>
                Referência & Algum Dia
              </span>
              <span style={{
                background: "var(--text-3)", color: "#fff",
                borderRadius: 99, padding: "1px 8px",
                fontSize: "calc(var(--a) * 0.75)", fontWeight: 700,
              }}>
                {parked.length}
              </span>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

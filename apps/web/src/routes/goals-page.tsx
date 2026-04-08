// Goals & GTD v8 — Glass design + Next Action highlight + depth
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import { useToast } from "../components/Toast";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useNavigate } from "react-router-dom";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import {
  Plus, Mic, Trash2, Sparkles, ChevronDown, ChevronUp,
  Link, X, Zap, BrainCircuit, Inbox,
} from "lucide-react";
import { AuraIcon } from "../components/AuraIcon";
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

type RouteResult = {
  tipo: "meta" | "proxima_acao" | "inbox";
  titulo: string;
  meta_sugerida: string | null;
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
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        width: 18, height: 18, borderRadius: 6, flexShrink: 0, cursor: "pointer",
        background: done ? "var(--accent-sage)" : isNext ? "rgba(215,137,127,0.15)" : "transparent",
        border: done ? "none" : isNext ? "1.5px solid var(--accent-peach)" : "1.5px solid var(--text-3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}
    >
      {done && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

// ── GoalCard v8 ───────────────────────────────────────────────
function GoalCard({
  goal, colorIndex, onToggleSubtask, onBreakDown, onAddSubtask, onRemove, loadingBreakdown, onJournalReflect,
}: {
  goal: { id: number | string; title: string; completedPct: number; subtasks: Array<{ id: number | string; title: string; done: boolean }> };
  colorIndex: number;
  onToggleSubtask: (subId: number | string) => void;
  onBreakDown: () => void;
  onAddSubtask: (text: string) => void;
  onRemove: () => void;
  loadingBreakdown: boolean;
  onJournalReflect: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const color = GOAL_COLORS[colorIndex % GOAL_COLORS.length];
  const pct = goal.completedPct;
  const done = pct >= 100;
  const doneSubs = goal.subtasks.filter(s => s.done).length;
  // GTD: first uncompleted subtask = Next Action
  const nextActionIdx = goal.subtasks.findIndex(s => !s.done);

  useEffect(() => { if (addingTask) inputRef.current?.focus(); }, [addingTask]);

  return (
    <div style={{
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
          <p style={{
            fontSize: 14, fontWeight: 700, margin: "0 0 6px",
            color: done ? "var(--accent-sage)" : "var(--text-1)",
            textDecoration: done ? "line-through" : "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {done ? "✓ " : ""}{goal.title}
          </p>
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
              <AuraIcon size={14} /> Aura está gerando próximas ações...
            </div>
          )}

          {/* Empty state */}
          {goal.subtasks.length === 0 && !loadingBreakdown && (
            <div style={{
              padding: "10px 12px", borderRadius: 10, marginBottom: 8,
              background: "rgba(0,0,0,0.03)",
              textAlign: "center", color: "var(--text-3)", fontSize: "calc(var(--a) * 0.85)",
            }}>
              Sem próximas ações. Use <strong style={{ color: "var(--accent-peach)" }}>Aura quebrar</strong> para gerar.
            </div>
          )}

          {/* Subtask rows */}
          {goal.subtasks.map((s, idx) => {
            const isNext = idx === nextActionIdx;
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
                    background: isNext && !done ? "rgba(215,137,127,0.06)" : "transparent",
                    border: isNext && !done ? "1px solid rgba(215,137,127,0.20)" : "none",
                    cursor: "pointer", marginBottom: 4,
                    transition: "background 0.15s",
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
              {loadingBreakdown ? "Gerando..." : "Aura quebrar"}
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export function GoalsPage() {
  const { state, addGoal, addSubGoals, toggleSubGoal, removeGoal } = useAuraStore();
  const { showError } = useToast();
  const navigate = useNavigate();
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);
  const isLowPhase = cycleReport.phase === "low" || cycleReport.phase === "depleted";

  const [gtdItems, setGtdItems] = useState<GTDItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("gtd-inbox-v1") || "[]"); } catch { return []; }
  });

  const [captureInput, setCaptureInput] = useState("");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [metasOpen, setMetasOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [loadingBreakdown, setLoadingBreakdown] = useState<number | string | null>(null);
  const [linkingItem, setLinkingItem] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const capturingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("gtd-inbox-v1", JSON.stringify(gtdItems));
  }, [gtdItems]);

  const goals = state.goals;

  const standaloneActions = gtdItems.filter(i =>
    !i.archived && !i.sentToGoal && i.clarified &&
    i.tipo === "proxima_acao" && !i.linkedGoalId
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
        showError("A Aura não conseguiu gerar subtarefas agora.");
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
    const now = Date.now();
    const recentDupe = gtdItems.some(i =>
      i.text.toLowerCase() === text.toLowerCase() &&
      !i.archived &&
      now - new Date(i.capturedAt).getTime() < 10000
    );
    if (recentDupe) { setCaptureInput(""); return; }
    capturingRef.current = true;
    setCaptureInput("");
    setCaptureLoading(true);
    try {
      const res: any = await api.post("/ai/suggest", {
        type: "goal-route",
        context: { capture: text, goals: goals.map(g => g.title) },
      });
      const parsed = parseAiSuggestion<RouteResult>(res.suggestion);

      if (parsed?.tipo === "meta") {
        await addGoal(parsed.titulo || text);
        awardXP(20);
        setMetasOpen(true);
        sessionStorage.setItem("aura-auto-break-goal", parsed.titulo || text);
      } else if (parsed?.tipo === "proxima_acao") {
        const goalMatch = goals.find(g => g.title === parsed.meta_sugerida);
        if (goalMatch) {
          await addSubGoals(goalMatch.id, [parsed.titulo || text]);
          awardXP(10);
        } else {
          const item: GTDItem = {
            id: `gtd-${Date.now()}`, text,
            capturedAt: new Date().toISOString(),
            clarified: true, tipo: "proxima_acao",
            titulo: parsed.titulo || text, meta_sugerida: parsed.meta_sugerida,
          };
          setGtdItems(prev => [item, ...prev]);
          setActionsOpen(true);
          awardXP(5);
        }
      } else {
        const itemId = `gtd-${Date.now()}`;
        const item: GTDItem = { id: itemId, text, capturedAt: new Date().toISOString() };
        setGtdItems(prev => [item, ...prev]);
        setInboxOpen(true);
        setTimeout(() => clarifyItem(itemId), 100);
      }
    } catch {
      const itemId = `gtd-${Date.now()}`;
      setGtdItems(prev => [{ id: itemId, text, capturedAt: new Date().toISOString() }, ...prev]);
      setInboxOpen(true);
    } finally {
      setCaptureLoading(false);
      capturingRef.current = false;
    }
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

  async function linkToGoal(itemId: string, goalId: number | string) {
    const item = gtdItems.find(i => i.id === itemId);
    if (!item) return;
    await addSubGoals(goalId, [item.titulo || item.text]);
    setGtdItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, linkedGoalId: goalId, sentToGoal: true } : i
    ));
    setLinkingItem(null);
    awardXP(5);
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

        {/* ── Capture bar — glass com borda visível ────────── */}
        <div style={{
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          background: "rgba(255,255,255,0.70)",
          border: "1px solid rgba(255,255,255,0.85)",
          borderRadius: 18, padding: "10px 12px", marginBottom: 20,
          display: "flex", gap: 8, alignItems: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
        }}>
          {/* Input com borda própria */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center",
            background: "rgba(255,255,255,0.80)",
            border: "1.5px solid rgba(0,0,0,0.10)",
            borderRadius: 12, padding: "0 10px", gap: 6,
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round">
              <line x1="11" y1="5" x2="11" y2="19"/><line x1="5" y1="11" x2="19" y2="11"/>
            </svg>
            <input
              value={captureInput}
              onChange={e => setCaptureInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !captureLoading && handleCapture()}
              placeholder="Capture uma ideia, meta ou tarefa..."
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontSize: "calc(var(--a) * 0.9)", color: "var(--text-1)",
                padding: "9px 0",
              }}
            />
          </div>

          {/* Mic */}
          <button
            onClick={toggleVoice}
            style={{
              background: isRecording ? "var(--accent-peach)" : "rgba(0,0,0,0.05)",
              border: isRecording ? "none" : "1px solid rgba(0,0,0,0.10)",
              cursor: "pointer", color: isRecording ? "#fff" : "var(--text-3)",
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Mic size={15} />
          </button>

          {/* Send */}
          <AuraButtonV2
            variant="primary"
            size="sm"
            onClick={handleCapture}
            disabled={!captureInput.trim() || captureLoading}
            leftIcon={captureLoading ? <AuraIcon size={13} /> : <AuraIcon size={13} />}
            style={{ borderRadius: 12, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {captureLoading ? "..." : "Enviar"}
          </AuraButtonV2>
        </div>

        {/* ── METAS ──────────────────────────────────────── */}
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
              Capture algo acima — a Aura classifica e gera os passos automaticamente 🎯
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
              />
            ))
          )
        )}

        {/* ── PRÓXIMAS AÇÕES standalone ───────────────────── */}
        {standaloneActions.length > 0 && (
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
                Próximas Ações
              </span>
              <span style={{
                background: "var(--accent-sky)", color: "#fff",
                borderRadius: 99, padding: "1px 8px",
                fontSize: "calc(var(--a) * 0.75)", fontWeight: 700,
              }}>
                {standaloneActions.filter(i => !i.done).length}
              </span>
              {actionsOpen
                ? <ChevronUp size={14} style={{ color: "var(--text-3)" }} />
                : <ChevronDown size={14} style={{ color: "var(--text-3)" }} />}
            </button>

            {actionsOpen && standaloneActions.map(item => (
              <div key={item.id}>
                <div style={{
                  backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.78)",
                  borderRadius: 14, padding: "10px 12px", marginBottom: 8,
                  display: "flex", alignItems: "flex-start", gap: 10,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                  opacity: item.done ? 0.6 : 1,
                }}>
                  <TaskBox done={!!item.done} onClick={() => toggleStandaloneAction(item.id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "calc(var(--a) * 0.9)", fontWeight: 500,
                      color: item.done ? "var(--text-3)" : "var(--text-1)",
                      textDecoration: item.done ? "line-through" : "none",
                    }}>
                      {item.titulo || item.text}
                    </div>
                    {item.razao && (
                      <div style={{ fontSize: "calc(var(--a) * 0.78)", color: "var(--text-3)", marginTop: 2 }}>
                        {item.razao}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {!item.done && goals.length > 0 && (
                      <button
                        onClick={() => setLinkingItem(linkingItem === item.id ? null : item.id)}
                        style={{
                          background: linkingItem === item.id ? "var(--accent-sky)" : "rgba(99,152,169,0.10)",
                          border: "1px solid rgba(99,152,169,0.30)",
                          borderRadius: 8, cursor: "pointer",
                          color: linkingItem === item.id ? "#fff" : "var(--accent-sky)",
                          padding: "3px 7px", fontSize: "calc(var(--a) * 0.78)",
                          display: "flex", alignItems: "center", gap: 3, fontWeight: 600,
                        }}
                      >
                        <Link size={11} /> Meta
                      </button>
                    )}
                    <button
                      onClick={() => setGtdItems(prev => prev.map(i => i.id === item.id ? { ...i, archived: true } : i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {linkingItem === item.id && (
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
                        <button key={g.id} onClick={() => linkToGoal(item.id, g.id)}
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
            ))}
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
                        <AuraIcon size={12} /> Aura clarificando...
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
                  {item.clarifying ? "Clarificando..." : "Clarificar com Aura"}
                </AuraButtonV2>
              </div>
            ))}
          </>
        )}

        {/* ── PARKED ────────────────────────────────────── */}
        {parked.length > 0 && (
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


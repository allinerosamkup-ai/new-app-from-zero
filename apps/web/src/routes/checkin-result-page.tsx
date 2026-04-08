import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
// CheckinResult Page v4 — Aura auto-responde ao check-in + fluxo "ajustar meu dia"
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { computeMoodCycle, computeStreak } from '../utils/mood-cycle-engine';
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import { useToast } from "../components/Toast";
import type { MoodOption } from "../features/aura/types";
import { AuraIcon } from "../components/AuraIcon";
import { getClientDayContext } from "../utils/day-context";
import "../styles/aura.css";

type ResultVariant = {
  emoji: string;
  label: string;
  description: string;
  tip: string;
  chipLabel: string;
  bg: string;
  accent: string;
};

const variants: Record<MoodOption, ResultVariant> = {
  focada: {
    emoji: "✨",
    label: "Energia Radiante",
    description: "Humor e energy em equilíbrio. Clareza mental acima da média.",
    tip: "Aproveite o pico para suas tarefas mais importantes antes das 14h.",
    chipLabel: "Focada",
    bg: "linear-gradient(180deg, #F5E9E7 0%, #FAF2F0 50%, #FAF6F2 100%)",
    accent: "var(--accent-peach)",
  },
  equilibrada: {
    emoji: "😌",
    label: "Em Equilíbrio",
    description: "Ritmo tranquilo e constante. Boa base para tarefas do dia.",
    tip: "Comece com tarefas leves e vá aumentando o ritmo gradualmente.",
    chipLabel: "Estável",
    bg: "linear-gradient(180deg, #E6F2EC 0%, #EDF6F2 50%, #FAF6F2 100%)",
    accent: "var(--accent-sage)",
  },
  tensa: {
    emoji: "😰",
    label: "Dia Tenso",
    description: "Tensão elevada detectada. Preste atenção ao seu ritmo.",
    tip: "Faça pausas curtas e evite decisões importantes agora.",
    chipLabel: "Tensa",
    bg: "linear-gradient(180deg, #F3E8E5 0%, #FAF0EE 50%, #FAF6F2 100%)",
    accent: "var(--accent-peach)",
  },
  cansada: {
    emoji: "😴",
    label: "Dia Cansativo",
    description: "Energia baixa hoje. Respeite seu ritmo.",
    tip: "Se possível, inclua 20 min de descanso no seu planner hoje.",
    chipLabel: "Cansada",
    bg: "linear-gradient(180deg, #E6F2EC 0%, #EDF6F2 50%, #FAF6F2 100%)",
    accent: "var(--accent-sage)",
  },
  sensivel: {
    emoji: "🌸",
    label: "Dia Sensível",
    description: "Energia pede cuidado extra. Sensibilidade elevada hoje.",
    tip: "Priorize autocuidado e evite decisões importantes agora.",
    chipLabel: "Delicado",
    bg: "linear-gradient(180deg, #F3E8E5 0%, #FAF0EE 50%, #FAF6F2 100%)",
    accent: "var(--accent-peach)",
  },
  sobrecarregada: {
    emoji: "😤",
    label: "Dia Difícil",
    description: "Indicadores pedem descanso. Sobrecarga detectada.",
    tip: "Cancele o que puder e reserve espaço para recuperação.",
    chipLabel: "Intenso",
    bg: "linear-gradient(180deg, #F0E4E2 0%, #F7EEEC 50%, #FAF6F2 100%)",
    accent: "var(--accent-peach)",
  },
};

type AuraMsg = { message: string; suggestionEmoji: string; suggestion: string };
type AiTask = { title: string; category: string; time: string; discarded: boolean };
type AiPhase = "idle" | "loading" | "preview" | "done";

const CAT_COLOR: Record<string, string> = {
  trabalho: "var(--accent-sky)",
  saude: "var(--accent-sage)",
  autocuidado: "var(--accent-sage)",
  rotina: "var(--accent-peach)",
  social: "var(--social-color)",
};

export function CheckinResultPage() {
  const navigate = useNavigate();
  const { state, addTask, prepareJournalFromMood } = useAuraStore();
  const { showError, showSuccess } = useToast();

  const v = variants[state.mood] ?? variants.equilibrada;
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);
  const dayContext = useMemo(() => getClientDayContext(), []);

  // Aura auto-response ao check-in
  const [auraMsg, setAuraMsg] = useState<AuraMsg | null>(null);
  const [auraMsgLoading, setAuraMsgLoading] = useState(true);
  const auraMsgRan = useRef(false);
  const autoTasksRan = useRef(false);

  const recentHistory = useMemo(
    () => (state.checkinHistory || []).slice(0, 7).map(h => ({ date: h.date, humor: h.humor, energia: h.energia, sono: h.sono })),
    [state.checkinHistory]
  );
  const streak = useMemo(() => computeStreak(state.checkinHistory || []), [state.checkinHistory]);
  const goalTitles = useMemo(
    () => (state.goals || []).filter(g => g.completedPct < 100).map(g => g.title),
    [state.goals]
  );

  useEffect(() => {
    if (auraMsgRan.current) return;
    auraMsgRan.current = true;
    api.post("/ai/suggest", {
      type: "checkin-response",
      context: {
        mood: state.mood,
        moodLabel: v.label,
        moodCycleContext: cycleReport.aiContext,
        checkinHistory: recentHistory,
        nota: state.journal,
        streak,
        hour: dayContext.hour,
        partOfDay: dayContext.partOfDay,
        weekday: dayContext.weekday,
        localDate: dayContext.localDate,
      },
    }).then((res: any) => {
      try {
        const parsed = parseAiSuggestion<AuraMsg>(res.suggestion);
        if (parsed?.message) setAuraMsg(parsed);
      } catch { /* mantém null */ }
    }).catch((error) => {
      console.warn("Aura check-in auto-response failed:", error);
    }).finally(() => setAuraMsgLoading(false));
  }, []);

  const [phase, setPhase] = useState<AiPhase>("idle");
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [savingTasks, setSavingTasks] = useState(false);

  useEffect(() => {
    if (autoTasksRan.current || auraMsgLoading || phase !== "idle") return;
    autoTasksRan.current = true;
    void fetchDayTasks();
  }, [auraMsgLoading, phase]);

  async function fetchDayTasks() {
    setPhase("loading");
    try {
      const res = await api.post("/ai/suggest", {
        type: "day-tasks",
        context: {
          mood: state.mood,
          moodLabel: v.label,
          moodCycleContext: cycleReport.aiContext,
          checkinHistory: recentHistory,
          goals: goalTitles,
          nota: state.journal,
          hour: dayContext.hour,
          partOfDay: dayContext.partOfDay,
          weekday: dayContext.weekday,
          localDate: dayContext.localDate,
        },
      });
      const parsed = parseAiSuggestion<Array<{ title: string; category: string; time: string }>>(res.suggestion);
      setTasks(parsed.slice(0, 3).map((t) => ({ ...t, discarded: false })));
      setPhase("preview");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel gerar ajustes para o dia.");
      setPhase("idle");
    }
  }

  async function regenTask(idx: number) {
    setRegenIdx(idx);
    try {
      const res = await api.post("/ai/suggest", {
        type: "day-tasks",
        context: {
          mood: state.mood,
          moodLabel: v.label,
          moodCycleContext: cycleReport.aiContext,
          checkinHistory: recentHistory,
          goals: goalTitles,
          nota: state.journal,
          hour: dayContext.hour,
          partOfDay: dayContext.partOfDay,
          weekday: dayContext.weekday,
          localDate: dayContext.localDate,
        },
      });
      const parsed = parseAiSuggestion<Array<{ title: string; category: string; time: string }>>(res.suggestion);
      if (parsed[0]) {
        setTasks((prev) =>
          prev.map((t, i) => (i === idx ? { ...parsed[0], discarded: false } : t))
        );
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel regenerar a sugestao.");
    } finally {
      setRegenIdx(null);
    }
  }

  function toggleDiscard(idx: number) {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, discarded: !t.discarded } : t))
    );
  }

  async function confirmTasks() {
    const accepted = tasks.filter((t) => !t.discarded);
    if (accepted.length === 0 || savingTasks) return;

    setSavingTasks(true);
    let savedCount = 0;
    let lastError: unknown = null;

    for (const task of accepted) {
      try {
        const saved = await addTask(task.title, task.time, task.category, { forceSave: true });
        if (saved) {
          savedCount += 1;
        } else {
          lastError = new Error("A tarefa nao foi aceita pelo planner.");
        }
      } catch (error) {
        lastError = error;
      }
    }

    setSavingTasks(false);

    if (savedCount > 0) {
      setPhase("done");
      showSuccess(
        savedCount === accepted.length
          ? "Sugestoes adicionadas ao planner."
          : `${savedCount} sugest${savedCount > 1 ? "oes foram" : "ao foi"} adicionada${savedCount > 1 ? "s" : ""} ao planner.`,
      );
    }

    if (savedCount < accepted.length) {
      showError(
        lastError instanceof Error
          ? lastError.message
          : "Algumas sugestoes nao puderam ser salvas no planner.",
      );
    }
  }

  const acceptedCount = tasks.filter((t) => !t.discarded).length;
  const isMenuthe = v.accent === "var(--accent-sage)";

  return (
    <div className="result-shell" style={{ background: v.bg }}>
      <div className="screen-content result-screen">

        {/* Ícone checkmark */}
        <div
          className="result-hero-icon"
          style={{ background: isMenuthe ? "rgba(180,185,169,.18)" : "rgba(197,165,147,.15)" }}
        >
          {v.emoji}
        </div>

        {/* Título */}
        <div className="result-header">
          <p className="result-header-kicker" style={{ color: v.accent }}>
            CHECK-IN REGISTRADO
          </p>
          <h1 className="result-header-title">{v.label}</h1>
          <p className="result-header-copy">{v.description}</p>
        </div>

        {/* Card Aura diz — resposta personalizada ao check-in */}
        <div className="aura-card" style={{ marginBottom: 16, borderLeft: `3px solid ${v.accent}`, background: "rgba(255,253,250,.9)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: v.accent, margin: 0 }}>
              Aura diz
            </p>
            {!auraMsgLoading && auraMsg && (
              <span style={{ fontSize: 9, background: isMenuthe ? "rgba(180,185,169,.15)" : "var(--accent-peach-a3)", color: v.accent, borderRadius: 999, padding: "2px 6px", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                <AuraIcon size={8} /> IA
              </span>
            )}
            {auraMsgLoading && (
              <span style={{ fontSize: 9, color: "var(--text-3)", fontStyle: "italic" }}>gerando...</span>
            )}
          </div>
          {auraMsgLoading ? (
            <>
              <div style={{ height: 9, width: "92%", background: "rgba(0,0,0,.05)", borderRadius: 5, marginBottom: 5 }} />
              <div style={{ height: 9, width: "75%", background: "rgba(0,0,0,.05)", borderRadius: 5, marginBottom: 5 }} />
              <div style={{ height: 9, width: "60%", background: "rgba(0,0,0,.05)", borderRadius: 5 }} />
            </>
          ) : auraMsg ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65, fontStyle: "italic", marginBottom: 10 }}>
                {auraMsg.message}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: isMenuthe ? "rgba(180,185,169,.08)" : "var(--accent-peach-a3)", border: `1px solid ${v.accent}30` }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{auraMsg.suggestionEmoji}</span>
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>{auraMsg.suggestion}</p>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, fontStyle: "italic" }}>
              {v.tip}
            </p>
          )}
        </div>

        {/* Chip de estado */}
        <div className="result-chip-row">
          <span
            className="result-state-chip"
            style={{
              background: isMenuthe ? "rgba(180,185,169,.15)" : "rgba(197,165,147,.13)",
              color: v.accent,
              border: `1.5px solid ${isMenuthe ? "rgba(180,185,169,.3)" : "rgba(197,165,147,.3)"}`,
            }}
          >
            {v.chipLabel}
          </span>
        </div>

        {/* ─── BLOCO IA ─── */}
        {phase === "idle" && (
          <AuraButtonV2
            useAuraIcon
            className={`btn btn-full ${isMenuthe ? "btn-sage" : "btn-primary"}`}
            onClick={fetchDayTasks}
            style={{ marginBottom: 10 }}
          >
            Ajustar meu dia
          </AuraButtonV2>
        )}

        {phase === "loading" && (
          <div className="aura-panel-soft" style={{
            background: "rgba(255,253,250,.9)", borderRadius: 12, padding: 20,
            marginBottom: 10, textAlign: "center", border: "1.5px solid var(--warm-border)",
          }}>
            <div className="aura-inline-spinner" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13, color: "var(--text-2)", fontStyle: "italic" }}>
              Lendo seu estado e montando sugestões personalizadas...
            </p>
          </div>
        )}

        {(phase === "preview" || phase === "done") && (
          <div style={{
            background: "rgba(255,253,250,.95)", borderRadius: 14, padding: 16,
            marginBottom: 10, border: `1.5px solid ${isMenuthe ? "rgba(180,185,169,.3)" : "rgba(197,165,147,.3)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: v.accent }}>
                Tarefas sugeridas
              </p>
              {phase === "preview" && (
                <p style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {acceptedCount}/{tasks.length} selecionadas
                </p>
              )}
              {phase === "done" && (
                <span style={{ fontSize: 11, color: "var(--accent-sage)", fontWeight: 700 }}>✓ Salvo no Planner</span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: phase === "preview" ? 14 : 0 }}>
              {tasks.map((task, idx) => {
                const cor = CAT_COLOR[task.category] ?? "var(--accent-peach)";
                return (
                  <div key={idx} className="result-task-card" style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: task.discarded ? "rgba(0,0,0,.04)" : "var(--warm-bg)",
                    border: `1.5px solid ${task.discarded ? "var(--warm-border)" : cor + "40"}`,
                    opacity: task.discarded ? 0.5 : 1,
                    transition: "all 150ms",
                  }}>
                    {/* dot cor */}
                    <span className="result-task-dot" style={{ background: cor }} />

                    {/* info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, color: "var(--text-1)",
                        textDecoration: task.discarded ? "line-through" : "none",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {task.title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {task.time} · {task.category}
                      </p>
                    </div>

                    {/* ações */}
                    {phase === "preview" && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {/* regenerar */}
                        <AuraButtonV2
                          onClick={() => regenTask(idx)}
                          disabled={regenIdx === idx}
                          title="Gerar outra sugestão"
                          style={{
                            width: 28, height: 28, borderRadius: 8, border: "1.5px solid var(--warm-border-2)",
                            background: "transparent", cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center", fontSize: 13,
                            opacity: regenIdx === idx ? 0.4 : 1,
                          }}
                        >
                          {regenIdx === idx ? "⏳" : "🔄"}
                        </AuraButtonV2>
                        {/* aceitar / descartar */}
                        <AuraButtonV2
                          onClick={() => toggleDiscard(idx)}
                          title={task.discarded ? "Incluir" : "Descartar"}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            border: `1.5px solid ${task.discarded ? "var(--warm-border)" : "#e05c5c55"}`,
                            background: task.discarded ? "var(--warm-bg)" : "rgba(224,92,92,.08)",
                            cursor: "pointer", display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: 13,
                          }}
                        >
                          {task.discarded ? "↩" : "✕"}
                        </AuraButtonV2>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {phase === "preview" && (
              <div style={{ display: "flex", gap: 8 }}>
                <AuraButtonV2
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => setPhase("idle")}
                >
                  Cancelar
                </AuraButtonV2>
                <AuraButtonV2
                  className={`btn ${isMenuthe ? "btn-sage" : "btn-primary"}`}
                  style={{ flex: 2 }}
                  onClick={confirmTasks}
                  disabled={acceptedCount === 0 || savingTasks}
                >
                  {savingTasks
                    ? "Salvando..."
                    : `Adicionar ${acceptedCount > 0 ? `${acceptedCount} tarefa${acceptedCount > 1 ? "s" : ""}` : ""} ao Planner`}
                </AuraButtonV2>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            background: "rgba(255,253,250,.9)",
            borderRadius: 14,
            border: `1.5px solid ${v.accent}28`,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: v.accent }}>
            Depois do check-in
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
            Se quiser descarregar melhor o que apareceu agora, leve esse estado para o diário e deixe a Aura guardar o resumo da sessão.
          </p>
          <AuraButtonV2
            className="btn btn-ghost btn-full"
            onClick={() => {
              prepareJournalFromMood();
              navigate("/journal");
            }}
          >
            Abrir meu diário
          </AuraButtonV2>
        </div>

        {/* Botões de navegação */}
        <div className="result-nav-stack" style={{ marginTop: phase === "idle" ? 0 : 4 }}>
          {phase !== "idle" && (
            <AuraButtonV2
              className="btn btn-ghost btn-full"
              onClick={() => navigate("/planner")}
            >
              Ver meu Planner
            </AuraButtonV2>
          )}
          <AuraButtonV2
            className={`btn btn-full ${isMenuthe ? "btn-sage" : "btn-primary"}`}
            onClick={() => navigate("/home")}
          >
            Ir para o inicio
          </AuraButtonV2>
        </div>

      </div>
    </div>
  );
}


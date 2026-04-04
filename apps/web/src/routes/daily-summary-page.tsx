// Daily Summary Page v3 — sessão concluída + transformar em tarefas
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import { useToast } from "../components/Toast";
import { labelMood } from "../features/aura/data";
import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
import "../styles/aura.css";

type JTask = { title: string; category: string; time: string; discarded: boolean };

const CAT_COLOR: Record<string, string> = {
  trabalho: "var(--lagune)",
  saude: "var(--menthe)",
  rotina: "var(--nectarine)",
  social: "var(--social-color)",
};

export function DailySummaryPage() {
  const navigate = useNavigate();
  const { state, addTask } = useAuraStore();
  const { showError, showSuccess } = useToast();

  const [phase, setPhase] = useState<"idle" | "loading" | "preview" | "done">("idle");
  const [tasks, setTasks] = useState<JTask[]>([]);
  const [saved, setSaved] = useState(false);

  async function fetchJournalTasks() {
    if (!state.journal) return;
    setPhase("loading");
    try {
      const res = await api.post("/ai/suggest", {
        type: "journal-tasks",
        context: { method: "chat", messages: state.journal },
      });
      const parsed = parseAiSuggestion<Array<{ title: string; category: string; time: string }>>(res.suggestion);
      setTasks(parsed.slice(0, 3).map((t) => ({ ...t, discarded: false })));
      setPhase("preview");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel gerar tarefas do resumo.");
      setPhase("idle");
    }
  }

  function toggleDiscard(idx: number) {
    setTasks((prev) => prev.map((t, i) => i === idx ? { ...t, discarded: !t.discarded } : t));
  }

  function confirmTasks() {
    Promise.all(
      tasks.filter((t) => !t.discarded).map((task) => addTask(task.title, task.time, task.category))
    )
      .then(() => {
        setSaved(true);
        setPhase("done");
        showSuccess("Tarefas adicionadas ao planner.");
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Nao foi possivel salvar as tarefas.");
      });
  }

  const acceptedCount = tasks.filter((t) => !t.discarded).length;

  const moodChips: Record<string, Array<{ emoji: string; label: string }>> = {
    equilibrada: [{ emoji: "😌", label: "Calma" }, { emoji: "🎯", label: "Focada" }, { emoji: "💚", label: "Presente" }],
    focada: [{ emoji: "✨", label: "Radiante" }, { emoji: "🎯", label: "Focada" }, { emoji: "🔥", label: "Produtiva" }],
    tensa: [{ emoji: "😰", label: "Ansiosa" }, { emoji: "💪", label: "Resiliente" }, { emoji: "🌿", label: "Buscando calma" }],
    cansada: [{ emoji: "😴", label: "Cansada" }, { emoji: "🌙", label: "Sensível" }, { emoji: "❤️", label: "Gentil consigo" }],
    sensivel: [{ emoji: "🌸", label: "Sensível" }, { emoji: "❤️", label: "Esperançosa" }, { emoji: "🌿", label: "Cuidadosa" }],
    sobrecarregada: [{ emoji: "😤", label: "Sobrecarregada" }, { emoji: "💪", label: "Determinada" }, { emoji: "🌙", label: "Precisando descanso" }],
  };
  const chips = moodChips[state.mood] || moodChips.equilibrada;

  const synthesisText = state.journal
    ? `"${state.journal.slice(0, 120)}${state.journal.length > 120 ? "..." : ""}"`
    : "Sua sessão foi registrada. Continue acompanhando seus padrões para insights mais profundos.";

  const tags = ["#rotina", "#energia", "#autocuidado"];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
      <div
        className="screen-content"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          padding: "20px",
        }}
      >
        {/* Ícone central */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(180,185,169,.12)",
            border: "2px solid rgba(180,185,169,.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--menthe)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Títulos */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 24,
              fontWeight: 800,
              color: "var(--text-1)",
              marginBottom: 6,
            }}
          >
            Sessão Concluída
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-3)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            O que a IA percebeu: humor {labelMood(state.mood).toLowerCase()}
          </p>
        </div>

        {/* Emotion chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {chips.map((e) => (
            <span
              key={e.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(255,253,249,.82)",
                border: "1px solid rgba(255,255,255,.68)",
                boxShadow: "0 2px 6px rgba(197,165,147,.06)",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--text-1)",
              }}
            >
              {e.emoji} {e.label}
            </span>
          ))}
        </div>

        {/* Theme tags */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
          }}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(197,165,147,.08)",
                color: "var(--text-2)",
                letterSpacing: "0.06em",
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Synthesis card */}
        <div
          style={{
            width: "100%",
            padding: "15px 16px",
            background:
              "linear-gradient(135deg, rgba(197,165,147,.06), rgba(180,185,169,.04))",
            borderLeft: "3px solid var(--nectarine)",
            borderRadius: 13,
          }}
        >
          <p
            style={{
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.65,
            }}
          >
            {synthesisText}
          </p>
        </div>

        {/* ── IA: transformar em tarefas ── */}
        {state.journal && phase === "idle" && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <AuraButtonV2
              variant="primary"
              size="md"
              onClick={fetchJournalTasks}
              leftIcon={<span>✨</span>}
            >
              Gerar
            </AuraButtonV2>
          </div>
        )}

        {phase === "loading" && (
          <div style={{
            width: "100%", padding: "14px 16px", borderRadius: 12, textAlign: "center",
            background: "rgba(255,253,249,.9)", border: "1.5px solid rgba(197,165,147,.2)",
          }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", fontStyle: "italic" }}>
              🤔 Lendo a sessão e montando tarefas...
            </p>
          </div>
        )}

        {(phase === "preview" || phase === "done") && (
          <div style={{
            width: "100%", background: "rgba(255,253,249,.95)", borderRadius: 13,
            border: "1.5px solid rgba(197,165,147,.25)", overflow: "hidden",
          }}>
            <div style={{ padding: "12px 14px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nectarine)" }}>
                  ✨ TAREFAS DO DIÁRIO
                </p>
                {phase === "done" && (
                  <span style={{ fontSize: 11, color: "var(--menthe)", fontWeight: 700 }}>✓ Salvo no Planner</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {tasks.map((task, idx) => {
                  const cor = CAT_COLOR[task.category] ?? "var(--nectarine)";
                  return (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 9,
                      background: task.discarded ? "rgba(0,0,0,.03)" : "var(--warm-bg)",
                      border: `1.5px solid ${task.discarded ? "var(--warm-border)" : cor + "40"}`,
                      opacity: task.discarded ? 0.5 : 1, transition: "all 150ms",
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 12, fontWeight: 600, color: "var(--text-1)",
                          textDecoration: task.discarded ? "line-through" : "none",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{task.title}</p>
                        <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>
                          {task.time} · {task.category}
                        </p>
                      </div>
                      {phase === "preview" && (
                        <AuraButtonV2
                          onClick={() => toggleDiscard(idx)}
                          style={{
                            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                            border: `1.5px solid ${task.discarded ? "var(--warm-border)" : "#e05c5c55"}`,
                            background: task.discarded ? "var(--warm-bg)" : "rgba(224,92,92,.07)",
                            cursor: "pointer", fontSize: 11,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >{task.discarded ? "↩" : "✕"}</AuraButtonV2>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {phase === "preview" && (
              <div style={{ display: "flex", gap: 12, padding: "0 14px 12px", justifyContent: "center" }}>
                <AuraButtonV2
                  variant="outline"
                  size="md"
                  onClick={() => setPhase("idle")}
                >
                  Voltar
                </AuraButtonV2>
                <AuraButtonV2
                  variant="primary"
                  size="md"
                  onClick={confirmTasks}
                  disabled={acceptedCount === 0}
                >
                  Adicionar ao Planner
                </AuraButtonV2>
              </div>
            )}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", width: "100%", marginTop: "12px" }}>
          <AuraButtonV2
            variant="ghost"
            size="md"
            onClick={() => navigate("/planner")}
          >
            Planner
          </AuraButtonV2>
          <AuraButtonV2
            variant="primary"
            size="md"
            onClick={() => navigate("/home")}
          >
            Início
          </AuraButtonV2>
        </div>
      </div>
    </div>
  );
}

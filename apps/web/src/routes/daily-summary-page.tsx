// Daily Summary Page v3 — sessão concluída + transformar em tarefas
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import { useToast } from "../components/Toast";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { AuraIcon } from "../components/AuraIcon";
import { buildDailyCloseSummary } from "./daily-summary-page.helpers";
import "../styles/aura.css";

type JTask = { title: string; category: string; time: string; discarded: boolean };

const CAT_COLOR: Record<string, string> = {
  trabalho: "var(--accent-sky)",
  saude: "var(--accent-sage)",
  rotina: "var(--accent-peach)",
  social: "var(--social-color)",
};

export function DailySummaryPage() {
  const navigate = useNavigate();
  const { state, addTask } = useAuraStore();
  const { showError, showSuccess } = useToast();

  const [phase, setPhase] = useState<"idle" | "loading" | "preview" | "done">("idle");
  const [tasks, setTasks] = useState<JTask[]>([]);
  const [, setSaved] = useState(false);
  const closeSummary = buildDailyCloseSummary(state);

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
      tasks.filter((t) => !t.discarded).map((task) => addTask(task.title, task.time, task.category, { forceSave: true }))
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
          <AuraIcon size={32} style={{ color: "var(--accent-sage)" }} />
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
            Fechamento do dia
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-3)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {closeSummary.hasData ? closeSummary.headline : "Vamos criar a primeira pista real do seu ritmo."}
          </p>
        </div>

        {closeSummary.hasData ? (
          <>
            <div
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {[
                { label: "Feitas", value: closeSummary.stats.completedTasks },
                { label: "Pendentes", value: closeSummary.stats.pendingTasks },
                { label: "Check-ins", value: closeSummary.stats.checkins },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    borderRadius: 14,
                    background: "rgba(255,253,249,.9)",
                    border: "1.5px solid rgba(197,165,147,.18)",
                    padding: "12px 10px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 850, color: "var(--text-1)" }}>{stat.value}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 750, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {closeSummary.evidence.length > 0 && (
              <div
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "rgba(150,199,179,.08)",
                  border: "1.5px solid rgba(150,199,179,.22)",
                }}
              >
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: "var(--accent-sage)", textTransform: "uppercase", letterSpacing: ".12em" }}>
                  Base real de hoje
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {closeSummary.evidence.slice(0, 4).map((item) => (
                    <p key={item} style={{ margin: 0, fontSize: 12, color: "var(--text-2)", lineHeight: 1.45 }}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {closeSummary.tomorrowAdjustments.length > 0 && (
              <div
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 16,
                  background: "#fff",
                  border: "1.5px solid var(--warm-border)",
                  boxShadow: "0 6px 16px rgba(31,42,54,0.04)",
                }}
              >
                <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 850, color: "var(--accent-peach)", textTransform: "uppercase", letterSpacing: ".12em" }}>
                  Levar para amanha
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {closeSummary.tomorrowAdjustments.map((item) => (
                    <button
                      key={`${item.source}-${item.title}`}
                      type="button"
                      onClick={() => navigate(item.path)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "1.5px solid rgba(197,165,147,.18)",
                        background: "rgba(255,251,246,.72)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text-1)" }}>{item.title}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.45 }}>{item.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 16,
              background: "#fff",
              border: "1.5px solid var(--warm-border)",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-2)" }}>
              Sem check-in, planner, habito, meta ou diario, a Airia nao tem base confiavel para fechar o dia.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
              <AuraButtonV2 variant="primary" size="sm" onClick={() => navigate("/checkin")}>Check-in</AuraButtonV2>
              <AuraButtonV2 variant="outline" size="sm" onClick={() => navigate("/planner")}>Planner</AuraButtonV2>
            </div>
          </div>
        )}

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
            borderLeft: "3px solid var(--accent-peach)",
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

        {state.journal && phase === "idle" && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <AuraButtonV2
              variant="primary"
              size="md"
              onClick={fetchJournalTasks}
              useAuraIcon
            >
              Extrair possiveis tarefas do diario
            </AuraButtonV2>
          </div>
        )}

        {phase === "loading" && (
          <div style={{
            width: "100%", padding: "14px 16px", borderRadius: 12, textAlign: "center",
            background: "rgba(255,253,249,.9)", border: "1.5px solid rgba(197,165,147,.2)",
          }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", fontStyle: "italic", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <AuraIcon size={14} className="animate-pulse" /> Lendo a sessão e montando tarefas...
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
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-peach)", display: "flex", alignItems: "center", gap: 4 }}>
                  <AuraIcon size={10} /> TAREFAS DO DIÁRIO
                </p>
                {phase === "done" && (
                  <span style={{ fontSize: 11, color: "var(--accent-sage)", fontWeight: 700 }}>✓ Salvo no Planner</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {tasks.map((task, idx) => {
                  const cor = CAT_COLOR[task.category] ?? "var(--accent-peach)";
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
            {closeSummary.primaryAction.label}
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

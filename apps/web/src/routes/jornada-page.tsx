import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check, Lock, BookOpen, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuraStore } from "../features/aura/store";
import { useLocalizedCopy } from "../i18n";
import { computeMoodCycle, type MoodPhase } from "../utils/mood-cycle-engine";

type JornadaFeature = "journal" | "habits" | "checkin" | "insights" | "goals";

type JornadaStep = {
  n: number;
  slug: string;
  titulo: string;
  tema: string;
  reflexao: string;
  exercicio: string;
  feature: JornadaFeature;
  faseBaixa: string;
};

type JornadaData = {
  steps: JornadaStep[];
  currentStep: number;
  completed: number[];
};

const FEATURE_ROUTE: Record<JornadaFeature, string> = {
  journal: "/journal",
  habits: "/habits",
  checkin: "/checkin",
  insights: "/insights",
  goals: "/goals",
};

const FEATURE_LABEL: Record<JornadaFeature, string> = {
  journal: "Abrir o diário",
  habits: "Ir para hábitos",
  checkin: "Fazer check-in",
  insights: "Ver meus padrões",
  goals: "Abrir meus objetivos",
};

const LOW_PHASES = new Set<MoodPhase>(["low", "depleted"]);

export default function JornadaPage() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state } = useAuraStore();
  const [data, setData] = useState<JornadaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const isLowPhase = useMemo(() => {
    const report = computeMoodCycle(state.checkinHistory || []);
    return LOW_PHASES.has(report.phase);
  }, [state.checkinHistory]);

  useEffect(() => {
    (api.get("/api/jornada") as Promise<JornadaData>)
      .then((d) => { setData(d); setSelected(d.currentStep); })
      .catch(() => setData({ steps: [], currentStep: 1, completed: [] }))
      .finally(() => setLoading(false));
  }, []);

  async function markPracticed(n: number) {
    setSaving(true);
    try {
      const res = await api.post(`/api/jornada/${n}/complete`, {}) as { currentStep: number; completed: number[] };
      setData((cur) => cur ? { ...cur, currentStep: res.currentStep, completed: res.completed } : cur);
      setSelected(res.currentStep <= 13 ? res.currentStep : n);
    } finally {
      setSaving(false);
    }
  }

  const completedSet = new Set(data?.completed ?? []);
  const currentStep = data?.currentStep ?? 1;
  const doneCount = completedSet.size;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--warm-bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-1)", padding: 4 }}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Jornada Interior</h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)" }}>
          {l("Do livro “Além da Solidão” — um passo por vez, no seu ritmo.", "From the book “Beyond Loneliness” — one step at a time, at your pace.")}
          </p>
        </div>
      </div>

      {/* Progresso */}
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>
            {doneCount} de 13 passos
          </span>
          {isLowPhase && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-sage)", background: "rgba(150,199,179,0.12)", borderRadius: 999, padding: "3px 9px" }}>
                {l("modo dia difícil", "difficult-day mode")}
            </span>
          )}
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--warm-border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(doneCount / 13) * 100}%`, background: "var(--accent-peach)", borderRadius: 999, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ height: 64, borderRadius: 16, background: "var(--warm-border)", opacity: 0.5 }} />
          ))
        ) : (
          (data?.steps ?? []).map((step) => {
            const isDone = completedSet.has(step.n);
            const isLocked = step.n > currentStep;
            const isOpen = selected === step.n;
            const accent = isDone ? "var(--accent-sage)" : isLocked ? "var(--text-3)" : "var(--accent-peach)";

            return (
              <div
                key={step.n}
                style={{
                  borderRadius: 18,
                  border: `1.5px solid ${isOpen ? accent + "55" : "var(--warm-border)"}`,
                  background: isLocked ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.92)",
                  opacity: isLocked ? 0.7 : 1,
                  overflow: "hidden",
                  transition: "all 0.2s",
                }}
              >
                <button
                  onClick={() => !isLocked && setSelected(isOpen ? null : step.n)}
                  disabled={isLocked}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    border: "none", background: "transparent", cursor: isLocked ? "default" : "pointer", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isDone ? accent : "transparent",
                    border: `2px solid ${accent}`, color: isDone ? "#fff" : accent,
                    fontSize: 13, fontWeight: 800,
                  }}>
                    {isDone ? <Check size={16} strokeWidth={3} /> : isLocked ? <Lock size={13} /> : step.n}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{step.titulo}</p>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{step.tema}</p>
                  </div>
                </button>

                {isOpen && !isLocked && (
                  <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-2)", fontStyle: "italic" }}>
                      “{step.reflexao}”
                    </p>
                    <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(134,183,154,0.06)", border: "1px solid rgba(134,183,154,0.18)" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-peach-ink)" }}>
                        {isLowPhase ? l("Hoje, só isto", "Just this today") : l("Seu passo de hoje", "Your step today")}
                      </p>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--text-1)", fontWeight: 600 }}>
                        {isLowPhase ? step.faseBaixa : step.exercicio}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => navigate(FEATURE_ROUTE[step.feature])}
                        style={{
                          flex: 1, minHeight: 44, borderRadius: 999, border: "none",
                          background: "var(--accent-peach)", color: "#fff", fontSize: 13, fontWeight: 800,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        {FEATURE_LABEL[step.feature]} <ArrowRight size={15} />
                      </button>
                      {!isDone && (
                        <button
                          onClick={() => markPracticed(step.n)}
                          disabled={saving}
                          style={{
                            minHeight: 44, padding: "0 16px", borderRadius: 999,
                            border: "1.5px solid var(--accent-sage)", background: "transparent",
                            color: "var(--accent-sage)", fontSize: 13, fontWeight: 800,
                            cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, whiteSpace: "nowrap",
                          }}
                        >
                          Pratiquei
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {!loading && (
          <div style={{ marginTop: 12, padding: "16px", borderRadius: 16, background: "rgba(150,199,179,0.07)", border: "1px solid rgba(150,199,179,0.2)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <BookOpen size={16} color="var(--accent-sage)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "var(--text-2)" }}>
          {l("Esta jornada não termina — você revisita os passos conforme seu humor cicla. Autoconhecimento é prática, não curso que se conclui.", "This journey does not end — you revisit the steps as your mood cycles. Self-knowledge is a practice, not a course you finish.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

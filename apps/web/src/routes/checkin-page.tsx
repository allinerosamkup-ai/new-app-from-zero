// Checkin Page v5 — wizard multi-step (4 telas)
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import type { MoodOption } from "../features/aura/types";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { trackEvent } from "../lib/track";
import { getClientDayContext } from "../utils/day-context";
import { ChevronLeft, Check } from "lucide-react";
import "../styles/aura.css";
import "../styles/editorial.css";

// ─── Slider auxiliar ──────────────────────────────────────────────────────────
function ScrubSlider({
  label,
  emoji,
  value,
  onChange,
  color,
}: {
  label: string;
  emoji: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pct = ((value - 1) / 9) * 100;

  function valueFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return value;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(1 + ratio * 9);
  }

  function handlePointer(clientX: number) {
    onChange(valueFromClientX(clientX));
  }

  function buildLabels() {
    return Array.from({ length: 10 }, (_, index) => index + 1);
  }

  return (
    <div className="checkin-slider-wrap">
      <div className="checkin-slider-label">
        <span className="title">{emoji} {label}</span>
        <span className="val" style={{ color }}>{value}</span>
      </div>
      <div
        style={{ position: "relative", touchAction: "none" }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          handlePointer(event.clientX);
        }}
      >
        <div ref={trackRef} style={{ width: "100%", height: "10px", background: `${color}22`, borderRadius: "999px", position: "relative", overflow: "visible" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: "999px", background: color }} />
          <div style={{ width: "24px", height: "24px", background: "#fff", border: `2px solid ${color}`, borderRadius: "50%", position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%, -50%)", boxShadow: `0 6px 16px ${color}44`, pointerEvents: "none" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 0, marginTop: 10, padding: "0 2px" }}>
          {buildLabels().map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 10,
                fontWeight: value === item ? 800 : 600,
                color: value === item ? color : "var(--text-3)",
                cursor: "pointer",
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionalSlider(props: {
  label: string; emoji: string; value: number; onChange: (v: number) => void; color: string;
}) {
  return <ScrubSlider {...props} />;
}

function getMoodEmoji(value: number) {
  if (value <= 2) return "😞";
  if (value <= 4) return "😕";
  if (value <= 6) return "😌";
  if (value <= 8) return "🙂";
  return "✨";
}

function getEnergyEmoji(value: number) {
  if (value <= 2) return "🪫";
  if (value <= 4) return "😴";
  if (value <= 6) return "⚡";
  if (value <= 8) return "💪";
  return "🔥";
}

// ─── Dados ───────────────────────────────────────────────────────────────────
const FACTORS = [
  // Positivos
  { id: "good_sleep",           label: "Sono bom",                icon: "😴", category: "saúde"     },
  { id: "exercise",             label: "Exercício",               icon: "🏋️", category: "saúde"     },
  { id: "healthy_meal",         label: "Alimentação",             icon: "🥗", category: "saúde"     },
  { id: "fresh_air",            label: "Ar fresco",               icon: "🌿", category: "saúde"     },
  { id: "good_talk",            label: "Boa conversa",            icon: "💬", category: "social"    },
  { id: "kind_words",           label: "Palavras gentis",         icon: "❤️", category: "social"    },
  { id: "support",              label: "Apoio recebido",          icon: "🤝", category: "social"    },
  { id: "small_win",            label: "Pequena vitória",         icon: "⭐", category: "trabalho"  },
  { id: "finished_task",        label: "Tarefa concluída",        icon: "✅", category: "trabalho"  },
  { id: "feeling_valued",       label: "Me senti valorizada",     icon: "🏆", category: "trabalho"  },
  { id: "music",                label: "Música",                  icon: "🎵", category: "lazer"     },
  { id: "time_outside",         label: "Tempo ao ar livre",       icon: "🌳", category: "lazer"     },
  { id: "hobby",                label: "Hobby",                   icon: "🎨", category: "lazer"     },
  { id: "self_trust",           label: "Confiança em mim",        icon: "💪", category: "pessoal"   },
  { id: "rest",                 label: "Descanso",                icon: "🛋️", category: "pessoal"   },
  // Negativos
  { id: "stuck",                label: "Travada/o",               icon: "🪨", category: "negativo"  },
  { id: "relationship_conflict",label: "Briga no relacionamento", icon: "💔", category: "negativo"  },
  { id: "overwhelmed",          label: "Sobrecarga mental",       icon: "🌊", category: "negativo"  },
  { id: "loneliness",           label: "Solidão",                 icon: "🫥", category: "negativo"  },
  { id: "bad_sleep",            label: "Sono ruim",               icon: "😵", category: "negativo"  },
  { id: "work_pressure",        label: "Pressão no trabalho",     icon: "⚙️", category: "negativo"  },
  { id: "financial_stress",     label: "Estresse financeiro",     icon: "💸", category: "negativo"  },
  { id: "bad_news",             label: "Má notícia",              icon: "📰", category: "negativo"  },
];

const emotionToMood: Record<string, MoodOption> = {
  radiant:   "focada",
  calm:      "equilibrada",
  happy:     "equilibrada",
  anxious:   "tensa",
  tired:     "cansada",
  focused:   "focada",
  sad:       "sensivel",
  angry:     "sobrecarregada",
  stressed:  "tensa",
  sensitive: "sensivel",
  exhausted: "cansada",
  agitated:  "sobrecarregada",
};

const emotions = [
  { id: "radiant",   emoji: "✨", label: "Radiante"   },
  { id: "calm",      emoji: "😌", label: "Calma"      },
  { id: "happy",     emoji: "🙂", label: "Feliz"      },
  { id: "anxious",   emoji: "😰", label: "Ansiosa"    },
  { id: "tired",     emoji: "😴", label: "Cansada"    },
  { id: "focused",   emoji: "🔥", label: "Focada"     },
  { id: "sad",       emoji: "😢", label: "Triste"     },
  { id: "angry",     emoji: "😤", label: "Irritada"   },
  { id: "stressed",  emoji: "😵", label: "Estressada" },
  { id: "sensitive", emoji: "🌙", label: "Sensível"   },
  { id: "exhausted", emoji: "😩", label: "Exausta"    },
  { id: "agitated",  emoji: "🫨", label: "Agitada"    },
];

export const INITIAL_EMOTIONS_SELECTED: string[] = [];

export function toggleEmotionSelection(current: string[], emotionId: string, maxSelections = 3): string[] {
  if (current.includes(emotionId)) {
    return current.filter((id) => id !== emotionId);
  }

  if (current.length >= maxSelections) {
    return current;
  }

  return [...current, emotionId];
}

type FlowIntensity = "leve" | "moderado" | "intenso";

const symptomLevels_opts = [
  { label: "Leve",     v: 1 as 1 | 2 | 3 },
  { label: "Moderada", v: 2 as 1 | 2 | 3 },
  { label: "Intensa",  v: 3 as 1 | 2 | 3 },
];

type DetailCardKey = "sono" | "fisico" | "social" | "ciclo";

function DetailCard({ emoji, title, summary, active, onClick }: {
  emoji: string; title: string; summary: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "74px",
        borderRadius: "14px",
        border: `1.5px solid ${active ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
        background: active ? "var(--accent-peach-a3)" : "rgba(255,255,255,.72)",
        padding: "12px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        textAlign: "left",
        cursor: "pointer",
        boxShadow: active ? "0 12px 24px rgba(243,176,140,.14)" : "0 10px 20px rgba(0,0,0,.05)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div style={{
        width: "38px", height: "38px", borderRadius: "12px",
        background: active ? "rgba(255,255,255,.75)" : "rgba(243,176,140,.16)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "18px", flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--text-1)" }}>{title}</p>
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-3)", lineHeight: 1.4 }}>{summary}</p>
      </div>
    </button>
  );
}

// ─── Wizard step configs ──────────────────────────────────────────────────────
const STEPS: Array<{ labelKey: string; hintKey: string; label: string; hint: string }> = [
  { labelKey: "checkin.humorEnergyTitle",  hintKey: "checkin.humorEnergySubtitle",  label: "Humor & Energia", hint: "Como seu corpo se sente agora?" },
  { labelKey: "checkin.step2Title",        hintKey: "checkin.step2Subtitle",        label: "Emoção",          hint: "Que emoção domina o momento?" },
  { labelKey: "checkin.step3Title",        hintKey: "checkin.step3Subtitle",        label: "Influências",     hint: "O que contribuiu pro seu estado?" },
  { labelKey: "checkin.step4Title",        hintKey: "checkin.step4Subtitle",        label: "Detalhes",        hint: "Opcional — mas muito útil pra Airia." },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export function CheckinPage() {
  const { t } = useTranslation();
  const { setMood, addCheckin } = useAuraStore();
  const navigate = useNavigate();

  // ── wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [isSaving, setIsSaving] = useState(false);

  // ── step 1: humor + energia
  const [humor, setHumor] = useState(7);
  const [energia, setEnergia] = useState(6);

  // ── step 2: emoção (até 3)
  const [emotionsSelected, setEmotionsSelected] = useState<string[]>(INITIAL_EMOTIONS_SELECTED);

  // ── step 3: fatores
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);

  // ── step 4: detalhes + nota
  const [sono, setSono] = useState(6);
  const [fisico, setFisico] = useState(6);
  const [social, setSocial] = useState(6);
  const [activeDetail, setActiveDetail] = useState<DetailCardKey | null>(null);
  const [detailEnabled, setDetailEnabled] = useState<{ sono: boolean; fisico: boolean; social: boolean }>({
    sono: false, fisico: false, social: false,
  });
  const [showCiclo, setShowCiclo] = useState(false);
  const [isFlowing, setIsFlowing] = useState<boolean | null>(null);
  const [flowDay, setFlowDay] = useState<number | null>(null);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | null>(null);
  const [symptomLvls, setSymptomLvls] = useState<{ colica?: 1|2|3; dorCabeca?: 1|2|3 }>({});
  // Diagnostic-aware optional signals (TDAH, bipolar, ciclotimia)
  const [showSinais, setShowSinais] = useState(false);
  const [medTaken, setMedTaken] = useState<boolean | null>(null);
  const [focusScore, setFocusScore] = useState<number | null>(null);
  const [hyperfocus, setHyperfocus] = useState<boolean | null>(null);
  const [dayType, setDayType] = useState<'up' | 'down' | 'mixed' | 'stable' | null>(null);
  const [mixedNote, setMixedNote] = useState("");
  const [note, setNote] = useState("");

  const dayContext = useMemo(() => getClientDayContext(), []);
  const touchStartX = useRef<number | null>(null);

  function toggleDetailCard(card: DetailCardKey) {
    if (card === "ciclo") {
      const nextActive = activeDetail === "ciclo" ? null : "ciclo";
      setActiveDetail(nextActive);
      setShowCiclo(nextActive === "ciclo");
      return;
    }
    setDetailEnabled((cur) => {
      const key = card as "sono" | "fisico" | "social";
      const shouldDisable = activeDetail === card && cur[key];
      return { ...cur, [key]: shouldDisable ? false : true };
    });
    setActiveDetail((cur) => (cur === card ? null : card));
    setShowCiclo(false);
  }

  function goNext() {
    setSlideDir(1);
    setWizardStep((s) => s + 1);
  }

  function goBack() {
    setSlideDir(-1);
    setWizardStep((s) => s - 1);
  }

  async function handleFinish() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const primaryEmotion = emotionsSelected[0] ?? "calm";
      const mood = emotionToMood[primaryEmotion] ?? "equilibrada";
      setMood(mood);
      const checkinAI = await addCheckin({
        humor,
        energia,
        emotion: primaryEmotion,
        emotions: emotionsSelected,
        sono: detailEnabled.sono ? sono : undefined,
        fisico: detailEnabled.fisico ? fisico : undefined,
        social: detailEnabled.social ? social : undefined,
        factors: selectedFactors.length > 0 ? selectedFactors : undefined,
        note: note.trim() || undefined,
        isFlowing: isFlowing ?? undefined,
        flowDay: flowDay ?? undefined,
        flowIntensity: flowIntensity ?? undefined,
        symptomLevels: Object.keys(symptomLvls).length > 0 ? symptomLvls : undefined,
        medicationTakenToday: medTaken,
        focusScore: focusScore,
        hyperfocusOccurred: hyperfocus,
        mixedEpisodeNote: mixedNote.trim() || null,
        dayType,
      });
      trackEvent("checkin_completed", {
        step_count: STEPS.length,
        emotions_count: emotionsSelected.length,
        factors_count: selectedFactors.length,
        has_note: Boolean(note.trim()),
        optional_details_count: [detailEnabled.sono, detailEnabled.fisico, detailEnabled.social, showCiclo].filter(Boolean).length,
      });
      navigate("/checkin-result", { state: checkinAI ?? undefined });
    } catch (err) {
      console.error("Erro ao registrar check-in:", err);
    } finally {
      setIsSaving(false);
    }
  }

  const animClass = slideDir === 1 ? "checkin-step-enter-fwd" : "checkin-step-enter-bwd";

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)", paddingBottom: 32 }}>
      <style>{`
        @keyframes checkin-fwd {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes checkin-bwd {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .checkin-step-enter-fwd { animation: checkin-fwd 0.28s cubic-bezier(0.22,1,0.36,1) forwards; }
        .checkin-step-enter-bwd { animation: checkin-bwd 0.28s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>

      <div className="screen-content">

        {/* ── Back button + date ─────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, marginTop: 8 }}>
          <button
            onClick={() => wizardStep > 1 ? goBack() : navigate(-1)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-1)", padding: 4, display: "flex", alignItems: "center" }}
          >
            <ChevronLeft size={22} />
          </button>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, fontWeight: 600 }}>
            {dayContext.dateWithWeekdayLabel}
          </p>
        </div>

        {/* ── Progress dots ──────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          {STEPS.map((_, i) => {
            const n = i + 1;
            const isDone = n < wizardStep;
            const isActive = n === wizardStep;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "unset" }}>
                <div style={{
                  width: isActive ? 28 : 22,
                  height: 22,
                  borderRadius: 11,
                  background: isDone
                    ? "var(--accent-sage)"
                    : isActive
                      ? "var(--accent-peach)"
                      : "var(--warm-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.25s ease",
                  flexShrink: 0,
                }}>
                  {isDone
                    ? <Check size={11} color="#fff" strokeWidth={3} />
                    : <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? "#fff" : "var(--text-3)" }}>{n}</span>
                  }
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: 2,
                    marginLeft: 6,
                    background: isDone ? "var(--accent-sage)" : "var(--warm-border)",
                    borderRadius: 1,
                    transition: "background 0.3s ease",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step heading ───────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 4px" }}>
            {t("checkin.stepOf", { current: wizardStep, total: STEPS.length })}
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: "var(--text-1)", lineHeight: 1.2 }}>
            {t(STEPS[wizardStep - 1].labelKey, STEPS[wizardStep - 1].label)}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            {t(STEPS[wizardStep - 1].hintKey, STEPS[wizardStep - 1].hint)}
          </p>
        </div>

        {/* ── Step content (animated) ────────────────────────────────── */}
        <div
          key={wizardStep}
          className={animClass}
          onTouchStart={(event) => {
            touchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current;
            const endX = event.changedTouches[0]?.clientX ?? null;
            touchStartX.current = null;
            if (startX == null || endX == null) return;
            const delta = endX - startX;
            if (Math.abs(delta) < 56) return;
            if (delta < 0 && wizardStep < STEPS.length) goNext();
            if (delta > 0 && wizardStep > 1) goBack();
          }}
        >

          {/* STEP 1: Humor + Energia */}
          {wizardStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ScrubSlider label="Humor" emoji="😊" value={humor} onChange={setHumor} color="var(--accent-peach)" />
              <ScrubSlider label="Energia" emoji="⚡" value={energia} onChange={setEnergia} color="var(--accent-sky)" />

              {/* Visual summary */}
              <div style={{
                marginTop: 8,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}>
                {[
                  { label: "Humor", value: humor, color: "var(--accent-peach)", emoji: getMoodEmoji(humor) },
                  { label: "Energia", value: energia, color: "var(--accent-sky)", emoji: getEnergyEmoji(energia) },
                ].map((item) => (
                  <div key={item.label} style={{
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: `${item.color}12`,
                    border: `1.5px solid ${item.color}30`,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 4 }}>{item.emoji}</div>
                    <p style={{ fontSize: 22, fontWeight: 800, color: item.color, margin: "0 0 2px" }}>{item.value}/10</p>
                    <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0, fontWeight: 700, textTransform: "uppercase" }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Emoção — até 3 */}
          {wizardStep === 2 && (
            <div>
              {/* Contador */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                  Selecione até 3 emoções
                </p>
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: emotionsSelected.length === 3 ? "var(--accent-peach)" : "var(--text-3)",
                  background: "var(--warm-border)",
                  padding: "2px 8px", borderRadius: 99,
                }}>
                  {emotionsSelected.length}/3
                </span>
              </div>

              <div className="emotion-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {emotions.map((em) => {
                  const isSelected = emotionsSelected.includes(em.id);
                  const isDisabled = !isSelected && emotionsSelected.length >= 3;
                  return (
                    <button
                      type="button"
                      key={em.id}
                      className={`emotion-chip${isSelected ? " active" : ""}`}
                      onClick={() => {
                        setEmotionsSelected((prev) => toggleEmotionSelection(prev, em.id));
                      }}
                      style={{
                        border: "none",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.35 : 1,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        position: "relative",
                      }}
                    >
                      {isSelected && (
                        <span style={{
                          position: "absolute", top: 3, right: 3,
                          width: 14, height: 14, borderRadius: "50%",
                          background: "var(--accent-peach)", color: "#fff",
                          fontSize: 9, fontWeight: 800, lineHeight: "14px", textAlign: "center",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {emotionsSelected.indexOf(em.id) + 1}
                        </span>
                      )}
                      <span className="emoji">{em.emoji}</span>
                      {em.label}
                    </button>
                  );
                })}
              </div>

              {/* Pills das selecionadas */}
              {emotionsSelected.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {emotionsSelected.map(id => {
                    const em = emotions.find(e => e.id === id);
                    if (!em) return null;
                    return (
                      <div key={id} style={{
                        padding: "6px 12px", borderRadius: 99,
                        background: "var(--accent-peach-a3)",
                        border: "1.5px solid var(--accent-peach)",
                        fontSize: 12, fontWeight: 700, color: "var(--accent-peach-ink)",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        {em.emoji} {em.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Fatores — positivos e negativos */}
          {wizardStep === 3 && (() => {
            const positiveFactors = FACTORS.filter(f => f.category !== "negativo");
            const negativeFactors = FACTORS.filter(f => f.category === "negativo");
            const negSelected = selectedFactors.filter(id => negativeFactors.some(f => f.id === id));

            const FactorChip = ({ f }: { f: typeof FACTORS[0] }) => {
              const isSelected = selectedFactors.includes(f.id);
              const isNeg = f.category === "negativo";
              return (
                <button
                  type="button"
                  key={f.id}
                  onClick={() =>
                    setSelectedFactors((prev) =>
                      isSelected ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "8px 13px",
                    borderRadius: "20px",
                    border: `1.5px solid ${
                      isSelected
                        ? (isNeg ? "#E07070" : "var(--accent-sage)")
                        : "var(--warm-border-2)"
                    }`,
                    background: isSelected
                      ? (isNeg ? "rgba(224,112,112,0.12)" : "rgba(150,199,179,0.14)")
                      : "transparent",
                    color: isSelected
                      ? (isNeg ? "#C44444" : "var(--accent-sage)")
                      : "var(--text-3)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <span style={{ fontSize: "15px", lineHeight: 1 }}>{f.icon}</span>
                  {f.label}
                </button>
              );
            };

            return (
              <div>
                {/* Seção positiva */}
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-sage)", margin: "0 0 10px" }}>
                  O que ajudou hoje? ✨
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: 20 }}>
                  {positiveFactors.map(f => <FactorChip key={f.id} f={f} />)}
                </div>

                {/* Divisor */}
                <div style={{ height: 1, background: "var(--warm-border)", marginBottom: 16 }} />

                {/* Seção negativa */}
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#C44444", margin: "0 0 10px" }}>
                  O que pesou hoje? 🌧️
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: 8 }}>
                  {negativeFactors.map(f => <FactorChip key={f.id} f={f} />)}
                </div>

                {/* Contador */}
                {selectedFactors.length > 0 ? (
                  <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>
                    {selectedFactors.length} fator{selectedFactors.length > 1 ? "es" : ""} selecionado{selectedFactors.length > 1 ? "s" : ""}
                    {negSelected.length > 0 && (
                      <span style={{ color: "#C44444", marginLeft: 6 }}>
                        · {negSelected.length} pesado{negSelected.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                ) : (
                  <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-3)" }}>
                    Nada selecionado — tudo bem, pode pular.
                  </p>
                )}
              </div>
            );
          })()}

          {/* STEP 4: Detalhes + Nota */}
          {wizardStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Detail cards */}
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 10px" }}>
                  Escaneie outras áreas
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                  <DetailCard emoji="🌙" title="Sono"
                    summary={detailEnabled.sono ? `${sono}/10 registrado` : "Toque para registrar"}
                    active={activeDetail === "sono"} onClick={() => toggleDetailCard("sono")} />
                  <DetailCard emoji="💪" title="Corpo"
                    summary={detailEnabled.fisico ? `${fisico}/10 registrado` : "Toque para registrar"}
                    active={activeDetail === "fisico"} onClick={() => toggleDetailCard("fisico")} />
                  <DetailCard emoji="👥" title="Social"
                    summary={detailEnabled.social ? `${social}/10 registrado` : "Toque para registrar"}
                    active={activeDetail === "social"} onClick={() => toggleDetailCard("social")} />
                  <DetailCard emoji="🌸" title="Ciclo menstrual"
                    summary={showCiclo ? "Painel aberto" : "Toque se quiser registrar"}
                    active={activeDetail === "ciclo"} onClick={() => toggleDetailCard("ciclo")} />
                </div>

                {activeDetail === "sono" && (
                  <div style={{ marginTop: "12px" }}>
                    <OptionalSlider label="Como foi seu sono?" emoji="🌙" value={sono}
                      onChange={(v) => { setSono(v); setDetailEnabled((c) => ({ ...c, sono: true })); }}
                      color="var(--accent-sky)" />
                  </div>
                )}
                {activeDetail === "fisico" && (
                  <div style={{ marginTop: "12px" }}>
                    <OptionalSlider label="Como está seu corpo?" emoji="💪" value={fisico}
                      onChange={(v) => { setFisico(v); setDetailEnabled((c) => ({ ...c, fisico: true })); }}
                      color="var(--accent-sage)" />
                  </div>
                )}
                {activeDetail === "social" && (
                  <div style={{ marginTop: "12px" }}>
                    <OptionalSlider label="Como foi sua atividade social?" emoji="👥" value={social}
                      onChange={(v) => { setSocial(v); setDetailEnabled((c) => ({ ...c, social: true })); }}
                      color="var(--social-color)" />
                  </div>
                )}
                {showCiclo && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ background: "var(--accent-peach-a1)", borderRadius: "10px", border: "1px solid rgba(215,137,127,.2)", padding: "14px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "8px" }}>Está menstruada hoje?</p>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                        {[{ label: "Sim", value: true }, { label: "Não", value: false }].map(opt => (
                          <button type="button" key={String(opt.value)}
                            onClick={() => { setIsFlowing(opt.value); if (!opt.value) { setFlowDay(null); setFlowIntensity(null); setSymptomLvls({}); } }}
                            style={{
                              flex: 1, height: "36px", borderRadius: "999px",
                              border: `1.5px solid ${isFlowing === opt.value ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
                              background: isFlowing === opt.value ? "var(--accent-peach-a3)" : "transparent",
                              color: isFlowing === opt.value ? "var(--accent-peach-ink)" : "var(--text-3)",
                              fontWeight: 700, fontSize: "13px", cursor: "pointer",
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {isFlowing && (
                        <>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "8px" }}>Qual dia do fluxo?</p>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                            {[1,2,3,4,5,6,7].map(d => (
                              <button type="button" key={d} onClick={() => setFlowDay(d)}
                                style={{
                                  width: "38px", height: "38px", borderRadius: "50%",
                                  border: `1.5px solid ${flowDay === d ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
                                  background: flowDay === d ? "var(--accent-peach)" : "transparent",
                                  color: flowDay === d ? "#fff" : "var(--text-3)",
                                  fontWeight: 700, fontSize: "12px", cursor: "pointer",
                                }}
                              >{d}º</button>
                            ))}
                          </div>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "8px" }}>Intensidade do fluxo</p>
                          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                            {([
                              { label: "🩸 Leve", value: "leve" },
                              { label: "🩸🩸 Moderado", value: "moderado" },
                              { label: "🩸🩸🩸 Intenso", value: "intenso" },
                            ] as { label: string; value: FlowIntensity }[]).map(fi => (
                              <button type="button" key={fi.value} onClick={() => setFlowIntensity(fi.value)}
                                style={{
                                  flex: 1, padding: "8px 4px", borderRadius: "9px",
                                  border: `1.5px solid ${flowIntensity === fi.value ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
                                  background: flowIntensity === fi.value ? "var(--accent-peach-a3)" : "transparent",
                                  color: flowIntensity === fi.value ? "var(--accent-peach-ink)" : "var(--text-3)",
                                  fontWeight: 600, fontSize: "11px", cursor: "pointer",
                                }}
                              >{fi.label}</button>
                            ))}
                          </div>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "8px" }}>Cólica</p>
                          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                            {symptomLevels_opts.map(s => (
                              <button type="button" key={s.v}
                                onClick={() => setSymptomLvls(prev => ({ ...prev, colica: prev.colica === s.v ? undefined : s.v }))}
                                style={{
                                  flex: 1, padding: "7px 4px", borderRadius: "9px",
                                  border: `1.5px solid ${symptomLvls.colica === s.v ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
                                  background: symptomLvls.colica === s.v ? "var(--accent-peach-a3)" : "transparent",
                                  color: symptomLvls.colica === s.v ? "var(--accent-peach-ink)" : "var(--text-3)",
                                  fontWeight: 600, fontSize: "11px", cursor: "pointer",
                                }}
                              >{s.label}</button>
                            ))}
                          </div>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "8px" }}>Dor de cabeça</p>
                          <div style={{ display: "flex", gap: "8px" }}>
                            {symptomLevels_opts.map(s => (
                              <button type="button" key={s.v}
                                onClick={() => setSymptomLvls(prev => ({ ...prev, dorCabeca: prev.dorCabeca === s.v ? undefined : s.v }))}
                                style={{
                                  flex: 1, padding: "7px 4px", borderRadius: "9px",
                                  border: `1.5px solid ${symptomLvls.dorCabeca === s.v ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
                                  background: symptomLvls.dorCabeca === s.v ? "var(--accent-peach-a3)" : "transparent",
                                  color: symptomLvls.dorCabeca === s.v ? "var(--accent-peach-ink)" : "var(--text-3)",
                                  fontWeight: 600, fontSize: "11px", cursor: "pointer",
                                }}
                              >{s.label}</button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mais sinais (TDAH/bipolaridade/ciclotimia) */}
              <div style={{
                borderRadius: 16,
                border: "1.5px solid var(--warm-border-2)",
                background: "rgba(150,199,179,0.04)",
                padding: "12px 14px",
                marginBottom: 10,
              }}>
                <button
                  type="button"
                  onClick={() => setShowSinais((v) => !v)}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-1)" }}>
                    Mais sinais <span style={{ fontWeight: 500, color: "var(--text-3)" }}>(opcional · TDAH/bipolaridade)</span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>{showSinais ? "▲" : "▼"}</span>
                </button>

                {showSinais && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Tipo de dia */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>Como foi o dia hoje?</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(["up", "down", "mixed", "stable"] as const).map((t) => {
                          const labels = { up: "↑ Pra cima", down: "↓ Pra baixo", mixed: "↕ Misto", stable: "= Estável" };
                          const active = dayType === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setDayType(active ? null : t)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 999,
                                border: `1.5px solid ${active ? "var(--accent-peach)" : "rgba(176,180,196,.32)"}`,
                                background: active ? "var(--accent-peach-a3)" : "rgba(255,255,255,.7)",
                                color: active ? "var(--accent-peach-ink)" : "var(--text-2)",
                                fontSize: 12,
                                fontWeight: active ? 800 : 600,
                                cursor: "pointer",
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                              }}
                            >
                              {labels[t]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Foco TDAH */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>
                        Foco hoje (1-10)
                      </p>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                          const active = focusScore === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setFocusScore(active ? null : n)}
                              style={{
                                flex: 1,
                                padding: "6px 0",
                                borderRadius: 8,
                                border: `1.5px solid ${active ? "var(--menthe, #96C7B3)" : "rgba(176,180,196,.32)"}`,
                                background: active ? "rgba(150,199,179,.18)" : "rgba(255,255,255,.7)",
                                color: active ? "var(--text-1)" : "var(--text-3)",
                                fontSize: 11,
                                fontWeight: active ? 800 : 500,
                                cursor: "pointer",
                              }}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hyperfocus + Medication toggles */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>Hiperfoco hoje?</p>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[
                            { l: "Sim", v: true },
                            { l: "Não", v: false },
                          ].map((opt) => {
                            const active = hyperfocus === opt.v;
                            return (
                              <button
                                key={opt.l}
                                type="button"
                                onClick={() => setHyperfocus(active ? null : opt.v)}
                                style={{
                                  flex: 1,
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  border: `1.5px solid ${active ? "var(--accent-peach)" : "rgba(176,180,196,.32)"}`,
                                  background: active ? "var(--accent-peach-a3)" : "rgba(255,255,255,.7)",
                                  color: active ? "var(--accent-peach-ink)" : "var(--text-2)",
                                  fontSize: 11,
                                  fontWeight: active ? 800 : 600,
                                  cursor: "pointer",
                                }}
                              >
                                {opt.l}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>Medicação hoje?</p>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[
                            { l: "Sim", v: true },
                            { l: "Não", v: false },
                          ].map((opt) => {
                            const active = medTaken === opt.v;
                            return (
                              <button
                                key={opt.l}
                                type="button"
                                onClick={() => setMedTaken(active ? null : opt.v)}
                                style={{
                                  flex: 1,
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  border: `1.5px solid ${active ? "var(--menthe, #96C7B3)" : "rgba(176,180,196,.32)"}`,
                                  background: active ? "rgba(150,199,179,.18)" : "rgba(255,255,255,.7)",
                                  color: active ? "var(--text-1)" : "var(--text-2)",
                                  fontSize: 11,
                                  fontWeight: active ? 800 : 600,
                                  cursor: "pointer",
                                }}
                              >
                                {opt.l}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Mixed episode note (only if dayType=mixed) */}
                    {dayType === "mixed" && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>
                          O que tá misto?
                        </p>
                        <input
                          type="text"
                          value={mixedNote}
                          maxLength={500}
                          onChange={(e) => setMixedNote(e.target.value)}
                          placeholder="Ex.: energia alta, humor baixo"
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1.5px solid rgba(176,180,196,.32)",
                            background: "rgba(255,255,255,.85)",
                            fontSize: 12,
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            outline: "none",
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nota do dia */}
              <div style={{
                borderRadius: 16,
                border: note.trim() ? "1.5px solid rgba(150,199,179,0.55)" : "1.5px solid var(--accent-peach)",
                background: note.trim() ? "rgba(150,199,179,0.06)" : "rgba(215,137,127,0.05)",
                padding: "14px 14px 10px",
                transition: "border-color 0.2s, background 0.2s",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: note.trim() ? "var(--accent-sage)" : "var(--accent-peach)", margin: "0 0 8px" }}>
                  ✏ Nota do dia
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Um pensamento, uma situação... vai direto para o seu diário."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0",
                    borderRadius: 0,
                    border: "none",
                    background: "transparent",
                    fontSize: 13,
                    color: "var(--text-1)",
                    resize: "none",
                    outline: "none",
                    boxSizing: "border-box",
                    lineHeight: 1.6,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                />
                {note.trim() && (
                  <p style={{ fontSize: 11, color: "var(--accent-sage)", fontWeight: 600, marginTop: 6, marginBottom: 0 }}>
                    ✓ Vai para o seu diário de hoje
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation buttons ─────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, marginTop: 32 }}>
          {wizardStep > 1 && (
            <button
              type="button"
              onClick={goBack}
              style={{
                flex: "none",
                height: 50,
                padding: "0 20px",
                borderRadius: 14,
                border: "1.5px solid var(--warm-border)",
                background: "transparent",
                color: "var(--text-2)",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Voltar
            </button>
          )}
          {wizardStep < STEPS.length ? (
            <AuraButtonV2
              variant="primary"
              onClick={goNext}
              style={{ flex: 1, height: 50, fontSize: 15, fontWeight: 800, borderRadius: 14 }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {t("common.next")}
              </span>
            </AuraButtonV2>
          ) : (
            <AuraButtonV2
              variant="primary"
              onClick={handleFinish}
              disabled={isSaving}
              style={{ flex: 1, height: 50, fontSize: 15, fontWeight: 800, borderRadius: 14 }}
            >
              {isSaving ? "Salvando..." : (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  Finalizar <Check size={16} />
                </span>
              )}
            </AuraButtonV2>
          )}
        </div>

      </div>
    </div>
  );
}

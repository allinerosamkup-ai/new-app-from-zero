// Checkin Page v6 — modo expresso (1 tela, predição) + wizard completo opcional
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveIntlLocale, useLocalizedCopy } from "../i18n";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import type { MoodOption } from "../features/aura/types";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { trackEvent } from "../lib/track";
import { getClientDayContext } from "../utils/day-context";
import {
  baseSlotFromDate,
  deriveExpressEmotion,
  mergeVoiceFactors,
  predictCheckinDefaults,
  QUICK_LEVELS,
} from "./checkin-page.helpers";
import { ChevronLeft, Check, Mic, MicOff, Loader } from "lucide-react";
import { api } from "../lib/api";
import { computeMenstrualPhase } from "../utils/menstrual-phase";
import {
  createTranscriptResultHandler,
  releaseRecognition,
  stopActiveRecognition,
  TranscriptSession,
} from "../features/voice/transcript-session";
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
  // Saúde & corpo
  { id: "slept_well",           label: "Dormi bem (7h+)",                  icon: "😴", category: "saúde"     },
  { id: "slept_little",         label: "Dormi pouco (<6h)",                icon: "🪫", category: "negativo"  },
  { id: "woke_up_night",        label: "Acordei no meio da noite",         icon: "🌑", category: "negativo"  },
  { id: "exercise",             label: "Mexi o corpo",                     icon: "🏃", category: "saúde"     },
  { id: "no_exercise",          label: "Fiquei parada o dia todo",         icon: "🪑", category: "negativo"  },
  { id: "healthy_meal",         label: "Me alimentei bem",                 icon: "🥗", category: "saúde"     },
  { id: "skipped_meals",        label: "Pular refeições",                  icon: "😶", category: "negativo"  },
  { id: "took_meds",            label: "Tomei minha medicação",            icon: "💊", category: "saúde"     },
  { id: "forgot_meds",          label: "Esqueci a medicação",              icon: "🔴", category: "negativo"  },
  { id: "fresh_air",            label: "Ar fresco / saí de casa",          icon: "🌿", category: "saúde"     },
  // Social
  { id: "good_talk",            label: "Boa conversa",                     icon: "💬", category: "social"    },
  { id: "kind_words",           label: "Recebi palavras gentis",           icon: "❤️", category: "social"    },
  { id: "support",              label: "Me senti apoiada",                 icon: "🤝", category: "social"    },
  { id: "social_drain",         label: "Interação social me drenou",       icon: "😮‍💨", category: "negativo" },
  { id: "loneliness",           label: "Solidão",                          icon: "🫥", category: "negativo"  },
  { id: "relationship_conflict",label: "Conflito no relacionamento",       icon: "💔", category: "negativo"  },
  // Trabalho & foco
  { id: "focused_session",      label: "Consegui me concentrar",           icon: "🔥", category: "trabalho"  },
  { id: "hyperfocus_stuck",     label: "Hyperfoco travado — não consigo parar", icon: "🌀", category: "negativo" },
  { id: "small_win",            label: "Pequena vitória",                  icon: "⭐", category: "trabalho"  },
  { id: "finished_task",        label: "Tarefa concluída",                 icon: "✅", category: "trabalho"  },
  { id: "feeling_valued",       label: "Me senti valorizada",              icon: "🏆", category: "trabalho"  },
  { id: "work_pressure",        label: "Pressão / prazo apertado",         icon: "⚙️", category: "negativo"  },
  { id: "plan_changed",         label: "Planos mudaram de última hora",    icon: "🔄", category: "negativo"  },
  { id: "hard_decision",        label: "Decisão difícil pendente",         icon: "⚖️", category: "negativo"  },
  // Mental & emocional
  { id: "dissociated",          label: "Dissociada / no piloto automático",icon: "🌫️", category: "negativo"  },
  { id: "low_dopamine",         label: "Nada parece interessante",         icon: "🩶", category: "negativo"  },
  { id: "stuck",                label: "Paralisada — não consegui começar",icon: "🪨", category: "negativo"  },
  { id: "overwhelmed",          label: "Sobrecarga mental",                icon: "🌊", category: "negativo"  },
  { id: "self_trust",           label: "Confiança em mim",                 icon: "💪", category: "pessoal"   },
  { id: "rest",                 label: "Descanso intencional",             icon: "🛋️", category: "pessoal"   },
  { id: "fiz_algo_gosto",       label: "Fiz algo que gosto",               icon: "🎨", category: "pessoal"   },
  // Financeiro & externo
  { id: "financial_stress",     label: "Estresse financeiro",              icon: "💸", category: "negativo"  },
  { id: "bad_news",             label: "Notícia ruim",                     icon: "📰", category: "negativo"  },
  // Ciclo
  { id: "pms_symptoms",         label: "Sintomas de TPM",                  icon: "🌸", category: "negativo"  },
  { id: "heavy_period",         label: "Ciclo intenso hoje",               icon: "🩸", category: "negativo"  },
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

// Emoção → valores automáticos de humor e energia
const emotionToValues: Record<string, { humor: number; energia: number }> = {
  radiant:   { humor: 9, energia: 8 },
  calm:      { humor: 7, energia: 6 },
  happy:     { humor: 8, energia: 7 },
  anxious:   { humor: 4, energia: 6 },
  tired:     { humor: 5, energia: 3 },
  focused:   { humor: 7, energia: 8 },
  sad:       { humor: 3, energia: 3 },
  angry:     { humor: 3, energia: 7 },
  stressed:  { humor: 4, energia: 5 },
  sensitive: { humor: 5, energia: 4 },
  exhausted: { humor: 4, energia: 2 },
  agitated:  { humor: 4, energia: 7 },
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
  const { t, i18n } = useTranslation();
  const l = useLocalizedCopy();
  const { state, setMood, addCheckin } = useAuraStore();

  // Previsão menstrual automática
  const menstrualPrediction = useMemo(() => computeMenstrualPhase({
    cycleStart: state.cycleStart ?? null,
    cycleLength: state.cycleLength ?? null,
    lutealLength: state.lutealLength ?? null,
  }), [state.cycleStart, state.cycleLength, state.lutealLength]);
  // true = usuária confirmou a previsão; false = corrigiu; null = ainda não respondeu
  const [cycleConfirmed, setCycleConfirmed] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const dayContext = useMemo(
    () => getClientDayContext(new Date(), resolveIntlLocale(i18n.language)),
    [i18n.language],
  );

  // ── express: predição a partir do padrão + ausência como dado
  const prediction = useMemo(
    () => predictCheckinDefaults(state.checkinHistory ?? [], baseSlotFromDate(new Date()), dayContext.localDate),
    // só na montagem: a predição é o ponto de partida, não deve reagir a saves
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // ── mode: expresso (default) ou wizard completo
  const [mode, setMode] = useState<"express" | "wizard">("express");

  // ── express: fase atual (emoção → confirmação → sliders opcionais)
  const [expressPhase, setExpressPhase] = useState<"emotion" | "confirm" | "sliders">("emotion");
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = null;
      }
      stopActiveRecognition(recognitionRef);
    };
  }, []);

  const [showAdjust, setShowAdjust] = useState(false);

  // ── sono em horas (para o wizard detalhado)
  const [sonoHoras, setSonoHoras] = useState(7);

  function startVoiceCheckin() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(t("checkin.voiceRecognitionUnsupported"));
      return;
    }
    if (recognitionRef.current) {
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = null;
      }
      stopActiveRecognition(recognitionRef);
      setIsListening(false);
      return;
    }
    setVoiceError(null);
    setVoiceTranscript("");
    const recognition = new SpeechRecognition();
    recognition.lang = resolveIntlLocale();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    const transcriptSession = new TranscriptSession();

    recognition.onstart = () => setIsListening(true);
    recognition.onerror = () => {
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = null;
      }
      transcriptSession.reset();
      if (!releaseRecognition(recognitionRef, recognition)) return;
      setIsListening(false);
      setVoiceError(t("checkin.voiceHearRetry"));
    };
    recognition.onresult = createTranscriptResultHandler(transcriptSession, (snapshot) => {
      if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
      setVoiceTranscript(snapshot.text);
      voiceSilenceTimerRef.current = setTimeout(() => recognition.stop(), 2500);
    });
    recognition.onend = async () => {
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = null;
      }
      const transcript = transcriptSession.snapshot().finalText;
      transcriptSession.reset();
      if (!releaseRecognition(recognitionRef, recognition)) return;
      setIsListening(false);
      if (!transcript) return;
      setVoiceLoading(true);
      try {
        const result = await api.post("/ai/voice-checkin", { transcript }) as { humor: number | null; energia: number | null; sleepHours: number | null; emotions: string[]; factors: string[]; note: string | null };
        if (result.humor !== null) setHumor(result.humor);
        if (result.energia !== null) setEnergia(result.energia);
        if (result.sleepHours !== null) { setSonoHoras(result.sleepHours); setDetailEnabled(c => ({ ...c, sono: true })); }
        if (result.emotions?.length) setEmotionsSelected(result.emotions.slice(0, 1));
        if (result.factors?.length) setSelectedFactors((current) => mergeVoiceFactors(current, result.factors));
        if (result.note) setNote(result.note);
        setExpressPhase("confirm");
      } catch {
        setVoiceError(t("checkin.voiceEmotionRetry"));
      } finally {
        setVoiceLoading(false);
      }
    };

    recognition.start();
  }



  // ── wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [isSaving, setIsSaving] = useState(false);

  // ── step 1: humor + energia (pré-marcados pela predição; re-entrada usa neutro)
  const [humor, setHumor] = useState(prediction.humor);
  const [energia, setEnergia] = useState(prediction.energia);

  // ── step 2: emoção (até 3)
  const [emotionsSelected, setEmotionsSelected] = useState<string[]>(INITIAL_EMOTIONS_SELECTED);

  // ── step 3: fatores
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);

  // ── step 4: detalhes + nota
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

  async function handleExpressFinish() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Usa emoção da voz se disponível, senão deriva dos números
      const primaryEmotion = emotionsSelected[0] ?? deriveExpressEmotion(humor, energia);
      setMood(emotionToMood[primaryEmotion] ?? "equilibrada");
      const checkinAI = await addCheckin({
        humor,
        energia,
        emotion: primaryEmotion,
        emotions: emotionsSelected.length > 0 ? emotionsSelected : [primaryEmotion],
        // Inclui dados capturados pela voz (ou preenchidos manualmente)
        sleepHours: detailEnabled.sono ? sonoHoras : undefined,
        factors: selectedFactors.length > 0 ? selectedFactors : undefined,
        note: note.trim() || undefined,
      });
      trackEvent("checkin_completed", {
        mode: "express",
        prediction_source: prediction.source,
        prediction_kept: humor === prediction.humor && energia === prediction.energia,
        days_since_last: daysSinceLastCheckin ?? -1,
        has_voice_extras: detailEnabled.sono || selectedFactors.length > 0 || Boolean(note.trim()),
      });
      navigate("/checkin-result", { state: checkinAI ?? undefined });
    } catch (err) {
      console.error("Erro ao registrar check-in expresso:", err);
    } finally {
      setIsSaving(false);
    }
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
        sleepHours: detailEnabled.sono ? sonoHoras : undefined,
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
        mode: "wizard",
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
            onClick={() => {
              if (mode === "express") { navigate(-1); return; }
              if (wizardStep > 1) { goBack(); return; }
              setMode("express");
            }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-1)", padding: 4, display: "flex", alignItems: "center" }}
          >
            <ChevronLeft size={22} />
          </button>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, fontWeight: 600 }}>
            {dayContext.dateWithWeekdayLabel}
          </p>
        </div>

        {/* ── MODO EXPRESSO — emoção primeiro ─────────────────────── */}
        {mode === "express" && (
          <div className="checkin-step-enter-fwd">

            {/* ── Fase: selecionar emoção ── */}
            {expressPhase === "emotion" && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 23, fontWeight: 900, margin: "0 0 4px", color: "var(--text-1)", lineHeight: 1.2 }}>
                    {t("checkin.howNow")}
                  </h2>
                </div>

                {/* ── Voz como entrada principal ── */}
                <button
                  type="button"
                  onClick={startVoiceCheckin}
                  disabled={voiceLoading}
                  style={{
                    width: "100%",
                    padding: "15px 18px",
                    borderRadius: 18,
                    border: isListening ? "2px solid var(--accent-peach)" : "1.5px solid var(--accent-salmon, #f4a896)",
                    background: isListening ? "rgba(215,137,127,0.08)" : "rgba(244,168,150,0.08)",
                    cursor: voiceLoading ? "wait" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    marginBottom: 14,
                    transition: "all 0.2s",
                  }}
                >
                  {voiceLoading ? (
                    <Loader size={20} style={{ color: "var(--accent-peach)", animation: "aura-spin 1s linear infinite" }} />
                  ) : isListening ? (
                    <MicOff size={20} style={{ color: "var(--accent-peach)" }} />
                  ) : (
                    <Mic size={20} style={{ color: "var(--accent-salmon, #f4a896)" }} />
                  )}
                  <div style={{ textAlign: "left" }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: isListening ? "var(--accent-peach)" : "var(--accent-salmon, #e07060)" }}>
                      {voiceLoading ? t("checkin.processing") : isListening ? t("checkin.listeningStop") : t("checkin.speakHow")}
                    </span>
                    {!isListening && !voiceLoading && (
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                        {t("checkin.voiceAutoFill")}
                      </span>
                    )}
                  </div>
                </button>

                {voiceTranscript && !voiceLoading && (
                  <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "-6px 0 12px", lineHeight: 1.5, fontStyle: "italic", padding: "0 4px" }}>
                    "{voiceTranscript.slice(0, 120)}{voiceTranscript.length > 120 ? "..." : ""}"
                  </p>
                )}
                {voiceError && (
                  <p style={{ fontSize: 11.5, color: "var(--accent-peach-ink)", margin: "-6px 0 12px", lineHeight: 1.5, padding: "0 4px" }}>
                    {voiceError}
                  </p>
                )}

                <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 10px", textAlign: "center" }}>
                  {t("checkin.orChooseEmotion")}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                  {emotions.map((em) => (
                    <button
                      key={em.id}
                      type="button"
                      onClick={() => {
                        setEmotionsSelected([em.id]);
                        const vals = emotionToValues[em.id];
                        if (vals) { setHumor(vals.humor); setEnergia(vals.energia); }
                        setExpressPhase("confirm");
                      }}
                      style={{
                        borderRadius: 16,
                        border: "1.5px solid var(--warm-border-2)",
                        background: "rgba(255,255,255,.80)",
                        padding: "14px 8px",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        cursor: "pointer",
                        transition: "all 0.13s ease",
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      <span style={{ fontSize: 28, lineHeight: 1 }}>{em.emoji}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textAlign: "center", lineHeight: 1.2 }}>{t(`checkin.emotions.${em.id}`)}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setExpressPhase("sliders")}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--text-3)", padding: "8px 0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {t("checkin.useNumbers")}
                </button>


              </>
            )}

            {/* ── Fase: confirmação com emoção selecionada ── */}
            {expressPhase === "confirm" && (
              <>
                  <div style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 48, lineHeight: 1 }}>{emotions.find((e) => e.id === emotionsSelected[0])?.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)" }}>{t("checkin.youAre")}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 900, color: "var(--text-1)" }}>{emotionsSelected[0] ? t(`checkin.emotions.${emotionsSelected[0]}`) : ""}</p>
                    </div>
                  </div>

                  {/* Humor + Energia preenchidos pela emoção */}
                  <div style={{
                    display: "flex", gap: 10, marginBottom: 14,
                    padding: "14px 16px", borderRadius: 16,
                    background: "rgba(255,255,255,.8)", border: "1px solid var(--warm-border)",
                  }}>
                    {[
                      { label: "Humor", value: humor, color: "var(--accent-peach)", emoji: getMoodEmoji(humor) },
                      { label: "Energia", value: energia, color: "var(--accent-sky)", emoji: getEnergyEmoji(energia) },
                    ].map(({ label, value, color, emoji }) => (
                      <div key={label} style={{ flex: 1, textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 9, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)" }}>{label}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 26, lineHeight: 1 }}>{emoji}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 900, color }}>{value}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-3)" }}>/10</span></p>
                      </div>
                    ))}
                  </div>

                  {/* Preview do que a voz capturou */}
                  {(detailEnabled.sono || selectedFactors.length > 0 || note.trim()) && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 12, marginBottom: 12,
                      background: "rgba(150,199,179,0.10)", border: "1px solid rgba(150,199,179,0.25)",
                    }}>
                <p style={{ margin: "0 0 5px", fontSize: 9, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-sage)" }}>{t("checkin.voiceCaptured")}</p>
                      {detailEnabled.sono && (
                        <p style={{ margin: "2px 0", fontSize: 12, color: "var(--text-2)" }}>
                          🌙 {l(`${sonoHoras}h de sono`, `${sonoHoras}h of sleep`)}
                        </p>
                      )}
                      {selectedFactors.length > 0 && (
                        <p style={{ margin: "2px 0", fontSize: 12, color: "var(--text-2)" }}>
                          ✨ {l(`${selectedFactors.length} ${selectedFactors.length === 1 ? "fator registrado" : "fatores registrados"}`, `${selectedFactors.length} ${selectedFactors.length === 1 ? "factor recorded" : "factors recorded"}`)}
                        </p>
                      )}
                      {note.trim() && (
                        <p style={{ margin: "2px 0", fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>
                          "{note.trim().slice(0, 70)}{note.trim().length > 70 ? "…" : ""}"
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAdjust(!showAdjust)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-3)", padding: "0 0 12px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {showAdjust ? l("▲ Fechar ajuste", "▲ Close adjustment") : l("Ajustar números", "Adjust values")}
                  </button>

                  {showAdjust && (
                    <div style={{ marginBottom: 14 }}>
                      {[
                        { key: "humor" as const, title: l("Humor", "Mood"), value: humor, onSelect: setHumor, color: "var(--accent-peach)", emojiOf: getMoodEmoji, labels: [l("Pesado", "Heavy"), l("Baixo", "Low"), "Ok", l("Bem", "Good"), l("Ótimo", "Great")] },
                        { key: "energia" as const, title: l("Energia", "Energy"), value: energia, onSelect: setEnergia, color: "var(--accent-sky)", emojiOf: getEnergyEmoji, labels: [l("Zerada", "Empty"), l("Baixa", "Low"), l("Média", "Medium"), l("Boa", "Good"), l("Alta", "High")] },
                      ].map((row) => (
                        <div key={row.key} style={{ marginBottom: 14 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 8px" }}>{row.title}</p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
                            {QUICK_LEVELS.map((level, i) => {
                              const active = row.value === level;
                              return (
                                <button key={level} type="button" onClick={() => row.onSelect(level)} aria-pressed={active}
                                  style={{
                                    minHeight: 52, borderRadius: 12,
                                    border: `1.5px solid ${active ? row.color : "var(--warm-border-2)"}`,
                                    background: active ? `${row.color}1f` : "rgba(255,255,255,.72)",
                                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                                    padding: "6px 2px", transform: active ? "scale(1.04)" : "none", transition: "all 0.15s ease",
                                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                                  }}
                                >
                                  <span style={{ fontSize: 18, lineHeight: 1 }}>{row.emojiOf(level)}</span>
                                  <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, color: active ? "var(--text-1)" : "var(--text-3)" }}>{row.labels[i]}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <AuraButtonV2
                    variant="primary"
                    onClick={handleExpressFinish}
                    disabled={isSaving}
                    style={{ width: "100%", height: 52, fontSize: 15, fontWeight: 800, borderRadius: 14 }}
                  >
                    {isSaving ? "Salvando..." : (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        Registrar <Check size={16} />
                      </span>
                    )}
                  </AuraButtonV2>

                  {/* Modo detalhado — visível e atraente */}
                  <button
                    type="button"
                    onClick={() => { setMode("wizard"); setSlideDir(1); setWizardStep(3); }}
                    style={{
                      width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 14,
                      border: "1.5px solid var(--warm-border-2)", background: "rgba(255,255,255,.8)",
                      cursor: "pointer", textAlign: "left", fontFamily: "'Plus Jakarta Sans', sans-serif",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <div>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "var(--text-1)" }}>{t("checkin.addContext")}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)" }}>Fatores, sono, ciclo, nota…</p>
                    </div>
                    <span style={{ fontSize: 18, color: "var(--text-3)" }}>›</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpressPhase("emotion")}
                    style={{ width: "100%", marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-3)", padding: "6px 0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {t("checkin.changeEmotion")}
                  </button>
              </>
            )}

            {/* ── Fase: sliders numéricos (para quem prefere) ── */}
            {expressPhase === "sliders" && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: "var(--text-1)", lineHeight: 1.2 }}>
                    Humor & Energia
                  </h2>
                <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>{t("checkin.adjustAndConfirm")}</p>
                </div>

                {([
                  { key: "humor" as const, title: l("Humor", "Mood"), icon: "😊", value: humor, onSelect: setHumor, color: "var(--accent-peach)", emojiOf: getMoodEmoji, labels: [l("Pesado", "Heavy"), l("Baixo", "Low"), "Ok", l("Bem", "Good"), l("Ótimo", "Great")] },
                  { key: "energia" as const, title: l("Energia", "Energy"), icon: "⚡", value: energia, onSelect: setEnergia, color: "var(--accent-sky)", emojiOf: getEnergyEmoji, labels: [l("Zerada", "Empty"), l("Baixa", "Low"), l("Média", "Medium"), l("Boa", "Good"), l("Alta", "High")] },
                ]).map((row) => (
                  <div key={row.key} style={{ marginBottom: 18 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 8px" }}>
                      {row.icon} {row.title}
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                      {QUICK_LEVELS.map((level, i) => {
                        const active = row.value === level;
                        return (
                          <button key={level} type="button" onClick={() => row.onSelect(level)} aria-pressed={active}
                            style={{
                              minHeight: 64, borderRadius: 14,
                              border: `1.5px solid ${active ? row.color : "var(--warm-border-2)"}`,
                              background: active ? `${row.color}1f` : "rgba(255,255,255,.72)",
                              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                              padding: "8px 2px", transform: active ? "scale(1.04)" : "none", transition: "all 0.15s ease",
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                            }}
                          >
                            <span style={{ fontSize: 22, lineHeight: 1 }}>{row.emojiOf(level)}</span>
                            <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, color: active ? "var(--text-1)" : "var(--text-3)" }}>{row.labels[i]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {prediction.source !== "neutral" && (
                  <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
                    {t("checkin.presetPattern")}
                  </p>
                )}

                <AuraButtonV2
                  variant="primary"
                  onClick={handleExpressFinish}
                  disabled={isSaving}
                  style={{ width: "100%", height: 52, fontSize: 15, fontWeight: 800, borderRadius: 14 }}
                >
                  {isSaving ? "Salvando..." : (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      Confirmar check-in <Check size={16} />
                    </span>
                  )}
                </AuraButtonV2>

                <button
                  type="button"
                  onClick={() => { setMode("wizard"); setSlideDir(1); setWizardStep(3); }}
                  style={{
                    width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 14,
                    border: "1.5px solid var(--warm-border-2)", background: "rgba(255,255,255,.8)",
                    cursor: "pointer", textAlign: "left", fontFamily: "'Plus Jakarta Sans', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <div>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "var(--text-1)" }}>{t("checkin.addContext")}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)" }}>Fatores, sono, ciclo, nota…</p>
                  </div>
                  <span style={{ fontSize: 18, color: "var(--text-3)" }}>›</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExpressPhase("emotion")}
                  style={{ width: "100%", marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-3)", padding: "6px 0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {t("checkin.backEmotions")}
                </button>
              </>
            )}
          </div>
        )}

        {mode === "wizard" && (<>

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
                  {t("checkin.selectThree")}
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
                      {t(`checkin.emotions.${em.id}`)}
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
                        {em.emoji} {t(`checkin.emotions.${em.id}`)}
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
                  {t(`checkin.factors.${f.id}`)}
                </button>
              );
            };

            return (
              <div>
                {/* Seção positiva */}
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-sage)", margin: "0 0 10px" }}>
                  {t("checkin.helpedToday")}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: 20 }}>
                  {positiveFactors.map(f => <FactorChip key={f.id} f={f} />)}
                </div>

                {/* Divisor */}
                <div style={{ height: 1, background: "var(--warm-border)", marginBottom: 16 }} />

                {/* Seção negativa */}
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#C44444", margin: "0 0 10px" }}>
                  {t("checkin.weighedToday")}
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
                  {t("checkin.scanAreas")}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                  <DetailCard emoji="🌙" title={l("Sono", "Sleep")}
                    summary={detailEnabled.sono ? l(`${sonoHoras}h de sono`, `${sonoHoras}h of sleep`) : l("Quantas horas você dormiu?", "How many hours did you sleep?")}
                    active={activeDetail === "sono"} onClick={() => toggleDetailCard("sono")} />
                  <DetailCard emoji="💪" title={l("Corpo", "Body")}
                    summary={detailEnabled.fisico ? l(`${fisico}/10 registrado`, `${fisico}/10 recorded`) : l("Toque para registrar", "Tap to record")}
                    active={activeDetail === "fisico"} onClick={() => toggleDetailCard("fisico")} />
                  <DetailCard emoji="👥" title={l("Social", "Social")}
                    summary={detailEnabled.social ? l(`${social}/10 registrado`, `${social}/10 recorded`) : l("Toque para registrar", "Tap to record")}
                    active={activeDetail === "social"} onClick={() => toggleDetailCard("social")} />
                  <DetailCard emoji="🌸" title={l("Ciclo menstrual", "Menstrual cycle")}
                    summary={showCiclo ? l("Painel aberto", "Panel open") : l("Toque se quiser registrar", "Tap if you want to record")}
                    active={activeDetail === "ciclo"} onClick={() => toggleDetailCard("ciclo")} />
                </div>

                {activeDetail === "sono" && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", margin: "0 0 10px", letterSpacing: ".1em", textTransform: "uppercase" }}>
                      {t("checkin.sleepQuestion")}
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
                        const isActive = sonoHoras === h && detailEnabled.sono;
                        const isLow = h <= 4;
                        const activeColor = isLow ? "var(--accent-peach)" : "var(--accent-sky)";
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => { setSonoHoras(h); setDetailEnabled((c) => ({ ...c, sono: true })); }}
                            style={{
                              width: 54, height: 54, borderRadius: 14,
                              border: `1.5px solid ${isActive ? activeColor : "var(--warm-border-2)"}`,
                              background: isActive ? `${activeColor}18` : "rgba(255,255,255,.8)",
                              cursor: "pointer", fontSize: 13, fontWeight: 800,
                              color: isActive ? activeColor : "var(--text-2)",
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                              transition: "all .15s",
                            }}
                          >
                            <span>{h}h</span>
                            {h === 3 && <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? activeColor : "var(--text-3)" }}>{l("ou menos", "or less")}</span>}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-3)" }}>
                      {!detailEnabled.sono ? l("Toque para registrar", "Tap to record") : sonoHoras <= 5 ? l("Sono curto — impacta humor e foco.", "Short sleep affects mood and focus.") : sonoHoras >= 8 ? l("Ótimo sono 🌙", "Great sleep 🌙") : l("Sono razoável.", "Reasonable sleep.")}
                    </p>
                  </div>
                )}
                {activeDetail === "fisico" && (
                  <div style={{ marginTop: "12px" }}>
              <OptionalSlider label={t("checkin.bodyQuestion")} emoji="💪" value={fisico}
                      onChange={(v) => { setFisico(v); setDetailEnabled((c) => ({ ...c, fisico: true })); }}
                      color="var(--accent-sage)" />
                  </div>
                )}
                {activeDetail === "social" && (
                  <div style={{ marginTop: "12px" }}>
                    <OptionalSlider label={t("checkin.socialQuestion")} emoji="👥" value={social}
                      onChange={(v) => { setSocial(v); setDetailEnabled((c) => ({ ...c, social: true })); }}
                      color="var(--social-color)" />
                  </div>
                )}
                {showCiclo && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ background: "var(--accent-peach-a1)", borderRadius: "10px", border: "1px solid rgba(215,137,127,.2)", padding: "14px" }}>
                      {/* Previsão automática quando há dados de ciclo */}
                      {menstrualPrediction && cycleConfirmed === null && (
                        <div style={{ marginBottom: "14px" }}>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "4px" }}>
                            {menstrualPrediction.emoji} Dia {menstrualPrediction.dayOfCycle} do ciclo — fase {menstrualPrediction.label}
                          </p>
                          <p style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "10px" }}>
                            {t("checkin.feelingMatch")}
                          </p>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button type="button" onClick={() => {
                              setCycleConfirmed(true);
                              if (menstrualPrediction.phase === "menstrual") {
                                setIsFlowing(true);
                                setFlowDay(menstrualPrediction.dayOfCycle);
                              } else {
                                setIsFlowing(false);
                                setFlowDay(null);
                              }
                            }} style={{
                              flex: 1, height: "36px", borderRadius: "999px",
                              border: "1.5px solid var(--accent-peach)",
                              background: "var(--accent-peach-a3)",
                              color: "var(--accent-peach-ink)", fontWeight: 700, fontSize: "13px", cursor: "pointer",
                  }}>{t("checkin.matched")}</button>
                            <button type="button" onClick={() => setCycleConfirmed(false)} style={{
                              flex: 1, height: "36px", borderRadius: "999px",
                              border: "1.5px solid var(--warm-border-2)",
                              background: "transparent",
                              color: "var(--text-3)", fontWeight: 700, fontSize: "13px", cursor: "pointer",
                  }}>{t("checkin.correct")}</button>
                          </div>
                        </div>
                      )}
                      {menstrualPrediction && cycleConfirmed === true && (
                        <p style={{ fontSize: "12px", color: "var(--accent-peach-ink)", fontWeight: 600, marginBottom: "10px" }}>
                          {menstrualPrediction.emoji} {l(`Dia ${menstrualPrediction.dayOfCycle} confirmado.`, `Day ${menstrualPrediction.dayOfCycle} confirmed.`)}
                          {menstrualPrediction.phase !== "menstrual" && l(" Se estiver no fluxo agora, registre abaixo.", " If your period started now, record it below.")}
                        </p>
                      )}
                      {/* Pergunta manual quando sem dados ou usuária quer corrigir */}
                      {(!menstrualPrediction || cycleConfirmed === false) && (
                        <>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "8px" }}>{t("checkin.menstruatingToday")}</p>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                        {[{ label: l("Sim", "Yes"), value: true }, { label: l("Não", "No"), value: false }].map(opt => (
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
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "8px" }}>{t("checkin.cramps")}</p>
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
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-peach-ink)", marginBottom: "8px" }}>{t("checkin.headache")}</p>
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
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>{t("checkin.dayQuestion")}</p>
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
                        {t("checkin.focusToday")}
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
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>{t("checkin.hyperfocusToday")}</p>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[
                            { l: l("Sim", "Yes"), v: true },
                            { l: l("Não", "No"), v: false },
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
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>{t("checkin.medicationToday")}</p>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[
                            { l: l("Sim", "Yes"), v: true },
                            { l: l("Não", "No"), v: false },
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
                          {t("checkin.mixedWhat")}
                        </p>
                        <input
                          type="text"
                          value={mixedNote}
                          maxLength={500}
                          onChange={(e) => setMixedNote(e.target.value)}
                          placeholder={t("checkin.mixedPlaceholder")}
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
                placeholder={t("checkin.notePlaceholder")}
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
                    {t("checkin.goesToJournal")}
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

        </>)}

      </div>
    </div>
  );
}

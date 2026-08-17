import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, Loader, Mic, MicOff } from "lucide-react";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useAuraStore } from "../features/aura/store";
import { tracksMenstrualCycle } from "../features/aura/onboarding";
import { averageCycleLength, cycleFlowStarts, daysSinceISO } from "../utils/cycle-history";
import type { MoodOption } from "../features/aura/types";
import {
  createTranscriptResultHandler,
  releaseRecognition,
  requestRecognitionStop,
  stopActiveRecognition,
  TranscriptSession,
} from "../features/voice/transcript-session";
import { resolveIntlLocale, useLocalizedCopy } from "../i18n";
import { api } from "../lib/api";
import { trackEvent } from "../lib/track";
import { successHaptic, tapHaptic } from "../utils/haptics";
import { getClientDayContext } from "../utils/day-context";
import { mergeVoiceFactors } from "./checkin-page.helpers";
import {
  buildContextualCheckinEntry,
  checkinAmbience,
  missingCheckinAnswers,
  finalizeContextualCheckin,
  parseVoiceCheckinResponse,
} from "./checkin-form-model";
import "../styles/aura.css";
import "../styles/editorial.css";

const FACTORS = [
  { id: "slept_well", icon: "😴", category: "positive" },
  { id: "slept_little", icon: "🪫", category: "negative" },
  { id: "woke_up_night", icon: "🌑", category: "negative" },
  { id: "exercise", icon: "🏃", category: "positive" },
  { id: "no_exercise", icon: "🪑", category: "negative" },
  { id: "healthy_meal", icon: "🥗", category: "positive" },
  { id: "skipped_meals", icon: "😶", category: "negative" },
  { id: "took_meds", icon: "💊", category: "positive" },
  { id: "forgot_meds", icon: "🔴", category: "negative" },
  { id: "fresh_air", icon: "🌿", category: "positive" },
  { id: "good_talk", icon: "💬", category: "positive" },
  { id: "kind_words", icon: "❤️", category: "positive" },
  { id: "support", icon: "🤝", category: "positive" },
  { id: "social_drain", icon: "😮‍💨", category: "negative" },
  { id: "loneliness", icon: "🫥", category: "negative" },
  { id: "relationship_conflict", icon: "💔", category: "negative" },
  { id: "focused_session", icon: "🔥", category: "positive" },
  { id: "hyperfocus_stuck", icon: "🌀", category: "negative" },
  { id: "small_win", icon: "⭐", category: "positive" },
  { id: "finished_task", icon: "✅", category: "positive" },
  { id: "feeling_valued", icon: "🏆", category: "positive" },
  { id: "work_pressure", icon: "⚙️", category: "negative" },
  { id: "plan_changed", icon: "🔄", category: "negative" },
  { id: "hard_decision", icon: "⚖️", category: "negative" },
  { id: "dissociated", icon: "🌫️", category: "negative" },
  { id: "low_dopamine", icon: "🩶", category: "negative" },
  { id: "stuck", icon: "🪨", category: "negative" },
  { id: "overwhelmed", icon: "🌊", category: "negative" },
  { id: "self_trust", icon: "💪", category: "positive" },
  { id: "rest", icon: "🛋️", category: "positive" },
  { id: "fiz_algo_gosto", icon: "🎨", category: "positive" },
  { id: "financial_stress", icon: "💸", category: "negative" },
  { id: "bad_news", icon: "📰", category: "negative" },
  { id: "pms_symptoms", icon: "🌸", category: "negative" },
  { id: "heavy_period", icon: "🩸", category: "negative" },
] as const;

const EMOTIONS = [
  { id: "radiant", emoji: "✨" }, { id: "calm", emoji: "😌" },
  { id: "happy", emoji: "🙂" }, { id: "anxious", emoji: "😰" },
  { id: "tired", emoji: "😴" }, { id: "focused", emoji: "🔥" },
  { id: "sad", emoji: "😢" }, { id: "angry", emoji: "😤" },
  { id: "stressed", emoji: "😵" }, { id: "sensitive", emoji: "🌙" },
  { id: "exhausted", emoji: "😩" }, { id: "agitated", emoji: "🫨" },
] as const;

const EMOTION_TO_MOOD: Record<string, MoodOption> = {
  radiant: "focada", focused: "focada", calm: "equilibrada", happy: "equilibrada",
  anxious: "tensa", stressed: "tensa", tired: "cansada", exhausted: "cansada",
  sad: "sensivel", sensitive: "sensivel", angry: "sobrecarregada", agitated: "sobrecarregada",
};

export const INITIAL_EMOTIONS_SELECTED: string[] = [];

export function toggleEmotionSelection(current: string[], emotionId: string, maxSelections = 3): string[] {
  if (current.includes(emotionId)) return current.filter((id) => id !== emotionId);
  if (current.length >= maxSelections) return current;
  return [...current, emotionId];
}

function Section({ title, subtitle, children, section }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  section: string;
}) {
  return (
    <section data-section={section} style={{ marginBottom: 28 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, color: "var(--text-1)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "0 0 14px", fontSize: 12, lineHeight: 1.5, color: "var(--text-3)" }}>{subtitle}</p>}
      {children}
    </section>
  );
}

function ChoiceButton({ active, onClick, children, ariaLabel }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={() => { tapHaptic(); onClick(); }}
      style={{
        minHeight: 42,
        borderRadius: 12,
        border: `1.5px solid ${active ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
        background: active ? "var(--accent-peach-a3)" : "rgba(255,255,255,.78)",
        color: active ? "var(--accent-peach-ink)" : "var(--text-2)",
        padding: "8px 10px",
        fontWeight: active ? 800 : 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Escala arrastável. Substitui a grade de 10 botões: um alvo de toque contínuo
 * é mais rápido no celular e ocupa uma linha em vez de duas.
 *
 * O campo é opcional, então `null` precisa continuar sendo um estado visível e
 * alcançável — o polegar parte do meio em cinza e só vira resposta depois que a
 * pessoa encosta. "Limpar" devolve ao não respondido.
 */
/**
 * Onde o polegar descansa enquanto o campo não foi respondido.
 *
 * É também o valor que um toque sozinho precisa conseguir confirmar: numa
 * escala de 1 a 10 dá 6, e 6 era justamente o único valor inalcançável por
 * toque, porque `onChange` de um `input[type=range]` só dispara quando o valor
 * muda. Exportado para o teste travar isso.
 */
export function sliderRestingValue(min: number, max: number): number {
  return Math.round((min + max) / 2);
}

function ScoreSlider({ label, value, onChange, min = 1, max = 10, suffix = "", emptyHint }: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  suffix?: string;
  emptyHint: string;
}) {
  const l = useLocalizedCopy();
  const answered = value !== null;
  const sliderValue = answered ? value : sliderRestingValue(min, max);
  const inputId = `score-slider-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div style={{ margin: "0 0 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, margin: "0 0 6px" }}>
        <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 800, color: "var(--text-2)" }}>{label}</label>
        <span
          aria-hidden="true"
          style={{
            fontSize: answered ? 18 : 13,
            fontWeight: 800,
            color: answered ? "var(--accent-peach-ink)" : "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {answered ? `${value}${suffix}` : emptyHint}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={1}
        value={sliderValue}
        aria-valuetext={answered ? `${value}${suffix}` : emptyHint}
        onChange={(event) => onChange(Number(event.target.value))}
        /**
         * Encostar já é responder.
         *
         * `onChange` só dispara quando o valor MUDA, e o polegar de um campo
         * não respondido descansa no meio da escala. Resultado: o valor do meio
         * — 6 numa escala de 1 a 10 — era o único impossível de escolher com um
         * toque. A pessoa tocava exatamente ali, via o polegar no lugar certo,
         * e o app gravava `null`. Aqui o toque e a tecla confirmam o valor
         * exibido quando o campo ainda está vazio; com o campo já respondido,
         * `onChange` continua sendo o único caminho.
         */
        onPointerUp={() => { if (!answered) onChange(sliderValue); }}
        onKeyUp={() => { if (!answered) onChange(sliderValue); }}
        style={{
          width: "100%",
          height: 34,
          margin: 0,
          cursor: "pointer",
          accentColor: answered ? "var(--accent-peach-strong)" : "var(--warm-border-2)",
          background: "transparent",
          opacity: answered ? 1 : 0.55,
          // Sem isso o Android não repassa o arrasto horizontal para o input,
          // porque o container do check-in já captura o gesto de scroll.
          touchAction: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: -2 }}>
        <span style={{ fontSize: 10, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{min}{suffix}</span>
        {answered && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              border: 0,
              background: "transparent",
              padding: "2px 6px",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-3)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {l("Limpar", "Clear")}
          </button>
        )}
        <span style={{ fontSize: 10, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{max}{suffix}</span>
      </div>
      <span
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {answered ? `${label}: ${value}${suffix}` : ""}
      </span>
    </div>
  );
}

function BooleanChoice({ value, onChange, yes, no, legend, group }: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  yes: string;
  no: string;
  legend: string;
  group: string;
}) {
  return (
    <fieldset data-choice-group={group} style={{ margin: 0, padding: 0, border: 0 }}>
      <legend style={{ margin: "0 0 8px", padding: 0, fontSize: 12, fontWeight: 800 }}>{legend}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <ChoiceButton active={value === true} onClick={() => onChange(value === true ? null : true)}>{yes}</ChoiceButton>
        <ChoiceButton active={value === false} onClick={() => onChange(value === false ? null : false)}>{no}</ChoiceButton>
      </div>
    </fieldset>
  );
}

type FlowIntensity = "leve" | "moderado" | "intenso";
type DayType = "up" | "down" | "mixed" | "stable";

export function CheckinPage() {
  const { t, i18n } = useTranslation();
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state, setMood, addCheckin } = useAuraStore();
  const showMenstrualBlock = tracksMenstrualCycle(state.biologicalSex);
  /**
   * Pergunta de medicação só para quem declarou usar.
   *
   * Antes ela era feita a todo mundo, todo dia, e o campo não tinha nenhum
   * leitor no backend — pergunta cara para quem não toma remédio e inútil para
   * quem toma. `null` (nunca respondeu) mantém visível, mesma regra do bloco
   * menstrual: sumir com um campo por causa de uma pergunta que a pessoa nunca
   * viu seria perder dado em silêncio.
   */
  const showMedicationQuestion = state.medicationCurrentlyUsing !== false;

  /**
   * Quando perguntar sobre o ciclo.
   *
   * A regra espelha `shouldAskFlowStart` do backend: perto da janela prevista,
   * ou depois de muito tempo sem marcação. Fora disso o app já sabe onde a
   * pessoa está no ciclo e não tem por que perguntar de novo — era isso que
   * transformava um fato por mês em pergunta diária.
   */
  const { showCycleQuestion, cycleQuestionLegend } = useMemo(() => {
    const flowStarts = cycleFlowStarts(state.checkinHistory ?? []);
    const last = flowStarts.length > 0 ? flowStarts[flowStarts.length - 1] : null;
    if (!last) {
      return { showCycleQuestion: true, cycleQuestionLegend: l("Sua menstruação começou hoje?", "Did your period start today?") };
    }
    const elapsed = daysSinceISO(last);
    const average = averageCycleLength(flowStarts);
    // Já registrou o começo há poucos dias: pergunta só a intensidade.
    if (elapsed <= 6) {
      return { showCycleQuestion: true, cycleQuestionLegend: l("Ainda está menstruada?", "Are you still menstruating?") };
    }
    if (elapsed < 21) return { showCycleQuestion: false, cycleQuestionLegend: "" };
    if (average !== null && elapsed < average - 3) return { showCycleQuestion: false, cycleQuestionLegend: "" };
    return { showCycleQuestion: true, cycleQuestionLegend: l("Sua menstruação começou hoje?", "Did your period start today?") };
  }, [state.checkinHistory, l]);
  // Português flexiona adjetivo por gênero: "cansada" e "cansado" são a mesma
  // emoção. O app já sabe a resposta do onboarding, então escreve a palavra
  // certa em vez de recorrer a "cansado(a)".
  const emotionLabelNamespace = state.biologicalSex === "male"
    ? "checkin.emotionsMale"
    : "checkin.emotions";
  const dayContext = getClientDayContext(new Date(), resolveIntlLocale(i18n.language));
  const [humor, setHumor] = useState<number | null>(null);
  const [energia, setEnergia] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>(INITIAL_EMOTIONS_SELECTED);
  const [factors, setFactors] = useState<string[]>([]);
  const [noFactorIdentified, setNoFactorIdentified] = useState(false);
  const [sono, setSono] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [clareza, setClareza] = useState<number | null>(null);
  const [irritabilidade, setIrritabilidade] = useState<number | null>(null);
  const [fisico, setFisico] = useState<number | null>(null);
  const [social, setSocial] = useState<number | null>(null);
  const [isFlowing, setIsFlowing] = useState<boolean | null>(null);
  const [flowDay, setFlowDay] = useState<number | null>(null);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | null>(null);
  const [symptomLevels, setSymptomLevels] = useState<{ colica?: 1 | 2 | 3; dorCabeca?: 1 | 2 | 3 }>({});
  const [medicationTakenToday, setMedicationTakenToday] = useState<boolean | null>(null);
  const [focusScore, setFocusScore] = useState<number | null>(null);
  const [hyperfocusOccurred, setHyperfocusOccurred] = useState<boolean | null>(null);
  const [dayType, setDayType] = useState<DayType | null>(null);
  const [mixedEpisodeNote, setMixedEpisodeNote] = useState("");
  const [note, setNote] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearVoiceSilenceTimer() {
    if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
    voiceSilenceTimerRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
      stopActiveRecognition(recognitionRef);
    };
  }, []);

  function startVoiceCheckin() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(t("checkin.voiceRecognitionUnsupported"));
      return;
    }
    if (recognitionRef.current) {
      clearVoiceSilenceTimer();
      requestRecognitionStop(recognitionRef);
      return;
    }

    setVoiceError(null);
    setVoiceTranscript("");
    const recognition = new SpeechRecognition();
    const transcriptSession = new TranscriptSession();
    recognition.lang = resolveIntlLocale(i18n.language);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onerror = () => {
      clearVoiceSilenceTimer();
      transcriptSession.reset();
      if (!releaseRecognition(recognitionRef, recognition)) return;
      setIsListening(false);
      setVoiceError(t("checkin.voiceHearRetry"));
    };
    recognition.onresult = createTranscriptResultHandler(transcriptSession, (snapshot) => {
      clearVoiceSilenceTimer();
      setVoiceTranscript(snapshot.text);
      voiceSilenceTimerRef.current = setTimeout(() => requestRecognitionStop(recognitionRef), 2500);
    });
    recognition.onend = async () => {
      clearVoiceSilenceTimer();
      const snapshot = transcriptSession.snapshot();
      const transcript = snapshot.finalText || snapshot.text;
      transcriptSession.reset();
      if (!releaseRecognition(recognitionRef, recognition)) return;
      setIsListening(false);
      if (!transcript) return;
      setVoiceLoading(true);
      try {
        const result = parseVoiceCheckinResponse(await api.post("/ai/voice-checkin", { transcript }));
        if (result.humor !== null) setHumor(result.humor);
        if (result.energia !== null) setEnergia(result.energia);
        // Horas de sono moram na seção recolhida. Preencher e deixar escondido
        // faria a pessoa achar que a fala foi ignorada.
        if (result.sleepHours !== null) {
          setSleepHours(result.sleepHours);
          setContextOpen(true);
        }
        if (result.emotions?.length) setEmotions(result.emotions.slice(0, 3));
        if (result.factors?.length) {
          setFactors((current) => mergeVoiceFactors(current, result.factors));
          setNoFactorIdentified(false);
        }
        if (result.note) setNote(result.note);
      } catch {
        setVoiceError(t("checkin.voiceEmotionRetry"));
      } finally {
        setVoiceLoading(false);
      }
    };
    recognition.start();
  }

  function toggleFactor(id: string) {
    setNoFactorIdentified(false);
    setFactors((current) => current.includes(id) ? current.filter((factor) => factor !== id) : [...current, id]);
  }

  const missing = missingCheckinAnswers({ humor, energia, factors, noFactorIdentified });
  const canSubmit = missing.length === 0;

  async function handleSubmit() {
    if (!canSubmit || isSaving) return;
    setSubmitError(null);
    setIsSaving(true);
    try {
      const entry = buildContextualCheckinEntry({
        humor,
        energia,
        emotions,
        factors,
        noFactorIdentified,
        ...(sono !== null ? { sono } : {}),
        ...(sleepHours !== null ? { sleepHours } : {}),
        ...(clareza !== null ? { clareza } : {}),
        ...(irritabilidade !== null ? { irritabilidade } : {}),
        ...(fisico !== null ? { fisico } : {}),
        ...(social !== null ? { social } : {}),
        ...(isFlowing !== null ? { isFlowing } : {}),
        ...(flowDay !== null ? { flowDay } : {}),
        ...(flowIntensity !== null ? { flowIntensity } : {}),
        ...(Object.keys(symptomLevels).length > 0 ? { symptomLevels } : {}),
        ...(medicationTakenToday !== null ? { medicationTakenToday } : {}),
        ...(focusScore !== null ? { focusScore } : {}),
        ...(hyperfocusOccurred !== null ? { hyperfocusOccurred } : {}),
        ...(dayType !== null ? { dayType } : {}),
        ...(mixedEpisodeNote.trim() ? { mixedEpisodeNote } : {}),
        ...(note.trim() ? { note } : {}),
      });
      const outcome = await addCheckin(entry);
      if (outcome.status === "queued") {
        trackEvent("checkin_queued", {
          flow: "contextual",
          idempotency_key: outcome.idempotencyKey,
          factors_count: factors.length,
        });
        setSubmitError(l(
          "Sem conexão. O check-in completo ficou guardado neste dispositivo e será enviado quando a internet voltar. Ele ainda não foi confirmado.",
          "You are offline. The complete check-in is stored on this device and will be sent when the connection returns. It is not confirmed yet.",
        ));
        return;
      }
      await finalizeContextualCheckin({
        persist: async () => outcome,
        onConfirmed: (checkinAI) => {
          // Retorno tátil só aqui: o registro já voltou confirmado do servidor.
          // Vibrar no toque do botão comemoraria algo que ainda pode falhar.
          successHaptic();
          if (entry.emotion) setMood(EMOTION_TO_MOOD[entry.emotion] ?? "equilibrada");
          trackEvent("checkin_completed", {
            flow: "contextual",
            factors_count: factors.length,
            explicit_no_factor: noFactorIdentified,
            emotions_count: emotions.length,
            has_voice_context: Boolean(voiceTranscript.trim()),
            has_optional_context: [sono, sleepHours, clareza, irritabilidade, fisico, social, isFlowing, medicationTakenToday, focusScore, hyperfocusOccurred, dayType].some((value) => value !== null),
          });
          navigate("/checkin-result", { state: checkinAI });
        },
      });
    } catch (error) {
      console.error("Erro ao registrar check-in contextual:", error);
      setSubmitError(l(
        "Não foi possível salvar o check-in. Seus dados continuam nesta tela para você tentar novamente.",
        "Could not save the check-in. Your data remains on this screen so you can try again.",
      ));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      data-testid="checkin-contextual-flow"
      style={{
        flex: 1,
        overflowY: "auto",
        // A tela responde enquanto ela responde: o fundo pega cor de humor e
        // energia. Antes tudo era cinza igual, e é isso que faz um check-in de
        // nove escalas parecer formulário.
        background: checkinAmbience(humor, energia),
        transition: "background 600ms ease",
        paddingBottom: 36,
      }}
    >
      <div className="screen-content">
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 22px" }}>
          <button type="button" aria-label={l("Voltar", "Back")} onClick={() => navigate(-1)} style={{ border: 0, background: "none", padding: 4, color: "var(--text-1)" }}>
            <ChevronLeft size={22} />
          </button>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{dayContext.dateWithWeekdayLabel}</p>
        </div>

        <Section section="voice-emotion" title={l("Como você está agora?", "How are you right now?")} subtitle={l("Fale livremente ou escolha até três emoções.", "Speak freely or choose up to three emotions.")}>
          <button type="button" onClick={startVoiceCheckin} disabled={voiceLoading} style={{ width: "100%", minHeight: 56, borderRadius: 16, border: "1.5px solid var(--accent-peach)", background: "var(--accent-peach-a3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--accent-peach-ink)", fontWeight: 800 }}>
            {voiceLoading ? <Loader size={19} /> : isListening ? <MicOff size={19} /> : <Mic size={19} />}
            {voiceLoading ? t("checkin.processing") : isListening ? t("checkin.listeningStop") : t("checkin.speakHow")}
          </button>
          <div aria-live="polite" aria-atomic="true">
            {voiceTranscript && <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>“{voiceTranscript}”</p>}
            {voiceError && <p role="alert" style={{ fontSize: 12, color: "var(--accent-peach-ink)" }}>{voiceError}</p>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
            {EMOTIONS.map((emotion) => (
              <ChoiceButton key={emotion.id} active={emotions.includes(emotion.id)} onClick={() => setEmotions((current) => toggleEmotionSelection(current, emotion.id))}>
                <span style={{ display: "block", fontSize: 22 }}>{emotion.emoji}</span>
                <span style={{ display: "block", fontSize: 10 }}>{t(`${emotionLabelNamespace}.${emotion.id}`)}</span>
              </ChoiceButton>
            ))}
          </div>
        </Section>

        <Section section="mood-energy" title={l("Humor e energia", "Mood and energy")} subtitle={l("Escolha como estão agora. Nenhum valor é presumido.", "Choose how they are now. No value is assumed.")}>
          <ScoreSlider label={l("Humor", "Mood")} value={humor} onChange={setHumor} emptyHint={l("arraste", "drag")} />
          <ScoreSlider label={l("Energia", "Energy")} value={energia} onChange={setEnergia} emptyHint={l("arraste", "drag")} />
        </Section>

        {/* A Airia interpreta capacidade e foco a partir dos sinais registrados.
            A pessoa pode corrigir a proposta depois, mas não precisa operar o
            sistema escolhendo tamanho de tarefa e objetivo prioritário. */}
        {humor !== null && energia !== null && (
          <Section
            section="airia-interpretation"
            title={l("A Airia cuida da próxima decisão", "Airia handles the next decision")}
            subtitle={l("Vou cruzar seu estado de agora com seu histórico e seus objetivos ativos.", "I’ll combine your current state with your history and active goals.")}
          >
            <div role="status" style={{ borderRadius: 14, padding: 14, background: "rgba(255,255,255,.72)", border: "1.5px solid var(--warm-border-2)" }}>
              <strong style={{ display: "block", fontSize: 13, color: "var(--text-1)" }}>
                {l("Depois do registro, eu proponho um próximo passo proporcional à sua energia.", "After you check in, I’ll propose a next step matched to your energy.")}
              </strong>
              <span style={{ display: "block", marginTop: 5, fontSize: 12, lineHeight: 1.5, color: "var(--text-3)" }}>
                {l("Você poderá confirmar, corrigir ou recusar — sem precisar montar a análise.", "You can confirm, correct, or reject it — without having to build the analysis yourself.")}
              </span>
            </div>
          </Section>
        )}

        <Section section="influences" title={l("Fatores de influência", "Influencing factors")} subtitle={l("Marque o que realmente contribuiu para este estado.", "Select what actually contributed to this state.")}>
          {(["positive", "negative"] as const).map((category) => (
            <div key={category} style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: category === "positive" ? "var(--accent-sage)" : "#C44444" }}>
                {category === "positive" ? l("O que ajudou", "What helped") : l("O que pesou", "What weighed on you")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {FACTORS.filter((factor) => factor.category === category).map((factor) => (
                  <ChoiceButton key={factor.id} active={factors.includes(factor.id)} onClick={() => toggleFactor(factor.id)}>
                    {factor.icon} {t(`checkin.factors.${factor.id}`)}
                  </ChoiceButton>
                ))}
              </div>
            </div>
          ))}
          <ChoiceButton active={noFactorIdentified} onClick={() => {
            const next = !noFactorIdentified;
            setNoFactorIdentified(next);
            if (next) setFactors([]);
          }}>
            {l("Não identifiquei um fator agora", "I did not identify a factor right now")}
          </ChoiceButton>
          {!noFactorIdentified && factors.length === 0 && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#A24B43" }}>
              {l("Escolha ao menos um fator ou marque que não identificou um agora.", "Choose at least one factor or mark that you did not identify one.")}
            </p>
          )}
        </Section>

        {/* ── Detalhes recolhidos ──
            Esta seção é a maior da tela e é inteira opcional: onze campos que
            ninguém precisa responder para registrar o dia. Aberta por padrão,
            ela transformava o check-in num questionário longo e empurrava o
            botão de registrar para fora da tela. Recolhida, o obrigatório cabe
            de uma vez e quem quiser detalhar continua a um toque. ── */}
        <Section section="optional-context" title={l("Detalhes do contexto", "Context details")} subtitle={l("Opcionais, mas importantes para correlações mais precisas.", "Optional, but important for more precise correlations.")}>
          <button
            type="button"
            aria-expanded={contextOpen}
            aria-controls="checkin-context-details"
            onClick={() => { tapHaptic(); setContextOpen((open) => !open); }}
            style={{
              width: "100%",
              minHeight: 46,
              marginBottom: contextOpen ? 16 : 0,
              borderRadius: 12,
              border: "1.5px solid var(--warm-border-2)",
              background: "rgba(255,255,255,.78)",
              color: "var(--text-2)",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px",
            }}
          >
            <span>
              {contextOpen
                ? l("Esconder detalhes", "Hide details")
                : l("Detalhar sono, foco e mais", "Add sleep, focus and more")}
            </span>
            <ChevronDown
              size={17}
              aria-hidden="true"
              style={{ transform: contextOpen ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }}
            />
          </button>
          <div id="checkin-context-details" hidden={!contextOpen} style={{ display: contextOpen ? "grid" : "none", gap: 18 }}>
            <div>
              <ScoreSlider label={l("Qualidade do sono", "Sleep quality")} value={sono} onChange={setSono} emptyHint={l("arraste", "drag")} />
              <ScoreSlider label={l("Horas de sono", "Sleep hours")} value={sleepHours} onChange={setSleepHours} min={3} max={12} suffix="h" emptyHint={l("arraste", "drag")} />
            </div>
            {/* Clareza e irritabilidade tinham coluna no banco, campo no contrato
                e nenhuma pergunta. A irritabilidade é a que pesa: o motor lê o
                valor na agregação diária e a Airia usa nível alto para baixar a
                exigência do dia — sem coleta, os dois liam null para sempre. */}
            <ScoreSlider label={l("Clareza mental", "Mental clarity")} value={clareza} onChange={setClareza} emptyHint={l("arraste", "drag")} />
            <ScoreSlider label={l("Irritabilidade", "Irritability")} value={irritabilidade} onChange={setIrritabilidade} emptyHint={l("arraste", "drag")} />
            <ScoreSlider label={l("Estado físico", "Physical state")} value={fisico} onChange={setFisico} emptyHint={l("arraste", "drag")} />
            <ScoreSlider label={l("Carga social", "Social load")} value={social} onChange={setSocial} emptyHint={l("arraste", "drag")} />

            {/* ── Ciclo: uma marcação por mês, não uma pergunta por dia ──
                A pergunta anterior era sobre estar menstruada no dia, repetida
                em todo check-in — inclusive no dia seguinte ao que a pessoa já
                tinha dito que sim, e ao lado dos fatores "Sintomas de TPM" e
                "Ciclo intenso hoje", que perguntam quase a mesma coisa.

                O único fato que o app não consegue deduzir é QUANDO o fluxo
                começou. Dado esse, dia do ciclo, fase, próxima menstruação e
                janela fértil são conta — `lib/menstrual-cycle.ts` faz. Por isso
                a pergunta virou "começou hoje?" e só aparece perto da janela
                prevista ou quando faz tempo demais sem registro.

                A intensidade continua sendo perguntada enquanto há fluxo: é o
                único detalhe que nenhum cálculo deduz. O dia do fluxo saiu —
                era pedir para a pessoa contar o que o app sabe somar. ── */}
            {showMenstrualBlock && showCycleQuestion && (
            <div>
              <BooleanChoice value={isFlowing} onChange={(value) => {
                setIsFlowing(value);
                if (value === true) {
                  // Marcou o começo: dia 1 por definição, sem perguntar.
                  setFlowDay(1);
                } else {
                  setFlowDay(null);
                  setFlowIntensity(null);
                  setSymptomLevels({});
                }
              }} legend={cycleQuestionLegend} group="menstrual-status" yes={l("Sim", "Yes")} no={l("Ainda não", "Not yet")} />
              {isFlowing === true && (
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <fieldset data-choice-group="flow-intensity" style={{ margin: 0, padding: 0, border: 0 }}>
                    <legend style={{ margin: "0 0 8px", padding: 0, fontSize: 12, fontWeight: 700 }}>{l("Intensidade do fluxo", "Flow intensity")}</legend>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                      {(["leve", "moderado", "intenso"] as FlowIntensity[]).map((intensity) => (
                        <ChoiceButton key={intensity} active={flowIntensity === intensity} onClick={() => setFlowIntensity(flowIntensity === intensity ? null : intensity)}>
                          {{ leve: l("Leve", "Light"), moderado: l("Moderado", "Moderate"), intenso: l("Intenso", "Heavy") }[intensity]}
                        </ChoiceButton>
                      ))}
                    </div>
                  </fieldset>
                  {(["colica", "dorCabeca"] as const).map((symptom) => (
                    <div key={symptom}>
                      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700 }}>{symptom === "colica" ? l("Cólica", "Cramps") : l("Dor de cabeça", "Headache")}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                        {([1, 2, 3] as const).map((level) => <ChoiceButton key={level} active={symptomLevels[symptom] === level} onClick={() => setSymptomLevels((current) => ({ ...current, [symptom]: current[symptom] === level ? undefined : level }))}>{level}</ChoiceButton>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {showMedicationQuestion && (
              <div>
                <BooleanChoice value={medicationTakenToday} onChange={setMedicationTakenToday} legend={l("Tomou a medicação hoje?", "Did you take medication today?")} group="medication-status" yes={l("Sim", "Yes")} no={l("Não", "No")} />
              </div>
            )}
            <ScoreSlider label={l("Foco", "Focus")} value={focusScore} onChange={setFocusScore} emptyHint={l("arraste", "drag")} />
            <div>
              <BooleanChoice value={hyperfocusOccurred} onChange={setHyperfocusOccurred} legend={l("Teve hiperfoco?", "Did hyperfocus occur?")} group="hyperfocus-status" yes={l("Sim", "Yes")} no={l("Não", "No")} />
            </div>
            <fieldset data-choice-group="day-type" style={{ margin: 0, padding: 0, border: 0 }}>
              <legend style={{ margin: "0 0 8px", padding: 0, fontSize: 12, fontWeight: 800 }}>{l("Tipo do dia", "Day type")}</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 7 }}>
                {(["up", "down", "mixed", "stable"] as DayType[]).map((type) => (
                  <ChoiceButton key={type} active={dayType === type} onClick={() => setDayType(dayType === type ? null : type)}>
                    {{ up: l("Para cima", "Up"), down: l("Para baixo", "Down"), mixed: l("Misto", "Mixed"), stable: l("Estável", "Stable") }[type]}
                  </ChoiceButton>
                ))}
              </div>
              {dayType === "mixed" && <input value={mixedEpisodeNote} onChange={(event) => setMixedEpisodeNote(event.target.value)} maxLength={500} placeholder={t("checkin.mixedPlaceholder")} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 11, borderRadius: 10, border: "1.5px solid var(--warm-border-2)" }} />}
            </fieldset>
          </div>
        </Section>

        {/* ── A nota sai de dentro dos detalhes recolhidos ──
            De todos os campos da tela, este é o que o servidor trata com mais
            peso: `checkin.service.ts` o injeta no prompt marcado como SINAL
            PRIORITÁRIO — "dê mais peso a isto do que a inferências genéricas dos
            números" — e é ele que alimenta a busca de memória e a avaliação de
            risco. Estava enterrado atrás de um toggle fechado por padrão, junto
            com onze campos opcionais, o que é o oposto do peso que ele tem.
            Números dizem o tamanho do dia; a frase diz o que aconteceu nele. ── */}
        <Section
          section="note"
          title={l("Quer contar o que aconteceu?", "Want to say what happened?")}
          subtitle={l("Opcional, e é o que mais me ajuda a entender o seu dia.", "Optional, and it's what helps me understand your day the most.")}
        >
          <label htmlFor="checkin-note" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
            {l("Nota livre", "Free note")}
          </label>
          <textarea
            id="checkin-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder={t("checkin.notePlaceholder")}
            style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 12, border: "1.5px solid var(--warm-border-2)", resize: "vertical" }}
          />
        </Section>

        {submitError && <p role="alert" aria-live="assertive" style={{ color: "#A24B43", fontSize: 13, lineHeight: 1.5 }}>{submitError}</p>}

        {/* ── Por que o botão não está liberado ──
            Botão desabilitado e mudo é indistinguível de botão quebrado, e foi
            assim que um check-in inteiro se perdeu: o registro não saiu, nada
            explicou, e a leitura foi "fiz o check-in e não apareceu o
            resultado". O log do servidor confirmou que nenhum envio chegou.
            Agora a tela diz o que falta, com o nome exato do campo. ── */}
        {!canSubmit && !isSaving && (
          <p
            aria-live="polite"
            style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.5, color: "var(--text-2)", textAlign: "center" }}
          >
            {l("Falta responder: ", "Still missing: ")}
            <strong style={{ color: "var(--accent-primary-ink)" }}>
              {missing
                .map((field) => ({
                  humor: l("humor", "mood"),
                  energia: l("energia", "energy"),
                  fator: l("um fator (ou marcar que não identificou)", "one factor (or mark that you found none)"),
                }[field]))
                .join(l(" · ", " · "))}
            </strong>
          </p>
        )}

        <AuraButtonV2 variant="primary" onClick={handleSubmit} disabled={!canSubmit || isSaving} style={{ width: "100%", minHeight: 54, fontWeight: 800 }}>
          {isSaving ? l("Registrando...", "Saving...") : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{l("Registrar", "Save")} <Check size={16} /></span>}
        </AuraButtonV2>
      </div>
    </div>
  );
}

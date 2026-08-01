import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Loader, Mic, MicOff } from "lucide-react";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useAuraStore } from "../features/aura/store";
import type { MoodOption } from "../features/aura/types";
import {
  createTranscriptResultHandler,
  releaseRecognition,
  stopActiveRecognition,
  TranscriptSession,
} from "../features/voice/transcript-session";
import { resolveIntlLocale, useLocalizedCopy } from "../i18n";
import { api } from "../lib/api";
import { trackEvent } from "../lib/track";
import { getClientDayContext } from "../utils/day-context";
import { mergeVoiceFactors } from "./checkin-page.helpers";
import {
  buildContextualCheckinEntry,
  canSubmitContextualCheckin,
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
      onClick={onClick}
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

function ScorePicker({ label, value, onChange }: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "var(--text-2)" }}>{label}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 7 }}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
          <ChoiceButton key={score} active={value === score} onClick={() => onChange(value === score ? null : score)}>
            {score}
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

function BooleanChoice({ value, onChange, yes, no }: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  yes: string;
  no: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <ChoiceButton active={value === true} onClick={() => onChange(value === true ? null : true)}>{yes}</ChoiceButton>
      <ChoiceButton active={value === false} onClick={() => onChange(value === false ? null : false)}>{no}</ChoiceButton>
    </div>
  );
}

type FlowIntensity = "leve" | "moderado" | "intenso";
type DayType = "up" | "down" | "mixed" | "stable";

export function CheckinPage() {
  const { t, i18n } = useTranslation();
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { setMood, addCheckin } = useAuraStore();
  const dayContext = getClientDayContext(new Date(), resolveIntlLocale(i18n.language));

  const [humor, setHumor] = useState<number | null>(null);
  const [energia, setEnergia] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>(INITIAL_EMOTIONS_SELECTED);
  const [factors, setFactors] = useState<string[]>([]);
  const [noFactorIdentified, setNoFactorIdentified] = useState(false);
  const [sono, setSono] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState<number | null>(null);
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
  const [isSaving, setIsSaving] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
    stopActiveRecognition(recognitionRef);
  }, []);

  function startVoiceCheckin() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(t("checkin.voiceRecognitionUnsupported"));
      return;
    }
    if (recognitionRef.current) {
      if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
      stopActiveRecognition(recognitionRef);
      setIsListening(false);
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
      if (voiceSilenceTimerRef.current) clearTimeout(voiceSilenceTimerRef.current);
      const transcript = transcriptSession.snapshot().finalText;
      transcriptSession.reset();
      if (!releaseRecognition(recognitionRef, recognition)) return;
      setIsListening(false);
      if (!transcript) return;
      setVoiceLoading(true);
      try {
        const result = await api.post("/ai/voice-checkin", { transcript }) as {
          humor: number | null;
          energia: number | null;
          sleepHours: number | null;
          emotions: string[];
          factors: string[];
          note: string | null;
        };
        if (result.humor !== null) setHumor(result.humor);
        if (result.energia !== null) setEnergia(result.energia);
        if (result.sleepHours !== null) setSleepHours(result.sleepHours);
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

  const canSubmit = canSubmitContextualCheckin({ humor, energia, factors, noFactorIdentified });

  async function handleSubmit() {
    if (!canSubmit || isSaving) return;
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
      if (entry.emotion) setMood(EMOTION_TO_MOOD[entry.emotion] ?? "equilibrada");
      const checkinAI = await addCheckin(entry);
      trackEvent("checkin_completed", {
        flow: "contextual",
        factors_count: factors.length,
        explicit_no_factor: noFactorIdentified,
        emotions_count: emotions.length,
        has_voice_context: Boolean(voiceTranscript.trim()),
        has_optional_context: [sono, sleepHours, fisico, social, isFlowing, medicationTakenToday, focusScore, hyperfocusOccurred, dayType].some((value) => value !== null),
      });
      navigate("/checkin-result", { state: checkinAI ?? undefined });
    } catch (error) {
      console.error("Erro ao registrar check-in contextual:", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div data-testid="checkin-contextual-flow" style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)", paddingBottom: 36 }}>
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
          {voiceTranscript && <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>“{voiceTranscript}”</p>}
          {voiceError && <p role="alert" style={{ fontSize: 12, color: "var(--accent-peach-ink)" }}>{voiceError}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
            {EMOTIONS.map((emotion) => (
              <ChoiceButton key={emotion.id} active={emotions.includes(emotion.id)} onClick={() => setEmotions((current) => toggleEmotionSelection(current, emotion.id))}>
                <span style={{ display: "block", fontSize: 22 }}>{emotion.emoji}</span>
                <span style={{ display: "block", fontSize: 10 }}>{t(`checkin.emotions.${emotion.id}`)}</span>
              </ChoiceButton>
            ))}
          </div>
        </Section>

        <Section section="mood-energy" title={l("Humor e energia", "Mood and energy")} subtitle={l("Escolha como estão agora. Nenhum valor é presumido.", "Choose how they are now. No value is assumed.")}>
          <ScorePicker label={l("Humor", "Mood")} value={humor} onChange={setHumor} />
          <ScorePicker label={l("Energia", "Energy")} value={energia} onChange={setEnergia} />
        </Section>

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

        <Section section="optional-context" title={l("Detalhes do contexto", "Context details")} subtitle={l("Opcionais, mas importantes para correlações mais precisas.", "Optional, but important for more precise correlations.")}>
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <ScorePicker label={l("Qualidade do sono", "Sleep quality")} value={sono} onChange={setSono} />
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "var(--text-2)" }}>{l("Horas de sono", "Sleep hours")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((hours) => (
                  <ChoiceButton key={hours} active={sleepHours === hours} onClick={() => setSleepHours(sleepHours === hours ? null : hours)}>{hours}h</ChoiceButton>
                ))}
              </div>
            </div>
            <ScorePicker label={l("Estado físico", "Physical state")} value={fisico} onChange={setFisico} />
            <ScorePicker label={l("Carga social", "Social load")} value={social} onChange={setSocial} />

            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "var(--text-2)" }}>{l("Está menstruada hoje?", "Are you menstruating today?")}</p>
              <BooleanChoice value={isFlowing} onChange={(value) => {
                setIsFlowing(value);
                if (value !== true) {
                  setFlowDay(null);
                  setFlowIntensity(null);
                  setSymptomLevels({});
                }
              }} yes={l("Sim", "Yes")} no={l("Não", "No")} />
              {isFlowing === true && (
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700 }}>{l("Dia do fluxo", "Flow day")}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
                      {[1, 2, 3, 4, 5, 6, 7].map((day) => <ChoiceButton key={day} active={flowDay === day} onClick={() => setFlowDay(flowDay === day ? null : day)}>{day}</ChoiceButton>)}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                    {(["leve", "moderado", "intenso"] as FlowIntensity[]).map((intensity) => <ChoiceButton key={intensity} active={flowIntensity === intensity} onClick={() => setFlowIntensity(flowIntensity === intensity ? null : intensity)}>{intensity}</ChoiceButton>)}
                  </div>
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

            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800 }}>{l("Tomou a medicação hoje?", "Did you take medication today?")}</p>
              <BooleanChoice value={medicationTakenToday} onChange={setMedicationTakenToday} yes={l("Sim", "Yes")} no={l("Não", "No")} />
            </div>
            <ScorePicker label={l("Foco", "Focus")} value={focusScore} onChange={setFocusScore} />
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800 }}>{l("Teve hiperfoco?", "Did hyperfocus occur?")}</p>
              <BooleanChoice value={hyperfocusOccurred} onChange={setHyperfocusOccurred} yes={l("Sim", "Yes")} no={l("Não", "No")} />
            </div>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800 }}>{l("Tipo do dia", "Day type")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 7 }}>
                {(["up", "down", "mixed", "stable"] as DayType[]).map((type) => <ChoiceButton key={type} active={dayType === type} onClick={() => setDayType(dayType === type ? null : type)}>{t(`checkin.dayTypes.${type}`, type)}</ChoiceButton>)}
              </div>
              {dayType === "mixed" && <input value={mixedEpisodeNote} onChange={(event) => setMixedEpisodeNote(event.target.value)} maxLength={500} placeholder={t("checkin.mixedPlaceholder")} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 11, borderRadius: 10, border: "1.5px solid var(--warm-border-2)" }} />}
            </div>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={5000} placeholder={t("checkin.notePlaceholder")} style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 12, border: "1.5px solid var(--warm-border-2)", resize: "vertical" }} />
          </div>
        </Section>

        <AuraButtonV2 variant="primary" onClick={handleSubmit} disabled={!canSubmit || isSaving} style={{ width: "100%", minHeight: 54, fontWeight: 800 }}>
          {isSaving ? l("Registrando...", "Saving...") : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{l("Registrar", "Save")} <Check size={16} /></span>}
        </AuraButtonV2>
      </div>
    </div>
  );
}

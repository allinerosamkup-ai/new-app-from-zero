// Checkin Page v3 — botões nativos (sem AuraButtonV2 em controles internos) + sintomas ciclo
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import type { MoodOption } from "../features/aura/types";
import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
import { useRef } from "react";
import "../styles/aura.css";
import "../styles/aura-v2.css";

function OptionalSlider({ label, emoji, value, onChange, color }: {
  label: string; emoji: string; value: number; onChange: (v: number) => void; color: string;
}) {
  const pct = ((value - 1) / 4) * 100;
  return (
    <div className="checkin-slider-wrap">
      <div className="checkin-slider-label">
        <span className="title">{emoji} {label}</span>
        <span className="val" style={{ color }}>{value}</span>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ width: "100%", height: "8px", background: `${color}22`, borderRadius: "999px", position: "relative", overflow: "visible" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: "999px", background: color }} />
          <div style={{ width: "20px", height: "20px", background: "#fff", border: `2px solid ${color}`, borderRadius: "50%", position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%, -50%)", boxShadow: `0 2px 8px ${color}44`, pointerEvents: "none" }} />
        </div>
        <input type="range" min={1} max={5} step={1} value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
      </div>
    </div>
  );
}

const emotionToMood: Record<string, MoodOption> = {
  radiant:   "focada",
  calm:      "equilibrada",
  anxious:   "tensa",
  tired:     "cansada",
  focused:   "focada",
  sad:       "sensivel",
  angry:     "sobrecarregada",
  sensitive: "sensivel",
  exhausted: "cansada",
  agitated:  "sobrecarregada",
};

const emotions = [
  { id: "radiant",   emoji: "✨", label: "Radiante" },
  { id: "calm",      emoji: "😌", label: "Calma" },
  { id: "anxious",   emoji: "😰", label: "Ansiosa" },
  { id: "tired",     emoji: "😴", label: "Cansada" },
  { id: "focused",   emoji: "🔥", label: "Focada" },
  { id: "sad",       emoji: "😢", label: "Triste" },
  { id: "angry",     emoji: "😤", label: "Irritada" },
  { id: "sensitive", emoji: "🌙", label: "Sensível" },
  { id: "exhausted", emoji: "😩", label: "Exausta" },
  { id: "agitated",  emoji: "🫨", label: "Agitada" },
];

type FlowIntensity = "leve" | "moderado" | "intenso";

const symptomLevels_opts = [
  { label: "Leve", v: 1 as 1 | 2 | 3 },
  { label: "Moderada", v: 2 as 1 | 2 | 3 },
  { label: "Intensa", v: 3 as 1 | 2 | 3 },
];

export function CheckinPage() {
  const { setMood, addCheckin } = useAuraStore();
  const navigate = useNavigate();

  const [humor, setHumor] = useState(4);
  const [energia, setEnergia] = useState(3);
  const [emotionSelected, setEmotionSelected] = useState<string | null>("radiant");
  const [nota, setNota] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [sono, setSono] = useState(3);
  const [fisico, setFisico] = useState(3);
  const [social, setSocial] = useState(3);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Ciclo menstrual
  const [showCiclo, setShowCiclo] = useState(false);
  const [isFlowing, setIsFlowing] = useState<boolean | null>(null);
  const [flowDay, setFlowDay] = useState<number | null>(null);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | null>(null);
  const [symptomLvls, setSymptomLvls] = useState<{ colica?: 1|2|3; dorCabeca?: 1|2|3 }>({});

  const humorFillPct = ((humor - 1) / 4) * 100;
  const energiaFillPct = ((energia - 1) / 4) * 100;

  const dataHoje = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  }, []);

  // Estilo compartilhado dos botões de accordion
  const accordionBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    width: "100%",
    textAlign: "left",
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
      <div className="screen-content">

        {/* Header */}
        <div className="aura-page-header" style={{ marginBottom: "calc(var(--a) * 1.4)" }}>
          <p className="aura-page-kicker">Check-in</p>
          <h2 className="aura-page-title">Como você está hoje?</h2>
          <p className="aura-page-subtitle">Registro de hoje, {dataHoje}</p>
        </div>

        {/* Slider Humor */}
        <div className="checkin-slider-wrap">
          <div className="checkin-slider-label">
            <span className="title">😊 Humor</span>
            <span className="val" style={{ color: "var(--nectarine)" }}>{humor}</span>
          </div>
          <div className="aura-slider-container">
            <div className="aura-slider-track">
              <div className="aura-slider-fill" style={{ width: `${humorFillPct}%`, background: "linear-gradient(90deg, var(--menthe), var(--nectarine))" }} />
            </div>
            <div className="aura-slider-thumb" style={{ left: `${humorFillPct}%` }} />
            <input type="range" min={1} max={5} step={1} value={humor} className="aura-range-input" onChange={(e) => setHumor(Number(e.target.value))} />
          </div>
        </div>

        {/* Slider Energia */}
        <div className="checkin-slider-wrap">
          <div className="checkin-slider-label">
            <span className="title">⚡ Energia</span>
            <span className="val" style={{ color: "var(--lagune)" }}>{energia}</span>
          </div>
          <div className="aura-slider-container">
            <div className="aura-slider-track">
              <div className="aura-slider-fill" style={{ width: `${energiaFillPct}%`, background: "linear-gradient(90deg, var(--lagune), var(--menthe))" }} />
            </div>
            <div className="aura-slider-thumb" style={{ left: `${energiaFillPct}%` }} />
            <input type="range" min={1} max={5} step={1} value={energia} className="aura-range-input" onChange={(e) => setEnergia(Number(e.target.value))} />
          </div>
        </div>

        {/* Seção emoções */}
        <div style={{ marginBottom: "calc(var(--a) * 1.2)" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "10px" }}>
            Como está se sentindo?
          </p>
          <div className="emotion-grid">
            {emotions.map((em) => (
              <button
                type="button"
                key={em.id}
                className={`emotion-chip${emotionSelected === em.id ? " active" : ""}`}
                onClick={() => setEmotionSelected(em.id === emotionSelected ? null : em.id)}
                style={{ border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                <span className="emoji">{em.emoji}</span>
                {em.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nota livre */}
        <div style={{ marginBottom: "calc(var(--a) * 1.4)" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "8px" }}>
            Nota livre (opcional)
          </p>
          <div style={{ position: "relative" }}>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Como foi o seu dia até agora?"
              style={{
                width: "100%", height: "80px", borderRadius: "6.5px",
                border: "1.5px solid var(--warm-border-2)", padding: "13px",
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13px", color: "var(--text-1)",
                background: "rgba(255,255,255,.68)", outline: "none", resize: "none", lineHeight: 1.6,
                paddingRight: "48px",
                backdropFilter: "blur(16px)",
                boxShadow: "0 12px 24px rgba(243,176,140,.08)",
              }}
            />
            <button
              type="button"
              onClick={() => {
                const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                if (!SR) return;
                if (isRecording && recognitionRef.current) {
                  recognitionRef.current.stop();
                  setIsRecording(false);
                  return;
                }
                const rec = new SR();
                rec.lang = "pt-BR";
                rec.continuous = false;
                rec.interimResults = false;
                rec.onresult = (e: any) => {
                  const transcript = e.results[0][0].transcript;
                  setNota(prev => (prev ? prev + " " + transcript : transcript));
                };
                rec.onend = () => setIsRecording(false);
                rec.onerror = () => setIsRecording(false);
                rec.start();
                recognitionRef.current = rec;
                setIsRecording(true);
              }}
              title={isRecording ? "Parar microfone" : "Ditado por voz"}
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid var(--warm-border-2)",
                background: isRecording ? "var(--menthe)" : "rgba(255,255,255,.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,.08)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isRecording ? "#fff" : "var(--text-2)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Detalhes opcionais */}
        <div style={{ marginBottom: "calc(var(--a) * 1.4)" }}>
          <button type="button" onClick={() => setShowDetails(v => !v)} style={accordionBtnStyle}>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-3)", flex: 1 }}>
              Detalhes (opcional)
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showDetails ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showDetails && (
            <div style={{ marginTop: "10px" }}>
              <OptionalSlider label="Como foi seu sono?" emoji="🌙" value={sono} onChange={setSono} color="var(--lagune)" />
              <OptionalSlider label="Como está seu corpo?" emoji="💪" value={fisico} onChange={setFisico} color="var(--menthe)" />
              <OptionalSlider label="Como foi sua vida social?" emoji="👥" value={social} onChange={setSocial} color="var(--social-color)" />
            </div>
          )}
        </div>

        {/* Ciclo Menstrual (Opcional) */}
        <div style={{ marginBottom: "calc(var(--a) * 1.4)" }}>
          <button type="button" onClick={() => setShowCiclo(v => !v)} style={accordionBtnStyle}>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-3)", flex: 1 }}>
              🌸 Ciclo Menstrual (opcional)
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showCiclo ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showCiclo && (
            <div style={{ marginTop: "12px", background: "var(--nectarine-a1)", borderRadius: "10px", border: "1px solid rgba(215,137,127,.2)", padding: "14px" }}>

              {/* Está menstruada hoje? */}
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--nectarine-11)", marginBottom: "8px" }}>Está menstruada hoje?</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                {[{ label: "Sim", value: true }, { label: "Não", value: false }].map(opt => (
                  <button
                    type="button"
                    key={String(opt.value)}
                    onClick={() => {
                      setIsFlowing(opt.value);
                      if (!opt.value) { setFlowDay(null); setFlowIntensity(null); setSymptomLvls({}); }
                    }}
                    style={{
                      flex: 1, height: "36px", borderRadius: "999px",
                      border: `1.5px solid ${isFlowing === opt.value ? "var(--nectarine)" : "var(--warm-border-2)"}`,
                      background: isFlowing === opt.value ? "var(--nectarine-a3)" : "transparent",
                      color: isFlowing === opt.value ? "var(--nectarine-11)" : "var(--text-3)",
                      fontWeight: 700, fontSize: "13px", cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {isFlowing && (
                <>
                  {/* Dia do fluxo */}
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--nectarine-11)", marginBottom: "8px" }}>Qual dia do fluxo?</p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setFlowDay(d)}
                        style={{
                          width: "38px", height: "38px", borderRadius: "50%",
                          border: `1.5px solid ${flowDay === d ? "var(--nectarine)" : "var(--warm-border-2)"}`,
                          background: flowDay === d ? "var(--nectarine)" : "transparent",
                          color: flowDay === d ? "#fff" : "var(--text-3)",
                          fontWeight: 700, fontSize: "12px", cursor: "pointer",
                        }}
                      >
                        {d}º
                      </button>
                    ))}
                  </div>

                  {/* Intensidade do fluxo */}
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--nectarine-11)", marginBottom: "8px" }}>Intensidade do fluxo</p>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    {([{ label: "🩸 Leve", value: "leve" }, { label: "🩸🩸 Moderado", value: "moderado" }, { label: "🩸🩸🩸 Intenso", value: "intenso" }] as { label: string; value: FlowIntensity }[]).map(fi => (
                      <button
                        type="button"
                        key={fi.value}
                        onClick={() => setFlowIntensity(fi.value)}
                        style={{
                          flex: 1, padding: "8px 4px", borderRadius: "9px",
                          border: `1.5px solid ${flowIntensity === fi.value ? "var(--nectarine)" : "var(--warm-border-2)"}`,
                          background: flowIntensity === fi.value ? "var(--nectarine-a3)" : "transparent",
                          color: flowIntensity === fi.value ? "var(--nectarine-11)" : "var(--text-3)",
                          fontWeight: 600, fontSize: "11px", cursor: "pointer",
                        }}
                      >
                        {fi.label}
                      </button>
                    ))}
                  </div>

                  {/* Cólica */}
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--nectarine-11)", marginBottom: "8px" }}>Cólica</p>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    {symptomLevels_opts.map(s => (
                      <button
                        type="button"
                        key={s.v}
                        onClick={() => setSymptomLvls(prev => ({ ...prev, colica: prev.colica === s.v ? undefined : s.v }))}
                        style={{
                          flex: 1, padding: "7px 4px", borderRadius: "9px",
                          border: `1.5px solid ${symptomLvls.colica === s.v ? "var(--nectarine)" : "var(--warm-border-2)"}`,
                          background: symptomLvls.colica === s.v ? "var(--nectarine-a3)" : "transparent",
                          color: symptomLvls.colica === s.v ? "var(--nectarine-11)" : "var(--text-3)",
                          fontWeight: 600, fontSize: "11px", cursor: "pointer",
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Dor de cabeça */}
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--nectarine-11)", marginBottom: "8px" }}>Dor de cabeça</p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {symptomLevels_opts.map(s => (
                      <button
                        type="button"
                        key={s.v}
                        onClick={() => setSymptomLvls(prev => ({ ...prev, dorCabeca: prev.dorCabeca === s.v ? undefined : s.v }))}
                        style={{
                          flex: 1, padding: "7px 4px", borderRadius: "9px",
                          border: `1.5px solid ${symptomLvls.dorCabeca === s.v ? "var(--nectarine)" : "var(--warm-border-2)"}`,
                          background: symptomLvls.dorCabeca === s.v ? "var(--nectarine-a3)" : "transparent",
                          color: symptomLvls.dorCabeca === s.v ? "var(--nectarine-11)" : "var(--text-3)",
                          fontWeight: 600, fontSize: "11px", cursor: "pointer",
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Botão submit */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
          <AuraButtonV2
            variant="primary"
            size="md"
            onClick={async () => {
              try {
                const mood = emotionToMood[emotionSelected ?? "calm"] ?? "equilibrada";
                setMood(mood);
                await addCheckin({
                  humor,
                  energia,
                  emotion: emotionSelected ?? "calm",
                  sono: showDetails ? sono : undefined,
                  fisico: showDetails ? fisico : undefined,
                  social: showDetails ? social : undefined,
                  isFlowing: isFlowing ?? undefined,
                  flowDay: flowDay ?? undefined,
                  flowIntensity: flowIntensity ?? undefined,
                  symptomLevels: Object.keys(symptomLvls).length > 0 ? symptomLvls : undefined,
                });
                navigate("/checkin-result");
              } catch (err) {
                console.error("Erro ao registrar check-in:", err);
              }
            }}
          >
            Finalizar
          </AuraButtonV2>
        </div>

      </div>
    </div>
  );
}

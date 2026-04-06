// Checkin Page v4 — emoções alinhadas, cards expansíveis e sem nota livre
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import type { MoodOption } from "../features/aura/types";
import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
import { getClientDayContext } from "../utils/day-context";
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
  { id: "radiant",   emoji: "✨", label: "Radiante" },
  { id: "calm",      emoji: "😌", label: "Calma" },
  { id: "happy",     emoji: "🙂", label: "Feliz" },
  { id: "anxious",   emoji: "😰", label: "Ansiosa" },
  { id: "tired",     emoji: "😴", label: "Cansada" },
  { id: "focused",   emoji: "🔥", label: "Focada" },
  { id: "sad",       emoji: "😢", label: "Triste" },
  { id: "angry",     emoji: "😤", label: "Irritada" },
  { id: "stressed",  emoji: "😵", label: "Estressada" },
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

type DetailCardKey = "sono" | "fisico" | "social" | "ciclo";

function DetailCard({
  emoji,
  title,
  summary,
  active,
  onClick,
}: {
  emoji: string;
  title: string;
  summary: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "74px",
        borderRadius: "14px",
        border: `1.5px solid ${active ? "var(--nectarine)" : "var(--warm-border-2)"}`,
        background: active ? "var(--nectarine-a3)" : "rgba(255,255,255,.72)",
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
        width: "38px",
        height: "38px",
        borderRadius: "12px",
        background: active ? "rgba(255,255,255,.75)" : "rgba(243,176,140,.16)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        flexShrink: 0,
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

export function CheckinPage() {
  const { setMood, addCheckin } = useAuraStore();
  const navigate = useNavigate();

  const [humor, setHumor] = useState(4);
  const [energia, setEnergia] = useState(3);
  const [emotionSelected, setEmotionSelected] = useState<string | null>("radiant");
  const [sono, setSono] = useState(3);
  const [fisico, setFisico] = useState(3);
  const [social, setSocial] = useState(3);
  const [activeDetail, setActiveDetail] = useState<DetailCardKey | null>(null);
  const [detailEnabled, setDetailEnabled] = useState<{ sono: boolean; fisico: boolean; social: boolean }>({
    sono: false,
    fisico: false,
    social: false,
  });

  // Ciclo menstrual
  const [showCiclo, setShowCiclo] = useState(false);
  const [isFlowing, setIsFlowing] = useState<boolean | null>(null);
  const [flowDay, setFlowDay] = useState<number | null>(null);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | null>(null);
  const [symptomLvls, setSymptomLvls] = useState<{ colica?: 1|2|3; dorCabeca?: 1|2|3 }>({});

  const humorFillPct = ((humor - 1) / 4) * 100;
  const energiaFillPct = ((energia - 1) / 4) * 100;

  const dayContext = useMemo(() => getClientDayContext(), []);

  function toggleDetailCard(card: DetailCardKey) {
    if (card === "ciclo") {
      const nextActive = activeDetail === "ciclo" ? null : "ciclo";
      setActiveDetail(nextActive);
      setShowCiclo(nextActive === "ciclo");
      return;
    }

    setDetailEnabled((current) => {
      const key = card as "sono" | "fisico" | "social";
      const shouldDisable = activeDetail === card && current[key];
      return { ...current, [key]: shouldDisable ? false : true };
    });
    setActiveDetail((current) => (current === card ? null : card));
    setShowCiclo(false);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
      <div className="screen-content">

        {/* Header */}
        <div className="aura-page-header" style={{ marginBottom: "calc(var(--a) * 1.4)" }}>
          <p className="aura-page-kicker">Check-in</p>
          <h2 className="aura-page-title">Como você está hoje?</h2>
          <p className="aura-page-subtitle">{dayContext.dateWithWeekdayLabel} · {dayContext.partOfDay}</p>
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
          <div className="emotion-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
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

        {/* Escuta complementar */}
        <div style={{ marginBottom: "calc(var(--a) * 1.4)" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "10px" }}>
            Escaneie outras áreas
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
            <DetailCard
              emoji="🌙"
              title="Sono"
              summary={detailEnabled.sono ? `${sono}/5 registrado` : "Toque para registrar"}
              active={activeDetail === "sono"}
              onClick={() => toggleDetailCard("sono")}
            />
            <DetailCard
              emoji="💪"
              title="Corpo"
              summary={detailEnabled.fisico ? `${fisico}/5 registrado` : "Toque para registrar"}
              active={activeDetail === "fisico"}
              onClick={() => toggleDetailCard("fisico")}
            />
            <DetailCard
              emoji="👥"
              title="Social"
              summary={detailEnabled.social ? `${social}/5 registrado` : "Toque para registrar"}
              active={activeDetail === "social"}
              onClick={() => toggleDetailCard("social")}
            />
            <DetailCard
              emoji="🌸"
              title="Ciclo menstrual"
              summary={showCiclo ? "Painel aberto" : "Toque se quiser registrar"}
              active={activeDetail === "ciclo"}
              onClick={() => toggleDetailCard("ciclo")}
            />
          </div>

          {activeDetail === "sono" && (
            <div style={{ marginTop: "12px" }}>
              <OptionalSlider label="Como foi seu sono?" emoji="🌙" value={sono} onChange={(value) => { setSono(value); setDetailEnabled((current) => ({ ...current, sono: true })); }} color="var(--lagune)" />
            </div>
          )}
          {activeDetail === "fisico" && (
            <div style={{ marginTop: "12px" }}>
              <OptionalSlider label="Como está seu corpo?" emoji="💪" value={fisico} onChange={(value) => { setFisico(value); setDetailEnabled((current) => ({ ...current, fisico: true })); }} color="var(--menthe)" />
            </div>
          )}
          {activeDetail === "social" && (
            <div style={{ marginTop: "12px" }}>
              <OptionalSlider label="Como foi sua atividade social?" emoji="👥" value={social} onChange={(value) => { setSocial(value); setDetailEnabled((current) => ({ ...current, social: true })); }} color="var(--social-color)" />
            </div>
          )}
          {showCiclo && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ background: "var(--nectarine-a1)", borderRadius: "10px", border: "1px solid rgba(215,137,127,.2)", padding: "14px" }}>

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
                  sono: detailEnabled.sono ? sono : undefined,
                  fisico: detailEnabled.fisico ? fisico : undefined,
                  social: detailEnabled.social ? social : undefined,
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

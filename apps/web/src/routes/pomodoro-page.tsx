// Pomodoro Page v2 — timer circular
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { useLocalizedCopy } from "../i18n";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import "../styles/aura.css";

type Phase = "foco" | "curta" | "longa";

const PHASE_LABELS: Record<Phase, string> = {
  foco:  "Foco",
  curta: "Pausa Curta",
  longa: "Pausa Longa",
};

const PHASE_DURATIONS: Record<Phase, number> = {
  foco:  25 * 60,
  curta:  5 * 60,
  longa: 15 * 60,
};

const RADIUS = 96;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PomodoroPage() {
  const l = useLocalizedCopy();
  const { state } = useAuraStore();
  const navigate = useNavigate();
  const location = useLocation();

  void state; // consumed via store, kept for pattern compliance

  const activeTaskTitle: string | null = (location.state as any)?.taskTitle ?? null;

  const [phase, setPhase]     = useState<Phase>("foco");
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [cycles]              = useState(2);

  const totalTime = PHASE_DURATIONS[phase];

  // Reset timer when phase changes
  useEffect(() => {
    setTimeLeft(PHASE_DURATIONS[phase]);
    setRunning(false);
  }, [phase]);

  // Countdown interval
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          setRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const progress = timeLeft / totalTime;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const focusMinutes = Math.round((totalTime - timeLeft) / 60);

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
      <div className="screen-content">

        {/* ── Header ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "4px",
        }}>
          <AuraButtonV2
            variant="ghost"
            onClick={() => navigate(-1)}
            style={{ width: 36, height: 36, padding: 0 }}
          >
            ←
          </AuraButtonV2>
          <h1 className="pomodoro-title">Pomodoro</h1>
          {/* spacer to balance the back button */}
          <div style={{ width: "36px", flexShrink: 0 }} />
        </div>
        {activeTaskTitle && (
          <p style={{
            fontSize: "12px",
            color: "var(--text-3)",
            textAlign: "center",
            marginBottom: "16px",
            maxWidth: "220px",
            margin: "0 auto 16px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {activeTaskTitle}
          </p>
        )}

        {/* ── Phase tabs ── */}
        <div className="aura-tabs" style={{ margin: "0 0 16px" }}>
          {(["foco", "curta", "longa"] as Phase[]).map((p) => (
            <AuraButtonV2
              key={p}
              className={`aura-tab${phase === p ? " active" : ""}`}
              onClick={() => setPhase(p)}
              style={{ border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {PHASE_LABELS[p]}
            </AuraButtonV2>
          ))}
        </div>

        {/* ── Circular timer ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "20px auto",
          position: "relative",
          width: "220px",
          height: "220px",
        }}>
          <svg
            width="220"
            height="220"
            viewBox="0 0 220 220"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            {/* Background track */}
            <circle
              cx="110"
              cy="110"
              r={RADIUS}
              stroke="rgba(155,191,168,.12)"
              strokeWidth="9"
              fill="none"
            />
            {/* Progress arc */}
            <circle
              cx="110"
              cy="110"
              r={RADIUS}
              stroke="var(--accent-peach)"
              strokeWidth="9"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 110 110)"
              style={{ filter: "drop-shadow(0 0 6px rgba(155,191,168,.4))", transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>

          {/* Timer overlay */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}>
            <span className="pomodoro-time">
              {formatTime(timeLeft)}
            </span>
            <span style={{
              fontSize: "13px",
              color: "var(--text-3)",
              marginTop: "6px",
            }}>
              {PHASE_LABELS[phase]}
            </span>
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          marginBottom: "20px",
        }}>
          {/* Reset */}
          <AuraButtonV2
            variant="outline"
            onClick={() => { setTimeLeft(totalTime); setRunning(false); }}
            style={{ width: "40px", height: "40px", padding: 0, borderRadius: "50%", fontSize: "18px" }}
            title="Reiniciar"
          >
            ↻
          </AuraButtonV2>

          {/* Play / Pause */}
          <AuraButtonV2
            variant="primary"
            onClick={() => setRunning((r) => !r)}
            style={{ width: "60px", height: "60px", padding: 0, borderRadius: "50%", fontSize: "22px" }}
            title={running ? "Pausar" : "Iniciar"}
          >
            {running ? "⏸" : "▶"}
          </AuraButtonV2>

          {/* Skip */}
          <AuraButtonV2
            variant="outline"
            onClick={() => { setTimeLeft(0); setRunning(false); }}
            style={{ width: "40px", height: "40px", padding: 0, borderRadius: "50%", fontSize: "18px" }}
            title="Pular"
          >
            ⏭
          </AuraButtonV2>
        </div>

        {/* ── Stats card ── */}
        <div className="aura-card" style={{
          marginTop: "16px",
          display: "flex",
          justifyContent: "center",
          gap: "24px",
          padding: "14px",
        }}>
          <div style={{ textAlign: "center" }}>
            <p className="pomodoro-stat-value">
              {cycles}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-3)" }}>Ciclos</p>
          </div>

          <div style={{
            width: "1px",
            background: "var(--warm-border)",
            alignSelf: "stretch",
          }} />

          <div style={{ textAlign: "center" }}>
            <p className="pomodoro-stat-value">
              {focusMinutes}m
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-3)" }}>Foco total</p>
          </div>

          {/* Session dots */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            alignSelf: "center",
          }}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: i < cycles
                    ? "var(--accent-peach)"
                    : "rgba(155,191,168,.15)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Quote ── */}
        <p style={{
          fontSize: "13px",
          fontStyle: "italic",
          color: "var(--text-2)",
          textAlign: "center",
          lineHeight: 1.6,
          marginTop: "16px",
          padding: "0 8px",
        }}>
          {l("Bom ritmo! Sua energia está no pico — aproveite para as tarefas mais exigentes.", "Good rhythm! Your energy is peaking — use it for the most demanding tasks.")}
        </p>

        {/* Finalizar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <AuraButtonV2
            variant="outline"
            onClick={() => navigate("/daily-summary")}
          >
          {l("✓ Sessão concluída", "✓ Session completed")}
          </AuraButtonV2>
        </div>

      </div>
    </div>
  );
}


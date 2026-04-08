// PhaseHeader — header gradiente com fase, dia, energia e HRV
import React from "react";
import { PhaseBadge, type CyclePhase } from "./PhaseBadge";

interface PhaseHeaderProps {
  phase: CyclePhase;
  dayOfPhase: number;
  totalDays: number;
  energia: number;       // 1–10
  hrv?: number | null;   // SDNN ms
  userName?: string;
}

function HrvBadge({ hrv }: { hrv: number }) {
  const isHigh   = hrv > 69.8;
  const isMedium = hrv >= 50 && hrv <= 69.8;
  const cfg = isHigh
    ? { emoji: "🔴", label: `${hrv.toFixed(0)}ms`, color: "#fff", bg: "rgba(192,57,43,.55)" }
    : isMedium
      ? { emoji: "🟡", label: `${hrv.toFixed(0)}ms`, color: "#fff", bg: "rgba(230,181,64,.55)" }
      : { emoji: "🟢", label: `${hrv.toFixed(0)}ms`, color: "#fff", bg: "rgba(39,174,96,.55)" };

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: 22, padding: "0 9px", borderRadius: 999,
      background: cfg.bg, backdropFilter: "blur(8px)",
      fontSize: 10, fontWeight: 700, color: cfg.color,
      border: "1px solid rgba(255,255,255,.3)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {cfg.emoji} HRV {cfg.label}
    </span>
  );
}

export function PhaseHeader({ phase, dayOfPhase, totalDays, energia, hrv, userName }: PhaseHeaderProps) {
  const PHASE_GRADIENT: Record<CyclePhase, string> = {
    menstrual:  "linear-gradient(135deg, var(--accent-peach) 0%, var(--accent-peach-strong) 100%)",
    folicular:  "linear-gradient(135deg, #7EBD9E 0%, var(--accent-sage) 100%)",
    ovulatoria: "linear-gradient(135deg, var(--accent-sky) 0%, #7BB2BA 100%)",
    lutea:      "linear-gradient(135deg, #9B7AB8 0%, var(--accent-sky) 100%)",
  };

  const energiaPct = Math.round((energia / 10) * 100);

  return (
    <div style={{
      background: PHASE_GRADIENT[phase],
      borderRadius: 20,
      padding: "18px 18px 16px",
      position: "relative",
      overflow: "hidden",
      marginBottom: 14,
    }}>
      {/* Brilho decorativo */}
      <div style={{
        position: "absolute", top: -30, right: -20,
        width: 120, height: 120, borderRadius: "50%",
        background: "rgba(255,255,255,.12)",
        pointerEvents: "none",
      }} />

      {/* Linha 1: saudação + fase */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,.85)", fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0 }}>
          {userName ? `Oi, ${userName.split(" ")[0]}` : "Seu momento"}
        </p>
        <PhaseBadge phase={phase} size="sm" style={{ background: "rgba(255,255,255,.25)", border: "1px solid rgba(255,255,255,.4)", color: "#fff" }} />
      </div>

      {/* Linha 2: dia do ciclo */}
      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>
        Dia {dayOfPhase} de {totalDays}
      </p>

      {/* Linha 3: energia + HRV */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Energia */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.75)", fontWeight: 700, letterSpacing: ".08em", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              ENERGIA BIOLÓGICA
            </span>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {energia}/10
            </span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,.25)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${energiaPct}%`, height: "100%", background: "#fff", borderRadius: 999, transition: "width .4s ease" }} />
          </div>
        </div>

        {/* HRV */}
        {hrv != null && <HrvBadge hrv={hrv} />}
      </div>
    </div>
  );
}


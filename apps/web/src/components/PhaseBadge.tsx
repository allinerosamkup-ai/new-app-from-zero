// PhaseBadge — componente global para exibir fase do ciclo
import React from "react";

export type CyclePhase = "menstrual" | "folicular" | "ovulatoria" | "lutea";

const PHASE_CONFIG: Record<CyclePhase, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  menstrual:  { emoji: "🌙", label: "Menstrual",  color: "#A8544A", bg: "rgba(215,137,127,.13)", border: "rgba(215,137,127,.3)" },
  folicular:  { emoji: "🌱", label: "Folicular",  color: "#3A7A66", bg: "rgba(150,199,179,.13)", border: "rgba(150,199,179,.35)" },
  ovulatoria: { emoji: "🚀", label: "Ovulatória", color: "#4F7D8E", bg: "rgba(99,152,169,.13)",  border: "rgba(99,152,169,.3)"  },
  lutea:      { emoji: "🌊", label: "Lútea",      color: "#705A8A", bg: "rgba(160,120,180,.13)", border: "rgba(160,120,180,.3)" },
};

interface PhaseBadgeProps {
  phase: CyclePhase;
  showLabel?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

export function PhaseBadge({ phase, showLabel = true, size = "md", style }: PhaseBadgeProps) {
  const cfg = PHASE_CONFIG[phase];
  const isSmall = size === "sm";

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: isSmall ? 3 : 5,
      height: isSmall ? 22 : 26,
      padding: isSmall ? "0 8px" : "0 10px",
      borderRadius: 999,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontSize: isSmall ? 10 : 11,
      fontWeight: 700,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
      ...style,
    }}>
      <span style={{ fontSize: isSmall ? 11 : 13 }}>{cfg.emoji}</span>
      {showLabel && cfg.label}
    </span>
  );
}

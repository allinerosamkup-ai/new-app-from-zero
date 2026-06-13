// Primitivos de UI — fundação do design system editorial.
// Substituem os cards estilizados à mão (~293 inline styles só na home) por
// componentes declarativos e coerentes. As variantes de acento batem com os
// valores inline já usados no app, então migrar não muda o visual.
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/class-names";

export type CardAccent = "neutral" | "peach" | "sage" | "sky" | "lilac";

const ACCENT_STYLE: Record<Exclude<CardAccent, "neutral">, { border: string; background: string }> = {
  peach: { border: "1.5px solid rgba(215,137,127,0.35)", background: "rgba(215,137,127,0.08)" },
  sage: { border: "1.5px solid rgba(150,199,179,0.5)", background: "rgba(150,199,179,0.10)" },
  sky: { border: "1.5px solid rgba(99,152,169,0.4)", background: "rgba(99,152,169,0.08)" },
  lilac: { border: "1.5px solid rgba(181,164,200,0.4)", background: "rgba(181,164,200,0.10)" },
};

export const ACCENT_INK: Record<CardAccent, string> = {
  neutral: "var(--accent-peach-ink)",
  peach: "var(--accent-peach-ink)",
  sage: "var(--accent-sage)",
  sky: "var(--accent-sky)",
  lilac: "#8B7BA8",
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  accent?: CardAccent;
};

export function Card({ className, accent = "neutral", style, ...props }: CardProps) {
  // Neutro reaproveita a classe .aura-card (visual padrão); acentos são inline tokenizados.
  if (accent === "neutral") {
    return <div className={cn("aura-card", className)} style={style} {...props} />;
  }
  return (
    <div
      className={className}
      style={{ borderRadius: 16, padding: "15px 16px", ...ACCENT_STYLE[accent], ...style }}
      {...props}
    />
  );
}

// Eyebrow + título opcional. Substitui os <p> uppercase repetidos.
export function SectionTitle({
  eyebrow,
  title,
  accent = "neutral",
  icon,
  action,
}: {
  eyebrow?: string;
  title?: string;
  accent?: CardAccent;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: ACCENT_INK[accent] }}>
              {eyebrow}
            </p>
          </div>
        )}
        {title && (
          <p style={{ margin: eyebrow ? "8px 0 0" : 0, fontSize: 15, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.3 }}>
            {title}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

const STAT_PILL_BG: Record<CardAccent, string> = {
  neutral: "rgba(176,180,196,.1)",
  peach: "var(--accent-peach-a3)",
  sage: "rgba(180,185,169,.12)",
  sky: "rgba(176,180,196,.1)",
  lilac: "rgba(181,164,200,.12)",
};

// Linha rótulo + valor (pílula). Substitui as linhas do card "Como está seu dia?".
export function Stat({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: ReactNode;
  accent?: CardAccent;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: "var(--text-2)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT_INK[accent], background: STAT_PILL_BG[accent], padding: "2px 10px", borderRadius: 999 }}>
        {value}
      </span>
    </div>
  );
}

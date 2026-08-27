import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

import type { MoodPhase } from "../../utils/mood-cycle-engine";
import "./airia-mascot.css";

/**
 * A Airia em forma visual, uma imagem por fase oficial.
 * TICKET-002: a cara aprovada é a bolinha. Os paths abaixo ainda
 * apontam aos WebP orbitais até o push binário íntegro.
 */

type AiriaMascotVisual = {
  src: string;
  srcRetina: string;
  labelKey: string;
  fallbackLabel: string;
};

function visual(file: string, labelKey: string, fallbackLabel: string): AiriaMascotVisual {
  return {
    src: `/mascot/phases/${file}.webp`,
    srcRetina: `/mascot/phases/${file}@640.webp`,
    labelKey,
    fallbackLabel,
  };
}

const PHASE_VISUALS: Record<MoodPhase, AiriaMascotVisual> = {
  elevated: visual("airia-orbital-high-flight", "mascot.phase.elevated", "Airia — fase Voo Alto"),
  flowing: visual("airia-orbital-flowing", "mascot.phase.flowing", "Airia — fase Fluindo"),
  stable: {
    src: "/mascot/phases/airia-orbital-stable@640.webp",
    srcRetina: "/mascot/phases/airia-orbital-stable@640.webp",
    labelKey: "mascot.phase.stable",
    fallbackLabel: "Airia — fase Estável",
  },
  falling: visual("airia-orbital-slowing-down", "mascot.phase.falling", "Airia — fase Desacelerando"),
  low: visual("airia-orbital-withdrawal", "mascot.phase.low", "Airia — fase Recolhimento"),
  depleted: visual("airia-orbital-pause", "mascot.phase.depleted", "Airia — fase Pausa"),
  recovering: visual("airia-orbital-resuming", "mascot.phase.recovering", "Airia — fase Retomada"),
  mixed: visual("airia-orbital-turbulence", "mascot.phase.mixed", "Airia — fase Turbulência"),
  insufficient_data: {
    src: "/mascot/phases/airia-orbital-stable@640.webp",
    srcRetina: "/mascot/phases/airia-orbital-stable@640.webp",
    labelKey: "mascot.phase.insufficientData",
    fallbackLabel: "Airia — conhecendo seu ritmo",
  },
};

export type AiriaMascotMotion = "rest" | "listen" | "understand" | "action" | "protect";

export type AiriaMascotProps = {
  phase?: MoodPhase | null;
  motion?: AiriaMascotMotion;
  size?: number | string;
  className?: string;
  decorative?: boolean;
};

export function resolveAiriaMascotVisual(phase: MoodPhase | null | undefined): AiriaMascotVisual {
  return PHASE_VISUALS[phase ?? "insufficient_data"];
}

export function AiriaMascot({
  phase,
  motion = "rest",
  size = 160,
  className,
  decorative = false,
}: AiriaMascotProps) {
  const { t } = useTranslation();
  const resolvedPhase = phase ?? "insufficient_data";
  const asset = resolveAiriaMascotVisual(resolvedPhase);

  const first = useRef(true);
  const [appear, setAppear] = useState(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setAppear(true);
    const timer = setTimeout(() => setAppear(false), 420);
    return () => clearTimeout(timer);
  }, [resolvedPhase]);

  const style = { "--airia-mascot-size": typeof size === "number" ? `${size}px` : size } as CSSProperties;
  const label = t(asset.labelKey, { defaultValue: asset.fallbackLabel });

  return (
    <span
      className={clsx("airia-mascot", className)}
      data-motion={motion}
      data-phase={resolvedPhase}
      data-appear={appear ? "true" : undefined}
      style={style}
    >
      <img
        key={resolvedPhase}
        className="airia-mascot__image"
        src={asset.src}
        srcSet={`${asset.src} 1x, ${asset.srcRetina} 2x`}
        alt={decorative ? "" : label}
        aria-hidden={decorative || undefined}
        width={320}
        height={320}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  );
}

import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

import type { MoodPhase } from "../../utils/mood-cycle-engine";
import "./airia-mascot.css";

/**
 * A Airia em forma visual: a bolinha creme, uma cara por fase oficial.
 *
 * O componente **recebe a fase pronta** e nunca infere humor. Isso não é
 * preciosismo de arquitetura: a fase sai do `MoodCycleEngine`, que mede desvio
 * do baseline pessoal ao longo de dias. Um componente de UI adivinhando estado
 * a partir do que tem à mão produziria um mascote que contradiz a leitura do
 * app na tela ao lado — e é a leitura do app que a pessoa aprendeu a confiar.
 *
 * Sem dado suficiente, cai na cara estável da bolinha. É a escolha do documento de design:
 * ausência de leitura não vira cara triste nem alerta.
 */

type AiriaMascotVisual = {
  src: string;
  srcRetina: string;
  labelKey: string;
  fallbackLabel: string;
};

function visual(file: string, labelKey: string, fallbackLabel: string): AiriaMascotVisual {
  return {
    src: `/mascot/phases/${file}.svg`,
    srcRetina: `/mascot/phases/${file}@640.svg`,
    labelKey,
    fallbackLabel,
  };
}

const PHASE_VISUALS: Record<MoodPhase, AiriaMascotVisual> = {
  elevated: visual("airia-bolinha-high-flight", "mascot.phase.elevated", "Airia — fase Voo Alto"),
  flowing: visual("airia-bolinha-flowing", "mascot.phase.flowing", "Airia — fase Fluindo"),
  stable: visual("airia-bolinha-stable", "mascot.phase.stable", "Airia — fase Estável"),
  falling: visual("airia-bolinha-slowing-down", "mascot.phase.falling", "Airia — fase Desacelerando"),
  low: visual("airia-bolinha-withdrawal", "mascot.phase.low", "Airia — fase Recolhimento"),
  depleted: visual("airia-bolinha-pause", "mascot.phase.depleted", "Airia — fase Pausa"),
  recovering: visual("airia-bolinha-resuming", "mascot.phase.recovering", "Airia — fase Retomada"),
  mixed: visual("airia-bolinha-turbulence", "mascot.phase.mixed", "Airia — fase Turbulência"),
  insufficient_data: visual(
    "airia-bolinha-stable",
    "mascot.phase.insufficientData",
    "Airia — conhecendo seu ritmo",
  ),
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

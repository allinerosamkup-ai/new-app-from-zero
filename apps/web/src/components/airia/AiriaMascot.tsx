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
  /** 320 px, o uso comum. */
  src: string;
  /** 640 px para retina, entregue por `srcSet`. */
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
  stable: visual("airia-orbital-stable", "mascot.phase.stable", "Airia — fase Estável"),
  falling: visual("airia-orbital-slowing-down", "mascot.phase.falling", "Airia — fase Desacelerando"),
  low: visual("airia-orbital-withdrawal", "mascot.phase.low", "Airia — fase Recolhimento"),
  depleted: visual("airia-orbital-pause", "mascot.phase.depleted", "Airia — fase Pausa"),
  recovering: visual("airia-orbital-resuming", "mascot.phase.recovering", "Airia — fase Retomada"),
  mixed: visual("airia-orbital-turbulence", "mascot.phase.mixed", "Airia — fase Turbulência"),
  insufficient_data: visual(
    "airia-orbital-stable",
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
  /**
   * Marca o mascote como decoração para leitores de tela.
   *
   * Use quando a fase já estiver escrita em texto ao lado — repetir "Airia —
   * fase Recolhimento" logo depois do título que diz a mesma coisa é ruído para
   * quem navega por áudio.
   */
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

  /**
   * Troca de fase entra por transição, não por corte seco.
   *
   * O documento de design pede transição gradual, e há uma razão além do gosto:
   * a fase muda enquanto a pessoa olha a tela, e um pulo de imagem lê como
   * glitch — ou pior, como veredito repentino sobre ela. `key` no elemento faz
   * o React remontar, e o CSS anima a entrada.
   */
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
        // Só a fase atual precisa chegar junto com a tela.
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  );
}

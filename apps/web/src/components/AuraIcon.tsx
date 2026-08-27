import React from "react";

const STABLE_SRC = "/mascot/phases/airia-orbital-stable.webp";
const STABLE_SRC_RETINA = "/mascot/phases/airia-orbital-stable@640.webp";

/**
 * AuraIcon — marca oficial da Airia.
 *
 * A identidade visível é a bolinha creme (esfera, carinha, blush),
 * não o orbital de pétalas nem o cluster de círculos. O SVG e o orbital
 * ficaram no histórico; este componente aponta para o asset aprovado.
 *
 * < 18px → a mesma bolinha, só menor (botões).
 * variant="hybrid" → mesmo ser; o ripple antigo era o cluster.
 */
export function AuraIcon({
  size = 16,
  className,
  style,
  variant = "default",
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  variant?: "default" | "hybrid";
}) {
  void variant;
  return (
    <img
      src={STABLE_SRC}
      srcSet={`${STABLE_SRC} 1x, ${STABLE_SRC_RETINA} 2x`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        ...style,
      }}
      draggable={false}
    />
  );
}

/**
 * AiriaLogoBg — bolinha em watermark.
 */
export function AiriaLogoBg({ size = 400, opacity = 0.06 }: { size?: number; opacity?: number }) {
  return (
    <img
      src={STABLE_SRC}
      srcSet={`${STABLE_SRC} 1x, ${STABLE_SRC_RETINA} 2x`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        opacity,
        pointerEvents: "none",
        display: "block",
      }}
      draggable={false}
    />
  );
}

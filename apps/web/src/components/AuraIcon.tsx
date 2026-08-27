import React from "react";

const STABLE_SRC = "/mascot/phases/airia-bolinha-stable.svg";
const STABLE_SRC_RETINA = "/mascot/phases/airia-bolinha-stable@640.svg";

/**
 * AuraIcon — marca oficial da Airia.
 *
 * A identidade visível é a bolinha creme (esfera, carinha, blush),
 * não o orbital de pétalas nem o cluster de círculos.
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

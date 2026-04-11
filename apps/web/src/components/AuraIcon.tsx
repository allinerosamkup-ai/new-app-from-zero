import React from "react";

/**
 * AuraIcon — Símbolo oficial da Airia.
 * < 18px → versão micro: 3 círculos compactos (legível em botões pequenos).
 * ≥ 18px → versão completa: 4 círculos pastel + centro champagne.
 */
export function AuraIcon({ size = 16, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  if (size < 18) {
    // Versão micro: 3 círculos sobrepostos, mais compactos e reconhecíveis
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
      >
        <circle cx="9.5" cy="9" r="6.5" fill="#F4A896" fillOpacity="0.92" stroke="white" strokeWidth="1" />
        <circle cx="15.5" cy="9.5" r="5" fill="#B8D9C8" fillOpacity="0.92" stroke="white" strokeWidth="1" />
        <circle cx="10" cy="15" r="5.5" fill="#F0C4D4" fillOpacity="0.92" stroke="white" strokeWidth="1" />
        <circle cx="12" cy="12" r="3" fill="#FDE8E3" fillOpacity="0.98" stroke="white" strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="90" cy="80" r="42" fill="#F4A896" fillOpacity="0.9" stroke="white" strokeWidth="2.5" />
      <circle cx="130" cy="85" r="32" fill="#B8D9C8" fillOpacity="0.9" stroke="white" strokeWidth="2.5" />
      <circle cx="75" cy="118" r="28" fill="#8FB8C4" fillOpacity="0.9" stroke="white" strokeWidth="2.5" />
      <circle cx="122" cy="122" r="30" fill="#F0C4D4" fillOpacity="0.9" stroke="white" strokeWidth="2.5" />
      <circle cx="100" cy="100" r="16" fill="#FDE8E3" fillOpacity="0.98" stroke="white" strokeWidth="3" />
    </svg>
  );
}

/**
 * AiriaLogoBg — Logo híbrida (círculos + ripple) para watermark de fundo.
 */
export function AiriaLogoBg({ size = 400, opacity = 0.06 }: { size?: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity, pointerEvents: "none" }}
    >
      {([0.95, 0.78, 0.60, 0.42] as number[]).map((s, i) => (
        <circle
          key={i}
          cx="100"
          cy="100"
          r={90 * s}
          fill="none"
          stroke="#F4A896"
          strokeWidth="0.8"
          strokeOpacity={0.15 + i * 0.18}
        />
      ))}
      <circle cx="90" cy="80" r="42" fill="#F4A896" fillOpacity="0.85" stroke="white" strokeWidth="1.5" />
      <circle cx="130" cy="85" r="32" fill="#B8D9C8" fillOpacity="0.85" stroke="white" strokeWidth="1.5" />
      <circle cx="75" cy="118" r="28" fill="#8FB8C4" fillOpacity="0.85" stroke="white" strokeWidth="1.5" />
      <circle cx="122" cy="122" r="30" fill="#F0C4D4" fillOpacity="0.85" stroke="white" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="16" fill="#FDE8E3" fillOpacity="0.95" stroke="white" strokeWidth="2" />
    </svg>
  );
}

import React from "react";

/**
 * AuraIcon — O símbolo oficial da Aura AI.
 * Um ícone de "brilho/faísca" estilizado (✨) usado em todas as entradas e botões da Aura.
 */
export function AuraIcon({ size = 16, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={style}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="m5 3 1 1" />
      <path d="m19 3-1 1" />
      <path d="m5 21 1-1" />
      <path d="m19 21-1-1" />
    </svg>
  );
}

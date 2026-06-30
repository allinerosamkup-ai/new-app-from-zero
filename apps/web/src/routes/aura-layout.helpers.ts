// Banner único por vez no layout: onboarding, alerta de fase e follow-up
// competiam por espaço (dois no topo, um no rodapé). Aqui resolvemos UM só por
// prioridade, pra não empilhar avisos e espremer o conteúdo.

export type ActiveBanner = "phase" | "onboarding" | "followup" | null;

export function resolveActiveBanner(input: {
  hasPhaseAlert: boolean;
  showOnboarding: boolean;
  hasFollowUp: boolean;
}): ActiveBanner {
  // Prioridade: alerta de fase (valor central, sensível ao tempo) > onboarding
  // (ativação de quem é novo) > follow-up (menor urgência).
  if (input.hasPhaseAlert) return "phase";
  if (input.showOnboarding) return "onboarding";
  if (input.hasFollowUp) return "followup";
  return null;
}

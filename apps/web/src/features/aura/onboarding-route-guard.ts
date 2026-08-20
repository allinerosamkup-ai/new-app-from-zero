import type { AuraState } from "./types";

const NEW_ACCOUNT_ONBOARDING_WINDOW_DAYS = 7;

/**
 * Decide se a conta deve concluir Pra começar antes de entrar no produto.
 *
 * A ausência ou a invalidez da data falha de forma segura: uma conta sem
 * confirmação de onboarding não deve cair em uma Home sem contexto.
 */
export function requiresMandatoryOnboarding(
  state: Pick<AuraState, "onboardingDone" | "accountCreatedAt">,
  now = Date.now(),
): boolean {
  if (state.onboardingDone) return false;
  if (!state.accountCreatedAt) return true;

  const createdAt = new Date(state.accountCreatedAt).getTime();
  if (!Number.isFinite(createdAt)) return true;

  return now - createdAt <= NEW_ACCOUNT_ONBOARDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

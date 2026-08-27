import { GoalsPage } from "./goals-page";

/**
 * Preview DEV do workspace de Objetivos.
 *
 * Não é uma segunda fonte de verdade. Reusa a página canônica, o store e a API.
 * Existe para o App.tsx em desenvolvimento deixar de importar um arquivo morto.
 */
export function ObjectivesPrototypePage() {
  return <GoalsPage />;
}

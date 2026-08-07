import { api } from "../lib/api";
import { findEquivalentAction } from "./action-similarity";
import {
  appendStoredGtdAction,
  readStoredGtdActions,
  type StoredGtdAction,
} from "./goal-priority-actions";

/**
 * Registra uma ação nas Próximas ações sem criar duplicata.
 *
 * Duas camadas, nesta ordem, porque cada uma resolve um caso diferente:
 *
 *  1. **Lexical, instantâneo e de graça.** Pega paráfrase — "ligar para a
 *     médica" e "ligar pra médica". É o caso mais comum, e resolver localmente
 *     evita chamada de rede em quase todo mundo.
 *  2. **LLM, só quando o lexical não achou nada.** Pega sinônimo real —
 *     "comprar pão" e "passar na padaria" — que nenhuma sobreposição de
 *     palavras identifica. O app já tem o modelo; não usá-lo aqui era deixar a
 *     ferramenta certa na gaveta.
 *
 * Em qualquer falha a ação é CRIADA. Perder o que a pessoa pediu para registrar
 * é muito pior que ela ver dois itens parecidos na lista.
 */

export type SaveNextActionResult = {
  created: boolean;
  item: StoredGtdAction;
  /** Como a duplicata foi detectada, quando foi. */
  matchedBy: "lexical" | "semantic" | null;
  /** Explicação curta do modelo, quando houver. */
  reason: string | null;
};

export async function saveNextAction(input: {
  text: string;
  razao?: string;
  source?: string;
  /** Desliga a checagem por LLM (útil em teste e em caminho offline). */
  skipSemantic?: boolean;
}): Promise<SaveNextActionResult> {
  const text = input.text.trim();
  const active = readStoredGtdActions().filter((item) => !item.done && !item.archived);

  // Camada 1 — lexical.
  const lexical = findEquivalentAction(text, active, (item) => item.titulo || item.text);
  if (lexical) {
    return { created: false, item: lexical, matchedBy: "lexical", reason: null };
  }

  // Camada 2 — significado. Só chega aqui quando o barato não resolveu.
  if (!input.skipSemantic && active.length > 0) {
    try {
      const verdict = await api.post("/actions/check-equivalent", {
        candidate: text,
        existing: active.map((item) => ({ id: item.id, text: item.titulo || item.text })),
      }) as { duplicateOf?: string | null; reason?: string | null };

      const match = verdict?.duplicateOf
        ? active.find((item) => item.id === verdict.duplicateOf)
        : undefined;

      if (match) {
        return { created: false, item: match, matchedBy: "semantic", reason: verdict.reason ?? null };
      }
    } catch {
      // Rede fora, sessão expirada, backend velho sem o endpoint: segue e cria.
    }
  }

  const saved = appendStoredGtdAction({
    text,
    titulo: text,
    razao: input.razao,
    source: input.source,
  });

  return { created: saved.created, item: saved, matchedBy: null, reason: null };
}

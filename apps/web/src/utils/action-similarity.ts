/**
 * Reconhecer que duas ações são a mesma coisa escrita diferente.
 *
 * "Ligar para a médica" e "ligar pra médica hoje" são o mesmo pedido. Comparar
 * texto exato deixa as duas entrarem, e a pessoa acaba com a mesma coisa
 * repetida no Inbox e na caixa de próximas ações.
 *
 * O que isto NÃO é: não há modelo de linguagem nem embedding aqui. É comparação
 * lexical normalizada — tira acento, pontuação, palavras vazias e variação de
 * plural, e mede quanto os conjuntos de palavras se sobrepõem. Pega parafrase
 * leve, que é o caso comum; não pega sinônimo verdadeiro ("comprar pão" versus
 * "ir à padaria"). Assumir isso é melhor do que prometer semântica e entregar
 * comparação de string.
 */

/** Palavras que não carregam significado da ação e só atrapalham a comparação. */
const STOPWORDS = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos",
  "para", "pra", "pro", "por", "com", "sem", "ao", "aos", "à", "às",
  "e", "ou", "que", "se", "me", "meu", "minha", "meus", "minhas",
  "hoje", "amanha", "agora", "depois", "logo", "ja", "ainda",
  "the", "a", "an", "of", "to", "for", "with", "my", "today", "now",
]);

/** Verbos que mudam de forma mas não de intenção. */
const VERB_ROOTS: Array<[RegExp, string]> = [
  [/^(ligar|ligue|liga|telefonar|telefone)$/, "ligar"],
  [/^(mandar|manda|mande|enviar|envia|envie)$/, "enviar"],
  [/^(marcar|marca|marque|agendar|agenda|agende)$/, "agendar"],
  [/^(comprar|compra|compre)$/, "comprar"],
  [/^(terminar|termina|termine|finalizar|finaliza|concluir|conclua)$/, "terminar"],
  [/^(comecar|comeca|comece|iniciar|inicia|inicie)$/, "comecar"],
  [/^(organizar|organiza|organize|arrumar|arruma|arrume)$/, "organizar"],
  [/^(revisar|revisa|revise|conferir|confere|confira)$/, "revisar"],
  [/^(responder|responde|responda)$/, "responder"],
  [/^(escrever|escreve|escreva)$/, "escrever"],
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Reduz plural e forma verbal comum para uma raiz aproximada. */
function root(word: string): string {
  for (const [pattern, canonical] of VERB_ROOTS) {
    if (pattern.test(word)) return canonical;
  }
  // Plural simples: "contas" -> "conta", "papeis" -> "papei" (suficiente para comparar)
  if (word.length > 4 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Conjunto de palavras significativas de uma ação. */
export function actionTokens(text: string): Set<string> {
  const normalized = stripAccents(String(text ?? "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized
    .split(" ")
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(root);

  return new Set(tokens);
}

/**
 * Quanto duas ações se sobrepõem, de 0 a 1 (índice de Jaccard).
 *
 * Duas frases sem palavra significativa em comum dão 0; idênticas dão 1.
 */
export function actionSimilarity(left: string, right: string): number {
  const a = actionTokens(left);
  const b = actionTokens(right);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;

  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Acima disso, tratamos como a mesma ação.
 *
 * 0.6 foi escolhido para pegar parafrase ("ligar para a médica" ≈ "ligar pra
 * médica") sem colar coisas diferentes que compartilham um verbo comum
 * ("organizar a mesa" versus "organizar as contas" dá 0.33 e passa).
 */
export const SAME_ACTION_THRESHOLD = 0.6;

export function isSameAction(left: string, right: string): boolean {
  return actionSimilarity(left, right) >= SAME_ACTION_THRESHOLD;
}

/**
 * Procura um item equivalente numa lista já existente.
 * Devolve o item encontrado, para que o chamador possa reusar em vez de criar.
 */
export function findEquivalentAction<T>(
  candidate: string,
  existing: T[],
  textOf: (item: T) => string,
): T | null {
  let best: { item: T; score: number } | null = null;
  for (const item of existing) {
    const score = actionSimilarity(candidate, textOf(item));
    if (score >= SAME_ACTION_THRESHOLD && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best?.item ?? null;
}

/** Remove equivalentes de uma lista, preservando o primeiro de cada grupo. */
export function dedupeActions<T>(items: T[], textOf: (item: T) => string): T[] {
  const kept: T[] = [];
  for (const item of items) {
    if (!findEquivalentAction(textOf(item), kept, textOf)) kept.push(item);
  }
  return kept;
}

function normalizeRoutineRequest(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeStructuredRoutineSource(original: string, normalized: string): boolean {
  if (normalized.length < 120) return false;

  const checkboxCount = (original.match(/[□☐☑✅]/g) ?? []).length
    + (original.match(/\[\s?[xX]?\s?\]/g) ?? []).length;
  const numberedSectionCount = (
    original.match(/(?:^|\n)\s*(?:\d{1,2}[.)-]|[0-9]\uFE0F?\u20E3)\s*/g) ?? []
  ).length;
  const operationalSignals = [
    /\bobjetivo\s*:/,
    /\b(?:todo dia|diari[oa]|semanal|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/,
    /\b(?:checklist|rotina|tarefa|habito|meta|publicar|criar|fazer|encerrar|definir)\b/,
  ].filter((pattern) => pattern.test(normalized)).length;

  return operationalSignals >= 2 && (checkboxCount >= 3 || numberedSectionCount >= 3);
}

export function isExplicitRoutineBuilderRequest(message: string): boolean {
  const text = normalizeRoutineRequest(message);
  if (!text) return false;

  const negatedRequest =
    /\b(?:nao|nem|nunca)\s+(?:(?:quero|preciso|gostaria|pretendo|vou)\s+(?:de\s+)?|(?:me\s+)?ajude\s+a\s+)?(?:criar|montar|organizar|planejar|refazer|estabelecer)\s+(?:(?:um|uma|meu|minha|o|a)\s+)?(?:rotina|agenda|dia|semana|cronograma)\b/.test(text)
    || /\b(?:do not|don't|never)\s+(?:(?:want|need)\s+to\s+)?(?:create|build|organize|plan|redo)\s+(?:a|my|the)?\s*(?:routine|schedule|day|week)\b/.test(text);
  if (negatedRequest) return false;

  const quotedOrReported =
    /\b(?:so|apenas)\s+(?:estou\s+)?(?:falando|comentando|desabafando)\s+(?:sobre\s+)?(?:criar|montar|organizar|planejar)\s+(?:uma?\s+)?(?:rotina|agenda)\b/.test(text)
    || /\b(?:ela|ele|alguem|a pessoa)\s+(?:disse|falou|pediu)\s+(?:para\s+)?(?:criar|montar|organizar|planejar)\s+(?:uma?\s+)?(?:rotina|agenda)\b/.test(text)
    || /\b(?:just|only)\s+(?:talking|venting)\s+about\s+(?:creating|building|organizing|planning)\s+(?:a\s+)?(?:routine|schedule)\b/.test(text);
  if (quotedOrReported) return false;

  const directRequest =
    /\b(?:preciso|quero|gostaria|necessito|desejo|pretendo)\s+(?:de\s+)?(?:criar|montar|organizar|planejar|refazer|estabelecer)\s+(?:(?:um|uma|meu|minha|o|a)\s+)?(?:rotina|agenda|dia|semana|cronograma)\b/.test(text)
    || /\b(?:me\s+ajud[ae]|ajude-me|pode|consegue)\s+(?:a\s+|me\s+)?(?:criar|montar|organizar|planejar|refazer|estabelecer)\s+(?:(?:um|uma|meu|minha|o|a)\s+)?(?:rotina|agenda|dia|semana|cronograma)\b/.test(text)
    || /\b(?:monte|monta|organize|organiza|planeje|planeja|refaca|crie)\s+(?:(?:um|uma|meu|minha|o|a)\s+)?(?:dia|semana|agenda|rotina|cronograma)\b/.test(text)
    || /\b(?:i\s+(?:need|want|would like)\s+to|help me|can you|could you)\s+(?:create|build|organize|plan|redo)\s+(?:a|my|the)?\s*(?:routine|schedule|day|week)\b/.test(text)
    || /\b(?:build|plan|organize|create)\s+(?:my|the|a)?\s*(?:day|week|routine|schedule)\b/.test(text);

  const sourceTransformation =
    /\b(?:transforme|organize|converta)\s+.{0,100}\b(?:anotacoes|documento|lista|texto)\b.{0,60}\b(?:rotina|agenda|semana|habitos|tarefas|metas)\b/.test(text)
    || /\b(?:transform|organize|convert)\s+.{0,100}\b(?:notes|document|list|text)\b.{0,60}\b(?:routine|schedule|week|habits|tasks|goals)\b/.test(text);

  return directRequest || sourceTransformation || looksLikeStructuredRoutineSource(message, text);
}

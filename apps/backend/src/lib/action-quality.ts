export type ConcreteActionInput = {
  title: unknown;
  doneWhen?: unknown;
  starter?: unknown;
};

export type ConcreteActionVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'missing_title'
        | 'missing_executable_verb'
        | 'abstract_or_circular_action'
        | 'missing_specific_object'
        | 'missing_done_when';
    };

export const EXECUTABLE_VERB = /^(abra|abrir|anote|anotar|liste|listar|escreva|escrever|copie|copiar|meça|medir|ligue|ligar|mande|mandar|envie|enviar|selecione|selecionar|publique|publicar|edite|editar|responda|responder|pague|pagar|transfira|transferir|compare|comparar|reúna|reunir|separe|separar|retire|retirar|coloque|colocar|fotografe|fotografar|telefone|telefonar|preencha|preencher|agende|agendar|cancele|cancelar|confirme|confirmar|acesse|acessar|entre|entrar|baixe|baixar|anexe|anexar|assine|assinar|entregue|entregar|registre|registrar|identifique|identificar|monte|montar|crie|criar|marque|marcar|realize|realizar|leve|levar|enxágue|enxaguar|passe|passar|guarde|guardar|varra|varrer|corra|correr|caminhe|caminhar|cozinhe|cozinhar|leia|ler|saia|sair|deixe|deixar|tire|tirar|junte|juntar|open|write|copy|measure|list|call|send|select|publish|edit|reply|pay|transfer|compare|gather|remove|place|photograph|fill|schedule|cancel|confirm|access|download|attach|sign|deliver|record|identify|build|create|mark|take|rinse|wipe|store|sweep)\b/i;

const ABSTRACT_OPENERS = /^(escolha|escolher|considere|considerar|pense|pensar|reflita|refletir|planeje|planejar|organize|organizar|revise|revisar|resolva|resolver|decida|decidir|verifique|verificar|confira|conferir|avalie|avaliar|prepare|preparar|trate|tratar|lide|lidar|faça|fazer|comece|começar|adiantar)\b/i;

const ABSTRACT_OBJECT = /\b(uma?\s+)?(pend[eê]ncia|decis[aã]o|tarefa|coisa|algo|assunto|parte|passo|item|problema|situa[cç][aã]o|quest[ão]|prioridade|vida|planejamento|revis[aá]vel|importante|necess[aá]rio)\b/i;

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'sem', 'que', 'se',
  'e', 'ou', 'ao', 'aos', 'sua', 'seu', 'suas', 'seus', 'voce', 'você', 'hoje', 'agora',
  'depois', 'antes', 'quando', 'ate', 'até', 'por', 'minuto', 'minutos', 'hora', 'horas',
]);

const OBJECTLESS_WORDS = new Set([
  'faca', 'fazer', 'abra', 'abrir', 'anote', 'anotar', 'liste', 'listar', 'escreva', 'escrever', 'copie', 'copiar', 'meca', 'medir', 'ligue', 'ligar',
  'mande', 'mandar', 'envie', 'enviar', 'selecione', 'selecionar', 'publique', 'publicar',
  'edite', 'editar', 'responda', 'responder', 'pague', 'pagar', 'transfira', 'transferir',
  'compare', 'comparar', 'reúna', 'reunir', 'separe', 'separar', 'retire', 'retirar', 'realize', 'realizar',
  'coloque', 'colocar', 'fotografe', 'fotografar', 'telefone', 'telefonar', 'preencha',
  'preencher', 'agende', 'agendar', 'cancele', 'cancelar', 'confirme', 'confirmar',
  'acesse', 'acessar', 'entre', 'entrar', 'baixe', 'baixar', 'anexe', 'anexar', 'assine',
  'assinar', 'entregue', 'entregar', 'open', 'write', 'list', 'call', 'send', 'select',
  'publish', 'edit', 'reply', 'pay', 'transfer', 'compare', 'gather', 'remove', 'place',
  'photograph', 'fill', 'schedule', 'cancel', 'confirm', 'access', 'download', 'attach',
  'registre', 'registrar', 'identifique', 'identificar', 'monte', 'montar', 'crie', 'criar',
  'marque', 'marcar', 'leve', 'levar', 'enxague', 'enxaguar', 'passe', 'passar', 'guarde',
  'guardar', 'varra', 'varrer', 'sign', 'deliver', 'record', 'identify', 'build', 'create',
  'mark', 'take', 'rinse', 'wipe', 'store', 'sweep', 'copy', 'measure',
  'corra', 'correr', 'caminhe', 'caminhar', 'cozinhe', 'cozinhar', 'leia', 'ler',
  'saia', 'sair', 'deixe', 'deixar', 'tire', 'tirar', 'junte', 'juntar',
]);

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function normalizeActionText(value: unknown): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasSpecificObject(title: string): boolean {
  const tokens = normalizeActionText(title)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !OBJECTLESS_WORDS.has(token));
  return tokens.some((token) => !ABSTRACT_OBJECT.test(token));
}

export function validateConcreteAction(
  input: ConcreteActionInput,
  options: { requireDoneWhen?: boolean } = {},
): ConcreteActionVerdict {
  const title = cleanText(input.title);
  const doneWhen = cleanText(input.doneWhen);
  const normalizedTitle = normalizeActionText(title);
  const requireDoneWhen = options.requireDoneWhen ?? true;

  if (!title) return { ok: false, reason: 'missing_title' };
  if (ABSTRACT_OPENERS.test(normalizedTitle)) return { ok: false, reason: 'abstract_or_circular_action' };
  if (!EXECUTABLE_VERB.test(title)) return { ok: false, reason: 'missing_executable_verb' };
  if (ABSTRACT_OBJECT.test(normalizedTitle)) return { ok: false, reason: 'abstract_or_circular_action' };
  if (!hasSpecificObject(title)) return { ok: false, reason: 'missing_specific_object' };
  if (requireDoneWhen && !doneWhen) return { ok: false, reason: 'missing_done_when' };
  return { ok: true };
}

export function formatConcreteAction(input: { title: unknown; doneWhen: unknown }): string {
  const title = cleanText(input.title).replace(/[.;]\s*$/, '');
  const doneWhen = cleanText(input.doneWhen).replace(/[.;]\s*$/, '');
  return title && doneWhen ? `${title}. Pronto quando: ${doneWhen}.` : title;
}

export function validateVisibleConcreteAction(value: unknown): ConcreteActionVerdict {
  const text = cleanText(value);
  const match = text.match(/^(.+?)[.。]?\s*(?:Pronto quando|Pare quando|Done when|Stop when)\s*:\s*(.+?)[.。]?$/i);
  if (!match) return { ok: false, reason: 'missing_done_when' };
  return validateConcreteAction({ title: match[1], doneWhen: match[2] });
}

export function isGroundingQuestion(value: unknown): boolean {
  const text = cleanText(value);
  return text.length >= 8 && text.length <= 220 && /[?？]$/.test(text);
}

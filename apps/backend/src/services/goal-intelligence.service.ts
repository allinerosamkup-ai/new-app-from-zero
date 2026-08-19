import OpenAI from 'openai';
import { z } from 'zod';

import { extractJsonValue } from '../lib/extract-json';
import { getOpenAiModel, getOpenAiStructuredResponseOptions, openAiTemperature } from '../lib/openai-config';
import { validateConcreteAction, EXECUTABLE_VERB } from '../lib/action-quality';

/**
 * Interpretação de objetivo: entender → inferir → cruzar → decidir → validar → agir.
 *
 * O problema que este arquivo existe para resolver tem nome e endereço. Para o
 * objetivo "deixar a sala pronta para uso" o gerador antigo devolveu "pegue um
 * rolo de fita crepe e confira se há alguma área solta no chão". Ninguém disse
 * que existia chão solto, nem que existia fita. A IA inventou um obstáculo e
 * transformou a hipótese em tarefa.
 *
 * A causa era o prompt: ele pedia micro-ações "hiper-específicas" e mandava
 * "nomear objetos reais, apps e locais específicos" recebendo como entrada nada
 * além do título do objetivo. Especificidade sem dado vira ficção.
 *
 * A correção tem três camadas, e as três precisam existir:
 *
 *  1. **Geração com contexto e com fronteira.** O modelo recebe o que a pessoa
 *     realmente disse (nota, diário, check-in, ações já feitas) e é obrigado a
 *     marcar cada passo como `stated` (apoiado em fala dela) ou `inferred`
 *     (conhecimento geral sobre o tipo de objetivo). Inferir é permitido —
 *     "pronta para uso" significa funcional para a finalidade, e isso é
 *     conhecimento geral, não invenção. Inventar fato é que não.
 *
 *  2. **Guarda determinística.** Barata, sem rede, testável: passo que manda
 *     pegar, comprar ou usar um objeto que nunca apareceu no contexto é
 *     rejeitado antes de qualquer chamada extra. É a regra que mata a fita
 *     crepe sem depender do humor do modelo.
 *
 *  3. **Validação por LLM.** Segunda passada adversarial com os critérios de
 *     coerência causal. Reprovou, regenera uma vez com o motivo. Reprovou de
 *     novo, devolve PERGUNTA em vez de ação — "não tenho informação suficiente"
 *     é resposta melhor que preencher o card com qualquer coisa.
 */

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  return _openai;
}

export type GoalIntelligenceInput = {
  goalTitle: string;
  /** Ações já cadastradas neste objetivo — evita repetir com outras palavras. */
  existingActions?: string[];
  /** Ações já concluídas — evita sugerir o que já aconteceu. */
  completedActions?: string[];
  /** Ações rejeitadas ou adiadas; calibram sem serem sugeridas novamente. */
  blockedActions?: string[];
  userName?: string;
  locale?: string;
  /** O que a PESSOA escreveu: nota de check-in, diário, fala para a Airia. */
  userStatements?: string[];
  /** Fatos e decisões canônicos, com origem conhecida na memória. */
  canonicalFacts?: string[];
  /** Estado de hoje, quando existir check-in. */
  moodLabel?: string | null;
  energyScore?: number | null;
  phase?: string | null;
  /** Perfil operacional montado no onboarding. */
  operationalProfile?: OperationalProfile | null;
  /** Padrões confirmados da memória/RAG. Podem calibrar a ação, não criam fato novo. */
  patternContext?: string | null;
  /** Referências canônicas que devem acompanhar ações influenciadas por padrões. */
  patternEvidenceRefs?: string[];
  /** Base que a UI deve devolver junto da ação: janela, força, limites e impacto. */
  patternBasis?: PatternBasis[];
  /**
   * O que cabe hoje — **inferido** pela Airia em `lib/capacity.ts`, a partir de
   * energia, humor, sono, fase, trajetória do dia e risco.
   *
   * Não é preferência abstrata: é o teto do dia. Devolver cinco passos de
   * quinze minutos para quem mal tem combustível é o mesmo que não quebrar
   * nada — a lista continua grande demais para acontecer.
   *
   * **A tela não pergunta isso.** Perguntar seria `PRODUCT FAIL`
   * (`docs/product/PRODUCT_CONSTITUTION.md` §3). Este JSDoc já disse
   * "respondido no check-in" enquanto o valor vinha de um ternário sobre
   * energia — comentário errado vira prompt errado, e prompt errado vira a
   * Airia dizendo "você me disse" sobre algo que ninguém disse.
   */
  capacity?: 'quick' | 'moderate' | 'heavy' | null;
  /** Sinais que sustentaram a inferência, para o modelo não inventar a justificativa. */
  capacityBasis?: string | null;
};

/**
 * Parâmetros de personalização vindos do onboarding.
 *
 * Não é diagnóstico e não vira rótulo visível: é só o que muda o formato da
 * resposta — tamanho do passo, quantidade de opções, quanto contexto explicar.
 */
export type OperationalProfile = {
  preferredActionSize?: 'pequeno' | 'pequeno_medio' | 'medio' | null;
  toleranceForAmbiguity?: 'baixa' | 'media' | 'alta' | null;
  idealOptionCount?: number | null;
  difficultyStarting?: 'baixa' | 'moderada' | 'alta' | null;
  difficultyPrioritizing?: 'baixa' | 'moderada' | 'alta' | null;
  difficultyFinishing?: 'baixa' | 'moderada' | 'alta' | null;
  explainContext?: 'pouco' | 'medio' | 'muito' | null;
};

export type GoalStep = {
  title: string;
  /**
   * `stated` = apoiado em algo que a pessoa disse.
   * `inferred` = conhecimento geral sobre esse tipo de objetivo.
   *
   * A distinção não é decorativa: a guarda determinística é mais dura com
   * `inferred`, porque é ali que a invenção mora.
   */
  basedOn: 'stated' | 'inferred';
  rationale?: string;
  milestoneId?: string;
  doneWhen?: string;
  effortSize?: 'small' | 'medium' | 'large';
  evidenceRefs?: string[];
  patternBasis?: PatternBasis[];
};

export type PatternBasis = {
  pattern: string;
  evidenceCount: number;
  distinctDays: number;
  windowDays: number;
  confidence: number;
  limitation: string;
  impact: string;
};

export type GoalMilestone = {
  id: string;
  title: string;
  order: number;
  doneWhen: string;
  actions: GoalStep[];
};

export type GoalDecomposition = {
  mode: 'actions' | 'question';
  /** O que "concluído" significa para este objetivo, na leitura da IA. */
  resultDefinition: string | null;
  /** Fotografia do ponto de partida sustentada pelo contexto disponível. */
  currentReality: string | null;
  /** Etapa vigente; só ela contém ações detalhadas. */
  currentMilestoneId: string | null;
  milestones: GoalMilestone[];
  /** O que a IA assumiu sem ter dado — fica visível, não escondido. */
  assumptions: string[];
  steps: GoalStep[];
  /** Quando falta informação, a melhor próxima ação é uma pergunta. */
  question: string | null;
  /** Diagnóstico interno para log e teste. Não vai para a tela. */
  rejectedSteps?: Array<{ title: string; reason: string }>;
};

/**
 * Saída digna quando a IA não responde: passos canônicos CENTRADOS NA META,
 * nunca frases do contexto viradas literalmente em ações.
 *
 * Histórico do erro que este código corrige: a versão anterior pegava frases do
 * Diário/chat ("Olá tudo bem", "Obrigada", "Sim") e as gravava como passos
 * ("Anote a primeira ação para Olá tudo bem") com status `ready` — um caminho
 * falso exibido como se fosse válido. Aquilo violava o desenho de inteligência
 * do Airia: o app existe para conhecer a pessoa, não para vestir conversa
 * aleatória de roupa de ação.
 *
 * Este fallback segue o padrão de graceful degradation da indústria: quando a
 * camada de IA não está disponível, o sistema entrega o que é honestamente
 * possível — passos práticos e evidentes sobre a própria meta, que qualquer
 * pessoa sensata faria para começar — marcados como sugeridos, ou diz que não
 * tem informação suficiente.
 *
 * Regras duras:
 *  1. Falas do contexto NUNCA viram título de passo (podem calibrar o tema).
 *  2. Passo tem que ser FÍSICO e efetivo: "separar o tênis", "escolher a rota",
 *     "definir o horário" — nunca "anotar a primeira ação para X". Anotar só é
 *     aceitável como registro de consequência (ex.: "registrar a corrida no
 *     check-in de hoje"), nunca como primeiro passo de algo.
 *  3. Resultado definido em torno da meta real, não da fórmula genérica.
 */
const CHAT_PHRASE = /^\b(ol[áa]|oi|tudo bem|tudo bom|obrigad[oa]|obrigada aí|valeu|sim|n[aã]o|entendi|ok|certo|hum|hmm|kk|rs|rsrs|haha|boa|boa noite|bom dia|ol[áa] tudo bem|deixa[a]? claro|como vc faria isso|como vc|pode sim|de boa|show|perfeito|ent[aã]o|haja vista|s[óe] isso|é isso|isso aí|bjs|beijos)\b/i;

/**
 * Descarta micro-frases de conversação que não expressam intenção acionável.
 *
 * "Olá tudo bem", "Obrigada", "Sim" são diário, não intenção — misturar isso
 * com geração de passos foi exatamente o bug de produção. A régua: menos de 5
 * palavras, sem verbo de ação e soando como fala de diálogo é conversação.
 */
export function isConversationalPhrase(statement: string): boolean {
  const clean = statement.trim();
  if (!clean) return true;
  if (CHAT_PHRASE.test(clean)) return true;
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  const hasActionVerb = EXECUTABLE_VERB.test(clean);
  return wordCount < 5 && !hasActionVerb;
}

/**
 * Decisões práticas imediatas que destravam quase qualquer meta — em ordem
 * natural de começo. São genéricas de propósito (não citam objeto do contexto)
 * e escritas como coisa de gente: curta, direta, sem jargão.
 *
 * Ordem: primeiro o que dá contorno real à meta (o que significa, quando),
 * depois o preparo físico, depois o primeiro movimento pequeno, depois o
 * registro natural — registro é consequência do movimento, nunca o primeiro passo.
 */
const CANONICAL_STARTERS: Array<{ title: string; doneWhen: string; effortSize: 'small' | 'medium' }> = [
  {
    title: 'Decidir o que \'começado\' significa para você — duração, lugar e horário',
    doneWhen: 'você souber, sem precisar pensar, o que é uma rodada completa disso na sua rotina',
    effortSize: 'small',
  },
  {
    title: 'Deixar o que for preciso separado e acessível para começar',
    doneWhen: 'tudo o que você usa para começar estiver no lugar, sem depender de procurar nada',
    effortSize: 'small',
  },
  {
    title: 'Fazer a primeira rodada bem curta — só o suficiente para sentir que consegue',
    doneWhen: 'a primeira rodada estiver feita, mesmo pequena',
    effortSize: 'small',
  },
  {
    title: 'Registrar o que fez no check-in de hoje',
    doneWhen: 'o registro de hoje refletir essa primeira rodada',
    effortSize: 'small',
  },
  {
    title: 'Ajustar o que não funcionou e repetir',
    doneWhen: 'você souber o que manter e o que mudar na próxima rodada',
    effortSize: 'medium',
  },
];

/**
 * Saída digna para superfícies operacionais: quando a IA não responde, entrega
 * passos práticos centrados na meta, em linguagem humana — nunca frases do
 * contexto vestidas de ação.
 */
export function buildFallbackGoalDecomposition(
  input: Pick<GoalIntelligenceInput, 'goalTitle' | 'userStatements' | 'capacity'>,
): GoalDecomposition {
  const title = input.goalTitle.trim().replace(/\s+/g, ' ');
  if (!title) {
    return {
      mode: 'question',
      resultDefinition: null,
      currentReality: null,
      currentMilestoneId: null,
      milestones: [],
      assumptions: [],
      steps: [],
      question: 'Me conta: o que "começado" significa para você nesse objetivo?',
    };
  }

  const maxSteps = input.capacity === 'quick' ? 3 : 4;
  const steps = CANONICAL_STARTERS.slice(0, maxSteps).map((starter, index) => ({
    ...starter,
    title: starter.title.replace("'começado'", `"${title.toLowerCase()}"`),
    basedOn: 'inferred' as const,
    rationale: 'sugerido sem consulta completa à IA: passos práticos de começo',
    milestoneId: 'milestone-now',
  }));

  return {
    mode: 'actions',
    resultDefinition: `você ter feito ${title.toLowerCase()} pela primeira vez, do seu jeito`,
    currentReality: null,
    currentMilestoneId: 'milestone-now',
    milestones: [{
      id: 'milestone-now',
      title: 'Começo',
      order: 0,
      doneWhen: 'os primeiros passos práticos estiverem feitos',
      actions: steps,
    }],
    assumptions: ['sugerido pela Airia sem consulta completa à IA — edite como quiser'],
    steps,
    question: null,
  };
}

const clipped = (max: number) => z.string().transform((value) => value.trim().slice(0, max));

const GoalActionPayloadSchema = z.object({
  title: clipped(160),
  basedOn: z.enum(['stated', 'inferred']).catch('inferred').optional().default('inferred'),
  rationale: clipped(240).optional().default(''),
  doneWhen: clipped(240).optional().default(''),
  effortSize: z.enum(['small', 'medium', 'large']).optional(),
  evidenceRefs: z.array(clipped(120)).optional().default([]),
  patternBasis: z.array(z.object({
    pattern: clipped(240),
    evidenceCount: z.number().int().nonnegative(),
    distinctDays: z.number().int().nonnegative(),
    windowDays: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
    limitation: clipped(240),
    impact: clipped(240),
  })).optional().default([]),
});

const StepsPayloadSchema = z.object({
  resultDefinition: clipped(240).optional().default(''),
  currentReality: clipped(480).optional().default(''),
  currentMilestoneId: clipped(120).optional().default(''),
  assumptions: z.array(clipped(240)).optional().default([]),
  decisiveQuestion: clipped(320).nullable().optional().default(null),
  milestones: z.array(z.object({
    id: clipped(120),
    title: clipped(160),
    order: z.number().int().nonnegative().optional().default(0),
    doneWhen: clipped(240).optional().default(''),
    actions: z.array(GoalActionPayloadSchema).optional().default([]),
  })).optional().default([]),
  // Compatibilidade temporária com respostas e objetivos anteriores.
  steps: z.array(GoalActionPayloadSchema).optional().default([]),
});

/** Contrato da chamada dedicada de pergunta. */
const QuestionPayloadSchema = z.object({
  question: clipped(320).nullable().optional().default(null),
});

const ValidationPayloadSchema = z.object({
  approved: z.boolean(),
  failures: z.array(clipped(320)).optional().default([]),
  missingInfo: clipped(320).nullable().optional().default(null),
});

const MIN_STEPS = 2;
const MAX_STEPS = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Guarda determinística
// ─────────────────────────────────────────────────────────────────────────────

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function tokens(value: string): string[] {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Palavras que não carregam objeto. Aparecer só isso num passo não prova que a
 * IA se apoiou em dado real.
 */
const STRUCTURAL_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'pra', 'com', 'sem', 'que', 'se',
  'e', 'ou', 'ao', 'aos', 'a', 'ate', 'ja', 'la', 'ali', 'aqui', 'isso', 'esse',
  'essa', 'este', 'esta', 'seu', 'sua', 'seus', 'suas', 'voce', 'hoje', 'agora',
  'depois', 'antes', 'mais', 'menos', 'tudo', 'todo', 'toda', 'algo', 'alguma',
  'algum', 'qualquer', 'onde', 'quando', 'como', 'min', 'minuto', 'minutos',
  'primeiro', 'primeira', 'proximo', 'proxima', 'novo', 'nova', 'so', 'apenas',
  // verbos genéricos de execução: presentes em qualquer passo, não provam nada
  'abrir', 'abra', 'pegar', 'pegue', 'colocar', 'coloque', 'tirar', 'tire',
  'separar', 'separe', 'guardar', 'guarde', 'escolher', 'escolha', 'levar',
  'leve', 'juntar', 'junte', 'deixar', 'deixe', 'fazer', 'faca', 'usar', 'use',
  'comprar', 'compre', 'verificar', 'verifique', 'conferir', 'confira', 'olhar',
  'olhe', 'checar', 'checando', 'anotar', 'anote', 'escrever', 'escreva',
  'the', 'and', 'of', 'to', 'for', 'with', 'a', 'an', 'in', 'on', 'at',
]);

/**
 * Verbos que exigem que o objeto EXISTA no mundo da pessoa.
 *
 * Só posse e manipulação física. "usar" saiu depois de reprovar em produção o
 * passo "conferir se o que foi registrado está coerente e completo o suficiente
 * para usar" — o "para usar" no fim da frase não pede objeto nenhum, é
 * finalidade. Verbo polissêmico numa regra de posse só gera falso positivo, e
 * falso positivo aqui custa caro: descarta passo bom e empurra a tela para
 * "sem informação suficiente".
 *
 * O caso da fita crepe segue coberto: "pegue" abre a frase, e "fita"/"crepe"
 * ainda estão na lista de artefatos.
 */
const ACQUISITION_VERBS = /\b(pegue|pegar|peg[ao]|compre|comprar|aplique|aplicar|instale|instalar|conserte|consertar|conserta|fixe|fixar|cole|colar|pinte|pintar|take|grab|buy|apply|install|glue|paint)\b/;

/**
 * Objetos que a IA adora inventar quando não tem dado. Não é lista exaustiva —
 * é rede de segurança para a família de erro que já aconteceu em produção.
 */
const INVENTION_PRONE_ARTIFACTS = [
  'fita', 'crepe', 'durex', 'cola', 'silicone', 'parafuso', 'prego', 'martelo',
  'furadeira', 'chave', 'alicate', 'lixa', 'tinta', 'pincel', 'rolo', 'verniz',
  'massa', 'gesso', 'trena', 'escada', 'nivel', 'caixa', 'caixas', 'etiqueta',
  'etiquetas', 'saco', 'sacos', 'sacola', 'balde', 'rodo', 'vassoura', 'esponja',
  'detergente', 'alvejante', 'desinfetante', 'aspirador', 'grampeador',
  'envelope', 'fichario', 'lampada', 'extensao', 'tomada', 'prateleira',
  'suporte', 'bucha', 'abracadeira', 'tape', 'glue', 'screw', 'nail', 'hammer',
  'drill', 'paint', 'brush', 'ladder', 'bucket', 'sponge', 'label',
];

/** Cor ou medida grudada num objeto é detalhe que ninguém informou. */
const ARBITRARY_DETAIL = /\b(azul|vermelh[oa]|verde|amarel[oa]|pret[oa]|branc[oa]|ros[a]|rox[oa]|laranja|cinza|bege|marrom|blue|red|green|yellow|black|white|pink|purple|orange|gray|grey|brown)\b|\b\d+\s?(cm|m|mm|litros?|ml|kg|g|metros?)\b/;

export type SpecificityVerdict = { ok: true } | { ok: false; reason: string };

/**
 * O passo introduz um fato que ninguém informou?
 *
 * A regra central é de aquisição: "pegue X", "compre X", "use X" só é legítimo
 * quando X aparece em algum lugar do que a pessoa escreveu ou do próprio
 * objetivo. Fora disso o passo depende de um objeto que talvez nem exista.
 *
 * Passo `stated` passa por uma régua mais frouxa de propósito: se a pessoa
 * escreveu "preciso terminar de montar a estante", "pegue as peças da estante"
 * é fiel, não invenção.
 */
export function detectUnsupportedSpecificity(
  step: Pick<GoalStep, 'title' | 'basedOn'>,
  contextText: string,
): SpecificityVerdict {
  const contextTokens = new Set(tokens(contextText));
  const titleNormalized = normalize(step.title);
  const titleTokens = tokens(step.title);

  const isKnown = (token: string) => contextTokens.has(token) || STRUCTURAL_WORDS.has(token);

  if (ACQUISITION_VERBS.test(titleNormalized)) {
    const unknownObject = titleTokens.find((token) => (
      token.length >= 4
      && !isKnown(token)
      && !ACQUISITION_VERBS.test(token)
    ));
    if (unknownObject) {
      return {
        ok: false,
        reason: `manda usar/pegar "${unknownObject}", que não aparece em nada que a pessoa informou`,
      };
    }
  }

  const inventedArtifact = INVENTION_PRONE_ARTIFACTS
    .find((artifact) => titleTokens.includes(artifact) && !contextTokens.has(artifact));
  if (inventedArtifact) {
    return {
      ok: false,
      reason: `cita o objeto "${inventedArtifact}" sem nenhuma evidência de que ele exista aqui`,
    };
  }

  const arbitrary = titleNormalized.match(ARBITRARY_DETAIL);
  if (arbitrary && !contextTokens.has(normalize(arbitrary[0]))) {
    return {
      ok: false,
      reason: `detalha "${arbitrary[0]}" sem que essa informação tenha sido dada`,
    };
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

function profileLines(profile: OperationalProfile | null | undefined): string {
  if (!profile) return '';
  const lines = [
    profile.preferredActionSize ? `- tamanho de passo que funciona para ela: ${profile.preferredActionSize}` : '',
    profile.idealOptionCount ? `- quantidade de opções que ela consegue processar: ${profile.idealOptionCount}` : '',
    profile.toleranceForAmbiguity ? `- tolerância a ambiguidade: ${profile.toleranceForAmbiguity}` : '',
    profile.difficultyStarting ? `- dificuldade para iniciar: ${profile.difficultyStarting}` : '',
    profile.difficultyPrioritizing ? `- dificuldade para priorizar: ${profile.difficultyPrioritizing}` : '',
    profile.difficultyFinishing ? `- dificuldade para finalizar: ${profile.difficultyFinishing}` : '',
    profile.explainContext ? `- quanto contexto explicar: ${profile.explainContext}` : '',
  ].filter(Boolean);
  return lines.length > 0 ? `\nCOMO ELA FUNCIONA (do onboarding):\n${lines.join('\n')}` : '';
}

/** Tudo que conta como "informação que a pessoa realmente deu". */
export function buildContextText(input: GoalIntelligenceInput): string {
  return [
    input.goalTitle,
    ...(input.userStatements ?? []),
    ...(input.existingActions ?? []),
    ...(input.completedActions ?? []),
    ...(input.blockedActions ?? []),
    ...(input.canonicalFacts ?? []),
  ].filter(Boolean).join(' \n ');
}

export function buildGoalDecompositionPrompt(input: GoalIntelligenceInput): string {
  const english = (input.locale ?? 'pt-BR').toLowerCase().startsWith('en');
  const name = input.userName ?? 'A pessoa';

  const said = (input.userStatements ?? []).filter(Boolean);
  const saidBlock = said.length > 0
    ? `\nO QUE ELA REALMENTE DISSE (fonte atual de maior autoridade; já filtrado para o contexto DESTE objetivo):\n${said.map((line) => `- "${line}"`).join('\n')}`
    : '\nO QUE ELA REALMENTE DISSE sobre este objetivo: nada além do título.';

  /**
   * Contenção de alucinação de relação.
   *
   * O filtro de domínio já tira do prompt o que não pertence a este objetivo,
   * mas o modelo ainda pode inventar a ponte a partir do que sobrou. Esta regra
   * existe porque o caso real foi exatamente esse: um relato familiar virou
   * causa de um objetivo de trabalho, e a resposta soava plausível.
   */
  const separationRule = `
SEPARAÇÃO DE CONTEXTO (obrigatória):
- Esta pessoa vive vários assuntos ao mesmo tempo — família, trabalho, saúde, dinheiro, casa, relacionamento. Eles coexistem e NÃO são intercambiáveis.
- Só relacione duas informações se houver evidência de que pertencem ao mesmo contexto. Acontecer no mesmo dia NÃO é evidência.
- É PROIBIDO explicar este objetivo por um acontecimento de outro assunto, ou transformar um problema pessoal em objetivo profissional (e vice-versa).
- É PROIBIDO reescrever o significado do objetivo dela. Você pode decompor, priorizar e propor ações; não pode mudar o que ele é.
- Você NÃO precisa achar conexão. "Isso não está relacionado a este objetivo" é uma conclusão correta e esperada.`;

  const existing = (input.existingActions ?? []).filter(Boolean);
  const existingBlock = existing.length > 0
    ? `\nAções que já existem neste objetivo: ${existing.join(' | ')}`
    : '';
  const completed = (input.completedActions ?? []).filter(Boolean);
  const completedBlock = completed.length > 0
    ? `\nJá concluído (nunca sugira de novo): ${completed.join(' | ')}`
    : '';
  const blocked = (input.blockedActions ?? []).filter(Boolean);
  const blockedBlock = blocked.length > 0
    ? `\nRejeitado ou adiado (não repita nem reformule): ${blocked.join(' | ')}`
    : '';
  const canonicalFacts = (input.canonicalFacts ?? []).filter(Boolean);
  const canonicalBlock = canonicalFacts.length > 0
    ? `\nFATOS E DECISÕES CANÔNICOS DA MEMÓRIA:\n${canonicalFacts.map((line) => `- ${line}`).join('\n')}`
    : '';

  const today = [
    input.moodLabel ? `estado de hoje: ${input.moodLabel}` : '',
    typeof input.energyScore === 'number' ? `energia: ${input.energyScore}/10` : '',
    input.phase ? `fase do ciclo: ${input.phase}` : '',
  ].filter(Boolean);
  const todayBlock = today.length > 0 ? `\nHOJE: ${today.join(' · ')}` : '';
  const capacityBlock = input.capacity
    ? `\nCAPACIDADE DE HOJE (INFERIDA por você${input.capacityBasis ? ` a partir de: ${input.capacityBasis}` : ''}; ela NÃO escolheu isto e pode corrigir depois): ${{
        quick: 'só algo rápido — no máximo 2 passos, o primeiro em menos de 5 minutos',
        moderate: 'moderado — até 4 passos curtos',
        heavy: 'aguenta algo mais trabalhoso — pode incluir o passo mais pesado do caminho',
      }[input.capacity]}\nTrate como teto do dia. NUNCA escreva "você disse que", "como você pediu" ou "você escolheu" sobre a capacidade — ninguém perguntou isso a ela.`
    : '';
  const patternBlock = input.patternContext
    ? `\nPADRÃO OBSERVADO (explica comportamento e pode calibrar a ação quando for relevante; NÃO cria fato novo nem destino operacional):\n${input.patternContext}`
    : '';

  const language = english
    ? 'Answer in English, keeping the same JSON contract.'
    : 'Responda em português do Brasil, mantendo o mesmo contrato JSON.';

  return `${name} tem o objetivo abaixo. Sua tarefa é interpretar o objetivo e devolver apenas o caminho que pode ser executado de verdade.
${language}

OBJETIVO: "${input.goalTitle}"${saidBlock}${existingBlock}${completedBlock}${blockedBlock}${canonicalBlock}${todayBlock}${capacityBlock}${patternBlock}${profileLines(input.operationalProfile)}
${separationRule}

PRINCÍPIO DO CAMINHO:
Uma meta não vira uma lista de intenções. Cada ação da etapa atual precisa dizer o que a pessoa faz, sobre qual objeto ou assunto identificável e qual evidência encerra aquele passo. Se você não consegue escrever esses três elementos sem inventar um fato, não escreva uma ação: faça a pergunta decisiva.

ORDEM DE LEITURA:
1. Defina o resultado final sem alterar o sentido da meta.
2. Separe o que foi dito, o que é inferência geral segura e o que seria invenção.
3. Modele as etapas causais entre o ponto de partida e o resultado.
4. Detalhe somente a etapa atual com ações concretas e encerráveis.

ORDEM DE AUTORIDADE:
1. descrição e respostas específicas deste objetivo;
2. contexto atual do Diário e Check-in;
3. ações concluídas, editadas, rejeitadas ou adiadas;
4. fatos canônicos da memória;
5. padrões históricos, somente para calibrar tamanho e ordem;
6. inferência geral, sempre marcada como "inferred".

LIMITES DE VERDADE:
- Você não pode assumir problema, objeto, app, pessoa, prazo, valor ou circunstância que não apareça acima.
- "Deixar a sala pronta para uso" autoriza tornar a sala funcional; não autoriza inventar fita crepe, defeito no chão, caixa azul ou compra necessária.
- Inferência geral segura é permitida quando funciona para qualquer situação coberta pelo objetivo. Detalhe que só funciona se um fato não informado existir é invenção.

CONTRATO OBRIGATÓRIO DE CADA AÇÃO:
- "title" começa com verbo executável e nomeia um objeto, assunto ou conjunto identificável no objetivo ou no contexto.
- "doneWhen" descreve a evidência observável de que a ação acabou. Não use "quando estiver pronto", "quando terminar" ou a própria ação reformulada.
- Ação não é decidir o que fazer. São proibidas formulações como "Escolher revisar uma pendência financeira revisável", "Separar uma decisão financeira reversível", "Planejar", "Organizar melhor", "Pensar sobre", "Revisar uma pendência" e "Resolver isso".
- Exemplo de forma válida, quando o contexto cita banco e saldo: title "Abrir o app do banco e anotar o saldo atual"; doneWhen "o saldo estiver anotado".
- Exemplo de forma válida, quando há contas citadas: title "Listar as três contas que vencem nesta semana"; doneWhen "as três contas estiverem em uma nota".
- Nunca use esses exemplos para inventar banco, contas, app ou saldo em outro objetivo.
- Prefira uma pergunta única a uma ação circular ou abstrata.

PERGUNTA DECISIVA:
- Use "decisiveQuestion" somente quando uma resposta curta muda materialmente o caminho ou quando falta o objeto seguro necessário para formular a primeira ação.
- Faça uma pergunta curta e útil; não faça questionário e não pergunte o que já está acima.
- Quando usar a pergunta, devolva milestones vazias. Caso contrário, "decisiveQuestion" é null.

FORMATO DO CAMINHO:
- "currentReality" resume apenas o ponto de partida sustentado pelo contexto.
- "milestones" organiza etapas causalmente ordenadas; "currentMilestoneId" aponta a única etapa detalhada agora.
- Detalhe de 1 a ${MAX_STEPS} ações somente na etapa atual. Etapas futuras usam "actions": [].
- Todo milestone e toda ação têm "doneWhen" observável.
- Baixa energia reduz somente a ação atual, nunca o resultado nem as etapas futuras.
- Não repita, disfarce ou reintroduza ação concluída, rejeitada ou adiada.
- "assumptions" lista inferências honestas que não vieram da pessoa.

JSON APENAS:
{"resultDefinition":"...","currentReality":"...","assumptions":["..."],"decisiveQuestion":null,"currentMilestoneId":"m-1","milestones":[{"id":"m-1","title":"...","order":0,"doneWhen":"...","actions":[{"title":"...","basedOn":"stated|inferred","rationale":"...","doneWhen":"evidência observável de término","effortSize":"small|medium|large","evidenceRefs":["statement:0"]}]},{"id":"m-2","title":"...","order":1,"doneWhen":"...","actions":[]}]}`;
}

/**
 * A pergunta tem prompt próprio, e é chamada só depois que a decomposição
 * falhou.
 *
 * Motivo: enquanto os dois cabiam no mesmo contrato, o modelo escolhia perguntar
 * — inclusive quando a pessoa já tinha escrito o que falta. Não adiantou proibir
 * no texto nem insistir com uma segunda tentativa; em produção os três cenários
 * de teste voltaram com pergunta. Dar a opção É o que produz a escolha.
 *
 * Com responsabilidade única em cada chamada, o gerador não tem como se esquivar
 * para a pergunta, e o formulador de pergunta não tem como devolver tarefa.
 */
export function buildClarifyingQuestionPrompt(input: GoalIntelligenceInput): string {
  const english = (input.locale ?? 'pt-BR').toLowerCase().startsWith('en');
  const said = (input.userStatements ?? []).filter(Boolean);
  const language = english
    ? 'Answer in English, same JSON contract.'
    : 'Responda em português do Brasil, mesmo contrato JSON.';
  const saidBlock = said.length > 0
    ? `O QUE ELA JÁ DISSE:\n${said.map((line) => `- "${line}"`).join('\n')}`
    : 'Ela não disse mais nada além do título.';

  return `Não foi possível montar um caminho confiável para o objetivo abaixo.
${language}

OBJETIVO: "${input.goalTitle}"
${saidBlock}

Escreva UMA pergunta curta que resolva a bifurcação — a informação que, sem ela,
faria você escolher um caminho completamente diferente.

REGRAS:
- Uma pergunta só. Não faça bateria de perguntas.
- Não pergunte o que ela já respondeu acima.
- Não peça detalhe que não muda o caminho.
- Linguagem direta, como quem quer ajudar, não como formulário.

Exemplo bom para "organizar minhas finanças":
"Hoje o principal problema é dívida, gasto mensal ou falta de controle do dinheiro?"

JSON APENAS:
{"question":"..."}`;
}

export function buildActionValidationPrompt(input: {
  goalTitle: string;
  contextText: string;
  steps: GoalStep[];
  resultDefinition: string | null;
  locale?: string;
}): string {
  const language = (input.locale ?? 'pt-BR').toLowerCase().startsWith('en')
    ? 'Answer in English, same JSON contract.'
    : 'Responda em português do Brasil, mesmo contrato JSON.';

  return `Você revisa uma decomposição de objetivo de forma independente.
${language}

OBJETIVO: "${input.goalTitle}"
RESULTADO PRETENDIDO: ${input.resultDefinition || '(não declarado)'}
INFORMAÇÃO DISPONÍVEL:
${input.contextText || '(apenas o título do objetivo)'}

AÇÕES PROPOSTAS:
${input.steps.map((step, index) => `${index + 1}. title: ${step.title}\n   doneWhen: ${step.doneWhen || '(ausente)'}`).join('\n')}

APROVE somente uma sequência que cumpra simultaneamente:
1. Cada ação começa com verbo executável, tem objeto ou assunto identificável e tem uma evidência observável em "doneWhen".
2. A ação leva causalmente ao resultado e não apenas repete a meta em palavras menores.
3. A ação não decide, considera, planeja, organiza melhor, revisa uma pendência vaga nem usa objeto, pessoa, app, defeito, medida ou circunstância inventada.
4. Inferência geral segura é permitida; invenção de fato não é. "Retire da sala o que não pertence ali" pode ser seguro. "Pegue fita crepe para consertar o chão" inventa objeto e defeito.
5. A sequência não repete ação concluída, rejeitada ou adiada e não detalha artificialmente etapas futuras.

REPROVE explicitamente ações sem "doneWhen", sem objeto específico ou com estrutura circular, mesmo que pareçam produtivas. Quando o contexto não permitir formular a primeira ação concreta sem invenção, use "missingInfo" para escrever uma única pergunta que obtenha a âncora ausente.

JSON APENAS:
{"approved":true|false,"failures":["passo 2 não tem objeto específico e critério observável de término"],"missingInfo":null}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Serviço
// ─────────────────────────────────────────────────────────────────────────────

type ChatClient = Pick<OpenAI, 'chat'>;
const STRUCTURED_RESPONSE_TIMEOUT_MS = 25_000;

async function completeJson(
  client: ChatClient,
  system: string,
  user: string,
  maxTokens: number,
  model = getOpenAiModel(),
): Promise<unknown> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    ...getOpenAiStructuredResponseOptions(model, maxTokens),
    ...openAiTemperature(model, 0.25),
  } as any, { timeout: STRUCTURED_RESPONSE_TIMEOUT_MS });
  const content = response.choices?.[0]?.message?.content;
  return content ? extractJsonValue(content) : null;
}

const GENERATOR_SYSTEM = 'Você interpreta objetivos e devolve o caminho real até eles. Nunca inventa fato, objeto ou defeito. Responde só JSON.';
const VALIDATOR_SYSTEM = 'Você revisa recomendações e reprova o que não se sustenta em dado real. Responde só JSON.';
const FALLBACK_MODEL = 'gpt-5-mini';

type ParsedPathPayload = z.infer<typeof StepsPayloadSchema>;

function normalizePathPayload(payload: ParsedPathPayload): {
  milestones: GoalMilestone[];
  currentMilestoneId: string | null;
  steps: GoalStep[];
} {
  const sourceMilestones = payload.milestones.length > 0
    ? payload.milestones
    : payload.steps.length > 0
      ? [{
          id: 'milestone-1',
          title: 'Caminho atual',
          order: 0,
          doneWhen: payload.resultDefinition,
          actions: payload.steps,
        }]
      : [];

  const milestones: GoalMilestone[] = sourceMilestones
    .map((milestone, index) => ({
      id: milestone.id || `milestone-${index + 1}`,
      title: milestone.title || `Etapa ${index + 1}`,
      order: milestone.order ?? index,
      doneWhen: milestone.doneWhen || '',
      actions: milestone.actions.map((action) => ({
        title: action.title,
        basedOn: action.basedOn,
        ...(action.rationale ? { rationale: action.rationale } : {}),
        milestoneId: milestone.id || `milestone-${index + 1}`,
        ...(action.doneWhen ? { doneWhen: action.doneWhen } : {}),
        ...(action.effortSize ? { effortSize: action.effortSize } : {}),
        ...(action.evidenceRefs.length > 0 ? { evidenceRefs: action.evidenceRefs } : {}),
        ...(action.patternBasis.length > 0 ? { patternBasis: action.patternBasis } : {}),
      })),
    }))
    .sort((left, right) => left.order - right.order);

  const requestedCurrent = payload.currentMilestoneId || milestones[0]?.id || null;
  const currentMilestoneId = milestones.some((item) => item.id === requestedCurrent)
    ? requestedCurrent
    : milestones[0]?.id ?? null;
  const steps = milestones.find((item) => item.id === currentMilestoneId)?.actions ?? [];

  return { milestones, currentMilestoneId, steps };
}

function attachPatternEvidenceRefs(steps: GoalStep[], refs: string[] | undefined, basis: PatternBasis[] | undefined): GoalStep[] {
  const cleanRefs = [...new Set((refs ?? []).map((ref) => ref.trim()).filter(Boolean))].slice(0, 12);
  const cleanBasis = (basis ?? []).slice(0, 4);
  if (cleanRefs.length === 0 && cleanBasis.length === 0) return steps;
  return steps.map((step) => ({
    ...step,
    ...(cleanRefs.length > 0 ? { evidenceRefs: [...new Set([...(step.evidenceRefs ?? []), ...cleanRefs])].slice(0, 16) } : {}),
    ...(step.patternBasis?.length ? { patternBasis: step.patternBasis } : cleanBasis.length > 0 ? { patternBasis: cleanBasis } : {}),
  }));
}

export class GoalIntelligenceService {
  /** Exposto para teste: o prompt é contrato, não detalhe interno. */
  static buildPromptFor(input: GoalIntelligenceInput): string {
    return buildGoalDecompositionPrompt(input);
  }

  /**
   * Filtro determinístico contra INVENÇÃO — e só contra isso.
   *
   * Pertinência ao objetivo saiu daqui. A versão anterior media sobreposição de
   * palavras entre passo e objetivo, e em produção descartou "listar as
   * categorias que você quer controlar" para o objetivo "organizar minhas
   * finanças": ligação óbvia para qualquer humano, zero palavras em comum. Com
   * objetivo curto e passo em vocabulário de domínio a heurística erra sempre
   * para o mesmo lado — rejeita o que é bom e empurra a tela para "sem
   * informação suficiente".
   *
   * Julgar pertinência é trabalho do validador, que lê significado. Aqui fica o
   * que uma regra léxica realmente sabe fazer: apontar objeto, cor ou medida que
   * não existe em lugar nenhum do que a pessoa informou.
   */
  static screenSteps(steps: GoalStep[], input: GoalIntelligenceInput): {
    kept: GoalStep[];
    rejected: Array<{ title: string; reason: string }>;
  } {
    const contextText = buildContextText(input);
    const kept: GoalStep[] = [];
    const rejected: Array<{ title: string; reason: string }> = [];
    const seen = new Set<string>();

    for (const step of steps) {
      const key = normalize(step.title).replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const specificity = detectUnsupportedSpecificity(step, contextText);
      if (!specificity.ok) {
        rejected.push({ title: step.title, reason: specificity.reason });
        continue;
      }
      const concreteness = validateConcreteAction(step);
      if (!concreteness.ok) {
        rejected.push({ title: step.title, reason: `ação não atende ao contrato de concretude: ${concreteness.reason}` });
        continue;
      }
      kept.push(step);
    }

    return { kept, rejected: rejected.slice(0, MAX_STEPS) };
  }

  /**
   * Devolve passos validados ou uma pergunta.
   *
   * Nunca devolve "qualquer coisa para preencher o card": sem informação
   * suficiente e sem modelo disponível, `mode` volta como `question` com a
   * pergunta que destrava, ou vazio.
   */
  static async decompose(
    input: GoalIntelligenceInput,
    client?: ChatClient,
  ): Promise<GoalDecomposition> {
    const empty: GoalDecomposition = {
      mode: 'question',
      resultDefinition: null,
      currentReality: null,
      currentMilestoneId: null,
      milestones: [],
      assumptions: [],
      steps: [],
      question: null,
    };

    if (!input.goalTitle?.trim()) return empty;
    // Sem chave e sem cliente injetado não existe interpretação possível. Devolver
    // lista genérica aqui seria exatamente o comportamento que este arquivo veio
    // eliminar.
    if (!client && !process.env.OPENAI_API_KEY) return empty;
    const chat = client ?? getOpenAI();

    try {
      let feedback = '';
      let lastRejections: Array<{ title: string; reason: string }> = [];
      let lastResultDefinition: string | null = null;
      let lastCurrentReality: string | null = null;
      let lastAssumptions: string[] = [];
      // Decomposição exige JSON estrito e passos verificáveis. O modelo GPT de
      // raciocínio entrega esse contrato de forma compatível; Claude permanece
      // disponível por configuração explícita quando necessário.
      const primaryModel = process.env.OPENAI_DECOMPOSITION_MODEL?.trim() || 'gpt-5';
      const fallbackModel = process.env.OPENAI_DECOMPOSITION_FALLBACK_MODEL?.trim() || FALLBACK_MODEL;

      // Duas tentativas: a segunda recebe o motivo exato da reprovação. Mais que
      // isso vira loop caro sem ganho — se falhou duas vezes com o motivo na
      // mão, o problema é falta de informação, e aí a saída é perguntar.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const prompt = attempt === 0
          ? buildGoalDecompositionPrompt(input)
          : `${buildGoalDecompositionPrompt(input)}\n\nA TENTATIVA ANTERIOR FOI REPROVADA:\n${feedback}\nCorrija exatamente isso, sem inventar objeto, defeito nem circunstância.`;

        const generationModel = attempt === 0 ? primaryModel : fallbackModel;
        const validationModel = generationModel === fallbackModel ? primaryModel : fallbackModel;
        const raw = await completeJson(chat, GENERATOR_SYSTEM, prompt, 1200, generationModel);
        const parsed = StepsPayloadSchema.safeParse(raw);
        if (!parsed.success) {
          // Loga o motivo: parse silencioso já escondeu uma geração perfeita
          // atrás de "sem informação suficiente" em produção uma vez.
          console.warn(
            '[goal-intelligence] payload fora do contrato:',
            parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' | '),
          );
          feedback = 'resposta fora do contrato JSON';
          continue;
        }

        const payload = parsed.data;
        const assumptions = payload.assumptions.filter(Boolean).slice(0, 4);
        lastResultDefinition = payload.resultDefinition || lastResultDefinition;
        lastCurrentReality = payload.currentReality || lastCurrentReality;
        lastAssumptions = assumptions.length > 0 ? assumptions : lastAssumptions;

        if (payload.decisiveQuestion) {
          return {
            mode: 'question',
            resultDefinition: payload.resultDefinition || null,
            currentReality: payload.currentReality || null,
            currentMilestoneId: null,
            milestones: [],
            assumptions,
            steps: [],
            question: payload.decisiveQuestion,
          };
        }

        const path = normalizePathPayload(payload);
        const screened = this.screenSteps(path.steps, input);
        lastRejections = screened.rejected;

        if (screened.kept.length === 0) {
          feedback = screened.rejected.map((item) => `- "${item.title}": ${item.reason}`).join('\n')
            || 'nenhum passo utilizável';
          continue;
        }

        const steps = attachPatternEvidenceRefs(screened.kept.slice(0, MAX_STEPS), input.patternEvidenceRefs, input.patternBasis);
        const milestones = path.milestones.map((milestone) => (
          milestone.id === path.currentMilestoneId
            ? { ...milestone, actions: steps }
            : { ...milestone, actions: [] }
        ));
        const verdict = await this.validate({
          goalTitle: input.goalTitle,
          contextText: buildContextText(input),
          resultDefinition: payload.resultDefinition || null,
          steps,
          locale: input.locale,
        }, chat, validationModel);

        if (verdict.approved) {
          return {
            mode: 'actions',
            resultDefinition: payload.resultDefinition || null,
            currentReality: payload.currentReality || null,
            currentMilestoneId: path.currentMilestoneId,
            milestones,
            assumptions,
            steps,
            question: null,
            rejectedSteps: screened.rejected,
          };
        }


        feedback = verdict.failures.join('\n') || 'reprovado pelo revisor sem motivo declarado';
      }

      // Nenhuma tentativa produziu caminho semanticamente aprovado. Uma guarda
      // determinística pode barrar invenção, mas nunca aprova sentido, sequência
      // ou vínculo causal no lugar do revisor independente.
      const question = await this.askClarifyingQuestion(input, chat);
      return {
        mode: 'question',
        resultDefinition: lastResultDefinition,
        currentReality: lastCurrentReality,
        currentMilestoneId: null,
        milestones: [],
        assumptions: lastAssumptions,
        steps: [],
        question,
        rejectedSteps: lastRejections,
      };
    } catch (error) {
      console.warn('[goal-intelligence] falhou, seguindo sem sugerir:', error);
      return empty;
    }
  }

  /**
   * A pergunta que destrava, quando não houve caminho.
   *
   * Chamada dedicada de propósito: enquanto passos e pergunta dividiam o mesmo
   * contrato, o modelo escolhia perguntar mesmo com contexto suficiente.
   */
  static async askClarifyingQuestion(
    input: GoalIntelligenceInput,
    client?: ChatClient,
  ): Promise<string | null> {
    if (!client && !process.env.OPENAI_API_KEY) return null;
    try {
      const raw = await completeJson(
        client ?? getOpenAI(),
        'Você formula UMA pergunta curta que destrava um objetivo. Responde só JSON.',
        buildClarifyingQuestionPrompt(input),
        200,
      );
      const parsed = QuestionPayloadSchema.safeParse(raw);
      return parsed.success ? (parsed.data.question?.trim() || null) : null;
    } catch {
      return null;
    }
  }

  /** Camada 3. Separada para poder ser testada e reaproveitada. */
  static async validate(
    input: {
      goalTitle: string;
      contextText: string;
      resultDefinition: string | null;
      steps: GoalStep[];
      locale?: string;
    },
    client?: ChatClient,
    model = process.env.OPENAI_DECOMPOSITION_FALLBACK_MODEL?.trim() || FALLBACK_MODEL,
  ): Promise<{ approved: boolean; failures: string[]; missingInfo: string | null }> {
    if (input.steps.length === 0) {
      return { approved: false, failures: ['nenhum passo para validar'], missingInfo: null };
    }
    if (!client && !process.env.OPENAI_API_KEY) {
      return { approved: false, failures: ['revisor sem modelo disponível'], missingInfo: null };
    }
    try {
      const raw = await completeJson(client ?? getOpenAI(), VALIDATOR_SYSTEM, buildActionValidationPrompt(input), 500, model);
      const parsed = ValidationPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        return { approved: false, failures: ['resposta do revisor fora do contrato'], missingInfo: null };
      }
      return {
        approved: parsed.data.approved,
        failures: parsed.data.failures,
        missingInfo: parsed.data.missingInfo,
      };
    } catch {
      return { approved: false, failures: ['revisor indisponível'], missingInfo: null };
    }
  }
}

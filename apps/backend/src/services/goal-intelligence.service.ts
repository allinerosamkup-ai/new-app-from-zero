import OpenAI from 'openai';
import { z } from 'zod';

import { extractJsonValue } from '../lib/extract-json';
import { getOpenAiMaxCompletionTokens, getOpenAiModel, openAiTemperature } from '../lib/openai-config';

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
  userName?: string;
  locale?: string;
  /** O que a PESSOA escreveu: nota de check-in, diário, fala para a Airia. */
  userStatements?: string[];
  /** Estado de hoje, quando existir check-in. */
  moodLabel?: string | null;
  energyScore?: number | null;
  phase?: string | null;
  /** Perfil operacional montado no onboarding. */
  operationalProfile?: OperationalProfile | null;
  /** Padrões da memória/RAG. Explicam comportamento, não criam fato novo. */
  patternContext?: string | null;
  /**
   * O que cabe hoje, respondido no check-in.
   *
   * Não é preferência abstrata: é o teto do dia. Devolver cinco passos de
   * quinze minutos para quem acabou de dizer "só algo rápido" é o mesmo que não
   * quebrar nada — a lista continua grande demais para acontecer.
   */
  capacity?: 'quick' | 'moderate' | 'heavy' | null;
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
};

export type GoalDecomposition = {
  mode: 'actions' | 'question';
  /** O que "concluído" significa para este objetivo, na leitura da IA. */
  resultDefinition: string | null;
  /** O que a IA assumiu sem ter dado — fica visível, não escondido. */
  assumptions: string[];
  steps: GoalStep[];
  /** Quando falta informação, a melhor próxima ação é uma pergunta. */
  question: string | null;
  /** Diagnóstico interno para log e teste. Não vai para a tela. */
  rejectedSteps?: Array<{ title: string; reason: string }>;
};

/**
 * Texto que corta em vez de reprovar.
 *
 * Isto já quebrou em produção: o modelo devolveu uma decomposição impecável com
 * `rationale` de 170 caracteres contra um teto de 160, e o `safeParse` derrubou
 * o payload INTEIRO. Duas tentativas depois a tela mostrava "sem informação
 * suficiente" — mentira, a informação estava lá.
 *
 * A regra que ficou: limite em campo acessório é formatação, não validação.
 * Passa a régua no texto e segue. Só o que muda a decisão — existir um passo,
 * existir uma pergunta — pode reprovar a resposta.
 */
const clipped = (max: number) => z.string().transform((value) => value.trim().slice(0, max));

const StepsPayloadSchema = z.object({
  resultDefinition: clipped(240).optional().default(''),
  assumptions: z.array(clipped(240)).optional().default([]),
  steps: z.array(z.object({
    title: clipped(160),
    basedOn: z.enum(['stated', 'inferred']).catch('inferred').optional().default('inferred'),
    rationale: clipped(240).optional().default(''),
  })).optional().default([]),
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
  ].filter(Boolean).join(' \n ');
}

export function buildGoalDecompositionPrompt(input: GoalIntelligenceInput): string {
  const english = (input.locale ?? 'pt-BR').toLowerCase().startsWith('en');
  const name = input.userName ?? 'A pessoa';

  const said = (input.userStatements ?? []).filter(Boolean);
  const saidBlock = said.length > 0
    ? `\nO QUE ELA REALMENTE DISSE (única fonte de fato):\n${said.map((line) => `- "${line}"`).join('\n')}`
    : '\nO QUE ELA REALMENTE DISSE: nada além do título do objetivo.';

  const existing = (input.existingActions ?? []).filter(Boolean);
  const existingBlock = existing.length > 0
    ? `\nAções que já existem neste objetivo: ${existing.join(' | ')}`
    : '';
  const completed = (input.completedActions ?? []).filter(Boolean);
  const completedBlock = completed.length > 0
    ? `\nJá concluído (nunca sugira de novo): ${completed.join(' | ')}`
    : '';

  const today = [
    input.moodLabel ? `estado de hoje: ${input.moodLabel}` : '',
    typeof input.energyScore === 'number' ? `energia: ${input.energyScore}/10` : '',
    input.phase ? `fase do ciclo: ${input.phase}` : '',
  ].filter(Boolean);
  const todayBlock = today.length > 0 ? `\nHOJE: ${today.join(' · ')}` : '';
  const capacityBlock = input.capacity
    ? `\nCAPACIDADE DE HOJE (dita por ela agora): ${{
        quick: 'só algo rápido — no máximo 2 passos, o primeiro em menos de 5 minutos',
        moderate: 'moderado — até 4 passos curtos',
        heavy: 'aguenta algo mais trabalhoso — pode incluir o passo mais pesado do caminho',
      }[input.capacity]}`
    : '';
  const patternBlock = input.patternContext
    ? `\nPADRÃO OBSERVADO (explica comportamento, NÃO cria fato):\n${input.patternContext}`
    : '';

  const language = english
    ? 'Answer in English, keeping the same JSON contract.'
    : 'Responda em português do Brasil, mantendo o mesmo contrato JSON.';

  return `${name} tem o objetivo abaixo. Sua tarefa é INTERPRETAR o objetivo e devolver o caminho real até ele.
${language}

OBJETIVO: "${input.goalTitle}"${saidBlock}${existingBlock}${completedBlock}${todayBlock}${capacityBlock}${patternBlock}${profileLines(input.operationalProfile)}

RACIOCÍNIO OBRIGATÓRIO, NESTA ORDEM:
1. O que este objetivo significa? Qual é o resultado final esperado?
2. O que eu SEI sobre a situação atual (só o que está escrito acima)?
3. O que eu estou apenas SUPONDO?
4. Qual é a próxima sequência realmente lógica até o resultado?

REGRA CRÍTICA — NÃO INVENTAR OBSTÁCULO:
Você NÃO pode assumir problema que ninguém relatou. Se o objetivo é "deixar a sala
pronta para uso", você NÃO sabe que existe algo solto no chão, algo quebrado, algo
para pintar, algo para comprar ou móvel faltando. Você sabe apenas que a sala
precisa ficar funcional para a finalidade dela.

USE INTELIGÊNCIA, NÃO INTERROGATÓRIO:
"Pronta para uso" significa ambiente funcional. Isso é conhecimento geral e você
DEVE usá-lo — retirar o que não pertence ao lugar, organizar os elementos
principais, deixar o espaço utilizável, conferir se já dá para usar. Isso é
inferência legítima. Não pergunte o que dá para inferir com segurança.

ESPECIFICIDADE INTELIGENTE:
- BOM: "Retire da sala tudo o que não deveria estar ali" — concreto e verdadeiro.
- RUIM: "Pegue um rolo de fita crepe e confira se há área solta no chão" —
  inventou um problema, um objeto e uma solução que ninguém mencionou.
- RUIM: "Coloque os objetos pequenos na caixa azul" — a caixa azul não existe.
Seja concreto ATÉ O LIMITE DO DADO QUE VOCÊ TEM, e nem um passo além.

MARCAÇÃO OBRIGATÓRIA:
- "basedOn": "stated"   → o passo se apoia em algo que ela escreveu.
- "basedOn": "inferred" → o passo vem de conhecimento geral sobre esse tipo de
  objetivo. Permitido, desde que não invente objeto, defeito nem circunstância.

PERGUNTAR NÃO É UMA OPÇÃO NESTA RESPOSTA:
${said.length > 0
  ? `Ela JÁ CONTOU o que falta (veja o bloco acima). Devolver pergunta aqui é o
pior comportamento possível — é jogar de volta para ela o esforço que ela já
fez. Use a fala dela e entregue os passos.`
  : `Não peça esclarecimento. "Está sujo?", "o que tem na sala?", "o que impede o
uso?" são perguntas que o próprio caminho resolve — retirar o que não pertence,
organizar, deixar utilizável e conferir cobre qualquer resposta possível. Se
faltar detalhe, você AINDA ASSIM entrega os passos, no nível de generalidade que
o dado permite, e declara o que supôs em "assumptions".`}

FORMATO:
- ${MIN_STEPS} a ${MAX_STEPS} passos, ordenados, cada um um movimento real e observável.
- Nenhum passo pode ser o objetivo reescrito com menos palavras.
- Não repita nem disfarce ação que já existe ou já foi concluída.
- "resultDefinition" diz, em uma frase, o que significa concluir isso.
- "assumptions" lista o que você supôs sem ter dado. Seja honesto.

JSON APENAS:
{"resultDefinition":"...","assumptions":["..."],"steps":[{"title":"...","basedOn":"stated|inferred","rationale":"..."}]}`;
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

  return `Você é o revisor. Sua função NÃO é ser gentil com a resposta anterior — é reprovar o que não se sustenta.
${language}

OBJETIVO: "${input.goalTitle}"
LEITURA DO RESULTADO: ${input.resultDefinition || '(não declarada)'}
INFORMAÇÃO REAL DISPONÍVEL (tudo que a pessoa informou):
${input.contextText || '(apenas o título do objetivo)'}

PASSOS PROPOSTOS:
${input.steps.map((step, index) => `${index + 1}. [${step.basedOn}] ${step.title}`).join('\n')}

Avalie CADA passo contra todos estes critérios:
1. Está diretamente ligado ao objetivo?
2. Usa informação que a pessoa realmente forneceu, ou inventa contexto?
3. Aproxima concretamente do resultado desejado?
4. É executável no estado atual dela?
5. É específico SEM ser arbitrariamente específico (objeto, cor, medida ou
   defeito que ninguém mencionou reprova)?
6. Existe uma ação anterior mais lógica que ficou de fora?
7. Contradiz alguma informação disponível?

Reprove se QUALQUER passo falhar. Na dúvida, reprove.
Se o motivo da reprovação for falta de informação, escreva em "missingInfo" a
ÚNICA pergunta curta que destravaria uma boa recomendação.

JSON APENAS:
{"approved":true|false,"failures":["passo 2 inventa ..."],"missingInfo":null}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Serviço
// ─────────────────────────────────────────────────────────────────────────────

type ChatClient = Pick<OpenAI, 'chat'>;

async function completeJson(
  client: ChatClient,
  system: string,
  user: string,
  maxTokens: number,
): Promise<unknown> {
  const model = getOpenAiModel();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: getOpenAiMaxCompletionTokens(maxTokens),
    ...openAiTemperature(model, 0.25),
  } as any);
  const content = response.choices?.[0]?.message?.content;
  return content ? extractJsonValue(content) : null;
}

const GENERATOR_SYSTEM = 'Você interpreta objetivos e devolve o caminho real até eles. Nunca inventa fato, objeto ou defeito. Responde só JSON.';
const VALIDATOR_SYSTEM = 'Você revisa recomendações e reprova o que não se sustenta em dado real. Responde só JSON.';

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
      let lastAssumptions: string[] = [];

      // Duas tentativas: a segunda recebe o motivo exato da reprovação. Mais que
      // isso vira loop caro sem ganho — se falhou duas vezes com o motivo na
      // mão, o problema é falta de informação, e aí a saída é perguntar.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const prompt = attempt === 0
          ? buildGoalDecompositionPrompt(input)
          : `${buildGoalDecompositionPrompt(input)}\n\nA TENTATIVA ANTERIOR FOI REPROVADA:\n${feedback}\nCorrija exatamente isso, sem inventar objeto, defeito nem circunstância.`;

        const raw = await completeJson(chat, GENERATOR_SYSTEM, prompt, 900);
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
        lastAssumptions = assumptions.length > 0 ? assumptions : lastAssumptions;

        const screened = this.screenSteps(payload.steps, input);
        lastRejections = screened.rejected;

        if (screened.kept.length === 0) {
          feedback = screened.rejected.map((item) => `- "${item.title}": ${item.reason}`).join('\n')
            || 'nenhum passo utilizável';
          continue;
        }

        const steps = screened.kept.slice(0, MAX_STEPS);
        const verdict = await this.validate({
          goalTitle: input.goalTitle,
          contextText: buildContextText(input),
          resultDefinition: payload.resultDefinition || null,
          steps,
          locale: input.locale,
        }, chat);

        if (verdict.approved) {
          return {
            mode: 'actions',
            resultDefinition: payload.resultDefinition || null,
            assumptions,
            steps,
            question: null,
            rejectedSteps: screened.rejected,
          };
        }


        feedback = verdict.failures.join('\n') || 'reprovado pelo revisor sem motivo declarado';
      }

      // Nenhuma das duas tentativas produziu passo utilizável. Agora sim — e só
      // agora — a pergunta é a melhor próxima ação, e vai numa chamada dedicada.
      const question = await this.askClarifyingQuestion(input, chat);
      return {
        mode: 'question',
        resultDefinition: lastResultDefinition,
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
  ): Promise<{ approved: boolean; failures: string[]; missingInfo: string | null }> {
    if (input.steps.length === 0) {
      return { approved: false, failures: ['nenhum passo para validar'], missingInfo: null };
    }
    if (!client && !process.env.OPENAI_API_KEY) {
      return { approved: true, failures: [], missingInfo: null };
    }
    try {
      const raw = await completeJson(client ?? getOpenAI(), VALIDATOR_SYSTEM, buildActionValidationPrompt(input), 500);
      const parsed = ValidationPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        // Validador quebrado não pode virar aprovação silenciosa nem bloqueio
        // total: os passos já passaram pela guarda determinística, então seguem.
        return { approved: true, failures: [], missingInfo: null };
      }
      return {
        approved: parsed.data.approved,
        failures: parsed.data.failures,
        missingInfo: parsed.data.missingInfo,
      };
    } catch {
      return { approved: true, failures: [], missingInfo: null };
    }
  }
}

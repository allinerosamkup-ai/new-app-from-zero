import OpenAI from 'openai';
import { z } from 'zod';

import { getOpenAiMaxCompletionTokens, getOpenAiModel, openAiTemperature } from '../lib/openai-config';
import { extractJsonValue } from '../lib/extract-json';

/**
 * Decomposição automática de tarefa.
 *
 * Cérebro com TDAH trava em tarefa vaga porque "organizar a casa" não diz por onde
 * começar — a memória de trabalho tem que segurar o plano inteiro antes do primeiro
 * movimento. A saída é quebrar até o nível da primeira ação física visível.
 *
 * Isto roda sozinho na criação. A usuária não precisa pedir para dividir: se o item
 * é vago ou longo, ele já nasce dividido.
 */

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAI() as any)[prop];
  },
});

/** Verbos que descrevem um resultado, não um movimento. */
const VAGUE_VERBS = [
  'organizar', 'organizacao', 'arrumar', 'limpar', 'estudar', 'trabalhar', 'preparar',
  'resolver', 'fazer', 'cuidar', 'planejar', 'revisar', 'montar', 'escrever', 'terminar',
  'adiantar', 'comecar', 'tratar', 'lidar', 'ver', 'mexer', 'separar', 'ajeitar',
  'organize', 'clean', 'study', 'work', 'prepare', 'solve', 'plan', 'review', 'write',
  'finish', 'handle', 'deal', 'sort',
];

export const DECOMPOSITION_RULES = {
  /** Acima disso, mesmo tarefa clara vira bloco grande demais para começar. */
  durationThresholdMinutes: 30,
  minSteps: 2,
  maxSteps: 5,
  maxDepth: 3,
  stepMinMinutes: 5,
  stepMaxMinutes: 15,
} as const;

export type DecompositionStep = {
  title: string;
  durationMinutes: number;
  /** Primeira ação física, do tamanho de "abra a gaveta". Tira o custo de iniciar. */
  starter: string;
};

export type DecompositionInput = {
  title: string;
  durationMinutes?: number | null;
  locale?: string;
  depth?: number;
  /** Fase visível do MoodCycleEngine. Dia ruim pede passo menor, não passo igual. */
  phase?: string | null;
  /** 1 a 10. Abaixo de 4, a quebra encolhe: menos passos e mais curtos. */
  energyScore?: number | null;
  /** Categoria do bloco — muda o tipo de primeiro movimento que faz sentido. */
  category?: string | null;
  /** Nota ou contexto que a pessoa já escreveu sobre o item. */
  note?: string | null;
};

const LOW_ENERGY_THRESHOLD = 4;
const LOW_CAPACITY_PHASES = ['Recolhimento', 'Pausa', 'Turbulência', 'Desacelerando'];

/**
 * Em fase baixa, quebrar em cinco passos de quinze minutos é o mesmo que não
 * quebrar: a lista continua grande demais para caber no dia. O tamanho da quebra
 * acompanha a capacidade real.
 */
export function decompositionShape(input: DecompositionInput): { maxSteps: number; maxMinutes: number } {
  const lowEnergy = typeof input.energyScore === 'number' && input.energyScore <= LOW_ENERGY_THRESHOLD;
  const lowPhase = !!input.phase && LOW_CAPACITY_PHASES.includes(input.phase);
  if (lowEnergy || lowPhase) return { maxSteps: 3, maxMinutes: 10 };
  return { maxSteps: DECOMPOSITION_RULES.maxSteps, maxMinutes: DECOMPOSITION_RULES.stepMaxMinutes };
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** A tarefa é vaga ou grande o bastante para travar o início? */
export function shouldDecompose(input: DecompositionInput): boolean {
  const title = normalize(input.title ?? '').trim();
  if (!title) return false;
  if ((input.depth ?? 0) >= DECOMPOSITION_RULES.maxDepth) return false;

  // Já veio quebrada: "ligar para a escola" não precisa virar três passos.
  const words = title.split(/\s+/).filter(Boolean);
  const isLongEnough = (input.durationMinutes ?? 0) > DECOMPOSITION_RULES.durationThresholdMinutes;
  const hasVagueVerb = VAGUE_VERBS.some((verb) => new RegExp(`\\b${verb}`).test(title));

  if (isLongEnough) return true;
  // Verbo vago com complemento curto ("organizar a casa") trava; verbo vago com
  // complemento muito específico ("revisar o slide 4 do deck") já é acionável.
  return hasVagueVerb && words.length <= 6;
}

const StepsSchema = z.object({
  steps: z.array(z.object({
    title: z.string().trim().min(1).max(80),
    durationMinutes: z.coerce.number().int().min(1).max(120),
    starter: z.string().trim().min(1).max(120).optional().default(''),
  })).min(1),
});

function buildPrompt(input: DecompositionInput): string {
  const english = (input.locale ?? 'pt-BR').toLowerCase().startsWith('en');
  const total = input.durationMinutes ?? DECOMPOSITION_RULES.durationThresholdMinutes;
  const shape = decompositionShape(input);
  const contexto = [
    input.phase ? `Fase de hoje: ${input.phase}` : '',
    typeof input.energyScore === 'number' ? `Energia agora: ${input.energyScore}/10` : '',
    input.category ? `Categoria: ${input.category}` : '',
    input.note ? `O que ela já escreveu sobre isso: ${input.note.slice(0, 200)}` : '',
  ].filter(Boolean).join('\n');

  if (english) {
    return `Break this task into ${DECOMPOSITION_RULES.minSteps}-${shape.maxSteps} steps of ${DECOMPOSITION_RULES.stepMinMinutes}-${shape.maxMinutes} minutes.

${contexto}

RULES
1. Every step is a PHYSICAL, VISIBLE action. Banned verbs: think, decide, reflect, plan, organize, review, prepare, handle, deal with.
2. Step 1 must take under 2 minutes. Inertia breaks on the smallest possible movement, not on the most logical one.
3. Keep her own words for the object. If she wrote "client report", the step says "client report" — not "the document".
4. Order so that stopping after step 1 still leaves something real done.
5. "starter" is the physical gesture that begins the step: which hand, which object, which button.

BAD (do not do this):
{"steps":[{"title":"Plan the report","starter":"Think about the structure"},{"title":"Write the report","starter":"Start writing"}]}
Why it is bad: "plan" and "write the report" are the original task again, in smaller words. No visible movement, no entry point.

GOOD:
{"steps":[
 {"title":"Open the client report file","durationMinutes":2,"starter":"Click the file in recent documents"},
 {"title":"Reread the last paragraph you wrote","durationMinutes":5,"starter":"Scroll to the end"},
 {"title":"Write 3 bullets for the next section","durationMinutes":10,"starter":"Type a dash and one word"}
]}

Task: ${input.title}
Total time: ${total} min

JSON only.`;
  }

  return `Quebre esta tarefa em ${DECOMPOSITION_RULES.minSteps} a ${shape.maxSteps} passos de ${DECOMPOSITION_RULES.stepMinMinutes} a ${shape.maxMinutes} minutos.

${contexto}

REGRAS
1. Todo passo é uma AÇÃO FÍSICA E VISÍVEL. Verbos proibidos: pensar, decidir, refletir, planejar, organizar, revisar, preparar, resolver, tratar, lidar, ver.
2. O passo 1 tem que levar menos de 2 minutos. A inércia quebra no menor movimento possível, não no mais lógico.
3. Use as palavras DELA para o objeto. Se ela escreveu "relatório do cliente", o passo diz "relatório do cliente" — não "o documento".
4. Ordene de modo que parar depois do passo 1 já deixe alguma coisa real feita.
5. "starter" é o gesto físico que começa o passo: qual mão, qual objeto, qual botão.
6. Se a fase de hoje for de baixa capacidade, prefira 2 passos curtos a 5 passos completos. Menos é mais honesto que uma lista que não vai acontecer.

RUIM (não faça assim):
{"steps":[{"title":"Planejar o relatório","starter":"Pensar na estrutura"},{"title":"Escrever o relatório","starter":"Começar a escrever"}]}
Por que é ruim: "planejar" e "escrever o relatório" são a tarefa original de novo, com menos palavras. Não tem movimento visível nem porta de entrada.

BOM:
{"steps":[
 {"title":"Abrir o arquivo do relatório do cliente","durationMinutes":2,"starter":"Clicar no arquivo em documentos recentes"},
 {"title":"Reler o último parágrafo que você escreveu","durationMinutes":5,"starter":"Rolar até o fim"},
 {"title":"Escrever 3 bullets do próximo tópico","durationMinutes":10,"starter":"Digitar um traço e uma palavra"}
]}

Tarefa: ${input.title}
Tempo total: ${total} min

Responda só o JSON.`;
}

export class TaskDecompositionService {
  /** Exposto para teste: o prompt é parte do contrato, não detalhe interno. */
  static buildPromptFor(input: DecompositionInput): string {
    return buildPrompt(input);
  }

  private static readonly MODEL = process.env.OPENAI_DECOMPOSITION_MODEL?.trim() || getOpenAiModel();

  /**
   * Devolve os passos, ou lista vazia quando não dá para quebrar com informação real.
   *
   * Sem modelo disponível a resposta é vazia de propósito: inventar "passo 1, passo 2,
   * passo 3" genérico é pior que não quebrar — vira ruído que a pessoa tem que limpar.
   */
  static async decompose(
    input: DecompositionInput,
    client: Pick<OpenAI, 'chat'> = openai,
  ): Promise<DecompositionStep[]> {
    if (!shouldDecompose(input)) return [];
    if (!process.env.OPENAI_API_KEY && client === openai) return [];

    try {
      const response = await client.chat.completions.create({
        model: this.MODEL,
        messages: [
          { role: 'system', content: 'Você quebra tarefas em passos físicos e curtos. Responde só JSON.' },
          { role: 'user', content: buildPrompt(input) },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: getOpenAiMaxCompletionTokens(700),
        ...openAiTemperature(this.MODEL, 0.3),
      } as any);

      const content = response.choices?.[0]?.message?.content;
      if (!content) return [];
      const parsed = StepsSchema.safeParse(extractJsonValue(content));
      if (!parsed.success) return [];

      const shape = decompositionShape(input);
      return parsed.data.steps
        .slice(0, shape.maxSteps)
        .map((step) => ({
          title: step.title,
          durationMinutes: Math.min(
            shape.maxMinutes,
            Math.max(DECOMPOSITION_RULES.stepMinMinutes, step.durationMinutes),
          ),
          starter: step.starter,
        }));
    } catch (error) {
      console.warn('[task-decomposition] falhou, seguindo sem quebrar:', error);
      return [];
    }
  }
}

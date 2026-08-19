import OpenAI from 'openai';
import { z } from 'zod';

import { getOpenAiModel, getOpenAiOutputLimit, openAiTemperature } from '../lib/openai-config';
import { extractJsonValue } from '../lib/extract-json';
import { validateConcreteAction } from '../lib/action-quality';

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
  /** Evidência observável de que o passo acabou. */
  doneWhen: string;
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
    doneWhen: z.string().trim().min(1).max(160).optional().default(''),
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

CONTRACT FOR EVERY STEP
1. "title" starts with an executable verb and names a specific object from the task or her note.
2. "doneWhen" names observable evidence that the step is complete. Do not write "when it is done" or repeat the title.
3. "starter" is the smallest physical gesture that starts the title.
4. Never use think, decide, reflect, plan, organize, review, prepare, handle, deal with, or a circular phrase such as "choose a reviewable pending item".
5. Do not invent an app, person, document, item, number or location that she did not mention. If there is no safe object, return {"steps":[]}.
6. Step 1 takes under 2 minutes. Stopping after it still leaves observable progress.

BAD:
{"steps":[{"title":"Choose a reviewable financial pending item","durationMinutes":5,"starter":"Think about options","doneWhen":"The item is chosen"}]}
Why: it asks for a decision about an unnamed thing and merely repeats itself as completion.

GOOD, when the task names a client report:
{"steps":[
 {"title":"Open the client report file","durationMinutes":2,"starter":"Click the file in recent documents","doneWhen":"the file is open"},
 {"title":"Write 3 bullets for the next section","durationMinutes":10,"starter":"Type a dash and one word","doneWhen":"three bullets are visible in the file"}
]}

Task: ${input.title}
Total time: ${total} min

JSON only.`;
  }

  return `Quebre esta tarefa em ${DECOMPOSITION_RULES.minSteps} a ${shape.maxSteps} passos de ${DECOMPOSITION_RULES.stepMinMinutes} a ${shape.maxMinutes} minutos.

${contexto}

CONTRATO DE CADA PASSO
1. "title" começa com verbo executável e nomeia o objeto específico da tarefa ou da nota dela.
2. "doneWhen" diz qual evidência observável encerra o passo. Não escreva "quando terminar" nem repita o título.
3. "starter" é o menor gesto físico que inicia o título.
4. São proibidos pensar, decidir, refletir, planejar, organizar, revisar, preparar, resolver, tratar, lidar, ver e frases circulares como "escolher revisar uma pendência financeira revisável".
5. Não invente app, pessoa, documento, item, número ou local que ela não mencionou. Sem objeto seguro, devolva {"steps":[]}.
6. O passo 1 leva menos de 2 minutos e deixa algo observável feito mesmo que ela pare ali.
7. Em baixa capacidade, prefira 2 passos curtos a 5 passos completos.

RUIM:
{"steps":[{"title":"Escolher revisar uma pendência financeira revisável","durationMinutes":5,"starter":"Pensar nas opções","doneWhen":"A pendência estiver escolhida"}]}
Por que é ruim: pede uma decisão sobre algo sem nome e repete a própria frase como término.

BOM, quando a tarefa cita um relatório do cliente:
{"steps":[
 {"title":"Abrir o arquivo do relatório do cliente","durationMinutes":2,"starter":"Clicar no arquivo em documentos recentes","doneWhen":"o arquivo estiver aberto"},
 {"title":"Escrever 3 bullets do próximo tópico","durationMinutes":10,"starter":"Digitar um traço e uma palavra","doneWhen":"três bullets estiverem visíveis no arquivo"}
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
        ...getOpenAiOutputLimit(this.MODEL, 700),
        ...openAiTemperature(this.MODEL, 0.3),
      } as any);

      const content = response.choices?.[0]?.message?.content;
      if (!content) return [];
      const parsed = StepsSchema.safeParse(extractJsonValue(content));
      if (!parsed.success) return [];

      const shape = decompositionShape(input);
      return parsed.data.steps
        .slice(0, shape.maxSteps)
        .filter((step) => validateConcreteAction(step).ok)
        .map((step) => ({
          title: step.title,
          durationMinutes: Math.min(
            shape.maxMinutes,
            Math.max(DECOMPOSITION_RULES.stepMinMinutes, step.durationMinutes),
          ),
          starter: step.starter,
          doneWhen: step.doneWhen,
        }));
    } catch (error) {
      console.warn('[task-decomposition] falhou, seguindo sem quebrar:', error);
      return [];
    }
  }
}

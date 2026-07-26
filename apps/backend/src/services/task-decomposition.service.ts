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
};

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
  if (english) {
    return `Break this task into ${DECOMPOSITION_RULES.minSteps}-${DECOMPOSITION_RULES.maxSteps} steps of ${DECOMPOSITION_RULES.stepMinMinutes}-${DECOMPOSITION_RULES.stepMaxMinutes} minutes each.
Every step must be a PHYSICAL, VISIBLE action — never "think about", "decide", "reflect".
"starter" is the very first movement, small enough to do without deciding anything.

Task: ${input.title}
Total time: ${total} min

JSON only: {"steps":[{"title":"...","durationMinutes":10,"starter":"..."}]}`;
  }
  return `Quebre esta tarefa em ${DECOMPOSITION_RULES.minSteps} a ${DECOMPOSITION_RULES.maxSteps} passos de ${DECOMPOSITION_RULES.stepMinMinutes} a ${DECOMPOSITION_RULES.stepMaxMinutes} minutos cada.
Cada passo tem que ser uma AÇÃO FÍSICA E VISÍVEL — nunca "pensar sobre", "decidir", "refletir".
"starter" é o primeiro movimento, pequeno o bastante para fazer sem decidir nada.

Tarefa: ${input.title}
Tempo total: ${total} min

Exemplo para "Limpar a cozinha":
{"steps":[
 {"title":"Jogar o lixo fora","durationMinutes":5,"starter":"Pegue o saco de lixo"},
 {"title":"Enxaguar a louça da pia","durationMinutes":10,"starter":"Abra a torneira"},
 {"title":"Passar pano no balcão","durationMinutes":5,"starter":"Molhe o pano"}
]}

Responda só o JSON.`;
}

export class TaskDecompositionService {
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

      return parsed.data.steps
        .slice(0, DECOMPOSITION_RULES.maxSteps)
        .map((step) => ({
          title: step.title,
          durationMinutes: Math.min(
            DECOMPOSITION_RULES.stepMaxMinutes,
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

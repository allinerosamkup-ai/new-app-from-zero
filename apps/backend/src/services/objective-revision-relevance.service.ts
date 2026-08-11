import OpenAI from 'openai';
import { z } from 'zod';

import { extractJsonValue } from '../lib/extract-json';
import { getOpenAiMaxCompletionTokens, openAiTemperature } from '../lib/openai-config';

type ChatClient = Pick<OpenAI, 'chat'>;

export type ObjectiveRevisionRelevanceInput = {
  objectiveTitle: string;
  resultDefinition?: string | null;
  currentReality?: string | null;
  milestones: unknown;
  currentActions: string[];
  newContext: string;
  source: 'journal' | 'checkin' | 'aura';
};

export type ObjectiveRevisionRelevance = {
  relevant: boolean;
  reason: string | null;
};

const ResultSchema = z.object({
  relevant: z.boolean(),
  reason: z.string().trim().max(320).nullable().optional().default(null),
});

let openai: OpenAI | null = null;
function defaultClient(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  return openai;
}

export function buildObjectiveRevisionRelevancePrompt(input: ObjectiveRevisionRelevanceInput): string {
  return `Decida se um contexto novo exige PROPOR revisão das ETAPAS FUTURAS de um objetivo.

OBJETIVO: ${input.objectiveTitle}
RESULTADO: ${input.resultDefinition ?? '(ainda não definido)'}
REALIDADE ATUAL: ${input.currentReality ?? '(ainda não definida)'}
ETAPAS: ${JSON.stringify(input.milestones)}
AÇÃO ATUAL: ${input.currentActions.join(' | ') || '(nenhuma)'}
NOVO CONTEXTO (${input.source}): ${input.newContext}

Marque relevant=true apenas quando o novo contexto muda materialmente o resultado,
o ponto de partida, uma dependência, recurso, limitação, compromisso ou a sequência
das etapas futuras. Mudança momentânea de humor ou energia ajusta somente o passo de
hoje e NÃO autoriza reescrever a ambição. Assunto não relacionado é false.
Não altere nada; apenas explique em uma frase factual por que caberia uma proposta.

JSON APENAS: {"relevant":true|false,"reason":"...|null"}`;
}

export class ObjectiveRevisionRelevanceService {
  static async evaluate(
    input: ObjectiveRevisionRelevanceInput,
    client?: ChatClient,
  ): Promise<ObjectiveRevisionRelevance> {
    if (!input.newContext.trim() || (!client && !process.env.OPENAI_API_KEY)) {
      return { relevant: false, reason: null };
    }
    const chat = client ?? defaultClient();
    const models = [
      process.env.OPENAI_OBJECTIVE_MODEL?.trim() || 'gpt-5.4-mini',
      process.env.OPENAI_OBJECTIVE_FALLBACK_MODEL?.trim() || 'gpt-4.1-mini',
    ];
    for (const model of models) {
      try {
        const response = await chat.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Você protege objetivos contra revisões desnecessárias. Responda somente JSON.' },
            { role: 'user', content: buildObjectiveRevisionRelevancePrompt(input) },
          ],
          response_format: { type: 'json_object' },
          max_completion_tokens: getOpenAiMaxCompletionTokens(420),
          ...openAiTemperature(model, 0.1),
        } as any);
        const content = response.choices?.[0]?.message?.content;
        const parsed = ResultSchema.safeParse(content ? extractJsonValue(content) : null);
        if (!parsed.success) continue;
        if (parsed.data.relevant && !parsed.data.reason) continue;
        return { relevant: parsed.data.relevant, reason: parsed.data.relevant ? parsed.data.reason : null };
      } catch (error) {
        console.warn(`[objective-revision-relevance] modelo ${model} falhou:`, error);
      }
    }
    return { relevant: false, reason: null };
  }
}

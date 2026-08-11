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
Perguntas que apenas pedem para repetir, explicar ou mostrar o objetivo, a realidade,
o foco ou a prioridade já existentes são false: elas não trazem contexto novo.
Não altere nada; apenas explique em uma frase factual por que caberia uma proposta.

JSON APENAS: {"relevant":true|false,"reason":"...|null"}`;
}

function isInformationalAuraQuery(input: ObjectiveRevisionRelevanceInput): boolean {
  if (input.source !== 'aura') return false;
  const text = input.newContext.trim().toLocaleLowerCase('pt-BR');
  if (!text.endsWith('?')) return false;
  const asksForExistingState = /^(qual|quais|o que|como (?:está|esta)|me diga|mostre|liste|lembre)\b/.test(text)
    && /\b(objetivo|meta|foco|realidade|prioridade|caminho|ação|acao)\b/.test(text);
  if (!asksForExistingState) return false;
  const statesMaterialChange = /\b(agora (?:eu )?(?:só |so )?consigo|mudou|mudei|caiu|aumentou|diminuiu|perdi|recebi|decidi|não consigo|nao consigo|deixou de|preciso adiar|quero mudar)\b/.test(text);
  return !statesMaterialChange;
}

export class ObjectiveRevisionRelevanceService {
  static async evaluate(
    input: ObjectiveRevisionRelevanceInput,
    client?: ChatClient,
  ): Promise<ObjectiveRevisionRelevance> {
    if (!input.newContext.trim() || (!client && !process.env.OPENAI_API_KEY)) {
      return { relevant: false, reason: null };
    }
    if (isInformationalAuraQuery(input)) {
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

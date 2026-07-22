import OpenAI from 'openai';
import { z } from 'zod';

import {
  RoutineClassifiedItemSchema,
  type RoutineClassifiedItem,
} from '../contracts/routine-builder.contract';
import { extractJsonValue } from '../lib/extract-json';
import {
  getOpenAiMaxCompletionTokens,
  getOpenAiModel,
  openAiTemperature,
} from '../lib/openai-config';
import { SuggestionMemoryService } from './suggestion-memory.service';

type ClassifierClient = Pick<OpenAI, 'chat'>;

const ModelItemSchema = RoutineClassifiedItemSchema.omit({
  id: true,
  reviewState: true,
  duplicateOf: true,
}).extend({
  parentItemId: z.string().max(80).nullable().optional(),
});

const ModelResponseSchema = z.object({
  items: z.array(ModelItemSchema).min(1).max(200),
});

export type RoutineNegativeItem = {
  title: string;
  state: 'completed' | 'rejected' | 'deleted' | 'scheduled';
};

export type RoutineClassifierErrorCode = 'empty_model_output' | 'invalid_model_output' | 'model_unavailable';

export class RoutineClassifierError extends Error {
  constructor(
    public readonly code: RoutineClassifierErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RoutineClassifierError';
  }
}

function tokens(value: string): Set<string> {
  return new Set(
    SuggestionMemoryService.buildKey(value)
      .split(' ')
      .filter((token) => token.length >= 3),
  );
}

function sameAction(left: string, right: string): boolean {
  const a = SuggestionMemoryService.buildKey(left);
  const b = SuggestionMemoryService.buildKey(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;
  let common = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) common += 1;
  return common / Math.max(leftTokens.size, rightTokens.size) >= 0.8;
}

function buildSystemPrompt(locale: string): string {
  return [
    'Você classifica uma caixa de entrada de rotina em itens independentes e operacionais.',
    `Responda no idioma ${locale}, somente como JSON válido no formato {"items":[...]}.`,
    'Tipos permitidos:',
    '- goal: resultado amplo que a pessoa quer alcançar; não tem horário próprio.',
    '- project: resultado que exige múltiplas etapas; pode apontar parentItemId para uma meta.',
    '- task: ação única, observável e concluível.',
    '- habit: comportamento recorrente; preencha recurrence quando a frequência estiver explícita.',
    '- calendar: compromisso externo com data ou horário; marque isFixed=true.',
    '- reference: informação útil sem ação explícita.',
    '- concern: medo, problema ou contexto emocional que não é obrigação.',
    'Separe todas as ações de uma mesma fonte. Nunca resuma um documento misto em um único item.',
    'Não transforme referência, preocupação ou análise em tarefa.',
    'Não invente data, horário, duração, frequência, prazo ou ação ausente na fonte.',
    'Cada item exige kind, title, sourceExcerpt, confidence e classificationReason.',
    'Use títulos naturais e específicos. Para tarefas, escreva verbo + objeto concreto.',
    'Não use nomes de frameworks, siglas internas nem linguagem clínica de diagnóstico.',
  ].join('\n');
}

export class RoutineClassifierService {
  private readonly client: ClassifierClient;

  constructor(options?: { client?: ClassifierClient }) {
    this.client = options?.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async classify(input: {
    text: string;
    locale: string;
    existingTitles?: string[];
    negativeItems?: RoutineNegativeItem[];
  }): Promise<{ items: RoutineClassifiedItem[] }> {
    const model = getOpenAiModel();
    let content: string | null | undefined;

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(input.locale) },
          { role: 'user', content: input.text },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: getOpenAiMaxCompletionTokens(8_000),
        ...openAiTemperature(model, 0.1),
      } as any);
      content = completion.choices[0]?.message?.content;
    } catch (error) {
      throw new RoutineClassifierError('model_unavailable', 'A classificação não pôde ser concluída agora.', error);
    }

    if (!content?.trim()) {
      throw new RoutineClassifierError('empty_model_output', 'A classificação retornou vazia.');
    }

    let parsed: z.infer<typeof ModelResponseSchema>;
    try {
      parsed = ModelResponseSchema.parse(extractJsonValue(content));
    } catch (error) {
      throw new RoutineClassifierError('invalid_model_output', 'A classificação retornou dados incompletos.', error);
    }

    const existingTitles = input.existingTitles ?? [];
    const negativeItems = input.negativeItems ?? [];

    const items = parsed.items.map((raw, index) => {
      const id = `source-${index + 1}`;
      const negative = negativeItems.find((item) => sameAction(raw.title, item.title));
      const existing = existingTitles.find((title) => sameAction(raw.title, title));
      const duplicateOf = negative
        ? `${negative.state}:${negative.title}`
        : existing ? `existing:${existing}` : null;

      return RoutineClassifiedItemSchema.parse({
        ...raw,
        id,
        reviewState: duplicateOf ? 'excluded' : 'pending',
        duplicateOf,
      });
    });

    return { items };
  }
}

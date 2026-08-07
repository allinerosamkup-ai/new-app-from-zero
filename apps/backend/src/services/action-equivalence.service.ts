/**
 * Decide se uma ação nova já existe na lista da pessoa — de verdade.
 *
 * Por que existe: comparação lexical pega paráfrase ("ligar para a médica" ≈
 * "ligar pra médica") mas não pega sinônimo real. "Comprar pão" e "passar na
 * padaria" são a mesma tarefa e nenhum algoritmo de sobreposição de palavras vai
 * dizer isso. Como o app já tem LLM, usar comparação de string aqui era desperdiçar
 * a ferramenta certa.
 *
 * Desenho em duas camadas, e a ordem importa:
 *
 *  1. O cliente roda o filtro lexical primeiro. Se ele já casou, não chama aqui —
 *     resposta instantânea e sem custo no caso mais comum.
 *  2. Este serviço entra só no caso difícil: nada casou lexicalmente, mas pode
 *     haver equivalência de significado.
 *
 * Falha é sempre para o lado de PERMITIR. Se o modelo não responder, a ação é
 * criada: perder uma ação da pessoa é pior que ter duas parecidas na lista.
 */

import { getOpenAiModel } from '../lib/openai-config';

export type EquivalenceCandidate = { id: string; text: string };

export type EquivalenceResult = {
  /** id do item equivalente, ou null se a ação é nova. */
  duplicateOf: string | null;
  reason: string | null;
  /** true quando o modelo não pôde ser consultado — o chamador deve criar. */
  degraded: boolean;
};

const NOT_DUPLICATE: EquivalenceResult = { duplicateOf: null, reason: null, degraded: false };

/** Acima disso a lista fica cara e o modelo começa a errar por volume. */
const MAX_CANDIDATES = 40;

export async function findEquivalentActionWithLlm(input: {
  candidate: string;
  existing: EquivalenceCandidate[];
  openaiFactory?: () => Promise<{
    chat: { completions: { create: (args: unknown) => Promise<unknown> } };
  }>;
}): Promise<EquivalenceResult> {
  const candidate = input.candidate.trim();
  const existing = input.existing.filter((item) => item.text?.trim()).slice(0, MAX_CANDIDATES);

  // Sem candidato ou sem lista, não há o que comparar.
  if (!candidate || existing.length === 0) return NOT_DUPLICATE;

  try {
    const client = input.openaiFactory
      ? await input.openaiFactory()
      : await (async () => {
        const OpenAI = (await import('openai')).default;
        return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as never;
      })();

    const list = existing.map((item, index) => `${index + 1}. [${item.id}] ${item.text}`).join('\n');

    const response = await client.chat.completions.create({
      model: getOpenAiModel(),
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Você compara tarefas pessoais e diz se duas pedem A MESMA COISA na prática.',
            'São equivalentes quando fazer uma cumpre a outra: "comprar pão" e "passar na padaria"; "ligar para a médica" e "marcar consulta com a médica".',
            'NÃO são equivalentes quando o objeto muda ("ligar para a médica" x "ligar para o banco"), quando o escopo muda ("organizar a mesa" x "organizar a casa inteira") ou quando uma é etapa da outra sem cumpri-la.',
            'Na dúvida, responda que NÃO é duplicata: criar uma tarefa parecida incomoda, mas engolir uma tarefa real faz a pessoa perder o que precisava fazer.',
            'Responda só JSON: {"duplicateOf": "<id ou null>", "reason": "<até 12 palavras ou null>"}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `AÇÃO NOVA:\n${candidate}\n\nJÁ REGISTRADAS:\n${list}\n\nAlguma já pede a mesma coisa?`,
        },
      ],
    } as never) as { choices?: Array<{ message?: { content?: string } }> };

    const raw = response?.choices?.[0]?.message?.content;
    if (!raw) return { ...NOT_DUPLICATE, degraded: true };

    const parsed = JSON.parse(raw) as { duplicateOf?: unknown; reason?: unknown };
    const id = typeof parsed.duplicateOf === 'string' ? parsed.duplicateOf.trim() : null;

    // Só aceita id que existe de fato na lista enviada. Sem isso, uma alucinação
    // do modelo apagaria silenciosamente uma ação nova da pessoa.
    const matched = id && id !== 'null' ? existing.find((item) => item.id === id) : undefined;
    if (!matched) return NOT_DUPLICATE;

    return {
      duplicateOf: matched.id,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : null,
      degraded: false,
    };
  } catch {
    // Falha de rede, chave ausente, JSON quebrado: permite criar.
    return { ...NOT_DUPLICATE, degraded: true };
  }
}

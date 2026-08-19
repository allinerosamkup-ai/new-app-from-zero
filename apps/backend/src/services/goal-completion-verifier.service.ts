/**
 * O auditor de conclusão — o quarto especialista do sistema.
 *
 * Enquanto o gerador decompõe, o validador revisa e o formulador pergunta,
 * este especialista verifica se uma ação concluída merece o "concluída" — e
 * libera a próxima etapa. Desenhado em chamada dedicada, igual ao formulador
 * de perguntas: separar o julgamento de conclusão do resto é o que impede
 * o modelo de aprovar qualquer coisa para seguir em frente.
 *
 * Barra de aprovação (regra do produto, não negociável):
 *   nota >= 8/10  E  o verificador genuinamente impressionado (impressed === true)
 *   — só então a ação é aceita como concluída de verdade e o caminho segue.
 *
 * Abaixo disso, a conclusão NÃO é gravada: o app devolve um feedback honesto e
 * acolhedor do que ainda falta, escrito como gente. O progresso da pessoa não
 * some — a edição continua no topo da tela esperando o ajuste.
 *
 * Quando o auditor não responde (provedor fora), a conclusão é gravada mesmo
 * assim: o trabalho da pessoa nunca fica preso por causa do provedor. O
 * julgamento de qualidade é exigência quando a IA está disponível; a dignidade
 * do sistema é não trancar a usuária fora.
 */
import { z } from 'zod';
import type { OpenAI } from 'openai';

import { extractJsonValue } from '../lib/extract-json';
import { getModelForRole } from '../lib/openai-config';

export type CompletionVerdict =
  | { approved: true; score: number; praise: string; feedback: string | null }
  | { approved: false; score: number; praise: string | null; feedback: string; encouragement: string };

const CompletionVerdictSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(10),
  praise: z.string().nullable(),
  feedback: z.string().nullable(),
  encouragement: z.string().nullable(),
});

type ChatClient = Pick<OpenAI, 'chat'>;

function buildVerificationPrompt(input: {
  goalTitle: string;
  actionTitle: string;
  doneWhen: string | null;
  locale: string;
}): string {
  const english = input.locale.toLowerCase().startsWith('en');
  const language = english
    ? 'Answer in English, same JSON contract.'
    : 'Responda em português do Brasil, mesmo contrato JSON.';

  return `Você é a revisora de conclusão de objetivos da Airia. Uma pessoa marcou uma ação como feita e você precisa julgar, como quem conhece bem o que é concluir algo de verdade, se o "concluído" merece o nome.
${language}

OBJETIVO: "${input.goalTitle}"
AÇÃO CONCLUÍDA: "${input.actionTitle}"
EVIDÊNCIA ESPERADA (doneWhen): ${input.doneWhen || 'nenhuma declarada'}

JULGUE COM DOIS CRITÉRIOS, E OS DOIS VALEM:
1. A evidência esperada parece cumprida de fato — não só "a pessoa disse que fez". Leve a sério o que a ação promete e o tamanho dela.
2. Qualidade: a ação foi feita com esforço real, não pela metade? "Anotar no papel" cumpre, mas "anotar correndo, sem olhar nada" também. O que importa é se o que ficou pronto sustenta o próximo passo.

SUA RÉGUA DE NOTA (0 a 10):
- 10: completíssimo — tudo o que a ação prometia, com folga, e ainda deixou o próximo passo mais fácil.
- 8-9: cumpriu bem; pequeno detalhe a mais não mudaria o resultado.
- 6-7: fez a casca, mas sem a carne — dá para reconhecer, mas falta substância para seguir de cabeça erguida.
- 0-5: não cumpre ou cumpre muito pouco do que a evidência esperava.

VOCÊ SÓ APROVA SE SENTIR IMPRESSIONADA: nota >= 8 E "a pessoa pode se orgulhar disso e seguir com confiança". Repare como é escrever o elogio — se o melhor elogio que você consegue é forçado ou genérico, você não está impressionada, e a resposta é reprovada. Aprove com elogio espontâneo ou não aprove.

Quando aprovar, "praise" é o elogio espontâneo (curto, como gente, sem parecer modelo) e "feedback" fica null.
Quando reprovar, "feedback" diz com carinho e clareza o que ainda falta ou o que faria o trabalho ficar à altura — uma coisa só, a mais importante — e "encouragement" é uma frase que mantém a pessoa de pé sem fingir que já acabou.

JSON APENAS:
{"approved":true|false,"score":7.5,"praise":null,"feedback":"ainda faltou X","encouragement":"..."}`;
}

export class GoalCompletionVerifierService {
  constructor(
    private readonly prisma: { eventLog: { create(args: unknown): Promise<unknown> } },
  ) {}

  /** Exposto para teste: o prompt é contrato, não detalhe interno. */
  static buildPromptFor(input: Parameters<typeof buildVerificationPrompt>[0]): string {
    return buildVerificationPrompt(input);
  }

  /**
   * Julga a conclusão da ação (interface usada pelo endpoint). Registra o
   * julgamento em eventLog e nunca lança: sem modelo ou sem resposta, devolve
   * aprovação por deferência — o trabalho da pessoa nunca fica preso pelo
   * provedor, mas o julgamento acontece sempre que a IA responde.
   */
  async verifyCompletion(
    input: {
      userId: string;
      objectiveId: string;
      goalTitle: string;
      actionTitle: string;
      doneWhen: string | null;
      locale: string;
    },
    client?: ChatClient,
  ): Promise<CompletionVerdict & { verdictRecorded: boolean }> {
    const verdict = await GoalCompletionVerifierService.verify(
      {
        goalTitle: input.goalTitle,
        actionTitle: input.actionTitle,
        doneWhen: input.doneWhen,
        locale: input.locale,
      },
      client,
    );
    void this.prisma.eventLog.create({
      data: {
        userId: input.userId,
        eventName: verdict.approved ? 'objective_action_completion_approved' : 'objective_action_completion_rejected',
        properties: {
          objectiveId: input.objectiveId,
          actionTitle: input.actionTitle,
          score: verdict.score,
          praise: verdict.praise,
          feedback: verdict.feedback,
          source: 'completion_verifier',
        },
      },
    }).catch((error: unknown) => console.error('[completion-verifier] event log failed:', error));
    return { ...verdict, verdictRecorded: true };
  }

  /**
   * Julga a conclusão da ação. Nunca lança: sem modelo ou sem resposta,
   * devolve aprovação por deferência — o trabalho da pessoa nunca fica preso
   * pelo provedor, mas o julgamento acontece sempre que a IA responde.
   */
  static async verify(
    input: {
      goalTitle: string;
      actionTitle: string;
      doneWhen: string | null;
      locale: string;
    },
    client?: ChatClient,
  ): Promise<CompletionVerdict> {
    if (!client && !process.env.OPENAI_API_KEY) {
      return deferVerdict(input.actionTitle);
    }
    try {
      const model = getModelForRole('completion');
      const raw = await client!.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'Você revisa conclusões de ações de objetivos com critério alto e fala como gente. Responde só JSON.' },
          { role: 'user', content: buildVerificationPrompt(input) },
        ],
        response_format: { type: 'json_object' },
      } as any, { timeout: 20_000 });
      const content = raw.choices?.[0]?.message?.content;
      const parsed = CompletionVerdictSchema.safeParse(content ? extractJsonValue(content) : null);
      if (!parsed.success) {
        console.warn('[completion-verifier] resposta fora do contrato:', content?.slice(0, 200));
        return deferVerdict(input.actionTitle);
      }
      const verdict = parsed.data;
      const score = Math.min(10, Math.max(0, verdict.score));
      const impressed = verdict.approved && score >= 8;
      if (impressed) {
        return {
          approved: true,
          score,
          praise: verdict.praise || 'bom trabalho',
          feedback: null,
        };
      }
      return {
        approved: false,
        score,
        praise: null,
        feedback: verdict.feedback || 'o trabalho ainda não está à altura do que a ação promete',
        encouragement: verdict.encouragement || 'dá para chegar lá — ajusta essa parte e marca de novo',
      };
    } catch {
      return deferVerdict(input.actionTitle);
    }
  }
}

function deferVerdict(actionTitle: string): CompletionVerdict {
  console.warn(`[completion-verifier] auditor indisponível — ${actionTitle} concluída por deferência`);
  return { approved: true, score: 10, praise: 'concluída', feedback: null };
}

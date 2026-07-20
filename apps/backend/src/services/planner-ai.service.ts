import OpenAI from 'openai';

import { getOpenAiModel } from '../lib/openai-config';
import { buildAuraSystemPrompt } from '../lib/aura-prompt';
import {
  PlannerAISuggestionRequestSchema,
  PlannerAISuggestionResponseSchema,
  type PlannerAISuggestionRequest,
  type PlannerAISuggestionValidatedRequest,
  type PlannerAISuggestionResponse,
} from '../contracts/planner.contract';
import { isTimelineBlockProtected } from './planner.service';

// Lazy OpenAI — mesmo padrão de knowledge-graph.service.ts
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  }
  return _openai;
}

export type PlannerAISuggestionsContext = {
  userName?: string | null;
  /** Texto pronto vindo do LearningContextService.formatForPrompt (Frente 2). */
  learningContext?: string | null;
  /** Texto pronto vindo do KnowledgeGraphService.formatContextForPrompt. */
  knowledgeGraphContext?: string | null;
  /** moodCycleContext já formatado pra prompt (deriveAdaptiveContext etc). */
  moodCycleContext?: string | null;
  /** Perfil/rotina concisos. */
  profileSummary?: string | null;
  /** Diagnósticos auto-relatados (TDAH, bipolar II...). */
  priorDiagnoses?: string[] | null;
  /** Forecast 7d resumido (opcional). */
  forecast7dSummary?: string | null;
  /** Tarefas pesadas concluídas nos últimos 7d (momentum). */
  taskMomentum7d?: number | null;
};

const SYSTEM_EXTRA_INSTRUCTIONS = [
  'Você gera SUGESTÕES (não comandos). O frontend confirma bloco-a-bloco. NUNCA persiste nada.',
  'PARA "schedule" (novos blocos sugeridos):',
  '  - 1 a 4 itens. Cada um com horário plausível, categoria, intensity (L|M|P) e reasoning curto baseado no estado atual.',
  '  - Use OBJETOS QUE A PESSOA JÁ MENCIONOU (do KG/learning context). Verbos no infinitivo.',
  '  - Não crie mais que 1 bloco P em dia de baixa energia (suggestedIntensity=L ou M).',
  '  - Se já tem agenda cheia ou energia baixa, schedule=[].',
  'PARA "adjustedExisting":',
  '  - 1 ação por bloco existente. Use KEEP por default. Só MOVE_TOMORROW/DOWNGRADE_INTENSITY/CANCEL com motivo concreto.',
  '  - Bloco temporalPolicy=fixed ou adaptationPermission=protected é ÂNCORA: use somente KEEP. Nunca mova, reduza ou cancele.',
  '  - MOVE_TOMORROW: bloco P em dia de baixa energia. DOWNGRADE_INTENSITY: humor/energia caíram >=2 desde ontem.',
  '  - CANCEL é raro — só se tem evidência de que o bloco não faz mais sentido.',
  'CONFIDENCE realista: 0.5-0.7 para hipóteses razoáveis, 0.8-0.95 quando há evidência clara no contexto.',
  'REASONING (até 280 chars): cite UM elemento concreto do contexto (entidade, padrão, fato, fase).',
  'JSON ESTRITO. Nada fora do schema. Nada de markdown ou explicação extra.',
];

const RESPONSE_SCHEMA_HINT = `
Schema JSON obrigatório:
{
  "schedule": [{ "startTime":"HH:MM","endTime":"HH:MM","title":string,"category":"trabalho"|"pessoal"|"autocuidado"|"social"|"outro","intensity":"L"|"M"|"P","isRoutine":boolean,"reasoning":string,"confidence":number }],
  "adjustedExisting": [{ "id":string,"action":"MOVE_TOMORROW"|"DOWNGRADE_INTENSITY"|"CANCEL"|"KEEP","reason":string,"confidence":number }],
  "adjustments": [string],
  "warnings": [string]
}
`;

export class PlannerAIService {
  /**
   * Gera sugestões de planner para o dia. NÃO persiste nada — apenas retorna
   * propostas. O frontend (PlannerAISuggestionSheet) confirma bloco-a-bloco
   * e chama os endpoints corretos pra criar/atualizar/cancelar.
   */
  static async getSuggestions(
    input: PlannerAISuggestionRequest,
    context: PlannerAISuggestionsContext = {},
    client: Pick<OpenAI, 'chat'> = getOpenAI(),
  ): Promise<PlannerAISuggestionResponse> {
    // Valida o input mais uma vez por garantia (caller já validou via Zod)
    const validated = PlannerAISuggestionRequestSchema.parse(input);

    const systemPrompt = buildAuraSystemPrompt({
      userName: context.userName ?? undefined,
      profileSummary: context.profileSummary ?? null,
      moodCycleContext: context.moodCycleContext ?? null,
      knowledgeGraphContext: context.knowledgeGraphContext ?? null,
      priorDiagnoses: context.priorDiagnoses ?? null,
      forecast7dSummary: context.forecast7dSummary ?? null,
      taskMomentum7d: context.taskMomentum7d ?? null,
      currentHour: validated.currentHour,
      currentMinute: validated.currentMinute,
      phase: validated.phase ?? null,
      domain: 'planning',
      extraInstructions: [
        ...SYSTEM_EXTRA_INSTRUCTIONS,
        ...(context.learningContext
          ? [`CONTEXTO LONGITUDINAL DA USUÁRIA (use pra calibrar carga e timing):\n${context.learningContext}`]
          : []),
      ],
    });

    const userPrompt = this.buildUserPrompt(validated, context.learningContext);

    const completion = await client.chat.completions.create({
      model: getOpenAiModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    } as any);

    const raw = completion.choices?.[0]?.message?.content ?? '{}';
    let parsed: PlannerAISuggestionResponse;
    try {
      const json = JSON.parse(raw);
      parsed = PlannerAISuggestionResponseSchema.parse(json);
    } catch (err) {
      console.warn('[planner-ai] resposta inválida, devolvendo vazio:', err);
      return { schedule: [], adjustedExisting: [], adjustments: [], warnings: [] };
    }

    // Filtragem extra de segurança:
    //  - garante que adjustedExisting só refere a IDs que vieram no input
    //  - dedup schedule por horário inicial idêntico
    const blocksById = new Map(validated.existingBlocks.map((block) => [block.id, block]));
    parsed.adjustedExisting = parsed.adjustedExisting
      .filter((adjustment) => blocksById.has(adjustment.id))
      .map((adjustment) => {
        const block = blocksById.get(adjustment.id);
        if (block && isTimelineBlockProtected(block) && adjustment.action !== 'KEEP') {
          return {
            ...adjustment,
            action: 'KEEP' as const,
            reason: 'Bloco fixo ou protegido; a Airia mantém esta âncora intacta.',
          };
        }
        return adjustment;
      });
    const seenStarts = new Set<string>();
    parsed.schedule = parsed.schedule.filter((s) => {
      if (seenStarts.has(s.startTime)) return false;
      seenStarts.add(s.startTime);
      return true;
    });

    return parsed;
  }

  /** Constrói a mensagem do usuário com state + agenda atual + schema hint. */
  private static buildUserPrompt(
    input: PlannerAISuggestionValidatedRequest,
    learningContext?: string | null,
  ): string {
    const lines: string[] = [];
    lines.push(`Dia: ${input.date}`);
    lines.push('');
    lines.push('ESTADO DE ENERGIA HOJE:');
    lines.push(`- Estado: ${input.energyState.label}`);
    if (input.energyState.analysis) lines.push(`- Análise: ${input.energyState.analysis}`);
    lines.push(`- Intensidade sugerida: ${input.energyState.suggestedIntensity}`);
    if (input.energyState.avgMood !== null && input.energyState.avgMood !== undefined) {
      lines.push(`- Humor médio recente: ${input.energyState.avgMood}`);
    }
    if (input.energyState.avgEnergy !== null && input.energyState.avgEnergy !== undefined) {
      lines.push(`- Energia média recente: ${input.energyState.avgEnergy}`);
    }

    if (input.existingBlocks.length > 0) {
      lines.push('');
      lines.push('AGENDA ATUAL DO DIA (decidir KEEP/MOVE/DOWNGRADE/CANCEL para cada):');
      for (const b of input.existingBlocks) {
        lines.push(
          `- id=${b.id} | ${b.startTime}-${b.endTime} | ${b.title} | cat=${b.category} | int=${b.intensity} | status=${b.status} | temporalPolicy=${b.temporalPolicy} | adaptationPermission=${b.adaptationPermission}`,
        );
      }
    } else {
      lines.push('');
      lines.push('AGENDA ATUAL DO DIA: (vazia)');
    }

    if (learningContext) {
      lines.push('');
      lines.push('PADRÕES DE LONGO PRAZO (use pra calibrar carga, timing e categoria):');
      lines.push(learningContext);
    }

    lines.push('');
    lines.push(RESPONSE_SCHEMA_HINT);
    lines.push('Devolva APENAS o JSON. Sem comentários, sem markdown.');
    return lines.join('\n');
  }
}

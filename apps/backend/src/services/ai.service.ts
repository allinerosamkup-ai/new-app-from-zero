import OpenAI from 'openai';
import { z } from 'zod';
import { OnboardingAiOutputSchema, type OnboardingAiOutput } from '../contracts/onboarding-ai.contract';
import { getOpenAiMaxCompletionTokens, getOpenAiModel } from '../lib/openai-config';
import { buildAuraSystemPrompt } from '../lib/aura-prompt';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not set in environment variables');
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAI() as any)[prop];
  },
});

// Aprimorado conforme as novas especificações do sistema
export const JournalSummarySchema = z.object({
  summary: z.string().min(10), // 2-5 frases
  emotions: z.array(z.string().toLowerCase()).min(2).max(5), // 2-5 emoções, minúsculas
  themes: z.array(z.string().toLowerCase()).min(1).max(3), // 1-3 temas
  suggestions: z.array(z.string()).optional(), // 1-2 sugestões suaves
});

export type JournalSummary = z.infer<typeof JournalSummarySchema>;
export type JournalStreamHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type JournalPromptContext = {
  userName?: string;
  userProfileSummary?: string | null;
  longTermMemory?: string | null;
  recentSessionHistory?: string | null;
  journalContext?: string | null;
  routineSummary?: string;
  promptSummary: string;
  topThemes: string[];
  topPlannerCategories: string[];
  moodCycleContext?: string | null;
  recentSuggestionMemory?: string | null;
  activeGoalsContext?: string | null;
  ragContext?: string;
  plannerContext?: string | null;
  checkinToday?: {
    moodScore: number;
    energyScore: number;
    stateLabel?: string | null;
  } | null;
  /** Hora local do usuário (0-23). Frontend deve enviar pra calibrar sugestões. */
  currentHour?: number;
  /** Minuto local do usuário (0-59). Frontend deve enviar pra calibrar sugestões. */
  currentMinute?: number;
  /** Fase atual de humor (ativa engine adaptativa no prompt). */
  phase?: string | null;
  /** Warning flags (sustained_low, rapid_drop, etc) — pre-queda. */
  warningFlags?: string[] | null;
  /** Resumo da previsão 7d. */
  forecast7dSummary?: string | null;
  /** Tarefas pesadas concluídas nos últimos 7 dias. */
  taskMomentum7d?: number | null;
};

export type OnboardingProfileInput = {
  fullName: string;
  age: number | null;
  currentFeeling: string;
  sleepQualityNote: string;
  wakeTime: string;
  sleepTime: string;
  routineText: string;
  mainEnergyPressure: string;
  primaryGoal: string;
  supportGoals: string[];
};

export class AIService {
  private static readonly MODEL = getOpenAiModel();
  private static readonly CONTEXT_LIMIT = 50;


  private static buildOnboardingPrompt(input: OnboardingProfileInput): string {
    return `
      Leia as respostas iniciais do usuário e devolva um resumo estruturado e útil para iniciar a personalização do app.

      DADOS DO USUÁRIO:
      - Nome de uso: ${input.fullName}
      - Idade: ${input.age ?? 'não informado'}
      - Como está se sentindo agora: ${input.currentFeeling}
      - Como tem sido o sono: ${input.sleepQualityNote}
      - Horário de acordar: ${input.wakeTime}
      - Horário de dormir: ${input.sleepTime}
      - Rotina atual: ${input.routineText}
      - O que mais pesa na energia/dia: ${input.mainEnergyPressure}
      - O que quer melhorar primeiro: ${input.primaryGoal}
      - Objetivos marcados: ${input.supportGoals.join(', ') || 'nenhum'}

      REGRAS:
      - Responda em português do Brasil.
      - Não faça diagnósticos médicos, psiquiátricos ou clínicos.
      - Não use temas identitários, políticos ou ideológicos.
      - Não invente informações além do que foi fornecido.
      - Gere um retrato inicial acolhedor, prático e útil para o produto.
      - As sugestões devem ser suaves, claras e acionáveis.
      - Retorne apenas JSON válido.

      FORMATO:
      {
        "profileSummary": "string",
        "routineSummaryNormalized": "string",
        "initialStateSummary": "string",
        "topThemes": ["string"],
        "initialSuggestions": ["string"]
      }
    `.trim();
  }

  static async streamJournalReply(
    input: {
      context: JournalPromptContext;
      history: JournalStreamHistoryMessage[];
      message: string;
      closingMode?: boolean;
      onDelta?: (chunk: string) => void;
    },
    client: Pick<OpenAI, 'chat'> = openai,
  ): Promise<string> {
    const recentHistory = input.history.slice(-10);

    const stream = await client.chat.completions.create({
      model: this.MODEL,
      stream: true,
      messages: [
        {
          role: 'system',
          content: buildAuraSystemPrompt({
            userName: input.context.userName,
            profileSummary: input.context.userProfileSummary || input.context.promptSummary,
            moodCycleContext: input.context.moodCycleContext,
            longTermMemory: input.context.longTermMemory,
            contextualMemory: input.context.ragContext,
            journalContext: input.context.journalContext,
            recentSessionHistory: input.context.recentSessionHistory,
            recentSuggestionMemory: input.context.recentSuggestionMemory,
            activeGoalsContext: input.context.activeGoalsContext,
            plannerContext: input.context.plannerContext,
            currentHour: input.context.currentHour,
            currentMinute: input.context.currentMinute,
            phase: input.context.phase,
            warningFlags: input.context.warningFlags,
            forecast7dSummary: input.context.forecast7dSummary,
            taskMomentum7d: input.context.taskMomentum7d,
            domain: 'journal-live',
            extraInstructions: [
              'Seja uma presença lenta. Frases curtas. Respire entre uma ideia e outra.',
              'ENTRADA ATUAL MANDA: preserve datas e sequência. "ontem" é ontem. Não mova evento sem a pessoa ter dito.',
              'NÃO ECOE: se não há leitura nova a oferecer, faça 1 pergunta específica sobre o fato atual. Nunca ecoe com sinônimos.',
              'FREQUÊNCIA DE PERGUNTAS: máximo 1 pergunta a cada 3 respostas.',
              input.closingMode
                ? 'A pessoa está saindo. Apenas valide e deixe a porta aberta para amanhã. Sem tarefas.'
                : '',
            ].filter(Boolean),
          }),
        },
        ...recentHistory.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: 'user', content: input.message },
      ],
    } as any);

    let finalContent = '';

    for await (const chunk of stream as unknown as AsyncIterable<any>) {
      const delta = chunk.choices?.[0]?.delta?.content;

      if (!delta) {
        continue;
      }

      finalContent += delta;
      input.onDelta?.(delta);
    }

    if (!finalContent.trim()) {
      throw new Error('Falha ao gerar resposta do diário');
    }

    return finalContent;
  }

  static async generateOnboardingProfile(
    input: OnboardingProfileInput,
    client: Pick<OpenAI, 'chat'> = openai,
  ): Promise<OnboardingAiOutput> {
    const prompt = this.buildOnboardingPrompt(input);

    const response = await client.chat.completions.create({
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: buildAuraSystemPrompt({
            userName: input.fullName,
            domain: 'onboarding',
          }),
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: getOpenAiMaxCompletionTokens(1500),
    } as any);

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Falha ao gerar perfil inicial do onboarding');
    }

    return OnboardingAiOutputSchema.parse(JSON.parse(content));
  }

  static async summarizeJournalSession(
    messages: { role: string; content: string }[],
    client: Pick<OpenAI, 'chat'> = openai,
    context?: {
      userName?: string | null;
      profileSummary?: string | null;
      moodCycleContext?: string | null;
      longTermMemory?: string | null;
      activeGoalsContext?: string | null;
      recentSessionHistory?: string | null;
      currentHour?: number;
      currentMinute?: number;
    },
  ): Promise<JournalSummary> {
    const recentMessages = messages.slice(-this.CONTEXT_LIMIT);

    const chatContent = recentMessages
      .map((m) => `${m.role === 'user' ? 'Usuário' : 'IA'}: ${m.content}`)
      .join('\n');

    const prompt = `
      Analise a sessão de diário fornecida e extraia um resumo estruturado.

      CONVERSA:
      ${chatContent}

      DIRETRIZES:
      1. RESUMO: 2-5 frases sintetizando o conteúdo principal de forma acolhedora, contemplativa e humana.
      2. EMOÇÕES: Lista de 2-5 emoções predominantes (em português, minúsculas).
      3. TEMAS: Lista de 1-3 temas recorrentes (ex: trabalho, relacionamentos, saúde).
      4. SUGESTÕES: extraia até 3 caminhos/sugestões que foram conversados e validados pela pessoa. Validação inclui concordância explícita, escolha, pedido de aprofundamento, "faz sentido", "quero", "vamos", ou sinal claro de interesse. Se a pessoa rejeitou, hesitou contra ou recusou uma proposta, não inclua.

      IMPORTANTE:
      - A síntese deve cruzar, quando houver evidência: padrão que apareceu, decisão concreta em jogo e como o ciclo de humor calibrava a manobra possível.
      - Use memórias e histórico fornecidos pelo sistema para reconhecer recorrência, mas nunca invente lembrança ausente.
      - Preserve, quando existir, a estrutura real da sessão: evento real vs história criada, padrão recorrente, decisão em jogo, custo concreto e manobra conversada.
      - Baseie qualquer leitura de utilidade do problema, sinal de queda, movimento interrompido ou efeito indireto apenas em evidência concreta da conversa. Não invente profundidade.
      - Se a sessão mostrou um problema com função útil de curto prazo, registre isso em linguagem comum, sem rótulos internos.
      - Mantenha um tom acolhedor, contemplativo e não instrucional.
      - Não faça perguntas no fechamento.
      - Não escreva como relatório, checklist, avaliação clínica ou diagnóstico.
      - Não dê ordens. Se houver sugestão, ela deve soar como caminho combinado, concreto e leve.
      - Não invente sugestão final se a conversa não validou nenhuma. Nesse caso, retorne "suggestions": [].
      - Nunca cite nomes de teorias, metodologias ou rótulos internos.
      - Retorne APENAS um JSON puro no formato esperado.

      FORMATO JSON:
      {
        "summary": "string",
        "emotions": ["string"],
        "themes": ["string"],
        "suggestions": ["string"]
      }
    `;

    const response = await client.chat.completions.create({
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: buildAuraSystemPrompt({
            userName: context?.userName,
            profileSummary: context?.profileSummary,
            moodCycleContext: context?.moodCycleContext,
            longTermMemory: context?.longTermMemory,
            recentSessionHistory: context?.recentSessionHistory,
            activeGoalsContext: context?.activeGoalsContext,
            currentHour: context?.currentHour,
            currentMinute: context?.currentMinute,
            domain: 'summary',
          }),
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: getOpenAiMaxCompletionTokens(1500),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Falha ao gerar resumo da IA');

    const parsed = JSON.parse(content);
    return JournalSummarySchema.parse(parsed);
  }

  /**
   * Gera sugestões de hábitos baseadas no estado atual do usuário.
   */
  static async generateHabitSuggestions(input: {
    userName: string;
    profileSummary?: string | null;
    moodCycleContext?: string | null;
    recentSuggestionMemory?: string | null;
    currentMoodLabel?: string;
    timeOfDay: string;
    currentHour?: number;
    currentMinute?: number;
  }): Promise<Array<{ title: string; category: string; reason: string; icon: string }>> {
    const prompt = `
      Com base no estado atual de ${input.userName}, sugira 3 hábitos ou micro-ações para este momento do dia (${input.timeOfDay}).
      
      CONTEXTO:
      - Estado percebido: ${input.currentMoodLabel || 'não informado'}
      - Ciclo/Histórico: ${input.moodCycleContext || 'iniciando agora'}
      ${input.recentSuggestionMemory || ''}
      
      REGRAS:
      1. Use micro-passos (5-15 min).
      2. Foque em regulação emocional, ativação mínima, exposição gradual ou proteção de energia conforme a fase.
      3. Categorias: saúde, produtividade, mindfulness, social, lazer.
      4. Não repita nem parafraseie sugestões recentes; se retomar uma ideia for inevitável, marque como retomada e mude a execução concreta.
      5. Somática só entra se houver sinal corporal ou necessidade real de aterramento; não use como padrão.
      6. Retorne APENAS um array JSON.

      FORMATO:
      [{"title": "string", "category": "string", "reason": "1 frase curta", "icon": "emoji"}]
    `;

    const response = await openai.chat.completions.create({
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: buildAuraSystemPrompt({
            userName: input.userName,
            profileSummary: input.profileSummary,
            moodCycleContext: input.moodCycleContext,
            recentSuggestionMemory: input.recentSuggestionMemory,
            currentHour: input.currentHour,
            currentMinute: input.currentMinute,
            domain: 'planning',
          }),
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: getOpenAiMaxCompletionTokens(1500),
    } as any);

    const content = response.choices[0].message.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.habits || []);
  }
}

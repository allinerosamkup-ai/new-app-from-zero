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
  routineSummary?: string;
  promptSummary: string;
  topThemes: string[];
  topPlannerCategories: string[];
  moodCycleContext?: string | null;
  ragContext?: string;
  plannerContext?: string | null;
  checkinToday?: {
    moodScore: number;
    energyScore: number;
    stateLabel?: string | null;
  } | null;
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
            domain: 'journal-live',
            extraInstructions: [
              'Seja uma presença lenta. Use frases que respirem.',
              'No máximo uma pergunta por resposta. Se não for essencial perguntar, apenas acompanhe e reflita.',
              input.closingMode
                ? 'A pessoa está saindo. Apenas valide e deixe a porta aberta para amanhã. Sem tarefas.'
                : 'Não sugira NADA. Apenas reflita o que foi dito ou pergunte sobre como o corpo está reagindo a isso.',
              ...(input.context.ragContext
                ? [`MEMÓRIAS RELEVANTES DO HISTÓRICO DE ${input.context.userName ?? 'você'}:\n${input.context.ragContext}`]
                : []),
              ...(input.context.plannerContext
                ? [`AGENDA DE HOJE — use para contextualizar o que foi planejado e o peso do dia:\n${input.context.plannerContext}`]
                : []),
            ],
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
      4. SUGESTÕES: Opcional, no máximo 1 sugestão suave, apenas se ela surgir de modo orgânico no que foi dito.

      IMPORTANTE:
      - Mantenha um tom acolhedor, contemplativo e não instrucional.
      - Não faça perguntas no fechamento.
      - Não escreva como relatório, checklist, avaliação clínica ou diagnóstico.
      - Não dê ordens. Se houver sugestão, ela deve soar como permissão leve, não como tarefa.
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
    currentMoodLabel?: string;
    timeOfDay: string;
  }): Promise<Array<{ title: string; category: string; reason: string; icon: string }>> {
    const prompt = `
      Com base no estado atual de ${input.userName}, sugira 3 hábitos ou micro-ações para este momento do dia (${input.timeOfDay}).
      
      CONTEXTO:
      - Estado percebido: ${input.currentMoodLabel || 'não informado'}
      - Ciclo/Histórico: ${input.moodCycleContext || 'iniciando agora'}
      
      REGRAS:
      1. Use micro-passos (5-15 min).
      2. Foque em regulação emocional ou proteção de energia conforme a fase.
      3. Categorias: saúde, produtividade, mindfulness, social, lazer.
      4. Retorne APENAS um array JSON.

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

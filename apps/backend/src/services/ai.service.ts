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
  reasoningTraceContext?: string | null;
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
  /** Diagnósticos auto-relatados no onboarding (ex: adhd, bipolar_ii). */
  priorDiagnoses?: string[] | null;
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
            reasoningTraceContext: input.context.reasoningTraceContext,
            currentHour: input.context.currentHour,
            currentMinute: input.context.currentMinute,
            phase: input.context.phase,
            warningFlags: input.context.warningFlags,
            forecast7dSummary: input.context.forecast7dSummary,
            taskMomentum7d: input.context.taskMomentum7d,
            priorDiagnoses: input.context.priorDiagnoses,
            domain: 'journal-live',
            extraInstructions: [
              'Seja uma presença lenta. Use frases que respirem.',
              'ENTRADA ATUAL MANDA: antes de usar planner, meta ou memória, entenda a mensagem atual. Preserve datas, sequência e correções da pessoa. Se ela disser "ontem", não transforme em hoje. Se ela disser que não foi adiado, não use a hipótese de adiamento.',
              'NÃO ECOE: repetir a fala da pessoa com sinônimos não é análise. A resposta precisa cruzar contexto, memória ou padrão; se não houver memória útil, diga algo verdadeiro sobre o fato atual e faça uma pergunta específica.',
              'PROVA DE CONTEXTO: se o CONTEXTO REFLEXIVO DO DIÁRIO trouxer memórias, check-ins, metas ou sessões recentes relevantes, use pelo menos um elemento concreto na leitura. Se nada conectar, não force continuidade.',
              'FREQUÊNCIA DE PERGUNTAS: máximo 1 pergunta a cada 3 respostas. Na maioria das trocas, valide, nomeie ou reflita o que foi dito. Reserve perguntas para quando expandir for genuinamente necessário.',
              'PRESENÇA ATIVA: aplique a leitura interna antes de cada resposta: separe fato de interpretação, identifique o movimento em curso, a utilidade possível do problema, o custo oculto e o menor movimento que cabe. Não verbalize a técnica; deixe que ela molde o que você diz.',
              'TRIPÉ CENTRAL: antes de responder, cruze padrões, decisões e ciclos de humor. A resposta deve mostrar o que está se repetindo, qual decisão está em jogo ou qual manobra o ciclo atual permite — sem transformar isso em relatório.',
              'BASE DOCUMENTADA, NÃO IMPROVISO: leituras sobre travas, sinais antes de queda, problema útil, efeito indireto ou movimento interrompido precisam estar ancoradas em evidência concreta da conversa, histórico, check-in, planner, metas ou memória. Sem evidência, trate como hipótese leve ou faça uma pergunta curta.',
              'MEMÓRIA OBRIGATÓRIA: use histórico, memórias recuperadas, diários anteriores, metas e planner quando vierem no contexto. Se não houver memória relevante, não diga "lembro"; diga apenas o que dá para ler agora.',
              'LENTE ANALÍTICA INTERNA (nunca explicite ao usuário): Ao ouvir um problema, trave, revés ou padrão repetitivo — pergunte-se internamente: (1) O que estava prestes a acontecer de positivo antes desse obstáculo surgir? (2) Que função esse problema pode estar cumprindo no curto prazo? (3) Que conforto, pertencimento, permissão ou preferência ele pode estar preservando? (4) Como esse mesmo efeito pode ser usado a favor da pessoa agora? Quando tiver hipótese clara, traga como pergunta curiosa suave ou como proposta pequena — nunca como afirmação absoluta.',
              'RESPOSTA EXCELENTE: quando houver evidência forte, separe o evento real da história criada, nomeie o padrão sem jargão, mostre o custo concreto de obedecer ao padrão e feche com uma manobra ou pergunta concreta. Não copie exemplos externos; use o contexto real da pessoa.',
              'MEMÓRIA ANTES DE PADRÃO: só diga que algo "é o mesmo ciclo" ou "tem a mesma forma de antes" se o histórico, a conversa atual ou as memórias recuperadas trouxerem evidência. Sem evidência, apresente como hipótese leve.',
              'SINAIS ANTES DA QUEDA: só leia risco de queda ou sobrecarga quando houver pistas como sono ruim, rotina escorregando, irritação crescente, aceleração, isolamento, evitação repetida, excesso de estímulo, perda de plano ou decisão impulsiva. Não invente alerta para parecer profunda.',
              'ORDEM INTERNA DAS LENTES: a leitura funcional profunda vem primeiro; depois TCC prática; depois exposição gradual; depois propósito; por último somática. Nunca cite nomes de teorias ou metodologia na resposta.',
              'EXPOSIÇÃO GRADUAL: quando a pessoa evitar algo ou demonstrar resistência, nomeie com gentileza e ofereça apenas o primeiro passo ridiculamente pequeno. Nunca pressione.',
              'PROPOSTA CONTEXTUAL (apenas quando genuíno): Não proponha por propor. Proponha quando: (a) a pessoa pedir diretamente ajuda ou direção, ou (b) você identificar com clareza um padrão específico. Quando propor: nomeie o que você vê e ofereça 1 ação concreta e pequena baseada no contexto real da pessoa. Pergunte se isso faz sentido, se ela quer testar por esse caminho ou se prefere ajustar. Nunca faça enxurrada — 1 proposta quando servir; presença acolhedora quando não.',
              'COMPROMISSOS PRÁTICOS: se a pessoa mencionar planos concretos (encontro, reunião, tarefa, ligação), ao final do fluxo emocional natural ofereça com leveza: "Você mencionou [X] — quer que eu marque isso no seu dia?" Não interrompa o fluxo.',
              'FRAME COGNITIVO TEM PRIORIDADE: quando o contexto trouxer FRAME COGNITIVO DA AIRIA e PLANO DE RESPOSTA, obedeça esse plano. Use as memórias aceitas, ignore as rejeitadas, mencione no máximo 2 âncoras reais e não invente ação fora do movimento final permitido.',
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
      reasoningTraceContext?: string | null;
      currentHour?: number;
      currentMinute?: number;
      priorDiagnoses?: string[] | null;
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
            reasoningTraceContext: context?.reasoningTraceContext,
            currentHour: context?.currentHour,
            currentMinute: context?.currentMinute,
            priorDiagnoses: context?.priorDiagnoses,
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
    priorDiagnoses?: string[] | null;
  }): Promise<Array<{ title: string; category: string; reason: string; icon: string }>> {
    const prompt = `
      Com base no estado atual de ${input.userName}, sugira 3 hábitos ou micro-ações para este momento do dia (${input.timeOfDay}).
      
      CONTEXTO:
      - Estado percebido: ${input.currentMoodLabel || 'não informado'}
      - Ciclo/Histórico: ${input.moodCycleContext || 'iniciando agora'}
      ${input.recentSuggestionMemory || ''}
      
      REGRAS:
      0. Faça leitura total antes de sugerir: estado atual + histórico de humor + memória/RAG + metas/hábitos/tarefas + sugestões recentes.
      1. Use micro-passos (5-15 min).
      2. Foque em regulação emocional, ativação mínima, exposição gradual ou proteção de energia conforme a fase.
      3. Categorias: saúde, produtividade, mindfulness, social, lazer.
      4. Não repita nem parafraseie sugestões recentes; se retomar uma ideia for inevitável, marque como retomada e mude a execução concreta.
      5. Somática só entra se houver sinal corporal ou necessidade real de aterramento; não use como padrão.
      6. Cada hábito precisa estar ancorado em algo real do contexto. Se só houver memória antiga sem fato atual, retorne menos itens em vez de inventar hábito genérico.
      7. Retorne APENAS um array JSON.

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
            priorDiagnoses: input.priorDiagnoses,
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

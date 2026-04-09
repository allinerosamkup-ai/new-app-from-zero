import OpenAI from 'openai';
import { prisma } from '../lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
});

export interface UserActionContext {
  userId: string;
  actionType: 'CHECKIN' | 'JOURNAL' | 'TASK_CREATE' | 'GOAL_UPDATE' | 'HABIT_COMPLETE';
  rawData: any;
  currentStats?: any;
}

export interface AIEnrichedData {
  moodScore?: number;
  energyScore?: number;
  stabilityScore?: number;
  insight?: string;
  suggestedActions?: string[];
  phase?: string;
  normalizedData?: any;
}

/**
 * Função principal que conecta qualquer ação do usuário à IA
 * 1. Recebe dado bruto
 * 2. Busca contexto histórico
 * 3. Chama IA para análise/enriquecimento
 * 4. Salva dado bruto + metadados da IA
 * 5. Retorna dados prontos para o frontend
 */
export async function processUserActionWithAI(context: UserActionContext): Promise<AIEnrichedData> {
  try {
    // 1. Buscar contexto atual do usuário (histórico recente, metas, etc)
    const recentCheckins = await prisma.checkIn.findMany({
      where: { userId: context.userId },
      orderBy: { timestamp: 'desc' },
      take: 7,
    });

    const activeGoals = await prisma.goal.findMany({
      where: { userId: context.userId, status: 'ACTIVE' },
      include: { subtasks: true },
    });

    const contextPrompt = `
      Usuário realizou ação: ${context.actionType}.
      Dados da ação: ${JSON.stringify(context.rawData)}.
      
      Histórico Recente (Humor/Energia): ${JSON.stringify(recentCheckins.map(c => ({ mood: c.mood, energy: c.energy, date: c.timestamp })))}.
      Metas Ativas: ${activeGoals.length} metas.
      
      Tarefa: Analise esta ação, calcule scores atuais (0-100), identifique padrões de estabilidade, 
      determine a fase do ciclo (se aplicável) e gere um insight curto e acionável.
      Retorne APENAS um JSON válido sem markdown.
      Formato esperado: { "moodScore": number, "energyScore": number, "stabilityScore": number, "insight": string, "phase": string, "suggestedActions": string[] }
    `;

    // 2. Chamar IA (Simulação se API key não existir, real se existir)
    let aiResponse;
    
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
      // Fallback inteligente para desenvolvimento sem chave
      aiResponse = generateMockAIResponse(context);
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um assistente de saúde mental e produtividade. Responda apenas com JSON puro." },
          { role: "user", content: contextPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      
      const content = completion.choices[0].message.content;
      aiResponse = content ? JSON.parse(content) : {};
    }

    // 3. Persistir o dado bruto + metadados da IA (se necessário salvar o insight no DB)
    // Exemplo: Salvar o insight gerado junto com o check-in ou em tabela de logs de IA
    if (context.actionType === 'CHECKIN') {
      await prisma.checkIn.update({
        where: { id: context.rawData.id }, // Assume que já foi criado ou passa ID
        data: {
          aiInsight: aiResponse.insight,
          stabilityScore: aiResponse.stabilityScore,
        }
      });
    }

    // 4. Retornar dados enriquecidos para o frontend usar imediatamente
    return {
      moodScore: aiResponse.moodScore || context.rawData.mood || 50,
      energyScore: aiResponse.energyScore || context.rawData.energy || 50,
      stabilityScore: aiResponse.stabilityScore || 50,
      insight: aiResponse.insight || "Dados registrados com sucesso.",
      phase: aiResponse.phase || "Neutro",
      suggestedActions: aiResponse.suggestedActions || [],
      normalizedData: aiResponse.normalizedData || context.rawData
    };

  } catch (error) {
    console.error("Erro no processo de IA:", error);
    // Fallback crítico: Retorna dados básicos para não quebrar a UX
    return {
      moodScore: context.rawData.mood || 50,
      energyScore: context.rawData.energy || 50,
      stabilityScore: 50,
      insight: "Registro realizado.",
      phase: "Normal",
      suggestedActions: []
    };
  }
}

// Mock robusto para desenvolvimento quando não há API Key
function generateMockAIResponse(context: UserActionContext): any {
  const baseMood = context.rawData.mood || 50;
  const baseEnergy = context.rawData.energy || 50;
  
  // Simula variação baseada no histórico (fictício)
  const stability = Math.floor(Math.random() * 20) + 60; // 60-80
  
  const phases = ["Foco", "Descanso", "Transição", "Alta Energia", "Reflexão"];
  const randomPhase = phases[Math.floor(Math.random() * phases.length)];

  const insights = [
    "Seu padrão de energia está subindo consistentemente.",
    "Notei que dias com maior sono correlacionam com melhor humor.",
    "Sua consistência nos hábitos melhorou 15% esta semana.",
    "Momento ideal para tarefas complexas baseado na sua energia atual.",
    "Considere pausas estratégicas para manter a estabilidade."
  ];

  return {
    moodScore: baseMood,
    energyScore: baseEnergy,
    stabilityScore: stability,
    insight: insights[Math.floor(Math.random() * insights.length)],
    phase: randomPhase,
    suggestedActions: ["Beber água", "Revisar metas do dia", "Respiração consciente"]
  };
}

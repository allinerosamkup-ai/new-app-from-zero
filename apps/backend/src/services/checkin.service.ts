import OpenAI from 'openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) { return (getOpenAI() as any)[prop]; },
});

// Aprimorado conforme as novas especificações
export const CheckinStateSchema = z.object({
  stateLabel: z.string(), // Ex: "Dia sensível"
  stateLabelType: z.enum(['leve', 'moderado', 'sensível', 'crítico']),
  analysis: z.string(), // 1-2 frases do estado energético
  recommendations: z.array(z.string()), // Sugestões específicas
  suggestedIntensity: z.enum(['L', 'M', 'P']), // L=Leve, M=Médio, P=Pesado
  rationale: z.string(), // Explicação técnica interna da IA
});

export type CheckinState = z.infer<typeof CheckinStateSchema>;

export class CheckinService {
  private static readonly MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  static async evaluateDayState(data: {
    checkinSlot?: 'morning' | 'midday' | 'evening';
    moodScore: number;
    energyScore: number;
    clarityScore: number;
    irritabilityScore: number;
    physicalScore?: number;
    socialScore?: number;
    note?: string;
  }): Promise<CheckinState> {
    const prompt = `
      Você é um assistente especializado em bem-estar e regulação de energia.
      Analise os dados de check-in do usuário e retorne um estado humanizado.

      DADOS DO USUÁRIO:
      - Momento do check-in: ${data.checkinSlot || 'não informado'}
      - Humor: ${data.moodScore}/5
      - Energia Psíquica: ${data.energyScore}/5
      - Clareza Mental: ${data.clarityScore}/5
      - Irritabilidade: ${data.irritabilityScore}/5
      - Estado Físico: ${data.physicalScore ?? 'não informado'}/5
      - Estado Social: ${data.socialScore ?? 'não informado'}/5
      - Nota do Usuário: ${data.note || 'Nenhuma'}

      DIRETRIZES:
      - Nunca faça diagnósticos médicos.
      - Use linguagem acolhedora, não clínica.
      - Baseie-se apenas nos dados fornecidos.
      - Responda em português do Brasil.
      - SuggestedIntensity deve ser: 'L' (Leve), 'M' (Médio) ou 'P' (Pesado).

      Retorne APENAS um JSON puro no formato:
      {
        "stateLabel": "string",
        "stateLabelType": "leve|moderado|sensível|crítico",
        "analysis": "string",
        "recommendations": ["string"],
        "suggestedIntensity": "L|M|P",
        "rationale": "string"
      }
    `;

    const response = await openai.chat.completions.create({
      model: this.MODEL,
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Falha ao gerar estado da IA');

    return CheckinStateSchema.parse(JSON.parse(content));
  }
}

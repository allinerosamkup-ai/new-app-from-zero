import OpenAI from 'openai';
import { z } from 'zod';
import '../lib/load-env';

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
    sleepScore?: number;
    note?: string;
  }): Promise<CheckinState> {
    const prompt = `
Analise os dados de check-in e retorne um estado humanizado.

DADOS:
- Momento: ${data.checkinSlot || 'não informado'}
- Humor: ${data.moodScore}/5 | Energia: ${data.energyScore}/5 | Clareza: ${data.clarityScore}/5
- Irritabilidade: ${data.irritabilityScore}/5 | Físico: ${data.physicalScore ?? 'não informado'}/5
- Social: ${data.socialScore ?? 'não informado'}/5 | Sono: ${data.sleepScore ?? 'não informado'}/5
- Nota: ${data.note || 'Nenhuma'}

DIRETRIZES:
- Nunca diagnósticos médicos. Linguagem acolhedora, não clínica. Português do Brasil.
- stateLabel: nome humanizado do estado (ex: "Dia Sensível", "Energia Alta", "Momento de Descanso")
- analysis: 1-2 frases sobre o estado energético atual (tom Aura: gentil, observador, sem julgamento)
- recommendations: 2-3 micro-ações gentis baseadas nos dados (terapia de exposição + hábitos gentis: passos pequenos)
- suggestedIntensity: 'L' (energia baixa/sensível), 'M' (equilibrada), 'P' (energia alta/focada)

JSON APENAS:
{"stateLabel":"...","stateLabelType":"leve|moderado|sensível|crítico","analysis":"...","recommendations":["..."],"suggestedIntensity":"L|M|P","rationale":"..."}
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

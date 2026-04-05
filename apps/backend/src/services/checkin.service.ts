import OpenAI from 'openai';
import { z } from 'zod';
import { buildAuraSystemPrompt } from '../lib/aura-prompt';
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
    userName?: string;
    profileSummary?: string | null;
    moodCycleContext?: string | null;
  }, client: Pick<OpenAI, 'chat'> = openai): Promise<CheckinState> {
    const prompt = `
Analise os dados de check-in e retorne uma leitura humanizada, específica e útil.

DADOS:
- Momento: ${data.checkinSlot || 'não informado'}
- Humor: ${data.moodScore}/5 | Energia: ${data.energyScore}/5 | Clareza: ${data.clarityScore}/5
- Irritabilidade: ${data.irritabilityScore}/5 | Físico: ${data.physicalScore ?? 'não informado'}/5
- Social: ${data.socialScore ?? 'não informado'}/5 | Sono: ${data.sleepScore ?? 'não informado'}/5
- Nota: ${data.note || 'Nenhuma'}

DIRETRIZES:
- Nunca diagnósticos médicos. Linguagem acolhedora, não clínica. Português do Brasil.
- stateLabel: nome curto, humano e sóbrio do estado; evite rótulos dramáticos.
- analysis: 1-2 frases que leiam o momento sem repetir os números de forma óbvia.
- recommendations: 2-3 micro-ações realmente executáveis nas próximas horas, diferentes entre si e sem clichês.
- suggestedIntensity: 'L' (energia baixa/sensível), 'M' (equilibrada), 'P' (energia alta/focada).
- rationale: explicação interna curta e técnica, sem linguagem clínica pesada.
- Evite frases genéricas como "vá com calma", "um passo de cada vez" ou "você consegue" sem contexto.
- Se sono, corpo e energia estiverem baixos juntos, puxe para proteção e redução de carga.
- Se clareza estiver alta com energia boa, puxe para foco e estrutura.

JSON APENAS:
{"stateLabel":"...","stateLabelType":"leve|moderado|sensível|crítico","analysis":"...","recommendations":["..."],"suggestedIntensity":"L|M|P","rationale":"..."}
    `;

    const response = await client.chat.completions.create({
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: buildAuraSystemPrompt({
            userName: data.userName,
            profileSummary: data.profileSummary,
            moodCycleContext: data.moodCycleContext,
            domain: 'checkin',
          }),
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Falha ao gerar estado da IA');

    return CheckinStateSchema.parse(JSON.parse(content));
  }
}

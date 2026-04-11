import OpenAI from 'openai';
import { z } from 'zod';
import { buildAuraSystemPrompt, humanizeScore } from '../lib/aura-prompt';
import { getOpenAiMaxCompletionTokens, getOpenAiModel } from '../lib/openai-config';

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
  private static readonly MODEL = getOpenAiModel();

  static async evaluateDayState(data: {
    checkinSlot?: string;
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
    emotions?: string[];
    factors?: string[];
  }, client: Pick<OpenAI, 'chat'> = openai): Promise<CheckinState> {
    const checkinMoment = data.checkinSlot?.split('-')[0] || 'não informado';

    const FACTOR_LABELS: Record<string, string> = {
      good_sleep: 'Sono bom', exercise: 'Exercício', healthy_meal: 'Alimentação saudável',
      fresh_air: 'Ar fresco', good_talk: 'Boa conversa', kind_words: 'Palavras gentis',
      support: 'Apoio recebido', small_win: 'Pequena vitória', finished_task: 'Tarefa concluída',
      feeling_valued: 'Me senti valorizada', music: 'Música', time_outside: 'Tempo ao ar livre',
      hobby: 'Hobby', self_trust: 'Confiança em mim', rest: 'Descanso',
      stuck: 'Travada/o', relationship_conflict: 'Briga no relacionamento',
      overwhelmed: 'Sobrecarga mental', loneliness: 'Solidão', bad_sleep: 'Sono ruim',
      work_pressure: 'Pressão no trabalho', financial_stress: 'Estresse financeiro', bad_news: 'Má notícia',
    };
    const NEGATIVE_IDS = new Set(['stuck','relationship_conflict','overwhelmed','loneliness','bad_sleep','work_pressure','financial_stress','bad_news']);
    const EMOTION_LABELS: Record<string, string> = {
      radiant: 'Radiante', calm: 'Calma', happy: 'Feliz', anxious: 'Ansiosa',
      tired: 'Cansada', focused: 'Focada', sad: 'Triste', angry: 'Irritada',
      stressed: 'Estressada', sensitive: 'Sensível', exhausted: 'Exausta', agitated: 'Agitada',
    };

    const allFactors = data.factors ?? [];
    const negFactors = allFactors.filter(id => NEGATIVE_IDS.has(id));
    const posFactors = allFactors.filter(id => !NEGATIVE_IDS.has(id));
    const emotions = data.emotions ?? [];

    const emotionLine = emotions.length > 0
      ? `- Emoções relatadas: ${emotions.map(id => EMOTION_LABELS[id] ?? id).join(', ')}`
      : '';
    const negLine = negFactors.length > 0
      ? `- Fatores que pesaram: ${negFactors.map(id => FACTOR_LABELS[id] ?? id).join(', ')}`
      : '';
    const posLine = posFactors.length > 0
      ? `- Fatores que ajudaram: ${posFactors.map(id => FACTOR_LABELS[id] ?? id).join(', ')}`
      : '';
    const contextLines = [emotionLine, negLine, posLine].filter(Boolean).join('\n');

    const prompt = `
Analise os dados de check-in e retorne uma leitura humanizada, específica e útil.

DADOS:
- Momento: ${checkinMoment}
- Humor ${humanizeScore(data.moodScore, 'mood')}, energia ${humanizeScore(data.energyScore, 'energy')} e clareza ${humanizeScore(data.clarityScore, 'generic')}
- Irritabilidade ${humanizeScore(data.irritabilityScore, 'generic')}, estado físico ${humanizeScore(data.physicalScore, 'generic')}
- Social ${humanizeScore(data.socialScore, 'generic')} e sono ${humanizeScore(data.sleepScore, 'sleep')}
- Nota: ${data.note || 'Nenhuma'}${contextLines ? `\n${contextLines}` : ''}

DIRETRIZES:
- Nunca diagnósticos médicos. Linguagem acolhedora, não clínica. Português do Brasil.
- stateLabel: nome curto, humano e sóbrio do estado; evite rótulos dramáticos.
- analysis: 1-2 frases que leiam o momento sem repetir os números; se há emoções ou fatores negativos específicos, mencione-os concretamente.
- recommendations: 2-3 micro-ações realmente executáveis nas próximas horas, diferentes entre si, sem clichês; se há fatores negativos, pelo menos 1 ação deve endereçar diretamente um deles.
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
      max_completion_tokens: getOpenAiMaxCompletionTokens(1200),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Falha ao gerar estado da IA');

    return CheckinStateSchema.parse(JSON.parse(content));
  }
}

import React from 'react';
import { useNavigation } from '../navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useCheckinStore } from '../stores/checkin_store';
import { useAuthStore } from '../stores/auth_store';

type StateLabelType = 'radiant' | 'stable' | 'sensitive' | 'overloaded';

const STATE_CONFIG: Record<StateLabelType, {
  label: string;
  emoji: string;
  color: string;
  textColor: string;
  bgGradient: string;
  focus: string;
}> = {
  radiant: {
    label: 'Energia Radiante',
    emoji: '✨',
    color: '#F9B95C',
    textColor: '#9A6010',
    bgGradient: 'linear-gradient(180deg, rgba(249,185,92,0.22) 0%, rgba(249,185,92,0.06) 55%, var(--bg-base) 100%)',
    focus: 'Foco profundo',
  },
  stable: {
    label: 'Dia Estável',
    emoji: '🌱',
    color: '#96C7B3',
    textColor: '#3A7A66',
    bgGradient: 'linear-gradient(180deg, rgba(150,199,179,0.22) 0%, rgba(150,199,179,0.06) 55%, var(--bg-base) 100%)',
    focus: 'Foco balanceado',
  },
  sensitive: {
    label: 'Dia Sensível',
    emoji: '🌙',
    color: '#D7897F',
    textColor: '#A04840',
    bgGradient: 'linear-gradient(180deg, rgba(215,137,127,0.22) 0%, rgba(215,137,127,0.06) 55%, var(--bg-base) 100%)',
    focus: 'Foco leve',
  },
  overloaded: {
    label: 'Modo Recuperação',
    emoji: '🌊',
    color: '#E07070',
    textColor: '#A03030',
    bgGradient: 'linear-gradient(180deg, rgba(224,112,112,0.22) 0%, rgba(224,112,112,0.06) 55%, var(--bg-base) 100%)',
    focus: 'Descanso',
  },
};

// Fallback recommendations por tipo, usados se a IA não retornar
const FALLBACK_RECS: Record<StateLabelType, string[]> = {
  radiant: [
    'Aproveite o pico de energia para tarefas que exigem concentração.',
    'Inclua uma pausa de 15 min no meio da tarde para manter o ritmo.',
    'Considere uma caminhada leve no fim do dia para fechar bem.',
  ],
  stable: [
    'Comece com tarefas leves e aumente o ritmo aos poucos.',
    'Hidrate-se bem e faça pequenas pausas regulares.',
    'Uma música ambiente pode ajudar a manter o foco suave.',
  ],
  sensitive: [
    'Priorize autocuidado e evite decisões importantes se possível.',
    'Permita-se momentos de descanso sem culpa.',
    'Converse com alguém de confiança se sentir necessidade.',
  ],
  overloaded: [
    'Cancele o que puder e foque apenas no essencial.',
    'Durma mais cedo hoje se possível.',
    'Atividades de baixo esforço como respiração guiada podem ajudar.',
  ],
};

export default function CheckinResultScreen() {
  const { navigate, params } = useNavigation();
  const { userId } = useAuthStore();
  const { load } = useCheckinStore();

  // Checkin completo vindo do POST /api/checkins
  const checkin = params.checkin as any;

  // Resolve stateLabelType — backend usa radiant/stable/sensitive/overloaded
  const rawType: string = checkin?.stateLabelType ?? checkin?.aiState?.stateLabelType ?? 'stable';
  const stateType: StateLabelType = (['radiant', 'stable', 'sensitive', 'overloaded'].includes(rawType)
    ? rawType
    : 'stable') as StateLabelType;

  const config = STATE_CONFIG[stateType];

  // Dados reais da IA
  const aiState = checkin?.aiState as any;
  const summary: string = checkin?.stateSummary ?? aiState?.analysis ?? '';
  const recommendations: string[] = aiState?.recommendations ?? FALLBACK_RECS[stateType];
  const focusSuggestion: string = aiState?.focusSuggestion ?? config.focus;
  const stateLabel: string = checkin?.stateLabel ?? config.label;

  const handleDone = () => {
    // Recarrega os check-ins do store para que HomeScreen reflita o novo dado
    if (userId) load(userId);
    window.dispatchEvent(new CustomEvent('checkin-done'));
    navigate('home');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: config.bgGradient }}>
      <div className="flex-1 px-5 pt-6 pb-5">
        <div className="flex justify-center mt-4 mb-6 animate-fade-in">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${config.color}40, ${config.color}80)`,
              boxShadow: `0 12px 40px ${config.color}50`,
            }}
          >
            <span className="text-[52px]">{config.emoji}</span>
          </div>
        </div>

        <h1
          className="text-[26px] font-bold text-center mb-2 animate-fade-in delay-100"
          style={{ color: config.textColor, fontFamily: 'var(--font-heading)' }}
        >
          {stateLabel || config.label}
        </h1>

        <div className="flex justify-center mb-5 animate-fade-in delay-100">
          <span
            className="px-4 py-1.5 rounded-full text-[12px] font-semibold"
            style={{ background: `${config.color}35`, color: config.textColor }}
          >
            {focusSuggestion}
          </span>
        </div>

        {summary ? (
          <div className="glass-card interactive-card rounded-[22px] p-5 mb-5 animate-fade-in delay-200">
            <p className="text-[15px] text-center leading-[24px]" style={{ color: config.textColor, opacity: 0.85 }}>
              {summary}
            </p>
          </div>
        ) : null}

        {recommendations.length > 0 && (
          <div className="mb-6 animate-fade-in delay-300">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} strokeWidth={1.5} style={{ color: config.textColor, opacity: 0.6 }} />
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: config.textColor, opacity: 0.6 }}>
                Sugestões para hoje
              </p>
            </div>
            {recommendations.map((rec: string, i: number) => (
              <div key={i} className="glass-card interactive-card rounded-[16px] p-3.5 mb-2 flex items-start">
                <span className="text-sm mr-2.5 mt-0.5">💡</span>
                <p className="text-[13px] flex-1 leading-[20px]" style={{ color: config.textColor }}>
                  {rec}
                </p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleDone}
          className="w-full py-[16px] rounded-[20px] text-center font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] animate-fade-in delay-400"
          style={{
            background: config.color,
            color: config.textColor,
            boxShadow: `0 6px 20px ${config.color}40`,
          }}
        >
          Ver meu dia <ArrowRight size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

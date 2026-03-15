import React from 'react';
import { useNavigation } from '../navigation';
import { ArrowRight, Sparkles } from 'lucide-react';

type StateType = 'leve' | 'moderado' | 'sensível' | 'crítico';

const STATE_CONFIG: Record<StateType, {
  label: string;
  emoji: string;
  color: string;
  textColor: string;
  bgGradient: string;
  focus: string;
}> = {
  leve: {
    label: 'Energia Leve',
    emoji: '🌱',
    color: '#9AD7B4',
    textColor: '#166534',
    bgGradient: 'linear-gradient(180deg, #e8f5e9 0%, #f0fdf4 50%, var(--bg-base) 100%)',
    focus: 'Foco balanceado',
  },
  moderado: {
    label: 'Energia Radiante',
    emoji: '✨',
    color: '#FFBE7A',
    textColor: '#92400E',
    bgGradient: 'linear-gradient(180deg, #fff8e1 0%, #fffbeb 50%, var(--bg-base) 100%)',
    focus: 'Foco profundo',
  },
  sensível: {
    label: 'Dia Sensível',
    emoji: '🌙',
    color: '#D8C8FF',
    textColor: '#5B21B6',
    bgGradient: 'linear-gradient(180deg, #f3e8ff 0%, #faf5ff 50%, var(--bg-base) 100%)',
    focus: 'Foco leve',
  },
  crítico: {
    label: 'Modo Recuperação',
    emoji: '🌊',
    color: '#FF9BA5',
    textColor: '#9F1239',
    bgGradient: 'linear-gradient(180deg, #ffe4e6 0%, #fff1f2 50%, var(--bg-base) 100%)',
    focus: 'Descanso',
  },
};

export default function CheckinResultScreen() {
  const { navigate, params } = useNavigation();
  const stateType: StateType = (params.state as StateType) || 'moderado';
  const config = STATE_CONFIG[stateType];

  const stateContent: Record<StateType, { summary: string; recommendations: string[] }> = {
    leve: {
      summary: 'Seu corpo e mente estão em ritmo tranquilo hoje. Aproveite para atividades que pedem calma e atenção aos detalhes.',
      recommendations: [
        'Comece com tarefas leves e aumente o ritmo aos poucos.',
        'Hidrate-se bem e faça pequenas pausas regulares.',
        'Uma música ambiente pode ajudar a manter o foco suave.',
      ],
    },
    moderado: {
      summary: 'Seu humor está estável e a energia acima da média. Essa combinação favorece atividades que exigem foco e criatividade.',
      recommendations: [
        'Aproveite o pico de energia para tarefas que exigem concentração.',
        'Inclua uma pausa de 15 min no meio da tarde para manter o ritmo.',
        'Considere uma caminhada leve no fim do dia para fechar bem.',
      ],
    },
    sensível: {
      summary: 'Hoje pode ser um dia mais delicado. Sua energia e humor pedem cuidado extra e um ritmo mais gentil consigo.',
      recommendations: [
        'Priorize autocuidado e evite decisões importantes se possível.',
        'Permita-se momentos de descanso sem culpa.',
        'Converse com alguém de confiança se sentir necessidade.',
      ],
    },
    crítico: {
      summary: 'Seus indicadores mostram que hoje é dia de descansar e se recuperar. Não force o ritmo — respeite seus limites.',
      recommendations: [
        'Cancele o que puder e foque apenas no essencial.',
        'Durma mais cedo hoje se possível.',
        'Atividades de baixo esforço como respiração guiada podem ajudar.',
      ],
    },
  };

  const { summary, recommendations } = stateContent[stateType];

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
          {config.label}
        </h1>

        <div className="flex justify-center mb-5 animate-fade-in delay-100">
          <span
            className="px-4 py-1.5 rounded-full text-[12px] font-semibold"
            style={{ background: `${config.color}35`, color: config.textColor }}
          >
            {config.focus}
          </span>
        </div>

        <div className="glass-card rounded-[22px] p-5 mb-5 animate-fade-in delay-200">
          <p className="text-[15px] text-center leading-[24px]" style={{ color: config.textColor, opacity: 0.85 }}>
            {summary}
          </p>
        </div>

        <div className="mb-6 animate-fade-in delay-300">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} style={{ color: config.textColor, opacity: 0.6 }} />
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: config.textColor, opacity: 0.6 }}>
              Sugestões para hoje
            </p>
          </div>
          {recommendations.map((rec, i) => (
            <div key={i} className="glass-card rounded-[16px] p-3.5 mb-2 flex items-start">
              <span className="text-sm mr-2.5 mt-0.5">💡</span>
              <p className="text-[13px] flex-1 leading-[20px]" style={{ color: config.textColor }}>
                {rec}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('checkin-done', { detail: { state: stateType } }));
            navigate('home');
          }}
          className="w-full py-[16px] rounded-[20px] text-center font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] animate-fade-in delay-400"
          style={{
            background: config.color,
            color: config.textColor,
            boxShadow: `0 6px 20px ${config.color}40`,
          }}
        >
          Ver meu dia <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigation } from '../navigation';

type StateType = 'leve' | 'moderado' | 'sensível' | 'crítico';

const STATE_CONFIG: Record<StateType, {
  label: string;
  emoji: string;
  color: string;
  textColor: string;
  bgColor: string;
  focus: string;
}> = {
  leve: {
    label: 'Energia Leve',
    emoji: '🌱',
    color: '#9AD7B4',
    textColor: '#166534',
    bgColor: '#F0FDF4',
    focus: 'Foco balanceado',
  },
  moderado: {
    label: 'Energia Radiante',
    emoji: '✨',
    color: '#FFBE7A',
    textColor: '#92400E',
    bgColor: '#FFFBEB',
    focus: 'Foco profundo',
  },
  sensível: {
    label: 'Dia Sensível',
    emoji: '🌙',
    color: '#D8C8FF',
    textColor: '#5B21B6',
    bgColor: '#FAF5FF',
    focus: 'Foco leve',
  },
  crítico: {
    label: 'Modo Recuperação',
    emoji: '🌊',
    color: '#FF9BA5',
    textColor: '#9F1239',
    bgColor: '#FFF1F2',
    focus: 'Descanso',
  },
};

export default function CheckinResultScreen() {
  const { navigate, params } = useNavigation();
  const stateType: StateType = (params.state as StateType) || 'moderado';
  const config = STATE_CONFIG[stateType];
  const summary = 'Seu humor está estável e a energia acima da média hoje. Essa combinação favorece atividades que exigem foco e criatividade. Aproveite para avançar em tarefas importantes.';

  const recommendations = [
    'Aproveite o pico de energia para tarefas que exigem concentração.',
    'Inclua uma pausa de 15 min no meio da tarde para manter o ritmo.',
    'Considere uma caminhada leve no fim do dia para fechar bem.',
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: config.bgColor }}>
      <div className="flex-1 p-6">
        <div className="flex justify-center mt-8 mb-7">
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: config.color,
              boxShadow: `0 8px 30px ${config.color}73`,
            }}
          >
            <span className="text-[56px]">{config.emoji}</span>
          </div>
        </div>

        <h1
          className="text-[28px] font-bold text-center mb-2.5"
          style={{ color: config.textColor }}
        >
          {config.label}
        </h1>

        <div className="flex justify-center mb-5">
          <span
            className="px-4 py-1.5 rounded-full text-[13px] font-semibold"
            style={{
              backgroundColor: config.color + '55',
              color: config.textColor,
              letterSpacing: '0.3px',
            }}
          >
            {config.focus}
          </span>
        </div>

        <div className="bg-white/65 rounded-[20px] p-5 mb-5">
          <p
            className="text-base text-center leading-[26px] opacity-90"
            style={{ color: config.textColor }}
          >
            {summary}
          </p>
        </div>

        <div className="mb-7">
          <p
            className="text-[13px] font-semibold uppercase tracking-wider mb-2.5 opacity-70"
            style={{ color: config.textColor }}
          >
            Sugestões para hoje
          </p>
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className="flex items-start bg-white/65 rounded-[14px] p-3.5 mb-2"
            >
              <span className="text-sm mr-2.5 mt-0.5">💡</span>
              <p
                className="text-sm flex-1 leading-[21px]"
                style={{ color: config.textColor }}
              >
                {rec}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            window.dispatchEvent(new Event('checkin-done'));
            navigate('home');
          }}
          className="w-full py-4.5 rounded-2xl text-center text-base font-bold"
          style={{
            backgroundColor: config.color,
            color: config.textColor,
            boxShadow: `0 4px 16px ${config.color}59`,
          }}
        >
          Ver meu dia →
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Sparkles, MessageCircle, Calendar, PlusCircle } from 'lucide-react';
import { useNavigation } from '../navigation';

export default function HomeScreen() {
  const { navigate } = useNavigation();
  const [hasCheckin, setHasCheckin] = useState(false);

  useEffect(() => {
    const handler = () => setHasCheckin(true);
    window.addEventListener('checkin-done', handler);
    return () => window.removeEventListener('checkin-done', handler);
  }, []);
  const stateType = 'moderado';
  const stateLabel = 'Energia Radiante';
  const analysis = 'Seu humor e energia estão em bom equilíbrio hoje. A clareza mental está acima da média, o que favorece tarefas que exigem foco.';
  const recommendation = 'Aproveite o pico de energia para suas tarefas mais importantes antes das 14h.';

  const stateStyles: Record<string, string> = {
    leve: 'bg-green-50 border-green-200',
    moderado: 'bg-blue-50 border-blue-200',
    sensível: 'bg-yellow-50 border-yellow-200',
    crítico: 'bg-red-50 border-red-200',
  };

  const blocks = [
    { id: '1', title: 'Foco no projeto', startTime: '09:00', intensity: 'M' },
    { id: '2', title: 'Caminhada', startTime: '12:00', intensity: 'L' },
    { id: '3', title: 'Revisão de emails', startTime: '14:00', intensity: 'L' },
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto px-6 pt-4 pb-6">
      <div className="mb-8">
        <p className="text-gray-400 font-medium text-sm">Bom dia,</p>
        <h1 className="text-2xl font-bold text-gray-800">Ciclagem & Humor</h1>
      </div>

      {hasCheckin ? (
        <div className={`p-6 rounded-3xl border ${stateStyles[stateType]} mb-8`}>
          <div className="flex items-center mb-3">
            <Sparkles size={20} className="text-blue-700" />
            <span className="text-lg font-bold ml-2 uppercase tracking-widest text-blue-800 text-sm">
              {stateLabel}
            </span>
          </div>
          <p className="text-gray-700 text-[15px] leading-relaxed mb-4">
            {analysis}
          </p>
          <div className="bg-white/50 p-3 rounded-xl">
            <p className="text-xs font-bold text-gray-500 mb-1 uppercase">Sugestão IA</p>
            <p className="text-gray-800 italic text-sm">"{recommendation}"</p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8 flex flex-col items-center">
          <p className="text-gray-400 text-center mb-4">Ainda não sei como você está hoje.</p>
          <button
            onClick={() => navigate('checkin')}
            className="bg-blue-600 px-6 py-3 rounded-full flex items-center gap-2 text-white font-bold"
          >
            <PlusCircle size={20} />
            Fazer Check-in
          </button>
        </div>
      )}

      <div className="flex gap-4 mb-8">
        <button
          onClick={() => navigate('journal')}
          className="flex-1 bg-gray-50 p-4 rounded-2xl flex flex-col items-center border border-gray-100 hover:bg-gray-100 transition-colors"
        >
          <MessageCircle size={24} className="text-blue-500" />
          <span className="text-gray-800 font-bold mt-2 text-sm">Diário</span>
        </button>
        <button
          onClick={() => navigate('planner')}
          className="flex-1 bg-gray-50 p-4 rounded-2xl flex flex-col items-center border border-gray-100 hover:bg-gray-100 transition-colors"
        >
          <Calendar size={24} className="text-blue-500" />
          <span className="text-gray-800 font-bold mt-2 text-sm">Planner</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">Próximo na agenda</h2>
          <button onClick={() => navigate('planner')} className="text-blue-600 font-bold text-sm">
            Ver tudo
          </button>
        </div>

        {blocks.map((block) => (
          <div key={block.id} className="flex items-center mb-3 bg-gray-50 p-4 rounded-2xl border-l-4 border-blue-400">
            <div className="w-12">
              <span className="text-gray-400 font-bold text-[10px]">{block.startTime}</span>
            </div>
            <div className="flex-1 pl-4">
              <p className="text-gray-800 font-bold text-sm">{block.title}</p>
              <p className="text-gray-500 text-xs">Intensidade: {block.intensity}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

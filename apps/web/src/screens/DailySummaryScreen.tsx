import React from 'react';
import { CheckCircle2, Sparkles, Heart, Lightbulb, ArrowRight } from 'lucide-react';
import { useNavigation } from '../navigation';

export default function DailySummaryScreen() {
  const { navigate } = useNavigation();

  const summaryData = {
    text: 'Hoje você trouxe reflexões profundas sobre o equilíbrio entre trabalho e descanso. Parece que reconhecer seus limites está sendo um passo importante para sua regulação de energia.',
    emotions: ['cansada', 'reflexiva', 'esperançosa'],
    themes: ['trabalho', 'autocuidado'],
    suggestions: [
      'Tente uma pausa de 10 min sem telas agora.',
      'Que tal uma bebida quente para relaxar?',
    ],
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto px-6 pt-8 pb-6">
      <div className="flex flex-col items-center mb-6">
        <div className="bg-green-100 p-4 rounded-full">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mt-4 text-center">Sessão Concluída</h1>
        <p className="text-gray-500 text-center mt-1 text-sm">Aqui está o que sua IA percebeu</p>
      </div>

      <div className="flex flex-wrap justify-center mb-8 gap-2">
        {summaryData.emotions.map((emotion, i) => (
          <div key={i} className="bg-blue-50 px-4 py-2 rounded-full border border-blue-100 flex items-center gap-2">
            <Heart size={14} className="text-blue-500" />
            <span className="text-blue-600 font-bold capitalize text-sm">{emotion}</span>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8">
        <div className="flex items-center mb-3 gap-2">
          <Sparkles size={20} className="text-purple-600" />
          <span className="text-purple-700 font-bold uppercase text-xs tracking-widest">Síntese da Conversa</span>
        </div>
        <p className="text-gray-800 text-[15px] leading-relaxed italic">
          "{summaryData.text}"
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center mb-4 gap-2">
          <Lightbulb size={20} className="text-yellow-500" />
          <h2 className="text-lg font-bold text-gray-800">Sugestões para agora</h2>
        </div>

        {summaryData.suggestions.map((suggestion, i) => (
          <div key={i} className="bg-white border border-gray-100 p-4 rounded-2xl mb-3 shadow-sm flex items-center">
            <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3 flex-shrink-0" />
            <p className="text-gray-700 flex-1 text-sm">{suggestion}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('home')}
        className="bg-blue-600 p-5 rounded-2xl flex items-center justify-center gap-2 mb-4"
      >
        <span className="text-white font-bold text-lg">Voltar para o Início</span>
        <ArrowRight size={20} className="text-white" />
      </button>
    </div>
  );
}

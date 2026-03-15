import React from 'react';
import { LineChart, Zap, Smile, CheckCircle2, BrainCircuit, ArrowRight } from 'lucide-react';

const weeklyData = {
  summary: {
    avgMood: 3.8,
    avgEnergy: 3.5,
    checkinCount: 5,
    tasksCompleted: 12,
    tasksTotal: 15,
    journalSessions: 3,
  },
  patterns: [
    { type: 'Humor', description: 'Seu humor tende a cair nas quartas-feiras, possivelmente ligado ao acúmulo de demandas.', confidence: 'high' },
    { type: 'Energia', description: 'Energia mais alta pela manhã (antes das 11h) e queda consistente após as 15h.', confidence: 'high' },
    { type: 'Sono', description: 'Noites com sono acima de 7h correlacionam com humor +0.8 no dia seguinte.', confidence: 'medium' },
  ],
  recommendations: [
    { category: 'Rotina', text: 'Agende tarefas criativas pela manhã e administrativas à tarde.' },
    { category: 'Autocuidado', text: 'Adicione uma pausa de 15 min entre 14h-15h para recuperar energia.' },
  ],
  aiAnalysis: 'Sua semana mostrou um bom equilíbrio geral, com pontos de atenção no meio da semana. A consistência nos check-ins está ajudando a IA a mapear seus padrões com mais precisão. Continue assim.',
};

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`w-[48%] ${color} p-4 rounded-2xl mb-3`}>
      <div className="mb-2">{icon}</div>
      <p className="text-gray-500 text-xs font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

export default function InsightsScreen() {
  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto px-6 pt-4 pb-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-gray-400 font-medium text-sm">Sua Ciclagem</p>
          <h1 className="text-2xl font-bold text-gray-800">Insights da Semana</h1>
        </div>
        <LineChart size={28} className="text-blue-500" />
      </div>

      <div className="flex flex-wrap justify-between mb-6">
        <StatCard label="Humor Médio" value={`${weeklyData.summary.avgMood}/5`} icon={<Smile size={18} className="text-green-500" />} color="bg-green-50" />
        <StatCard label="Energia Média" value={`${weeklyData.summary.avgEnergy}/5`} icon={<Zap size={18} className="text-yellow-500" />} color="bg-yellow-50" />
        <StatCard label="Check-ins" value={weeklyData.summary.checkinCount.toString()} icon={<CheckCircle2 size={18} className="text-blue-500" />} color="bg-blue-50" />
        <StatCard label="Produtividade" value={`${Math.round((weeklyData.summary.tasksCompleted / weeklyData.summary.tasksTotal) * 100)}%`} icon={<LineChart size={18} className="text-purple-500" />} color="bg-purple-50" />
      </div>

      <div className="flex items-center mb-4">
        <BrainCircuit size={20} className="text-gray-700" />
        <h2 className="text-lg font-bold text-gray-800 ml-2">Padrões Identificados</h2>
      </div>
      <div className="mb-8">
        {weeklyData.patterns.map((pattern, i) => (
          <div key={i} className="bg-gray-50 p-4 rounded-2xl mb-3 border-l-4 border-blue-500">
            <div className="flex items-center mb-1 gap-2">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">{pattern.type}</span>
              <span className={`px-1.5 rounded-full text-[8px] font-bold ${pattern.confidence === 'high' ? 'bg-green-100' : 'bg-orange-100'}`}>
                Confiança: {pattern.confidence}
              </span>
            </div>
            <p className="text-gray-800 text-sm font-medium">{pattern.description}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center mb-4">
        <CheckCircle2 size={20} className="text-gray-700" />
        <h2 className="text-lg font-bold text-gray-800 ml-2">Ações Recomendadas</h2>
      </div>
      <div className="mb-8">
        {weeklyData.recommendations.map((rec, i) => (
          <div key={i} className="bg-blue-600 p-4 rounded-2xl mb-3 flex items-center">
            <div className="flex-1">
              <p className="text-blue-100 text-[10px] font-bold uppercase mb-1">{rec.category}</p>
              <p className="text-white font-bold text-sm">{rec.text}</p>
            </div>
            <ArrowRight size={20} className="text-white ml-2" />
          </div>
        ))}
      </div>

      <div className="bg-indigo-50 p-6 rounded-3xl mb-4">
        <p className="text-indigo-800 font-bold mb-2 uppercase text-xs tracking-widest">Resumo da IA</p>
        <p className="text-indigo-900 italic text-[15px] leading-relaxed">
          "{weeklyData.aiAnalysis}"
        </p>
      </div>
    </div>
  );
}

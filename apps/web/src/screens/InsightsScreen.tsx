import React from 'react';
import { Zap, Smile, CheckCircle2, BrainCircuit, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';

const weeklyData = {
  summary: {
    avgMood: 3.8,
    avgEnergy: 3.5,
    checkinCount: 5,
    tasksCompleted: 12,
    tasksTotal: 15,
    journalSessions: 3,
  },
  moodByDay: [
    { day: 'Seg', mood: 4, energy: 4 },
    { day: 'Ter', mood: 3, energy: 3 },
    { day: 'Qua', mood: 2, energy: 2 },
    { day: 'Qui', mood: 3, energy: 3 },
    { day: 'Sex', mood: 4, energy: 4 },
    { day: 'Sáb', mood: 4, energy: 3 },
    { day: 'Dom', mood: 5, energy: 4 },
  ],
  patterns: [
    { type: 'Ciclagem', description: 'Sua energia tende a cair nas quartas-feiras — pode estar ligado ao acúmulo de demandas do início da semana.', severity: 'high' },
    { type: 'Pico', description: 'Energia mais alta pela manhã (antes das 11h) e queda consistente após as 15h.', severity: 'medium' },
    { type: 'Sono', description: 'Noites com sono acima de 7h correlacionam com humor +0.8 no dia seguinte.', severity: 'low' },
  ],
  recommendations: [
    { category: 'Rotina', text: 'Agende tarefas criativas pela manhã e administrativas à tarde.' },
    { category: 'Autocuidado', text: 'Adicione uma pausa de 15 min entre 14h-15h para recuperar energia.' },
  ],
  aiAnalysis: 'Sua semana mostrou um padrão de ciclagem característico: energia alta no início e fim da semana, com uma queda no meio. A consistência nos check-ins está ajudando a mapear sua ciclagem com mais precisão.',
};

const severityColors: Record<string, { bg: string; border: string; text: string }> = {
  high: { bg: 'rgba(244,63,94,0.06)', border: 'var(--accent-rose)', text: 'var(--accent-rose)' },
  medium: { bg: 'rgba(245,158,11,0.06)', border: 'var(--accent-orange)', text: 'var(--accent-orange)' },
  low: { bg: 'rgba(16,185,129,0.06)', border: 'var(--cat-saude)', text: 'var(--cat-saude)' },
};

export default function InsightsScreen() {
  const maxBar = 5;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 pt-3 pb-4" style={{ background: 'var(--bg-base)' }}>
      <div className="mb-5 animate-fade-in">
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>Sua Ciclagem</p>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Padrões da Semana
        </h1>
      </div>

      <div className="glass-card rounded-[22px] p-4 mb-4 animate-fade-in delay-100">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} />
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Humor & Energia</p>
        </div>
        <div className="flex items-end justify-between gap-1.5 h-24 mb-2">
          {weeklyData.moodByDay.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center gap-0.5" style={{ height: 80 }}>
                <div className="w-full rounded-t-lg transition-all" style={{
                  height: `${(d.mood / maxBar) * 100}%`,
                  background: 'var(--accent-green)',
                  opacity: 0.7,
                }} />
                <div className="w-full rounded-b-lg transition-all" style={{
                  height: `${(d.energy / maxBar) * 100}%`,
                  background: 'var(--accent-teal)',
                  opacity: 0.5,
                }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {weeklyData.moodByDay.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{d.day}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent-green)', opacity: 0.7 }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Humor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent-teal)', opacity: 0.5 }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Energia</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 mb-4 animate-fade-in delay-200">
        {[
          { label: 'Humor', value: `${weeklyData.summary.avgMood}/5`, icon: <Smile size={16} />, color: 'var(--cat-saude)' },
          { label: 'Energia', value: `${weeklyData.summary.avgEnergy}/5`, icon: <Zap size={16} />, color: 'var(--accent-orange)' },
          { label: 'Check-ins', value: weeklyData.summary.checkinCount.toString(), icon: <CheckCircle2 size={16} />, color: 'var(--accent-blue)' },
        ].map((stat, i) => (
          <div key={i} className="flex-1 glass-card rounded-[18px] p-3.5">
            <div className="mb-2" style={{ color: stat.color }}>{stat.icon}</div>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 animate-fade-in delay-300">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit size={16} style={{ color: 'var(--text-primary)' }} />
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Padrões de Ciclagem
          </h2>
        </div>
        {weeklyData.patterns.map((pattern, i) => {
          const sev = severityColors[pattern.severity] || severityColors.low;
          return (
            <div key={i} className="glass-card rounded-[18px] p-4 mb-2.5"
              style={{ borderLeft: `3px solid ${sev.border}` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle size={11} style={{ color: sev.text }} />
                <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: sev.text }}>{pattern.type}</span>
              </div>
              <p className="text-[13px] font-medium leading-[20px]" style={{ color: 'var(--text-primary)' }}>{pattern.description}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 animate-fade-in delay-400">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={16} style={{ color: 'var(--text-primary)' }} />
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Ações Recomendadas
          </h2>
        </div>
        {weeklyData.recommendations.map((rec, i) => (
          <div key={i} className="rounded-[18px] p-4 mb-2.5 flex items-center" style={{ background: 'var(--bg-dark)' }}>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--accent-teal)', opacity: 0.7 }}>{rec.category}</p>
              <p className="text-white font-semibold text-[13px]">{rec.text}</p>
            </div>
            <ArrowRight size={18} color="white" className="ml-2 opacity-50" />
          </div>
        ))}
      </div>

      <div className="glass-card rounded-[22px] p-5 mb-4 animate-fade-in delay-400"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(45,212,191,0.06))' }}>
        <div className="flex items-center gap-2 mb-2">
          <BrainCircuit size={14} style={{ color: 'var(--accent-purple)' }} />
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-purple)' }}>
            Resumo da IA
          </p>
        </div>
        <p className="text-[14px] leading-[22px] italic" style={{ color: 'var(--text-primary)' }}>
          "{weeklyData.aiAnalysis}"
        </p>
      </div>
    </div>
  );
}

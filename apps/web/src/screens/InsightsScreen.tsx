import React, { useEffect } from 'react';
import { Zap, Smile, CheckCircle2, BrainCircuit, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/auth_store';
import { useCheckinStore } from '../stores/checkin_store';
import { useInsightStore } from '../stores/insight_store';

const severityColors: Record<string, { bg: string; border: string; text: string }> = {
  high:   { bg: 'rgba(244,63,94,0.06)',   border: 'var(--accent-rose)',   text: 'var(--accent-rose)' },
  medium: { bg: 'rgba(245,158,11,0.06)',  border: 'var(--accent-orange)', text: 'var(--accent-orange)' },
  low:    { bg: 'rgba(16,185,129,0.06)',  border: 'var(--cat-saude)',     text: 'var(--cat-saude)' },
};

const catLabel: Record<string, string> = {
  planning: 'Planejamento',
  'self-care': 'Autocuidado',
  social: 'Social',
};

export default function InsightsScreen() {
  const { userId } = useAuthStore();
  const { recentCheckins, load: loadCheckins } = useCheckinStore();
  const { weeklyInsight, isLoading, load: loadInsights } = useInsightStore();

  useEffect(() => {
    if (!userId) return;
    void loadCheckins(userId);
    void loadInsights(userId);
  }, [userId, loadCheckins, loadInsights]);

  // Build bar chart data from recentCheckins (last 7 days)
  const dayLabels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), label: dayLabels[d.getDay()] };
  });
  const byDate = Object.fromEntries(recentCheckins.map((c) => [c.local_date, c]));

  const patterns = weeklyInsight?.insights?.patterns ?? [];
  const recommendations = weeklyInsight?.insights?.recommendations ?? [];
  const aiAnalysis = weeklyInsight?.insights?.aiAnalysis ?? null;

  // Prefer DB values, fall back to computing from recent checkins
  const avgMood = weeklyInsight?.avg_mood
    ?? (recentCheckins.length > 0 ? recentCheckins.reduce((s, c) => s + c.mood_score, 0) / recentCheckins.length : null);
  const avgEnergy = weeklyInsight?.avg_energy
    ?? (recentCheckins.length > 0 ? recentCheckins.reduce((s, c) => s + c.energy_score, 0) / recentCheckins.length : null);
  const checkinCount = weeklyInsight?.checkin_count ?? recentCheckins.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 pt-3 pb-4" style={{ background: 'var(--bg-base)' }}>
      <div className="mb-5 animate-fade-in">
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>Sua Ciclagem</p>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Padrões da Semana
        </h1>
      </div>

      {/* Bar chart */}
      <div className="glass-card rounded-[22px] p-4 mb-4 animate-fade-in delay-100">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} />
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Humor & Energia</p>
        </div>
        <div className="flex items-end justify-between gap-1.5 h-24 mb-2">
          {chartDays.map((d, i) => {
            const c = byDate[d.date];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-0.5" style={{ height: 80 }}>
                  <div className="w-full rounded-t-lg transition-all" style={{
                    height: c ? `${(c.mood_score / 5) * 100}%` : '4%',
                    background: 'var(--accent-green)',
                    opacity: c ? 0.7 : 0.15,
                  }} />
                  <div className="w-full rounded-b-lg transition-all" style={{
                    height: c ? `${(c.energy_score / 5) * 100}%` : '4%',
                    background: 'var(--accent-teal)',
                    opacity: c ? 0.5 : 0.1,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between">
          {chartDays.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
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

      {/* Summary stats */}
      <div className="flex gap-2.5 mb-4 animate-fade-in delay-200">
        {[
          { label: 'Humor',     value: avgMood    != null ? `${avgMood.toFixed(1)}/5`    : '—', icon: <Smile size={16} />,       color: 'var(--cat-saude)' },
          { label: 'Energia',   value: avgEnergy  != null ? `${avgEnergy.toFixed(1)}/5`  : '—', icon: <Zap size={16} />,         color: 'var(--accent-orange)' },
          { label: 'Check-ins', value: checkinCount > 0   ? checkinCount.toString()       : '0', icon: <CheckCircle2 size={16} />, color: 'var(--accent-blue)' },
        ].map((stat, i) => (
          <div key={i} className="flex-1 glass-card rounded-[18px] p-3.5">
            <div className="mb-2" style={{ color: stat.color }}>{stat.icon}</div>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* No data state */}
      {!isLoading && checkinCount === 0 && (
        <div className="glass-card rounded-[22px] p-6 mb-4 text-center animate-fade-in delay-300">
          <p className="text-[28px] mb-2">🌱</p>
          <p className="text-[15px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Ainda sem dados essa semana</p>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Faça seu primeiro check-in para começar a mapear sua ciclagem.</p>
        </div>
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <div className="mb-4 animate-fade-in delay-300">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit size={16} style={{ color: 'var(--text-primary)' }} />
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Padrões de Ciclagem
            </h2>
          </div>
          {patterns.map((pattern, i) => {
            const sev = severityColors[pattern.confidence] || severityColors.low;
            return (
              <div key={i} className="glass-card rounded-[18px] p-4 mb-2.5"
                style={{ borderLeft: `3px solid ${sev.border}` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={11} style={{ color: sev.text }} />
                  <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: sev.text }}>
                    {pattern.type}
                  </span>
                </div>
                <p className="text-[13px] font-medium leading-[20px]" style={{ color: 'var(--text-primary)' }}>
                  {pattern.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-4 animate-fade-in delay-400">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} style={{ color: 'var(--text-primary)' }} />
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Ações Recomendadas
            </h2>
          </div>
          {recommendations.map((rec, i) => (
            <div key={i} className="rounded-[18px] p-4 mb-2.5 flex items-center" style={{ background: 'var(--bg-dark)' }}>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--accent-teal)', opacity: 0.7 }}>
                  {catLabel[rec.category] ?? rec.category}
                </p>
                <p className="text-white font-semibold text-[13px]">{rec.text}</p>
              </div>
              <ArrowRight size={18} color="white" className="ml-2 opacity-50" />
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      {aiAnalysis && (
        <div className="glass-card rounded-[22px] p-5 mb-4 animate-fade-in delay-400"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(45,212,191,0.06))' }}>
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit size={14} style={{ color: 'var(--accent-purple)' }} />
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-purple)' }}>
              Resumo da IA
            </p>
          </div>
          <p className="text-[14px] leading-[22px] italic" style={{ color: 'var(--text-primary)' }}>
            "{aiAnalysis}"
          </p>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          <p className="text-[13px]">Carregando seus dados...</p>
        </div>
      )}
    </div>
  );
}

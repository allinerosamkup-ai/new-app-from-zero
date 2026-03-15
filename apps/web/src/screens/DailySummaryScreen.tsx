import React from 'react';
import { CheckCircle2, Sparkles, Heart, Lightbulb, ArrowRight, AlertTriangle, Calendar } from 'lucide-react';
import { useNavigation } from '../navigation';

export default function DailySummaryScreen() {
  const { navigate } = useNavigation();

  const summaryData = {
    text: 'Hoje você trouxe reflexões sobre o equilíbrio entre trabalho e descanso. Reconhecer seus limites está sendo um passo importante para sua regulação de energia — esse é um padrão que estou acompanhando.',
    emotions: ['cansada', 'reflexiva', 'esperançosa'],
    themes: ['trabalho', 'autocuidado'],
    loop: 'Percebi que nas últimas 3 sessões o tema "sobrecarga no trabalho" apareceu. Vale observar se isso está ligado à sua ciclagem de quartas-feiras.',
    suggestions: [
      'Tente uma pausa de 10 min sem telas agora.',
      'Que tal uma bebida quente para relaxar?',
    ],
  };

  const emotionColors = ['var(--accent-purple)', 'var(--accent-blue)', 'var(--cat-saude)'];

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 pt-6 pb-5" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center mb-6 animate-fade-in">
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.1)' }}>
          <CheckCircle2 size={32} style={{ color: 'var(--cat-saude)' }} />
        </div>
        <h1 className="text-[22px] font-bold mt-4 text-center" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Sessão Concluída
        </h1>
        <p className="text-center mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          O que sua IA percebeu sobre sua ciclagem
        </p>
      </div>

      <div className="flex flex-wrap justify-center mb-5 gap-2 animate-fade-in delay-100">
        {summaryData.emotions.map((emotion, i) => (
          <div key={i} className="glass-card px-3.5 py-2 rounded-full flex items-center gap-1.5">
            <Heart size={12} style={{ color: emotionColors[i % emotionColors.length] }} />
            <span className="font-semibold capitalize text-[12px]" style={{ color: emotionColors[i % emotionColors.length] }}>
              {emotion}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center mb-5 gap-1.5 animate-fade-in delay-100">
        {summaryData.themes.map((theme, i) => (
          <span key={i} className="text-[10px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(31,59,50,0.06)', color: 'var(--text-secondary)' }}>
            #{theme}
          </span>
        ))}
      </div>

      <div className="glass-card rounded-[22px] p-5 mb-4 animate-fade-in delay-200"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(45,212,191,0.04))' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: 'var(--accent-purple)' }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-purple)' }}>
            Síntese da Conversa
          </span>
        </div>
        <p className="text-[14px] leading-[22px] italic" style={{ color: 'var(--text-primary)' }}>
          "{summaryData.text}"
        </p>
      </div>

      {summaryData.loop && (
        <div className="glass-card rounded-[18px] p-4 mb-4 animate-fade-in delay-300"
          style={{ borderLeft: '3px solid var(--accent-orange)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} style={{ color: 'var(--accent-orange)' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-orange)' }}>
              Loop detectado
            </span>
          </div>
          <p className="text-[13px] leading-[20px]" style={{ color: 'var(--text-primary)' }}>
            {summaryData.loop}
          </p>
        </div>
      )}

      <div className="mb-5 animate-fade-in delay-300">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={14} style={{ color: 'var(--accent-orange)' }} />
          <h2 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Sugestões para agora
          </h2>
        </div>
        {summaryData.suggestions.map((suggestion, i) => (
          <div key={i} className="glass-card rounded-[16px] p-3.5 mb-2 flex items-center">
            <span className="text-sm mr-2.5">💡</span>
            <p className="text-[13px] flex-1 leading-[20px]" style={{ color: 'var(--text-primary)' }}>{suggestion}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2.5 animate-fade-in delay-400">
        <button
          onClick={() => navigate('planner')}
          className="flex-1 py-[14px] rounded-[18px] flex items-center justify-center gap-2 font-bold text-[14px] transition-all active:scale-[0.98]"
          style={{ background: 'rgba(31,59,50,0.06)', color: 'var(--accent-green)' }}
        >
          <Calendar size={16} /> Ajustar Planner
        </button>
        <button
          onClick={() => navigate('home')}
          className="flex-1 py-[14px] rounded-[18px] flex items-center justify-center gap-2 text-white font-bold text-[14px] transition-all active:scale-[0.98]"
          style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-md)' }}
        >
          Início <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

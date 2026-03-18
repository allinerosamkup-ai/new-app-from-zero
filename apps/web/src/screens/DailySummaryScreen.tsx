import React from 'react';
import { CheckCircle2, Sparkles, Heart, ArrowRight, AlertTriangle, Calendar } from 'lucide-react';
import { useNavigation } from '../navigation';
import { useJournalStore } from '../stores/journal_store';

const EMOTION_COLORS = ['var(--accent-purple)', 'var(--accent-teal)', 'var(--cat-saude)', 'var(--accent-orange)', 'var(--accent-rose)'];

export default function DailySummaryScreen() {
  const { navigate } = useNavigation();
  const { sessions } = useJournalStore();

  const latest = sessions[0];
  const summary = latest?.summary ?? 'Sua sessão foi registrada. Continue explorando seus padrões de ciclagem.';
  const emotions: string[] = latest?.emotions ?? [];
  const themes: string[] = latest?.themes ?? [];

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 pt-6 pb-5" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center mb-6 animate-fade-in">
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.1)' }}>
          <CheckCircle2 size={32} strokeWidth={1.5} style={{ color: 'var(--cat-saude)' }} />
        </div>
        <h1 className="text-[22px] font-bold mt-4 text-center" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Sessão Concluída
        </h1>
        <p className="text-center mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          O que sua IA percebeu sobre sua ciclagem
        </p>
      </div>

      {emotions.length > 0 && (
        <div className="flex flex-wrap justify-center mb-5 gap-2 animate-fade-in delay-100">
          {emotions.map((emotion, i) => (
            <div key={i} className="glass-card px-3.5 py-2 rounded-full flex items-center gap-1.5">
              <Heart size={12} strokeWidth={1.5} style={{ color: EMOTION_COLORS[i % EMOTION_COLORS.length] }} />
              <span className="font-semibold capitalize text-[12px]" style={{ color: EMOTION_COLORS[i % EMOTION_COLORS.length] }}>
                {emotion}
              </span>
            </div>
          ))}
        </div>
      )}

      {themes.length > 0 && (
        <div className="flex flex-wrap justify-center mb-5 gap-1.5 animate-fade-in delay-100">
          {themes.map((theme, i) => (
            <span key={i} className="text-[10px] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(31,59,50,0.06)', color: 'var(--text-secondary)' }}>
              #{theme}
            </span>
          ))}
        </div>
      )}

      <div className="interactive-card glass-card rounded-[22px] p-5 mb-4 animate-fade-in delay-200"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(45,212,191,0.04))' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} strokeWidth={1.5} style={{ color: 'var(--accent-9)' }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-9)' }}>
            Síntese da Conversa
          </span>
        </div>
        <p className="text-[14px] leading-[22px] italic" style={{ color: 'var(--text-primary)' }}>
          "{summary}"
        </p>
      </div>


      {!latest && (
        <div className="interactive-card glass-card rounded-[18px] p-4 mb-4 animate-fade-in delay-300"
          style={{ borderLeft: '3px solid var(--accent-teal)' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={13} strokeWidth={1.5} style={{ color: 'var(--accent-teal)' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-teal)' }}>
              Dica
            </span>
          </div>
          <p className="text-[13px] leading-[20px]" style={{ color: 'var(--text-primary)' }}>
            A síntese completa aparece depois que a sessão é finalizada no diário.
          </p>
        </div>
      )}

      <div className="flex gap-2.5 animate-fade-in delay-400">
        <button
          onClick={() => navigate('planner')}
          className="flex-1 py-[14px] rounded-[18px] flex items-center justify-center gap-2 font-bold text-[14px] transition-all active:scale-[0.98]"
          style={{ background: 'rgba(31,59,50,0.06)', color: 'var(--accent-green)' }}
        >
          <Calendar size={16} strokeWidth={1.5} /> Ajustar Planner
        </button>
        <button
          onClick={() => navigate('home')}
          className="flex-1 py-[14px] rounded-[18px] flex items-center justify-center gap-2 text-white font-bold text-[14px] transition-all active:scale-[0.98]"
          style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-md)' }}
        >
          Início <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

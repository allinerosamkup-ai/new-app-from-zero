import React, { useState, useEffect } from 'react';
import { Sparkles, MessageCircle, Calendar, PlusCircle, Brain, ArrowRight, Zap, LineChart } from 'lucide-react';
import { useNavigation } from '../navigation';

interface CheckinData {
  state: 'leve' | 'moderado' | 'sensível' | 'crítico';
  date: string;
}

const CHECKIN_STORAGE_KEY = 'ciclagem_checkin_today';

function getStoredCheckin(): CheckinData | null {
  try {
    const stored = localStorage.getItem(CHECKIN_STORAGE_KEY);
    if (!stored) return null;
    
    const data: CheckinData = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0];
    
    // Verifica se o check-in é de hoje
    if (data.date === today) {
      return data;
    }
    
    // Check-in expirado (não é de hoje)
    localStorage.removeItem(CHECKIN_STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

function saveCheckin(data: CheckinData): void {
  try {
    localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[saveCheckin] Failed to persist checkin:', err);
  }
}

export default function HomeScreen() {
  const { navigate } = useNavigation();
  const [hasCheckin, setHasCheckin] = useState(false);
  const [checkinState, setCheckinState] = useState<'leve' | 'moderado' | 'sensível' | 'crítico'>('moderado');
  
  useEffect(() => {
    // Carrega check-in persistido ao montar o componente
    const stored = getStoredCheckin();
    if (stored) {
      setHasCheckin(true);
      setCheckinState(stored.state);
    }
    
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.state) {
        const newData: CheckinData = {
          state: detail.state,
          date: new Date().toISOString().split('T')[0],
        };
        setCheckinState(detail.state);
        saveCheckin(newData);
      }
      setHasCheckin(true);
    };
    window.addEventListener('checkin-done', handler);
    return () => window.removeEventListener('checkin-done', handler);
  }, []);

  const stateData: Record<string, { label: string; emoji: string; analysis: string; recommendation: string; gradient: string; color: string }> = {
    leve: {
      label: 'Energia Leve',
      emoji: '🌱',
      analysis: 'Seu corpo e mente estão em ritmo tranquilo. Aproveite para atividades que pedem calma e atenção.',
      recommendation: 'Comece com tarefas leves e aumente o ritmo gradualmente.',
      gradient: 'linear-gradient(135deg, rgba(154,215,180,0.3), rgba(154,215,180,0.1))',
      color: '#166534',
    },
    moderado: {
      label: 'Energia Radiante',
      emoji: '✨',
      analysis: 'Humor e energia em equilíbrio. Clareza mental acima da média — ótimo para tarefas que exigem foco.',
      recommendation: 'Aproveite o pico para suas tarefas mais importantes antes das 14h.',
      gradient: 'linear-gradient(135deg, rgba(255,190,122,0.3), rgba(255,190,122,0.1))',
      color: '#92400E',
    },
    sensível: {
      label: 'Dia Sensível',
      emoji: '🌙',
      analysis: 'Hoje pode ser mais delicado. Sua energia pede cuidado extra e um ritmo mais gentil consigo.',
      recommendation: 'Priorize autocuidado e evite decisões importantes se possível.',
      gradient: 'linear-gradient(135deg, rgba(216,200,255,0.3), rgba(216,200,255,0.1))',
      color: '#5B21B6',
    },
    crítico: {
      label: 'Modo Recuperação',
      emoji: '🌊',
      analysis: 'Seus indicadores mostram que hoje é dia de descansar. Não force o ritmo.',
      recommendation: 'Cancele o que puder e foque apenas no essencial.',
      gradient: 'linear-gradient(135deg, rgba(255,155,165,0.3), rgba(255,155,165,0.1))',
      color: '#9F1239',
    },
  };

  const current = stateData[checkinState] || stateData.moderado;

  const blocks = [
    { id: '1', title: 'Foco no projeto', startTime: '09:00', category: 'trabalho', intensity: 'P' },
    { id: '2', title: 'Caminhada leve', startTime: '12:00', category: 'saúde', intensity: 'L' },
    { id: '3', title: 'Revisão de emails', startTime: '14:00', category: 'trabalho', intensity: 'L' },
  ];

  const catColors: Record<string, string> = {
    trabalho: 'var(--cat-trabalho)',
    saúde: 'var(--cat-saude)',
    lazer: 'var(--cat-lazer)',
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 pt-3 pb-4" style={{ background: 'var(--bg-base)' }}>
      <div className="mb-5 animate-fade-in">
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>Bom dia,</p>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Ciclagem & Humor
        </h1>
      </div>

      {hasCheckin ? (
        <div className="rounded-[24px] p-5 mb-5 glass-card animate-fade-in delay-100"
          style={{ background: current.gradient }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{current.emoji}</span>
            <span className="text-[13px] font-bold uppercase tracking-widest" style={{ color: current.color }}>
              {current.label}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed mb-4" style={{ color: current.color, opacity: 0.85 }}>
            {current.analysis}
          </p>
          <div className="glass-strong rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Brain size={12} style={{ color: current.color }} />
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: current.color, opacity: 0.6 }}>Sugestão IA</p>
            </div>
            <p className="text-[13px] italic" style={{ color: current.color }}>"{current.recommendation}"</p>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-[24px] p-6 mb-5 flex flex-col items-center animate-fade-in delay-100">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(31,59,50,0.08)' }}>
            <Zap size={24} style={{ color: 'var(--accent-green)' }} />
          </div>
          <p className="text-center mb-4 text-[14px]" style={{ color: 'var(--text-muted)' }}>
            Ainda não sei como você está hoje.
          </p>
          <button
            onClick={() => navigate('checkin')}
            className="px-6 py-3 rounded-full flex items-center gap-2 text-white font-bold text-[14px] transition-all duration-200 active:scale-[0.97]"
            style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-md)' }}
          >
            <PlusCircle size={18} />
            Fazer Check-in
          </button>
        </div>
      )}

      {hasCheckin && (
        <button
          onClick={() => { setHasCheckin(false); navigate('checkin'); }}
          className="mb-4 font-semibold text-[13px] text-center transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent-green)' }}
        >
          Refazer check-in
        </button>
      )}

      <div className="grid grid-cols-3 gap-2.5 mb-5 animate-fade-in delay-200">
        <button
          onClick={() => navigate('journal')}
          className="glass-card p-3.5 rounded-[18px] flex flex-col items-center transition-all duration-200 active:scale-[0.97] hover:shadow-md"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5" style={{ background: 'rgba(139,92,246,0.1)' }}>
            <MessageCircle size={18} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <span className="font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>Diário</span>
          <span className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Falar com IA</span>
        </button>
        <button
          onClick={() => navigate('planner')}
          className="glass-card p-3.5 rounded-[18px] flex flex-col items-center transition-all duration-200 active:scale-[0.97] hover:shadow-md"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5" style={{ background: 'rgba(59,130,246,0.1)' }}>
            <Calendar size={18} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <span className="font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>Planner</span>
          <span className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Organizar dia</span>
        </button>
        <button
          onClick={() => navigate('insights')}
          className="glass-card p-3.5 rounded-[18px] flex flex-col items-center transition-all duration-200 active:scale-[0.97] hover:shadow-md"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <LineChart size={18} style={{ color: 'var(--cat-saude)' }} />
          </div>
          <span className="font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>Padrões</span>
          <span className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Ciclagem</span>
        </button>
      </div>

      <div className="mb-4 animate-fade-in delay-300">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Próximo na agenda
          </h2>
          <button onClick={() => navigate('planner')} className="flex items-center gap-1 text-[13px] font-semibold"
            style={{ color: 'var(--accent-green)' }}>
            Ver tudo <ArrowRight size={14} />
          </button>
        </div>

        {blocks.map((block, i) => (
          <div key={block.id} className={`flex items-center mb-2.5 glass-card p-3.5 rounded-[18px] animate-fade-in`}
            style={{ animationDelay: `${0.35 + i * 0.08}s`, borderLeft: `3px solid ${catColors[block.category] || 'var(--cat-rotina)'}` }}>
            <div className="w-12">
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>{block.startTime}</span>
            </div>
            <div className="flex-1 pl-3">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{block.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-medium capitalize" style={{ color: catColors[block.category] || 'var(--text-muted)' }}>{block.category}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>•</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {block.intensity === 'P' ? '🔴 Pesada' : block.intensity === 'M' ? '🟡 Média' : '🟢 Leve'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

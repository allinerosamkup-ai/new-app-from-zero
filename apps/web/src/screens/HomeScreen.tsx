import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Calendar, PlusCircle, Brain, Zap, LineChart, TrendingUp, ArrowRight } from 'lucide-react';
import { useNavigation } from '../navigation';

const WEEK_DATA = [
  { day: 'Seg', mood: 3, energy: 2, state: 'sensível' },
  { day: 'Ter', mood: 4, energy: 4, state: 'moderado' },
  { day: 'Qua', mood: 2, energy: 2, state: 'crítico' },
  { day: 'Qui', mood: 4, energy: 3, state: 'moderado' },
  { day: 'Sex', mood: 5, energy: 5, state: 'leve' },
  { day: 'Sáb', mood: 3, energy: 4, state: 'moderado' },
  { day: 'Hoj', mood: null, energy: null, state: null },
];

const STATE_COLOR: Record<string, string> = {
  leve:     '#96C7B3',
  moderado: '#F9B95C',
  sensível: '#D7897F',
  crítico:  '#E07070',
};

function MoodMiniChart() {
  const pathRef = useRef<SVGPathElement>(null);
  const W = 280, H = 80, PAD = 16;
  const cols = WEEK_DATA.length;
  const xStep = (W - PAD * 2) / (cols - 1);

  const pts = WEEK_DATA.map((d, i) => ({
    x: PAD + i * xStep,
    y: d.mood != null ? H - PAD - ((d.mood - 1) / 4) * (H - PAD * 2) : null,
    ...d,
  }));

  const validPts = pts.filter(p => p.y != null) as Array<{ x: number; y: number; day: string; mood: number; energy: number | null; state: string | null }>;
  let pathD = '';
  validPts.forEach((p, i) => {
    if (i === 0) { pathD += `M ${p.x} ${p.y}`; return; }
    const prev = validPts[i - 1];
    const cpX = (prev.x + p.x) / 2;
    pathD += ` C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
  });

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
      el.style.strokeDashoffset = '0';
    });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} />
          <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Humor da semana
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent-green)' }} />Humor</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 inline-block border-t-2 border-dashed" style={{ borderColor: 'var(--accent-teal)' }} />Energia</span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[1,2,3,4,5].map(v => {
          const y = H - PAD - ((v - 1) / 4) * (H - PAD * 2);
          return <line key={v} x1={PAD} y1={y} x2={W - PAD} y2={y}
            stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="3,3" />;
        })}

        {/* Energy line (dashed, teal) */}
        {(() => {
          const ePts = pts.filter(p => p.energy != null) as (typeof pts[0] & { energy: number })[];
          let ep = '';
          ePts.forEach((p, i) => {
            const ey = H - PAD - ((p.energy - 1) / 4) * (H - PAD * 2);
            if (i === 0) { ep += `M ${p.x} ${ey}`; return; }
            const prev = ePts[i - 1];
            const pey = H - PAD - ((prev.energy - 1) / 4) * (H - PAD * 2);
            const cpX = (prev.x + p.x) / 2;
            ep += ` C ${cpX} ${pey}, ${cpX} ${ey}, ${p.x} ${ey}`;
          });
          return <path d={ep} fill="none" stroke="var(--accent-teal)" strokeWidth="1.5"
            strokeDasharray="4,3" opacity="0.6" />;
        })()}

        {/* Mood gradient fill */}
        <defs>
          <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {pathD && <path d={`${pathD} L ${validPts[validPts.length-1].x} ${H} L ${validPts[0].x} ${H} Z`}
          fill="url(#moodGrad)" />}

        {/* Mood line animated */}
        {pathD && <path ref={pathRef} d={pathD} fill="none"
          stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Dots per day */}
        {pts.map((p, i) => (
          <g key={i}>
            {p.y != null && (
              <>
                <circle cx={p.x} cy={p.y} r="4" fill={p.state ? STATE_COLOR[p.state] : '#ccc'}
                  stroke="white" strokeWidth="1.5" />
                {i === cols - 2 && (
                  <circle cx={p.x} cy={p.y} r="7" fill="none"
                    stroke={p.state ? STATE_COLOR[p.state] : '#ccc'} strokeWidth="1.5" opacity="0.4">
                    <animate attributeName="r" values="7;11;7" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
              </>
            )}
            {p.y == null && (
              <circle cx={p.x} cy={H / 2} r="3" fill="none"
                stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeDasharray="2,2" />
            )}
            <text x={p.x} y={H + 2} textAnchor="middle" fontSize="9"
              fill="var(--text-muted)" fontWeight={i === cols - 1 ? '700' : '400'}>
              {p.day}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function HomeScreen() {
  const { navigate } = useNavigation();
  const [hasCheckin, setHasCheckin] = useState(false);
  const [checkinState, setCheckinState] = useState('moderado');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.state) setCheckinState(detail.state);
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

      {hasCheckin && (
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
      )}

      <div className="glass-card rounded-[20px] p-4 mb-4 animate-fade-in delay-100">
        <MoodMiniChart />
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {!hasCheckin ? (
            <button
              onClick={() => navigate('checkin')}
              className="flex-1 py-2.5 rounded-full flex items-center justify-center gap-2 text-white font-bold text-[13px] transition-all duration-200 active:scale-[0.97]"
              style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-sm)' }}
            >
              <PlusCircle size={16} />
              Fazer Check-in de hoje
            </button>
          ) : (
            <button
              onClick={() => { setHasCheckin(false); navigate('checkin'); }}
              className="flex-1 py-2.5 rounded-full font-semibold text-[13px] text-center transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}
            >
              Refazer check-in
            </button>
          )}
        </div>
      </div>

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

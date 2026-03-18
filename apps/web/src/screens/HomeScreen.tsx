import React, { useEffect, useRef } from 'react';
import { MessageCircle, Calendar, Brain, LineChart, TrendingUp, ArrowRight } from 'lucide-react';
import { useNavigation } from '../navigation';
import { useAuthStore } from '../stores/auth_store';
import { useCheckinStore, type DailyCheckinRow } from '../stores/checkin_store';
import { apiGet } from '../lib/api';

// Build an ordered array of the last 7 days (Mon→today)
function buildWeekDays() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: i === 0 ? 'Hoj' : ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()],
    });
  }
  return days;
}

const STATE_COLOR: Record<string, string> = {
  leve:     '#96C7B3',
  moderado: '#F9B95C',
  sensível: '#D7897F',
  crítico:  '#E07070',
};

function MoodMiniChart({ checkins }: { checkins: DailyCheckinRow[] }) {
  const pathRef = useRef<SVGPathElement>(null);
  const W = 280, H = 80, PAD = 16;
  const weekDays = buildWeekDays();
  const cols = weekDays.length;
  const xStep = (W - PAD * 2) / (cols - 1);

  const byDate = Object.fromEntries(checkins.map((c) => [c.local_date, c]));

  const pts = weekDays.map((d, i) => {
    const c = byDate[d.date];
    return {
      x: PAD + i * xStep,
      mood: c?.mood_score ?? null,
      energy: c?.energy_score ?? null,
      state: c?.state_label_type ?? null,
      label: d.label,
      isToday: i === cols - 1,
    };
  });

  const moodPts = pts.filter((p) => p.mood != null) as (typeof pts[0] & { mood: number })[];
  let pathD = '';
  moodPts.forEach((p, i) => {
    const y = H - PAD - ((p.mood - 1) / 4) * (H - PAD * 2);
    if (i === 0) { pathD += `M ${p.x} ${y}`; return; }
    const prev = moodPts[i - 1];
    const py = H - PAD - ((prev.mood - 1) / 4) * (H - PAD * 2);
    const cpX = (prev.x + p.x) / 2;
    pathD += ` C ${cpX} ${py}, ${cpX} ${y}, ${p.x} ${y}`;
  });

  useEffect(() => {
    const el = pathRef.current;
    if (!el || !pathD) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
      el.style.strokeDashoffset = '0';
    });
  }, [pathD]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} strokeWidth={1.5} style={{ color: 'var(--accent-green)' }} />
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
        {[1,2,3,4,5].map(v => {
          const y = H - PAD - ((v - 1) / 4) * (H - PAD * 2);
          return <line key={v} x1={PAD} y1={y} x2={W - PAD} y2={y}
            stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="3,3" />;
        })}

        {/* Energy dashed line */}
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
          return ep ? <path d={ep} fill="none" stroke="var(--accent-teal)" strokeWidth="1.5"
            strokeDasharray="4,3" opacity="0.6" /> : null;
        })()}

        <defs>
          <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {pathD && <path d={`${pathD} L ${moodPts[moodPts.length-1].x} ${H} L ${moodPts[0].x} ${H} Z`}
          fill="url(#moodGrad)" />}
        {pathD && <path ref={pathRef} d={pathD} fill="none"
          stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

        {pts.map((p, i) => {
          const y = p.mood != null ? H - PAD - ((p.mood - 1) / 4) * (H - PAD * 2) : null;
          const dotColor = p.state ? STATE_COLOR[p.state] : '#ccc';
          return (
            <g key={i}>
              {y != null ? (
                <>
                  <circle cx={p.x} cy={y} r="4" fill={dotColor} stroke="white" strokeWidth="1.5" />
                  {p.isToday && (
                    <circle cx={p.x} cy={y} r="7" fill="none" stroke={dotColor} strokeWidth="1.5" opacity="0.4">
                      <animate attributeName="r" values="7;11;7" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </>
              ) : (
                <circle cx={p.x} cy={H / 2} r="3" fill="none"
                  stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeDasharray="2,2" />
              )}
              <text x={p.x} y={H + 2} textAnchor="middle" fontSize="9"
                fill="var(--text-muted)" fontWeight={p.isToday ? '700' : '400'}>
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const stateData: Record<string, { label: string; emoji: string; analysis: string; recommendation: string; gradient: string; color: string }> = {
  leve: {
    label: 'Energia Leve',
    emoji: '🌱',
    analysis: 'Seu corpo e mente estão em ritmo tranquilo. Aproveite para atividades que pedem calma e atenção.',
    recommendation: 'Comece com tarefas leves e aumente o ritmo gradualmente.',
    gradient: 'linear-gradient(135deg, rgba(150,199,179,0.22), rgba(150,199,179,0.07))',
    color: '#3A7A66',
  },
  moderado: {
    label: 'Energia Radiante',
    emoji: '✨',
    analysis: 'Humor e energia em equilíbrio. Clareza mental acima da média — ótimo para tarefas que exigem foco.',
    recommendation: 'Aproveite o pico para suas tarefas mais importantes antes das 14h.',
    gradient: 'linear-gradient(135deg, rgba(249,185,92,0.22), rgba(249,185,92,0.07))',
    color: '#9A6010',
  },
  sensível: {
    label: 'Dia Sensível',
    emoji: '🌙',
    analysis: 'Hoje pode ser mais delicado. Sua energia pede cuidado extra e um ritmo mais gentil consigo.',
    recommendation: 'Priorize autocuidado e evite decisões importantes se possível.',
    gradient: 'linear-gradient(135deg, rgba(215,137,127,0.22), rgba(215,137,127,0.07))',
    color: '#A04840',
  },
  crítico: {
    label: 'Modo Recuperação',
    emoji: '🌊',
    analysis: 'Seus indicadores mostram que hoje é dia de descansar. Não force o ritmo.',
    recommendation: 'Cancele o que puder e foque apenas no essencial.',
    gradient: 'linear-gradient(135deg, rgba(224,112,112,0.22), rgba(224,112,112,0.07))',
    color: '#A03030',
  },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

export default function HomeScreen() {
  const { navigate } = useNavigation();
  const { userId, fullName } = useAuthStore();
  const { todayCheckin, recentCheckins, load } = useCheckinStore();

  const [nextBlock, setNextBlock] = React.useState<{ title: string; startTime: string; endTime: string; category: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    apiGet<any[]>(`/api/timeline/${dateStr}`)
      .then((blocks) => {
        const nowMin = today.getHours() * 60 + today.getMinutes();
        const upcoming = blocks
          .map((b) => {
            const [h, m] = b.startTime.split(':').map(Number);
            return { ...b, startMin: h * 60 + m };
          })
          .filter((b) => b.startMin >= nowMin)
          .sort((a, b) => a.startMin - b.startMin);
        setNextBlock(upcoming[0] ?? null);
      })
      .catch(() => setNextBlock(null));
  }, [userId]);

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  const stateKey = todayCheckin?.state_label_type ?? null;
  const current = stateKey ? stateData[stateKey] : null;

  // Use AI recommendation if available, else fallback
  const aiRec = stateKey && (todayCheckin?.ai_state as any)?.recommendations?.[0];

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 pt-3 pb-4" style={{ background: 'var(--bg-base)' }}>
      <div className="mb-5 animate-fade-in rounded-[20px] px-4 py-4" style={{ background: 'var(--accent-9)' }}>
        <p className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>{greeting()}</p>
        <h1 className="text-[22px] font-bold" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
          {fullName ? fullName.split(' ')[0] : 'Ciclagem & Humor'}
        </h1>
      </div>

      {current && (
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
              <Brain size={12} strokeWidth={1.5} style={{ color: current.color }} />
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: current.color, opacity: 0.6 }}>Sugestão IA</p>
            </div>
            <p className="text-[13px] italic" style={{ color: current.color }}>
              "{aiRec || current.recommendation}"
            </p>
          </div>
        </div>
      )}

      <div className="glass-card rounded-[20px] p-4 mb-4 animate-fade-in delay-100">
        <MoodMiniChart checkins={recentCheckins} />
        <div className="flex items-center justify-center mt-3 pt-3" style={{ borderTop: '1px solid rgba(215,137,127,0.12)' }}>
          {!todayCheckin ? (
            <button
              onClick={() => navigate('checkin')}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-semibold transition-all duration-200 active:scale-[0.97] hover:opacity-90"
              style={{
                background: 'rgba(215,137,127,0.13)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(215,137,127,0.28)',
                color: '#C4685E',
                boxShadow: '0 2px 8px rgba(215,137,127,0.15)',
              }}
            >
              <img
                src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Slightly%20smiling%20face/3D/slightly_smiling_face_3d.png"
                alt="" style={{ width: 22, height: 22, objectFit: 'contain' }}
              />
              Fazer check-in de hoje
            </button>
          ) : (
            <button
              onClick={() => navigate('checkin')}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-medium transition-all duration-200 hover:opacity-70"
              style={{
                background: 'rgba(150,199,179,0.12)',
                border: '1px solid rgba(150,199,179,0.3)',
                color: '#5A9E88',
              }}
            >
              Refazer check-in
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-5 animate-fade-in delay-200">
        <button
          onClick={() => navigate('journal')}
          className="glass-card interactive-card p-3.5 rounded-[18px] flex flex-col items-center transition-all duration-200 active:scale-[0.97] hover:shadow-md"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5" style={{ background: 'rgba(139,92,246,0.1)' }}>
            <MessageCircle size={18} strokeWidth={1.5} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <span className="font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>Diário</span>
          <span className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Falar com IA</span>
        </button>
        <button
          onClick={() => navigate('planner')}
          className="glass-card interactive-card p-3.5 rounded-[18px] flex flex-col items-center transition-all duration-200 active:scale-[0.97] hover:shadow-md"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5" style={{ background: 'rgba(59,130,246,0.1)' }}>
            <Calendar size={18} strokeWidth={1.5} style={{ color: 'var(--accent-teal)' }} />
          </div>
          <span className="font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>Planner</span>
          <span className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Organizar dia</span>
        </button>
        <button
          onClick={() => navigate('insights')}
          className="glass-card interactive-card p-3.5 rounded-[18px] flex flex-col items-center transition-all duration-200 active:scale-[0.97] hover:shadow-md"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <LineChart size={18} strokeWidth={1.5} style={{ color: 'var(--cat-saude)' }} />
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
            Ver tudo <ArrowRight size={14} strokeWidth={1.5} />
          </button>
        </div>
        {nextBlock ? (
          <button
            onClick={() => navigate('planner')}
            className="glass-card rounded-[18px] p-4 w-full text-left transition-all active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {nextBlock.startTime} — {nextBlock.endTime}
              </span>
              <ArrowRight size={14} strokeWidth={1.5} style={{ color: 'var(--accent-green)' }} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{nextBlock.title}</p>
          </button>
        ) : (
          <div className="glass-card rounded-[18px] p-4 text-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-[13px]">Nenhum bloco agendado para hoje.</p>
          </div>
        )}
      </div>
    </div>
  );
}

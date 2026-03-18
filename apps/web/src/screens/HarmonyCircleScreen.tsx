import React, { useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNavigation } from '../navigation';
import { useCheckinStore } from '../stores/checkin_store';
import { useAuthStore } from '../stores/auth_store';

const DIM_META = [
  { id: 'humor',   label: 'Humor',   color: '#96C7B3', emoji: '😊' },
  { id: 'energia', label: 'Energia', color: '#F9B95C', emoji: '⚡' },
  { id: 'foco',    label: 'Foco',    color: '#6398A9', emoji: '🎯' },
  { id: 'social',  label: 'Social',  color: '#D7897F', emoji: '👥' },
  { id: 'corpo',   label: 'Corpo',   color: '#96C7B3', emoji: '💪' },
  { id: 'calma',   label: 'Calma',   color: '#B8A0D7', emoji: '🌙' },
];

function avg(vals: number[]): number {
  if (!vals.length) return 50;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function RadarChart({ dims }: { dims: { value: number; color: string }[] }) {
  const cx = 140;
  const cy = 140;
  const maxR = 110;
  const levels = 5;
  const n = dims.length;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (index: number, value: number): [number, number] => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * maxR;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const gridLevels = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * maxR;
    return Array.from({ length: n }, (_, j) => {
      const angle = j * angleStep - Math.PI / 2;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
  });

  const dataPoints = dims.map((d, i) => getPoint(i, d.value));
  const dataPolygon = dataPoints.map((p) => p.join(',')).join(' ');
  const baselinePoints = dims.map((_, i) => getPoint(i, 50));
  const baselinePolygon = baselinePoints.map((p) => p.join(',')).join(' ');

  return (
    <svg viewBox="0 0 280 280" className="w-full max-w-[280px]">
      {gridLevels.map((points, i) => (
        <polygon key={i} points={points} fill="none" stroke="rgba(31,59,50,0.08)" strokeWidth="1" />
      ))}
      {dims.map((_, i) => {
        const [ex, ey] = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(31,59,50,0.06)" strokeWidth="1" />;
      })}
      <polygon points={baselinePolygon} fill="rgba(31,59,50,0.03)" stroke="rgba(31,59,50,0.12)" strokeWidth="1" strokeDasharray="4 2" />
      <polygon points={dataPolygon} fill="rgba(31,59,50,0.08)" stroke="var(--accent-green)" strokeWidth="2" style={{ transition: 'opacity 200ms ease' }} />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill={dims[i].color} stroke="white" strokeWidth="2" />
      ))}
      {DIM_META.map((d, i) => {
        const [lx, ly] = getPoint(i, 122);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize="12" fill="var(--text-secondary)">{d.emoji}</text>
        );
      })}
    </svg>
  );
}

export default function HarmonyCircleScreen() {
  const { navigate } = useNavigation();
  const { userId } = useAuthStore();
  const { recentCheckins: checkins, load } = useCheckinStore();

  useEffect(() => { if (userId) load(userId); }, [userId]);

  const dimensions = useMemo(() => {
    if (!checkins.length) return DIM_META.map((m) => ({ ...m, value: 50 }));
    const mood    = avg(checkins.map((c) => c.mood_score * 10));
    const energy  = avg(checkins.map((c) => c.energy_score * 10));
    const clarity = avg(checkins.map((c) => c.clarity_score * 10));
    const social  = avg(checkins.map((c) => c.social_score * 10));
    const physical = avg(checkins.map((c) => c.physical_score * 10));
    const calma   = avg(checkins.map((c) => (11 - c.irritability_score) * 10));
    return [
      { ...DIM_META[0], value: mood },
      { ...DIM_META[1], value: energy },
      { ...DIM_META[2], value: clarity },
      { ...DIM_META[3], value: social },
      { ...DIM_META[4], value: physical },
      { ...DIM_META[5], value: calma },
    ];
  }, [checkins]);

  const overallScore = Math.round(dimensions.reduce((a, d) => a + d.value, 0) / dimensions.length);
  const noData = !checkins.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center px-5 pt-2 pb-3">
        <button onClick={() => navigate('objectives')} className="btn-aura p-2 -ml-2 rounded-xl hover:bg-black/5">
          <ArrowLeft size={22} strokeWidth={1.5} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div className="ml-2">
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Círculo de Harmonia
          </h1>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {noData ? 'Faça check-ins para ver seus dados' : 'Médias dos últimos 7 dias'}
          </p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="glass-card rounded-[24px] p-5 flex flex-col items-center mb-4 animate-fade-in">
          <RadarChart dims={dimensions} />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[28px] font-bold" style={{ color: 'var(--accent-9)', fontFamily: 'var(--font-heading)' }}>
              {overallScore}%
            </span>
            <span className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>equilíbrio geral</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-[2px] rounded-full" style={{ background: 'var(--accent-green)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Atual</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-[2px] rounded-full opacity-40" style={{ background: 'rgba(31,59,50,0.5)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Linha base (50%)</span>
            </div>
          </div>
        </div>

        <h2 className="text-[14px] font-bold mb-3 animate-fade-in delay-100"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Detalhes por dimensão
        </h2>

        {dimensions.map((dim, i) => (
          <div key={dim.id} className="interactive-card glass-card rounded-[18px] p-3.5 mb-2.5 animate-fade-in"
            style={{ animationDelay: `${0.15 + i * 0.06}s` }}>
            <div className="flex items-center gap-3">
              <span className="text-xl">{dim.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{dim.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold" style={{ color: dim.color }}>{dim.value}%</span>
                    {dim.value > 60 && <TrendingUp size={12} strokeWidth={1.5} style={{ color: 'var(--cat-saude)' }} />}
                    {dim.value < 40 && <TrendingDown size={12} strokeWidth={1.5} style={{ color: 'var(--accent-rose)' }} />}
                    {dim.value >= 40 && dim.value <= 60 && <Minus size={12} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(31,59,50,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${dim.value}%`, background: dim.color }} />
                </div>
              </div>
            </div>
          </div>
        ))}

        {noData && (
          <div className="glass-card rounded-[18px] p-4 mt-2 text-center animate-fade-in delay-400">
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Faça pelo menos 1 check-in para ver seus dados reais aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

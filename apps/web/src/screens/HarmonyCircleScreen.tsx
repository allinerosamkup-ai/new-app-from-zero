import React from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNavigation } from '../navigation';

const DIMENSIONS = [
  { id: 'humor',   label: 'Humor',   value: 72, prev: 65, color: '#96C7B3', emoji: '😊' },
  { id: 'energia', label: 'Energia', value: 58, prev: 62, color: '#F9B95C', emoji: '⚡' },
  { id: 'sono',    label: 'Sono',    value: 80, prev: 70, color: '#6398A9', emoji: '🌙' },
  { id: 'foco',    label: 'Foco',    value: 45, prev: 50, color: '#6398A9', emoji: '🎯' },
  { id: 'social',  label: 'Social',  value: 60, prev: 55, color: '#D7897F', emoji: '👥' },
  { id: 'corpo',   label: 'Corpo',   value: 35, prev: 30, color: '#96C7B3', emoji: '💪' },
];

function RadarChart() {
  const cx = 140;
  const cy = 140;
  const maxR = 110;
  const levels = 5;
  const n = DIMENSIONS.length;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (index: number, value: number): [number, number] => {
    const angle = (index * angleStep) - Math.PI / 2;
    const r = (value / 100) * maxR;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const gridLevels = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * maxR;
    const points = Array.from({ length: n }, (_, j) => {
      const angle = (j * angleStep) - Math.PI / 2;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    });
    return points.join(' ');
  });

  const dataPoints = DIMENSIONS.map((d, i) => getPoint(i, d.value));
  const dataPolygon = dataPoints.map(p => p.join(',')).join(' ');

  const prevPoints = DIMENSIONS.map((d, i) => getPoint(i, d.prev));
  const prevPolygon = prevPoints.map(p => p.join(',')).join(' ');

  return (
    <svg viewBox="0 0 280 280" className="w-full max-w-[280px]">
      {gridLevels.map((points, i) => (
        <polygon key={i} points={points} fill="none" stroke="rgba(31,59,50,0.08)" strokeWidth="1" />
      ))}

      {DIMENSIONS.map((_, i) => {
        const [ex, ey] = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(31,59,50,0.06)" strokeWidth="1" />;
      })}

      <polygon points={prevPolygon} fill="rgba(31,59,50,0.04)" stroke="rgba(31,59,50,0.15)" strokeWidth="1" strokeDasharray="4 2" />

      <polygon points={dataPolygon} fill="rgba(31,59,50,0.08)" stroke="var(--accent-green)" strokeWidth="2" />

      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill={DIMENSIONS[i].color} stroke="white" strokeWidth="2" />
      ))}

      {DIMENSIONS.map((d, i) => {
        const [lx, ly] = getPoint(i, 120);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="600" fill="var(--text-secondary)">
            {d.emoji}
          </text>
        );
      })}
    </svg>
  );
}

export default function HarmonyCircleScreen() {
  const { navigate } = useNavigation();

  const overallScore = Math.round(DIMENSIONS.reduce((acc, d) => acc + d.value, 0) / DIMENSIONS.length);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center px-5 pt-2 pb-3">
        <button onClick={() => navigate('objectives')} className="p-2 -ml-2 rounded-xl hover:bg-black/5">
          <ArrowLeft size={22} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div className="ml-2">
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Círculo de Harmonia
          </h1>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Equilíbrio geral da sua ciclagem</p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="glass-card rounded-[24px] p-5 flex flex-col items-center mb-4 animate-fade-in">
          <RadarChart />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
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
              <div className="w-3 h-[2px] rounded-full" style={{ background: 'rgba(31,59,50,0.15)', borderStyle: 'dashed' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Semana passada</span>
            </div>
          </div>
        </div>

        <h2 className="text-[14px] font-bold mb-3 animate-fade-in delay-100"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Detalhes por dimensão
        </h2>

        {DIMENSIONS.map((dim, i) => {
          const diff = dim.value - dim.prev;
          const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
          return (
            <div key={dim.id} className="glass-card rounded-[18px] p-3.5 mb-2.5 animate-fade-in"
              style={{ animationDelay: `${0.15 + i * 0.06}s` }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{dim.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{dim.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold" style={{ color: dim.color }}>{dim.value}%</span>
                      {trend === 'up' && <TrendingUp size={12} style={{ color: 'var(--cat-saude)' }} />}
                      {trend === 'down' && <TrendingDown size={12} style={{ color: 'var(--accent-rose)' }} />}
                      {trend === 'same' && <Minus size={12} style={{ color: 'var(--text-muted)' }} />}
                      <span className="text-[10px] font-medium" style={{
                        color: diff > 0 ? 'var(--cat-saude)' : diff < 0 ? 'var(--accent-rose)' : 'var(--text-muted)',
                      }}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(31,59,50,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${dim.value}%`, background: dim.color }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="glass-card rounded-[22px] p-4 mt-3 animate-fade-in delay-400"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(45,212,191,0.05))' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent-purple)' }}>
            Análise da IA
          </p>
          <p className="text-[13px] leading-[20px] italic" style={{ color: 'var(--text-primary)' }}>
            "Seu sono melhorou significativamente (+10%), o que está impactando positivamente o humor. O foco caiu 5% — considere reduzir blocos longos de trabalho e usar o Pomodoro nos dias de energia baixa."
          </p>
        </div>
      </div>
    </div>
  );
}

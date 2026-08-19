import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Clock3, Sparkles, Star, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuraStore } from '../features/aura/store';
import type { Goal } from '../features/aura/types';
import { useLocalizedCopy } from '../i18n';
import { api } from '../lib/api';
import { tapHaptic } from '../utils/haptics';
import { useToast } from './Toast';

type PriorityItem = {
  objectiveId: string;
  objectiveTitle: string;
  actionId: string;
  actionTitle: string;
  reason: string;
  urgency?: 'low' | 'medium' | 'high';
  importance?: 'low' | 'medium' | 'high';
  scheduledFor?: string | null;
  deadline?: string | null;
};

type DailyReading = {
  status: 'ready' | 'retrying';
  focus: { objectiveId: string; source: 'manual' | 'airia'; reason: string | null } | null;
  priorities: PriorityItem[];
  canWait: PriorityItem[];
};

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DailyPrioritiesCards() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { showError } = useToast();
  const { state, toggleSubGoal } = useAuraStore();
  const [reading, setReading] = useState<DailyReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const goalVersionKey = useMemo(
    () => (state.goals ?? []).map((goal: Goal) => `${goal.id}:${goal.pathVersion ?? 1}:${goal.completedPct}`).join('|'),
    [state.goals],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/daily-priorities?localDate=${localDateKey()}`)
      .then((value) => { if (active) setReading(value as DailyReading); })
      .catch(() => { if (active) setReading(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [goalVersionKey]);

  const focusGoal = reading?.focus
    ? (state.goals ?? []).find((goal) => String(goal.id) === reading.focus!.objectiveId)
    : null;
  const focusAction = focusGoal?.subtasks.find((action) => !action.done && action.status !== 'rejected' && action.status !== 'deferred') ?? null;
  const focusMilestone = focusGoal?.milestones?.find((milestone) => milestone.id === focusAction?.milestoneId)
    ?? focusGoal?.milestones?.[0]
    ?? null;

  async function complete(item: PriorityItem) {
    if (completing) return;
    tapHaptic();
    setCompleting(item.actionId);
    try {
      await toggleSubGoal(item.objectiveId, item.actionId);
    } catch (error) {
      showError(error instanceof Error ? error.message : l('Não foi possível concluir esta ação.', 'Could not complete this action.'));
    } finally {
      setCompleting(null);
    }
  }

  if (!loading && !focusGoal && (state.goals ?? []).length === 0) {
    return (
      <section style={cardStyle}>
        <Target size={17} color="var(--accent-peach-ink)" />
        <h2 style={titleStyle}>{l('Escolha uma direção importante', 'Choose an important direction')}</h2>
        <p style={copyStyle}>{l('A Airia transforma o objetivo em etapas e mostra só o movimento que cabe agora.', 'Airia turns the goal into stages and shows only the move that fits now.')}</p>
        <button type="button" onClick={() => navigate('/goals')} style={primaryButtonStyle}>
          {l('Criar objetivo', 'Create goal')} <ArrowRight size={16} />
        </button>
      </section>
    );
  }

  return (
    <>
      <section style={cardStyle} aria-busy={loading}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {reading?.focus?.source === 'manual' ? <Star size={16} fill="currentColor" color="var(--accent-peach-ink)" /> : <Sparkles size={16} color="var(--accent-peach-ink)" />}
          <span style={eyebrowStyle}>{l('Objetivo em foco', 'Goal in focus')}</span>
          {reading?.focus?.source === 'airia' && <span style={suggestedBadge}>{l('Sugerido pela Airia', 'Suggested by Airia')}</span>}
        </header>

        {focusGoal ? (
          <>
            <h2 style={{ ...titleStyle, fontSize: 18 }}>{focusGoal.title}</h2>
            {focusGoal.resultDefinition && <p style={copyStyle}><strong>{l('Resultado:', 'Outcome:')}</strong> {focusGoal.resultDefinition}</p>}
            <div style={progressTrack}><div style={{ ...progressFill, width: `${Math.max(0, Math.min(100, focusGoal.completedPct))}%` }} /></div>
            {focusMilestone && <p style={{ ...eyebrowStyle, margin: '14px 0 5px' }}>{l('Etapa atual', 'Current stage')} · {focusMilestone.title}</p>}
            {focusAction && (
              <button type="button" onClick={() => complete({ objectiveId: String(focusGoal.id), objectiveTitle: focusGoal.title, actionId: String(focusAction.id), actionTitle: focusAction.title, reason: '' })} disabled={Boolean(completing)} style={actionButtonStyle}>
                <Check size={16} /> <span>{focusAction.title}</span>
              </button>
            )}
            {reading?.focus?.reason && <p style={{ ...copyStyle, marginTop: 9, fontSize: 11 }}>{reading.focus.reason}</p>}
          </>
        ) : (
          <p style={copyStyle}>{loading ? l('Lendo o contexto do seu dia…', 'Reading today’s context…') : l('A Airia ainda não tem uma direção segura para sugerir.', 'Airia does not yet have a safe direction to suggest.')}</p>
        )}
      </section>

      <section style={{ ...cardStyle, marginTop: 12 }} aria-busy={loading}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Clock3 size={16} color="var(--accent-peach-ink)" />
          <h2 style={{ ...titleStyle, margin: 0, fontSize: 15 }}>{l('Prioridades do dia', 'Daily priorities')}</h2>
        </header>
        <p style={{ ...copyStyle, fontSize: 11 }}>{l('O que merece entrar hoje, sem apagar o que é importante no longo prazo.', 'What deserves today, without hiding long-term importance.')}</p>

        {reading?.priorities.length ? (
          <PriorityGroup title={l('Prioridades de hoje', 'Today’s priorities')} items={reading.priorities} completing={completing} onComplete={complete} />
        ) : (
          <p style={{ ...copyStyle, marginTop: 12 }}>{reading?.status === 'retrying' ? l('A Airia está refazendo a leitura — nenhuma ordem genérica será exibida.', 'Airia is retrying the reading—no generic order will be shown.') : l('Nenhuma prioridade segura para mostrar agora.', 'No safe priority to show right now.')}</p>
        )}

        {Boolean(reading?.canWait.length) && <PriorityGroup title={l('Pode esperar', 'Can wait')} items={reading!.canWait} completing={completing} onComplete={complete} muted />}
        <button type="button" onClick={() => navigate('/goals')} style={quietButtonStyle}>{l('Ver caminhos dos objetivos', 'View goal paths')}</button>
      </section>
    </>
  );
}

function PriorityGroup({ title, items, completing, onComplete, muted = false }: {
  title: string; items: PriorityItem[]; completing: string | null; onComplete: (item: PriorityItem) => Promise<void>; muted?: boolean;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ ...eyebrowStyle, margin: '0 0 8px' }}>{title}</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item) => (
          <div key={`${item.objectiveId}:${item.actionId}`} style={{ padding: '10px 11px', borderRadius: 14, border: '1px solid rgba(17,24,39,.06)', background: muted ? 'rgba(255,255,255,.38)' : 'rgba(255,255,255,.68)', opacity: muted ? .78 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              {!muted && <button type="button" aria-label={`Concluir ${item.actionTitle}`} disabled={Boolean(completing)} onClick={() => onComplete(item)} style={checkButtonStyle}><Check size={13} /></button>}
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', color: 'var(--text-1)', fontSize: 13, lineHeight: 1.35 }}>{item.actionTitle}</strong>
                <span style={{ display: 'block', marginTop: 2, color: 'var(--text-3)', fontSize: 10 }}>{item.objectiveTitle}</span>
                <span style={{ display: 'block', marginTop: 5, color: 'var(--text-2)', fontSize: 11, lineHeight: 1.4 }}>{item.reason}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const cardStyle = { padding: '16px 16px 18px', borderRadius: 22, background: 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.84)', boxShadow: '0 12px 28px rgba(169,210,187,.08)' } as const;
const titleStyle = { margin: '0 0 7px', fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: 'var(--text-1)' } as const;
const copyStyle = { margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' } as const;
const eyebrowStyle = { fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-3)' } as const;
const suggestedBadge = { marginLeft: 'auto', padding: '4px 7px', borderRadius: 999, background: 'rgba(169,210,187,.16)', color: 'var(--text-2)', fontSize: 9, fontWeight: 800 } as const;
const progressTrack = { height: 6, borderRadius: 999, background: 'rgba(169,210,187,.20)', overflow: 'hidden' } as const;
const progressFill = { height: '100%', borderRadius: 999, background: 'var(--accent-primary-strong, #8FC0A4)', transition: 'width .3s ease' } as const;
const actionButtonStyle = { width: '100%', minHeight: 46, marginTop: 11, border: 0, borderRadius: 14, background: 'rgba(169,210,187,.18)', color: 'var(--text-1)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', fontSize: 13, fontWeight: 750, cursor: 'pointer' } as const;
const primaryButtonStyle = { width: '100%', minHeight: 46, border: 0, borderRadius: 999, background: 'var(--accent-primary-strong, #8FC0A4)', color: '#2C5340', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer' } as const;
const quietButtonStyle = { width: '100%', minHeight: 40, marginTop: 12, borderRadius: 999, border: '1px solid rgba(17,24,39,.08)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' } as const;
const checkButtonStyle = { width: 25, height: 25, flexShrink: 0, borderRadius: 9, border: '1.5px solid var(--accent-primary-strong, #8FC0A4)', background: 'transparent', color: 'var(--accent-primary-strong, #8FC0A4)', display: 'grid', placeItems: 'center', cursor: 'pointer' } as const;

import { useMemo, useState } from 'react';
import { CalendarClock, LockKeyhole, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { buildRoutinePreviewSections, groupPlanByDay } from './helpers';
import type { RoutinePlan, RoutinePlanEntry } from './types';

type PreviewTab = 'today' | 'week' | 'habits' | 'objectives';

function EntryList({ entries }: { entries: RoutinePlanEntry[] }) {
  const { t } = useTranslation();
  if (entries.length === 0) {
    return <p className="routine-preview-empty">{t('routineBuilder.previewEmpty', { defaultValue: 'Nada foi colocado aqui. Você pode voltar e ajustar antes de usar a rotina.' })}</p>;
  }

  return (
    <div className="routine-preview-list">
      {entries.map((entry) => (
        <article key={entry.id} className={`routine-slot${entry.persist ? '' : ' is-existing'}`}>
          <time>{entry.startTime}</time>
          <div>
            <strong>{entry.title}</strong>
            <p>{entry.reason}</p>
          </div>
          {entry.isFixed
            ? <LockKeyhole size={15} aria-label={t('routineBuilder.protected')} />
            : <CalendarClock size={15} />}
        </article>
      ))}
    </div>
  );
}

export function WeekPreview({ plan, locale, today }: { plan: RoutinePlan; locale: string; today: string }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PreviewTab>('today');
  const sections = useMemo(() => buildRoutinePreviewSections(plan, today), [plan, today]);
  const groups = useMemo(() => groupPlanByDay(sections.week), [sections.week]);
  const overloadedDays = plan.days.filter((day) => day.status === 'overloaded');
  const highestLoad = plan.days.reduce((highest, day) => Math.max(highest, day.utilizationPercent ?? 0), 0);
  const tabs: Array<{ id: PreviewTab; label: string; count: number }> = [
    { id: 'today', label: t('routineBuilder.previewTabs.today', { defaultValue: 'Hoje' }), count: sections.today.length },
    { id: 'week', label: t('routineBuilder.previewTabs.week', { defaultValue: 'Semana' }), count: sections.week.length },
    { id: 'habits', label: t('routineBuilder.previewTabs.habits', { defaultValue: 'Hábitos' }), count: sections.habits.length },
    { id: 'objectives', label: t('routineBuilder.previewTabs.objectives', { defaultValue: 'Objetivos' }), count: sections.objectives.length },
  ];

  return (
    <div className="routine-week">
      <div className={`routine-capacity routine-capacity--${plan.capacity.level}`}>
        <span>{t('routineBuilder.rhythm')}</span>
        <strong>{plan.capacity.reason}</strong>
        <small>
          {overloadedDays.length > 0
            ? t('routineBuilder.loadOver', { defaultValue: '{{count}} dia(s) acima da carga prevista — revise antes de confirmar.', count: overloadedDays.length })
            : t('routineBuilder.loadSafe', { defaultValue: 'Maior carga diária: {{percent}}% do limite previsto.', percent: highestLoad })}
        </small>
      </div>

      <div className="routine-preview-tabs" role="tablist" aria-label={t('routineBuilder.previewTitle')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}<span>{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'today' && <EntryList entries={sections.today} />}
      {activeTab === 'habits' && <EntryList entries={sections.habits} />}
      {activeTab === 'objectives' && (
        sections.objectives.length > 0
          ? <div className="routine-objective-list">
              {sections.objectives.map((item) => (
                <article key={item.sourceItemId}>
                  <Target size={16} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{t('routineBuilder.objectiveWillStayActive', { defaultValue: 'Fica como direção ativa; as ações concretas entram na agenda.' })}</p>
                  </div>
                </article>
              ))}
            </div>
          : <p className="routine-preview-empty">{t('routineBuilder.noObjectives', { defaultValue: 'Nenhum objetivo será criado nesta rotina.' })}</p>
      )}
      {activeTab === 'week' && groups.map((group) => (
          <section key={group.date} className="routine-day">
            <header>
              <span>{new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(`${group.date}T12:00:00`))}</span>
              <strong>{new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(`${group.date}T12:00:00`))}</strong>
            </header>
            <div className="routine-day__line" />
            <EntryList entries={group.entries} />
          </section>
        ))}
      {plan.unscheduled.length > 0 && (
        <section className="routine-unscheduled">
          <strong>{t('routineBuilder.outsideWeek')}</strong>
          {plan.unscheduled.map((item) => (
            <div key={`${item.sourceItemId}:${item.title}`}>
              <p>{item.title} — {item.reason}</p>
              {item.alternatives?.length > 0 && (
                <ul>
                  {item.alternatives.map((alternative) => (
                    <li key={`${item.sourceItemId}:${alternative.action}`}>{alternative.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

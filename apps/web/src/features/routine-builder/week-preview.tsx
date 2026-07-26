import { useMemo, useState } from 'react';
import { CalendarClock, LockKeyhole, Pencil, Target, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { buildRoutinePreviewSections, groupPlanByDay } from './helpers';
import type { RoutinePlan, RoutinePlanEntry } from './types';

type PreviewTab = 'today' | 'week' | 'habits' | 'objectives';

function EntryList({
  entries,
  onEdit,
}: {
  entries: RoutinePlanEntry[];
  onEdit?: (entry: RoutinePlanEntry) => void;
}) {
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
            : entry.persist && entry.sourceItemId && onEdit
              ? (
                  <button
                    type="button"
                    className="routine-icon-button"
                    aria-label={t('routineBuilder.editPreview', { defaultValue: 'Editar este bloco' })}
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil size={15} />
                  </button>
                )
              : <CalendarClock size={15} />}
        </article>
      ))}
    </div>
  );
}

export function WeekPreview({
  plan,
  locale,
  today,
  saving = false,
  onEditEntry,
}: {
  plan: RoutinePlan;
  locale: string;
  today: string;
  saving?: boolean;
  onEditEntry?: (
    entry: RoutinePlanEntry,
    patch: { date?: string; startTime?: string; durationMinutes?: number; excluded?: boolean },
  ) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PreviewTab>('today');
  const [editing, setEditing] = useState<RoutinePlanEntry | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(30);
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

  function openEditor(entry: RoutinePlanEntry) {
    setEditing(entry);
    setEditDate(entry.date);
    setEditTime(entry.startTime);
    setEditDuration(entry.durationMinutes);
  }

  async function saveEditor(excluded = false) {
    if (!editing || !onEditEntry) return;
    await onEditEntry(editing, excluded
      ? { excluded: true }
      : { date: editDate, startTime: editTime, durationMinutes: editDuration });
    setEditing(null);
  }

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

      {activeTab === 'today' && <EntryList entries={sections.today} onEdit={onEditEntry ? openEditor : undefined} />}
      {activeTab === 'habits' && <EntryList entries={sections.habits} onEdit={onEditEntry ? openEditor : undefined} />}
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
            <EntryList entries={group.entries} onEdit={onEditEntry ? openEditor : undefined} />
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
                    <li key={`${item.sourceItemId}:${alternative.action}`}>
                      <span>{alternative.reason}</span>
                      {onEditEntry && (alternative.suggestedDate || alternative.suggestedStartTime || alternative.durationMinutes) && (
                        <button
                          type="button"
                          className="routine-secondary"
                          disabled={saving}
                          onClick={() => {
                            const sourceEntry = plan.entries.find((entry) => entry.sourceItemId === item.sourceItemId) ?? {
                              id: `unscheduled:${item.sourceItemId}`,
                              sourceItemId: item.sourceItemId,
                              kind: 'task',
                              date: alternative.suggestedDate ?? plan.weekStart,
                              startTime: alternative.suggestedStartTime ?? '09:00',
                              endTime: alternative.suggestedStartTime ?? '09:30',
                              title: item.title,
                              durationMinutes: alternative.durationMinutes ?? 30,
                              isFixed: false,
                              persist: true,
                              reason: alternative.reason,
                            } as RoutinePlanEntry;
                            void onEditEntry(sourceEntry, {
                              date: alternative.suggestedDate,
                              startTime: alternative.suggestedStartTime,
                              durationMinutes: alternative.durationMinutes,
                            });
                          }}
                        >
                          {t('routineBuilder.useAlternative', { defaultValue: 'Usar esta opção' })}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {editing && (
        <section className="routine-preview-editor" aria-label={t('routineBuilder.editPreview', { defaultValue: 'Editar bloco da rotina' })}>
          <strong>{editing.title}</strong>
          <div className="routine-preview-editor__fields">
            <label>
              {t('routineBuilder.date', { defaultValue: 'Dia' })}
              <input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
            </label>
            <label>
              {t('routineBuilder.time', { defaultValue: 'Horário' })}
              <input type="time" value={editTime} onChange={(event) => setEditTime(event.target.value)} />
            </label>
            <label>
              {t('routineBuilder.duration', { defaultValue: 'Duração' })}
              <select value={editDuration} onChange={(event) => setEditDuration(Number(event.target.value))}>
                {[10, 15, 20, 30, 45, 60, 90, 120].map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} min</option>
                ))}
              </select>
            </label>
          </div>
          <div className="routine-actions">
            <button type="button" className="routine-secondary" disabled={saving} onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="routine-secondary" disabled={saving} onClick={() => void saveEditor(true)}>
              <Trash2 size={15} /> {t('routineBuilder.removeFromPlan', { defaultValue: 'Tirar da rotina' })}
            </button>
            <button type="button" className="routine-primary" disabled={saving || !editDate || !editTime} onClick={() => void saveEditor(false)}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Check, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  buildRoutineSuggestionCards,
  resolveRoutineSuggestionCardState,
} from './helpers';
import { RoutineSuggestionCardView } from './routine-suggestion-card';
import type { RoutineItem, RoutinePlan, RoutineSuggestionCard } from './types';

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function WeekPreview({
  plan,
  items,
  appliedSourceItemIds,
  savingSourceItemIds,
  locale,
  saving = false,
  onAddCard,
  onEditItem,
  onToggleDiscard,
}: {
  plan: RoutinePlan;
  items: RoutineItem[];
  appliedSourceItemIds: string[];
  savingSourceItemIds: ReadonlySet<string>;
  locale: string;
  saving?: boolean;
  onAddCard: (sourceItemId: string) => Promise<void> | void;
  onEditItem: (
    sourceItemId: string,
    patch: {
      title?: string;
      kind?: RoutineItem['kind'];
      date?: string;
      startTime?: string;
      durationMinutes?: number;
      recurrence?: RoutineItem['recurrence'];
    },
  ) => Promise<void> | void;
  onToggleDiscard: (sourceItemId: string, discarded: boolean) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<RoutineSuggestionCard | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editKind, setEditKind] = useState<RoutineItem['kind']>('task');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editFrequency, setEditFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [editDays, setEditDays] = useState<number[]>([]);
  const cards = useMemo(() => buildRoutineSuggestionCards({
    items,
    plan,
    appliedSourceItemIds,
  }), [appliedSourceItemIds, items, plan]);
  const overloadedDays = plan.days.filter((day) => day.status === 'overloaded');
  const highestLoad = plan.days.reduce((highest, day) => Math.max(highest, day.utilizationPercent ?? 0), 0);
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short' }), [locale]);

  function openEditor(card: RoutineSuggestionCard) {
    setEditing(card);
    setEditTitle(card.title);
    setEditKind(card.kind);
    setEditDate(card.firstOccurrence?.date ?? '');
    setEditTime(card.firstOccurrence?.startTime ?? '');
    setEditDuration(card.firstOccurrence?.durationMinutes ?? 30);
    setEditFrequency(card.recurrence?.frequency ?? 'weekly');
    setEditDays(card.recurrence?.daysOfWeek ?? []);
  }

  async function saveEditor() {
    if (!editing) return;
    await onEditItem(editing.sourceItemId, {
      title: editTitle,
      kind: editKind,
      ...(editDate ? { date: editDate } : {}),
      ...(editTime ? { startTime: editTime } : {}),
      durationMinutes: editDuration,
      recurrence: editKind === 'habit'
        ? {
            frequency: editFrequency,
            daysOfWeek: editFrequency === 'weekly' ? editDays : [],
            timesPerWeek: editFrequency === 'weekly' && editDays.length > 0 ? editDays.length : null,
            interval: 1,
          }
        : null,
    });
    setEditing(null);
  }

  return (
    <div className="routine-week">
      <section className={`routine-capacity routine-capacity--${plan.capacity.level}`}>
        <div className="routine-capacity__spark"><Sparkles size={17} /></div>
        <div>
          <span>{t('routineBuilder.rhythm')}</span>
          <strong>{plan.capacity.reason}</strong>
          <small>
            {overloadedDays.length > 0
              ? t('routineBuilder.loadOver', {
                  defaultValue: '{{count}} dia(s) acima da carga prevista — ajuste os cards antes de adicionar.',
                  count: overloadedDays.length,
                })
              : t('routineBuilder.loadSafe', {
                  defaultValue: 'Maior carga diária: {{percent}}% do limite previsto.',
                  percent: highestLoad,
                })}
          </small>
        </div>
      </section>

      <div className="routine-suggestion-list">
        {cards.map((card) => {
          const visualState = resolveRoutineSuggestionCardState(card, savingSourceItemIds);
          const canEdit = Boolean(card.firstOccurrence || card.kind === 'habit');
          return (
            <RoutineSuggestionCardView
              key={card.sourceItemId}
              card={card}
              visualState={visualState}
              locale={locale}
              disabled={saving}
              onAdd={() => onAddCard(card.sourceItemId)}
              onEdit={canEdit ? () => openEditor(card) : undefined}
              onToggleDiscard={() => onToggleDiscard(card.sourceItemId, card.state !== 'discarded')}
            />
          );
        })}
      </div>

      {plan.unscheduled.length > 0 && (
        <section className="routine-unscheduled">
          <strong>{t('routineBuilder.outsideWeek')}</strong>
          {plan.unscheduled.map((item) => (
            <p key={`${item.sourceItemId}:${item.title}`}>{item.title} — {item.reason}</p>
          ))}
        </section>
      )}

      {editing && (
        <div className="routine-editor-backdrop" role="presentation" onClick={() => setEditing(null)}>
          <section
            className="routine-preview-editor"
            role="dialog"
            aria-modal="true"
            aria-label={t('routineBuilder.editPreview')}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>{t('routineBuilder.cardEdit', { defaultValue: 'Editar' })}</span>
                <strong>{editing.title}</strong>
              </div>
              <button type="button" className="routine-icon-button" onClick={() => setEditing(null)} aria-label={t('common.close')}>
                <X size={17} />
              </button>
            </header>

            <div className="routine-preview-editor__fields">
              <label className="routine-editor-field--wide">
                {t('routineBuilder.cardTitle', { defaultValue: 'Nome' })}
                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
              </label>
              <label>
                {t('routineBuilder.itemType')}
                <select value={editKind} onChange={(event) => setEditKind(event.target.value as RoutineItem['kind'])}>
                  {(['task', 'habit', 'goal', 'project', 'calendar'] as const).map((kind) => (
                    <option key={kind} value={kind}>{t(`routineBuilder.kinds.${kind}`)}</option>
                  ))}
                </select>
              </label>
              {editing.firstOccurrence && (
                <>
                  <label>
                    {t('routineBuilder.date')}
                    <input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
                  </label>
                  <label>
                    {t('routineBuilder.time')}
                    <input type="time" value={editTime} onChange={(event) => setEditTime(event.target.value)} />
                  </label>
                </>
              )}
              <label>
                {t('routineBuilder.duration')}
                <select value={editDuration} onChange={(event) => setEditDuration(Number(event.target.value))}>
                  {[10, 15, 20, 30, 45, 60, 90, 120].map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes} min</option>
                  ))}
                </select>
              </label>
              {editKind === 'habit' && (
                <label>
                  {t('routineBuilder.cardFrequency', { defaultValue: 'Frequência' })}
                  <select value={editFrequency} onChange={(event) => setEditFrequency(event.target.value as typeof editFrequency)}>
                    <option value="daily">{t('routineBuilder.cardEveryDay', { defaultValue: 'Todos os dias' })}</option>
                    <option value="weekly">{t('routineBuilder.cardEveryWeek', { defaultValue: 'Toda semana' })}</option>
                    <option value="monthly">{t('routineBuilder.cardEveryMonth', { defaultValue: 'Todo mês' })}</option>
                  </select>
                </label>
              )}
            </div>

            {editKind === 'habit' && editFrequency === 'weekly' && (
              <div className="routine-day-picker" aria-label={t('routineBuilder.cardChooseDays', { defaultValue: 'Escolha os dias' })}>
                {WEEK_DAYS.map((day) => {
                  const date = new Date('2026-07-26T12:00:00');
                  date.setDate(date.getDate() + day);
                  const selected = editDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      onClick={() => setEditDays((current) => (
                        selected ? current.filter((value) => value !== day) : [...current, day].sort()
                      ))}
                    >
                      {formatter.format(date).slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="routine-primary"
              disabled={saving || !editTitle.trim() || (editKind === 'habit' && editFrequency === 'weekly' && editDays.length === 0)}
              onClick={() => void saveEditor()}
            >
              {saving ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
              {t('common.save')}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

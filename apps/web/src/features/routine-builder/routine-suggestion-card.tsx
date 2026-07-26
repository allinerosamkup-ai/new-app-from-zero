import {
  CalendarPlus,
  Check,
  CircleAlert,
  Clock3,
  ListChecks,
  LoaderCircle,
  Pencil,
  Repeat2,
  RotateCcw,
  Target,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { RoutineSuggestionCard, RoutineSuggestionCardState } from './types';

type VisualState = RoutineSuggestionCardState | 'saving';

function kindIcon(kind: RoutineSuggestionCard['kind']) {
  if (kind === 'goal' || kind === 'project') return <Target size={20} />;
  if (kind === 'habit') return <Repeat2 size={20} />;
  if (kind === 'calendar') return <CalendarPlus size={20} />;
  return <ListChecks size={20} />;
}

function formatRecurrence(
  card: RoutineSuggestionCard,
  locale: string,
  t: ReturnType<typeof useTranslation>['t'],
): string | null {
  const recurrence = card.recurrence;
  if (!recurrence) return null;
  if (recurrence.frequency === 'daily') {
    return t('routineBuilder.cardEveryDay', { defaultValue: 'Todos os dias' });
  }
  if (recurrence.frequency === 'monthly') {
    return t('routineBuilder.cardEveryMonth', { defaultValue: 'Todo mês' });
  }
  const days = recurrence.daysOfWeek ?? [];
  if (days.length > 0) {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const labels = days.map((day) => {
      const sunday = new Date('2026-07-26T12:00:00');
      sunday.setDate(sunday.getDate() + day);
      return formatter.format(sunday).replace('.', '');
    });
    return t('routineBuilder.cardEveryWeekOn', {
      defaultValue: 'Todas as semanas em {{days}}',
      days: labels.join(', '),
    });
  }
  if (recurrence.timesPerWeek) {
    return t('routineBuilder.cardTimesPerWeek', {
      defaultValue: '{{count}} vezes por semana',
      count: recurrence.timesPerWeek,
    });
  }
  return t('routineBuilder.cardEveryWeek', { defaultValue: 'Toda semana' });
}

export function RoutineSuggestionCardView({
  card,
  visualState,
  locale,
  disabled = false,
  onAdd,
  onEdit,
  onToggleDiscard,
}: {
  card: RoutineSuggestionCard;
  visualState: VisualState;
  locale: string;
  disabled?: boolean;
  onAdd: () => void;
  onEdit?: () => void;
  onToggleDiscard: () => void;
}) {
  const { t } = useTranslation();
  const recurrence = formatRecurrence(card, locale, t);
  const occurrence = card.firstOccurrence;
  const date = occurrence
    ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(new Date(`${occurrence.date}T12:00:00`))
    : null;
  const locked = disabled || visualState === 'saving' || visualState === 'added';
  const discarded = visualState === 'discarded';
  const needsAdjustment = visualState === 'needs_adjustment';

  return (
    <article className={`routine-suggestion-card is-${visualState}`}>
      <div className="routine-suggestion-card__badge">
        {visualState === 'added'
          ? <><Check size={13} /> {t('routineBuilder.cardAdded', { defaultValue: 'Adicionado' })}</>
          : needsAdjustment
            ? <><CircleAlert size={13} /> {t('routineBuilder.cardNeedsAdjustment', { defaultValue: 'Ajustar' })}</>
            : <><span>✦</span> {t('routineBuilder.cardCreate', { defaultValue: 'Criar' })}</>}
      </div>

      <div className="routine-suggestion-card__meta">
        {occurrence && (
          <>
            <span>{date}</span>
            <span>{occurrence.startTime}–{occurrence.endTime}</span>
            <span>{occurrence.durationMinutes} min</span>
          </>
        )}
        {!occurrence && (
          <span>{t(`routineBuilder.kinds.${card.kind}`)}</span>
        )}
      </div>

      <div className="routine-suggestion-card__main">
        <div className="routine-suggestion-card__icon">{kindIcon(card.kind)}</div>
        <div>
          <h3>{card.title}</h3>
          {recurrence && <p className="routine-suggestion-card__recurrence"><Repeat2 size={14} /> {recurrence}</p>}
          {!recurrence && occurrence && (
            <p className="routine-suggestion-card__recurrence"><Clock3 size={14} /> {t('routineBuilder.cardOneOccurrence', { defaultValue: 'Uma ocorrência planejada' })}</p>
          )}
        </div>
        <span className="routine-suggestion-card__status-mark" aria-hidden="true">
          {visualState === 'saving'
            ? <LoaderCircle size={22} className="spin" />
            : visualState === 'added'
              ? <Check size={22} />
              : null}
        </span>
      </div>

      <p className="routine-suggestion-card__reason">{card.reason}</p>

      <div className="routine-suggestion-card__actions">
        <button
          type="button"
          className="routine-card-action is-add"
          disabled={locked || discarded || needsAdjustment}
          onClick={onAdd}
        >
          {visualState === 'saving'
            ? <LoaderCircle size={16} className="spin" />
            : visualState === 'added'
              ? <Check size={16} />
              : <CalendarPlus size={16} />}
          {visualState === 'saving'
            ? t('routineBuilder.cardSaving', { defaultValue: 'Salvando' })
            : visualState === 'added'
              ? t('routineBuilder.cardAdded', { defaultValue: 'Adicionado' })
              : t('routineBuilder.cardAdd', { defaultValue: 'Adicionar' })}
        </button>
        <button
          type="button"
          className="routine-card-action"
          disabled={locked || discarded || !onEdit}
          onClick={onEdit}
        >
          <Pencil size={16} /> {t('routineBuilder.cardEdit', { defaultValue: 'Editar' })}
        </button>
        <button
          type="button"
          className="routine-card-action"
          disabled={locked}
          onClick={onToggleDiscard}
        >
          {discarded ? <RotateCcw size={16} /> : <X size={16} />}
          {discarded
            ? t('routineBuilder.cardRestore', { defaultValue: 'Restaurar' })
            : t('routineBuilder.cardDiscard', { defaultValue: 'Descartar' })}
        </button>
      </div>
    </article>
  );
}

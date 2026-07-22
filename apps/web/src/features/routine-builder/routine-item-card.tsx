import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { RoutineItem, RoutineItemKind } from './types';

const KINDS: RoutineItemKind[] = ['goal', 'project', 'task', 'habit', 'calendar', 'reference', 'concern'];

export function RoutineItemCard({
  item,
  labels,
  onChange,
}: {
  item: RoutineItem;
  labels: Record<RoutineItemKind, string>;
  onChange: (next: RoutineItem) => void;
}) {
  const { t } = useTranslation();
  const excluded = item.reviewState === 'excluded';
  return (
    <article className={`routine-item-card${excluded ? ' is-excluded' : ''}`}>
      <div className="routine-item-card__top">
        <select
          aria-label={t('routineBuilder.itemType')}
          value={item.kind}
          disabled={excluded}
          onChange={(event) => onChange({ ...item, kind: event.target.value as RoutineItemKind })}
        >
          {KINDS.map((kind) => <option key={kind} value={kind}>{labels[kind]}</option>)}
        </select>
        <button
          type="button"
          className="routine-icon-button"
          aria-label={excluded ? t('routineBuilder.restore') : t('routineBuilder.exclude')}
          onClick={() => onChange({ ...item, reviewState: excluded ? 'pending' : 'excluded' })}
        >
          {excluded ? <Check size={16} /> : <X size={16} />}
        </button>
      </div>
      <input
        className="routine-title-input"
        value={item.title}
        disabled={excluded}
        onChange={(event) => onChange({ ...item, title: event.target.value })}
      />
      <p>{item.sourceExcerpt}</p>
      {item.duplicateOf && <small>{t('routineBuilder.existingOrRejected')}</small>}
    </article>
  );
}

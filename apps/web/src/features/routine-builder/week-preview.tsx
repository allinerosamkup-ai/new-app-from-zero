import { CalendarClock, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { groupPlanByDay } from './helpers';
import type { RoutinePlan } from './types';

export function WeekPreview({ plan, locale }: { plan: RoutinePlan; locale: string }) {
  const { t } = useTranslation();
  const groups = groupPlanByDay(plan.entries);
  return (
    <div className="routine-week">
      <div className={`routine-capacity routine-capacity--${plan.capacity.level}`}>
        <span>{t('routineBuilder.rhythm')}</span>
        <strong>{plan.capacity.reason}</strong>
      </div>
      {groups.map((group) => (
        <section key={group.date} className="routine-day">
          <header>
            <span>{new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(`${group.date}T12:00:00`))}</span>
            <strong>{new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(`${group.date}T12:00:00`))}</strong>
          </header>
          <div className="routine-day__line" />
          {group.entries.map((entry) => (
            <article key={entry.id} className={`routine-slot${entry.persist ? '' : ' is-existing'}`}>
              <time>{entry.startTime}</time>
              <div>
                <strong>{entry.title}</strong>
                <p>{entry.reason}</p>
              </div>
              {entry.isFixed ? <LockKeyhole size={15} aria-label={t('routineBuilder.protected')} /> : <CalendarClock size={15} />}
            </article>
          ))}
        </section>
      ))}
      {plan.unscheduled.length > 0 && (
        <section className="routine-unscheduled">
          <strong>{t('routineBuilder.outsideWeek')}</strong>
          {plan.unscheduled.map((item) => <p key={`${item.sourceItemId}:${item.title}`}>{item.title} — {item.reason}</p>)}
        </section>
      )}
    </div>
  );
}

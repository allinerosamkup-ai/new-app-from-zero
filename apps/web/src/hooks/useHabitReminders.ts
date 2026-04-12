import { useEffect, useRef } from 'react';
import type { Habit, Task } from '../features/aura/types';
import { getHabitCompletionCount, getHabitTargetCount, isHabitCompleteForDate } from '../features/aura/habit-helpers';
import { getLocalDateKey } from '../utils/day-context';

function timeToMinutes(time: string | null | undefined): number | null {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function shouldFirePersistentReminder(nowMinutes: number, startMinutes: number, intervalMinutes: number): boolean {
  if (nowMinutes < startMinutes) return false;
  return (nowMinutes - startMinutes) % intervalMinutes === 0;
}

export function useHabitReminders(habits: Habit[], tasks: Task[] = []) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!('Notification' in window)) return;

    const habitsWithReminders = habits.filter((h) => h.reminderEnabled && h.reminderTime);
    const tasksWithPersistentReminders = tasks.filter((task) => task.persistentReminderEnabled && task.time);
    if (habitsWithReminders.length === 0 && tasksWithPersistentReminders.length === 0) return;

    const checkAndFire = () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      const todayKey = getLocalDateKey(now);
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      habitsWithReminders
        .forEach((h) => {
          const startMinutes = timeToMinutes(h.reminderTime);
          if (startMinutes === null) return;
          const completed = isHabitCompleteForDate(h, todayKey);
          if (completed) return;

          const interval = h.persistentReminderIntervalMinutes ?? 60;
          const shouldFire = h.reminderTime === hhmm
            || Boolean(h.persistentReminderEnabled && shouldFirePersistentReminder(nowMinutes, startMinutes, interval));
          const firedKey = `habit-${h.id}-${todayKey}-${hhmm}`;
          if (!shouldFire || firedRef.current.has(firedKey)) return;
          firedRef.current.add(firedKey);

          const count = getHabitCompletionCount(h, todayKey);
          const target = getHabitTargetCount(h);
          new Notification(`${h.icon ?? '⭐'} ${h.title}`, {
            body: target > 1 ? `Faltam ${Math.max(0, target - count)} de ${target} hoje.` : 'Hora do seu hábito!',
            icon: '/favicon.ico',
            tag: `habit-${h.id}`,
          });
        });

      tasksWithPersistentReminders
        .forEach((task) => {
          if (task.done) return;
          const startMinutes = timeToMinutes(task.time);
          if (startMinutes === null) return;
          const interval = task.persistentReminderIntervalMinutes ?? 60;
          if (!shouldFirePersistentReminder(nowMinutes, startMinutes, interval)) return;

          const firedKey = `task-${task.id}-${todayKey}-${hhmm}`;
          if (firedRef.current.has(firedKey)) return;
          firedRef.current.add(firedKey);

          new Notification(`Agenda: ${task.title}`, {
            body: 'Ainda está pendente. Marque como feito quando concluir.',
            icon: '/favicon.ico',
            tag: `task-${task.id}`,
          });
        });
    };

    // Alinha ao próximo minuto cheio para não disparar no meio
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      checkAndFire();
      interval = setInterval(checkAndFire, 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [habits, tasks]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

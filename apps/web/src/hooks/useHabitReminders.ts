import { useEffect } from 'react';
import type { Habit } from '../features/aura/types';

export function useHabitReminders(habits: Habit[]) {
  useEffect(() => {
    if (!('Notification' in window)) return;

    const habitsWithReminders = habits.filter((h) => h.reminderEnabled && h.reminderTime);
    if (habitsWithReminders.length === 0) return;

    const checkAndFire = () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      habitsWithReminders
        .filter((h) => h.reminderTime === hhmm)
        .forEach((h) => {
          new Notification(`${h.icon ?? '⭐'} ${h.title}`, {
            body: 'Hora do seu hábito!',
            icon: '/favicon.ico',
            tag: `habit-${h.id}`,
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
  }, [habits]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

import { useEffect, useRef } from 'react';
import type { Habit, NotificationPreferences, Task } from '../features/aura/types';
import { getHabitCompletionCount, getHabitTargetCount, isHabitCompleteForDate, isHabitDueOnDate } from '../features/aura/habit-helpers';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../features/aura/settings';
import { getLocalDateKey } from '../utils/day-context';

type AiriaNotificationOptions = NotificationOptions & {
  renotify?: boolean;
  timestamp?: number;
  vibrate?: number[];
};

function timeToMinutes(time: string | null | undefined): number | null {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function shouldFirePersistentReminder(nowMinutes: number, startMinutes: number, intervalMinutes: number): boolean {
  if (nowMinutes < startMinutes) return false;
  return (nowMinutes - startMinutes) % intervalMinutes === 0;
}

function shouldNotifyPlannerTask(task: Task): boolean {
  if (!task.time || task.done) return false;
  if (!task.isAiSuggested) return true;
  return Boolean(task.persistentReminderEnabled || task.alarmEnabled || task.vibrateEnabled);
}

export function useHabitReminders(
  habits: Habit[],
  tasks: Task[] = [],
  notificationPreferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!('Notification' in window)) return;

    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...notificationPreferences,
    };
    const habitsWithReminders = preferences.habits
      ? habits.filter((h) => h.reminderEnabled && h.reminderTime)
      : [];
    const tasksWithReminders = preferences.planner
      ? tasks.filter(shouldNotifyPlannerTask)
      : [];
    // Check-ins são enviados pelo servidor: três janelas adaptativas no fuso
    // da pessoa, com idempotência por janela. Este hook não pode reviver o
    // lembrete local fixo de manhã/noite em paralelo.
    const hasFixedReminders = preferences.journal;
    if (habitsWithReminders.length === 0 && tasksWithReminders.length === 0 && !hasFixedReminders) return;

    const checkAndFire = () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      const todayKey = getLocalDateKey(now);
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      if (preferences.journal && (hhmm === preferences.journalMorningTime || hhmm === preferences.journalEveningTime)) {
        const firedKey = `journal-${todayKey}-${hhmm}`;
        if (!firedRef.current.has(firedKey)) {
          firedRef.current.add(firedKey);
          new Notification('Diário da Airia', {
            body: 'Dois minutos para registrar o que mudou por dentro.',
            icon: '/favicon.ico',
            tag: `journal-${todayKey}`,
          });
        }
      }

      habitsWithReminders
        .forEach((h) => {
          if (!isHabitDueOnDate(h, now)) return;
          const startMinutes = timeToMinutes(h.reminderTime);
          if (startMinutes === null) return;
          const completed = isHabitCompleteForDate(h, todayKey);
          if (completed) return;

          const interval = h.persistentReminderIntervalMinutes ?? 60;
          const shouldFire = h.reminderTime === hhmm
            || Boolean(preferences.persistent && h.persistentReminderEnabled && shouldFirePersistentReminder(nowMinutes, startMinutes, interval));
          const firedKey = `habit-${h.id}-${todayKey}-${hhmm}`;
          if (!shouldFire || firedRef.current.has(firedKey)) return;
          firedRef.current.add(firedKey);

          const count = getHabitCompletionCount(h, todayKey);
          const target = getHabitTargetCount(h);
          const notificationOptions: AiriaNotificationOptions = {
            body: target > 1 ? `Faltam ${Math.max(0, target - count)} de ${target} hoje.` : 'Hora do seu hábito!',
            icon: '/favicon.ico',
            tag: `habit-${h.id}`,
            renotify: true,
            timestamp: Date.now(),
          };
          new Notification(`${h.icon ?? '⭐'} ${h.title}`, notificationOptions);
        });

      tasksWithReminders
        .forEach((task) => {
          const startMinutes = timeToMinutes(task.time);
          if (startMinutes === null) return;
          const interval = task.persistentReminderIntervalMinutes ?? 60;
          const shouldFire = task.time === hhmm
            || Boolean(preferences.persistent && task.persistentReminderEnabled && shouldFirePersistentReminder(nowMinutes, startMinutes, interval));
          if (!shouldFire) return;

          const firedKey = `task-${task.id}-${todayKey}-${hhmm}`;
          if (firedRef.current.has(firedKey)) return;
          firedRef.current.add(firedKey);

          const notificationOptions: AiriaNotificationOptions = {
            body: 'Ainda está pendente. Marque como feito quando concluir.',
            icon: '/favicon.ico',
            tag: `task-${task.id}`,
            renotify: true,
            timestamp: Date.now(),
            // vibration pattern if enabled
            ...(task.vibrateEnabled ? { vibrate: [200, 100, 200] } : {}),
          };
          new Notification(`Agenda: ${task.title}`, notificationOptions);

          // Handle sound/alarm if enabled
          if (task.alarmEnabled) {
            try {
              const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");        
              audio.play().catch(() => console.log("Audio play blocked by browser policy"));
            } catch (err) {
              console.error("Alarm sound failed", err);
            }
          }

          if (task.vibrateEnabled && "vibrate" in navigator) {
             navigator.vibrate([200, 100, 200]);
          }
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
  }, [habits, tasks, notificationPreferences]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    window.dispatchEvent(new Event('airia-notification-permission-granted'));
    return true;
  }
  return false;
}

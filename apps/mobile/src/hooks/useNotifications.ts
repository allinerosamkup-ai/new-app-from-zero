import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

// Configura como as notificações aparecem quando o app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Hook que solicita permissão e agenda as 3 notificações recorrentes:
 *  - Check-in diário às 20h
 *  - Lembrete de hábitos às 8h
 *  - Insight semanal às 10h de domingo
 */
export function useNotifications() {
  useEffect(() => {
    void setupNotifications();
  }, []);
}

async function setupNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // Cancela agendamentos anteriores para evitar duplicatas
  await Notifications.cancelAllScheduledNotificationsAsync();

  // 1. Check-in diário — todo dia às 20h
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Como foi hoje? 🌙',
      body: 'Que tal fazer seu check-in do dia? Leva só 1 minuto.',
      data: { screen: 'Checkin' },
    },
    trigger: {
      hour: 20,
      minute: 0,
      repeats: true,
    } as Notifications.DailyTriggerInput,
  });

  // 2. Lembrete de hábitos — todo dia às 8h
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Seus rituais te esperam ✦',
      body: 'Confira seus hábitos de hoje e mantenha a sequência.',
      data: { screen: 'Hábitos' },
    },
    trigger: {
      hour: 8,
      minute: 0,
      repeats: true,
    } as Notifications.DailyTriggerInput,
  });

  // 3. Insight semanal — todo domingo às 10h
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Sua semana em padrões 📊',
      body: 'A Aura tem um resumo do seu ciclo de humor desta semana.',
      data: { screen: 'Insights' },
    },
    trigger: {
      weekday: 1, // domingo (1 = domingo no Expo)
      hour: 10,
      minute: 0,
      repeats: true,
    } as Notifications.WeeklyTriggerInput,
  });
}

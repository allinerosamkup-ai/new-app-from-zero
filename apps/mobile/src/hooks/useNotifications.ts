import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import api from '../services/api_service';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  useEffect(() => {
    void setupNotifications();
  }, []);
}

async function setupNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.cancelAllScheduledNotificationsAsync();

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

/**
 * Hook que registra o Expo Push Token no backend para notificações background.
 * Deve ser chamado após o login, passando o userId autenticado.
 */
export function usePushNotifications(userId: string | null) {
  const tokenRegisteredRef = useRef(false);

  useEffect(() => {
    if (!userId || tokenRegisteredRef.current) return;
    tokenRegisteredRef.current = true;

    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'mood-energy',
        });

        const expoPushToken = tokenData.data;

        await api.post('/push/subscribe', {
          endpoint: expoPushToken,
          keys: { p256dh: 'expo', auth: 'expo' },
          userAgent: `ExpoMobile/${Platform.OS}`,
        });
      } catch (e) {
        console.warn('[push] Expo token registration failed:', e);
      }
    })();
  }, [userId]);
}

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
    setupNotifications().catch((error) => {
      console.warn('[notifications] setup skipped:', error);
    });
  }, []);
}

async function scheduleSafely(
  label: string,
  input: Notifications.NotificationRequestInput,
) {
  try {
    await Notifications.scheduleNotificationAsync(input);
  } catch (error) {
    console.warn(`[notifications] schedule failed (${label}):`, error);
  }
}

async function setupNotifications() {
  let status: Notifications.PermissionStatus | undefined;
  try {
    const result = await Notifications.requestPermissionsAsync();
    status = result.status;
  } catch (error) {
    console.warn('[notifications] permission request failed:', error);
    return;
  }

  if (status !== 'granted') return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('[notifications] cancel all failed:', error);
  }

  await scheduleSafely('checkin', {
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

  await scheduleSafely('habits', {
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

  await scheduleSafely('weekly', {
    content: {
      title: 'Sua semana em padrões 📊',
      body: 'A Aura tem um resumo do seu ciclo de humor desta semana.',
      data: { screen: 'Insights' },
    },
    trigger: {
      weekday: 1,
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
          projectId: '27c441ce-76c7-4508-b0fd-4f431cdd04d0',
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

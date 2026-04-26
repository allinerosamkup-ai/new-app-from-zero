import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

export function usePushNotifications(userId: string | null) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const subscribe = async () => {
      if (subscribedRef.current) return;
      const ok = await registerPushSubscription(userId);
      if (ok) subscribedRef.current = true;
    };

    void subscribe();
    window.addEventListener('airia-notification-permission-granted', subscribe);
    window.addEventListener('focus', subscribe);

    return () => {
      window.removeEventListener('airia-notification-permission-granted', subscribe);
      window.removeEventListener('focus', subscribe);
    };
  }, [userId]);
}

export async function registerPushSubscription(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const { publicKey } = await api.get('/push/vapid-public-key');
    if (!publicKey) return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
      });
    }

    const json = sub.toJSON();
    await api.post('/push/subscribe', {
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    });
    return true;
  } catch (e) {
    console.warn('[push] subscribe failed:', e);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

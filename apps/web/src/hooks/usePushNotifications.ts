import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

export function usePushNotifications(userId: string | null) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!userId || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;

    subscribedRef.current = true;

    (async () => {
      try {
        const { publicKey } = await api.get('/push/vapid-public-key');
        if (!publicKey) return;

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
      } catch (e) {
        console.warn('[push] subscribe failed:', e);
      }
    })();
  }, [userId]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

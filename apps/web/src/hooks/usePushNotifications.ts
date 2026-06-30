import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

const PROMPT_DISMISSED_KEY = 'airia-push-prompt-dismissed-at';
const PROMPT_TTL_DAYS = 14;

function isFreshPromptDismiss(): boolean {
  try {
    const raw = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || !at) return false;
    return (Date.now() - at) / 86400000 < PROMPT_TTL_DAYS;
  } catch {
    return false;
  }
}

function markPromptDismissed() {
  try {
    localStorage.setItem(PROMPT_DISMISSED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Hook que registra a subscription de push do usuário.
 * - Se permissão já está granted: subscribe imediatamente.
 * - Se permissão é 'default' (nunca foi perguntado): aguarda o primeiro gesto
 *   do usuário (click/touch/keydown), pede permissão, e subscribe se aceitar.
 * - Se permissão é 'denied': não tenta novamente até o usuário resetar.
 * - Re-tenta no foco da janela (caso permissão tenha sido alterada nas configs).
 */
export function usePushNotifications(userId: string | null) {
  const subscribedRef = useRef(false);
  const gestureWiredRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    const subscribe = async () => {
      if (subscribedRef.current) return;
      const ok = await registerPushSubscription(userId);
      if (ok) subscribedRef.current = true;
    };

    const requestAndSubscribe = async () => {
      if (subscribedRef.current) return;
      if (Notification.permission === 'denied') return;
      if (Notification.permission === 'granted') {
        await subscribe();
        return;
      }
      // 'default' — só pedimos se o usuário ainda não dispensou recentemente
      if (isFreshPromptDismiss()) return;
      try {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          window.dispatchEvent(new Event('airia-notification-permission-granted'));
          await subscribe();
        } else {
          markPromptDismissed();
        }
      } catch {
        /* ignore */
      }
    };

    // Tentativa imediata (caso permissão já esteja granted)
    if (Notification.permission === 'granted') {
      void subscribe();
    } else if (Notification.permission === 'default' && !gestureWiredRef.current) {
      // Aguarda primeiro gesto do usuário pra pedir permissão (Chrome exige user gesture)
      gestureWiredRef.current = true;
      const onFirstGesture = () => {
        document.removeEventListener('click', onFirstGesture);
        document.removeEventListener('touchstart', onFirstGesture);
        document.removeEventListener('keydown', onFirstGesture);
        // Delay pequeno pra não atrapalhar o gesto em si
        setTimeout(() => void requestAndSubscribe(), 800);
      };
      document.addEventListener('click', onFirstGesture, { once: true });
      document.addEventListener('touchstart', onFirstGesture, { once: true });
      document.addEventListener('keydown', onFirstGesture, { once: true });
    }

    // Eventos de re-tentativa
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

/**
 * Pede permissão diretamente (deve ser chamado de dentro de um click handler).
 * Retorna true se concedido, false caso contrário.
 */
export async function requestPushPermissionExplicit(userId: string | null): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    return userId ? registerPushSubscription(userId) : true;
  }
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      markPromptDismissed();
      return false;
    }
    window.dispatchEvent(new Event('airia-notification-permission-granted'));
    if (userId) {
      return registerPushSubscription(userId);
    }
    return true;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

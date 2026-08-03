/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { navigateClientsToRelease } from './features/pwa/release-update';
import { FEATURES, FEATURE_FALLBACK_ROUTE } from './config/features';

declare const self: ServiceWorkerGlobalScope;

/** Para onde o clique na notificação leva. Segue a chave do produto. */
const NOTIFICATION_TARGET = FEATURES.planner ? '/planner' : FEATURE_FALLBACK_ROUTE;

const appRelease = import.meta.env.VITE_APP_RELEASE?.trim() ?? '';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/api\//],
}));

self.addEventListener('activate', (event) => {
  if (!appRelease) return;

  event.waitUntil((async () => {
    await self.clients.claim();
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: false,
    }) as WindowClient[];

    await navigateClientsToRelease(clients, appRelease);
  })());
});

// Handle push events
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
    blockId?: string;
    actions?: Array<{ action: string; title: string }>;
  } = {};
  try { payload = event.data.json(); } catch { payload = { title: 'Airia', body: event.data.text() }; }

  const title = payload.title || 'Airia';
  const tag = payload.tag || 'airia-push';

  // renotify/timestamp/actions são válidos no spec mas ainda fora do lib.dom; estendemos o tipo.
  const options: NotificationOptions & {
    renotify?: boolean;
    timestamp?: number;
    actions?: Array<{ action: string; title: string }>;
  } = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    data: { url: payload.url || '/', blockId: payload.blockId },
    requireInteraction: false,
    renotify: true,
    timestamp: Date.now(),
  };

  // Adiciona botões de ação se o payload trouxer
  if (payload.actions?.length) {
    options.actions = payload.actions;
  }

  event.waitUntil(
    self.registration.getNotifications({ tag })
      .then((notifications) => {
        notifications.forEach((n) => n.close());
        return self.registration.showNotification(title, options);
      }),
  );
});

// Handle notification click (tap no body ou em um botão de ação)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action: string = (event as any).action || '';
  const blockId: string | undefined = event.notification.data?.blockId;
  const url: string = event.notification.data?.url || '/';

  // Para ações done/started/help: postMessage ao cliente ativo (que tem o token de auth)
  // e navega para /planner
  if (blockId && (action === 'done' || action === 'started' || action === 'help')) {
    event.waitUntil(
      (self.clients as any).matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients: any[]) => {
          const message = { type: 'NOTIFICATION_ACTION', action, blockId };

          // Envia para todos os clientes abertos
          clients.forEach((c: any) => c.postMessage(message));

          // Navega para dar feedback visual. Com o Planner desligado o destino
          // é a Home — notificação não pode abrir tela que saiu do produto.
          const target = clients.find((c: any) => c.url.includes(NOTIFICATION_TARGET) || c.focused);
          if (target) return target.focus();
          return (self.clients as any).openWindow(NOTIFICATION_TARGET);
        }),
    );
    return;
  }

  // Clique simples no corpo da notificação: abre/foca a URL
  event.waitUntil(
    (self.clients as any).matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients: any[]) => {
        const existing = clients.find((c: any) => c.url.includes(url) || url === '/');
        if (existing) return existing.focus();
        return (self.clients as any).openWindow(url);
      }),
  );
});

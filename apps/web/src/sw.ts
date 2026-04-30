/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

const AIRIA_SW_BUILD = '20260429-home-phase-label-refresh';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      return Promise.all(
        clients.map((client) => {
          const url = new URL(client.url);
          url.searchParams.set('__airia_sw', AIRIA_SW_BUILD);
          return client.navigate(url.toString()).catch(() => undefined);
        }),
      );
    }),
  );
});

// Handle push events
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string; tag?: string } = {};
  try { payload = event.data.json(); } catch { payload = { title: 'Airia', body: event.data.text() }; }

  const title = payload.title || 'Airia';
  const tag = payload.tag || 'airia-push';
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    data: { url: payload.url || '/' },
    requireInteraction: false,
    renotify: true,
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.getNotifications({ tag })
      .then((notifications) => {
        notifications.forEach((notification) => notification.close());
        return self.registration.showNotification(title, options);
      }),
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    (self.clients as any).matchAll({ type: 'window', includeUncontrolled: true }).then((clients: any[]) => {
      const existing = clients.find(c => c.url.includes(url) || url === '/');
      if (existing) return existing.focus();
      return (self.clients as any).openWindow(url);
    })
  );
});

import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

async function run() {
  const previousFetch = globalThis.fetch;
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const upserts: any[] = [];
  const updates: any[] = [];
  const calendarEventRequests: string[] = [];
  const patchedEvents: any[] = [];
  const deletedEvents: string[] = [];
  const userPreference = {
    gcalAccessToken: 'access-token',
    gcalRefreshToken: 'refresh-token',
    gcalSelectedCalendars: null as string[] | null,
    gcalWriteCalendarId: null as string | null,
  };

  process.env.GOOGLE_CLIENT_ID = 'google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
  process.env.FRONTEND_URL = 'https://app.airia.pro';

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/calendar/v3/users/me/calendarList')) {
      return new Response(JSON.stringify({
        items: [
          {
            id: 'primary',
            summary: 'Principal',
            primary: true,
            selected: true,
            accessRole: 'owner',
            backgroundColor: '#4285F4',
          },
          {
            id: 'terapia@example.com',
            summary: 'Terapia',
            selected: true,
            accessRole: 'writer',
            backgroundColor: '#16A765',
          },
          {
            id: 'minha-agenda@example.com',
            summary: 'Minha agenda',
            selected: false,
            accessRole: 'writer',
            backgroundColor: '#F4511E',
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const eventMatch = url.match(/\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^?]+))?/);
    if (eventMatch) {
      const calendarId = decodeURIComponent(eventMatch[1]);
      const eventId = eventMatch[2] ? decodeURIComponent(eventMatch[2]) : null;

      if (init?.method === 'PATCH' && eventId) {
        const body = JSON.parse(String(init.body ?? '{}'));
        patchedEvents.push({ calendarId, eventId, body });
        return new Response(JSON.stringify({ id: eventId, ...body }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (init?.method === 'DELETE' && eventId) {
        deletedEvents.push(`${calendarId}:${eventId}`);
        return new Response(null, { status: 204 });
      }

      calendarEventRequests.push(calendarId);
      return new Response(JSON.stringify({
        items: [
          {
            id: `${calendarId}-event`,
            summary: `${calendarId} evento`,
            start: { dateTime: '2026-04-13T09:00:00-03:00' },
            end: { dateTime: '2026-04-13T10:00:00-03:00' },
            htmlLink: `https://calendar.google.com/${calendarId}`,
            extendedProperties: {
              private: {
                airiaStatus: calendarId === 'terapia@example.com' ? 'completed' : 'planned',
              },
            },
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return previousFetch(input, init);
  }) as typeof fetch;

  const prisma = {
    userPreference: {
      upsert: async (input: any) => {
        upserts.push(input);
        Object.assign(userPreference, input.create, input.update);
        return input.create;
      },
      findUnique: async () => userPreference,
      update: async (input: any) => {
        updates.push(input);
        Object.assign(userPreference, input.data);
        return userPreference;
      },
    },
  };

  const app = createApp({
    prisma: prisma as any,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = '550e8400-e29b-41d4-a716-446655440000';
      next();
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to open test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(
      `${baseUrl}/api/gcal/callback?code=ok&state=550e8400-e29b-41d4-a716-446655440000`,
      { redirect: 'manual' },
    );

    assert.equal(response.status, 302);
    assert.match(response.headers.get('location') ?? '', /\/preferences\?gcal=connected$/);
    assert.equal(upserts.length, 1);
    assert.equal(upserts[0].where.userId, '550e8400-e29b-41d4-a716-446655440000');

    userPreference.gcalSelectedCalendars = null;
    calendarEventRequests.length = 0;

    const calendarsResponse = await fetch(`${baseUrl}/api/gcal/calendars`);
    const calendarsBody = await calendarsResponse.json();
    assert.equal(calendarsResponse.status, 200);
    assert.deepEqual(calendarsBody.selectedIds, ['primary', 'terapia@example.com', 'minha-agenda@example.com']);
    assert.equal(calendarsBody.writeCalendarId, 'primary');

    const eventsResponse = await fetch(`${baseUrl}/api/gcal/events?date=2026-04-13`);
    const eventsBody = await eventsResponse.json();
    assert.equal(eventsResponse.status, 200);
    assert.equal(eventsBody.connected, true);
    assert.deepEqual(calendarEventRequests.sort(), ['minha-agenda@example.com', 'primary', 'terapia@example.com']);
    assert.equal(eventsBody.events.length, 3);
    assert.equal(eventsBody.events.some((event: any) => event.calendarId === 'minha-agenda@example.com'), true);
    assert.equal(eventsBody.events.find((event: any) => event.calendarId === 'terapia@example.com')?.airiaStatus, 'completed');

    const saveCalendarsResponse = await fetch(`${baseUrl}/api/gcal/calendars`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarIds: ['terapia@example.com'], writeCalendarId: 'terapia@example.com' }),
    });
    assert.equal(saveCalendarsResponse.status, 200);
    assert.deepEqual(userPreference.gcalSelectedCalendars, ['terapia@example.com']);
    assert.equal(userPreference.gcalWriteCalendarId, 'terapia@example.com');

    calendarEventRequests.length = 0;
    const savedEventsResponse = await fetch(`${baseUrl}/api/gcal/events?date=2026-04-13`);
    assert.equal(savedEventsResponse.status, 200);
    assert.deepEqual(calendarEventRequests.sort(), ['minha-agenda@example.com', 'terapia@example.com']);

    const patchResponse = await fetch(`${baseUrl}/api/gcal/events/therapy-event?calendarId=${encodeURIComponent('terapia@example.com')}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-13',
        title: 'Consulta',
        startTime: '11:00',
        endTime: '12:00',
        status: 'completed',
      }),
    });
    assert.equal(patchResponse.status, 200);
    assert.equal(patchedEvents[0].calendarId, 'terapia@example.com');
    assert.equal(patchedEvents[0].body.extendedProperties.private.airiaStatus, 'completed');

    const deleteResponse = await fetch(`${baseUrl}/api/gcal/events/therapy-event?calendarId=${encodeURIComponent('terapia@example.com')}`, {
      method: 'DELETE',
    });
    assert.equal(deleteResponse.status, 204);
    assert.deepEqual(deletedEvents, ['terapia@example.com:therapy-event']);
  } finally {
    globalThis.fetch = previousFetch;
    process.env.GOOGLE_CLIENT_ID = previousClientId;
    process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
    process.env.FRONTEND_URL = previousFrontendUrl;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

run()
  .then(() => {
    console.log('index.gcal tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import assert from 'node:assert/strict';

import { GCalService } from './gcal.service';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

async function main() {
  const originalFetch = global.fetch;
  const prisma: any = {
    userPreference: {
      findUnique: async () => ({
        gcalAccessToken: 'access-token',
        gcalRefreshToken: 'refresh-token',
      }),
    },
  };

  try {
    const existingCalls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      existingCalls.push({ url: String(url), init });
      return jsonResponse(200, {
        items: [{
          id: 'existing-event',
          htmlLink: 'https://calendar.google.com/existing',
        }],
      });
    }) as typeof fetch;

    const existing = await GCalService.createOrGetEvent({
      prisma,
      userId: '30000000-0000-4000-8000-000000000001',
      operationId: '10000000-0000-4000-8000-000000000001',
      calendarId: 'work@example.com',
      title: 'Consulta',
      date: '2026-07-29',
      startTime: '15:00',
      durationMinutes: 60,
    });

    assert.equal(existing.eventId, 'existing-event');
    assert.equal(existing.calendarId, 'work@example.com');
    assert.equal(existingCalls.length, 1);
    assert.equal(existingCalls[0].init?.method, 'GET');
    assert.match(existingCalls[0].url, /privateExtendedProperty=airiaOperationId%3D10000000/);

    const createCalls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      createCalls.push({ url: String(url), init });
      if (init?.method === 'GET') return jsonResponse(200, { items: [] });
      return jsonResponse(200, {
        id: 'created-event',
        htmlLink: 'https://calendar.google.com/created',
      });
    }) as typeof fetch;

    const created = await GCalService.createOrGetEvent({
      prisma,
      userId: '30000000-0000-4000-8000-000000000001',
      operationId: '10000000-0000-4000-8000-000000000002',
      calendarId: 'primary',
      title: 'Dentista',
      date: '2026-07-30',
      startTime: '09:30',
      durationMinutes: 45,
      location: 'Centro',
    });

    assert.equal(created.eventId, 'created-event');
    assert.equal(createCalls.length, 2);
    const post = createCalls.find((call) => call.init?.method === 'POST');
    assert.ok(post);
    const body = JSON.parse(String(post.init?.body));
    assert.equal(body.summary, 'Dentista');
    assert.equal(body.extendedProperties.private.airiaOperationId, '10000000-0000-4000-8000-000000000002');
    assert.equal(body.start.dateTime, '2026-07-30T09:30:00');
    assert.equal(body.end.dateTime, '2026-07-30T10:15:00');

    console.log('gcal command-center tests passed');
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

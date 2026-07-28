import { PrismaClient } from '@app/database';

export class GCalService {
  private static getTimeZone(): string {
    return process.env.GOOGLE_CALENDAR_TIME_ZONE || 'America/Sao_Paulo';
  }

  private static formatUtcTime(date: Date): string {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private static buildLocalDateTime(date: string, time: string): string {
    return `${date}T${time}:00`;
  }

  static async getValidToken(prisma: PrismaClient, userId: string): Promise<string | null> {
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
      select: { gcalAccessToken: true, gcalRefreshToken: true }
    });

    if (!pref?.gcalAccessToken) return null;

    // TODO: Implement actual expiration check if possible. 
    // For now, we attempt a refresh if the fetch fails, or just return the current one.
    return pref.gcalAccessToken;
  }

  static async refreshAccessToken(prisma: PrismaClient, userId: string, refreshToken: string): Promise<string | null> {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!res.ok) return null;
      const data = await res.json() as any;
      if (!data.access_token) return null;

      await prisma.userPreference.update({
        where: { userId },
        data: { gcalAccessToken: data.access_token }
      });

      return data.access_token;
    } catch (err) {
      console.error('[GCalService.refresh]', err);
      return null;
    }
  }

  /**
   * Cria um compromisso no calendário escolhido sem duplicar a operação.
   * A identidade estável fica também no Google, então uma repetição após queda
   * de rede encontra o evento já criado antes de tentar um novo POST.
   */
  static async createOrGetEvent(input: {
    prisma: PrismaClient;
    userId: string;
    operationId: string;
    calendarId: string;
    title: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    location?: string | null;
    description?: string | null;
  }): Promise<{ calendarId: string; eventId: string; htmlLink?: string | null }> {
    const calendarId = input.calendarId || 'primary';
    const encodedCalendarId = encodeURIComponent(calendarId);
    let token = await this.getValidToken(input.prisma, input.userId);
    if (!token) {
      throw new Error('Google Agenda não está conectado.');
    }

    const request = async (url: string, init: RequestInit, allowRefresh = true): Promise<Response> => {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status !== 401 || !allowRefresh) return response;

      const preference = await input.prisma.userPreference.findUnique({
        where: { userId: input.userId },
        select: { gcalRefreshToken: true },
      });
      if (!preference?.gcalRefreshToken) return response;
      const refreshed = await this.refreshAccessToken(
        input.prisma,
        input.userId,
        preference.gcalRefreshToken,
      );
      if (!refreshed) return response;
      token = refreshed;
      return request(url, init, false);
    };

    const marker = `airiaOperationId=${input.operationId}`;
    const lookupUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`,
    );
    lookupUrl.searchParams.set('privateExtendedProperty', marker);
    lookupUrl.searchParams.set('maxResults', '1');
    lookupUrl.searchParams.set('singleEvents', 'true');
    lookupUrl.searchParams.set('showDeleted', 'false');

    const lookupResponse = await request(lookupUrl.toString(), { method: 'GET' });
    if (!lookupResponse.ok) {
      const details = await lookupResponse.text();
      throw new Error(`Não consegui consultar o Google Agenda (${lookupResponse.status}): ${details.slice(0, 300)}`);
    }
    const lookup = await lookupResponse.json() as {
      items?: Array<{ id?: string; htmlLink?: string | null; status?: string }>;
    };
    const existing = lookup.items?.find((item) => item.id && item.status !== 'cancelled');
    if (existing?.id) {
      return {
        calendarId,
        eventId: existing.id,
        htmlLink: existing.htmlLink ?? null,
      };
    }

    const [hours, minutes] = input.startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + input.durationMinutes;
    const endDate = new Date(`${input.date}T00:00:00.000Z`);
    endDate.setUTCMinutes(endMinutes);
    const endDateKey = endDate.toISOString().slice(0, 10);
    const endTime = `${String(endDate.getUTCHours()).padStart(2, '0')}:${String(endDate.getUTCMinutes()).padStart(2, '0')}`;
    const event = {
      summary: input.title,
      description: input.description ?? undefined,
      location: input.location ?? undefined,
      start: {
        dateTime: this.buildLocalDateTime(input.date, input.startTime),
        timeZone: this.getTimeZone(),
      },
      end: {
        dateTime: this.buildLocalDateTime(endDateKey, endTime),
        timeZone: this.getTimeZone(),
      },
      extendedProperties: {
        private: {
          airiaOperationId: input.operationId,
          airiaSource: 'command_center',
        },
      },
    };

    const createResponse = await request(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      },
    );
    if (!createResponse.ok) {
      const details = await createResponse.text();
      throw new Error(`Não consegui criar o compromisso no Google Agenda (${createResponse.status}): ${details.slice(0, 300)}`);
    }
    const created = await createResponse.json() as { id?: string; htmlLink?: string | null };
    if (!created.id) {
      throw new Error('O Google Agenda não retornou a identificação do compromisso.');
    }
    return {
      calendarId,
      eventId: created.id,
      htmlLink: created.htmlLink ?? null,
    };
  }

  static async syncBlockToGcal(prisma: PrismaClient, userId: string, block: any, date: string): Promise<string | null> {
    const token = await this.getValidToken(prisma, userId);
    if (!token) return null;

    const startTime = this.formatUtcTime(block.startAt);
    const endTime = this.formatUtcTime(block.endAt);
    const isAllDay = startTime === '00:00' && endTime === '23:59';
    const event = {
      summary: block.title,
      description: block.note || `Airia Task: ${block.category}`,
      start: isAllDay ? { date } : { dateTime: this.buildLocalDateTime(date, startTime), timeZone: this.getTimeZone() },
      end: isAllDay ? { date } : { dateTime: this.buildLocalDateTime(date, endTime), timeZone: this.getTimeZone() },
    };

    try {
      const url = block.gcalEventId 
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${block.gcalEventId}`
        : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
      
      const method = block.gcalEventId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event),
      });

      if (res.status === 401) {
        // Retry once with refresh
        const pref = await prisma.userPreference.findUnique({ where: { userId }, select: { gcalRefreshToken: true } });
        if (pref?.gcalRefreshToken) {
          const newToken = await this.refreshAccessToken(prisma, userId, pref.gcalRefreshToken);
          if (newToken) {
            return this.syncBlockToGcal(prisma, userId, block, date);
          }
        }
      }

      if (!res.ok) {
        const err = await res.text();
        console.error('[GCal.sync] Error:', err);
        return null;
      }

      const data = await res.json() as any;
      
      // Update local block with event ID if it was created
      // NOTE: uses DB table name "timeline_blocks" (@@map), NOT the Prisma model name "TimelineBlock"
      if (!block.gcalEventId && data.id) {
        await prisma.$executeRaw`UPDATE "timeline_blocks" SET "gcal_event_id" = ${data.id} WHERE id = ${block.id}::uuid`;
      }

      return data.id;
    } catch (err) {
      console.error('[GCal.sync] Exception:', err);
      return null;
    }
  }

  static async updatePrimaryEvent(
    prisma: PrismaClient,
    userId: string,
    eventId: string,
    input: { date: string; title: string; startTime: string; endTime: string; note?: string },
  ): Promise<any | null> {
    return this.updateEvent(prisma, userId, 'primary', eventId, input);
  }

  static async updateEvent(
    prisma: PrismaClient,
    userId: string,
    calendarId: string,
    eventId: string,
    input: {
      date?: string;
      title?: string;
      startTime?: string;
      endTime?: string;
      status?: 'planned' | 'completed';
      note?: string;
    },
  ): Promise<any | null> {
    const token = await this.getValidToken(prisma, userId);
    if (!token) return null;

    const event: Record<string, unknown> = {};
    if (input.title) event.summary = input.title;
    if (input.note !== undefined) event.description = input.note;
    if (input.date && input.startTime && input.endTime) {
      const isAllDay = input.startTime === '00:00' && input.endTime === '23:59';
      event.start = isAllDay ? { date: input.date } : { dateTime: this.buildLocalDateTime(input.date, input.startTime), timeZone: this.getTimeZone() };
      event.end = isAllDay ? { date: input.date } : { dateTime: this.buildLocalDateTime(input.date, input.endTime), timeZone: this.getTimeZone() };
    }
    if (input.status) {
      event.extendedProperties = { private: { airiaStatus: input.status } };
    }

    const requestUpdate = (accessToken: string) => fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    );

    try {
      let res = await requestUpdate(token);

      if (res.status === 401) {
        const pref = await prisma.userPreference.findUnique({ where: { userId }, select: { gcalRefreshToken: true } });
        if (pref?.gcalRefreshToken) {
          const newToken = await this.refreshAccessToken(prisma, userId, pref.gcalRefreshToken);
          if (newToken) {
            res = await requestUpdate(newToken);
          }
        }
      }

      if (!res.ok) {
        const err = await res.text();
        console.error('[GCal.update] Error:', err);
        return null;
      }

      return res.json();
    } catch (err) {
      console.error('[GCal.update] Exception:', err);
      return null;
    }
  }

  static async deletePrimaryEvent(prisma: PrismaClient, userId: string, eventId: string): Promise<boolean> {
    return this.deleteEvent(prisma, userId, 'primary', eventId);
  }

  static async deleteEvent(prisma: PrismaClient, userId: string, calendarId: string, eventId: string): Promise<boolean> {
    const token = await this.getValidToken(prisma, userId);
    if (!token) return false;

    const requestDelete = (accessToken: string) => fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    try {
      let res = await requestDelete(token);

      if (res.status === 401) {
        const pref = await prisma.userPreference.findUnique({ where: { userId }, select: { gcalRefreshToken: true } });
        if (pref?.gcalRefreshToken) {
          const newToken = await this.refreshAccessToken(prisma, userId, pref.gcalRefreshToken);
          if (newToken) {
            res = await requestDelete(newToken);
          }
        }
      }

      if (res.status === 404 || res.status === 410) return true;
      if (!res.ok) {
        const err = await res.text();
        console.error('[GCal.delete] Error:', err);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[GCal.delete] Exception:', err);
      return false;
    }
  }
}

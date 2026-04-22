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
      if (!block.gcalEventId && data.id) {
        await prisma.$executeRaw`UPDATE "TimelineBlock" SET "gcal_event_id" = ${data.id} WHERE id = ${block.id}::uuid`;
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

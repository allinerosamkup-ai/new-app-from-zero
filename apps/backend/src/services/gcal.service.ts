import { PrismaClient } from '@app/database';

export class GCalService {
  private static clientId = process.env.GOOGLE_CLIENT_ID;
  private static clientSecret = process.env.GOOGLE_CLIENT_SECRET;

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
          client_id: this.clientId!,
          client_secret: this.clientSecret!,
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

    const event = {
      summary: block.title,
      description: `Aura Task: ${block.category}`,
      start: { dateTime: block.startAt.toISOString() },
      end: { dateTime: block.endAt.toISOString() },
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
        await prisma.timelineBlock.update({
          where: { id: block.id },
          // The Prisma client in this workspace is lagging behind the schema field.
          data: { gcalEventId: data.id } as any,
        });
      }

      return data.id;
    } catch (err) {
      console.error('[GCal.sync] Exception:', err);
      return null;
    }
  }
}

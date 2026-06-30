import { describe, expect, it } from "vitest";

import {
  DEFAULT_EVENING_CHECKIN_TIME,
  DEFAULT_JOURNAL_EVENING_TIME,
  DEFAULT_JOURNAL_MORNING_TIME,
  DEFAULT_MORNING_CHECKIN_TIME,
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  QUIET_MODE_END_TIME,
  QUIET_MODE_START_TIME,
  normalizeReminderPreferences,
  normalizeTimeInput,
} from "./settings";

describe("settings defaults", () => {
  it("keeps check-in reminders at 08:00 and 20:00", () => {
    expect(DEFAULT_MORNING_CHECKIN_TIME).toBe("08:00");
    expect(DEFAULT_EVENING_CHECKIN_TIME).toBe("20:00");
    expect(DEFAULT_JOURNAL_MORNING_TIME).toBe("11:00");
    expect(DEFAULT_JOURNAL_EVENING_TIME).toBe("19:00");
  });

  it("keeps quiet mode from 20:00 to 08:00", () => {
    expect(QUIET_MODE_START_TIME).toBe("20:00");
    expect(QUIET_MODE_END_TIME).toBe("08:00");
  });

  it("normalizes persisted reminder preferences", () => {
    expect(normalizeReminderPreferences({
      morningCheckinTime: "07:45",
      eveningReviewTime: "20:15",
      notificationsOn: false,
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, journal: false },
    })).toEqual({
      morningCheckinTime: "07:45",
      eveningCheckinTime: "20:15",
      checkinReminder: true,
      notificationPreferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        journal: false,
      },
    });
  });

  it("keeps legacy notifications_on as check-in fallback", () => {
    expect(normalizeReminderPreferences({
      notificationsOn: false,
    }).checkinReminder).toBe(false);
  });

  it("normalizes granular notification preferences", () => {
    expect(normalizeNotificationPreferences({
      planner: false,
      journalMorningTime: "10:30",
      journalEveningTime: "19:15",
    })).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      planner: false,
      journalMorningTime: "10:30",
      journalEveningTime: "19:15",
    });
  });

  it("rejects invalid time strings", () => {
    expect(normalizeTimeInput("25:99", "08:00")).toBe("08:00");
  });
});

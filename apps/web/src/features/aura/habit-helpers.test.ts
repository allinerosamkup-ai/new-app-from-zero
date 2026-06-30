import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildHabitPayload,
  getHabitCompletionCount,
  getHabitTargetCount,
  getHabitProgressLabel,
  isHabitCompleteForDate,
  isHabitDueOnWeekday,
} from "./habit-helpers";

describe("habit helpers", () => {
  it("builds a daily habit payload with multiple targets per day", () => {
    const payload = buildHabitPayload({
      title: "Beber agua",
      category: "health",
      frequency: "daily",
      targetCount: 5,
      icon: "💧",
      timeOfDay: "anytime",
      description: "",
      targetDays: [],
      reminderEnabled: true,
      reminderTime: "09:00",
      persistentReminderEnabled: true,
      persistentReminderIntervalMinutes: 60,
    });

    assert.equal(payload.frequency, "daily");
    assert.equal(payload.targetCount, 5);
    assert.deepEqual(payload.targetDays, []);
    assert.equal(payload.persistentReminderEnabled, true);
    assert.equal(payload.persistentReminderIntervalMinutes, 60);
  });

  it("builds a weekly habit payload with selected weekdays and weekly target count", () => {
    const payload = buildHabitPayload({
      title: "Regar as plantas",
      category: "geral",
      frequency: "weekly",
      targetCount: 2,
      icon: "🪴",
      timeOfDay: "morning",
      description: "",
      targetDays: [1, 4],
      reminderEnabled: false,
      reminderTime: "",
      persistentReminderEnabled: false,
      persistentReminderIntervalMinutes: 60,
    });

    assert.equal(payload.frequency, "weekly");
    assert.equal(payload.targetCount, 2);
    assert.deepEqual(payload.targetDays, [1, 4]);
    assert.equal(isHabitDueOnWeekday(payload, 1), true);
    assert.equal(isHabitDueOnWeekday(payload, 2), false);
  });

  it("treats multi-count habits as complete only when the target count is reached", () => {
    const habit = {
      targetCount: 5,
      completions: [{ date: "2026-04-12", completionCount: 3 }],
    };

    assert.equal(getHabitTargetCount(habit), 5);
    assert.equal(getHabitCompletionCount(habit, "2026-04-12"), 3);
    assert.equal(isHabitCompleteForDate(habit, "2026-04-12"), false);
    assert.equal(getHabitProgressLabel(habit, "2026-04-12"), "3/5 hoje");
  });

  it("marks multi-count habits as complete when count reaches the target", () => {
    const habit = {
      targetCount: 2,
      completions: [{ date: "2026-04-12", completionCount: 2 }],
    };

    assert.equal(isHabitCompleteForDate(habit, "2026-04-12"), true);
    assert.equal(getHabitProgressLabel(habit, "2026-04-12"), "2/2 hoje");
  });
});

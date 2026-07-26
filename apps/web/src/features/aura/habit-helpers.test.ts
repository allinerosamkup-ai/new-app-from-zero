import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildHabitDraftFromSuggestion,
  categorizeHabitsForDate,
  buildHabitPayload,
  formatHabitFrequency,
  formatHabitTimeOfDay,
  getHabitCompletionCount,
  getHabitTargetCount,
  getHabitProgressLabel,
  isHabitCompleteForDate,
  isHabitDueOnDate,
  isHabitDueOnWeekday,
  parseHabitDayDecisions,
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

  it("shows a weekly habit only on its configured weekdays", () => {
    const habit = { frequency: "weekly", targetDays: [1, 3, 5] };

    assert.equal(isHabitDueOnDate(habit, "2026-07-27"), true);
    assert.equal(isHabitDueOnDate(habit, "2026-07-28"), false);
  });

  it("shows a monthly habit only on the first day of the month", () => {
    const habit = { frequency: "monthly", targetDays: [] };

    assert.equal(isHabitDueOnDate(habit, "2026-08-01"), true);
    assert.equal(isHabitDueOnDate(habit, "2026-08-02"), false);
  });

  it("describes frequency and selected weekdays in Brazilian Portuguese", () => {
    assert.equal(formatHabitFrequency({ frequency: "daily", targetDays: [] }), "Todos os dias");
    assert.equal(formatHabitFrequency({ frequency: "weekly", targetDays: [1, 3, 5] }), "Seg, qua e sex");
    assert.equal(formatHabitFrequency({ frequency: "monthly", targetDays: [] }), "Todo mês, dia 1");
  });

  it("can describe habit schedule in English when the product language changes", () => {
    assert.equal(formatHabitFrequency({ frequency: "daily", targetDays: [] }, "en"), "Every day");
    assert.equal(formatHabitFrequency({ frequency: "weekly", targetDays: [1, 3, 5] }, "en"), "Mon, wed and fri");
    assert.equal(formatHabitTimeOfDay("evening", "en"), "Evening");
  });

  it("separates due habits into actionable day states without leaking habits from another weekday", () => {
    const habits = [
      { id: "done", frequency: "daily", targetDays: [], targetCount: 1, completions: [{ date: "2026-07-27" }] },
      { id: "pending", frequency: "weekly", targetDays: [1], targetCount: 1, completions: [] },
      { id: "postponed", frequency: "daily", targetDays: [], targetCount: 1, completions: [] },
      { id: "skipped", frequency: "daily", targetDays: [], targetCount: 1, completions: [] },
      { id: "tuesday", frequency: "weekly", targetDays: [2], targetCount: 1, completions: [] },
    ];

    const result = categorizeHabitsForDate(habits, "2026-07-27", {
      postponed: "postponed",
      skipped: "skipped",
    });

    assert.deepEqual(result.done.map((habit) => habit.id), ["done"]);
    assert.deepEqual(result.pending.map((habit) => habit.id), ["pending"]);
    assert.deepEqual(result.postponed.map((habit) => habit.id), ["postponed"]);
    assert.deepEqual(result.skipped.map((habit) => habit.id), ["skipped"]);
  });

  it("turns a catalog suggestion into a ready-to-review daily draft", () => {
    const draft = buildHabitDraftFromSuggestion({
      title: "Caminhada curta",
      icon: "🚶",
      category: "health",
      timeOfDay: "afternoon",
      durationMinutes: 20,
    });

    assert.equal(draft.title, "Caminhada curta");
    assert.equal(draft.frequency, "daily");
    assert.equal(draft.timeOfDay, "afternoon");
    assert.equal(draft.durationMinutes, 20);
    assert.equal(formatHabitTimeOfDay(draft.timeOfDay), "Tarde");
  });

  it("ignores stale or invalid local day decisions", () => {
    assert.deepEqual(
      parseHabitDayDecisions('{"walk":"postponed","water":"skipped","old":"done","broken":42}'),
      { walk: "postponed", water: "skipped" },
    );
    assert.deepEqual(parseHabitDayDecisions("not-json"), {});
  });
});

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildPlannerAgendaSlots,
  buildPlannerAISuggestionExistingBlocks,
  buildTimelineBlockInput,
  buildGoogleCalendarTaskId,
  buildDefaultSelectedAdaptationIds,
  formatTimelineDurationLabel,
  getDayStructurePresentation,
  parseGoogleCalendarTaskId,
  resolveTaskCardSwipeAction,
  resolveTaskCardSecondaryActions,
  resolvePlannerTaskAdaptability,
  canApplyPlannerAIAdjustment,
  resolvePlannerBlockDate,
  shouldNavigateAgendaBySwipe,
  stripGoogleCalendarTaskId,
  stripGoogleCalendarTaskTitle,
  type FormStateLike,
  type PlannerTaskLike,
  resolveTimelinePolicySelection,
} from "./planner-page.helpers.ts";

describe("planner page helpers", () => {
  const baseForm: FormStateLike = {
    title: "Consulta médica",
    time: "14:30",
    category: "pessoal",
    energyLevel: 4,
  };

  it("builds timeline block payloads", () => {
    const result = buildTimelineBlockInput(baseForm);

    assert.deepEqual(result, {
      title: "Consulta médica",
      startTime: "14:30",
      endTime: "15:00",
      category: "pessoal",
      intensity: "P",
      energyLevel: "alta",
      status: "planned",
    });

    const updateResult = buildTimelineBlockInput(baseForm, {
      id: "550e8400-e29b-41d4-a716-446655440000",
      fallbackIntensity: "L",
      fallbackStatus: "completed",
    });

    assert.equal(updateResult.id, "550e8400-e29b-41d4-a716-446655440000");
    assert.equal(updateResult.intensity, "P");
    assert.equal(updateResult.status, "completed");
  });

  it("can transfer Airia suggestions to user-owned planner blocks after editing", () => {
    const result = buildTimelineBlockInput(baseForm, {
      id: "550e8400-e29b-41d4-a716-446655440000",
      isAiSuggested: false,
      aiReasoning: null,
    });

    assert.equal(result.isAiSuggested, false);
    assert.equal(result.aiReasoning, null);
  });

  it("includes planner metadata when the form provides it", () => {
    const result = buildTimelineBlockInput({
      ...baseForm,
      noteMode: "checklist",
      note: "Levar os documentos.",
      checklist: [
        { id: "item-1", text: "Separar RG", done: false },
        { id: "item-2", text: "Confirmar endereco", done: true },
      ],
      recurring: {
        enabled: true,
        frequency: "weekly",
        days: [0, 2],
        everyNDays: 1,
      },
      lastResetDate: "2026-04-12",
    });

    assert.equal(result.noteMode, "checklist");
    assert.equal(result.note, "Levar os documentos.");
    assert.equal(result.checklist?.[1]?.done, true);
    assert.equal(result.recurring?.frequency, "weekly");
    assert.equal(result.energyLevel, "alta");
    assert.equal(result.lastResetDate, "2026-04-12");
  });

  it("maps medium energy to medium intensity", () => {
    const result = buildTimelineBlockInput(
      {
        ...baseForm,
        title: "Respirar fundo",
        energyLevel: 3,
      },
      { fallbackIntensity: "L" },
    );

    assert.equal(result.intensity, "M");
  });

  it("keeps home commitments separate from personal commitments", () => {
    assert.equal(buildTimelineBlockInput({ ...baseForm, category: "casa" }).category, "casa");
    const slots = buildPlannerAgendaSlots([
      {
        id: "home",
        title: "Regar plantas",
        time: "09:00",
        endTime: "09:30",
        done: false,
        category: "casa",
      },
    ]);
    const taskSlot = slots.find((slot) => slot.kind === "task");
    assert.equal(taskSlot?.kind, "task");
    if (taskSlot?.kind === "task") assert.equal(taskSlot.category, "casa");
  });

  it("uses the form date for planner submissions when present", () => {
    assert.equal(resolvePlannerBlockDate("2026-04-20", "2026-04-11"), "2026-04-20");
    assert.equal(resolvePlannerBlockDate("", "2026-04-11"), "2026-04-11");
  });

  it("formats timeline duration labels", () => {
    assert.equal(formatTimelineDurationLabel("08:00", "08:30"), "30 min");
    assert.equal(formatTimelineDurationLabel("09:30", "10:30"), "1h");
    assert.equal(formatTimelineDurationLabel("12:00", "13:30"), "1h30");
  });

  it("builds an hourly empty agenda from 06:00 to 23:00", () => {
    const slots = buildPlannerAgendaSlots([]);

    assert.equal(slots.length, 18);
    assert.equal(slots[0]?.time, "06:00");
    assert.equal(slots.at(-1)?.time, "23:00");
    assert.ok(slots.every((slot) => slot.kind === "empty"));
  });

  it("places tasks into the continuous agenda grid", () => {
    const tasks: PlannerTaskLike[] = [
      {
        id: "2",
        title: "Análise de dados",
        time: "14:00",
        endTime: "16:00",
        done: false,
        category: "trabalho",
      },
      {
        id: "1",
        title: "Meditação matinal",
        time: "08:00",
        endTime: "08:30",
        done: false,
        category: "autocuidado",
      },
    ];

    const slots = buildPlannerAgendaSlots(tasks);
    const taskSlots = slots.filter((slot) => slot.kind === "task");

    assert.equal(slots.length, 18);
    assert.equal(taskSlots[0]?.kind, "task");
    assert.equal(taskSlots[0]?.time, "08:00");
    assert.equal(taskSlots[1]?.kind, "task");
    assert.equal(taskSlots[1]?.time, "14:00");

    if (taskSlots[1]?.kind === "task") {
      assert.equal(taskSlots[1].durationLabel, "2h");
      assert.equal(taskSlots[1].category, "trabalho");
    }
  });

  it("keeps horizontal card actions from being confused with vertical scroll", () => {
    assert.equal(resolveTaskCardSwipeAction({ deltaX: -92, deltaY: 12 }), "complete");
    assert.equal(resolveTaskCardSwipeAction({ deltaX: 96, deltaY: 10 }), "delete");
    assert.equal(resolveTaskCardSwipeAction({ deltaX: -70, deltaY: 4 }), null);
    assert.equal(resolveTaskCardSwipeAction({ deltaX: -110, deltaY: 100 }), null);
  });

  it("maps the visible timing policy to a safe backend payload", () => {
    assert.deepEqual(resolveTimelinePolicySelection("fixed"), {
      temporalPolicy: "fixed",
      adaptationPermission: "protected",
    });
    assert.deepEqual(resolveTimelinePolicySelection("windowed"), {
      temporalPolicy: "windowed",
      adaptationPermission: "preview",
    });
    assert.deepEqual(resolveTimelinePolicySelection("flexible"), {
      temporalPolicy: "flexible",
      adaptationPermission: "eligible",
    });

    const payload = buildTimelineBlockInput({
      ...baseForm,
      temporalPolicy: "fixed",
      adaptabilitySource: "manual",
      adaptabilityConfidence: 1,
    });
    assert.equal(payload.temporalPolicy, "fixed");
    assert.equal(payload.adaptationPermission, "protected");
    assert.equal(payload.adaptabilitySource, "manual");
    assert.equal(payload.adaptabilityConfidence, 1);
  });

  it("leaves automatic classification unset until the person corrects it", () => {
    const payload = buildTimelineBlockInput(baseForm);
    assert.equal("temporalPolicy" in payload, false);
    assert.equal("adaptationPermission" in payload, false);
    assert.equal("adaptabilitySource" in payload, false);
    assert.equal("adaptabilityConfidence" in payload, false);
  });

  it("never preselects a protected anchor in the adaptation preview", () => {
    const selected = buildDefaultSelectedAdaptationIds(
      [
        { id: "move-fixed", targetId: "fixed-1", type: "move", requiresConfirmation: true },
        { id: "move-flex", targetId: "flex-1", type: "move", requiresConfirmation: true },
        { id: "keep-flex", targetId: "flex-1", type: "keep", requiresConfirmation: true },
      ],
      [{ id: "fixed-1" }],
    );

    assert.deepEqual([...selected], ["move-flex"]);
  });

  it("presents the day shape without turning protected anchors into suggestions", () => {
    const presentation = getDayStructurePresentation({
      mode: "mixed",
      initiativeLevel: "collaborate",
      freedomScore: 58,
      scheduledMinutes: 300,
      protectedMinutes: 180,
      flexibleMinutes: 120,
      freeMinutes: 420,
      protectedAnchors: [{ id: "fixed-1", title: "Expediente", startTime: "09:00", endTime: "12:00", source: "planner" }],
    });

    assert.equal(presentation.title, "Dia misto");
    assert.equal(presentation.freeTimeLabel, "7h livres");
    assert.match(presentation.explanation, /protege.*adapta/i);
  });

  it("exposes the secondary action that matches each planner task source", () => {
    assert.deepEqual(
      resolveTaskCardSecondaryActions({ source: "gcal", done: false }),
      { canConvertToTask: true, canSnooze: false },
    );
    assert.deepEqual(
      resolveTaskCardSecondaryActions({ source: "planner", done: false, persistentReminderEnabled: true }),
      { canConvertToTask: false, canSnooze: true },
    );
    assert.deepEqual(
      resolveTaskCardSecondaryActions({ source: "planner", done: false, persistentReminderEnabled: false }),
      { canConvertToTask: false, canSnooze: false },
    );
    assert.deepEqual(
      resolveTaskCardSecondaryActions({ source: "gcal", done: true }),
      { canConvertToTask: false, canSnooze: false },
    );
  });

  it("only changes planner day on deliberate horizontal agenda swipes", () => {
    assert.equal(shouldNavigateAgendaBySwipe({ deltaX: 180, deltaY: 30 }), true);
    assert.equal(shouldNavigateAgendaBySwipe({ deltaX: -190, deltaY: 42 }), true);
    assert.equal(shouldNavigateAgendaBySwipe({ deltaX: 150, deltaY: 10 }), false);
    assert.equal(shouldNavigateAgendaBySwipe({ deltaX: 180, deltaY: 92 }), false);
  });

  it("normalizes Google Calendar task labels for editing and syncing", () => {
    const multiCalendarId = buildGoogleCalendarTaskId("terapia@example.com", "abc/123");
    assert.deepEqual(parseGoogleCalendarTaskId(multiCalendarId), {
      calendarId: "terapia@example.com",
      eventId: "abc/123",
    });
    assert.deepEqual(parseGoogleCalendarTaskId("gcal-abc123"), {
      calendarId: "primary",
      eventId: "abc123",
    });
    assert.equal(stripGoogleCalendarTaskId(multiCalendarId), "abc/123");
    assert.equal(stripGoogleCalendarTaskId("gcal-abc123"), "abc123");
    assert.equal(stripGoogleCalendarTaskId("local-task"), "local-task");
    assert.equal(stripGoogleCalendarTaskTitle("📅 Reunião com equipe"), "Reunião com equipe");
    assert.equal(stripGoogleCalendarTaskTitle("   "), "Evento");
  });

  it("keeps Google Calendar anchors protected through the AI suggestion payload", () => {
    const adaptability = resolvePlannerTaskAdaptability({
      source: "gcal",
      gcalEventId: "google-event-1",
      temporalPolicy: "flexible",
      adaptationPermission: "eligible",
    });
    assert.deepEqual(adaptability, {
      temporalPolicy: "fixed",
      adaptationPermission: "protected",
    });

    const blocks = buildPlannerAISuggestionExistingBlocks([{
      id: "gcal:google-event-1",
      title: "Reunião externa",
      time: "09:00",
      endTime: "10:00",
      done: false,
      source: "gcal",
      gcalEventId: "google-event-1",
      temporalPolicy: "fixed",
      adaptationPermission: "protected",
      category: "trabalho",
      intensity: "P",
    }]);

    assert.equal(blocks[0]?.gcalEventId, "google-event-1");
    assert.equal(blocks[0]?.temporalPolicy, "fixed");
    assert.equal(blocks[0]?.adaptationPermission, "protected");
    assert.equal(canApplyPlannerAIAdjustment(blocks[0]), false);
  });

  it("allows stale AI mutations only for non-protected planner blocks", () => {
    assert.equal(canApplyPlannerAIAdjustment({
      temporalPolicy: "fixed",
      adaptationPermission: "eligible",
    }), false);
    assert.equal(canApplyPlannerAIAdjustment({
      temporalPolicy: "flexible",
      adaptationPermission: "protected",
    }), false);
    assert.equal(canApplyPlannerAIAdjustment({
      temporalPolicy: "flexible",
      adaptationPermission: "eligible",
    }), true);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildPlannerAgendaSlots,
  buildTimelineBlockInput,
  formatTimelineDurationLabel,
  resolveTaskCardSwipeAction,
  resolvePlannerBlockDate,
  shouldNavigateAgendaBySwipe,
  type FormStateLike,
  type PlannerTaskLike,
} from "./planner-page.helpers.ts";

describe("planner page helpers", () => {
  const baseForm: FormStateLike = {
    title: "Consulta médica",
    time: "14:30",
    category: "pessoal",
    energyLevel: "alta",
  };

  it("builds timeline block payloads", () => {
    const result = buildTimelineBlockInput(baseForm);

    assert.deepEqual(result, {
      title: "Consulta médica",
      startTime: "14:30",
      endTime: "15:00",
      category: "pessoal",
      intensity: "P",
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
        energyLevel: "media",
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

  it("only changes planner day on deliberate horizontal agenda swipes", () => {
    assert.equal(shouldNavigateAgendaBySwipe({ deltaX: 130, deltaY: 20 }), true);
    assert.equal(shouldNavigateAgendaBySwipe({ deltaX: -140, deltaY: 40 }), true);
    assert.equal(shouldNavigateAgendaBySwipe({ deltaX: 105, deltaY: 10 }), false);
    assert.equal(shouldNavigateAgendaBySwipe({ deltaX: 150, deltaY: 120 }), false);
  });
});

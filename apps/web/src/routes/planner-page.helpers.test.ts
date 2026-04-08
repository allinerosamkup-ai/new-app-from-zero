import assert from "node:assert/strict";

import {
  buildPlannerAgendaSlots,
  buildTimelineBlockInput,
  formatTimelineDurationLabel,
  type FormStateLike,
  type PlannerTaskLike,
} from "./planner-page.helpers.ts";

const baseForm: FormStateLike = {
  title: "Consulta médica",
  time: "14:30",
  category: "pessoal",
  energyLevel: "alta",
};

{
  const result = buildTimelineBlockInput(baseForm);

  assert.deepEqual(result, {
    title: "Consulta médica",
    startTime: "14:30",
    endTime: "15:00",
    category: "pessoal",
    intensity: "P",
    status: "planned",
  });
}

{
  const result = buildTimelineBlockInput(baseForm, {
    id: "550e8400-e29b-41d4-a716-446655440000",
    fallbackIntensity: "L",
    fallbackStatus: "completed",
  });

  assert.equal(result.id, "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(result.intensity, "P");
  assert.equal(result.status, "completed");
}

{
  const result = buildTimelineBlockInput(
    {
      ...baseForm,
      title: "Respirar fundo",
      energyLevel: "media",
    },
    { fallbackIntensity: "L" },
  );

  assert.equal(result.intensity, "M");
}

{
  assert.equal(formatTimelineDurationLabel("08:00", "08:30"), "30 min");
  assert.equal(formatTimelineDurationLabel("09:30", "10:30"), "1h");
  assert.equal(formatTimelineDurationLabel("12:00", "13:30"), "1h30");
}

{
  const slots = buildPlannerAgendaSlots([]);

  assert.equal(slots.length, 5);
  assert.deepEqual(
    slots.map((slot) => slot.time),
    ["08:00", "10:30", "13:00", "15:30", "18:00"],
  );
  assert.ok(slots.every((slot) => slot.kind === "empty"));
}

{
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

  assert.equal(slots.length, 2);
  assert.equal(slots[0]?.kind, "task");
  assert.equal(slots[0]?.time, "08:00");
  assert.equal(slots[1]?.kind, "task");
  assert.equal(slots[1]?.time, "14:00");

  if (slots[1]?.kind === "task") {
    assert.equal(slots[1].durationLabel, "2h");
    assert.equal(slots[1].category, "trabalho");
  }
}

console.log("planner-page.helpers tests passed");

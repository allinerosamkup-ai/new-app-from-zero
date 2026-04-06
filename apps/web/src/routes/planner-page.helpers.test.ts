import assert from "node:assert/strict";

import { buildTimelineBlockInput, type FormStateLike } from "./planner-page.helpers.ts";

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

console.log("planner-page.helpers tests passed");

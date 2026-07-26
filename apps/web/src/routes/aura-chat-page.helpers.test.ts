import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { buildAuraObjectiveInput, buildTimelineBlocks, buildTimelineSyncRequests, hasSubstantiveRoutineSource } from "./aura-chat-page.helpers.ts";

describe("aura chat page helpers", () => {
  it("distinguishes a bare routine request from real source material", () => {
    assert.equal(hasSubstantiveRoutineSource("Monte minha rotina para mim."), false);
    assert.equal(hasSubstantiveRoutineSource("Segunda: academia às 8h\nTerça: terapia às 16h\nQuero caminhar três vezes por semana."), true);
    assert.equal(hasSubstantiveRoutineSource("Trabalho de segunda a sexta e preciso organizar uma rotina que inclua estudo, academia, mercado e os cuidados da casa sem sobrecarregar meus dias. Também tenho terapia às terças."), true);
    assert.equal(
      hasSubstantiveRoutineSource("Eu preciso criar uma rotina onde eu crie todo dia ou pelo menos três vezes por semana um vídeo dark e também faça pelo menos três publicações no meu perfil de cabeleireiro."),
      true,
    );
  });

  it("builds a single timeline block with the default start time", () => {
    const blocks = buildTimelineBlocks(
      {
        title: "Revisar agenda",
      },
      new Date(2026, 3, 6, 23, 30, 0),
    );

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.date, "2026-04-06");
    assert.equal(blocks[0]?.startTime, "09:00");
  });

  it("expands recurring timeline blocks by weekday", () => {
    const blocks = buildTimelineBlocks(
      {
        title: "Ginástica",
        category: "saúde",
        recurrence: {
          startDate: "2026-04-01",
          endDate: "2026-04-10",
          weekdays: ["seg", "qua", "sex"],
          startTime: "07:00",
        },
      },
      new Date(2026, 3, 1, 8, 0, 0),
    );

    assert.deepEqual(
      blocks.map((block) => ({ date: block.date, title: block.title, startTime: block.startTime })),
      [
        { date: "2026-04-01", title: "Ginástica", startTime: "07:00" },
        { date: "2026-04-03", title: "Ginástica", startTime: "07:00" },
        { date: "2026-04-06", title: "Ginástica", startTime: "07:00" },
        { date: "2026-04-08", title: "Ginástica", startTime: "07:00" },
        { date: "2026-04-10", title: "Ginástica", startTime: "07:00" },
      ],
    );
  });

  it("builds force-save sync requests for command-center planner actions", () => {
    const requests = buildTimelineSyncRequests([
      {
        date: "2026-04-12",
        title: "Ligar para o medico",
        startTime: "09:00",
        endTime: "09:30",
        category: "pessoal",
        intensity: "M",
      },
    ]);

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.forceSave, true);
    assert.equal(requests[0]?.blocks[0]?.isAiSuggested, true);
  });

  it("rejects empty objective payloads instead of inventing generic titles", () => {
    assert.equal(buildAuraObjectiveInput({}), null);
    assert.equal(buildAuraObjectiveInput({ items: ["Review"] }), null);
  });

  it("builds objectives only from an explicit title and keeps checklist items", () => {
    assert.deepEqual(buildAuraObjectiveInput({
      title: "Prepare proposal",
      items: ["Review numbers", { title: "Send draft" }],
    }), {
      title: "Prepare proposal",
      itemTitles: ["Review numbers", "Send draft"],
    });
  });
});

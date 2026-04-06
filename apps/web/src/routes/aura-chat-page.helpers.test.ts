import assert from "node:assert/strict";

import { buildTimelineBlocks } from "./aura-chat-page.helpers.ts";

{
  const blocks = buildTimelineBlocks(
    {
      title: "Revisar agenda",
    },
    new Date(2026, 3, 6, 23, 30, 0),
  );

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.date, "2026-04-06");
  assert.equal(blocks[0]?.startTime, "09:00");
}

{
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
}

console.log("aura-chat-page.helpers tests passed");

import assert from "node:assert/strict";

import { getClientDayContext, getLocalDateKey, getLocalNoonDate } from "./day-context.ts";

{
  const reference = new Date(2026, 3, 6, 23, 30, 0);
  const context = getClientDayContext(reference);

  assert.equal(getLocalDateKey(reference), "2026-04-06");
  assert.equal(context.localDate, "2026-04-06");
}

{
  const noonDate = getLocalNoonDate(new Date(2026, 3, 6, 1, 5, 10));

  assert.equal(noonDate.getFullYear(), 2026);
  assert.equal(noonDate.getMonth(), 3);
  assert.equal(noonDate.getDate(), 6);
  assert.equal(noonDate.getHours(), 12);
  assert.equal(noonDate.getMinutes(), 0);
  assert.equal(noonDate.getSeconds(), 0);
}

console.log("day-context tests passed");

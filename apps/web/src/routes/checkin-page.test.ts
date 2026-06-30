import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  INITIAL_EMOTIONS_SELECTED,
  toggleEmotionSelection,
} from "./checkin-page";

describe("checkin page emotion selection", () => {
  it("starts with no preselected emotion", () => {
    assert.deepEqual(INITIAL_EMOTIONS_SELECTED, []);
  });

  it("allows removing the last selected emotion", () => {
    assert.deepEqual(toggleEmotionSelection(["radiant"], "radiant"), []);
  });

  it("does not add more than three emotions", () => {
    assert.deepEqual(
      toggleEmotionSelection(["calm", "happy", "tired"], "focused"),
      ["calm", "happy", "tired"],
    );
  });
});

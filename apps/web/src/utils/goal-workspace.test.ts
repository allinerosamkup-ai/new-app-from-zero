import { describe, expect, it } from "vitest";

import {
  buildGoalNotePatch,
  resolveGoalNoteDraft,
  shouldShowGoalPathPane,
} from "./goal-workspace";

describe("goal workspace note + split", () => {
  it("uses description as the canonical note", () => {
    expect(resolveGoalNoteDraft({
      description: "  conversar com a cliente  ",
      progress: "Em andamento",
      currentReality: "ainda sem proposta",
    })).toBe("conversar com a cliente");
  });

  it("ignores the placeholder progress label when there is no description", () => {
    expect(resolveGoalNoteDraft({ progress: "Em andamento" })).toBe("");
    expect(resolveGoalNoteDraft({ progress: "In progress" })).toBe("");
  });

  it("keeps a real progress text when description is empty", () => {
    expect(resolveGoalNoteDraft({ progress: "anotei o telefone da clínica" })).toBe(
      "anotei o telefone da clínica",
    );
  });

  it("saves the note only as description so PATCH stays on the existing contract", () => {
    expect(buildGoalNotePatch("  preciso de um texto menor  ")).toEqual({
      description: "preciso de um texto menor",
    });
  });

  it("shows the path pane when there is a split to inspect", () => {
    expect(shouldShowGoalPathPane({ subtasks: [{ id: "a" }, { id: "b" }] })).toBe(true);
    expect(shouldShowGoalPathPane({ milestones: [{ id: "m" }] })).toBe(true);
    expect(shouldShowGoalPathPane({ subtasks: [{ id: "a" }] })).toBe(false);
  });
});

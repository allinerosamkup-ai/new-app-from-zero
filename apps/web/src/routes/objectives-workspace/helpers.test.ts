import { describe, expect, it } from "vitest";

import {
  buildTaskTree,
  effortToMinutes,
  isAiBrokenDown,
  pickActiveGoal,
  previewToSubgoals,
  readComposerMode,
  readWideLayout,
  resolveNotes,
} from "./helpers";
import type { Goal } from "../../features/aura/types";

const goal = (partial: Partial<Goal> = {}): Goal => ({
  id: "g1",
  title: "Lançar app",
  progress: "",
  completedPct: 0,
  subtasks: [],
  ...partial,
});

describe("objectives workspace helpers", () => {
  it("keeps desktop split only after matchMedia agrees", () => {
    expect(readWideLayout({ matches: true })).toBe(true);
    expect(readWideLayout({ matches: false })).toBe(false);
  });

  it("drops paused ids and follows the focused goal", () => {
    const active = [{ id: "walk" }, { id: "desk" }];
    expect(pickActiveGoal(active, "desk")?.id).toBe("desk");
    expect(pickActiveGoal(active, "paused")?.id).toBe("walk");
  });

  it("builds L1 milestones with L2 actions and L3 children", () => {
    const tree = buildTaskTree(goal({
      milestones: [{ id: "m1", title: "Preparar", order: 0, doneWhen: "pronto" }],
      subtasks: [
        { id: "a1", title: "Abrir conta", done: false, milestoneId: "m1", effortSize: "medium", doneWhen: "conta criada" },
        { id: "a2", title: "Anexar prints", done: false, parentId: "a1", effortSize: "small", doneWhen: "prints na pasta" },
      ],
    }));
    expect(tree[0]?.level).toBe(1);
    expect(tree[0]?.children[0]?.level).toBe(2);
    expect(tree[0]?.children[0]?.children[0]?.level).toBe(3);
    expect(tree[0]?.children[0]?.estimatedMinutes).toBe(60);
  });

  it("marks AI-broken-down goals and maps preview tasks without L1 rows", () => {
    expect(isAiBrokenDown(goal({ pathStatus: "ready", subtasks: [{ id: "a", title: "x", done: false, aiGenerated: true }] }))).toBe(true);
    expect(previewToSubgoals([
      { id: "m1", title: "Etapa", doneWhen: "ok", estimatedMinutes: 60, effortSize: "medium", level: 1, basedOn: "inferred" },
      { id: "a1", title: "Abrir conta", doneWhen: "conta criada", estimatedMinutes: 60, effortSize: "medium", level: 2, milestoneId: "m1", basedOn: "inferred" },
    ]).map((item) => item.title)).toEqual(["Abrir conta"]);
  });

  it("reads composer deep-links and falls back description to a note", () => {
    expect(readComposerMode({ composer: "ai-goal", noteDraft: "curso" }).mode).toBe("ai-goal");
    expect(resolveNotes(goal({ description: "Ideia solta" }))[0]?.content).toBe("Ideia solta");
  });
});

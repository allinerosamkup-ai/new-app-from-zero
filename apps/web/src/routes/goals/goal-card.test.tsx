import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../i18n")>();
  return { ...actual, useLocalizedCopy: () => (pt: string) => pt };
});

import { GoalCard } from "./goal-card";
import type { GoalLike } from "./goal-model";

const goal: GoalLike = {
  id: "goal-1",
  title: "Retomar caminhada",
  completedPct: 0,
  subtasks: [{ id: "a1", title: "Colocar o tênis na porta", done: false, doneWhen: "o tênis estiver na porta" }],
  description: "quero caminhar de manhã",
};

function noopAsync() {
  return Promise.resolve();
}

describe("GoalCard Elisi split", () => {
  it("shows note and current action at the same time", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GoalCard
          goal={goal}
          paused={false}
          focused
          loadingSuggestion={false}
          suggestionDraft={[]}
          completingActionId={null}
          onToggleAction={noopAsync}
          onAddAction={noopAsync}
          onRequestSuggestion={noopAsync}
          onAcceptSuggestion={noopAsync}
          onUpdateAction={noopAsync}
          onAdvance={noopAsync}
          onConfirmRevision={noopAsync}
          onEditResult={noopAsync}
          onEditDeadline={noopAsync}
          onSaveNote={noopAsync}
          onPause={() => {}}
          onArchive={noopAsync}
          onDelete={noopAsync}
        />,
      );
    });

    const note = host.querySelector('textarea[aria-label="Nota ligada a este objetivo"]');
    const complete = host.querySelector('button[aria-label="Marcar ação como concluída"]');
    const agora = host.querySelector(".goal-pane-agora");
    const notePane = host.querySelector(".goal-pane-note");
    expect(note).not.toBeNull();
    expect(complete).not.toBeNull();
    expect(host.textContent).toContain("Colocar o tênis na porta");
    expect(host.textContent).toContain("Pronto quando:");
    expect(host.textContent).toContain("o tênis estiver na porta");
    expect(host.textContent).toContain("quero caminhar de manhã");
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(agora && notePane && Boolean(agora.compareDocumentPosition(notePane) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    await act(async () => root.unmount());
  });
});

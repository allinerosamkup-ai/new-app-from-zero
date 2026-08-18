import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("telemetry instrumentation coverage", () => {
  it("covers the active core journeys with versioned semantic events", () => {
    const expectations: Array<[string, string[]]> = [
      ["src/routes/home-page.tsx", ["home.opened.v1", "home.next_step_selected.v1"]],
      ["src/routes/insights-page.tsx", ["patterns.opened.v1", "patterns.report_requested.v1", "patterns.report_resolved.v1"]],
      ["src/routes/journal-page.tsx", ["journal.opened.v1", "journal.entry_saved.v1"]],
      ["src/routes/goals-page.tsx", ["goals.opened.v1", "goal.created.v1", "goal.action_changed.v1"]],
      ["src/lib/airia-reading.ts", ["decision.presented.v1", "decision.feedback_submitted.v1"]],
    ];

    for (const [file, eventNames] of expectations) {
      const content = source(file);
      expect(content).toContain("trackProductEvent");
      for (const eventName of eventNames) expect(content).toContain(eventName);
    }
  });

  it("keeps the product-event catalog focused on actions rather than raw content", () => {
    const trackSource = source("src/lib/track.ts");
    expect(trackSource).toContain("Eventos semânticos e minimizados");
    expect(trackSource).toContain("airia.product-event-queue.v1");
    expect(trackSource).not.toContain("journalContent");
    expect(trackSource).not.toContain("voiceTranscript");
  });
});

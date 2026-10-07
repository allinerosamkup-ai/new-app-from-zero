import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { buildPeriodReportData } from "../utils/period-report";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import { WeeklyShareCard } from "./WeeklyShareCard";

afterEach(async () => { await i18n.changeLanguage("pt"); });

describe("reported values in share summary", () => {
  it("keeps one real 5/5 check-in separate from the insufficient phase's sentinel zeros", async () => {
    const history = [{ date: "2026-10-05", humor: 5, energia: 5 }];
    const report = computeMoodCycle(history);
    expect(report.phase).toBe("insufficient_data");
    expect(report.avgMood7d).toBe(0);
    const descriptive = buildPeriodReportData(history, { start: "2026-09-29", end: "2026-10-05", label: "week" });
    for (const language of ["pt", "en"]) {
      await i18n.changeLanguage(language);
      const html = renderToStaticMarkup(<WeeklyShareCard phaseName={i18n.t(`phases.${report.phase}.label`)} phaseColor="#abc" avgMood={descriptive.avgMood} avgEnergy={descriptive.avgEnergy} />);
      expect(html.match(/5\.0\/10/g)).toHaveLength(2);
      expect(html).not.toContain("insufficient_data");
      expect(html).not.toContain("0.0/10");
      expect(html).toContain(language === "en" ? "Your rhythm" : "Seu ritmo");
      expect(html).toContain("width:50%");
    }
  });

  it("shows unavailable for missing/invalid values without numeric zero or overflowing bars", async () => {
    await i18n.changeLanguage("en");
    for (const invalid of [null, 0, NaN, Infinity, 11]) {
      const html = renderToStaticMarkup(<WeeklyShareCard phaseName="Still calibrating" phaseColor="#abc" avgMood={invalid} avgEnergy={10} />);
      expect(html).toContain("Unavailable");
      expect(html).toContain("10.0/10");
      expect(html).toContain("width:100%");
      expect(html).not.toContain("width:200%");
    }
  });

  it("shares localized labels and reported values on the same 1–10 scale", async () => {
    await i18n.changeLanguage("en");
    const share = vi.fn().mockResolvedValue(undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, "share");
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => { root.render(<WeeklyShareCard phaseName="Still calibrating" phaseColor="#abc" avgMood={5} avgEnergy={null} insight="User content stays original." />); });
      await act(async () => { container.querySelector("button")!.click(); });
      const payload = share.mock.calls[0][0];
      expect(payload.text).toContain("Average mood: 5.0/10");
      expect(payload.text).toContain("Average energy: Unavailable");
      expect(payload.text).toContain("User content stays original.");
      expect(payload.text).not.toContain("Humor médio");
      expect(payload.text).not.toContain("/5");
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
      if (original) Object.defineProperty(navigator, "share", original);
      else Reflect.deleteProperty(navigator, "share");
    }
  });
});

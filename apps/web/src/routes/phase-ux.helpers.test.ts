import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  computeFirstInsight,
  resolveHomeDensity,
  shouldOfferWeeklySummary,
  weekKeyOf,
} from "./phase-ux.helpers";
import type { CheckinHistoryLike } from "./checkin-page.helpers";

function entry(date: string, humor: number, energia: number): CheckinHistoryLike {
  return { date, humor, energia };
}

describe("resolveHomeDensity", () => {
  it("uses minimal mode in low phases", () => {
    const low = resolveHomeDensity("low");
    assert.equal(low.mode, "minimal");
    assert.equal(low.hidePressureCards, true);
    assert.ok(low.primaryActionMinHeight > 56);
    assert.ok(low.toneNote);

    assert.equal(resolveHomeDensity("depleted").mode, "minimal");
  });

  it("uses expanded mode in high phases", () => {
    assert.equal(resolveHomeDensity("elevated").mode, "expanded");
    assert.equal(resolveHomeDensity("flowing").mode, "expanded");
    assert.equal(resolveHomeDensity("flowing").hidePressureCards, false);
  });

  it("uses default mode otherwise", () => {
    assert.equal(resolveHomeDensity("stable").mode, "default");
    assert.equal(resolveHomeDensity("mixed").mode, "default");
    assert.equal(resolveHomeDensity("insufficient_data").mode, "default");
  });
});

describe("computeFirstInsight", () => {
  it("returns null with fewer than 7 days", () => {
    const history = [
      entry("2026-06-01", 7, 7),
      entry("2026-06-02", 3, 3),
      entry("2026-06-03", 6, 6),
    ];
    assert.equal(computeFirstInsight(history, "2026-06-12"), null);
  });

  it("detects a consistently heavy weekday", () => {
    // 2026-06-02 e 2026-06-09 são terças (getUTCDay === 2)
    const history = [
      entry("2026-06-01", 7, 7), // seg
      entry("2026-06-02", 3, 3), // ter (baixa)
      entry("2026-06-03", 7, 7), // qua
      entry("2026-06-04", 7, 7), // qui
      entry("2026-06-05", 8, 8), // sex
      entry("2026-06-08", 7, 7), // seg
      entry("2026-06-09", 3, 3), // ter (baixa)
    ];
    const insight = computeFirstInsight(history, "2026-06-12");
    assert.equal(insight?.kind, "weekday_low");
    assert.ok(insight?.headline.includes("terças"));
  });

  it("detects a consistently strong weekday", () => {
    // Só sexta (06-05, 06-12) tem 2+ amostras; demais 1 amostra cada
    const history = [
      entry("2026-06-01", 6, 6), // seg
      entry("2026-06-02", 6, 6), // ter
      entry("2026-06-03", 6, 6), // qua
      entry("2026-06-04", 6, 6), // qui
      entry("2026-06-05", 9, 9), // sex (alta)
      entry("2026-06-06", 6, 6), // sáb
      entry("2026-06-12", 9, 9), // sex (alta)
    ];
    const insight = computeFirstInsight(history, "2026-06-12");
    assert.equal(insight?.kind, "weekday_high");
    assert.ok(insight?.headline.includes("sextas"));
  });

  it("detects energy lagging behind mood when no weekday pattern stands out", () => {
    // 7 dias de semana distintos: nenhum weekday com 2+ amostras
    const history = [
      entry("2026-06-01", 7, 4),
      entry("2026-06-02", 7, 4),
      entry("2026-06-03", 7, 4),
      entry("2026-06-04", 7, 4),
      entry("2026-06-05", 7, 4),
      entry("2026-06-06", 7, 4),
      entry("2026-06-07", 7, 4),
    ];
    const insight = computeFirstInsight(history, "2026-06-12");
    assert.equal(insight?.kind, "energy_behind");
  });

  it("returns null when nothing concrete stands out", () => {
    const history = [
      entry("2026-06-01", 6, 6),
      entry("2026-06-02", 6, 6),
      entry("2026-06-03", 6, 6),
      entry("2026-06-04", 6, 6),
      entry("2026-06-05", 6, 6),
      entry("2026-06-06", 6, 6),
      entry("2026-06-07", 6, 6),
    ];
    assert.equal(computeFirstInsight(history, "2026-06-12"), null);
  });

  it("ignores days outside the 8-week window", () => {
    const history = [
      entry("2026-01-01", 2, 2),
      entry("2026-01-02", 2, 2),
      entry("2026-06-05", 8, 8),
    ];
    assert.equal(computeFirstInsight(history, "2026-06-12"), null);
  });
});

describe("shouldOfferWeeklySummary", () => {
  it("offers on Sunday evening", () => {
    assert.equal(shouldOfferWeeklySummary(new Date(2026, 5, 14, 18, 0, 0)), true); // dom 18h
    assert.equal(shouldOfferWeeklySummary(new Date(2026, 5, 14, 17, 0, 0)), false); // dom 17h
  });

  it("offers all Monday", () => {
    assert.equal(shouldOfferWeeklySummary(new Date(2026, 5, 15, 9, 0, 0)), true); // segunda
  });

  it("does not offer midweek", () => {
    assert.equal(shouldOfferWeeklySummary(new Date(2026, 5, 17, 9, 0, 0)), false); // quarta
  });
});

describe("weekKeyOf", () => {
  it("resolves to the ISO Monday of the week", () => {
    assert.equal(weekKeyOf(new Date(2026, 5, 14, 20, 0, 0)), "2026-06-08"); // domingo → segunda anterior
    assert.equal(weekKeyOf(new Date(2026, 5, 15, 9, 0, 0)), "2026-06-15"); // segunda → ela mesma
  });
});

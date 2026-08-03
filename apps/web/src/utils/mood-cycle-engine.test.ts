import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { computeMoodCycle } from "./mood-cycle-engine";
import type { CheckinEntry } from "../features/aura/types";

function makeHistory(
  startDate: Date,
  scores: Array<{ humor: number; energia: number }>,
): CheckinEntry[] {
  return scores.map((score, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      humor: score.humor,
      energia: score.energia,
      emotion: "calm",
    };
  });
}

describe("mood cycle engine", () => {
  it("classifies the same recent values differently when the baseline changes", () => {
    const recent = [
      { humor: 6, energia: 6 },
      { humor: 6, energia: 6 },
      { humor: 6, energia: 6 },
    ];

    const highBaselineHistory = makeHistory(new Date(2026, 3, 1), [
      ...Array.from({ length: 8 }, () => ({ humor: 9, energia: 9 })),
      ...recent,
    ]);
    const lowBaselineHistory = makeHistory(new Date(2026, 3, 1), [
      ...Array.from({ length: 8 }, () => ({ humor: 3, energia: 3 })),
      ...recent,
    ]);

    const highBaselineReport = computeMoodCycle(highBaselineHistory);
    const lowBaselineReport = computeMoodCycle(lowBaselineHistory);

    assert.notEqual(highBaselineReport.phaseLabel, lowBaselineReport.phaseLabel);
    assert.ok(
      ["Desacelerando", "Recolhimento", "Pausa"].includes(highBaselineReport.phaseLabel),
      `expected a lower band for the high-baseline history, got ${highBaselineReport.phaseLabel}`,
    );
    assert.ok(
      ["Fluindo", "Voo Alto"].includes(lowBaselineReport.phaseLabel),
      `expected a higher band for the low-baseline history, got ${lowBaselineReport.phaseLabel}`,
    );
  });

  it("raises a sustained low warning when the recent pattern stays below the baseline", () => {
    const history = makeHistory(new Date(2026, 3, 1), [
      ...Array.from({ length: 7 }, () => ({ humor: 8, energia: 8 })),
      { humor: 4, energia: 4 },
      { humor: 4, energia: 4 },
      { humor: 3, energia: 3 },
      { humor: 3, energia: 3 },
    ]);

    const report = computeMoodCycle(history);

    assert.ok(report.warningFlags.includes("sustained_low"));
    assert.ok(report.baselineComposite > report.currentComposite);
    assert.ok(["Desacelerando", "Recolhimento"].includes(report.personalTrendLabel));
  });

  it("exposes the personalized baseline and EWMA values", () => {
    const history = makeHistory(new Date(2026, 3, 1), [
      { humor: 4, energia: 4 },
      { humor: 5, energia: 5 },
      { humor: 6, energia: 6 },
      { humor: 7, energia: 7 },
      { humor: 8, energia: 8 },
      { humor: 9, energia: 9 },
    ]);

    const report = computeMoodCycle(history);

    assert.equal(report.personalTrendLabel, report.personalTrend.trendBandLabel);
    assert.equal(report.baselineMood, report.personalTrend.baselineMood);
    assert.equal(report.currentComposite, report.personalTrend.currentComposite);
    assert.equal(report.baselineDeltaComposite, report.personalTrend.deltaComposite);
  });

  it("separates a stable-positive plateau from a stable-negative one", () => {
    const stablePositive = computeMoodCycle(
      makeHistory(new Date(2026, 3, 1), Array.from({ length: 14 }, () => ({ humor: 8, energia: 7 }))),
    );
    const stableNegative = computeMoodCycle(
      makeHistory(new Date(2026, 3, 1), Array.from({ length: 14 }, () => ({ humor: 3, energia: 3 }))),
    );

    assert.equal(stablePositive.phase, "stable", `expected stable, got ${stablePositive.phase}`);
    assert.equal(stableNegative.phase, "stable", `expected stable, got ${stableNegative.phase}`);

    // Mesma fase, mesma ausência de oscilação — leituras opostas.
    assert.equal(stablePositive.stableReading.valence, "positive");
    assert.equal(stablePositive.stableReading.label, "Estável positivo");
    assert.equal(stableNegative.stableReading.valence, "negative");
    assert.equal(stableNegative.stableReading.label, "Estável negativo");
  });

  it("detects mixed features that the composite score hides", () => {
    // Humor 2 com energia 8: o composto (humor*0.6 + energia*0.4) dá 4.4 e
    // passa por dia intermediário. A literatura chama isso de traço misto —
    // polos opostos no mesmo dia — e é o quadro que mais exige cautela.
    const mixed = computeMoodCycle(
      makeHistory(new Date(2026, 3, 1), Array.from({ length: 14 }, () => ({ humor: 2, energia: 8 }))),
    );

    assert.ok(
      mixed.warningFlags.includes("mixed_features"),
      `divergência humor/energia tem que acender mixed_features, veio: ${JSON.stringify(mixed.warningFlags)}`,
    );

    // Controle: mesma média de composto, sem divergência — não pode acender.
    const flat = computeMoodCycle(
      makeHistory(new Date(2026, 3, 1), Array.from({ length: 14 }, () => ({ humor: 4, energia: 5 }))),
    );
    assert.ok(!flat.warningFlags.includes("mixed_features"));
  });

  it("reads short sleep with high mood as reduced need, not deprivation", () => {
    const base = Array.from({ length: 10 }, () => ({ humor: 5, energia: 5 }));
    const history = makeHistory(new Date(2026, 3, 1), [...base, { humor: 8, energia: 9 }, { humor: 8, energia: 9 }]);
    // Dormir pouco estando acima do baseline é marcador de elevação, não de
    // privação — hoje o app contava isso como fator negativo, ao contrário.
    history[history.length - 1].sleepHours = 4;
    history[history.length - 2].sleepHours = 4.5;

    const report = computeMoodCycle(history);
    assert.ok(
      report.warningFlags.includes("reduced_sleep_need"),
      `pouco sono acima do baseline tem que acender reduced_sleep_need, veio: ${JSON.stringify(report.warningFlags)}`,
    );

    // Mesmo sono curto, mas com humor baixo, é privação — não pode acender.
    const deprived = makeHistory(new Date(2026, 3, 1), [...base, { humor: 2, energia: 2 }, { humor: 2, energia: 2 }]);
    deprived[deprived.length - 1].sleepHours = 4;
    deprived[deprived.length - 2].sleepHours = 4.5;
    assert.ok(!computeMoodCycle(deprived).warningFlags.includes("reduced_sleep_need"));
  });

  it("still flags sustained depression when the low mood became the person's own baseline", () => {
    // Quatorze dias colados em humor 3: variação quase zero, tendência zero.
    // O motor lê isso como "stable" porque a pessoa está no próprio baseline.
    // Antes desta correção o alerta era suprimido justamente aqui.
    const flatDepressed = computeMoodCycle(
      makeHistory(new Date(2026, 3, 1), Array.from({ length: 14 }, () => ({ humor: 3, energia: 3 }))),
    );

    assert.equal(flatDepressed.phase, "stable");
    assert.ok(
      flatDepressed.warningFlags.includes("sustained_low"),
      `platô depressivo tem que acender sustained_low, veio: ${JSON.stringify(flatDepressed.warningFlags)}`,
    );
    assert.match(flatDepressed.aiContext, /Estável negativo/);
  });
});

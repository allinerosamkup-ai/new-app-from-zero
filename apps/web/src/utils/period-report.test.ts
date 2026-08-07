import { describe, expect, it } from "vitest";

import { buildPeriodReportData, resolvePeriodRange } from "./period-report";
import type { CheckinEntry } from "../features/aura/types";

function entry(date: string, humor: number, energia: number, factors: string[] = []): CheckinEntry {
  return { date, humor, energia, emotion: "calm", factors } as CheckinEntry;
}

/** Gera dias consecutivos a partir de uma data. */
function days(start: string, count: number, build: (index: number) => { humor: number; energia: number; factors?: string[] }) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${start}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const values = build(index);
    return entry(date.toISOString().slice(0, 10), values.humor, values.energia, values.factors ?? []);
  });
}

describe("resolvePeriodRange", () => {
  it("monta a janela fechada terminando hoje", () => {
    const range = resolvePeriodRange("90d", { today: "2026-08-03" });
    expect(range.end).toBe("2026-08-03");
    // 90 dias contando hoje: 3/8 menos 89 dias.
    expect(range.start).toBe("2026-05-06");
  });

  it("cobre os presets pedidos", () => {
    expect(resolvePeriodRange("7d", { today: "2026-08-03" }).start).toBe("2026-07-28");
    expect(resolvePeriodRange("30d", { today: "2026-08-03" }).start).toBe("2026-07-05");
    expect(resolvePeriodRange("180d", { today: "2026-08-03" }).label).toBe("último semestre");
  });

  it("aceita intervalo personalizado e corrige datas invertidas", () => {
    const invertido = resolvePeriodRange("custom", { customStart: "2026-08-10", customEnd: "2026-08-01" });
    expect(invertido.start).toBe("2026-08-01");
    expect(invertido.end).toBe("2026-08-10");
  });
});

describe("buildPeriodReportData", () => {
  const range = resolvePeriodRange("30d", { today: "2026-08-03" });

  it("analisa só o intervalo, ignorando o que ficou fora", () => {
    const dentro = days("2026-07-05", 30, () => ({ humor: 6, energia: 6 }));
    const fora = [entry("2026-01-01", 1, 1), entry("2027-01-01", 10, 10)];

    const data = buildPeriodReportData([...fora, ...dentro], range);

    expect(data.observedDays).toBe(30);
    // Se os de fora entrassem, a média sairia de 6.
    expect(data.avgMood).toBe(6);
  });

  it("compara a primeira metade com a segunda", () => {
    // Sobe ao longo do período: a segunda metade tem que ficar acima.
    const subindo = days("2026-07-05", 30, (i) => ({ humor: i < 15 ? 4 : 8, energia: i < 15 ? 4 : 8 }));
    const data = buildPeriodReportData(subindo, range);

    expect(data.firstHalf.avgMood).toBe(4);
    expect(data.secondHalf.avgMood).toBe(8);
    expect(data.moodDelta).toBe(4);
  });

  it("marca amostragem baixa sem esconder o relatório", () => {
    const poucos = days("2026-07-05", 4, () => ({ humor: 5, energia: 5 }));
    const data = buildPeriodReportData(poucos, range);

    expect(data.sampling).toBe("low");
    expect(data.observedDays).toBe(4);
    expect(data.missingDays).toBe(data.windowDays - 4);
  });

  it("conta dias com divergência entre humor e energia", () => {
    // Humor baixo com energia alta: traço misto, e o relatório precisa ver.
    const mistos = days("2026-07-05", 10, (i) => (
      i < 4 ? { humor: 2, energia: 8 } : { humor: 6, energia: 6 }
    ));
    expect(buildPeriodReportData(mistos, range).divergentDays).toBe(4);
  });

  it("associa fator a humor só com amostra suficiente", () => {
    const comFator = days("2026-07-05", 20, (i) => (
      i < 8 ? { humor: 3, energia: 3, factors: ["slept_little"] } : { humor: 8, energia: 8 }
    ));
    const data = buildPeriodReportData(comFator, range);

    const sono = data.topFactors.find((f) => f.factor === "slept_little");
    expect(sono?.daysWith).toBe(8);
    expect(sono?.difference).toBeLessThan(0);

    // Fator com menos de 3 dias não vira associação.
    const raro = days("2026-07-05", 20, (i) => (
      i < 2 ? { humor: 3, energia: 3, factors: ["raro"] } : { humor: 8, energia: 8 }
    ));
    expect(buildPeriodReportData(raro, range).topFactors.some((f) => f.factor === "raro")).toBe(false);
  });

  it("mede o maior intervalo sem registro", () => {
    const comBuraco = [
      entry("2026-07-05", 5, 5),
      entry("2026-07-20", 5, 5),
      entry("2026-08-03", 5, 5),
    ];
    // Do dia 5 ao 20 há 14 dias sem registro no meio.
    expect(buildPeriodReportData(comBuraco, range).longestGapDays).toBe(14);
  });

  it("lida com período sem nenhum registro", () => {
    const data = buildPeriodReportData([], range);

    expect(data.observedDays).toBe(0);
    expect(data.avgMood).toBeNull();
    expect(data.bestDay).toBeNull();
    expect(data.sampling).toBe("low");
    expect(data.longestGapDays).toBe(data.windowDays);
  });
});

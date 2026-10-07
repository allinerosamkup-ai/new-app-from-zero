import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { PresenceCard } from "./PresenceCard";

afterEach(async () => { await i18n.changeLanguage("pt"); });

describe("localized Home presence", () => {
  it("renders English labels and weekday initials after a real language change", async () => {
    await i18n.changeLanguage("en");
    const html = renderToStaticMarkup(<PresenceCard checkinHistory={[
      { date: "2026-10-01", humor: 5, energia: 5 },
      { date: "2026-10-02", humor: 5, energia: 5 },
      { date: "2026-10-03", humor: 5, energia: 5 },
    ]} />);
    expect(html).toContain("3 days present");
    expect(html).not.toContain("dias de presença");
    expect(html).toMatch(/>W<\/span>/);
    expect(html).not.toMatch(/>Q<\/span>/);
    expect(i18n.t("home.weekTab")).toBe("Week");
    expect(i18n.t("home.monthlyTab")).toBe("Monthly");
    expect(i18n.t("home.todayTab")).toBe("Today");
    expect(i18n.t("home.forecastTab")).toBe("7 days");
  });

  it("keeps Portuguese labels when Portuguese is selected", async () => {
    await i18n.changeLanguage("pt");
    const html = renderToStaticMarkup(<PresenceCard checkinHistory={[
      { date: "2026-10-01", humor: 5, energia: 5 },
    ]} />);
    expect(html).toContain("Primeira presença");
    expect(html).toMatch(/>Q<\/span>/);
    expect(i18n.t("home.monthlyTab")).toBe("Mensal");
  });
});

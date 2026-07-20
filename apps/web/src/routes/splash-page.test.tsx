import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { SplashPage } from "./splash-page";
import i18n from "../i18n";

describe("SplashPage", () => {
  it("renders the new sales landing structure", async () => {
    await i18n.changeLanguage("pt");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SplashPage />
      </MemoryRouter>,
    );

    expect(html).toContain("EWMA individual");
    expect(html).toContain("baseline pessoal");
    expect(html).toContain("Como funciona");
    expect(html).toContain("Veja o app em ação");
    expect(html).toContain("Começar minha leitura de ritmo");
    expect(html).toContain("Acesso Beta: Gratuito hoje");
  });

  it("renders the complete sales landing in English", async () => {
    await i18n.changeLanguage("en");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SplashPage />
      </MemoryRouter>,
    );

    expect(html).toContain("The app calculates patterns, trends, and stability");
    expect(html).toContain("See the app in action");
    expect(html).toContain("Start my rhythm reading");
    expect(html).not.toContain("Veja o app em ação");
  });
});

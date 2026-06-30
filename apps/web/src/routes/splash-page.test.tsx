import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { SplashPage } from "./splash-page";

describe("SplashPage", () => {
  it("renders the new sales landing structure", () => {
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
});

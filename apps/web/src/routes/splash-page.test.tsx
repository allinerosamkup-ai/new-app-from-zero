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

    expect(html).toContain("Você não é difícil. Você cicla.");
    expect(html).toContain("Como funciona");
    expect(html).toContain("Veja o app em ação");
    expect(html).toContain("Quero entender meu ciclo");
    expect(html).toContain("Gratuito durante o preview");
  });
});

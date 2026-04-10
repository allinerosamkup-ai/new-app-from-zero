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

    expect(html).toContain("Seu dia não precisa depender da sorte");
    expect(html).toContain("Como funciona");
    expect(html).toContain("Veja o app em ação");
    expect(html).toContain("Criar minha conta");
  });
});

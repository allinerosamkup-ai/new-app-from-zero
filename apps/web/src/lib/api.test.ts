import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Um 401 por token expirado tem que virar retry, não erro na tela.
 *
 * O bug: o access token do Supabase dura ~1h. A resposta 401 disparava o
 * refresh da sessão, mas a chamada original rejeitava mesmo assim. O app ficava
 * com sessão boa e a tela com erro — no onboarding guiado, que busca o catálogo
 * uma vez no mount, isso virava "Não consegui carregar as opções" numa sessão
 * perfeitamente válida.
 */

const refreshSession = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      refreshSession: () => refreshSession(),
      signOut: () => signOut(),
    },
  },
}));

vi.mock("../i18n", () => ({ getCurrentLanguage: () => "pt" }));

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as unknown as Response;
}

describe("api — recuperação de sessão", () => {
  beforeEach(() => {
    vi.resetModules();
    refreshSession.mockReset();
    signOut.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  });

  it("refaz a requisição depois de renovar a sessão", async () => {
    refreshSession.mockResolvedValue({ data: { session: { access_token: "novo" } }, error: null });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "expirado" }))
      .mockResolvedValueOnce(jsonResponse(200, { lifeAreas: [1, 2, 3] }));
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./api");
    const data = await api.get("/routine-builder/library");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(data).toEqual({ lifeAreas: [1, 2, 3] });
  });

  it("não tenta de novo quando a sessão morreu de vez", async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("morta") });
    signOut.mockResolvedValue(undefined);

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "expirado" }));
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./api");
    await expect(api.get("/qualquer")).rejects.toThrow(/Sessão expirada/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalled();
  });

  it("uma tentativa só: 401 que persiste com token novo não vira laço", async () => {
    refreshSession.mockResolvedValue({ data: { session: { access_token: "novo" } }, error: null });

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "sempre" }));
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./api");
    await expect(api.get("/qualquer")).rejects.toThrow(/Sessão expirada/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resposta boa não gasta refresh nenhum", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./api");
    await api.get("/qualquer");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("erro que não é 401 continua subindo com a mensagem do backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, { error: "deu ruim no servidor" }));
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./api");
    await expect(api.get("/qualquer")).rejects.toThrow(/deu ruim no servidor/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });
});

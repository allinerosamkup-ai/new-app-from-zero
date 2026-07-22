import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("../i18n", () => ({
  getCurrentLanguage: vi.fn(() => "en"),
}));

describe("API locale propagation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the selected language in headers and structured request bodies", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./api");

    await api.post("/ai/suggest", { requestType: "daily_summary" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      "Accept-Language": "en",
      "Content-Language": "en",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      language: "en",
      locale: "en-US",
      requestType: "daily_summary",
    });
  });

  it("also sends the selected language on read-only requests", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./api");

    await api.get("/insights/weekly");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "Accept-Language": "en" });
  });

  it("uploads a document as raw bytes without forcing JSON content type", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./api");

    const file = new File(["routine"], "routine.txt", { type: "text/plain" });
    await api.upload("/routine-builder/sessions/session-1/source", file);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(file);
    expect(init.headers).toMatchObject({
      "Content-Type": "text/plain",
      "X-File-Name": encodeURIComponent("routine.txt"),
      "Accept-Language": "en",
    });
  });

  it("infers the document content type when the browser leaves it empty", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./api");

    const file = new File(["# Minha semana"], "rotina.md", { type: "application/octet-stream" });
    await api.upload("/routine-builder/sessions/session-1/source", file);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "Content-Type": "text/markdown" });
  });

  it("surfaces the useful validation message instead of only the generic error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "validation_failed",
      message: "Revise os campos indicados.",
      details: [{ path: "items.0.title", message: "Título obrigatório" }],
    }), { status: 400, headers: { "Content-Type": "application/json" } })));
    const { api } = await import("./api");

    await expect(api.post("/routine-builder/sessions/session-1/compose", {}))
      .rejects.toThrow("Revise os campos indicados. Título obrigatório");
  });
});

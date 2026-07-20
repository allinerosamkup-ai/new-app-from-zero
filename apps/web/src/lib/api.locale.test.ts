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
});

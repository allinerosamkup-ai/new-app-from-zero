import { describe, expect, it } from "@jest/globals";

import { getSessionUserId } from "./auth_session";

describe("getSessionUserId", () => {
  it("retorna o identificador quando há uma sessão autenticada", () => {
    expect(getSessionUserId({
      session: {
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    })).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("retorna nulo quando não há sessão", () => {
    expect(getSessionUserId({ session: null })).toBeNull();
  });
});

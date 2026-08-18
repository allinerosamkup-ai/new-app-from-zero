import { describe, expect, it } from "@jest/globals";

import { parseSseChunk } from "./ai_service";

describe("parseSseChunk", () => {
  it("separa eventos SSE consecutivos e preserva o conteúdo", () => {
    const input =
      "event: assistant.delta\n" +
      'data: {"chunk":"Olá, "}\n\n' +
      "event: assistant.completed\n" +
      'data: {"message":{"content":"Olá, estou com você."}}\n\n';
    const parsed = parseSseChunk(input);

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]).toMatchObject({
      event: "assistant.delta",
      data: { chunk: "Olá, " },
    });
    expect(parsed.events[1]).toMatchObject({
      event: "assistant.completed",
      data: { message: { content: "Olá, estou com você." } },
    });
    expect(parsed.remainder).toBe("");
  });
});

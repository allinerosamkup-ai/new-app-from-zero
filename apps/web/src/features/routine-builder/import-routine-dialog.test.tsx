import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  importRoutineForReview,
  routineImportErrorKey,
  validateRoutineImportFile,
  type ImportRoutineServices,
} from "./import-routine-dialog";

function services(): ImportRoutineServices {
  return {
    createSession: vi.fn(async () => ({ id: "session-1" })),
    importFile: vi.fn(async () => ({ id: "session-1" })),
    importText: vi.fn(async () => ({ id: "session-1" })),
  };
}

describe("ImportRoutineDialog", () => {
  it("mantém uma única ação de refazer onboarding nas Configurações", () => {
    const source = readFileSync(resolve(process.cwd(), "src/routes/preferences-page.tsx"), "utf8");

    expect(source.match(/t\("config\.redoOnboarding"\)/g)).toHaveLength(1);
    expect(source.match(/onClick=\{handleRedoOnboarding\}/g)).toHaveLength(1);
  });

  it("cancelar fecha o diálogo sem acionar o fluxo de importação", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/routine-builder/import-routine-dialog.tsx"),
      "utf8",
    );

    expect(source).toContain('data-testid="routine-import-cancel"');
    expect(source).toMatch(/data-testid="routine-import-cancel"[\s\S]*?onClick=\{onClose\}/);
  });

  it("explica formato e limite quando o arquivo é inválido", () => {
    expect(validateRoutineImportFile(new File(["x"], "rotina.jpg", { type: "image/jpeg" }))).toMatchObject({
      ok: false,
      reason: "format",
    });
    expect(validateRoutineImportFile(new File([new Uint8Array(10_000_001)], "rotina.pdf", { type: "application/pdf" }))).toMatchObject({
      ok: false,
      reason: "size",
    });
  });

  it("barra arquivo inválido antes de criar uma sessão", async () => {
    const routineServices = services();

    await expect(importRoutineForReview({
      focus: "Organizar minha semana",
      file: new File(["x"], "rotina.jpg", { type: "image/jpeg" }),
      sourceText: "",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      weekStart: "2026-07-20",
    }, routineServices)).rejects.toThrow("routine_import_file_format");

    expect(routineServices.createSession).not.toHaveBeenCalled();
  });

  it("importa arquivo para uma sessão revisável sem aplicar a rotina", async () => {
    const routineServices = services();
    const file = new File(["segunda: caminhada"], "rotina.md", { type: "text/markdown" });

    const sessionId = await importRoutineForReview({
      focus: "Organizar minha semana",
      file,
      sourceText: "",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      weekStart: "2026-07-20",
    }, routineServices);

    expect(routineServices.createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "import",
      focus: "Organizar minha semana",
    }));
    expect(routineServices.importFile).toHaveBeenCalledWith("session-1", file);
    expect(sessionId).toBe("session-1");
    expect("apply" in routineServices).toBe(false);
  });

  it("não cria sessão enquanto não houver texto nem arquivo", async () => {
    const routineServices = services();

    await expect(importRoutineForReview({
      focus: "Organizar minha semana",
      file: null,
      sourceText: " ",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      weekStart: "2026-07-20",
    }, routineServices)).rejects.toThrow("routine_import_source_required");

    expect(routineServices.createSession).not.toHaveBeenCalled();
  });

  it("não mostra códigos internos quando a importação falha", () => {
    expect(routineImportErrorKey(new Error("routine_import_file_format"))).toBe("formatError");
    expect(routineImportErrorKey(new Error("network_failure"))).toBe("importError");
  });
});

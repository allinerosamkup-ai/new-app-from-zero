import { useMemo, useState } from "react";
import { FileText, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api } from "../../lib/api";
import { routineBuilderApi } from "./api";

const SESSION_KEY = "airia:routine-builder:session";
const MAX_FILE_BYTES = 10_000_000;
const ACCEPTED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx", ".xlsx"] as const;
const ACCEPTED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

type ImportSessionInput = {
  mode: "import";
  focus: string;
  weekStart: string;
  timezone: string;
  locale: string;
  limits: {
    wakeTime: string;
    sleepTime: string;
    maxDailyLoadMinutes: number;
    unavailable: never[];
  };
};

type ImportedSession = { id: string };

export type ImportRoutineServices = {
  createSession: (input: ImportSessionInput) => Promise<ImportedSession>;
  importFile: (sessionId: string, file: File) => Promise<ImportedSession>;
  importText: (sessionId: string, text: string) => Promise<ImportedSession>;
};

export type RoutineImportInput = {
  focus: string;
  sourceText: string;
  file: File | null;
  weekStart: string;
  timezone: string;
  locale: string;
};

type ImportRoutineDialogProps = {
  open: boolean;
  onClose: () => void;
  onReview: (sessionId: string) => void;
  services?: ImportRoutineServices;
};

export type RoutineImportFileValidation =
  | { ok: true }
  | { ok: false; reason: "format" | "size" };

function localMonday(): string {
  const date = new Date();
  const distance = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - distance);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function validateRoutineImportFile(file: File): RoutineImportFileValidation {
  const lowerName = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  const hasAcceptedType = !file.type || ACCEPTED_MIME_TYPES.has(file.type);
  if (!hasAcceptedExtension || !hasAcceptedType) return { ok: false, reason: "format" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

export function routineImportErrorKey(error: unknown): string {
  const errorCode = error instanceof Error ? error.message : "";
  if (errorCode === "routine_import_focus_required") return "focusError";
  if (errorCode === "routine_import_source_required") return "sourceError";
  if (errorCode === "routine_import_file_format") return "formatError";
  if (errorCode === "routine_import_file_size") return "sizeError";
  return "importError";
}

const defaultServices: ImportRoutineServices = {
  createSession(input) {
    return api.post("/routine-builder/sessions", input) as Promise<ImportedSession>;
  },
  importFile(sessionId, file) {
    return routineBuilderApi.upload(sessionId, file);
  },
  importText(sessionId, text) {
    return routineBuilderApi.sendText(sessionId, text);
  },
};

export async function importRoutineForReview(
  input: RoutineImportInput,
  services: ImportRoutineServices = defaultServices,
): Promise<string> {
  const focus = input.focus.trim();
  const sourceText = input.sourceText.trim();
  if (!focus) throw new Error("routine_import_focus_required");
  if (!input.file && !sourceText) throw new Error("routine_import_source_required");
  if (input.file) {
    const validation = validateRoutineImportFile(input.file);
    if (!validation.ok) throw new Error(`routine_import_file_${validation.reason}`);
  }

  const created = await services.createSession({
    mode: "import",
    focus,
    weekStart: input.weekStart,
    timezone: input.timezone,
    locale: input.locale,
    limits: {
      wakeTime: "07:00",
      sleepTime: "23:00",
      maxDailyLoadMinutes: 360,
      unavailable: [],
    },
  });
  const imported = input.file
    ? await services.importFile(created.id, input.file)
    : await services.importText(created.id, sourceText);
  return imported.id || created.id;
}

export function ImportRoutineDialog({
  open,
  onClose,
  onReview,
  services = defaultServices,
}: ImportRoutineDialogProps) {
  const { t, i18n } = useTranslation();
  const [focus, setFocus] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fileDescription = useMemo(
    () => file?.name ?? t("config.routineImport.filePlaceholder"),
    [file, t],
  );

  if (!open) return null;

  function selectFile(nextFile: File | null): void {
    if (!nextFile) {
      setFile(null);
      return;
    }
    const validation = validateRoutineImportFile(nextFile);
    if (!validation.ok) {
      setFile(null);
      setError(t(`config.routineImport.${validation.reason}Error`));
      return;
    }
    setFile(nextFile);
    setError(null);
  }

  async function submit(): Promise<void> {
    const cleanFocus = focus.trim();
    const cleanText = sourceText.trim();
    if (!cleanFocus) {
      setError(t("config.routineImport.focusError"));
      return;
    }
    if (!file && !cleanText) {
      setError(t("config.routineImport.sourceError"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const sessionId = await importRoutineForReview({
        focus: cleanFocus,
        sourceText: cleanText,
        file,
        weekStart: localMonday(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
        locale: i18n.language === "en" ? "en-US" : "pt-BR",
      }, services);
      localStorage.setItem(SESSION_KEY, sessionId);
      onReview(sessionId);
    } catch (caught) {
      setError(t(`config.routineImport.${routineImportErrorKey(caught)}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        alignItems: "end",
        background: "rgba(41, 34, 32, .38)",
        padding: "16px",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="routine-import-title"
        style={{
          width: "min(100%, 560px)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          margin: "0 auto",
          padding: "20px",
          borderRadius: "24px",
          background: "var(--bg-1, #fffaf6)",
          boxShadow: "0 18px 50px rgba(60, 45, 40, .22)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p className="config-section-title" style={{ margin: "0 0 5px" }}>
              {t("config.routineImport.eyebrow")}
            </p>
            <h2 id="routine-import-title" style={{ margin: 0, fontSize: 20, color: "var(--text-1)" }}>
              {t("config.routineImport.title")}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            disabled={busy}
            style={{ border: 0, background: "transparent", color: "var(--text-2)", padding: 6, cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: "8px 0 18px", color: "var(--text-2)", fontSize: 13, lineHeight: 1.5 }}>
          {t("config.routineImport.description")}
        </p>

        <label htmlFor="routine-import-focus" style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--text-1)" }}>
          {t("config.routineImport.focusLabel")}
        </label>
        <input
          id="routine-import-focus"
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          placeholder={t("config.routineImport.focusPlaceholder")}
          disabled={busy}
          style={{
            boxSizing: "border-box",
            width: "100%",
            minHeight: 46,
            margin: "6px 0 14px",
            padding: "10px 12px",
            border: "1px solid var(--warm-border)",
            borderRadius: 12,
            background: "rgba(255,255,255,.72)",
            color: "var(--text-1)",
          }}
        />

        <label
          htmlFor="routine-import-file"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minHeight: 52,
            padding: "10px 12px",
            border: "1px dashed var(--accent-sky)",
            borderRadius: 14,
            cursor: busy ? "wait" : "pointer",
            color: "var(--text-2)",
          }}
        >
          <FileText size={19} />
          <span style={{ flex: 1, fontSize: 13 }}>{fileDescription}</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent-sky)" }}>
            {t("config.routineImport.chooseFile")}
          </span>
          <input
            id="routine-import-file"
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            disabled={busy}
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
        </label>
        <p style={{ margin: "6px 0 14px", fontSize: 11, color: "var(--text-3)" }}>
          {t("config.routineImport.fileHelp")}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px", color: "var(--text-3)" }}>
          <span style={{ flex: 1, height: 1, background: "var(--warm-border)" }} />
          <span style={{ fontSize: 11, fontWeight: 800 }}>{t("config.routineImport.orPaste")}</span>
          <span style={{ flex: 1, height: 1, background: "var(--warm-border)" }} />
        </div>

        <textarea
          aria-label={t("config.routineImport.textLabel")}
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder={t("config.routineImport.textPlaceholder")}
          disabled={busy}
          rows={5}
          style={{
            boxSizing: "border-box",
            width: "100%",
            resize: "vertical",
            padding: "11px 12px",
            border: "1px solid var(--warm-border)",
            borderRadius: 12,
            background: "rgba(255,255,255,.72)",
            color: "var(--text-1)",
            font: "inherit",
          }}
        />

        {error && (
          <p role="alert" style={{ margin: "10px 0 0", color: "var(--accent-warm-coral, #b44d42)", fontSize: 12, lineHeight: 1.4 }}>
            {error}
          </p>
        )}

        <p style={{ margin: "13px 0 0", fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.45 }}>
          {t("config.routineImport.reviewNotice")}
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            data-testid="routine-import-cancel"
            onClick={onClose}
            disabled={busy}
            style={{
              minHeight: 44,
              flex: 1,
              border: "1px solid var(--warm-border)",
              borderRadius: 999,
              background: "transparent",
              color: "var(--text-2)",
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            data-testid="routine-import-submit"
            onClick={() => void submit()}
            disabled={busy}
            style={{
              minHeight: 44,
              flex: 1.4,
              border: 0,
              borderRadius: 999,
              background: "var(--accent-peach, #d7897f)",
              color: "#fff",
              fontWeight: 900,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? <LoaderCircle size={17} className="spin" /> : t("config.routineImport.reviewButton")}
          </button>
        </div>
      </section>
    </div>
  );
}

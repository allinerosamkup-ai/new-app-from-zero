import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useToast } from "../components/Toast";
import { api } from "../lib/api";
import { SafetyProtocolCard } from "../components/aura/SafetyProtocolCard";
import { useAiriaReading } from "../lib/airia-reading";

type CaptureItem = { id?: string; title: string; done: boolean };
type Capture = {
  id: string;
  kind: "note" | "checklist";
  title: string;
  content: string;
  items: CaptureItem[];
  status: "inbox" | "completed" | "archived";
  createdAt: string;
};

export function CapturesPage() {
  const { t } = useTranslation();
  const { showError } = useToast();
  const { reading } = useAiriaReading();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setCaptures(await api.get("/captures?status=inbox") as Capture[]);
    } catch (error) {
      showError(error instanceof Error ? error.message : t("captures.loadError", "Não consegui carregar suas notas."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
   
  }, []);

  const updateCapture = async (capture: Capture, patch: Partial<Capture>) => {
    const previous = captures;
    setCaptures((current) => current.map((item) => item.id === capture.id ? { ...item, ...patch } : item));
    try {
      await api.patch(`/captures/${capture.id}`, patch);
    } catch (error) {
      setCaptures(previous);
      showError(error instanceof Error ? error.message : t("captures.saveError", "Não consegui salvar a alteração."));
    }
  };

  return (
    <main style={{ minHeight: "100%", background: "var(--warm-bg)", padding: "20px 16px 110px" }}>
      <header style={{ maxWidth: 720, margin: "0 auto 18px" }}>
        <p style={{ margin: "0 0 5px", color: "var(--accent-peach-ink)", fontSize: 10, fontWeight: 800, letterSpacing: ".13em", textTransform: "uppercase" }}>
          {t("captures.kicker", "Capturado pela Airia")}
        </p>
        <h1 style={{ margin: 0, color: "var(--text-1)", fontSize: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {t("captures.title", "Notas e checklists")}
        </h1>
        <p style={{ margin: "7px 0 0", color: "var(--text-2)", fontSize: 13, lineHeight: 1.5 }}>
          {t("captures.subtitle", "Tudo o que você pediu para a Airia guardar, sem misturar com metas ou agenda.")}
        </p>
        <SafetyProtocolCard riskSafety={reading?.riskSafety} surface="daily_summary" />
      </header>

      <section style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 10 }}>
        {loading && (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>{t("common.loading", "Carregando…")}</p>
        )}
        {!loading && captures.length === 0 && (
          <div style={{ background: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.88)", borderRadius: 20, padding: 20, textAlign: "center" }}>
            <p style={{ margin: "0 0 5px", color: "var(--text-1)", fontWeight: 800 }}>{t("captures.emptyTitle", "Nada solto por aqui")}</p>
            <p style={{ margin: 0, color: "var(--text-3)", fontSize: 12 }}>{t("captures.emptyText", "Diga “Airia, anote…” ou peça uma checklist no botão central.")}</p>
          </div>
        )}
        {captures.map((capture) => (
          <article key={capture.id} style={{ background: "rgba(255,255,255,.76)", border: "1px solid rgba(255,255,255,.9)", borderRadius: 18, padding: 14, boxShadow: "0 12px 28px rgba(54,96,74,.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: "0 0 3px", color: "var(--text-3)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  {capture.kind === "checklist" ? t("captures.checklist", "Checklist") : t("captures.note", "Nota")}
                </p>
                <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: 15, overflowWrap: "anywhere" }}>{capture.title}</h2>
              </div>
              <AuraButtonV2
                variant="glass"
                size="sm"
                onClick={() => updateCapture(capture, { status: "archived" })}
                style={{
                  flexShrink: 0,
                  border: "1px solid rgba(155,191,168,.24)",
                  background: "rgba(255,250,247,.86)",
                  color: "var(--accent-peach-ink)",
                  borderRadius: 10,
                  minHeight: 32,
                  padding: "0 12px",
                }}
              >
                {t("captures.archive", "Arquivar")}
              </AuraButtonV2>
            </div>
            {capture.content && <p style={{ margin: "9px 0 0", color: "var(--text-2)", fontSize: 13, whiteSpace: "pre-wrap" }}>{capture.content}</p>}
            {Array.isArray(capture.items) && capture.items.length > 0 && (
              <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
                {capture.items.map((item, index) => (
                  <label key={item.id ?? `${capture.id}-${index}`} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: item.done ? "var(--text-3)" : "var(--text-1)", fontSize: 13, textDecoration: item.done ? "line-through" : "none" }}>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => {
                        const items = capture.items.map((current, currentIndex) =>
                          currentIndex === index ? { ...current, done: !current.done } : current);
                        void updateCapture(capture, { items });
                      }}
                    />
                    {item.title}
                  </label>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

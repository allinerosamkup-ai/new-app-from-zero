import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { AuraIcon } from "../components/AuraIcon";
import { SafetyProtocolCard } from "../components/aura/SafetyProtocolCard";
import { buildDailyCloseSummary } from "./daily-summary-page.helpers";
import { sendAiriaDecisionFeedback, useAiriaReading } from "../lib/airia-reading";
import { useLocalizedCopy } from "../i18n";
import "../styles/aura.css";

/**
 * Fechamento é contexto e confirmação, não um segundo gerador de tarefas.
 * A proposta exibida aqui é a mesma decisão persistida para Home, Check-in,
 * Diário, Aura e Objetivos.
 */
export function DailySummaryPage() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state } = useAuraStore();
  const closeSummary = buildDailyCloseSummary(state);
  const { reading, loading, reload } = useAiriaReading();
  const [feedbackPending, setFeedbackPending] = useState(false);

  async function feedback(status: "accepted" | "rejected" | "done") {
    if (!reading?.decision || feedbackPending) return;
    setFeedbackPending(true);
    await sendAiriaDecisionFeedback(reading.decision.id, status, "daily_summary");
    await reload();
    setFeedbackPending(false);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
      <div className="screen-content" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(180,185,169,.12)", border: "2px solid rgba(180,185,169,.3)", display: "grid", placeItems: "center" }}>
          <AuraIcon size={32} style={{ color: "var(--accent-sage)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 24, fontWeight: 800, color: "var(--text-1)", marginBottom: 6 }}>{l("Fechamento do dia", "Day close")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>{closeSummary.hasData ? closeSummary.headline : l("Seu dia ganha forma conforme você registra o que viveu.", "Your day takes shape as you record what you lived.")}</p>
        </div>

        {closeSummary.evidence.length > 0 && (
          <section style={{ width: "100%", padding: "12px 14px", borderRadius: 14, background: "rgba(150,199,179,.08)", border: "1.5px solid rgba(150,199,179,.22)" }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: "var(--accent-sage)", textTransform: "uppercase", letterSpacing: ".12em" }}>{l("Base real de hoje", "Today's real basis")}</p>
            {closeSummary.evidence.slice(0, 4).map((item) => <p key={item} style={{ margin: "0 0 5px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.45 }}>{item}</p>)}
          </section>
        )}

        <SafetyProtocolCard riskSafety={reading?.riskSafety} surface="daily_summary" />

        {loading && <p style={{ fontSize: 12, color: "var(--text-3)" }}>{l("Atualizando a leitura da Airia…", "Updating Airia's reading…")}</p>}
        {reading?.decision && (
          <section style={{ width: "100%", padding: 16, borderRadius: 16, background: "#fff", border: "1.5px solid rgba(143,192,164,.32)" }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: "var(--accent-primary-ink)", textTransform: "uppercase", letterSpacing: ".12em" }}>{l("Proposta da Airia", "Airia's proposal")}</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-1)" }}>{reading.decision.title}</p>
            <p style={{ margin: "7px 0 12px", fontSize: 12, lineHeight: 1.5, color: "var(--text-2)" }}>{reading.decision.reason}</p>
            {reading.decision.requiresConfirmation && (
              <div style={{ display: "flex", gap: 8 }}>
                <AuraButtonV2 className="btn btn-ghost" style={{ flex: 1 }} disabled={feedbackPending} onClick={() => void feedback("rejected")}>{l("Não agora", "Not now")}</AuraButtonV2>
                <AuraButtonV2 className="btn btn-primary" style={{ flex: 1 }} disabled={feedbackPending} onClick={() => void feedback("accepted")}>{l("Faz sentido", "That fits")}</AuraButtonV2>
              </div>
            )}
          </section>
        )}

        <AuraButtonV2 className="btn btn-ghost btn-full" onClick={() => navigate("/journal")}>{l("Acrescentar ao diário", "Add context in Journal")}</AuraButtonV2>
        <AuraButtonV2 className="btn btn-primary btn-full" onClick={() => navigate("/home")}>{l("Voltar ao início", "Back to home")}</AuraButtonV2>
      </div>
    </div>
  );
}

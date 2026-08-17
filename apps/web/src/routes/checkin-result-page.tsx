import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { computeMoodCycle, getPhaseColor } from "../utils/mood-cycle-engine";
import { useLocalizedCopy } from "../i18n";
import { AiriaMascot } from "../components/airia/AiriaMascot";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { CapacityNote } from "../components/aura/CapacityNote";
import { SafetyProtocolCard } from "../components/aura/SafetyProtocolCard";
import { sendAiriaDecisionFeedback, useAiriaReading } from "../lib/airia-reading";
import { successHaptic } from "../utils/haptics";
import "../styles/aura.css";

/**
 * Resultado do check-in: apenas devolve a leitura canônica. Esta tela não gera
 * sugestões, não seleciona tarefas e não mantém um inbox local próprio.
 */
export function CheckinResultPage() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state, prepareJournalFromMood, refreshData } = useAuraStore();
  const { reading, loading, reload } = useAiriaReading();
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correction, setCorrection] = useState("");

  useEffect(() => { successHaptic(); void refreshData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cycle = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);
  const phaseColor = getPhaseColor(cycle.phase);
  const latest = state.checkinHistory?.[0];
  const observedAt = reading?.currentState.observedAt ?? latest?.recordedAt;
  const decision = reading?.decision;
  const safeRoute = reading?.riskSafety?.route;
  const showDecision = Boolean(decision) && safeRoute !== "crisis_protocol" && safeRoute !== "human_support";

  async function feedback(status: "accepted" | "rejected" | "corrected" | "done") {
    if (!decision || feedbackPending) return;
    setFeedbackPending(true);
    const persisted = await sendAiriaDecisionFeedback(decision.id, status, "checkin_result", correction);
    if (persisted) {
      setCorrectionOpen(false);
      setCorrection("");
      await reload();
    }
    setFeedbackPending(false);
  }

  return (
    <div className="result-shell" style={{ background: "linear-gradient(180deg, #E7F0EA 0%, #F0F7F3 50%, #FAF6F2 100%)" }}>
      <div className="screen-content result-screen">
        <div className="result-hero-icon animate-pop-in" style={{ background: `${phaseColor}18`, width: 88, height: 88 }}>
          <AiriaMascot phase={cycle.phase} motion="understand" size={80} decorative />
        </div>
        <div className="result-header animate-fade-in delay-100">
          <p className="result-header-kicker" style={{ color: "var(--accent-primary-ink)" }}>{l("CHECK-IN REGISTRADO", "CHECK-IN RECORDED")}</p>
          <h1 className="result-header-title">{l("Entendi como você está agora", "I understand how you are right now")}</h1>
          <p className="result-header-copy">{l("A Airia junta este momento ao seu histórico antes de propor qualquer coisa.", "Airia joins this moment to your history before proposing anything.")}</p>
        </div>

        <section style={{ marginBottom: 14, padding: "16px", borderRadius: 18, background: "rgba(255,255,255,.78)", border: `1.5px solid ${phaseColor}40` }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: phaseColor, textTransform: "uppercase", letterSpacing: ".1em" }}>{l("Estado agora", "Current state")}</p>
          <p style={{ margin: "5px 0 0", fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>{reading?.currentState.phase ?? cycle.phaseLabel}</p>
          {observedAt && <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text-3)" }}>{l("Baseado no último registro confirmado.", "Based on the latest confirmed record.")}</p>}
          {reading?.currentState.intraday && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-2)", lineHeight: 1.45 }}>
              {reading.currentState.intraday.observations ?? 0} {l("registro(s) hoje", "record(s) today")} · {reading.currentState.intraday.direction ?? l("sem trajetória suficiente", "not enough trajectory yet")}
              {typeof reading.currentState.intraday.range === "number" ? ` · ${l("amplitude", "range")} ${reading.currentState.intraday.range.toFixed(1)}` : ""}
            </p>
          )}
        </section>

        <SafetyProtocolCard riskSafety={reading?.riskSafety} surface="checkin_result" />

        {/* A capacidade vem antes da proposta porque explica o tamanho dela.
            Ler "propus algo de 10 minutos porque você dormiu 5h" depois de já
            ter visto a proposta é justificativa; antes, é raciocínio. */}
        {showDecision && (
          <CapacityNote
            capacity={reading?.capacity}
            decisionId={decision?.id ?? null}
            surface="checkin_result"
            onCorrected={() => { void reload(); }}
          />
        )}

        {loading && <div className="aura-panel-soft" style={{ padding: 16, textAlign: "center", marginBottom: 12 }}><p style={{ margin: 0, color: "var(--text-3)", fontSize: 12 }}>{l("Cruzando este registro com seu contexto…", "Connecting this record with your context…")}</p></div>}
        {showDecision && decision && (
          <section style={{ padding: 16, borderRadius: 16, marginTop: 12, marginBottom: 12, background: "rgba(255,253,250,.95)", border: "1.5px solid rgba(143,192,164,.36)" }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: "var(--accent-primary-ink)", textTransform: "uppercase", letterSpacing: ".12em" }}>{l("Proposta da Airia", "Airia's proposal")}</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-1)" }}>{decision.title}</p>
            <p style={{ margin: "7px 0 12px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{decision.reason}</p>
            {correctionOpen ? <>
              <textarea value={correction} onChange={(event) => setCorrection(event.target.value)} rows={3} maxLength={500} placeholder={l("O que a Airia precisa ajustar?", "What should Airia adjust?")} style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid var(--warm-border)" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}><AuraButtonV2 className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCorrectionOpen(false)}>{l("Voltar", "Back")}</AuraButtonV2><AuraButtonV2 className="btn btn-primary" style={{ flex: 1 }} disabled={!correction.trim() || feedbackPending} onClick={() => void feedback("corrected")}>{l("Corrigir", "Correct")}</AuraButtonV2></div>
            </> : decision.requiresConfirmation && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <AuraButtonV2 className="btn btn-ghost" disabled={feedbackPending} onClick={() => void feedback("rejected")}>{l("Não agora", "Not now")}</AuraButtonV2>
              <AuraButtonV2 className="btn btn-primary" disabled={feedbackPending} onClick={() => void feedback("accepted")}>{l("Faz sentido", "That fits")}</AuraButtonV2>
              <AuraButtonV2 className="btn btn-ghost" style={{ gridColumn: "1 / -1" }} onClick={() => setCorrectionOpen(true)}>{l("Corrigir a Airia", "Correct Airia")}</AuraButtonV2>
            </div>}
          </section>
        )}

        <section style={{ padding: 14, borderRadius: 14, border: "1.5px solid rgba(143,192,164,.24)", background: "rgba(255,253,250,.8)", marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{l("Se houve algo importante por trás desta mudança, registre no Diário. Isso acrescenta contexto — não vira check-in sem sua confirmação.", "If something important sits behind this change, record it in Journal. It adds context — it never becomes a check-in without your confirmation.")}</p>
          <AuraButtonV2 className="btn btn-ghost btn-full" onClick={() => { prepareJournalFromMood(); navigate("/journal", { state: { contextLabel: "check-in" } }); }}>{l("Acrescentar ao diário", "Add context in Journal")}</AuraButtonV2>
        </section>
        <AuraButtonV2 className="btn btn-primary btn-full" onClick={() => navigate("/home", { replace: true })}>{l("Ir para o início", "Go to home")}</AuraButtonV2>
      </div>
    </div>
  );
}

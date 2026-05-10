import { AuraButtonV2 } from "../editorial/AuraButtonV2";
import { trackEvent } from "../../lib/track";

export type RiskSafety = {
  riskLevel: "none" | "low" | "moderate" | "high" | "crisis";
  signals: string[];
  route: "self_support" | "adapt_day" | "human_support" | "crisis_protocol";
  message?: string;
};

type SafetyProtocolCardProps = {
  riskSafety?: RiskSafety | null;
  surface: "checkin_result" | "aura_chat" | "journal";
  onAdaptDay?: () => void;
};

const SUPPORT_RESOURCES = [
  { label: "CVV 188", detail: "apoio emocional 24h no Brasil" },
  { label: "SAMU 192", detail: "risco médico ou urgência" },
  { label: "190", detail: "risco imediato de violência" },
];

export function SafetyProtocolCard({ riskSafety, surface, onAdaptDay }: SafetyProtocolCardProps) {
  if (!riskSafety || riskSafety.route === "self_support") return null;

  const isCrisis = riskSafety.route === "crisis_protocol";
  const needsHuman = isCrisis || riskSafety.route === "human_support";

  function trackProtocol(action: string) {
    trackEvent("risk_protocol_triggered", {
      surface,
      action,
      riskLevel: riskSafety?.riskLevel,
      route: riskSafety?.route,
      signals: riskSafety?.signals ?? [],
    });
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: 13,
        borderRadius: 16,
        background: isCrisis ? "rgba(138,70,58,.10)" : "rgba(161,125,108,.08)",
        border: isCrisis ? "1.5px solid rgba(138,70,58,.34)" : "1px solid rgba(161,125,108,.24)",
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: isCrisis ? "#8A463A" : "#8A5D4B" }}>
        {isCrisis ? "Protocolo de crise" : "Camada de segurança"}
      </p>
      <p style={{ margin: "0 0 9px", fontSize: 13, lineHeight: 1.55, color: "#5E4036", fontWeight: 750 }}>
        {isCrisis
          ? "A Airia não vai tratar isso como produtividade. Agora a prioridade é segurança humana e apoio imediato."
          : "A Airia percebeu sinais que pedem menos carga e mais apoio humano se isso estiver pesado demais."}
      </p>

      {riskSafety.signals.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {riskSafety.signals.slice(0, 3).map((signal) => (
            <span key={signal} style={{ fontSize: 10.5, fontWeight: 750, color: "#6F4D40", borderRadius: 999, padding: "4px 8px", background: "rgba(255,255,255,.58)", border: "1px solid rgba(111,77,64,.14)" }}>
              {signal}
            </span>
          ))}
        </div>
      )}

      {needsHuman && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {SUPPORT_RESOURCES.map((resource) => (
            <div key={resource.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 9px", borderRadius: 10, background: "rgba(255,255,255,.62)" }}>
              <strong style={{ fontSize: 12, color: "#50362F" }}>{resource.label}</strong>
              <span style={{ fontSize: 11, color: "#70564E", textAlign: "right" }}>{resource.detail}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: "0 0 10px", fontSize: 11.5, lineHeight: 1.55, color: "#6F4D40" }}>
        Se houver risco imediato para você ou outra pessoa, procure emergência local agora. A Airia não substitui psicóloga,
        psiquiatra, atendimento médico ou rede de apoio.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onAdaptDay && riskSafety.route !== "crisis_protocol" && (
          <AuraButtonV2
            variant="secondary"
            size="sm"
            onClick={() => {
              trackProtocol("adapt_day");
              onAdaptDay();
            }}
            style={{ flex: "1 1 150px" }}
          >
            Adaptar meu dia
          </AuraButtonV2>
        )}
        <AuraButtonV2
          variant={isCrisis ? "primary" : "glass"}
          size="sm"
          onClick={() => trackProtocol(isCrisis ? "crisis_resources_viewed" : "human_support_viewed")}
          style={{ flex: "1 1 150px" }}
        >
          {isCrisis ? "Registrar protocolo" : "Entendi o alerta"}
        </AuraButtonV2>
      </div>
    </div>
  );
}

import { AuraButtonV2 } from "../editorial/AuraButtonV2";
import { trackEvent } from "../../lib/track";
import { useTranslation } from "react-i18next";

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

export function SafetyProtocolCard({ riskSafety, surface, onAdaptDay }: SafetyProtocolCardProps) {
  const { t } = useTranslation();
  if (!riskSafety || riskSafety.route === "self_support") return null;

  const isCrisis = riskSafety.route === "crisis_protocol";
  const needsHuman = isCrisis || riskSafety.route === "human_support";
  const supportResources = [
    { label: "CVV 188", detail: t("safety.resources.cvv") },
    { label: "SAMU 192", detail: t("safety.resources.samu") },
    { label: "190", detail: t("safety.resources.police") },
  ];

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
        background: isCrisis ? "rgba(63,110,86,.10)" : "rgba(111,148,128,.08)",
        border: isCrisis ? "1.5px solid rgba(63,110,86,.34)" : "1px solid rgba(111,148,128,.24)",
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: isCrisis ? "#3F6E56" : "#4B7A62" }}>
        {isCrisis ? t("safety.crisisProtocol") : t("safety.safetyLayer")}
      </p>
      <p style={{ margin: "0 0 9px", fontSize: 13, lineHeight: 1.55, color: "#36584A", fontWeight: 750 }}>
        {isCrisis
          ? t("safety.crisisBody")
          : t("safety.humanBody")}
      </p>

      {riskSafety.signals.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {riskSafety.signals.slice(0, 3).map((signal) => (
            <span key={signal} style={{ fontSize: 10.5, fontWeight: 750, color: "#3E6B54", borderRadius: 999, padding: "4px 8px", background: "rgba(255,255,255,.58)", border: "1px solid rgba(74,107,91,.14)" }}>
              {signal}
            </span>
          ))}
        </div>
      )}

      {needsHuman && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {supportResources.map((resource) => (
            <div key={resource.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 9px", borderRadius: 10, background: "rgba(255,255,255,.62)" }}>
              <strong style={{ fontSize: 12, color: "#2E4B3E" }}>{resource.label}</strong>
              <span style={{ fontSize: 11, color: "#4A6B5B", textAlign: "right" }}>{resource.detail}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: "0 0 10px", fontSize: 11.5, lineHeight: 1.55, color: "#3E6B54" }}>
        {t("safety.emergency")}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onAdaptDay && riskSafety.route !== "crisis_protocol" && (
          <AuraButtonV2
            variant="outline"
            size="sm"
            onClick={() => {
              trackProtocol("adapt_day");
              onAdaptDay();
            }}
            style={{ flex: "1 1 150px" }}
          >
            {t("safety.adaptDay")}
          </AuraButtonV2>
        )}
        <AuraButtonV2
          variant={isCrisis ? "primary" : "glass"}
          size="sm"
          onClick={() => trackProtocol(isCrisis ? "crisis_resources_viewed" : "human_support_viewed")}
          style={{ flex: "1 1 150px" }}
        >
          {isCrisis ? t("safety.registerProtocol") : t("safety.understood")}
        </AuraButtonV2>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { ActivationState } from "../../features/aura/activation";
import { ActivationChecklist } from "./ActivationChecklist";
import { AiriaButton, AiriaIconButton } from "../airia";

type Props = {
  activation: ActivationState;
  userId?: string | null;
};

function storageKey(userId?: string | null) {
  return `airia.firstRunGuide.${userId || "local"}`;
}

export function FirstRunGuide({ activation, userId }: Props) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!activation.isNewUser || activation.activationLevel === "active") {
      setVisible(false);
      return;
    }

    const key = storageKey(userId);
    const dismissed = window.localStorage.getItem(key) === "dismissed";
    if (dismissed) return;

    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, [activation.activationLevel, activation.isNewUser, userId]);

  function dismiss() {
    window.localStorage.setItem(storageKey(userId), "dismissed");
    setVisible(false);
  }

  function goNext() {
    setVisible(false);
    navigate(activation.nextAction.route);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        width: "min(calc(100% - 24px), 424px)",
        margin: "0 auto",
        zIndex: 420,
        borderRadius: 22,
        background: "rgba(255,255,255,.97)",
        border: "1px solid rgba(244,190,168,.26)",
        boxShadow: "0 22px 44px rgba(17,24,39,.16)",
        padding: 14,
        backdropFilter: "blur(16px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-peach-ink)" }}>
            Primeiro caminho Airia
          </p>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-1)", lineHeight: 1.25 }}>
            {activation.nextAction.title}
          </h2>
        </div>
        <AiriaIconButton
          onClick={dismiss}
          aria-label="Fechar guia inicial"
          icon={<X size={15} />}
          variant="outline"
          style={{ flexShrink: 0 }}
        />
      </div>

      <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.55, color: "var(--text-2)" }}>
        {activation.nextAction.description}
      </p>

      <ActivationChecklist activation={activation} />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <AiriaButton
          type="button"
          onClick={dismiss}
          variant="secondary"
          size="md"
          style={{ flex: 1 }}
        >
          Depois
        </AiriaButton>
        <AiriaButton
          variant="primary"
          size="md"
          onClick={goNext}
          rightIcon={<ArrowRight size={14} />}
          style={{ flex: 2 }}
        >
          {activation.nextAction.label}
        </AiriaButton>
      </div>
    </div>
  );
}

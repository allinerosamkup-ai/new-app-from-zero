import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AuraButtonV2 } from "../editorial/AuraButtonV2";

type Example = {
  title: string;
  description?: string;
};

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  route?: string;
  onAction?: () => void;
  examples?: Example[];
};

export function SmartEmptyState({ icon: Icon, title, description, ctaLabel, route, onAction, examples = [] }: Props) {
  const navigate = useNavigate();

  function handleAction() {
    if (onAction) {
      onAction();
      return;
    }
    if (route) navigate(route);
  }

  return (
    <div
      className="empty-state"
      style={{
        border: "1.5px solid var(--warm-border)",
        borderRadius: 20,
        background: "rgba(255,255,255,.86)",
        padding: "22px 16px",
        alignItems: "stretch",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: "rgba(244,190,168,.14)",
            color: "var(--accent-peach-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: 900, color: "var(--text-1)" }}>{title}</p>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-2)" }}>{description}</p>
        </div>
      </div>

      {examples.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
          {examples.slice(0, 3).map((example) => (
            <div
              key={example.title}
              style={{
                borderRadius: 12,
                background: "rgba(191,220,203,.12)",
                border: "1px solid rgba(80,112,91,.12)",
                padding: "9px 10px",
              }}
            >
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "var(--text-1)" }}>{example.title}</p>
              {example.description && (
                <p style={{ margin: "2px 0 0", fontSize: 11, lineHeight: 1.4, color: "var(--text-2)" }}>{example.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <AuraButtonV2
        variant="primary"
        size="md"
        onClick={handleAction}
        rightIcon={<ArrowRight size={14} />}
        style={{ width: "100%", minHeight: 44, marginTop: 2 }}
      >
        {ctaLabel}
      </AuraButtonV2>
    </div>
  );
}

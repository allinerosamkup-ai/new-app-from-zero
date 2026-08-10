import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Lock } from "lucide-react";
import { useSubscription } from "../hooks/useSubscription";
import { useLocalizedCopy } from "../i18n";

type PremiumGateProps = {
  children: ReactNode;
  /** Texto curto do que essa feature premium oferece. */
  feature?: string;
  /** Se true, mostra o conteúdo desfocado por trás do CTA em vez de escondê-lo. */
  blurBehind?: boolean;
  /** Fecha apenas esta oferta; o estado da tela que a abriu permanece intacto. */
  onDismiss?: () => void;
};

/**
 * Envolve uma feature premium. Se a usuária for Pro, renderiza children normalmente.
 * Caso contrário, mostra um CTA de upgrade que leva para /billing.
 * Enquanto carrega o status, renderiza children (evita flash de paywall em quem é Pro).
 */
export function PremiumGate({ children, feature, blurBehind = false, onDismiss }: PremiumGateProps) {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { isPro, loading, error, refresh } = useSubscription();

  if (isPro) return <>{children}</>;
  if (loading) {
    return <div role="status" aria-label={l("Confirmando acesso", "Checking access")} style={{ minHeight: 88 }} />;
  }

  return (
    <div style={{ position: "relative", borderRadius: 20, overflow: "hidden" }}>
      {blurBehind && (
        <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none", opacity: 0.5 }}>
          {children}
        </div>
      )}
      <div
        style={{
          ...(blurBehind
            ? { position: "absolute", inset: 0, display: "flex" }
            : {}),
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
          borderRadius: 20,
          border: "1.5px solid rgba(134,183,154,0.3)",
          background: "rgba(255,253,249,.96)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(134,183,154,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <Lock size={18} color="var(--accent-peach)" />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 900, color: "var(--text-1)" }}>
            {l("Recurso do Airia Pro", "Airia Pro feature")}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
            {feature ?? l("Desbloqueie IA ilimitada, insights avançados e mais.", "Unlock unlimited AI, advanced insights, and more.")}
          </p>
          <button
            onClick={() => navigate("/billing")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
              padding: "0 22px",
              borderRadius: 999,
              border: "none",
              background: "var(--accent-peach)",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            <Sparkles size={15} />
            {l("Conhecer o Pro", "Explore Pro")}
          </button>
          {error && (
            <button
              type="button"
              onClick={refresh}
              style={{ display: "block", margin: "10px auto 0", border: 0, background: "none", color: "var(--text-2)", fontWeight: 800, cursor: "pointer" }}
            >
              {l("Tentar novamente", "Try again")}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              style={{ display: "block", margin: "10px auto 0", border: 0, background: "none", color: "var(--text-2)", fontWeight: 700, cursor: "pointer" }}
            >
              {l("Continuar gratuitamente", "Continue for free")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

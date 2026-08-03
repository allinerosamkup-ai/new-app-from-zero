/**
 * NotificationPromptBanner
 *
 * Banner contextual que convida a usuária a ativar notificações.
 * Aparece apenas quando:
 *   - Permissão está em "default" (ainda não foi pedida)
 *   - Usuária fez pelo menos 1 check-in anterior (não é a primeira vez)
 *   - Não foi dispensado nas últimas 14 dias
 *
 * NÃO pede permissão automaticamente — só quando a usuária clicar em "Ativar".
 */
import { useEffect, useState } from "react";
import { Bell, X, Zap } from "lucide-react";
import { requestPushPermissionExplicit } from "../hooks/usePushNotifications";
import { useTranslation } from "react-i18next";

const DISMISS_KEY = "airia-notif-banner-dismissed-at";
const DISMISS_TTL_DAYS = 14;

function isFreshDismiss(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || !at) return false;
    return (Date.now() - at) / 86400000 < DISMISS_TTL_DAYS;
  } catch {
    return false;
  }
}

type Props = {
  userId: string | null;
  /** Número de check-ins feitos. Só exibe se > 0. */
  checkinCount: number;
};

export function NotificationPromptBanner({ userId, checkinCount }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (isFreshDismiss()) return;
    if (checkinCount < 1) return; // espera ao menos 1 check-in anterior
    setVisible(true);
  }, [checkinCount]);

  if (!visible) return null;
  if (granted) return null;

  async function handleActivate() {
    if (!userId) return;
    setLoading(true);
    try {
      const ok = await requestPushPermissionExplicit(userId);
      if (ok) {
        setGranted(true);
        setVisible(false);
      } else {
        // Negou — esconder e não mostrar de novo tão cedo
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setVisible(false);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <div style={{
      margin: "0 0 14px",
      padding: "14px 16px",
      borderRadius: 18,
      background: "rgba(255,255,255,0.88)",
      border: "1.5px solid rgba(134,183,154,0.22)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      boxShadow: "0 8px 24px rgba(134,183,154,0.10)",
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      position: "relative",
    }}>
      {/* Ícone */}
      <div style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "rgba(134,183,154,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
      }}>
        <Bell size={17} color="var(--accent-peach)" />
      </div>

      {/* Texto + CTA */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: "0 0 3px",
          fontSize: 13,
          fontWeight: 800,
          color: "var(--text-1)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {t("notificationsPrompt.title")}
        </p>
        <p style={{
          margin: "0 0 12px",
          fontSize: 12,
          color: "var(--text-2)",
          lineHeight: 1.5,
        }}>
          {t("notificationsPrompt.body")}
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleActivate}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: "none",
              background: "var(--accent-peach)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <Zap size={13} />
            {loading ? t("notificationsPrompt.activating") : t("notificationsPrompt.activate")}
          </button>

          <button
            onClick={handleDismiss}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 999,
              border: "1px solid rgba(134,183,154,0.22)",
              background: "transparent",
              color: "var(--text-3)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {t("notificationsPrompt.notNow")}
          </button>
        </div>
      </div>

      {/* Fechar (X discreto) */}
      <button
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-3)",
          padding: 4,
          display: "flex",
          alignItems: "center",
        }}
        aria-label={t("common.close")}
      >
        <X size={14} />
      </button>
    </div>
  );
}

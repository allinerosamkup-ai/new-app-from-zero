import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pwa-install-dismissed");
    if (stored) setDismissed(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!installEvent || dismissed) return null;

  const handleInstall = async () => {
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setInstallEvent(null);
      if (outcome === "dismissed") {
        localStorage.setItem("pwa-install-dismissed", "1");
        setDismissed(true);
      }
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "1");
    setDismissed(true);
    setInstallEvent(null);
  };

  return (
    <div style={{
      position: "fixed",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
      left: "50%",
      transform: "translateX(-50%)",
      width: "calc(100% - 32px)",
      maxWidth: "400px",
      background: "#FDF9F5",
      border: "1px solid #F4D0C8",
      borderRadius: "16px",
      padding: "16px",
      boxShadow: "0 8px 32px rgba(199, 112, 96, 0.15)",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      zIndex: 9999,
    }}>
      <img src="/icons/icon-192.png" alt="Airia" style={{ width: 44, height: 44, borderRadius: 10 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#4A3B37", fontFamily: "var(--font-sans, sans-serif)" }}>
          Adicionar ao celular
        </div>
        <div style={{ fontSize: 12, color: "#8B7B77", marginTop: 2 }}>
          Acesse a Airia direto da tela inicial
        </div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          background: "#F4A896",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Instalar
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          color: "#B8A8A4",
          cursor: "pointer",
          padding: 4,
          fontSize: 16,
          lineHeight: 1,
        }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
}

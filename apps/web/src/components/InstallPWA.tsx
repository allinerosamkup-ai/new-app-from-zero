import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isSplash = window.location.pathname === "/";
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Se já estiver instalado/standalone, nunca mostra
    if (isStandalone) return;

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const stored = localStorage.getItem("pwa-install-dismissed");

    // Na splash page, ignoramos o "dismissed" anterior para garantir que o usuário veja a opção
    // Em outras páginas, respeitamos o storage.
    if (!isSplash && stored && !isLocal) {
      setDismissed(true);
    }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    // No iOS, como não existe beforeinstallprompt, forçamos a exibição do banner
    if (isIos) {
      setInstallEvent({ prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) } as any);
    }

    const handler = (e: Event) => {
      console.log("PWA: beforeinstallprompt event captured");
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!installEvent || dismissed) return null;

  const handleInstall = async () => {
    // Se for iOS, mostramos o alerta de como instalar manualmente
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIos) {
      alert("Para instalar: toque no ícone de Compartilhar (quadrado com seta) e selecione 'Adicionar à Tela de Início'.");
      return;
    }

    if (installEvent.prompt) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") {
        setInstallEvent(null);
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
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      left: "50%",
      transform: "translateX(-50%)",
      width: "calc(100% - 32px)",
      maxWidth: "420px",
      background: "rgba(255, 255, 255, 0.92)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.4)",
      borderRadius: "24px",
      padding: "16px 20px",
      boxShadow: "0 20px 50px rgba(0, 0, 0, 0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 9999,
      gap: 16,
      animation: "pwaSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <style>{`
        @keyframes pwaSlideUp {
          from { transform: translate(-50%, 100px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>


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

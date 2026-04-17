import { useEffect, useState } from "react";
import { Apple, Download, Share2, Smartphone, X } from "lucide-react";

type Platform = "ios" | "android" | "desktop";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPadOS 13+ reporta como Mac; usar maxTouchPoints como heuristica adicional
  if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)?.trim();

export function InstallCTA() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [showIosModal, setShowIosModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleAndroidClick = async () => {
    if (APK_URL) {
      window.location.href = APK_URL;
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    // Fallback: abrir no Chrome com instrução
    alert("Para instalar: abra este site no Chrome e use o menu \u22EE \u2192 Instalar app.");
  };

  const ctaBaseStyle = {
    border: "none",
    borderRadius: 18,
    padding: "16px 22px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    justifyContent: "center",
  } as const;

  if (platform === "ios") {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIosModal(true)}
          style={{
            ...ctaBaseStyle,
            background: "#1a1a1a",
            color: "#fff",
            boxShadow: "0 20px 34px rgba(26,26,26,.22)",
          }}
        >
          <Apple size={18} />
          Instalar no iPhone
        </button>

        {showIosModal && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(17,24,39,.6)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={() => setShowIosModal(false)}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                background: "#fff",
                borderRadius: 24,
                padding: 24,
                maxWidth: 420,
                width: "100%",
                boxShadow: "0 30px 80px rgba(17,24,39,.3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1F2A36" }}>Instalar no iPhone</h3>
                <button
                  type="button"
                  onClick={() => setShowIosModal(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
                >
                  <X size={20} color="#8B96A5" />
                </button>
              </div>

              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={stepNumber}>1</span>
                  <div>
                    <p style={stepText}>
                      Toque em <Share2 size={14} style={{ display: "inline", verticalAlign: "middle", margin: "0 4px" }} /> Compartilhar na barra do Safari
                    </p>
                  </div>
                </li>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={stepNumber}>2</span>
                  <p style={stepText}>Role e escolha <strong>"Adicionar à Tela de Início"</strong></p>
                </li>
                <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={stepNumber}>3</span>
                  <p style={stepText}>Toque em <strong>"Adicionar"</strong>. Pronto — Airia aparece como app no seu iPhone.</p>
                </li>
              </ol>

              <p style={{ margin: "16px 0 0", fontSize: 12, color: "#8B96A5", textAlign: "center" }}>
                Funciona apenas no Safari. Se abriu em outro navegador, copie o link e abra no Safari.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  if (platform === "android") {
    return (
      <button
        type="button"
        onClick={handleAndroidClick}
        style={{
          ...ctaBaseStyle,
          background: "#3DDC84",
          color: "#0A2A14",
          boxShadow: "0 20px 34px rgba(61,220,132,.28)",
        }}
      >
        <Download size={18} />
        {APK_URL ? "Baixar APK Android" : "Instalar app Android"}
      </button>
    );
  }

  // Desktop
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        borderRadius: 18,
        background: "rgba(255,255,255,.78)",
        border: "1px solid rgba(17,24,39,.08)",
        color: "#6B5B57",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <Smartphone size={20} color="#B86D4C" style={{ flexShrink: 0 }} />
      <span>
        Abra <strong>airia.pro</strong> no celular para instalar como app — iPhone via Safari, Android via Chrome ou APK.
      </span>
    </div>
  );
}

const stepNumber = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "#F4A896",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

const stepText = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: "#1F2A36",
} as const;

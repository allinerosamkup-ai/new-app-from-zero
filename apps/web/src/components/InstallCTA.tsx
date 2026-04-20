import { useEffect, useState } from "react";
import { CheckCircle2, Download, Smartphone, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

type Platform = "ios" | "android" | "desktop";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|opios|chrome/i.test(ua) && /safari/i.test(ua);
}

export function InstallCTA() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsInstalled(isStandalonePwa());

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isInstalled) {
      window.location.assign("/home");
      return;
    }

    if (platform === "ios") {
      setShowIosSheet(true);
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }

    // Android sem prompt disponível ainda
    setShowIosSheet(false);
  };

  const isIos = platform === "ios";
  const title = isInstalled ? "Aplicativo instalado" : "Baixar aplicativo";
  const description = isInstalled
    ? "A Airia já está salva neste celular. Toque para abrir."
    : isIos
    ? "Instale a Airia na tela inicial e acesse direto pelo ícone."
    : "Instale a Airia no celular e abra direto pela tela inicial.";

  return (
    <>
      <InstallCard
        eyebrow="Instalação rápida"
        title={title}
        description={description}
        primaryLabel={isInstalled ? "Abrir app" : "Baixar aplicativo"}
        primaryIcon={
          isInstalled
            ? <CheckCircle2 size={18} />
            : isIos
            ? <Smartphone size={18} />
            : installPrompt
            ? <Download size={18} />
            : <Smartphone size={18} />
        }
        onPrimary={handleInstall}
        secondaryLabel="Usar no navegador"
        onSecondary={() => window.location.assign("/login?tab=criar")}
      />

      {showIosSheet && (
        <IosInstallSheet inSafari={isIosSafari()} onClose={() => setShowIosSheet(false)} />
      )}
    </>
  );
}

function IosInstallSheet({ inSafari, onClose }: { inSafari: boolean; onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
          zIndex: 900, backdropFilter: "blur(2px)",
        }}
      />
      <div style={sheetStyle}>
        <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Fechar">
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <img src="/icons/icon-192.png" alt="Airia" style={{ width: 36, height: 36, borderRadius: 8 }} />
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#4A3B37" }}>Instalar Airia</p>
            <p style={{ margin: 0, fontSize: 12, color: "#7C6D68" }}>Adicionar à tela inicial</p>
          </div>
        </div>

        {inSafari ? (
          <ol style={stepsListStyle}>
            <li style={stepItemStyle}>
              <span style={stepNumStyle}>1</span>
              <span>Toque no ícone de compartilhar
                <span style={{ display: "inline-block", margin: "0 4px", fontSize: 16 }}>⎙</span>
                na barra inferior do Safari
              </span>
            </li>
            <li style={stepItemStyle}>
              <span style={stepNumStyle}>2</span>
              <span>Role para baixo e toque <strong>"Adicionar à Tela de Início"</strong></span>
            </li>
            <li style={stepItemStyle}>
              <span style={stepNumStyle}>3</span>
              <span>Toque <strong>"Adicionar"</strong> no canto superior direito</span>
            </li>
          </ol>
        ) : (
          <div style={{ padding: "12px 0 4px" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#4A3B37", lineHeight: 1.5 }}>
              Para instalar no iPhone, abra este link no <strong>Safari</strong>.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#7C6D68" }}>
              Outros navegadores não permitem instalar PWA no iOS.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

const sheetStyle: CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(100%, 480px)",
  background: "#FEFEFE",
  borderRadius: "20px 20px 0 0",
  padding: "24px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
  zIndex: 901,
  boxShadow: "0 -8px 40px rgba(17,24,39,.14)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  background: "rgba(17,24,39,.06)",
  border: "none",
  borderRadius: "50%",
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#6B5B57",
};

const stepsListStyle: CSSProperties = {
  listStyle: "none",
  margin: "16px 0 0",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const stepItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  fontSize: 14,
  color: "#4A3B37",
  lineHeight: 1.5,
};

const stepNumStyle: CSSProperties = {
  minWidth: 22,
  height: 22,
  borderRadius: "50%",
  background: "#F4A896",
  color: "#5C3526",
  fontSize: 12,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 1,
};

function InstallCard({
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryIcon,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryIcon: ReactNode;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <section style={cardStyle}>
      <span style={eyebrowStyle}>{eyebrow}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={titleStyle}>{title}</h3>
        <p style={descriptionStyle}>{description}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        <button
          type="button"
          onClick={onPrimary}
          style={buttonStyle}
        >
          {primaryIcon}
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button type="button" onClick={onSecondary} style={secondaryButtonStyle}>
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid rgba(184,109,76,.16)",
  borderRadius: 8,
  padding: 13,
  display: "flex",
  flexDirection: "column",
  gap: 9,
  minHeight: 0,
  boxShadow: "0 14px 32px rgba(107,91,87,.07)",
  background: "linear-gradient(180deg, rgba(255,255,255,.92), rgba(244,168,150,.18))",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "#A45D3D",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.18,
  fontWeight: 800,
  color: "#4A3B37",
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "#7C6D68",
};

const buttonStyle: CSSProperties = {
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  justifyContent: "center",
  background: "#F4A896",
  color: "#5C3526",
  boxShadow: "0 18px 28px rgba(244,168,150,.22)",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(17,24,39,.08)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  color: "#6B5B57",
  background: "rgba(255,255,255,.76)",
};

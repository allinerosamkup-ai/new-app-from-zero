import { useEffect, useState } from "react";
import { Apple, CheckCircle2, Download, Globe2, Share2, Smartphone, X } from "lucide-react";
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

const APK_URL =
  (import.meta.env.VITE_APK_URL as string | undefined)?.trim() ||
  "https://airia.pro/airia.apk";

export function InstallCTA() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [showIosModal, setShowIosModal] = useState(false);
  const [showAndroidPwaHelp, setShowAndroidPwaHelp] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

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

  const handleApkDownload = () => {
    window.location.href = APK_URL;
  };

  const handlePwaInstall = async () => {
    if (platform === "ios") {
      setShowIosModal(true);
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }

    setShowAndroidPwaHelp(true);
  };

  if (platform === "ios") {
    return (
      <>
        {isInstalled ? (
          <div style={installedStyle}>
            <CheckCircle2 size={18} color="#5A7A64" />
            <span>PWA já instalada neste iPhone.</span>
          </div>
        ) : null}
        <InstallCard
          eyebrow="Instalação rápida"
          title={isInstalled ? "Abrir Airia no iPhone" : "Adicionar Airia ao iPhone"}
          description={isInstalled ? "Você já tem a versão PWA. O iPhone usa essa instalação pela Tela de Início." : "Abre como app pela Tela de Início, sem App Store. Melhor caminho para iOS agora."}
          primaryLabel={isInstalled ? "Abrir app" : "Instalar PWA no iPhone"}
          primaryIcon={<Apple size={18} />}
          onPrimary={() => (isInstalled ? window.location.assign("/home") : handlePwaInstall())}
          secondaryLabel="Usar no navegador"
          onSecondary={() => window.location.assign("/login?tab=criar")}
          tone="ios"
        />
        {showIosModal ? <InstallHelpModal platform="ios" onClose={() => setShowIosModal(false)} /> : null}
      </>
    );
  }

  if (platform === "android") {
    return (
      <>
        <div style={gridStyle}>
          <InstallCard
            eyebrow="App completo"
            title="Baixar APK Android"
            description="Versão nativa com widget Hoje na Airia, melhor integração com o celular e experiência mais completa."
            primaryLabel="Baixar APK"
            primaryIcon={<Download size={18} />}
            onPrimary={handleApkDownload}
            tone="apk"
          />
          <InstallCard
            eyebrow="Instalação rápida"
            title={isInstalled ? "PWA já instalada" : "Instalar PWA"}
            description={isInstalled ? "Essa é a versão web cliente que você já tem. O APK acima é o app Android mais completo." : "Versão web cliente na tela inicial. Boa para acesso rápido, sem baixar APK."}
            primaryLabel={isInstalled ? "Abrir PWA" : "Instalar PWA"}
            primaryIcon={isInstalled ? <CheckCircle2 size={18} /> : <Globe2 size={18} />}
            onPrimary={() => (isInstalled ? window.location.assign("/home") : handlePwaInstall())}
            tone="pwa"
          />
        </div>
        {showAndroidPwaHelp ? <InstallHelpModal platform="android" onClose={() => setShowAndroidPwaHelp(false)} /> : null}
      </>
    );
  }

  return (
    <div style={gridStyle}>
      <InstallCard
        eyebrow="Android"
        title="Baixar APK completo"
        description="Instale no celular Android para usar o app nativo com widget Hoje na Airia."
        primaryLabel="Baixar APK"
        primaryIcon={<Download size={18} />}
        onPrimary={handleApkDownload}
        tone="apk"
      />
      <InstallCard
        eyebrow="iPhone e web"
        title="Instalar PWA"
        description="Abra airia.pro no celular e adicione à Tela de Início para usar como app leve."
        primaryLabel="Ver instalação rápida"
        primaryIcon={<Smartphone size={18} />}
        onPrimary={() => setShowIosModal(true)}
        tone="pwa"
      />
      {showIosModal ? <InstallHelpModal platform="desktop" onClose={() => setShowIosModal(false)} /> : null}
    </div>
  );
}

function InstallCard({
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryIcon,
  onPrimary,
  secondaryLabel,
  onSecondary,
  tone,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryIcon: ReactNode;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone: "apk" | "pwa" | "ios";
}) {
  const palette = tonePalette[tone];

  return (
    <section style={{ ...cardStyle, borderColor: palette.border, background: palette.background }}>
      <span style={{ ...eyebrowStyle, color: palette.eyebrow }}>{eyebrow}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={titleStyle}>{title}</h3>
        <p style={descriptionStyle}>{description}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        <button
          type="button"
          onClick={onPrimary}
          style={{
            ...buttonStyle,
            background: palette.button,
            color: palette.buttonText,
            boxShadow: palette.shadow,
          }}
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

function InstallHelpModal({
  platform,
  onClose,
}: {
  platform: "ios" | "android" | "desktop";
  onClose: () => void;
}) {
  const isAndroid = platform === "android";
  const title = isAndroid ? "Instalar PWA no Android" : "Instalar PWA no iPhone";
  const steps = isAndroid
    ? [
        "Abra este site no Chrome do Android.",
        "Toque no menu de três pontos.",
        "Escolha Instalar app ou Adicionar à tela inicial.",
      ]
    : [
        "Abra airia.pro no Safari.",
        "Toque em Compartilhar na barra inferior.",
        "Escolha Adicionar à Tela de Início e confirme em Adicionar.",
      ];

  return (
    <div role="dialog" aria-modal="true" style={modalBackdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <p style={modalEyebrowStyle}>Instalação rápida</p>
            <h3 style={{ margin: "4px 0 0", fontSize: 20, lineHeight: 1.15, fontWeight: 800, color: "#4A3B37" }}>{title}</h3>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Fechar instruções">
            <X size={20} />
          </button>
        </div>

        <ol style={{ margin: "22px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
          {steps.map((step, index) => (
            <li key={step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={stepNumberStyle}>{index + 1}</span>
              <p style={stepTextStyle}>
                {index === 1 && !isAndroid ? (
                  <>
                    Toque em <Share2 size={14} style={{ display: "inline", verticalAlign: "middle", margin: "0 4px" }} /> Compartilhar na barra inferior.
                  </>
                ) : (
                  step
                )}
              </p>
            </li>
          ))}
        </ol>

        <p style={{ margin: "18px 0 0", fontSize: 12, lineHeight: 1.6, color: "#8B7B77" }}>
          PWA é a versão web cliente instalada na tela inicial. No Android, o APK é mais completo porque inclui widget nativo.
        </p>
      </div>
    </div>
  );
}

const tonePalette = {
  apk: {
    background: "linear-gradient(180deg, rgba(255,255,255,.92), rgba(184,217,200,.24))",
    border: "rgba(80,112,91,.18)",
    eyebrow: "#50705B",
    button: "#3A7A66",
    buttonText: "#FFFFFF",
    shadow: "0 18px 28px rgba(58,122,102,.18)",
  },
  pwa: {
    background: "linear-gradient(180deg, rgba(255,255,255,.92), rgba(244,168,150,.18))",
    border: "rgba(184,109,76,.16)",
    eyebrow: "#A45D3D",
    button: "#F4A896",
    buttonText: "#5C3526",
    shadow: "0 18px 28px rgba(244,168,150,.22)",
  },
  ios: {
    background: "linear-gradient(180deg, rgba(255,255,255,.94), rgba(212,196,224,.22))",
    border: "rgba(107,91,87,.12)",
    eyebrow: "#7B687D",
    button: "#1F1D1B",
    buttonText: "#FFFFFF",
    shadow: "0 18px 30px rgba(31,29,27,.18)",
  },
} as const;

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
  width: "100%",
};

const cardStyle: CSSProperties = {
  border: "1px solid",
  borderRadius: 8,
  padding: 13,
  display: "flex",
  flexDirection: "column",
  gap: 9,
  minHeight: 0,
  boxShadow: "0 14px 32px rgba(107,91,87,.07)",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: ".16em",
  textTransform: "uppercase",
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

const installedStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "14px 16px",
  borderRadius: 8,
  background: "rgba(184,217,200,.22)",
  border: "1px solid rgba(80,112,91,.16)",
  color: "#50705B",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
};

const modalBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(31,29,27,.52)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: CSSProperties = {
  background: "#FFFDFC",
  borderRadius: 8,
  padding: 22,
  maxWidth: 430,
  width: "100%",
  boxShadow: "0 30px 80px rgba(31,29,27,.28)",
  border: "1px solid rgba(255,255,255,.52)",
};

const modalEyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "#A45D3D",
};

const closeButtonStyle: CSSProperties = {
  background: "rgba(107,91,87,.06)",
  border: "1px solid rgba(107,91,87,.08)",
  borderRadius: 8,
  cursor: "pointer",
  padding: 8,
  color: "#6B5B57",
  display: "inline-flex",
};

const stepNumberStyle: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "#F4A896",
  color: "#5C3526",
  fontSize: 13,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const stepTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: "#4A3B37",
};

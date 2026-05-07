import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { trackInstallConversion } from "../lib/meta-pixel";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_TTL_DAYS = 7;

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPad com iOS 13+ se identifica como Mac com touch
  if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isFreshDismiss(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || !at) return false;
  const ageDays = (Date.now() - at) / 86400000;
  return ageDays < DISMISS_TTL_DAYS;
}

/**
 * Banner flutuante de instalação PWA.
 * Aparece SEMPRE que o app não está em modo standalone, em qualquer plataforma.
 * Não depende do evento beforeinstallprompt — quando o Chrome dispara, a gente usa o prompt nativo;
 * quando não dispara (caso comum em iOS e Android com heurística não atendida), abre instruções.
 */
export function InstallPWA() {
  const [show, setShow] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [sheet, setSheet] = useState<Platform | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalonePwa()) return;

    const isSplash = window.location.pathname === "/";
    // Na splash, ignora dismiss anterior (queremos máxima exposição na entrada)
    // Em outras páginas, respeita TTL de 7 dias
    if (!isSplash && isFreshDismiss()) return;

    setShow(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  const platform = detectPlatform();

  const handleInstall = async () => {
    // Se o Chrome capturou o evento, usa o diálogo nativo do sistema
    if (installEvent && installEvent.prompt) {
      try {
        await installEvent.prompt();
        const { outcome } = await installEvent.userChoice;
        setInstallEvent(null);
        if (outcome === "accepted") {
          trackInstallConversion("pwa_prompt");
          setShow(false);
        }
        return;
      } catch {
        // Se o prompt nativo falhar, cai pra instruções
      }
    }
    // Sem evento (iOS sempre; Android quando Chrome não dispara): instruções por plataforma
    trackInstallConversion("manual_instructions");
    setSheet(platform);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  return (
    <>
      <div style={bannerStyle}>
        <style>{`
          @keyframes pwaSlideDown {
            from { transform: translate(-50%, -120%); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
          }
        `}</style>
        <img
          src="/icons/icon-192.png"
          alt=""
          style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={titleStyle}>Instalar Airia no celular</div>
          <div style={subtitleStyle}>Acesse direto da tela inicial</div>
        </div>
        <button onClick={handleInstall} style={installButtonStyle}>
          Instalar
        </button>
        <button onClick={handleDismiss} style={dismissButtonStyle} aria-label="Fechar">
          ✕
        </button>
      </div>

      {sheet === "ios" && <IosInstallSheet onClose={() => setSheet(null)} />}
      {sheet === "android" && <AndroidInstallSheet onClose={() => setSheet(null)} />}
      {sheet === "desktop" && <DesktopInstallSheet onClose={() => setSheet(null)} />}
    </>
  );
}

function IosInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <SheetWrapper onClose={onClose} title="Instalar no iPhone/iPad">
      <ol style={stepsListStyle}>
        <li style={stepItemStyle}>
          <span style={stepNumStyle}>1</span>
          <span>
            Abra esta página no <strong>Safari</strong> (outros navegadores não permitem).
          </span>
        </li>
        <li style={stepItemStyle}>
          <span style={stepNumStyle}>2</span>
          <span>
            Toque no ícone de <strong>Compartilhar</strong> <span style={{ fontSize: 16 }}>⎙</span> na barra inferior.
          </span>
        </li>
        <li style={stepItemStyle}>
          <span style={stepNumStyle}>3</span>
          <span>
            Role e toque em <strong>"Adicionar à Tela de Início"</strong>.
          </span>
        </li>
        <li style={stepItemStyle}>
          <span style={stepNumStyle}>4</span>
          <span>
            Confirme tocando em <strong>"Adicionar"</strong> no canto superior direito.
          </span>
        </li>
      </ol>
    </SheetWrapper>
  );
}

function AndroidInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <SheetWrapper onClose={onClose} title="Instalar no Android">
      <ol style={stepsListStyle}>
        <li style={stepItemStyle}>
          <span style={stepNumStyle}>1</span>
          <span>
            Toque no <strong>menu ⋮</strong> no canto superior direito do navegador.
          </span>
        </li>
        <li style={stepItemStyle}>
          <span style={stepNumStyle}>2</span>
          <span>
            Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
          </span>
        </li>
        <li style={stepItemStyle}>
          <span style={stepNumStyle}>3</span>
          <span>Confirme tocando em <strong>"Instalar"</strong>.</span>
        </li>
      </ol>
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "#7C6D68", lineHeight: 1.4 }}>
        Funciona em Chrome, Edge e Samsung Internet.
      </p>
    </SheetWrapper>
  );
}

function DesktopInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <SheetWrapper onClose={onClose} title="Instalar no computador">
      <p style={{ margin: 0, fontSize: 14, color: "#4A3B37", lineHeight: 1.5 }}>
        No Chrome ou Edge, procure o ícone de instalação <strong>⊕</strong> no canto direito da barra de endereço e clique em <strong>"Instalar"</strong>.
      </p>
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "#7C6D68" }}>
        Se não aparecer, abra o menu <strong>⋮</strong> → <strong>Instalar Airia</strong>.
      </p>
    </SheetWrapper>
  );
}

function SheetWrapper({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <div style={sheetStyle}>
        <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Fechar">
          ✕
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <img
            src="/icons/icon-192.png"
            alt="Airia"
            style={{ width: 36, height: 36, borderRadius: 8 }}
          />
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#4A3B37" }}>{title}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#7C6D68" }}>Adicionar à tela inicial</p>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}

const bannerStyle: CSSProperties = {
  position: "fixed",
  top: "calc(env(safe-area-inset-top, 0px) + 12px)",
  left: "50%",
  transform: "translateX(-50%)",
  width: "calc(100% - 24px)",
  maxWidth: "440px",
  background: "rgba(255, 255, 255, 0.96)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(180, 130, 110, 0.18)",
  borderRadius: 14,
  padding: "10px 12px",
  boxShadow: "0 10px 32px rgba(0, 0, 0, 0.10)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  zIndex: 10000,
  animation: "pwaSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
};

const titleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#4A3B37",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subtitleStyle: CSSProperties = {
  fontSize: 11,
  color: "#8B7B77",
  lineHeight: 1.3,
  marginTop: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const installButtonStyle: CSSProperties = {
  background: "#F4A896",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  boxShadow: "0 6px 14px rgba(244, 168, 150, 0.35)",
};

const dismissButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#B8A8A4",
  cursor: "pointer",
  padding: 4,
  fontSize: 14,
  lineHeight: 1,
  flexShrink: 0,
};

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.4)",
  zIndex: 10001,
  backdropFilter: "blur(2px)",
};

const sheetStyle: CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(100%, 480px)",
  background: "#FEFEFE",
  borderRadius: "20px 20px 0 0",
  padding: "24px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
  zIndex: 10002,
  boxShadow: "0 -8px 40px rgba(17, 24, 39, 0.14)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 14,
  right: 14,
  background: "rgba(17, 24, 39, 0.06)",
  border: "none",
  borderRadius: "50%",
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#6B5B57",
  fontSize: 14,
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
  flexShrink: 0,
};

const PIXEL_ID = "1250738127257679";
const INSTALL_CONVERSION_KEY = "airia.metaPixel.installTracked";

type MetaPixelEventProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    fbq?: {
      (...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: Window["fbq"];
  }
}

function canUsePixel() {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

export function initMetaPixel() {
  if (!canUsePixel()) return;
  window.fbq?.("init", PIXEL_ID);
}

export function trackMetaPixelPageView() {
  if (!canUsePixel()) return;
  window.fbq?.("track", "PageView");
}

export function trackMetaPixelEvent(eventName: string, properties: MetaPixelEventProperties = {}) {
  if (!canUsePixel()) return;
  window.fbq?.("track", eventName, properties);
}

export function trackMetaPixelCustom(eventName: string, properties: MetaPixelEventProperties = {}) {
  if (!canUsePixel()) return;
  window.fbq?.("trackCustom", eventName, properties);
}

export function trackRegistrationConversion(method: "email" | "google" | "unknown" = "unknown") {
  trackMetaPixelEvent("CompleteRegistration", {
    content_name: "Airia cadastro",
    method,
  });
}

export function trackInstallConversion(method: "pwa_prompt" | "standalone_open" | "install_cta" | "manual_instructions") {
  trackMetaPixelCustom("AppInstall", {
    content_name: "Airia instalação",
    method,
  });
}

export function trackInstallConversionOnce(method: "standalone_open") {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(INSTALL_CONVERSION_KEY) === "true") return;
    trackInstallConversion(method);
    window.localStorage.setItem(INSTALL_CONVERSION_KEY, "true");
  } catch {
    trackInstallConversion(method);
  }
}

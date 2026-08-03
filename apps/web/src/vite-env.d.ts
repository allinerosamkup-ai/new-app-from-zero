/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Globais injetados pelo shell nativo (APK Android) quando o PWA roda embarcado.
interface Window {
  __AIRIA_NATIVE_SHELL__?: boolean;
}

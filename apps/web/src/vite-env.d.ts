/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Globais injetados pelo shell nativo (APK Android) quando o PWA roda embarcado.
interface Window {
  __AIRIA_NATIVE_SHELL__?: boolean;
  __AIRIA_NATIVE_GOOGLE_AUTH__?: unknown;
}

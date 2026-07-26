import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { AuraStoreProvider } from "./features/aura/store";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import "./styles/globals.css";
import "./styles/aura.css";
import "./i18n";

// Register Service Worker for PWA
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const reloadLockKey = "airia:pwa-update-reload-at";
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const lastReload = Number(sessionStorage.getItem(reloadLockKey) || 0);
      if (Date.now() - lastReload < 30_000) return;
      sessionStorage.setItem(reloadLockKey, String(Date.now()));
      void updateSW?.(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const checkForUpdate = () => {
        if (document.visibilityState === "visible") void registration.update();
      };
      checkForUpdate();
      window.addEventListener("focus", checkForUpdate);
      document.addEventListener("visibilitychange", checkForUpdate);
      window.setInterval(checkForUpdate, 15 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error("SW Registration Error:", error);
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuraStoreProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuraStoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

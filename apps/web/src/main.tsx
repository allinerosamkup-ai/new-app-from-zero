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
  // registerType: 'autoUpdate' — o próprio vite-plugin-pwa recarrega a aba
  // uma única vez quando o novo SW assume (com trava interna anti-loop).
  // NÃO chamar window.location.reload() manualmente aqui: reload sem trava +
  // skipWaiting causava loop de reload (página tremendo, botões mortos).
  registerSW({
    immediate: true,
    onRegistered(r) {
      console.log("SW Registered:", r);
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

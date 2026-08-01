import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuraStoreProvider } from "./features/aura/store";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import "./styles/globals.css";
import "./styles/aura.css";
import "./i18n";

// O service worker é a única autoridade de navegação entre releases. A página
// apenas registra e procura atualizações, evitando uma segunda navegação.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      const checkForUpdate = () => {
        if (document.visibilityState === "visible") {
          void registration.update().catch((error) => {
            console.error("SW Update Error:", error);
          });
        }
      };
      checkForUpdate();
      window.addEventListener("focus", checkForUpdate);
      document.addEventListener("visibilitychange", checkForUpdate);
      window.setInterval(checkForUpdate, 15 * 60 * 1000);
    })
    .catch((error) => {
      console.error("SW Registration Error:", error);
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

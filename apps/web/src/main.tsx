import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuraStoreProvider } from "./features/aura/store";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import "./styles/globals.css";
import "./styles/aura.css";

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

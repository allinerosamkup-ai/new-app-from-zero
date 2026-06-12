import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ToastMessage {
  id: number;
  message: string;
  type: "error" | "success" | "info";
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextType {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showUndo: (message: string, onUndo: () => void) => void;
}

const ToastContext = createContext<ToastContextType>({
  showError: () => {},
  showSuccess: () => {},
  showUndo: () => {},
});

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const add = useCallback((message: string, type: ToastMessage["type"], action?: { label: string; onAction: () => void }) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, type, actionLabel: action?.label, onAction: action?.onAction }]);
    // Com ação de desfazer o toast fica mais tempo na tela
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, action ? 6000 : 2200);
  }, []);

  const showError = useCallback((m: string) => add(m, "error"), [add]);
  const showSuccess = useCallback((m: string) => add(m, "success"), [add]);
  const showUndo = useCallback((m: string, onUndo: () => void) => add(m, "info", { label: "Desfazer", onAction: onUndo }), [add]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showError, showSuccess, showUndo }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "error" ? "var(--accent-peach)" : t.type === "success" ? "var(--accent-sage)" : "var(--text-2)",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
              maxWidth: 300,
              textAlign: "center",
              animation: "toastPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              pointerEvents: t.onAction ? "auto" : "none",
            }}
          >
            <span>{t.message}</span>
            {t.onAction && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                }}
              >
                {t.actionLabel ?? "Desfazer"}
              </button>
            )}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastPop {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ToastMessage {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

interface ToastContextType {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  showError: () => {},
  showSuccess: () => {},
});

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const add = useCallback((message: string, type: ToastMessage["type"]) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  const showError = useCallback((m: string) => add(m, "error"), [add]);
  const showSuccess = useCallback((m: string) => add(m, "success"), [add]);

  return (
    <ToastContext.Provider value={{ showError, showSuccess }}>
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
              maxWidth: 280,
              textAlign: "center",
              animation: "toastPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {t.message}
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

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
    }, 4000);
  }, []);

  const showError = useCallback((m: string) => add(m, "error"), [add]);
  const showSuccess = useCallback((m: string) => add(m, "success"), [add]);

  return (
    <ToastContext.Provider value={{ showError, showSuccess }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 90,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "error" ? "#B94040" : t.type === "success" ? "#3A8C65" : "#444",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              maxWidth: 300,
              textAlign: "center",
              animation: "fadeInUp 0.2s ease",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

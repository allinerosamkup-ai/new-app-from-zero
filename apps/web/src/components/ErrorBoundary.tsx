import { Component, ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function DefaultErrorFallback({ error }: { error: Error | null }) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--warm-bg, #FAF6F2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div className="glass-card" style={{ maxWidth: 340, width: "100%", padding: "32px 24px", textAlign: "center", borderRadius: "16px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
        <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary, #1a1a1a)", marginBottom: 8 }}>
          {t("common.somethingWrong")}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary, #666)", marginBottom: 24, lineHeight: 1.5 }}>
          {error?.message ?? t("common.unexpectedError")}
        </p>
        <button
          className="btn-aura"
          style={{ background: "var(--bg-dark, #C5A593)", color: "#fff", border: "none", width: "100%", height: 52, borderRadius: "6.5px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
          onClick={() => window.location.reload()}
        >
          {t("common.reload")}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

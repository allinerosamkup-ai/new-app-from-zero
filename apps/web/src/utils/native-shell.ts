type NativeShellMessage =
  | { type: "auth.signOut" }
  | { type: "external.open"; url: string }
  | { type: "widget.sync"; payload: NativeTodayWidgetPayload }
  | { type: "health.connectSync"; requestId: string };

export type NativeTodayWidgetPayload = {
  stateLabel: string;
  stateType: string;
  moodScore: number | null;
  energyScore: number | null;
  updatedAt: string;
  planner: Array<{
    time: string;
    title: string;
  }>;
};

type NativeWebViewBridge = {
  postMessage: (message: string) => void;
};

function getNativeWebViewBridge(): NativeWebViewBridge | null {
  if (typeof window === "undefined") return null;

  const bridge = (
    window as Window & {
      ReactNativeWebView?: NativeWebViewBridge;
    }
  ).ReactNativeWebView;

  return bridge && typeof bridge.postMessage === "function" ? bridge : null;
}

function normalizeWidgetText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;

  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return fallback;
  return clean.slice(0, maxLength);
}

function normalizeWidgetScore(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(10, Math.max(1, Math.round(value)));
}

function normalizeWidgetUpdatedAt(value: unknown) {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function fallbackStateLabel(stateType: string) {
  const normalized = stateType.trim().toLowerCase();

  if (normalized === "stable" || normalized === "leve") return "Estavel";
  if (normalized === "balanced" || normalized === "moderado") return "Moderado";
  if (normalized === "sensitive" || normalized === "sensivel" || normalized === "sensível") return "Sensivel";
  if (normalized === "overloaded" || normalized === "critico" || normalized === "crítico") return "Critico";

  return "Sem check-in";
}

export function createNativeTodayWidgetPayload(input: {
  stateLabel?: unknown;
  stateType?: unknown;
  moodScore?: unknown;
  energyScore?: unknown;
  updatedAt?: unknown;
  planner?: Array<{ time?: unknown; title?: unknown }>;
}): NativeTodayWidgetPayload {
  const stateType = normalizeWidgetText(input.stateType, "unknown", 32);
  const stateLabel = normalizeWidgetText(input.stateLabel, fallbackStateLabel(stateType), 48);

  return {
    stateLabel,
    stateType,
    moodScore: normalizeWidgetScore(input.moodScore),
    energyScore: normalizeWidgetScore(input.energyScore),
    updatedAt: normalizeWidgetUpdatedAt(input.updatedAt),
    planner: Array.isArray(input.planner)
      ? input.planner
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            time: normalizeWidgetText(item.time, "--", 5),
            title: normalizeWidgetText(item.title, "Bloco sem titulo", 52),
          }))
          .slice(0, 3)
      : [],
  };
}

export function postNativeShellMessage(message: NativeShellMessage) {
  const bridge = getNativeWebViewBridge();
  if (!bridge) return;

  bridge.postMessage(JSON.stringify(message));
}

export function postNativeWidgetSync(payload: NativeTodayWidgetPayload) {
  postNativeShellMessage({
    type: "widget.sync",
    payload: createNativeTodayWidgetPayload(payload),
  });
}

export function isNativeShell() {
  return Boolean(getNativeWebViewBridge());
}

export function requestNativeHealthConnectSync(): Promise<{ ok: boolean; snapshot?: unknown; error?: string }> {
  const requestId = `health-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bridge = getNativeWebViewBridge();

  if (!bridge) {
    return Promise.resolve({ ok: false, error: "Health Connect só está disponível no app Android." });
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("airia:health-connect-sync", handler as EventListener);
      resolve({ ok: false, error: "A sincronização demorou demais. Tente de novo." });
    }, 45000);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { requestId?: string; ok?: boolean; snapshot?: unknown; error?: string };
      if (detail?.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener("airia:health-connect-sync", handler as EventListener);
      resolve({ ok: detail.ok === true, snapshot: detail.snapshot, error: detail.error });
    };

    window.addEventListener("airia:health-connect-sync", handler as EventListener);
    bridge.postMessage(JSON.stringify({ type: "health.connectSync", requestId }));
  });
}

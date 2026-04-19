type NativeShellMessage =
  | { type: "auth.signOut" }
  | { type: "external.open"; url: string };

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

export function postNativeShellMessage(message: NativeShellMessage) {
  const bridge = getNativeWebViewBridge();
  if (!bridge) return;

  bridge.postMessage(JSON.stringify(message));
}


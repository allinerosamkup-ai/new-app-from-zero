import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ObjectivesModal } from "./objectives-modal";

describe("objectives modal navigation isolation", () => {
  it("escapes route stacking contexts, contains keyboard focus and restores the opener", async () => {
    const host = document.createElement("div");
    const opener = document.createElement("button");
    document.body.append(host, opener);
    opener.focus();
    const originalOverflow = document.body.style.overflow;
    const root = createRoot(host);
    const close = vi.fn();
    try {
      await act(async () => root.render(<ObjectivesModal label="Goal with AI" onClose={close}><textarea aria-label="Goal" /><button>Confirm</button></ObjectivesModal>));
      const modal = document.querySelector<HTMLElement>('.ow-modal');
      const dialog = modal?.querySelector<HTMLElement>('[role="dialog"]');
      const field = dialog?.querySelector("textarea");
      const confirm = dialog?.querySelector("button");
      expect(modal?.parentElement).toBe(document.body);
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      expect(dialog?.getAttribute("aria-label")).toBe("Goal with AI");
      expect(document.activeElement).toBe(field);
      expect(document.body.style.overflow).toBe("hidden");
      opener.focus();
      expect(document.activeElement).toBe(field);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true }));
      expect(document.activeElement).toBe(confirm);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
      expect(document.activeElement).toBe(field);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
      expect(close).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
      expect(document.activeElement).toBe(opener);
      expect(document.body.style.overflow).toBe(originalOverflow);
      host.remove();
      opener.remove();
    }
  });
});

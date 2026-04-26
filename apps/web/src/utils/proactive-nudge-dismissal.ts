import type { ProactiveNudge } from "../features/aura/types";
import { getLocalDateKey } from "./day-context";

const PROACTIVE_NUDGE_DISMISS_PREFIX = "aura.proactiveNudge.dismissed";

function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function getDismissKey(nudge: Pick<ProactiveNudge, "type" | "message">): string {
  return `${PROACTIVE_NUDGE_DISMISS_PREFIX}:${getLocalDateKey()}:${nudge.type}:${hashText(nudge.message)}`;
}

export function dismissProactiveNudgeForToday(nudge: Pick<ProactiveNudge, "type" | "message">): void {
  try {
    localStorage.setItem(getDismissKey(nudge), new Date().toISOString());
  } catch {
    // Dismissal is a UX improvement; storage failure should not block closing.
  }
}

export function isProactiveNudgeDismissedToday(nudge: Pick<ProactiveNudge, "type" | "message">): boolean {
  try {
    return Boolean(localStorage.getItem(getDismissKey(nudge)));
  } catch {
    return false;
  }
}

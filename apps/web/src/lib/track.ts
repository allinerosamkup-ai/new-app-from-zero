import { ApiRequestError, api } from "./api";

type TrackProperties = Record<string, unknown>;

export type ProductEventName =
  | "checkin.opened.v1" | "checkin.optional_context_toggled.v1" | "checkin.voice_requested.v1"
  | "checkin.voice_failed.v1" | "checkin.submit_attempted.v1" | "checkin.validation_blocked.v1"
  | "checkin.completed.v1" | "checkin.queued.v1" | "checkin.save_failed.v1"
  | "home.opened.v1" | "home.next_step_selected.v1"
  | "patterns.opened.v1" | "patterns.report_requested.v1" | "patterns.report_resolved.v1"
  | "journal.opened.v1" | "journal.entry_saved.v1"
  | "goals.opened.v1" | "goal.created.v1" | "goal.action_changed.v1"
  | "decision.presented.v1" | "decision.feedback_submitted.v1";

type ProductEventSurface = "checkin" | "home" | "patterns" | "journal" | "goals" | "checkin_result";

type PendingProductEvent = {
  eventId: string;
  eventName: ProductEventName;
  surface: ProductEventSurface;
  occurredAt: string;
  properties: Record<string, unknown>;
  path: string;
  attempts?: number;
};

const PRODUCT_EVENT_QUEUE_KEY = "airia.product-event-queue.v1";
const PRODUCT_EVENT_QUEUE_LIMIT = 200;
const PRODUCT_EVENT_MAX_DELIVERY_ATTEMPTS = 5;

/**
 * Somente falhas transitórias merecem ocupar a fila local. Um `400`, `401`,
 * `403` ou `422` não melhora quando a conexão volta; reenviá-lo para sempre
 * gasta bateria, cria ruído e mascara um erro de contrato que precisa morrer.
 */
export function shouldRetryProductEventError(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }

  // `fetch` sinaliza falhas de rede/CORS como TypeError, sem resposta HTTP.
  return error instanceof TypeError;
}

function createEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const timestamp = Date.now().toString(16).padStart(12, "0").slice(-12);
  const random = Math.floor(Math.random() * 0x1_0000_0000_0000).toString(16).padStart(12, "0");
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-4000-8000-${random}`;
}

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

function readQueuedProductEvents(): PendingProductEvent[] {
  try {
    const raw = window.localStorage.getItem(PRODUCT_EVENT_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueuedProductEvents(events: PendingProductEvent[]) {
  try {
    window.localStorage.setItem(PRODUCT_EVENT_QUEUE_KEY, JSON.stringify(events.slice(-PRODUCT_EVENT_QUEUE_LIMIT)));
  } catch {
    // A telemetria é complementar; falhas de armazenamento nunca afetam a UI.
  }
}

function queueProductEvent(event: PendingProductEvent) {
  if (typeof window === "undefined") return;
  const existing = readQueuedProductEvents();
  if (existing.some((item) => item.eventId === event.eventId)) return;
  writeQueuedProductEvents([...existing, event]);
}

async function flushQueuedProductEvents() {
  if (typeof window === "undefined" || !isOnline()) return;
  const queued = readQueuedProductEvents();
  if (queued.length === 0) return;

  const remaining: PendingProductEvent[] = [];
  for (const event of queued) {
    try {
      await api.post("/events/product", event);
    } catch (error) {
      const attempts = event.attempts ?? 0;
      if (shouldRetryProductEventError(error) && attempts < PRODUCT_EVENT_MAX_DELIVERY_ATTEMPTS) {
        remaining.push({ ...event, attempts: attempts + 1 });
      }
    }
  }
  writeQueuedProductEvents(remaining);
}

/**
 * Eventos semânticos e minimizados do núcleo ativo. O chamador nunca deve passar
 * texto livre, valores de saúde, diário, transcrição ou identificadores de pessoa.
 */
export function trackProductEvent(
  eventName: ProductEventName,
  surface: ProductEventSurface,
  properties: Record<string, unknown>,
  path = typeof window !== "undefined" ? window.location.pathname : "/",
) {
  const event: PendingProductEvent = {
    eventId: createEventId(),
    eventName,
    surface,
    occurredAt: new Date().toISOString(),
    properties,
    path,
  };
  void (async () => {
    if (!isOnline()) {
      queueProductEvent(event);
      return;
    }
    await flushQueuedProductEvents();
    try {
      await api.post("/events/product", event);
    } catch (error) {
      // Reusar evento, timestamp e identificador é essencial para idempotência
      // quando a rede voltar; nunca se cria um segundo evento para o retry. Um
      // erro de contrato ou autorização é descartado: repetir não o torna válido.
      if (shouldRetryProductEventError(error)) {
        queueProductEvent(event);
      }
    }
  })();
}

export function trackEvent(
  eventName: string,
  properties: TrackProperties = {},
  path = typeof window !== "undefined" ? window.location.pathname : "/",
) {
  void api.post("/events", {
    eventName,
    properties,
    path,
  }).catch(() => {
    // Tracking never blocks the user flow.
  });
}

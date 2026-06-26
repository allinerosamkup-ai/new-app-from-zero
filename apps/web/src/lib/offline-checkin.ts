/**
 * Offline check-in queue — salva localmente quando sem internet,
 * sincroniza automaticamente quando a conexão volta.
 */

const STORE_KEY = "airia_offline_checkins";

export type OfflineCheckin = {
  id: string;
  date: string;
  humor: number;
  energia: number;
  irritabilidade?: number;
  clareza?: number;
  sono?: number;
  emotion?: string;
  checkinSlot?: string;
  queuedAt: number;
};

function readQueue(): OfflineCheckin[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineCheckin[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(queue));
}

export function queueCheckin(checkin: Omit<OfflineCheckin, "id" | "queuedAt">): void {
  const queue = readQueue();
  queue.push({
    ...checkin,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queuedAt: Date.now(),
  });
  writeQueue(queue);
}

export function getPendingCount(): number {
  return readQueue().length;
}

export async function syncPendingCheckins(
  submitFn: (c: Omit<OfflineCheckin, "id" | "queuedAt">) => Promise<void>
): Promise<number> {
  if (!navigator.onLine) return 0;
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const successful: string[] = [];
  for (const item of queue) {
    try {
      const { id, queuedAt, ...payload } = item;
      await submitFn(payload);
      successful.push(id);
    } catch {
      // Mantém na fila para próxima tentativa
    }
  }

  const remaining = queue.filter((c) => !successful.includes(c.id));
  writeQueue(remaining);
  return successful.length;
}

/**
 * Hook-like listener: sincroniza quando online.
 * Chame no topo do app (main.tsx ou App.tsx).
 */
export function registerOfflineSync(
  submitFn: (c: Omit<OfflineCheckin, "id" | "queuedAt">) => Promise<void>
): () => void {
  const handleOnline = () => {
    syncPendingCheckins(submitFn).then((n) => {
      if (n > 0) {
        console.log(`[offline-sync] ${n} check-in(s) sincronizados.`);
      }
    });
  };
  window.addEventListener("online", handleOnline);
  // Tenta sync imediato ao registrar (caso já esteja online)
  handleOnline();
  return () => window.removeEventListener("online", handleOnline);
}

import { supabase } from './supabase';

const apiBaseUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: 'GET' });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

type SseEvent =
  | { event: 'session.started'; data: { sessionId: string } }
  | { event: 'assistant.delta'; data: { chunk: string } }
  | { event: 'assistant.completed'; data: { sessionId: string; message: { id: string; role: string; content: string; createdAt: string } } }
  | { event: 'error'; data: { error: string } };

function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const eventLine = lines.find(l => l.startsWith('event:'));
  const dataLine = lines.find(l => l.startsWith('data:'));
  if (!eventLine || !dataLine) return null;
  try {
    return { event: eventLine.slice(6).trim(), data: JSON.parse(dataLine.slice(5).trim()) } as SseEvent;
  } catch {
    return null;
  }
}

export async function streamJournalMessage(input: {
  sessionId: string;
  message: string;
  onDelta: (chunk: string) => void;
  onCompleted: (msg: { id: string; role: string; content: string; createdAt: string }) => void;
  onError: (err: string) => void;
}): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${apiBaseUrl}/api/journal/message/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ sessionId: input.sessionId, message: input.message }),
  });

  if (!res.ok) {
    input.onError(`Erro ${res.status} ao enviar mensagem`);
    return;
  }

  if (!res.body) {
    input.onError('Streaming não suportado neste ambiente');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const evt = parseSseBlock(block);
      if (!evt) continue;
      if (evt.event === 'assistant.delta') input.onDelta((evt.data as any).chunk);
      if (evt.event === 'assistant.completed') input.onCompleted((evt.data as any).message);
      if (evt.event === 'error') input.onError((evt.data as any).error);
    }
  }
}

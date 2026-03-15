import api, { apiBaseUrl } from './api_service';

/**
 * Interface para os dados de Check-in
 */
export interface CheckinResponse {
  id: string;
  stateLabel: string;
  stateLabelType: 'leve' | 'moderado' | 'sensível' | 'crítico';
  stateSummary: string;
  aiState: {
    analysis: string;
    recommendations: string[];
    suggestedIntensity: 'L' | 'M' | 'P';
    rationale: string;
  };
}

/**
 * Interface para o Resumo de Diário
 */
export interface JournalFinalizeResponse {
  sessionId: string;
  summary: {
    text: string;
    emotions: string[];
    themes: string[];
    suggestions: string[];
  };
  sessionStatus: 'completed';
}

export interface JournalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface JournalStartResponse {
  sessionId: string;
  created: boolean;
  messages: JournalChatMessage[];
  context: {
    routineSummary?: string;
    promptSummary: string;
    topThemes: string[];
    topPlannerCategories: string[];
    checkinToday: {
      moodScore: number;
      energyScore: number;
      stateLabel?: string;
    } | null;
  };
}

type JournalStreamEvent =
  | { event: 'session.started'; data: { sessionId: string } }
  | { event: 'assistant.delta'; data: { chunk: string } }
  | { event: 'assistant.completed'; data: { sessionId: string; message: JournalChatMessage } }
  | { event: 'error'; data: { error: string } };

type ParsedSseChunk = {
  events: JournalStreamEvent[];
  remainder: string;
};

function parseSseEventBlock(block: string): JournalStreamEvent | null {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const eventLine = lines.find((line) => line.startsWith('event:'));
  const dataLine = lines.find((line) => line.startsWith('data:'));

  if (!eventLine || !dataLine) {
    return null;
  }

  const event = eventLine.slice('event:'.length).trim() as JournalStreamEvent['event'];
  const data = JSON.parse(dataLine.slice('data:'.length).trim());

  return { event, data } as JournalStreamEvent;
}

export function parseSseChunk(chunk: string): ParsedSseChunk {
  const blocks = chunk.split('\n\n');
  const completeBlocks = blocks.slice(0, -1);
  const remainder = blocks[blocks.length - 1] ?? '';

  const events = completeBlocks
    .map(parseSseEventBlock)
    .filter((event): event is JournalStreamEvent => event !== null);

  return {
    events,
    remainder,
  };
}

/**
 * Serviço que abstrai as chamadas de Inteligência Artificial para o Mobile.
 */
export class AIService {
  /**
   * Envia o check-in diário e recebe o estado avaliado pela IA.
   */
  static async submitCheckin(data: {
    userId: string;
    localDate: string;
    moodScore: number;
    energyScore: number;
    clarityScore: number;
    irritabilityScore: number;
    note?: string;
  }): Promise<CheckinResponse> {
    const response = await api.post<CheckinResponse>('/api/checkins', data);
    return response.data;
  }

  /**
   * Finaliza uma sessão de diário e recebe o resumo da IA.
   */
  static async finalizeJournal(sessionId: string): Promise<JournalFinalizeResponse> {
    const response = await api.post<JournalFinalizeResponse>('/api/journal/finalize', { sessionId });
    return response.data;
  }

  static async startJournalSession(userId: string): Promise<JournalStartResponse> {
    const response = await api.post<JournalStartResponse>('/api/journal/start', { userId });
    return response.data;
  }

  static async streamJournalMessage(input: {
    userId: string;
    sessionId: string;
    message: string;
    onEvent: (event: JournalStreamEvent) => void;
  }): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/api/journal/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        userId: input.userId,
        sessionId: input.sessionId,
        message: input.message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao enviar mensagem do diário (${response.status})`);
    }

    if (!response.body || !('getReader' in response.body)) {
      const text = await response.text();
      const parsed = parseSseChunk(text.endsWith('\n\n') ? text : `${text}\n\n`);

      for (const event of parsed.events) {
        input.onEvent(event);
      }

      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.remainder;

      for (const event of parsed.events) {
        input.onEvent(event);
      }
    }

    const finalBuffer = buffer.trim();

    if (finalBuffer) {
      const parsed = parseSseChunk(`${finalBuffer}\n\n`);

      for (const event of parsed.events) {
        input.onEvent(event);
      }
    }
  }
}

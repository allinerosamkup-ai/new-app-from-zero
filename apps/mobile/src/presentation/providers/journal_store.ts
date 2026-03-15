import { create } from 'zustand';
import {
  AIService,
  JournalFinalizeResponse,
  JournalStartResponse,
} from '../../services/ai_service';
import api from '../../services/api_service';

export interface JournalSessionItem {
  id: string;
  localDate: string;
  status: 'active' | 'completed';
  summary: string | null;
  emotions: string[];
  themes: string[];
  startedAt: string;
  finalizedAt: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface JournalState {
  sessionId: string | null;
  userId: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  context: JournalStartResponse['context'] | null;
  error: string | null;
  sessions: JournalSessionItem[];
  isLoadingSessions: boolean;

  // Actions
  startSession: (userId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  finalizeSession: () => Promise<JournalFinalizeResponse | null>;
  clearSession: () => void;
  loadSessions: (userId: string) => Promise<void>;
}

/**
 * Store Zustand para gerenciar a sessão de diário com IA.
 * Tradução do journalProvider do Flutter.
 */
export const useJournalStore = create<JournalState>((set, get) => ({
  sessionId: null,
  userId: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  context: null,
  error: null,
  sessions: [],
  isLoadingSessions: false,

  startSession: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await AIService.startJournalSession(userId);

      set({
        sessionId: result.sessionId,
        userId,
        messages: result.messages.map((message) => ({
          ...message,
          createdAt: new Date(message.createdAt),
        })),
        context: result.context,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Falha ao iniciar sessão de diário',
      });
    }
  },

  sendMessage: async (content: string) => {
    const { messages, sessionId, userId, isStreaming } = get();

    if (!sessionId || !userId) {
      set({ error: 'Sessão de diário não iniciada.' });
      return;
    }

    if (isStreaming) {
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      createdAt: new Date(),
    };

    const assistantPlaceholderId = `${userMsg.id}-assistant`;
    const assistantMsg: Message = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };

    set({
      messages: [...messages, userMsg, assistantMsg],
      isLoading: true,
      isStreaming: true,
      error: null,
    });

    try {
      await AIService.streamJournalMessage({
        userId,
        sessionId,
        message: content,
        onEvent: (event) => {
          if (event.event === 'assistant.delta') {
            set((state) => ({
              messages: state.messages.map((message) =>
                message.id === assistantPlaceholderId
                  ? { ...message, content: `${message.content}${event.data.chunk}` }
                  : message,
              ),
            }));
            return;
          }

          if (event.event === 'assistant.completed') {
            set((state) => ({
              messages: state.messages.map((message) =>
                message.id === assistantPlaceholderId
                  ? {
                      id: event.data.message.id,
                      role: 'assistant',
                      content: event.data.message.content,
                      createdAt: new Date(event.data.message.createdAt),
                    }
                  : message,
              ),
            }));
            return;
          }

          if (event.event === 'error') {
            set({
              error: event.data.error,
            });
          }
        },
      });

      set({ isLoading: false, isStreaming: false });
    } catch (err: any) {
      set({
        isLoading: false,
        isStreaming: false,
        error: err.message || 'Falha ao enviar mensagem do diário',
      });
    }
  },

  finalizeSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return null;

    set({ isLoading: true, error: null });
    try {
      const result = await AIService.finalizeJournal(sessionId);
      set({ isLoading: false });
      return result;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return null;
    }
  },

  clearSession: () =>
    set({
      sessionId: null,
      userId: null,
      messages: [],
      isStreaming: false,
      context: null,
      error: null,
    }),

  loadSessions: async (userId: string) => {
    set({ isLoadingSessions: true });
    try {
      const response = await api.get<JournalSessionItem[]>('/api/journal/sessions', {
        params: { userId },
      });
      set({ sessions: response.data, isLoadingSessions: false });
    } catch (err: any) {
      set({ isLoadingSessions: false, error: err.message });
    }
  },
}));

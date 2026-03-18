import { create } from 'zustand';
import { apiPost, apiGet, streamJournalMessage } from '../lib/api';

export interface JournalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface JournalSession {
  id: string;
  localDate: string;
  status: string;
  summary: string | null;
  emotions: string[];
  themes: string[];
  startedAt: string;
  finalizedAt: string | null;
}

interface StartResponse {
  sessionId: string;
  created: boolean;
  messages: JournalMessage[];
  context: {
    routineSummary?: string;
    promptSummary: string;
    topThemes: string[];
    topPlannerCategories: string[];
    checkinToday: { moodScore: number; energyScore: number; stateLabel?: string; stateLabelType?: string } | null;
  };
}

interface JournalState {
  sessionId: string | null;
  messages: JournalMessage[];
  streamingContent: string;
  context: StartResponse['context'] | null;
  isStarting: boolean;
  isStreaming: boolean;
  sessions: JournalSession[];
  isLoadingSessions: boolean;
  error: string | null;

  startSession: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  clearSession: () => void;
  addLocalMessage: (msg: JournalMessage) => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  sessionId: null,
  messages: [],
  streamingContent: '',
  context: null,
  isStarting: false,
  isStreaming: false,
  sessions: [],
  isLoadingSessions: false,
  error: null,

  async startSession() {
    set({ isStarting: true, error: null, messages: [], streamingContent: '' });
    try {
      const result = await apiPost<StartResponse>('/api/journal/start', {});
      set({
        sessionId: result.sessionId,
        messages: result.messages,
        context: result.context,
        isStarting: false,
      });
    } catch (e) {
      set({ isStarting: false, error: e instanceof Error ? e.message : 'Erro ao iniciar sessão.' });
    }
  },

  async sendMessage(content: string) {
    const { sessionId, messages } = get();
    if (!sessionId) return;

    const userMsg: JournalMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    set({ messages: [...messages, userMsg], isStreaming: true, streamingContent: '', error: null });

    let accumulated = '';

    await streamJournalMessage({
      sessionId,
      message: content,
      onDelta(chunk) {
        accumulated += chunk;
        set({ streamingContent: accumulated });
      },
      onCompleted(msg) {
        const finalMsg: JournalMessage = { id: msg.id, role: 'assistant', content: msg.content, createdAt: msg.createdAt };
        set((s) => ({ messages: [...s.messages, finalMsg], streamingContent: '', isStreaming: false }));
      },
      onError(err) {
        set({ isStreaming: false, streamingContent: '', error: err });
      },
    });
  },

  async loadSessions() {
    set({ isLoadingSessions: true });
    try {
      const sessions = await apiGet<JournalSession[]>('/api/journal/sessions?limit=10');
      set({ sessions, isLoadingSessions: false });
    } catch (e) {
      set({ isLoadingSessions: false });
    }
  },

  clearSession() {
    set({ sessionId: null, messages: [], streamingContent: '', context: null, error: null });
  },

  addLocalMessage(msg) {
    set((s) => ({ messages: [...s.messages, msg] }));
  },
}));

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Clock, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { useNavigation } from '../navigation';
import { useJournalStore, type JournalSession } from '../stores/journal_store';

const TEMPLATES = [
  { id: 'livre',         label: 'Sessão Livre',      emoji: '💭', desc: 'Fale sobre o que quiser' },
  { id: 'queda',         label: 'Queda de Energia',  emoji: '🔋', desc: 'Entender por que a energia caiu' },
  { id: 'alta',          label: 'Dia de Alta',        emoji: '⚡', desc: 'Como não se sobrecarregar' },
  { id: 'irritabilidade',label: 'Irritabilidade',     emoji: '🌡️', desc: 'Explorar gatilhos e aliviar' },
  { id: 'clareza',       label: 'Clareza no Caos',   emoji: '🧠', desc: 'Organizar pensamentos' },
  { id: 'ciclo',         label: 'Ciclo Hormonal',    emoji: '🌸', desc: 'Mapear o momento do ciclo' },
];

const stateEmoji: Record<string, string> = {
  leve: '🌱', moderado: '✨', sensível: '🌙', crítico: '🌊',
};

// Builds a context-aware opener from the session's context data
function buildOpener(
  templateId: string,
  context: { checkinToday: { moodScore: number; energyScore: number; stateLabel?: string; stateLabelType?: string } | null; topThemes: string[] } | null,
): string {
  const checkin = context?.checkinToday;
  const themes = context?.topThemes ?? [];

  // Context-aware prefix based on real user data
  let contextPrefix = '';
  if (checkin) {
    const stateMap: Record<string, string> = {
      leve: 'num ritmo mais tranquilo hoje',
      moderado: 'com energia radiante hoje',
      sensível: 'num dia mais delicado hoje',
      crítico: 'em modo de recuperação hoje',
    };
    contextPrefix = stateMap[checkin.stateLabelType ?? ''] ?? '';
  }

  if (themes.length > 0 && !contextPrefix) {
    contextPrefix = `com temas de "${themes[0]}" recorrentes nas últimas sessões`;
  }

  const contextNote = contextPrefix ? ` Percebi que você está ${contextPrefix}.` : '';

  const openers: Record<string, string> = {
    livre:          `Olá! Estou aqui com você.${contextNote} Pode me contar como está se sentindo agora, sem pressa.`,
    queda:          `Vamos entender juntos o que pode estar contribuindo para essa queda de energia.${contextNote} Como foi seu sono recentemente?`,
    alta:           `Parece que hoje é um dia de mais energia!${contextNote} Vamos cuidar para aproveitar bem sem se sobrecarregar. O que você tem vontade de fazer?`,
    irritabilidade: `Entendo que está se sentindo mais irritada.${contextNote} Isso faz parte da ciclagem. Consegue identificar quando começou?`,
    clareza:        `Quando tudo parece confuso, colocar para fora ajuda.${contextNote} Qual é a coisa que mais está ocupando sua cabeça agora?`,
    ciclo:          `Vamos mapear como você está em relação ao seu ciclo.${contextNote} Em que fase você acha que está? Tem notado mudanças nos últimos dias?`,
  };

  return openers[templateId] ?? openers.livre;
}

function ChatBubble({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className="max-w-[80%] px-4 py-3.5 text-[14px] leading-relaxed"
        style={{
          background: isUser ? 'var(--accent-9)' : 'var(--accent-surface)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          borderRadius: 18,
          backdropFilter: isUser ? 'none' : 'blur(20px)',
          border: isUser ? 'none' : '1px solid rgba(255,255,255,0.5)',
        }}
      >
        {content}
      </div>
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex mb-3 justify-start">
      <div
        className="max-w-[80%] px-4 py-3.5 text-[14px] leading-relaxed"
        style={{
          background: 'var(--accent-surface)',
          color: 'var(--text-primary)',
          borderRadius: 18,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
      >
        {content || <span style={{ opacity: 0.4 }}>●●●</span>}
      </div>
    </div>
  );
}

export default function JournalScreen() {
  const { navigate } = useNavigation();
  const {
    sessionId, messages, streamingContent, context,
    isStarting, isStreaming,
    sessions, isLoadingSessions,
    startSession, sendMessage, loadSessions, clearSession, addLocalMessage,
    error,
  } = useJournalStore();

  const [view, setView] = useState<'list' | 'template' | 'chat'>('list');
  const [input, setInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('livre');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load past sessions on mount
  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handlePickTemplate = async (templateId: string) => {
    setSelectedTemplate(templateId);
    clearSession();
    setView('chat');
    await startSession();
    // After session starts, inject context-aware opener if session is new
    const state = useJournalStore.getState();
    if (state.messages.length === 0) {
      const opener = buildOpener(templateId, state.context);
      addLocalMessage({ id: 'opener', role: 'assistant', content: opener, createdAt: new Date().toISOString() });
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    setInput('');
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ─── LIST VIEW ────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="flex flex-col h-full overflow-y-auto px-5 pt-3 pb-4" style={{ background: 'var(--bg-base)' }}>
        <div className="mb-5 animate-fade-in">
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>Seu espaço seguro</p>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Diário com IA
          </h1>
        </div>

        <button
          onClick={() => setView('template')}
          className="w-full rounded-[22px] p-4 mb-5 flex items-center gap-3 transition-all active:scale-[0.97] animate-fade-in delay-100"
          style={{
            background: 'var(--bg-base)',
            border: '1.5px solid rgba(99,152,169,0.22)',
            boxShadow: '0 2px 8px rgba(99,152,169,0.08)',
          }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,152,169,0.09)' }}>
            <Sparkles size={16} strokeWidth={1.5} style={{ color: '#6398A9' }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Nova Sessão</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Escolha um tema ou fale livremente</p>
          </div>
          <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
        </button>

        <div className="mb-3 animate-fade-in delay-200">
          <h2 className="text-[14px] font-bold mb-3" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Sessões anteriores
          </h2>

          {isLoadingSessions && (
            <p className="text-[13px] text-center py-4" style={{ color: 'var(--text-muted)' }}>Carregando...</p>
          )}

          {!isLoadingSessions && sessions.length === 0 && (
            <div className="glass-card rounded-[18px] p-5 text-center">
              <p className="text-[28px] mb-2">💭</p>
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Nenhuma sessão ainda. Comece uma conversa com a IA.</p>
            </div>
          )}

          {sessions.map((session: JournalSession, i: number) => {
            const isOpen = expandedId === session.id;
            const stateColor: Record<string, string> = {
              leve: '#96C7B3', moderado: '#F9B95C', sensível: '#D7897F', crítico: '#E07070',
            };
            // Detect state from emotions or fallback
            const color = '#96C7B3';
            const dateLabel = new Date(session.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

            return (
              <div key={session.id} className="glass-card rounded-[18px] mb-2.5 animate-fade-in overflow-hidden"
                style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
                <button
                  className="w-full p-4 flex items-start gap-3 text-left transition-all active:scale-[0.99]"
                  onClick={() => setExpandedId(isOpen ? null : session.id)}
                >
                  <span className="text-xl mt-0.5">✨</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock size={10} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{dateLabel}</span>
                    </div>
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {session.summary ?? 'Sessão de diário'}
                    </p>
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {session.emotions.slice(0, 3).map((e, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${color}22`, color }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronDown size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {isOpen && session.summary && (
                  <div className="px-4 pb-4">
                    <div className="rounded-[14px] p-3.5" style={{ background: 'rgba(99,152,169,0.06)', border: '1px solid rgba(99,152,169,0.12)' }}>
                      <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: '#6398A9' }}>Síntese da IA</p>
                      <p className="text-[13px] leading-[20px] italic" style={{ color: 'var(--text-primary)' }}>
                        {session.summary}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── TEMPLATE VIEW ────────────────────────────────────────────────────────
  if (view === 'template') {
    return (
      <div className="flex flex-col h-full overflow-y-auto px-5 pt-3 pb-4" style={{ background: 'var(--bg-base)' }}>
        <div className="flex items-center gap-3 mb-5 animate-fade-in">
          <button onClick={() => setView('list')} className="w-9 h-9 rounded-2xl flex items-center justify-center glass-card">
            <ArrowLeft size={16} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>Nova Sessão</p>
            <h1 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Escolha um tema
            </h1>
          </div>
        </div>

        <div className="space-y-2.5">
          {TEMPLATES.map((t, i) => (
            <button
              key={t.id}
              onClick={() => void handlePickTemplate(t.id)}
              className="w-full glass-card rounded-[18px] p-4 flex items-center gap-3 text-left transition-all active:scale-[0.97] hover:shadow-md animate-fade-in"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <span className="text-2xl">{t.emoji}</span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.desc}</p>
              </div>
              <ChevronRight size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── CHAT VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(31,59,50,0.06)' }}>
        <button
          onClick={() => { clearSession(); setView('list'); void loadSessions(); }}
          className="w-9 h-9 rounded-2xl flex items-center justify-center glass-card"
        >
          <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Diário com IA
          </h1>
          {isStreaming && (
            <p className="text-[11px]" style={{ color: 'var(--accent-teal)' }}>Escrevendo...</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isStarting && (
          <div className="flex justify-center py-8">
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Iniciando sessão...</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} content={msg.content} isUser={msg.role === 'user'} />
        ))}

        {isStreaming && <StreamingBubble content={streamingContent} />}

        {error && (
          <div className="text-center py-2">
            <p className="text-[12px]" style={{ color: 'var(--accent-rose)' }}>{error}</p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 flex items-end gap-2" style={{ borderTop: '1px solid rgba(31,59,50,0.06)' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Conta o que está acontecendo..."
          rows={1}
          className="flex-1 glass-card rounded-2xl px-4 py-3 text-[14px] outline-none resize-none"
          style={{ color: 'var(--text-primary)', maxHeight: 100, borderColor: 'var(--border-interactive)' }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || isStreaming || isStarting}
          className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40"
          style={{ background: 'var(--bg-dark)' }}
        >
          <Send size={16} strokeWidth={1.5} color="var(--accent-9)" />
        </button>
      </div>
    </div>
  );
}

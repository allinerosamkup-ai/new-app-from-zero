import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Mic, Send, Clock, ChevronRight, Sparkles, MicOff } from 'lucide-react';
import { useNavigation } from '../navigation';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type Session = { id: string; date: string; state: string; summary: string; emotions: string[] };

const TEMPLATES = [
  { id: 'livre', label: 'Sessão Livre', emoji: '💭', desc: 'Fale sobre o que quiser' },
  { id: 'queda', label: 'Queda de Energia', emoji: '🔋', desc: 'Entender por que a energia caiu' },
  { id: 'alta', label: 'Dia de Alta', emoji: '⚡', desc: 'Como não se sobrecarregar' },
  { id: 'irritabilidade', label: 'Irritabilidade', emoji: '🌡️', desc: 'Explorar gatilhos e aliviar' },
  { id: 'clareza', label: 'Clareza no Caos', emoji: '🧠', desc: 'Organizar pensamentos' },
  { id: 'ciclo', label: 'Ciclo Hormonal', emoji: '🌸', desc: 'Mapear o momento do ciclo' },
];

const TEMPLATE_OPENERS: Record<string, string> = {
  livre: 'Estou aqui com você. Pode me contar como está se sentindo agora, sem pressa. Não precisa ter as palavras certas.',
  queda: 'Percebo que sua energia está mais baixa. Vamos entender juntos o que pode ter contribuído. Como foi seu sono ontem?',
  alta: 'Parece que hoje é um dia de mais energia! Isso é ótimo, mas vamos cuidar para não exagerar. O que você tem vontade de fazer hoje?',
  irritabilidade: 'Entendo que está se sentindo mais irritada. Isso faz parte da ciclagem e não é culpa sua. Consegue identificar quando começou?',
  clareza: 'Quando tudo parece confuso, às vezes ajuda colocar para fora. Qual é a coisa que mais está ocupando sua cabeça agora?',
  ciclo: 'Vamos mapear como você está se sentindo em relação ao seu ciclo. Em que fase você acha que está? Tem notado mudanças nos últimos dias?',
};

const PAST_SESSIONS: Session[] = [
  { id: 'p1', date: '14 Mar', state: 'moderado', summary: 'Reflexão sobre equilíbrio trabalho/descanso', emotions: ['reflexiva', 'esperançosa'] },
  { id: 'p2', date: '12 Mar', state: 'sensível', summary: 'Dia difícil — irritabilidade e cansaço', emotions: ['cansada', 'irritada'] },
  { id: 'p3', date: '10 Mar', state: 'leve', summary: 'Semana começando bem, energia estável', emotions: ['tranquila', 'motivada'] },
];

const stateEmoji: Record<string, string> = { leve: '🌱', moderado: '✨', sensível: '🌙', crítico: '🌊' };

function ChatBubble({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className="max-w-[80%] px-4 py-3.5 text-[14px] leading-relaxed"
        style={{
          background: isUser ? 'var(--bg-dark)' : 'var(--bg-glass-strong)',
          color: isUser ? 'white' : 'var(--text-primary)',
          borderRadius: isUser ? '22px 22px 6px 22px' : '22px 22px 22px 6px',
          backdropFilter: isUser ? 'none' : 'blur(20px)',
          border: isUser ? 'none' : '1px solid rgba(255,255,255,0.5)',
        }}
      >
        {content}
      </div>
    </div>
  );
}

export default function JournalScreen() {
  const { navigate } = useNavigation();
  const [view, setView] = useState<'list' | 'template' | 'chat'>('list');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const startSession = (templateId: string) => {
    const opener = TEMPLATE_OPENERS[templateId] || TEMPLATE_OPENERS.livre;
    setMessages([{ id: '1', role: 'assistant', content: opener }]);
    setView('chat');
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, newMsg]);
    setInput('');

    setTimeout(() => {
      const replies = [
        'Entendo o que você está dizendo. Isso parece estar ligado ao seu padrão de ciclagem — nos últimos dias sua energia tem variado bastante. O que você acha que pode estar contribuindo?',
        'Obrigada por compartilhar. Vou guardar isso para cruzar com seus check-ins. Você percebe algum padrão quando se sente assim?',
        'Faz total sentido. Baseado no que você me contou nas últimas sessões, parece que esse tipo de situação costuma aparecer quando sua energia está em queda. Vamos pensar em como proteger seu dia?',
      ];
      const aiReply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replies[Math.floor(Math.random() * replies.length)],
      };
      setMessages(prev => [...prev, aiReply]);
    }, 1200);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setInput(prev => prev + ' [transcrição de áudio simulada]');
    } else {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setInput('Estou me sentindo meio cansada hoje, mas não sei exatamente por quê...');
      }, 2500);
    }
  };

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
          className="w-full rounded-[22px] p-4 mb-5 flex items-center gap-3 transition-all active:scale-[0.98] animate-fade-in delay-100 hover:opacity-90"
          style={{
            background: 'rgba(99,152,169,0.11)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(99,152,169,0.25)',
            boxShadow: '0 2px 10px rgba(99,152,169,0.10)',
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(99,152,169,0.18)', border: '1px solid rgba(99,152,169,0.22)' }}>
            <Sparkles size={18} style={{ color: '#6398A9' }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[14px] font-semibold" style={{ color: '#4A6B7A' }}>Nova Sessão</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Escolha um tema ou fale livremente</p>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
        </button>

        <div className="mb-3 animate-fade-in delay-200">
          <h2 className="text-[14px] font-bold mb-3" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Sessões anteriores
          </h2>
          {PAST_SESSIONS.map((session, i) => (
            <div key={session.id} className="glass-card rounded-[18px] p-4 mb-2.5 animate-fade-in"
              style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{stateEmoji[session.state] || '✨'}</span>
                  <span className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={10} className="inline mr-1" />{session.date}
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                {session.summary}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {session.emotions.map((em, j) => (
                  <span key={j} className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(139,92,246,0.08)', color: 'var(--accent-purple)' }}>
                    {em}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'template') {
    return (
      <div className="flex flex-col h-full overflow-y-auto px-5 pt-3 pb-4" style={{ background: 'var(--bg-base)' }}>
        <div className="flex items-center mb-5">
          <button onClick={() => setView('list')} className="p-2 -ml-2 rounded-xl hover:bg-black/5">
            <ArrowLeft size={22} style={{ color: 'var(--text-primary)' }} />
          </button>
          <h1 className="text-[18px] font-bold ml-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Escolha um tema
          </h1>
        </div>

        <p className="text-[13px] mb-5" style={{ color: 'var(--text-muted)' }}>
          Escolha um tema para a IA conduzir a sessão. Todos são adaptados ao seu estado de ciclagem.
        </p>

        <div className="space-y-2.5">
          {TEMPLATES.map((tmpl, i) => (
            <button
              key={tmpl.id}
              onClick={() => startSession(tmpl.id)}
              className="w-full glass-card rounded-[18px] p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98] hover:shadow-md animate-fade-in"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <span className="text-2xl">{tmpl.emoji}</span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{tmpl.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{tmpl.desc}</p>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center justify-between px-4 pt-2 pb-2 glass-strong"
        style={{ borderBottom: '1px solid rgba(31,59,50,0.06)' }}>
        <button onClick={() => setView('list')} className="p-2 rounded-xl hover:bg-black/5">
          <ArrowLeft size={22} style={{ color: 'var(--text-primary)' }} />
        </button>
        <h1 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Diário com IA
        </h1>
        <button onClick={() => navigate('dailySummary')} className="text-[13px] font-semibold px-3 py-1.5 rounded-full"
          style={{ color: 'var(--accent-green)', background: 'rgba(31,59,50,0.06)' }}>
          Encerrar
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} content={msg.content} isUser={msg.role === 'user'} />
        ))}
      </div>

      <div className="px-4 py-3 glass-strong" style={{ borderTop: '1px solid rgba(31,59,50,0.06)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className="p-2.5 rounded-full transition-all"
            style={{
              background: isRecording ? 'var(--accent-rose)' : 'rgba(31,59,50,0.06)',
            }}
          >
            {isRecording ? <MicOff size={20} color="white" /> : <Mic size={20} style={{ color: 'var(--text-muted)' }} />}
          </button>

          <div className="flex-1 glass-card rounded-2xl px-4 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isRecording ? 'Gravando...' : 'Conta o que está acontecendo...'}
              className="w-full bg-transparent text-[14px] outline-none"
              style={{ color: 'var(--text-primary)' }}
              disabled={isRecording}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 rounded-full transition-all"
            style={{
              background: input.trim() ? 'var(--bg-dark)' : 'rgba(31,59,50,0.06)',
            }}
          >
            <Send size={18} color={input.trim() ? 'white' : '#9b9489'} />
          </button>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 mt-2 ml-12">
            <div className="w-2 h-2 rounded-full animate-pulse-soft" style={{ background: 'var(--accent-rose)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--accent-rose)' }}>Gravando áudio...</span>
          </div>
        )}
      </div>
    </div>
  );
}

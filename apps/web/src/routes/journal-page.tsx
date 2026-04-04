import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
// Journal Page v3 — method selection + real chat integration with SSE + task suggestions
import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import { supabase } from "../lib/supabase";
import { useToast } from "../components/Toast";
import "../styles/aura.css";

type AiTask = { title: string; category: string; time?: string };

type Message = {
  id?: string;
  role: "assistant" | "user";
  content: string;
};

type JournalMethod = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  prompt: string;
};

const JOURNAL_METHODS: JournalMethod[] = [
  {
    id: "gratitude",
    emoji: "🙏",
    title: "Gratidão",
    desc: "Foco no que foi bom",
    prompt: "Quero refletir sobre gratidão hoje. O que posso agradecer neste momento?",
  },
  {
    id: "free",
    emoji: "💭",
    title: "Reflexão livre",
    desc: "Escreva o que vier",
    prompt: "Quero escrever livremente sobre meu dia. Sem roteiro, só deixar sair.",
  },
  {
    id: "emotion",
    emoji: "😤",
    title: "Processar emoção",
    desc: "Organize o que sente",
    prompt: "Preciso processar uma emoção que está presente agora. Quero entender o que estou sentindo.",
  },
  {
    id: "intention",
    emoji: "🌅",
    title: "Intenção do dia",
    desc: "Defina seu foco",
    prompt: "Quero definir minha intenção para hoje. O que quero cultivar ou conquistar?",
  },
  {
    id: "decompress",
    emoji: "😮‍💨",
    title: "Descomprimir",
    desc: "Solte o que está pesando",
    prompt: "Preciso descomprimir. Tem muita coisa acumulada e quero deixar sair.",
  },
  {
    id: "compassion",
    emoji: "💝",
    title: "Autocompaixão",
    desc: "Seja gentil consigo",
    prompt: "Quero praticar autocompaixão. Há algo que preciso me perdoar ou me apoiar.",
  },
];

export function JournalPage() {
  const navigate = useNavigate();
  const { state, addTask } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);

  const [phase, setPhase] = useState<"method" | "chat" | "suggestions">("method");
  const [selectedMethod, setSelectedMethod] = useState<JournalMethod | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<AiTask[]>([]);
  const [streamSuggestedTasks, setStreamSuggestedTasks] = useState<AiTask[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [acceptedIdx, setAcceptedIdx] = useState<Set<number>>(new Set());
  const [rejectedIdx, setRejectedIdx] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' + transcript : transcript));
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startSession(method: JournalMethod) {
    setSelectedMethod(method);
    setPhase("chat");
    try {
      const res = await api.post('/journal/start', { method: method.id });
      setSessionId(res.sessionId);
      setStreamSuggestedTasks([]);
      if (res.messages && res.messages.length > 0) {
        setMessages(res.messages);
      } else {
        setMessages([{
          role: "assistant",
          content: method.id === "gratitude"
            ? `${method.emoji} Que bom que você escolheu começar por gratidão! Me conta — o que aconteceu hoje, ou recentemente, que merece um momento de reconhecimento?`
            : method.id === "free"
            ? `${method.emoji} Esse espaço é todo seu. Sem julgamentos, sem roteiro. O que quer que esteja na sua cabeça agora, pode começar por aí.`
            : method.id === "emotion"
            ? `${method.emoji} Que emoção está presente em você agora? Pode colocar uma palavra, uma cor, ou só descrever como está o seu corpo.`
            : method.id === "intention"
            ? `${method.emoji} Qual seria a palavra ou o sentimento que você quer que guie seu dia hoje? Não precisa ser perfeito — o que vem à mente?`
            : method.id === "decompress"
            ? `${method.emoji} Pode soltar. O que está pesando mais agora? Trabalho, relacionamento, uma situação específica? Pode jogar aqui sem filtro.`
            : `${method.emoji} Autocompaixão é um presente que muitas vezes esquecemos de nos dar. Tem algo recente onde você foi duro demais consigo mesmo?`
        }]);
      }
    } catch (err) {
      console.error("Failed to start journal session:", err);
      showError(err instanceof Error ? err.message : "Nao foi possivel iniciar a sessao de diario.");
      setMessages([{
        role: "assistant",
        content: `${method.emoji} Olá! Estou aqui para ouvir. Como está sendo seu dia?`
      }]);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionId || isTyping) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setStreamSuggestedTasks([]);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();

      const response = await fetch(`${API_URL}/journal/message/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, message: text }),
      });

      if (!response.ok || !response.body) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                assistantMsg += data.chunk;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { role: "assistant", content: assistantMsg };
                  return newMsgs;
                });
              } else if (data.message) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = data.message;
                  return newMsgs;
                });
              } else if (data.suggestedTasks && Array.isArray(data.suggestedTasks)) {
                setStreamSuggestedTasks(data.suggestedTasks);
              }
            } catch (_) { /* ignore partial JSON */ }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      showError(err instanceof Error ? err.message : "Nao foi possivel enviar a mensagem agora.");
      setMessages(prev => [...prev, { role: "assistant", content: "Desculpe, tive um problema para responder agora. Pode tentar de novo?" }]);
    } finally {
      setIsTyping(false);
    }
  }

  async function finalizeSession() {
    if (!sessionId) return;
    try {
      await api.post('/journal/finalize', { sessionId });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel finalizar a sessao.");
    }
    // Ask AI for task suggestions based on journal conversation
    setSuggestionsLoading(true);
    setPhase("suggestions");
    try {
      if (streamSuggestedTasks.length > 0) {
        setSuggestedTasks(streamSuggestedTasks.slice(0, 3));
      } else {
        const lastMessages = messages.slice(-6).map(m => `${m.role === 'user' ? 'Usuário' : 'IA'}: ${m.content}`).join('\n');
        const res = await api.post('/ai/suggest', {
          type: 'journal-tasks',
          context: { method: selectedMethod?.id ?? 'free', messages: lastMessages, mood: state.mood, moodCycleContext: cycleReport.aiContext },
        }) as any;
        const parsed = parseAiSuggestion<AiTask[]>(res.suggestion);
        if (Array.isArray(parsed)) setSuggestedTasks(parsed.slice(0, 3));
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel gerar sugestoes do diario.");
    }
    setSuggestionsLoading(false);
  }

  async function handleAcceptTask(task: AiTask, idx: number) {
    try {
      await addTask(task.title, task.time ?? "09:00", task.category);
      setAcceptedIdx(prev => new Set([...prev, idx]));
      showSuccess("Sugestao adicionada ao planner.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel adicionar a sugestao.");
    }
  }

  function handleRejectTask(idx: number) {
    setRejectedIdx(prev => new Set([...prev, idx]));
  }

  function goToDailySummary() {
    navigate("/daily-summary");
  }

  // ── METHOD SELECTION PHASE ──
  if (phase === "method") {
    return (
      <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
        <div className="screen-content" style={{ padding: "20px 24px" }}>
          {/* Header */}
          <div style={{ marginBottom: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "8px" }}>Diario com IA</p>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "22px", fontWeight: 800, color: "var(--text-1)", margin: "0 0 10px" }}>Como voce quer seguir hoje?</h2>
            <p style={{ fontSize: "13.5px", color: "var(--text-2)", maxWidth: "80%", margin: "0 auto", lineHeight: 1.5 }}>Escolha um formato para guiar nossa reflexão e cultivar sua intenção.</p>
          </div>

          {/* Method cards grid */}
          <div className="journal-method-grid">
            {JOURNAL_METHODS.map(method => (
              <button
                key={method.id}
                onClick={() => startSession(method)}
                className="journal-method-card"
              >
                <div className="journal-method-icon">
                  {method.emoji}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <p className="journal-method-title">{method.title}</p>
                  <p className="journal-method-desc">{method.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Skip option */}
          <AuraButtonV2
            onClick={() => startSession({ id: "free", emoji: "💬", title: "Conversa livre", desc: "", prompt: "Olá! Estou aqui. Como está sendo seu dia?" })}
            style={{ width: "100%", padding: "12px", border: "none", background: "transparent", color: "var(--text-2)", fontSize: "13px", cursor: "pointer", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Pular e conversar livremente
          </AuraButtonV2>
        </div>
      </div>
    );
  }

  // ── SUGGESTIONS PHASE ──
  if (phase === "suggestions") {
    return (
      <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
        <div className="screen-content" style={{ padding: "24px" }}>
          <div style={{ marginBottom: "32px", textAlign: "center" }}>
            <div style={{ 
              width: "60px", height: "60px", background: "var(--primary-light)", borderRadius: "50%", 
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" 
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "8px" }}>Sessão Finalizada</p>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "22px", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>Acoes sugeridas</h2>
            <p style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: "8px" }}>Com base no que conversamos, o que acha de priorizar isso?</p>
          </div>

          {suggestionsLoading ? (
            <div style={{ padding: "48px 0", textAlign: "center", fontSize: "14px", color: "var(--text-3)", fontStyle: "italic" }}>
              Sintetizando sugestoes...
            </div>
          ) : suggestedTasks.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", background: "#fff", borderRadius: "20px", border: "1.5px solid var(--warm-border)" }}>
              <p style={{ fontSize: "14px", color: "var(--text-2)", margin: 0 }}>Nenhuma sugestão gerada. Que bom que você aproveitou este momento!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
              {suggestedTasks.map((task, idx) => {
                const accepted = acceptedIdx.has(idx);
                const rejected = rejectedIdx.has(idx);
                return (
                  <div
                    key={idx}
                    style={{
                      background: "#fff",
                      padding: "16px 20px",
                      borderRadius: "20px",
                      border: "1.5px solid var(--warm-border)",
                      opacity: rejected ? 0.4 : 1,
                      transform: accepted ? "translateY(2px)" : "none",
                      transition: "all 300ms cubic-bezier(.4,0,.2,1)",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      boxShadow: accepted ? "none" : "0 4px 12px rgba(31,42,54,0.04)"
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{task.title}</p>
                      <p style={{ fontSize: "11.5px", color: "var(--text-3)", margin: "4px 0 0", fontWeight: 500 }}>
                        {task.category}{task.time ? ` · ${task.time}` : ""}
                      </p>
                    </div>
                    {!accepted && !rejected && (
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                        <AuraButtonV2
                          onClick={() => handleRejectTask(idx)}
                          style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1.2px solid var(--warm-border-2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </AuraButtonV2>
                        <AuraButtonV2
                          onClick={() => handleAcceptTask(task, idx)}
                          style={{ width: "34px", height: "34px", borderRadius: "50%", border: "none", background: "var(--primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-primary)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </AuraButtonV2>
                      </div>
                    )}
                    {accepted && (
                       <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "var(--lagune)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(201,220,230,0.5)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <AuraButtonV2
            className="ui-btn-gradient"
            style={{ width: "100%", height: "54px", fontSize: "15px" }}
            onClick={goToDailySummary}
          >
            {acceptedIdx.size > 0 ? `Agendar ${acceptedIdx.size} sugestões →` : "Ir para o resumo do dia →"}
          </AuraButtonV2>
        </div>
      </div>
    );
  }

  // ── CHAT PHASE ──
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--warm-bg)", overflow: "hidden" }}>
      <div className="screen-content" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: "16px 16px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <AuraButtonV2 
            onClick={() => setPhase("method")} 
            style={{ 
              width: "40px", height: "40px", borderRadius: "50%", border: "1.5px solid var(--warm-border-2)", 
              background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", 
              flexShrink: 0, boxShadow: "0 2px 8px rgba(31,42,54,0.04)"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </AuraButtonV2>
          <div>
            <h2 style={{ fontFamily: "'Poppins'", fontSize: "16px", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
              {selectedMethod?.emoji} {selectedMethod?.title ?? "Diário com IA"}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isTyping ? "var(--menthe)" : "var(--lagune)", animation: isTyping ? "pulse 1.2s infinite" : "none" }}></span>
              <p style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
                {isTyping ? "Aura contemplando..." : "Sua IA está presente"}
              </p>
            </div>
          </div>
        </div>

        {/* Chat bubbles */}
        <div className="chat-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          {messages.map((msg, i) =>
            msg.role === "assistant" ? (
              <div key={i} className="bubble" style={{ maxWidth: "88%" }}>
                <p className="bubble-name" style={{ color: "var(--text-2)", fontWeight: 700, fontSize: "10px", marginBottom: "6px" }}>Aura</p>
                <div className="bubble-ai" style={{ background: "#fff", border: "1.2px solid var(--warm-border)", borderRadius: "20px 20px 20px 4px", boxShadow: "0 4px 12px rgba(31,42,54,0.03)", padding: "14px 16px", color: "var(--text-1)", fontSize: "14px", lineHeight: "1.55" }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} className="bubble bubble-user" style={{ alignSelf: "flex-end", maxWidth: "88%", background: "var(--primary)", color: "var(--text-1)", borderRadius: "20px 20px 4px 20px", padding: "14px 16px", fontSize: "14px", lineHeight: "1.55", boxShadow: "var(--shadow-primary)" }}>
                {msg.content}
              </div>
            )
          )}
          {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="bubble" style={{ maxWidth: "88%" }}>
              <div className="bubble-ai" style={{ background: "#fff", border: "1.2px solid var(--warm-border)", borderRadius: "20px 20px 20px 4px", padding: "14px 16px", color: "var(--text-3)" }}>
                ✦ Digitando...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input row */}
        <div style={{ marginTop: "20px" }}>
          <div className="journal-input-row" style={{ 
            background: "#fff", border: "1.5px solid var(--warm-border-2)", borderRadius: "24px", 
            padding: "8px 8px 8px 16px", boxShadow: "0 8px 24px rgba(31,42,54,0.06)", gap: "10px" 
          }}>
            <input 
              className="journal-input" 
              type="text" 
              placeholder="O que você está pensando?" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              disabled={isTyping}
              onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
              style={{ fontSize: "14px", color: "var(--text-1)", fontWeight: 500 }}
            />
            <div style={{ display: "flex", gap: "6px" }}>
              <AuraButtonV2
                onClick={toggleVoice}
                title={isRecording ? "Parar" : "Falar"}
                style={{
                  width: "36px", height: "36px", borderRadius: "50%", border: "none",
                  background: isRecording ? "var(--menthe)" : "var(--warm-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  transition: "all 200ms"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isRecording ? "#fff" : "var(--text-2)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </AuraButtonV2>
              <div 
                className="journal-send" 
                onClick={sendMessage} 
                style={{ 
                  width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary)", 
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  boxShadow: "var(--shadow-primary)", opacity: (!input.trim() || isTyping) ? 0.4 : 1
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Bottom Action */}
          <AuraButtonV2 
            onClick={finalizeSession} 
            style={{ 
              width: "100%", marginTop: "12px", background: "transparent", border: "none", 
              color: "var(--text-3)", fontSize: "11px", fontWeight: 700, letterSpacing: ".08em", 
              textTransform: "uppercase", cursor: "pointer" 
            }}
          >
            Finalizar Sessão e ver sugestões ✦
          </AuraButtonV2>
        </div>
      </div>
    </div>
  );
}

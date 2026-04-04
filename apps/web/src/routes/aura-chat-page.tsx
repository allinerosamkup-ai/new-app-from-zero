import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
// Aura Chat — IA assistente completa (tarefas, metas, agenda, humor)
import { useEffect, useRef, useState } from "react";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useToast } from "../components/Toast";
import "../styles/aura.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

type Message = { role: "user" | "assistant"; content: string };
type AiTask = { title: string; category: string; time?: string };

const QUICK_ACTIONS = [
  { emoji: "📋", label: "Montar agenda" },
  { emoji: "✨", label: "Sugerir metas" },
  { emoji: "🔍", label: "Analisar humor" },
  { emoji: "💡", label: "Me motivar" },
];

export function AuraChatPage() {
  const { addTask } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Oi! ✨ Sou a Aura, sua assistente pessoal. Posso montar sua agenda, sugerir metas, analisar seus padrões ou simplesmente ouvir você. O que precisar!",
  }]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<AiTask[]>([]);
  const [savedTaskIdx, setSavedTaskIdx] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    api.post("/journal/start", { method: "free" })
      .then((res: any) => setSessionId(res.sessionId))
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Nao foi possivel iniciar a conversa com a Aura.");
      });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !sessionId || isTyping) return;

    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsTyping(true);
    setPendingTasks([]);
    setSavedTaskIdx(new Set());

    try {
      const { data: { session: auth } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/journal/message/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, message: trimmed }),
      });

      if (!response.ok || !response.body) throw new Error("Stream falhou");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) {
              assistantMsg += data.chunk;
              setMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { role: "assistant", content: assistantMsg };
                return msgs;
              });
            } else if (data.suggestedTasks && Array.isArray(data.suggestedTasks)) {
              setPendingTasks(data.suggestedTasks);
            }
          } catch {
            // Ignore partial SSE frames until the next chunk arrives.
          }
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel conversar com a Aura agora.");
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { role: "assistant", content: "Desculpa, tive um problema ao responder. Tente novamente." };
        return msgs;
      });
    } finally {
      setIsTyping(false);
    }
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => (prev ? prev + " " + transcript : transcript));
      inputRef.current?.focus();
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }

  function saveTask(task: AiTask, idx: number) {
    addTask(task.title, task.time ?? "09:00", task.category ?? "rotina")
      .then(() => {
        setSavedTaskIdx(prev => new Set([...prev, idx]));
        showSuccess("Tarefa adicionada ao planner.");
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Nao foi possivel salvar a tarefa.");
      });
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", background: "var(--warm-bg)", overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        background: "rgba(255,255,255,.64)",
        borderBottom: "1px solid rgba(255,255,255,.84)",
        backdropFilter: "blur(18px)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--nectarine)", margin: "0 0 4px" }}>Assistente</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)", fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0 }}>Conversa com a Aura</p>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>online</p>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: "10px 16px", display: "flex", gap: 6, overflowX: "auto" }}>
        {QUICK_ACTIONS.map(a => (
          <AuraButtonV2
            key={a.label}
            onClick={() => send(`${a.emoji} ${a.label}`)}
            disabled={isTyping}
            variant="glass"
            size="sm"
            style={{
              flexShrink: 0,
              whiteSpace: "nowrap",
              color: "var(--nectarine-11)",
            }}
          >
            {a.emoji} {a.label}
          </AuraButtonV2>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 8px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 10,
          }}>
            {msg.role === "assistant" && (
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--terracotta)",
                flexShrink: 0, marginRight: 10, marginTop: 12,
                boxShadow: "0 0 0 4px rgba(243,176,140,.14)",
              }} />
            )}
            <div style={{
              maxWidth: "76%",
              padding: "9px 13px",
              borderRadius: msg.role === "user"
                ? "16px 16px 4px 16px"
                : "16px 16px 16px 4px",
              background: msg.role === "user"
                ? "rgba(243,176,140,.58)"
                : "rgba(255,255,255,.68)",
              color: msg.role === "user" ? "#fff" : "var(--text-1)",
              fontSize: 13.5,
              lineHeight: 1.55,
              boxShadow: msg.role === "user"
                ? "0 10px 24px rgba(243,176,140,.18)"
                : "0 10px 24px rgba(243,176,140,.08)",
              border: "1px solid rgba(255,255,255,.82)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              backdropFilter: "blur(18px)",
            }}>
              {msg.content || (isTyping && i === messages.length - 1 ? (
                <span style={{ opacity: 0.5, fontStyle: "italic" }}>digitando...</span>
              ) : "")}
            </div>
          </div>
        ))}

        {/* Pending tasks from AI */}
        {pendingTasks.length > 0 && (
          <div style={{
            margin: "6px 0 10px 33px",
            background: "rgba(255,255,255,.68)",
            border: "1px solid rgba(255,255,255,.84)",
            borderRadius: 18, padding: "10px 12px",
            boxShadow: "0 12px 24px rgba(243,176,140,.08)",
            backdropFilter: "blur(18px)",
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--nectarine)", margin: "0 0 8px" }}>
              ✨ TAREFAS SUGERIDAS
            </p>
            {pendingTasks.map((task, idx) => {
              const saved = savedTaskIdx.has(idx);
              return (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 8px", borderRadius: 8, marginBottom: 4,
                  background: saved ? "rgba(180,185,169,.08)" : "var(--warm-bg)",
                  border: `1px solid ${saved ? "rgba(180,185,169,.3)" : "rgba(197,165,147,.12)"}`,
                  opacity: saved ? 0.65 : 1,
                }}>
                  <p style={{
                    flex: 1, fontSize: 12.5, color: "var(--text-1)", margin: 0,
                    textDecoration: saved ? "line-through" : "none", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}>{task.title}</p>
                  <AuraButtonV2
                    onClick={() => saveTask(task, idx)}
                    disabled={saved}
                    variant={saved ? "glass" : "primary"}
                    size="sm"
                    style={{
                      flexShrink: 0,
                      color: saved ? "var(--menthe-11)" : "#fff",
                      cursor: saved ? "default" : "pointer",
                    }}
                  >
                    {saved ? "✓" : "+ Planner"}
                  </AuraButtonV2>
                </div>
              );
            })}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 16px 20px",
        background: "rgba(255,255,255,.66)",
        borderTop: "1px solid rgba(255,255,255,.84)",
        backdropFilter: "blur(18px)",
      }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "flex-end",
          background: "rgba(255,255,255,.68)", borderRadius: 22,
          border: "1px solid rgba(255,255,255,.82)",
          padding: "6px 6px 6px 14px",
          boxShadow: "0 12px 24px rgba(243,176,140,.08)",
          backdropFilter: "blur(18px)",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Fale com a Aura..."
            rows={1}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13.5, color: "var(--text-1)",
              background: "transparent", lineHeight: 1.5, maxHeight: 100,
              overflowY: "auto",
            }}
          />
          <AuraButtonV2
            onClick={toggleVoice}
            title={isRecording ? "Parar microfone" : "Ditado por voz"}
            variant={isRecording ? "primary" : "glass"}
            size="sm"
            style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              transition: "all 150ms",
              color: isRecording ? "#fff" : "var(--text-2)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isRecording ? "#fff" : "var(--text-2)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </AuraButtonV2>
          <AuraButtonV2
            onClick={() => send(input)}
            disabled={!input.trim() || isTyping}
            variant="primary"
            size="sm"
            style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              border: "none", cursor: (!input.trim() || isTyping) ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 150ms",
              opacity: (!input.trim() || isTyping) ? 0.45 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={(!input.trim() || isTyping) ? "var(--nectarine)" : "#fff"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </AuraButtonV2>
        </div>
      </div>
    </div>
  );
}

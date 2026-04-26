import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useToast } from "../components/Toast";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { trackEvent } from "../lib/track";
import { supabase } from "../lib/supabase";
import { buildJournalPlannerSlot } from "./journal-page.helpers";
import "../styles/aura.css";
import { appendStoredGtdAction } from "../utils/goal-priority-actions";
import { computeMoodCycle } from "../utils/mood-cycle-engine";

type Message = {
  id?: string;
  role: "assistant" | "user";
  content: string;
};

type JournalSessionCard = {
  id: string;
  localDate: string;
  status: "active" | "completed" | string;
  summary: string | null;
  emotions: string[];
  themes: string[];
  startedAt: string;
  finalizedAt: string | null;
};

type JournalSummary = {
  text: string;
  emotions: string[];
  themes: string[];
  suggestions?: string[];
};

type SuggestedTask = {
  title: string;
  category: "trabalho" | "saude" | "rotina" | "social";
  time?: string;
};

type JournalFinalizationResult = {
  summary: JournalSummary | null;
  suggestedTasks: SuggestedTask[];
  temporalLabel: string;
};

const INITIAL_ASSISTANT_MESSAGE =
  "Este espaço é seu. Pode começar de onde estiver: pensamento solto, emoção embolada ou algo que você só quer deixar sair.";

const DAY_KEYWORDS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(hoje|agora|nesta noite|essa noite)\b/i, label: "Hoje" },
  { regex: /\b(amanha|amanhã)\b/i, label: "Amanhã" },
  { regex: /\bsegunda(-feira)?\b/i, label: "Segunda" },
  { regex: /\bterca(-feira)?|terça(-feira)?\b/i, label: "Terça" },
  { regex: /\bquarta(-feira)?\b/i, label: "Quarta" },
  { regex: /\bquinta(-feira)?\b/i, label: "Quinta" },
  { regex: /\bsexta(-feira)?\b/i, label: "Sexta" },
  { regex: /\bsabado|sábado\b/i, label: "Sábado" },
  { regex: /\bdomingo\b/i, label: "Domingo" },
];

function resolveTemporalLabelFromConversation(messages: Message[]): string {
  const recentUserText = messages
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content)
    .join(" ");

  for (const marker of DAY_KEYWORDS) {
    if (marker.regex.test(recentUserText)) return marker.label;
  }

  const hour = new Date().getHours();
  if (hour >= 20 || hour < 5) return "Amanhã";
  return "Hoje";
}

function buildCommitmentSuggestions(summary: JournalSummary | null, temporalLabel: string): string[] {
  if (!summary?.suggestions?.length) return [];
  return summary.suggestions.slice(0, 3).map((suggestion) => `${temporalLabel}: ${suggestion}`);
}

const ACTION_SAVE_VERB_RE = /\b(salva|salvar|grave|grava|guardar|guarda|registra|registrar|adiciona|adicionar|coloca|colocar|manda|mandar|joga|jogar|inclui|incluir)\b/i;
const ACTION_SAVE_TARGET_RE = /\b(ações|acoes|ação|acao|próxima ação|proxima acao|próximas ações|proximas acoes)\b/i;

function sanitizeExplicitActionText(text: string): string {
  return text
    .replace(/["“”]/g, "")
    .replace(/\b(por favor|pra mim|para mim|nas minhas|nas|em|para|pra|minhas|minha)\b/gi, " ")
    .replace(ACTION_SAVE_VERB_RE, " ")
    .replace(ACTION_SAVE_TARGET_RE, " ")
    .replace(/\b(isso aqui|isso|essa sugestão|essa sugestao|esta sugestão|esta sugestao|essa ação|essa acao|esta ação|esta acao)\b/gi, " ")
    .replace(/[.:;,\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickActionFromAssistant(messages: Message[]): string | null {
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.content.trim());
  if (!lastAssistant) return null;

  const candidate = lastAssistant.content
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•→]|\d+[.)])\s*/, "").trim())
    .find((line) => line.length >= 12 && !line.endsWith("?"));

  return candidate ? candidate.slice(0, 180) : null;
}

function extractExplicitActionSave(text: string, messages: Message[]): string | null {
  if (!ACTION_SAVE_VERB_RE.test(text) || !ACTION_SAVE_TARGET_RE.test(text)) return null;

  const quoted = text.match(/["“”']([^"“”']{4,180})["“”']/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const cleaned = sanitizeExplicitActionText(text);
  if (cleaned.length >= 8 && cleaned.split(/\s+/).length >= 2) return cleaned.slice(0, 180);

  return pickActionFromAssistant(messages);
}

function formatSessionDate(localDate: string, startedAt: string): string {
  const date = localDate ? new Date(`${localDate}T12:00:00`) : new Date(startedAt);

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function JournalPage() {
  const { state } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const location = useLocation();
  const routeState = location.state as { initialDraft?: string; contextLabel?: string } | null;
  const initialDraft = typeof routeState?.initialDraft === "string" ? routeState.initialDraft : "";
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);

  const [view, setView] = useState<"overview" | "chat">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState(initialDraft);
  const [isTyping, setIsTyping] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [sessions, setSessions] = useState<JournalSessionCard[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [latestSummary, setLatestSummary] = useState<JournalSummary | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmotion, setFilterEmotion] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showFinalizationModal, setShowFinalizationModal] = useState(false);
  const [finalizationResult, setFinalizationResult] = useState<JournalFinalizationResult | null>(null);
  const [addingToPlanner, setAddingToPlanner] = useState<string | null>(null);
  const [addedToPlanner, setAddedToPlanner] = useState<Set<string>>(new Set());
  const [dayChoice, setDayChoice] = useState<{ key: string; task: SuggestedTask; isCommitment?: boolean; text?: string } | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasAutoOpenedRef = useRef(false);
  const journalOpenedRef = useRef(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    hasAutoOpenedRef.current = true;
    void openJournal();
  }, []);

  useEffect(() => {
    if (journalOpenedRef.current || isSessionsLoading) return;
    journalOpenedRef.current = true;
    trackEvent("journal_opened", {
      view: "chat",
      has_active_session: Boolean(sessions.some((session) => session.status === "active")),
    });
  }, [isSessionsLoading, sessions]);

  async function loadSessions() {
    setIsSessionsLoading(true);
    try {
      const result = await api.get("/journal/sessions?limit=50");
      setSessions(Array.isArray(result) ? result : []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível carregar seus resumos do diário.");
      setSessions([]);
    } finally {
      setIsSessionsLoading(false);
    }
  }

  async function startSession() {
    try {
      const response = await api.post("/journal/start", {
        moodCycleContext: cycleReport.aiContext,
      }) as {
        sessionId: string;
        messages?: Message[];
      };

      setSessionId(response.sessionId);
      setView("chat");

      if (Array.isArray(response.messages) && response.messages.length > 0) {
        setMessages(response.messages);
      } else {
        setMessages([{
          role: "assistant",
          content: initialDraft
            ? "Trouxe o contexto do check-in para o diário. Ajuste o texto se quiser e me envie para eu te ajudar a organizar isso."
            : INITIAL_ASSISTANT_MESSAGE,
        }]);
      }

      void loadSessions();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível abrir o diário agora.");
    }
  }

  async function openJournal() {
    if (sessionId && messages.length > 0) {
      setView("chat");
      return;
    }

    await startSession();
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionId || isTyping || isFinalizing) return;

    const userMessage: Message = { role: "user", content: text };
    const explicitAction = extractExplicitActionSave(text, messages);
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      if (explicitAction) {
        appendStoredGtdAction({
          text: explicitAction,
          titulo: explicitAction,
          razao: "Pedido explícito feito dentro do diário.",
          source: "journal",
        });
        showSuccess("Salvei em Ações.");
      }

      const { data: { session: authSession } } = await supabase.auth.getSession();

      const response = await fetch(`${API_URL}/journal/message/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: text,
          moodCycleContext: cycleReport.aiContext,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Não foi possível continuar a sessão agora.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) {
              assistantMessage += data.chunk;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantMessage };
                return next;
              });
            } else if (data.message) {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = data.message;
                return next;
              });
            }
          } catch {
            continue;
          }
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível enviar a mensagem agora.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Tive um problema para responder agora. Se quiser, tente de novo em seguida.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  async function finalizeSession() {
    if (!sessionId || isFinalizing) return;

    setIsFinalizing(true);
    try {
      const result = await api.post("/journal/finalize", { sessionId, currentHour: new Date().getHours() }) as {
        summary?: JournalSummary;
        suggestedTasks?: SuggestedTask[];
        sessionStatus?: string;
      };

      const temporalLabel = resolveTemporalLabelFromConversation(messages);
      setLatestSummary(result.summary ?? null);
      setFinalizationResult({
        summary: result.summary ?? null,
        suggestedTasks: Array.isArray(result.suggestedTasks) ? result.suggestedTasks : [],
        temporalLabel,
      });
      setShowFinalizationModal(true);
      setSessionId(null);
      setMessages([]);
      setExpandedSessionId(null);
      setView("overview");
      await loadSessions();
      showSuccess("Sessão finalizada e resumo salvo.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    } finally {
      setIsFinalizing(false);
    }
  }

  function toggleVoice() {
    const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }

  async function addTaskToPlanner(key: string, task: SuggestedTask, dayOffset: number) {
    setAddingToPlanner(key);
    try {
      const slot = buildJournalPlannerSlot({ time: task.time, dayOffset });

      await api.post("/timeline", {
        date: slot.date,
        forceSave: true,
        blocks: [{
          title: task.title,
          startTime: slot.startTime,
          endTime: slot.endTime,
          category: task.category === "saude" ? "autocuidado" : task.category,
          intensity: "M",
          status: "planned",
          isAiSuggested: true,
          aiReasoning: "Sugerido a partir do diário.",
        }],
      });

      setAddedToPlanner(prev => new Set([...prev, key]));
      trackEvent("tasks_added_to_planner", {
        source: "journal",
        day_offset: dayOffset,
      });
      showSuccess(dayOffset === 0 ? "Adicionado à agenda de hoje!" : "Adicionado à agenda de amanhã!");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível adicionar ao planner.");
    } finally {
      setAddingToPlanner(null);
      setDayChoice(null);
    }
  }

  function handleAddClick(key: string, task: SuggestedTask) {
    const nowHour = new Date().getHours();
    const taskHour = task.time ? Number(task.time.split(":")[0]) : nowHour + 1;
    // Ask today or tomorrow when: after 20h, task time >= 20h, or task time has already passed
    if (nowHour >= 20 || taskHour >= 20 || taskHour <= nowHour) {
      setDayChoice({ key, task });
    } else {
      void addTaskToPlanner(key, task, 0);
    }
  }

  const activePersistedSession = sessions.find((session) => session.status === "active");
  const mainButtonLabel = sessionId || activePersistedSession ? "Continuar meu diário" : "Abrir meu diário";

  const commitmentSuggestions = buildCommitmentSuggestions(finalizationResult?.summary ?? null, finalizationResult?.temporalLabel ?? "Hoje");

  const finalizationModal = showFinalizationModal && finalizationResult ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 24, 39, 0.36)",
        backdropFilter: "blur(2px)",
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "82vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 20,
          border: "1.5px solid var(--warm-border)",
          boxShadow: "0 24px 64px rgba(17,24,39,.18)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-peach)" }}>
            Sessão finalizada
          </p>
          <button
            type="button"
            onClick={() => setShowFinalizationModal(false)}
            style={{ border: "1px solid var(--warm-border)", background: "#fff", borderRadius: 8, width: 28, height: 28, cursor: "pointer" }}
            aria-label="Fechar resumo"
          >
            ×
          </button>
        </div>

        <div style={{ background: "rgba(255, 251, 246, .9)", borderRadius: 14, border: "1px solid rgba(197,165,147,.24)", padding: "12px 13px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-3)" }}>
            Resumo do dia
          </p>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-1)" }}>
            {finalizationResult.summary?.text ?? "Resumo indisponível para esta sessão."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>Base de contexto:</span>
          <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, background: "rgba(150,199,179,.16)", color: "var(--text-1)", fontWeight: 700 }}>
            Check-in: {cycleReport.phaseLabel}
          </span>
          <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, background: "rgba(99,152,169,.14)", color: "var(--text-1)", fontWeight: 700 }}>
            Janela: {finalizationResult.temporalLabel}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)" }}>
            Compromissos sugeridos
          </p>
          {commitmentSuggestions.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)" }}>Sem compromisso sugerido para este fechamento.</p>
          ) : (
            commitmentSuggestions.map((item, idx) => {
              const key = `commit-${idx}`;
              const added = addedToPlanner.has(key);
              const fakeTask: SuggestedTask = { title: item.replace(/^(Hoje|Amanhã|[^:]+):\s*/, ""), category: "rotina" };
              return (
                <div key={item} style={{ borderRadius: 12, border: "1px solid rgba(197,165,147,.24)", background: "#fff", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>{item}</p>
                  <button
                    onClick={() => !added && handleAddClick(key, fakeTask)}
                    disabled={added || addingToPlanner === key}
                    style={{
                      alignSelf: "flex-start", border: "none", borderRadius: 8, cursor: added ? "default" : "pointer",
                      padding: "5px 12px", fontSize: 11, fontWeight: 700,
                      background: added ? "rgba(150,199,179,.18)" : "rgba(244,168,150,.15)",
                      color: added ? "var(--accent-sage)" : "var(--accent-peach)",
                      transition: "all 200ms",
                    }}
                  >
                    {added ? "✓ Adicionado" : addingToPlanner === key ? "Adicionando..." : "+ Planner"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)" }}>
            Tarefas sugeridas
          </p>
          {finalizationResult.suggestedTasks.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)" }}>Nenhuma tarefa foi sugerida neste fechamento.</p>
          ) : (
            finalizationResult.suggestedTasks.map((task, index) => {
              const key = `task-${index}`;
              const added = addedToPlanner.has(key);
              return (
                <div key={`${task.title}-${index}`} style={{ borderRadius: 12, border: "1px solid rgba(150,199,179,.28)", background: "rgba(150,199,179,.09)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-1)", fontWeight: 700 }}>{task.title}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 10.5, padding: "3px 7px", borderRadius: 999, background: "#fff", border: "1px solid rgba(99,152,169,.24)", color: "var(--text-2)", fontWeight: 700 }}>
                      {finalizationResult.temporalLabel}
                    </span>
                    <span style={{ fontSize: 10.5, padding: "3px 7px", borderRadius: 999, background: "#fff", border: "1px solid rgba(99,152,169,.24)", color: "var(--text-2)", fontWeight: 700 }}>
                      {task.category}
                    </span>
                    {task.time ? (
                      <span style={{ fontSize: 10.5, padding: "3px 7px", borderRadius: 999, background: "#fff", border: "1px solid rgba(99,152,169,.24)", color: "var(--text-2)", fontWeight: 700 }}>
                        {task.time}
                      </span>
                    ) : null}
                    <button
                      onClick={() => !added && handleAddClick(key, task)}
                      disabled={added || addingToPlanner === key}
                      style={{
                        marginLeft: "auto", border: "none", borderRadius: 8, cursor: added ? "default" : "pointer",
                        padding: "5px 12px", fontSize: 11, fontWeight: 700,
                        background: added ? "rgba(150,199,179,.18)" : "var(--accent-peach)",
                        color: added ? "var(--accent-sage)" : "#fff",
                        boxShadow: added ? "none" : "0 2px 8px rgba(244,168,150,.35)",
                        transition: "all 200ms",
                      }}
                    >
                      {added ? "✓ Na agenda" : addingToPlanner === key ? "..." : "+ Planner"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Hoje ou Amanhã? dialog */}
        {dayChoice && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(17,24,39,.5)", zIndex: 1300,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div style={{
              background: "#fff", borderRadius: 20, padding: 20, maxWidth: 320, width: "100%",
              boxShadow: "0 24px 64px rgba(17,24,39,.2)",
            }}>
              <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 6px", color: "var(--text-1)" }}>Quando adicionar?</p>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px", lineHeight: 1.5 }}>
                "{dayChoice.task.title}"
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => void addTaskToPlanner(dayChoice.key, dayChoice.task, 0)}
                  style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1.5px solid var(--accent-peach)", background: "rgba(244,168,150,.1)", color: "var(--accent-peach)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                >
                  Hoje
                </button>
                <button
                  onClick={() => void addTaskToPlanner(dayChoice.key, dayChoice.task, 1)}
                  style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: "var(--accent-peach)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: "0 4px 14px rgba(244,168,150,.4)" }}
                >
                  Amanhã
                </button>
              </div>
              <button onClick={() => setDayChoice(null)} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--text-3)", fontSize: 12, cursor: "pointer", padding: 6 }}>
                Cancelar
              </button>
            </div>
          </div>
        )}


        <AuraButtonV2 className="ui-btn-gradient" onClick={() => setShowFinalizationModal(false)}>
          Continuar
        </AuraButtonV2>
      </div>
    </div>
  ) : null;

  if (view === "overview") {
    return (
      <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
        <div className="screen-content" style={{ padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--primary)", margin: 0 }}>
              Diário com IA
            </p>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
              Um só lugar para conversar e acompanhar
            </h2>
            <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
              Abra uma conversa quando quiser. Cada sessão salva um resumo aqui para você revisitar depois.
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: "24px",
              border: "1.5px solid var(--warm-border)",
              padding: "18px 18px 16px",
              boxShadow: "0 10px 24px rgba(31,42,54,0.05)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--primary)", margin: 0 }}>
                Entrada única
              </p>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
                Seu diário vivo
              </p>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, margin: 0 }}>
                Use este espaço para desabafar, organizar emoções ou acompanhar padrões ao longo do tempo.
              </p>
            </div>

            <AuraButtonV2 className="ui-btn-gradient" style={{ width: "100%", height: "52px" }} onClick={openJournal}>
              {mainButtonLabel}
            </AuraButtonV2>
          </div>

          {latestSummary && (
            <div
              style={{
                background: "rgba(255,255,255,.9)",
                borderRadius: "22px",
                border: "1.5px solid rgba(197,165,147,.28)",
                padding: "16px 18px",
                boxShadow: "0 8px 24px rgba(31,42,54,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-peach)", margin: 0 }}>
                Sessão recém-salva
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-1)", margin: 0 }}>
                {latestSummary.text}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {latestSummary.emotions.map((emotion) => (
                  <span
                    key={emotion}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(243,176,140,.14)",
                      color: "var(--text-1)",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {emotion}
                  </span>
                ))}
                {latestSummary.themes.map((theme) => (
                  <span
                    key={theme}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(150,199,179,.16)",
                      color: "var(--text-1)",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
                Memória do diário
              </p>
              <AuraButtonV2 variant="glass" size="sm" onClick={() => void loadSessions()}>
                Atualizar
              </AuraButtonV2>
            </div>

            {/* ── Search + emotion filter ── */}
            {sessions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                    fontSize: 14, pointerEvents: "none", color: "var(--text-3)",
                  }}>🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por tema, emoção ou conteúdo..."
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 34px",
                      borderRadius: 12,
                      border: searchQuery ? "1.5px solid rgba(99,152,169,0.45)" : "1.5px solid var(--warm-border)",
                      background: "#fff",
                      fontSize: 13,
                      color: "var(--text-1)",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: "border-color 0.2s",
                    }}
                  />
                </div>
                {/* Unique emotions as filter chips */}
                {(() => {
                  const allEmotions = [...new Set(sessions.flatMap(s => s.emotions))].slice(0, 8);
                  if (allEmotions.length === 0) return null;
                  return (
                    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
                      {allEmotions.map(em => (
                        <button
                          key={em}
                          onClick={() => setFilterEmotion(filterEmotion === em ? null : em)}
                          style={{
                            flexShrink: 0,
                            padding: "5px 11px",
                            borderRadius: 999,
                            border: `1.5px solid ${filterEmotion === em ? "var(--accent-peach)" : "var(--warm-border)"}`,
                            background: filterEmotion === em ? "rgba(215,137,127,0.12)" : "#fff",
                            color: filterEmotion === em ? "var(--accent-peach)" : "var(--text-3)",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {isSessionsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--warm-border)", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div className="skeleton" style={{ height: 13, width: "60%", borderRadius: 6 }} />
                        <div className="skeleton" style={{ height: 11, width: "35%", borderRadius: 6 }} />
                      </div>
                    </div>
                    <div className="skeleton" style={{ height: 11, width: "90%", borderRadius: 6 }} />
                    <div className="skeleton" style={{ height: 11, width: "70%", borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="empty-state" style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--warm-border)" }}>
                <div className="empty-state-icon">📔</div>
                <div className="empty-state-title">Nenhuma sessão ainda</div>
                <div className="empty-state-sub">Seu histórico aparece aqui após a primeira sessão de diário concluída.</div>
              </div>
            ) : (
              (() => {
                const q = searchQuery.toLowerCase().trim();
                const filteredSessions = sessions.filter(s => {
                  if (filterEmotion && !s.emotions.includes(filterEmotion)) return false;
                  if (!q) return true;
                  return (
                    (s.summary ?? '').toLowerCase().includes(q) ||
                    s.emotions.some(e => e.toLowerCase().includes(q)) ||
                    s.themes.some(t => t.toLowerCase().includes(q))
                  );
                });
                if (filteredSessions.length === 0) return (
                  <div style={{ padding: "16px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                    Nenhuma sessão encontrada para "{searchQuery || filterEmotion}".
                  </div>
                );
                return filteredSessions.map((session) => {
                const expanded = expandedSessionId === session.id;
                const isActive = session.status === "active";

                return (
                  <div
                    key={session.id}
                    onClick={() => setExpandedSessionId(expanded ? null : session.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "#fff",
                      borderRadius: "20px",
                      border: "1.5px solid var(--warm-border)",
                      padding: "16px 18px",
                      boxShadow: "0 6px 16px rgba(31,42,54,0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)" }}>
                          {formatSessionDate(session.localDate, session.startedAt)}
                        </p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
                          {isActive ? "Sessão em andamento" : "Sessão concluída"}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: isActive ? "rgba(150,199,179,.16)" : "rgba(243,176,140,.14)",
                          color: "var(--text-1)",
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}
                      >
                        {isActive ? "Retomar" : "Resumo"}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-2)" }}>
                      {session.summary || "Esta sessão ainda está aberta. Toque para retomar a conversa."}
                    </p>

                    {expanded && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {(session.emotions.length > 0 || session.themes.length > 0) && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {session.emotions.map((emotion) => (
                              <span
                                key={`${session.id}-${emotion}`}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  background: "rgba(243,176,140,.12)",
                                  color: "var(--text-1)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {emotion}
                              </span>
                            ))}
                            {session.themes.map((theme) => (
                              <span
                                key={`${session.id}-${theme}`}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  background: "rgba(150,199,179,.16)",
                                  color: "var(--text-1)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {theme}
                              </span>
                            ))}
                          </div>
                        )}

                        {isActive && (
                          <AuraButtonV2
                            variant="primary"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void openJournal();
                            }}
                          >
                            Continuar sessão
                          </AuraButtonV2>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
              })()
            )}
          </div>
        </div>
        {finalizationModal}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--warm-bg)", overflow: "hidden" }}>
      <div className="screen-content" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: "16px 16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <AuraButtonV2
            onClick={() => setView("overview")}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "1.5px solid var(--warm-border-2)",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(31,42,54,0.04)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </AuraButtonV2>
          <div>
            <h2 style={{ fontFamily: "'Poppins'", fontSize: "16px", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
              Diário com IA
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: isTyping ? "var(--accent-sage)" : "var(--accent-sky)",
                  animation: isTyping ? "pulse 1.2s infinite" : "none",
                }}
              />
              <p style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
                {isTyping ? "Airia contemplando..." : "Sessão aberta"}
              </p>
            </div>
          </div>
        </div>

        <div className="chat-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          {messages.map((message, index) =>
            message.role === "assistant" ? (
              <div key={message.id ?? index} className="bubble" style={{ maxWidth: "88%" }}>
                <p className="bubble-name" style={{ color: "var(--text-2)", fontWeight: 700, fontSize: "10px", marginBottom: "6px" }}>
                  Airia
                </p>
                <div
                  className="bubble-ai"
                  style={{
                    background: "#fff",
                    border: "1.2px solid var(--warm-border)",
                    borderRadius: "20px 20px 20px 4px",
                    boxShadow: "0 4px 12px rgba(31,42,54,0.03)",
                    padding: "14px 16px",
                    color: "var(--text-1)",
                    fontSize: "14px",
                    lineHeight: "1.55",
                  }}
                >
                  {message.content}
                </div>
              </div>
            ) : (
              <div
                key={message.id ?? index}
                className="bubble bubble-user"
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "88%",
                  background: "var(--primary)",
                  color: "var(--text-1)",
                  borderRadius: "20px 20px 4px 20px",
                  padding: "14px 16px",
                  fontSize: "14px",
                  lineHeight: "1.55",
                  boxShadow: "var(--shadow-primary)",
                }}
              >
                {message.content}
              </div>
            ),
          )}

          {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="bubble" style={{ maxWidth: "88%" }}>
              <div
                className="bubble-ai"
                style={{
                  background: "#fff",
                  border: "1.2px solid var(--warm-border)",
                  borderRadius: "20px 20px 20px 4px",
                  padding: "14px 16px",
                  color: "var(--text-3)",
                }}
              >
                ✦ Digitando...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div style={{ marginTop: "20px" }}>
          <div
            className="journal-input-row"
            style={{
              background: "#fff",
              border: "1.5px solid var(--warm-border-2)",
              borderRadius: "24px",
              padding: "8px 8px 8px 16px",
              boxShadow: "0 8px 24px rgba(31,42,54,0.06)",
              gap: "10px",
            }}
          >
            <textarea
              className="journal-input"
              placeholder="O que você está pensando?"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isTyping || isFinalizing}
              rows={4}
              style={{
                fontSize: "14px",
                color: "var(--text-1)",
                fontWeight: 500,
                minHeight: "96px",
                resize: "none",
                lineHeight: 1.45,
              }}
            />
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => toggleVoice()}
                title={isRecording ? "Parar" : "Falar"}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: "none",
                  background: isRecording ? "var(--accent-sage)" : "var(--warm-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 200ms",
                  color: isRecording ? "#fff" : "var(--text-2)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              <div
                className="journal-send"
                onClick={() => void sendMessage()}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "var(--shadow-primary)",
                  opacity: (!input.trim() || isTyping || isFinalizing) ? 0.4 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
            </div>
          </div>

          <AuraButtonV2
            onClick={() => void finalizeSession()}
            disabled={!sessionId || isFinalizing}
            style={{
              width: "100%",
              marginTop: "12px",
              background: "transparent",
              border: "none",
              color: "var(--text-3)",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              cursor: !sessionId || isFinalizing ? "default" : "pointer",
              opacity: !sessionId || isFinalizing ? 0.5 : 1,
            }}
          >
            {isFinalizing ? "Salvando resumo..." : "Encerrar sessão e salvar resumo"}
          </AuraButtonV2>
        </div>
      </div>
      {finalizationModal}
    </div>
  );
}

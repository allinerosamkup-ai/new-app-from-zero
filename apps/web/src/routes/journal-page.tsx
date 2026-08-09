import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveIntlLocale, useLocalizedCopy } from "../i18n";
import { useLocation, useNavigate } from "react-router-dom";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { SafetyProtocolCard, type RiskSafety } from "../components/aura/SafetyProtocolCard";
import { useToast } from "../components/Toast";
import { CommandPlanCard } from "../components/aura/CommandPlanCard";
import { AiriaMascot } from "../components/airia/AiriaMascot";
import { shouldRenderCommandPlan } from "../features/aura/command-checkin-receipt";
import type { AuraCommandPlan } from "../features/aura/command-types";
import { SmartEmptyState } from "../components/activation/SmartEmptyState";
import { useAuraStore } from "../features/aura/store";
import { api, getClientTimeContext, getAdaptiveSnapshot } from "../lib/api";
import { trackEvent } from "../lib/track";
import { tapHaptic } from "../utils/haptics";
import { supabase } from "../lib/supabase";
import { buildJournalClosePrompt } from "./journal-page.helpers";
import { isSpeechRecognitionSupported, VOICE_MAX_DURATION_MS } from "./journal-voice.helpers";
import {
  createTranscriptResultHandler,
  releaseRecognition,
  stopActiveRecognition,
  TranscriptSession,
} from "../features/voice/transcript-session";
import "../styles/aura.css";
import { saveNextAction } from "../utils/save-next-action";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import { MessageSquareText } from "lucide-react";

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

function formatSessionDate(localDate: string, startedAt: string, locale: string): string {
  const date = localDate ? new Date(`${localDate}T12:00:00`) : new Date(startedAt);

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
}

export function JournalPage() {
  const { t, i18n } = useTranslation();
  const l = useLocalizedCopy();
  const { state, refreshData } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { initialDraft?: string; contextLabel?: string } | null;
  const initialDraft = typeof routeState?.initialDraft === "string" ? routeState.initialDraft : "";
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);

  const [view, setView] = useState<"overview" | "chat">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState(initialDraft);
  const [isTyping, setIsTyping] = useState(false);
  // Proposta vinda do diário: check-in e/ou meta montados a partir do que foi
  // contado. Fica esperando confirmação — o diário nunca aplica sozinho.
  const [commandPlan, setCommandPlan] = useState<AuraCommandPlan | null>(null);
  const [applyingPlan, setApplyingPlan] = useState(false);

  function updatePlanOperation(
    operationId: string,
    patch: { selected?: boolean; payload?: Record<string, unknown> },
  ) {
    setCommandPlan((current) => current ? {
      ...current,
      operations: current.operations.map((operation) => (
        operation.id === operationId ? { ...operation, ...patch } : operation
      )),
    } : current);
  }

  async function applyJournalPlan() {
    if (!commandPlan || applyingPlan) return;
    const selected = commandPlan.operations.filter((operation) => operation.selected);
    if (selected.length === 0) return;

    setApplyingPlan(true);
    try {
      await api.patch(`/aura/command/plans/${commandPlan.id}`, {
        operations: commandPlan.operations.map((operation) => ({
          id: operation.id,
          selected: operation.selected,
          payload: operation.payload,
        })),
      });
      const applied = await api.post(`/aura/command/plans/${commandPlan.id}/apply`, {
        operationIds: selected.map((operation) => operation.id),
        // Chave estável por plano: reenviar não duplica check-in nem meta.
        idempotencyKey: `journal:${commandPlan.id}`,
      }) as { plan?: AuraCommandPlan };
      setCommandPlan(applied.plan ?? null);
      await refreshData();
      showSuccess(l("Registrado.", "Saved."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não consegui registrar agora.", "Could not save right now."));
    } finally {
      setApplyingPlan(false);
    }
  }
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [lastRiskSafety, setLastRiskSafety] = useState<RiskSafety | null>(null);
  const [sessions, setSessions] = useState<JournalSessionCard[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [latestSummary, setLatestSummary] = useState<JournalSummary | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  /**
   * Aba visível. Escrever hoje e reler o que passou são duas intenções
   * diferentes, e empilhadas na mesma tela a segunda ficava soterrada abaixo da
   * primeira — quem queria reler tinha que rolar por tudo.
   */
  const [journalTab, setJournalTab] = useState<"today" | "past">("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmotion, setFilterEmotion] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimVoice, setInterimVoice] = useState("");
  const voiceSupported = useMemo(() => isSpeechRecognitionSupported(), []);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFinalizationModal, setShowFinalizationModal] = useState(false);
  const [finalizationResult, setFinalizationResult] = useState<JournalFinalizationResult | null>(null);
  const [addingToPlanner, setAddingToPlanner] = useState<string | null>(null);
  const [addedToPlanner, setAddedToPlanner] = useState<Set<string>>(new Set());
  const [liveReplyPending, setLiveReplyPending] = useState(false);
  const liveReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceInputBaseRef = useRef("");
  const transcriptSessionRef = useRef<TranscriptSession | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasAutoOpenedRef = useRef(false);
  const journalOpenedRef = useRef(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, lastRiskSafety]);

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

  // Diário ao vivo: depois de 4s sem digitar + mínimo 50 chars, Airia responde automaticamente
  useEffect(() => {
    if (liveReplyTimerRef.current) {
      clearTimeout(liveReplyTimerRef.current);
      liveReplyTimerRef.current = null;
    }
    setLiveReplyPending(false);

    const trimmed = input.trim();
    if (trimmed.length < 50 || isTyping || isFinalizing || !sessionId) return;

    // Só ativa se já houve pelo menos uma mensagem do assistente (sessão em andamento)
    if (messages.length < 2) return;

    setLiveReplyPending(true);
    liveReplyTimerRef.current = setTimeout(() => {
      setLiveReplyPending(false);
      void sendMessage();
    }, 4000);

    return () => {
      if (liveReplyTimerRef.current) clearTimeout(liveReplyTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  async function loadSessions() {
    setIsSessionsLoading(true);
    try {
      const result = await api.get("/journal/sessions?limit=50");
      const nextSessions = Array.isArray(result) ? result : [];
      setSessions(nextSessions);
      if (nextSessions.some((session) => session.status === "completed")) {
        window.localStorage.setItem("airia.journal.hasEntry", "true");
      }
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
        created?: boolean;
        openingContext?: string | null;
        messages?: Message[];
      };

      setSessionId(response.sessionId);
      setView("chat");

      if (Array.isArray(response.messages) && response.messages.length > 0) {
        // Se tem openingContext e a sessão é nova, injeta como primeira mensagem da Airia
        if (response.created && response.openingContext) {
          const hasAssistantMsg = response.messages.some(m => m.role === "assistant");
          if (!hasAssistantMsg) {
            setMessages([
              { role: "assistant", content: response.openingContext },
              ...response.messages,
            ]);
          } else {
            setMessages(response.messages);
          }
        } else {
          setMessages(response.messages);
        }
      } else {
        // Sessão nova sem mensagens: usa openingContext se disponível
        const openingMsg = response.created && response.openingContext
          ? response.openingContext
          : (initialDraft
              ? "Trouxe sua nota do check-in para iniciar o diário. Complete do seu jeito e me envie quando quiser organizar isso."
              : l(INITIAL_ASSISTANT_MESSAGE, "This space is yours. Start wherever you are: a loose thought, a tangled emotion, or something you simply need to let out."));
        setMessages([{ role: "assistant", content: openingMsg }]);
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
    setLastRiskSafety(null);

    try {
      if (explicitAction) {
        const saved = await saveNextAction({
          text: explicitAction,
          razao: "Pedido explícito feito dentro do diário.",
          source: "journal",
        });
        // Se já existia equivalente, dizer que salvou seria mentira: a pessoa
        // procuraria um item novo que não foi criado.
        showSuccess(saved.created
          ? t("journal.savedActions")
          : l(
            `Isso já está nas suas próximas ações: "${saved.item.titulo || saved.item.text}".`,
            `That is already in your next actions: "${saved.item.titulo || saved.item.text}".`,
          ));
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
          ...getClientTimeContext(),
          ...getAdaptiveSnapshot(),
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

            // O diário propõe check-in e meta a partir do que foi contado.
            // Chega como plano para revisar — nunca aplicado sozinho.
            if (data.plan) {
              setCommandPlan(data.plan as AuraCommandPlan);
            }

            if (data.riskSafety) {
              const riskSafety = data.riskSafety as RiskSafety;
              setLastRiskSafety(riskSafety);
              if (riskSafety.route === "human_support" || riskSafety.route === "crisis_protocol") {
                trackEvent("risk_protocol_triggered", {
                  surface: "journal",
                  action: "protocol_shown",
                  riskLevel: riskSafety.riskLevel,
                  route: riskSafety.route,
                  signals: riskSafety.signals ?? [],
                });
              }
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
      window.localStorage.setItem("airia.journal.hasEntry", "true");
      setSessionId(null);
      setMessages([]);
      setExpandedSessionId(null);
      setView("overview");
      await loadSessions();
      showSuccess(t("journal.finishedSaved"));
    } catch (error) {
      showError(error instanceof Error ? error.message : t("journal.finishError"));
    } finally {
      setIsFinalizing(false);
    }
  }

  function stopVoice() {
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    stopActiveRecognition(recognitionRef);
    transcriptSessionRef.current?.reset();
    transcriptSessionRef.current = null;
    setInterimVoice("");
    setIsRecording(false);
  }

  function toggleVoice() {
    const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) return;

    if (isRecording && recognitionRef.current) {
      stopVoice();
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = resolveIntlLocale();
    // Contínuo + interim: aguenta pausas ("falar 30s") e mostra o texto ao vivo.
    recognition.continuous = true;
    recognition.interimResults = true;
    const transcriptSession = new TranscriptSession();
    transcriptSessionRef.current = transcriptSession;
    voiceInputBaseRef.current = input;
    recognition.onresult = createTranscriptResultHandler(transcriptSession, (snapshot) => {
      setInput([voiceInputBaseRef.current.trim(), snapshot.finalText].filter(Boolean).join(" "));
      setInterimVoice(snapshot.interimText);
    });
    recognition.onend = () => {
      if (!releaseRecognition(recognitionRef, recognition)) return;
      stopVoice();
    };
    recognition.onerror = () => {
      if (!releaseRecognition(recognitionRef, recognition)) return;
      stopVoice();
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    // Para sozinho depois do limite de segurança.
    voiceTimerRef.current = setTimeout(() => stopVoice(), VOICE_MAX_DURATION_MS);
  }

  // Encerra o ditado se a usuária sair da tela no meio.
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      stopActiveRecognition(recognitionRef);
      transcriptSessionRef.current?.reset();
      transcriptSessionRef.current = null;
    };
  }, []);

  // Auto-encerra sessão ativa à meia-noite
  useEffect(() => {
    if (!sessionId) return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();
    const midnightTimer = setTimeout(() => {
      void finalizeSession();
    }, msUntilMidnight);
    return () => clearTimeout(midnightTimer);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Sugestão do diário entra nas Próximas ações, sem hora.
   *
   * Antes virava bloco no Planner, e por isso precisava de um diálogo
   * "hoje ou amanhã?" — decisão de agenda para quem acabou de escrever sobre um
   * dia difícil. A régua mudou: o que importa é concluir, não caber no relógio.
   */
  async function addSuggestionToNextActions(key: string, task: SuggestedTask) {
    setAddingToPlanner(key);
    try {
      const result = await saveNextAction({
        text: task.title,
        razao: "Sugerido a partir do diário.",
        source: "journal",
      });

      setAddedToPlanner((prev) => new Set([...prev, key]));
      trackEvent("journal_suggestion_to_next_actions", {
        source: "journal",
        created: result.created,
      });
      showSuccess(result.created
        ? l("Entrou nas suas próximas ações.", "Added to your next actions.")
        : l("Isso já estava nas suas próximas ações.", "That was already in your next actions."));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível salvar a ação.");
    } finally {
      setAddingToPlanner(null);
    }
  }

  const activePersistedSession = sessions.find((session) => session.status === "active");
  const mainButtonLabel = sessionId || activePersistedSession ? "Continuar meu diário" : "Abrir meu diário";

  const commitmentSuggestions = buildCommitmentSuggestions(finalizationResult?.summary ?? null, finalizationResult?.temporalLabel ?? "Hoje");
  const journalClosePrompt = buildJournalClosePrompt({
    hasSummary: Boolean(finalizationResult?.summary?.text),
    suggestedTaskCount: finalizationResult?.suggestedTasks.length ?? 0,
    commitmentCount: commitmentSuggestions.length,
  });

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
            {t("journal.finished")}
          </p>
          <button
            type="button"
            onClick={() => setShowFinalizationModal(false)}
            style={{ border: "1px solid var(--warm-border)", background: "#fff", borderRadius: 8, width: 28, height: 28, cursor: "pointer" }}
            aria-label={t("journal.closeSummary")}
          >
            ×
          </button>
        </div>

        <div style={{ background: "rgba(255, 251, 246, .9)", borderRadius: 14, border: "1px solid rgba(155,191,168,.24)", padding: "12px 13px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-3)" }}>
            {l("Resumo do dia", "Day summary")}
          </p>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-1)" }}>
            {finalizationResult.summary?.text ?? l("Resumo indisponível para esta sessão.", "Summary unavailable for this session.")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>{l("Base de contexto:", "Context base:")}</span>
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
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)" }}>{t("journal.noCommitment")}</p>
          ) : (
            commitmentSuggestions.map((item, idx) => {
              const key = `commit-${idx}`;
              const added = addedToPlanner.has(key);
              const fakeTask: SuggestedTask = { title: item.replace(/^(Hoje|Amanhã|[^:]+):\s*/, ""), category: "rotina" };
              return (
                <div key={item} style={{ borderRadius: 12, border: "1px solid rgba(155,191,168,.24)", background: "#fff", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>{item}</p>
                  <button
                    onClick={() => { if (!added) void addSuggestionToNextActions(key, fakeTask); }}
                    disabled={added || addingToPlanner === key}
                    style={{
                      alignSelf: "flex-start", border: "none", borderRadius: 8, cursor: added ? "default" : "pointer",
                      padding: "5px 12px", fontSize: 11, fontWeight: 700,
                      background: added ? "rgba(150,199,179,.18)" : "rgba(143,192,164,.15)",
                      color: added ? "var(--accent-sage)" : "var(--accent-peach)",
                      transition: "all 200ms",
                    }}
                  >
                    {added ? l("✓ Adicionado", "✓ Added") : addingToPlanner === key ? l("Adicionando...", "Adding...") : l("+ Próximas ações", "+ Next actions")}
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
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)" }}>{t("journal.noSuggestedTasks")}</p>
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
                      onClick={() => { if (!added) void addSuggestionToNextActions(key, task); }}
                      disabled={added || addingToPlanner === key}
                      style={{
                        marginLeft: "auto", border: "none", borderRadius: 8, cursor: added ? "default" : "pointer",
                        padding: "5px 12px", fontSize: 11, fontWeight: 700,
                        background: added ? "rgba(150,199,179,.18)" : "var(--accent-peach)",
                        color: added ? "var(--accent-sage)" : "#fff",
                        boxShadow: added ? "none" : "0 2px 8px rgba(143,192,164,.35)",
                        transition: "all 200ms",
                      }}
                    >
                      {added ? l("✓ Adicionado", "✓ Added") : addingToPlanner === key ? "..." : l("+ Próximas ações", "+ Next actions")}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>



        <div style={{ borderRadius: 14, background: "rgba(176,180,196,.10)", border: "1px solid rgba(176,180,196,.26)", padding: "11px 12px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 800, color: "var(--text-1)" }}>
            {journalClosePrompt.label}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)", lineHeight: 1.45 }}>
            {journalClosePrompt.description}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <AuraButtonV2 className="btn btn-ghost" onClick={() => setShowFinalizationModal(false)}>
            {t("common.continue")}
          </AuraButtonV2>
          <AuraButtonV2
            className="ui-btn-gradient"
            onClick={() => {
              setShowFinalizationModal(false);
              navigate("/daily-summary");
            }}
          >
            Revisar dia
          </AuraButtonV2>
        </div>
      </div>
    </div>
  ) : null;

  if (view === "overview") {
    return (
      <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
        <div className="screen-content" style={{ padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Diário é escuta: as pétalas se aproximam e o brilho central
                pulsa, sem nada que puxe o toque. */}
            <div>
              <AiriaMascot phase={cycleReport.phase} motion="listen" size={84} decorative />
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--primary)", margin: 0 }}>
              {t("journal.aiJournal")}
            </p>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
              {t("journal.onePlace")}
            </h2>
            <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
              {t("journal.overviewBody")}
            </p>
          </div>

          <div
            role="tablist"
            aria-label={l("Seções do diário", "Journal sections")}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              padding: 4,
              borderRadius: 999,
              background: "rgba(17,24,39,.04)",
            }}
          >
            {([
              { id: "today" as const, label: l("Hoje", "Today") },
              { id: "past" as const, label: l("Anteriores", "Past entries") },
            ]).map((tab) => {
              const active = journalTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { tapHaptic(); setJournalTab(tab.id); }}
                  style={{
                    minHeight: 38,
                    borderRadius: 999,
                    border: 0,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: "inherit",
                    background: active ? "#fff" : "transparent",
                    color: active ? "var(--text-1)" : "var(--text-3)",
                    boxShadow: active ? "0 2px 8px rgba(31,42,54,.06)" : "none",
                    transition: "background 160ms ease, color 160ms ease",
                  }}
                >
                  {tab.label}
                  {tab.id === "past" && sessions.length > 0 ? ` (${sessions.length})` : ""}
                </button>
              );
            })}
          </div>

          {journalTab === "today" && (
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
                {t("journal.singleEntry")}
              </p>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
                {t("journal.livingJournal")}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, margin: 0 }}>
                {t("journal.livingJournalBody")}
              </p>
            </div>

            <AuraButtonV2 className="ui-btn-gradient" style={{ width: "100%", height: "52px" }} onClick={openJournal}>
              {mainButtonLabel}
            </AuraButtonV2>
          </div>
          )}

          {journalTab === "today" && latestSummary && (
            <div
              style={{
                background: "rgba(255,255,255,.9)",
                borderRadius: "22px",
                border: "1.5px solid rgba(155,191,168,.28)",
                padding: "16px 18px",
                boxShadow: "0 8px 24px rgba(31,42,54,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-peach)", margin: 0 }}>
                {t("journal.recentlySaved")}
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
                      background: "rgba(169,210,187,.14)",
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

          {journalTab === "past" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
                {t("journal.memory")}
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
                    placeholder={t("journal.searchPlaceholder", "Buscar por tema, emoção ou conteúdo...")}
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
                            background: filterEmotion === em ? "rgba(134,183,154,0.12)" : "#fff",
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
              <SmartEmptyState
                icon={MessageSquareText}
                title={l("Use o diário para dar contexto", "Use the journal to provide context")}
                description={l("A Airia entende melhor seu humor e energia quando você conta o que aconteceu, não só a nota do check-in.", "Airia understands your mood and energy better when you share what happened, not just the check-in score.")}
              ctaLabel={t("journal.firstSession")}
                onAction={openJournal}
                examples={[
                  { title: l("Hoje pesou porque...", "Today felt heavy because..."), description: l("Bom para organizar um dia confuso.", "Useful for organizing a confusing day.") },
                  { title: l("Preciso decidir sobre...", "I need to decide about..."), description: l("Bom quando tem uma escolha travada.", "Useful when a choice feels stuck.") },
                  { title: l("Quero guardar que...", "I want to remember that..."), description: l("Bom para criar memória útil para depois.", "Useful for building meaningful memory for later.") },
                ]}
              />
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
                    {t("journal.noSessionFound", { query: searchQuery || filterEmotion })}
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
                          {formatSessionDate(session.localDate, session.startedAt, resolveIntlLocale(i18n.language))}
                        </p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
                          {isActive ? l("Sessão em andamento", "Session in progress") : l("Sessão concluída", "Session completed")}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: isActive ? "rgba(150,199,179,.16)" : "rgba(169,210,187,.14)",
                          color: "var(--text-1)",
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}
                      >
                        {isActive ? l("Retomar", "Resume") : l("Resumo", "Summary")}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-2)" }}>
                      {session.summary || l("Esta sessão ainda está aberta. Toque para retomar a conversa.", "This session is still open. Tap to resume the conversation.")}
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
                                  background: "rgba(169,210,187,.12)",
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
                            {t("journal.continueSession")}
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
          )}
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
          {/* A escuta acontece aqui, na conversa aberta — não só na visão geral.
              O diário abre direto neste modo quando há sessão em andamento, que
              é a maior parte das vezes. */}
          <AiriaMascot phase={cycleReport.phase} motion="listen" size={40} decorative />
          <div>
            <h2 style={{ fontFamily: "'Poppins'", fontSize: "16px", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
              {t("journal.aiJournal")}
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
                {isTyping ? l("Airia contemplando...", "Airia is reflecting...") : l("Sessão aberta", "Session open")}
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
                  background: "linear-gradient(135deg, var(--accent-peach-a3), rgba(191,220,203,.18))",
                  border: "1px solid rgba(191,220,203,.34)",
                  color: "var(--text-1)",
                  borderRadius: "20px 20px 4px 20px",
                  padding: "14px 16px",
                  fontSize: "14px",
                  lineHeight: "1.55",
                  boxShadow: "0 10px 20px rgba(191,220,203,.10)",
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

          {/* Proposta de check-in e/ou meta a partir do que foi contado.
              Aparece depois da resposta, com confirmação — o diário é lugar de
              desabafo, e gravar sem pedir transformaria isso em formulário. */}
          {shouldRenderCommandPlan(commandPlan) && commandPlan && (
            <CommandPlanCard
              plan={commandPlan}
              applying={applyingPlan}
              onChange={updatePlanOperation}
              onApply={applyJournalPlan}
            />
          )}

          <SafetyProtocolCard
            riskSafety={lastRiskSafety}
            surface="journal"
            
          />

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
              placeholder={t("journal.placeholder", "O que você está pensando?")}
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
            {liveReplyPending && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 4px 2px",
                gap: 8,
              }}>
                <span style={{ fontSize: 11, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--accent-sage, #96c7b3)", animation: "voicePulse 1.4s ease-in-out infinite" }} />
                  {t("journal.responding")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (liveReplyTimerRef.current) clearTimeout(liveReplyTimerRef.current);
                    setLiveReplyPending(false);
                  }}
                  style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", textDecoration: "underline" }}
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: "6px" }}>
              {voiceSupported && (
              <button
                type="button"
                onClick={() => toggleVoice()}
                title={isRecording ? t("journal.stop") : t("journal.speak")}
                aria-label={isRecording ? t("journal.stopRecording") : t("journal.dictate")}
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
                  animation: isRecording ? "voicePulse 1.4s ease-in-out infinite" : "none",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              )}
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

          {isRecording && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "0 4px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-sage)", flexShrink: 0, animation: "voicePulse 1.4s ease-in-out infinite" }} />
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.4, fontStyle: interimVoice ? "italic" : "normal" }}>
                {interimVoice || l("Ouvindo… pode falar, eu escrevo pra você.", "Listening… go ahead, I'll write it down for you.")}
              </p>
            </div>
          )}
          <style>{`@keyframes voicePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>

          <button
            type="button"
            onClick={() => void finalizeSession()}
            disabled={!sessionId || isFinalizing}
            style={{
              display: "block",
              width: "auto",
              margin: "10px auto 0",
              background: "none",
              border: "none",
              padding: "4px 0",
              color: "var(--text-3)",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: ".03em",
              cursor: !sessionId || isFinalizing ? "default" : "pointer",
              opacity: !sessionId || isFinalizing ? 0.4 : 0.7,
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textUnderlineOffset: "3px",
            }}
          >
            {isFinalizing ? l("Salvando...", "Saving...") : l("encerrar e salvar sessão", "end and save session")}
          </button>
        </div>
      </div>
      {finalizationModal}
    </div>
  );
}

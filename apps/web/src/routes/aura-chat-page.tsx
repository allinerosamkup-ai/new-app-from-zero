import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { SafetyProtocolCard, type RiskSafety } from "../components/aura/SafetyProtocolCard";
import { useToast } from "../components/Toast";
import { useAuraStore } from "../features/aura/store";
import i18n from "../i18n";
import { api, getClientTimeContext, getAdaptiveSnapshot } from "../lib/api";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/track";
import { buildTimelineBlocks, buildTimelineSyncRequests, formatTimelineBlock, type TimelineBlock } from "./aura-chat-page.helpers";
import "../styles/aura.css";
import { computeMoodCycle } from "../utils/mood-cycle-engine";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AuraCommandIntent =
  | "planner_task"
  | "checklist"
  | "goal_project"
  | "agenda_plan"
  | "clarify"
  | "reflective_handoff";

type AuraCommandAction =
  | "create_task"
  | "create_checklist"
  | "create_goal"
  | "create_agenda"
  | "ask_clarification"
  | "handoff_to_journal"
  | "update_task"
  | "delete_task"
  | "complete_items";

type AuraCommandResponse = {
  assistantMessage: string;
  intent: AuraCommandIntent;
  action: AuraCommandAction;
  payload: Record<string, unknown>;
  needsConfirmation: boolean;
  needsClarification: boolean;
  clarifyingQuestion: string | null;
  riskSafety?: RiskSafety;
};

type ActionCard = {
  eyebrow: string;
  title: string;
  items: string[];
  ctaLabel?: string;
  ctaPath?: string;
};

type PendingTaskConfirmation = {
  blocks: TimelineBlock[];
};

type AuraRouteState = {
  initialPrompt?: string;
  contextLabel?: string;
  mode?: "conversation" | "executor";
  autoSend?: boolean;
};

const QUICK_ACTIONS: Array<{ labelKey: string; fallback: string; prompt: string }> = [
  { labelKey: "aura.suggestions.organizeDay", fallback: "Organizar pela energia", prompt: "Organize meu dia de acordo com minha energia atual e com o que já existe no planner." },
  { labelKey: "aura.suggestions.transformGoal", fallback: "Meta em passos", prompt: "Transforme minha meta ativa mais importante em próximos passos possíveis para esta semana." },
  { labelKey: "aura.suggestions.patterns", fallback: "Ler últimos dias", prompt: "O que meus últimos dias mostram sobre humor, energia, sono e execução?" },
  { labelKey: "aura.suggestions.falling", fallback: "Estou caindo", prompt: "Estou caindo, com baixa energia e risco de travar. O que eu faço agora sem me violentar?" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractStringList(source: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;

    const items = value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (!isRecord(entry)) return null;
        return pickString(entry, ["title", "text", "name", "label", "task"]);
      })
      .filter((item): item is string => Boolean(item));

    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

function buildObjectiveInput(payload: Record<string, unknown>, fallbackTitle: string) {
  const title =
    pickString(payload, ["title", "goalTitle", "name", "text"]) ??
    fallbackTitle;
  const items = extractStringList(payload, ["subtasks", "checklist", "items", "steps", "tasks", "subgoals"]);

  return {
    title,
    subgoals: items.map((item, index) => ({
      id: `aura-${Date.now()}-${index}`,
      title: item,
      done: false,
      aiGenerated: true,
    })),
  };
}

function buildInitialAssistantMessage(initialPrompt: string, contextLabel: string, mode: "conversation" | "executor") {
  if (!initialPrompt) {
    return i18n.t("aura.initialIdle", "Me diga o que precisa sair da cabeça e virar próximo passo.");
  }

  if (mode !== "conversation") {
    return i18n.t("aura.initialExecutor", "Me diga a ação e eu executo direto.");
  }

  const label = contextLabel.toLowerCase();
  if (label.includes("próxima ação") || label.includes("proxima acao")) {
    return i18n.t("aura.initialNextAction", "Essa ação veio da sua meta. Posso te explicar o que ela quer dizer e te dar ideias simples para começar.");
  }

  if (label.includes("planner") || label.includes("agenda") || label.includes("tarefa")) {
    return i18n.t("aura.initialPlanner", "Essa tarefa já veio com contexto. Posso te explicar o que ela significa e como fazer de um jeito simples.");
  }

  return i18n.t("aura.initialContext", "O contexto já está aqui. Qual parte você quer destravar primeiro?");
}

export function AuraChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, refreshData } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);
  const routeState = location.state as AuraRouteState | null;
  const initialPrompt = typeof routeState?.initialPrompt === "string" ? routeState.initialPrompt : "";
  const contextLabel = typeof routeState?.contextLabel === "string" ? routeState.contextLabel : "";
  const routeMode = routeState?.mode === "conversation" ? "conversation" : "executor";
  const autoSend = routeState?.autoSend === true;

  // Persistência: sessão da Aura central sobrevive a navegações dentro do app
  const STORAGE_KEY_MESSAGES = "airia-aura-central-messages";
  const STORAGE_KEY_SESSION = "airia-aura-central-session";

  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialPrompt) {
      // Novo prompt vindo de outra rota — começa fresca
      return [{
        role: "assistant",
        content: buildInitialAssistantMessage(initialPrompt, contextLabel, routeMode),
      }];
    }
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Message[];
      }
    } catch { /* ignore */ }
    return [{
      role: "assistant",
      content: buildInitialAssistantMessage(initialPrompt, contextLabel, routeMode),
    }];
  });

  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (initialPrompt) return null;
    try {
      return sessionStorage.getItem(STORAGE_KEY_SESSION);
    } catch {
      return null;
    }
  });

  // Persistir messages e sessionId em sessionStorage sempre que mudarem
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch { /* ignore quota errors */ }
  }, [messages]);

  useEffect(() => {
    try {
      if (sessionId) sessionStorage.setItem(STORAGE_KEY_SESSION, sessionId);
    } catch { /* ignore */ }
  }, [sessionId]);
  const [input, setInput] = useState(autoSend ? "" : initialPrompt);
  const [isTyping, setIsTyping] = useState(false);
  const [actionCard, setActionCard] = useState<ActionCard | null>(null);
  const [lastRiskSafety, setLastRiskSafety] = useState<RiskSafety | null>(null);
  const [pendingTaskConfirmation, setPendingTaskConfirmation] = useState<PendingTaskConfirmation | null>(null);
  const [isApplyingPendingAction, setIsApplyingPendingAction] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Se já tem sessão persistida, reusa — não cria nova
    if (sessionId) return;

    let isMounted = true;

    api.post("/aura/command/start", { moodCycleContext: cycleReport.aiContext })
      .then((res: any) => {
        if (!isMounted) return;
        setSessionId(res.sessionId);
      })
      .catch((error) => {
        if (!isMounted) return;
        showError(error instanceof Error ? error.message : "Não foi possível iniciar a Airia agora.");
      });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-send quando a rotina automática é acionada da Home
  const autoSendFiredRef = useRef(false);
  useEffect(() => {
    if (!autoSend || !initialPrompt || !sessionId || isTyping || autoSendFiredRef.current) return;
    autoSendFiredRef.current = true;
    send(initialPrompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, initialPrompt, sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, actionCard, pendingTaskConfirmation]);

  async function syncTimelineBlocks(blocks: TimelineBlock[]) {
    for (const request of buildTimelineSyncRequests(blocks)) {
      await api.post("/timeline", request);
    }

    await refreshData();
  }

  async function createObjectiveFromPayload(
    payload: Record<string, unknown>,
    fallbackTitle: string,
  ) {
    const objective = buildObjectiveInput(payload, fallbackTitle);

    await api.post("/objectives", {
      title: objective.title,
      category: typeof payload.category === "string" ? payload.category : "geral",
      subgoals: objective.subgoals,
    });
    await refreshData();

    return objective;
  }

  async function executeAuraAction(response: AuraCommandResponse): Promise<string | null> {
    try {
      if (response.action === "create_task" || response.action === "create_agenda") {
        const blocks = buildTimelineBlocks(response.payload);
        if (blocks.length === 0) {
          return "Ainda não consegui transformar isso em datas reais no planner. Me diga os dias da semana e o horário, ou peça para eu revisar a recorrência.";
        }

        if (response.needsConfirmation) {
          setPendingTaskConfirmation({ blocks });
          return null;
        }

        await syncTimelineBlocks(blocks);
        const isMultiple = blocks.length > 1 || response.action === "create_agenda";
        setActionCard({
          eyebrow: isMultiple ? "Agenda criada" : "Planner atualizado",
          title: isMultiple ? `${blocks.length} bloco${blocks.length > 1 ? "s" : ""} organizados` : "1 tarefa criada",
          items: blocks.slice(0, 4).map(formatTimelineBlock),
          ctaLabel: "Ver planner",
          ctaPath: "/planner",
        });
        showSuccess(isMultiple ? "Agenda enviada para o planner." : "Tarefa adicionada ao planner.");
        return null;
      }

      if (response.action === "create_goal") {
        const objective = await createObjectiveFromPayload(response.payload, "Nova meta da Airia");
        setActionCard({
          eyebrow: "Meta criada",
          title: objective.title,
          items: objective.subgoals.slice(0, 4).map((item) => item.title),
          ctaLabel: "Abrir metas",
          ctaPath: "/goals",
        });
        showSuccess("Meta adicionada.");
        return null;
      }

      if (response.action === "create_checklist") {
        const checklist = await createObjectiveFromPayload(response.payload, "Checklist da Airia");
        setActionCard({
          eyebrow: "Checklist criado",
          title: checklist.title,
          items: checklist.subgoals.slice(0, 4).map((item) => item.title),
          ctaLabel: "Abrir metas",
          ctaPath: "/goals",
        });
        showSuccess("Checklist criado.");
        return null;
      }

      if (response.action === "handoff_to_journal") {
        const summary =
          pickString(response.payload, ["journalSummary", "summary"]) ??
          "Resumo salvo no diário a partir desta conversa.";
        const themes = extractStringList(response.payload, ["journalThemes", "themes"]).slice(0, 2);

        setActionCard({
          eyebrow: "Resumo salvo no diário",
          title: "Conversa registrada",
          items: [
            summary,
            ...themes.map((theme) => `Tema: ${theme}`),
          ],
        });
        showSuccess("Resumo salvo no diário.");
        return null;
      }

      if (response.action === "complete_items") {
        const items = Array.isArray(response.payload.items) ? response.payload.items as Array<{ title: string; type: string }> : [];
        if (items.length === 0) return null;

        const result = await api.post("/aura/complete-report", {
          items,
          localDate: new Date().toISOString().slice(0, 10),
          moodCycleContext: response.payload.moodCycleContext ?? null,
        }) as { matched: string[]; created: string[]; evaluation: string };

        const matched: string[] = Array.isArray(result.matched) ? result.matched : [];
        const created: string[] = Array.isArray(result.created) ? result.created : [];
        const evaluation: string = typeof result.evaluation === "string" ? result.evaluation : "";
        const confirmationLines = [
          ...matched.map((t: string) => `✓ ${t}`),
          ...created.map((t: string) => `+ ${t} (criada como concluída)`),
        ];

        setActionCard({
          eyebrow: "Registrado",
          title: `${matched.length + created.length} item${matched.length + created.length !== 1 ? "s" : ""} marcado${matched.length + created.length !== 1 ? "s" : ""} como feito`,
          items: confirmationLines.slice(0, 4),
          ctaLabel: "Ver planner",
          ctaPath: "/planner",
        });

        return evaluation ?? null;
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível executar o pedido.";
      if (message.toLowerCase().includes("conflitos de horário")) {
        return "Encontrei conflito de horário no planner. Se quiser, eu reorganizo isso em outro horário.";
      }

      throw error;
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !sessionId || isTyping) return;

    const history = messages.slice(-12).map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const userMessage: Message = { role: "user", content: trimmed };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    setActionCard(null);
    setLastRiskSafety(null);
    setPendingTaskConfirmation(null);

    try {
      const { data: { session: auth } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/aura/command/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: trimmed,
          history,
          moodCycleContext: cycleReport.aiContext,
          mode: routeMode,
          ...getClientTimeContext(),
          ...getAdaptiveSnapshot(),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("A Airia não conseguiu processar esse pedido agora.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completedResponse: AuraCommandResponse | null = null;
      let buffered = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffered += decoder.decode(value, { stream: true });
        const frames = buffered.split("\n\n");
        buffered = frames.pop() ?? "";

        for (const frame of frames) {
          const dataLine = frame
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (!dataLine) continue;

          const data = JSON.parse(dataLine.slice(6));
          if (data.response) {
            completedResponse = data.response as AuraCommandResponse;
          } else if (data.error) {
            throw new Error(typeof data.error === "string" ? data.error : "Falha no stream da Airia.");
          }
        }
      }

      if (!completedResponse) {
        throw new Error("A Airia não conseguiu interpretar esse pedido.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: completedResponse!.assistantMessage },
      ]);

      const riskSafety = completedResponse.riskSafety ?? null;
      setLastRiskSafety(riskSafety);
      if (riskSafety?.route === "human_support" || riskSafety?.route === "crisis_protocol") {
        trackEvent("risk_protocol_triggered", {
          surface: "aura_chat",
          action: "protocol_shown",
          riskLevel: riskSafety.riskLevel,
          route: riskSafety.route,
          signals: riskSafety.signals ?? [],
        });
      }

      const executionFollowUp = await executeAuraAction(completedResponse);
      if (executionFollowUp) {
        setMessages((prev) => [...prev, { role: "assistant", content: executionFollowUp }]);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível conversar com a Airia agora.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Tive um problema para executar isso agora. Se quiser, tente me pedir de novo com um pouco mais de detalhe." },
      ]);
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

    const recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        inputRef.current?.focus();
      }
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }

  async function confirmPendingTask() {
    if (!pendingTaskConfirmation || isApplyingPendingAction) return;

    setIsApplyingPendingAction(true);
    try {
      await syncTimelineBlocks(pendingTaskConfirmation.blocks);
      const total = pendingTaskConfirmation.blocks.length;
      setActionCard({
        eyebrow: total > 1 ? "Agenda confirmada" : "Compromisso confirmado",
        title: total > 1 ? `${total} compromissos salvos` : "1 compromisso salvo",
        items: pendingTaskConfirmation.blocks.slice(0, 6).map(formatTimelineBlock),
        ctaLabel: "Abrir planner",
        ctaPath: "/planner",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: total > 1
            ? "Pronto. Deixei esses compromissos salvos no seu planner."
            : "Pronto. Deixei esse compromisso salvo no seu planner.",
        },
      ]);
      setPendingTaskConfirmation(null);
      showSuccess(total > 1 ? "Compromissos confirmados." : "Compromisso confirmado.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível confirmar o compromisso.");
    } finally {
      setIsApplyingPendingAction(false);
    }
  }

  function cancelPendingTask() {
    if (!pendingTaskConfirmation || isApplyingPendingAction) return;

    setPendingTaskConfirmation(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Tudo bem, não salvei esse compromisso. Se quiser, eu ajusto horário ou detalhes." },
    ]);
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--warm-bg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 10px",
          background: "rgba(255,255,255,.64)",
          borderBottom: "1px solid rgba(255,255,255,.84)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--accent-peach)",
                margin: "0 0 4px",
              }}
            >
              {t("aura.kicker", "Comando central")}
            </p>
            <p
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text-1)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                margin: 0,
              }}
            >
              Airia
            </p>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
            {sessionId ? t("aura.ready") : t("aura.starting")}
          </p>
        </div>
      </div>

      <div style={{ padding: "10px 16px", display: "flex", gap: 6, overflowX: "auto" }}>
        {QUICK_ACTIONS.map((action) => (
          <AuraButtonV2
            key={action.labelKey}
            onClick={() => send(action.prompt)}
            disabled={isTyping || !sessionId}
            variant="glass"
            size="sm"
            style={{
              flexShrink: 0,
              whiteSpace: "nowrap",
              color: "var(--accent-peach-ink)",
            }}
          >
            {t(action.labelKey, action.fallback)}
          </AuraButtonV2>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 8px" }}>
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            style={{
              display: "flex",
              justifyContent: message.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            {message.role === "assistant" && (
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--terracotta)",
                  flexShrink: 0,
                  marginRight: 10,
                  marginTop: 12,
                  boxShadow: "0 0 0 4px rgba(243,176,140,.14)",
                }}
              />
            )}
            <div
              style={{
                maxWidth: "min(92%, 440px)",
                padding: "9px 13px",
                borderRadius: message.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: message.role === "user" ? "rgba(243,176,140,.58)" : "rgba(255,255,255,.68)",
                color: message.role === "user" ? "#fff" : "var(--text-1)",
                fontSize: 13.5,
                lineHeight: 1.55,
                boxShadow:
                  message.role === "user"
                    ? "0 10px 24px rgba(243,176,140,.18)"
                    : "0 10px 24px rgba(243,176,140,.08)",
                border: "1px solid rgba(255,255,255,.82)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                backdropFilter: "blur(18px)",
                overflowWrap: "anywhere",
                whiteSpace: "pre-wrap",
              }}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--terracotta)",
                flexShrink: 0,
                marginRight: 10,
                marginTop: 12,
                boxShadow: "0 0 0 4px rgba(243,176,140,.14)",
              }}
            />
            <div
              style={{
                maxWidth: "min(92%, 440px)",
                padding: "9px 13px",
                borderRadius: "16px 16px 16px 4px",
                background: "rgba(255,255,255,.68)",
                color: "var(--text-2)",
                fontSize: 13.5,
                lineHeight: 1.55,
                boxShadow: "0 10px 24px rgba(243,176,140,.08)",
                border: "1px solid rgba(255,255,255,.82)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                backdropFilter: "blur(18px)",
                fontStyle: "italic",
              }}
            >
              processando pedido...
            </div>
          </div>
        )}

        {actionCard && (
          <div
            style={{
              margin: "6px 0 10px 33px",
              background: "rgba(255,255,255,.68)",
              border: "1px solid rgba(255,255,255,.84)",
              borderRadius: 18,
              padding: "12px 14px",
              boxShadow: "0 12px 24px rgba(243,176,140,.08)",
              backdropFilter: "blur(18px)",
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--accent-peach)",
                margin: "0 0 8px",
              }}
            >
              {actionCard.eyebrow}
            </p>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-1)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {actionCard.title}
            </p>
            {actionCard.items.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: actionCard.ctaPath ? 12 : 0 }}>
                {actionCard.items.map((item) => (
                  <p
                    key={item}
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      color: "var(--text-2)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    {item}
                  </p>
                ))}
              </div>
            )}
            {actionCard.ctaPath && actionCard.ctaLabel && (
              <AuraButtonV2
                onClick={() => navigate(actionCard.ctaPath!)}
                variant="primary"
                size="sm"
                style={{ width: "100%" }}
              >
                {actionCard.ctaLabel}
              </AuraButtonV2>
            )}
          </div>
        )}

        <div style={{ margin: lastRiskSafety && lastRiskSafety.route !== "self_support" ? "6px 0 10px 33px" : 0 }}>
          <SafetyProtocolCard
            riskSafety={lastRiskSafety}
            surface="aura_chat"
            onAdaptDay={() => navigate("/planner", { state: { openAgendaAdaptation: true } })}
          />
        </div>

        {pendingTaskConfirmation && (
          <div
            style={{
              margin: "6px 0 10px 33px",
              background: "rgba(255,255,255,.72)",
              border: "1px solid rgba(255,255,255,.84)",
              borderRadius: 18,
              padding: "12px 14px",
              boxShadow: "0 12px 24px rgba(243,176,140,.08)",
              backdropFilter: "blur(18px)",
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--accent-peach)",
                margin: "0 0 8px",
              }}
            >
              Confirmar compromisso
            </p>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-1)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Revise antes de salvar
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {pendingTaskConfirmation.blocks.map((block) => (
                <p
                  key={`${block.title}-${block.date}-${block.startTime}`}
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    color: "var(--text-2)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {formatTimelineBlock(block)}
                </p>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <AuraButtonV2
                onClick={cancelPendingTask}
                disabled={isApplyingPendingAction}
                variant="glass"
                size="sm"
                style={{ flex: 1 }}
              >
                Cancelar
              </AuraButtonV2>
              <AuraButtonV2
                onClick={confirmPendingTask}
                disabled={isApplyingPendingAction}
                variant="primary"
                size="sm"
                style={{ flex: 1 }}
              >
                {isApplyingPendingAction ? "Salvando..." : "Confirmar"}
              </AuraButtonV2>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div
        style={{
          padding: "10px 16px 20px",
          background: "rgba(255,255,255,.66)",
          borderTop: "1px solid rgba(255,255,255,.84)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            background: "rgba(255,255,255,.68)",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,.82)",
            padding: "6px 6px 6px 14px",
            boxShadow: "0 12px 24px rgba(243,176,140,.08)",
            backdropFilter: "blur(18px)",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder={t("aura.placeholder")}
            rows={3}
            style={{
              flex: 1,
              minHeight: 62,
              border: "none",
              outline: "none",
              resize: "none",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13.5,
              color: "var(--text-1)",
              background: "transparent",
              lineHeight: 1.5,
              maxHeight: 180,
              overflowY: "auto",
            }}
          />
          <AuraButtonV2
            onClick={toggleVoice}
            title={isRecording ? "Parar microfone" : "Ditado por voz"}
            variant={isRecording ? "primary" : "glass"}
            size="sm"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 150ms",
              color: isRecording ? "#fff" : "var(--text-2)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isRecording ? "#fff" : "var(--text-2)"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </AuraButtonV2>
          <AuraButtonV2
            onClick={() => send(input)}
            disabled={!input.trim() || isTyping || !sessionId}
            variant="primary"
            size="sm"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              flexShrink: 0,
              border: "none",
              cursor: (!input.trim() || isTyping || !sessionId) ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 150ms",
              opacity: (!input.trim() || isTyping || !sessionId) ? 0.45 : 1,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={(!input.trim() || isTyping || !sessionId) ? "var(--accent-peach)" : "#fff"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </AuraButtonV2>
        </div>
      </div>
    </div>
  );
}

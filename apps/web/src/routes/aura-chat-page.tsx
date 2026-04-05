import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
import { useToast } from "../components/Toast";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import "../styles/aura.css";
import { computeMoodCycle } from "../utils/mood-cycle-engine";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
  | "handoff_to_journal";

type AuraCommandResponse = {
  assistantMessage: string;
  intent: AuraCommandIntent;
  action: AuraCommandAction;
  payload: Record<string, unknown>;
  needsClarification: boolean;
  clarifyingQuestion: string | null;
};

type TimelineBlock = {
  title: string;
  startTime: string;
  endTime: string;
  category: "trabalho" | "pessoal" | "autocuidado" | "social" | "outro";
  intensity: "L" | "M" | "P";
};

type ActionCard = {
  eyebrow: string;
  title: string;
  items: string[];
  ctaLabel?: string;
  ctaPath?: string;
};

const QUICK_ACTIONS = [
  { label: "Organizar meu dia", prompt: "Organize meu dia de hoje no planner." },
  { label: "Criar checklist", prompt: "Crie um checklist para preparar minha semana." },
  { label: "Transformar em meta", prompt: "Quero transformar voltar a treinar em uma meta com próximos passos." },
  { label: "Abrir conversa reflexiva", prompt: "Quero conversar sobre o que estou sentindo hoje." },
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

function normalizeCategory(category?: string): TimelineBlock["category"] {
  const value = (category ?? "pessoal").trim().toLowerCase();

  if (value === "trabalho") return "trabalho";
  if (value === "social") return "social";
  if (value === "autocuidado" || value === "saude" || value === "saúde") return "autocuidado";
  if (value === "geral" || value === "rotina" || value === "pessoal") return "pessoal";
  return "outro";
}

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value === "string" && TIME_PATTERN.test(value.trim())) {
    return value.trim();
  }

  return fallback;
}

function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHours = Math.floor(normalized / 60);
  const nextMinutes = normalized % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function normalizeIntensity(value: unknown): TimelineBlock["intensity"] {
  if (typeof value !== "string") return "M";

  const normalized = value.trim().toUpperCase();
  if (normalized === "L" || normalized === "M" || normalized === "P") {
    return normalized;
  }

  if (normalized.startsWith("LEVE")) return "L";
  if (normalized.startsWith("PES")) return "P";
  return "M";
}

function buildTimelineBlocks(payload: Record<string, unknown>): TimelineBlock[] {
  const collection =
    ["items", "tasks", "blocks", "agenda", "entries"]
      .map((key) => payload[key])
      .find(Array.isArray) ?? null;

  if (Array.isArray(collection) && collection.length > 0) {
    return collection
      .map((entry, index) => {
        if (!isRecord(entry)) return null;

        const defaultStart = addMinutes("09:00", index * 60);
        const title = pickString(entry, ["title", "text", "name"]);
        if (!title) return null;

        const startTime = normalizeTime(entry.startTime ?? entry.time ?? entry.at, defaultStart);
        const endTime = normalizeTime(entry.endTime, addMinutes(startTime, 60));

        return {
          title,
          startTime,
          endTime,
          category: normalizeCategory(
            typeof entry.category === "string" ? entry.category : undefined,
          ),
          intensity: normalizeIntensity(entry.intensity),
        } satisfies TimelineBlock;
      })
      .filter((entry): entry is TimelineBlock => Boolean(entry));
  }

  const title = pickString(payload, ["title", "taskTitle", "name", "text"]);
  if (!title) return [];

  const startTime = normalizeTime(payload.time ?? payload.startTime ?? payload.at, "09:00");
  const endTime = normalizeTime(payload.endTime, addMinutes(startTime, 60));

  return [{
    title,
    startTime,
    endTime,
    category: normalizeCategory(typeof payload.category === "string" ? payload.category : undefined),
    intensity: normalizeIntensity(payload.intensity),
  }];
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

function formatTimelineBlock(block: TimelineBlock): string {
  return `${block.title}${block.startTime ? ` · ${block.startTime}` : ""}`;
}

export function AuraChatPage() {
  const navigate = useNavigate();
  const { state, refreshData } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);

  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content:
      "Tudo pronto por aqui. Se quiser organizar o dia ou apenas descarregar o que está na mente, estou te ouvindo.",
  }]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [actionCard, setActionCard] = useState<ActionCard | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let isMounted = true;

    api.post("/aura/command/start", { moodCycleContext: cycleReport.aiContext })
      .then((res: any) => {
        if (!isMounted) return;
        setSessionId(res.sessionId);
      })
      .catch((error) => {
        if (!isMounted) return;
        showError(error instanceof Error ? error.message : "Não foi possível iniciar a Aura agora.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, actionCard]);

  async function syncTimelineBlocks(blocks: TimelineBlock[]) {
    const today = new Date().toISOString().split("T")[0];
    await api.post("/timeline", {
      date: today,
      blocks: blocks.map((block) => ({
        title: block.title,
        startTime: block.startTime,
        endTime: block.endTime,
        category: block.category,
        intensity: block.intensity,
      })),
    });
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
      if (response.action === "create_task") {
        const blocks = buildTimelineBlocks(response.payload);
        if (blocks.length === 0) return null;

        await syncTimelineBlocks([blocks[0]]);
        setActionCard({
          eyebrow: "Planner atualizado",
          title: "1 tarefa criada",
          items: [formatTimelineBlock(blocks[0])],
          ctaLabel: "Abrir planner",
          ctaPath: "/planner",
        });
        showSuccess("Tarefa adicionada ao planner.");
        return null;
      }

      if (response.action === "create_agenda") {
        const blocks = buildTimelineBlocks(response.payload);
        if (blocks.length === 0) return null;

        await syncTimelineBlocks(blocks);
        setActionCard({
          eyebrow: "Agenda criada",
          title: `${blocks.length} bloco${blocks.length > 1 ? "s" : ""} organizados`,
          items: blocks.slice(0, 4).map(formatTimelineBlock),
          ctaLabel: "Ver planner",
          ctaPath: "/planner",
        });
        showSuccess("Agenda enviada para o planner.");
        return null;
      }

      if (response.action === "create_goal") {
        const objective = await createObjectiveFromPayload(response.payload, "Nova meta da Aura");
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
        const checklist = await createObjectiveFromPayload(response.payload, "Checklist da Aura");
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
        setActionCard({
          eyebrow: "Melhor próximo passo",
          title: "Seguir no diário",
          items: ["Esse pedido pede uma conversa mais reflexiva antes de virar ação."],
          ctaLabel: "Abrir diário",
          ctaPath: "/journal",
        });
        return null;
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
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("A Aura não conseguiu processar esse pedido agora.");
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
            throw new Error(typeof data.error === "string" ? data.error : "Falha no stream da Aura.");
          }
        }
      }

      if (!completedResponse) {
        throw new Error("A Aura não conseguiu interpretar esse pedido.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: completedResponse!.assistantMessage },
      ]);

      const executionFollowUp = await executeAuraAction(completedResponse);
      if (executionFollowUp) {
        setMessages((prev) => [...prev, { role: "assistant", content: executionFollowUp }]);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível conversar com a Aura agora.");
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
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      inputRef.current?.focus();
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
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
                color: "var(--nectarine)",
                margin: "0 0 4px",
              }}
            >
              Comando central
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
              Aura
            </p>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
            {sessionId ? "pronta" : "iniciando"}
          </p>
        </div>
      </div>

      <div style={{ padding: "10px 16px", display: "flex", gap: 6, overflowX: "auto" }}>
        {QUICK_ACTIONS.map((action) => (
          <AuraButtonV2
            key={action.label}
            onClick={() => send(action.prompt)}
            disabled={isTyping || !sessionId}
            variant="glass"
            size="sm"
            style={{
              flexShrink: 0,
              whiteSpace: "nowrap",
              color: "var(--nectarine-11)",
            }}
          >
            {action.label}
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
                maxWidth: "76%",
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
                maxWidth: "76%",
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
                color: "var(--nectarine)",
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
            placeholder="O que vamos organizar agora?"
            rows={1}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13.5,
              color: "var(--text-1)",
              background: "transparent",
              lineHeight: 1.5,
              maxHeight: 100,
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
              stroke={(!input.trim() || isTyping || !sessionId) ? "var(--nectarine)" : "#fff"}
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

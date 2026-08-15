import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { CommandPlanCard } from "../components/aura/CommandPlanCard";
import { AiriaMascot } from "../components/airia/AiriaMascot";
import { SafetyProtocolCard, type RiskSafety } from "../components/aura/SafetyProtocolCard";
import { useToast } from "../components/Toast";
import { useAuraStore } from "../features/aura/store";
import { FEATURES } from "../config/features";
import type { AuraCommandExecution, AuraCommandPlan } from "../features/aura/command-types";
import { checkinReceiptFromExecution, shouldRenderCommandPlan } from "../features/aura/command-checkin-receipt";
import i18n from "../i18n";
import { api, getClientTimeContext, getAdaptiveSnapshot } from "../lib/api";
import { sendAiriaDecisionFeedback, useAiriaReading } from "../lib/airia-reading";
import { getCurrentLanguage, resolveIntlLocale, useLocalizedCopy } from "../i18n";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/track";
import {
  buildAuraObjectiveInput,
  buildTimelineBlocks,
  buildTimelineSyncRequests,
  formatTimelineBlock,
  hasSubstantiveRoutineSource,
  type TimelineBlock,
} from "./aura-chat-page.helpers";
import "../styles/aura.css";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import {
  createTranscriptResultHandler,
  releaseRecognition,
  stopActiveRecognition,
  TranscriptSession,
} from "../features/voice/transcript-session";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AuraCommandIntent =
  | "conversation"
  | "planner_task"
  | "checklist"
  | "goal_project"
  | "agenda_plan"
  | "routine_builder"
  | "clarify"
  | "reflective_handoff"
  | "reschedule"
  | "delete_task"
  | "complete_items"
  | "capture"
  | "checkin"
  | "habit"
  | "calendar_event";

type AuraCommandAction =
  | "respond"
  | "create_task"
  | "create_checklist"
  | "create_goal"
  | "create_agenda"
  | "ask_clarification"
  | "handoff_to_journal"
  | "update_task"
  | "delete_task"
  | "complete_items"
  | "log_checkin"
  | "postpone_task"
  | "start_task"
  | "adapt_agenda"
  | "open_screen"
  | "create_capture"
  | "create_checkin"
  | "record_checkin"
  | "create_habit"
  | "create_calendar_event"
  | "start_routine_builder";

type AuraCommandStep = {
  action: AuraCommandAction;
  payload: Record<string, unknown>;
};

type AuraCommandResponse = {
  assistantMessage: string;
  intent: AuraCommandIntent;
  action: AuraCommandAction;
  payload: Record<string, unknown>;
  needsConfirmation: boolean;
  needsClarification: boolean;
  clarifyingQuestion: string | null;
  riskSafety?: RiskSafety;
  /** Ações extras da mesma fala. A Airia executa todas, na ordem. */
  actions?: AuraCommandStep[];
};

type ActionCard = {
  eyebrow: string;
  title: string;
  items: string[];
  ctaLabel?: string;
  ctaPath?: string;
  /** Item criado sozinho pela Airia pode ser desfeito sem abrir outra tela. */
  undo?: { label: string; run: () => Promise<void> };
  /** Retorno visual da conclusão — é o que fecha o ciclo e dá o retorno imediato. */
  reward?: { headline: string; detail: string | null; animation: string; intensity: string };
};

/** Rotina proposta na conversa: a pessoa aceita item a item. */
type RoutineProposal = {
  blocks: TimelineBlock[];
  accepted: number[];
  dismissed: number[];
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

  if (label.includes("agenda") || label.includes("tarefa")) {
    return i18n.t("aura.initialPlanner", "Essa tarefa já veio com contexto. Posso te explicar o que ela significa e como fazer de um jeito simples.");
  }

  return i18n.t("aura.initialContext", "O contexto já está aqui. Qual parte você quer destravar primeiro?");
}

export function AuraChatPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, refreshData } = useAuraStore();
  const { reading: canonicalReading, reload: reloadCanonicalReading } = useAiriaReading();
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
  const [routineProposal, setRoutineProposal] = useState<RoutineProposal | null>(null);
  const l = useLocalizedCopy();
  const [isApplyingPendingAction, setIsApplyingPendingAction] = useState(false);
  const [commandPlan, setCommandPlan] = useState<AuraCommandPlan | null>(null);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const applyKeyRef = useRef<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceInputBaseRef = useRef("");
  const [isRecording, setIsRecording] = useState(false);
  const [canonicalFeedbackPending, setCanonicalFeedbackPending] = useState(false);
  const [canonicalCorrection, setCanonicalCorrection] = useState("");
  const [canonicalCorrectionOpen, setCanonicalCorrectionOpen] = useState(false);

  const sharedRiskSafety = canonicalReading?.riskSafety ?? lastRiskSafety;

  async function feedbackCanonicalDecision(status: "accepted" | "rejected" | "corrected") {
    const decision = canonicalReading?.decision;
    if (!decision || canonicalFeedbackPending) return;
    setCanonicalFeedbackPending(true);
    const saved = await sendAiriaDecisionFeedback(decision.id, status, "aura", canonicalCorrection);
    if (saved) {
      setCanonicalCorrection("");
      setCanonicalCorrectionOpen(false);
      await reloadCanonicalReading();
    }
    setCanonicalFeedbackPending(false);
  }

  useEffect(() => {
    return () => {
      stopActiveRecognition(recognitionRef);
    };
  }, []);

  useEffect(() => {
    // Se já tem sessão persistida, reusa — não cria nova
    if (sessionId) return;

    let isMounted = true;

    api.post("/aura/command/start", {
      moodCycleContext: cycleReport.aiContext,
      locale: resolveIntlLocale(i18n.language),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    })
      .then((res: any) => {
        if (!isMounted) return;
        setSessionId(res.sessionId);
      })
      .catch((error) => {
        if (!isMounted) return;
        showError(error instanceof Error ? error.message : t("aura.errors.start"));
      });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
  }, [messages, isTyping, actionCard, pendingTaskConfirmation, commandPlan]);

  function updatePlanOperation(
    operationId: string,
    patch: { selected?: boolean; payload?: Record<string, unknown> },
  ) {
    setCommandPlan((current) => current ? {
      ...current,
      operations: current.operations.map((operation) =>
        operation.id === operationId ? { ...operation, ...patch } : operation),
    } : current);
  }

  async function syncTimelineBlocks(blocks: TimelineBlock[]) {
    for (const request of buildTimelineSyncRequests(blocks)) {
      await api.post("/timeline", request);
    }

    await refreshData();
  }

  async function createObjectiveFromPayload(
    payload: Record<string, unknown>,
  ) {
    const parsed = buildAuraObjectiveInput(payload);
    if (!parsed) return null;
    const objective = {
      title: parsed.title,
      subgoals: parsed.itemTitles.map((item, index) => ({
        id: `aura-${Date.now()}-${index}`,
        title: item,
        done: false,
        aiGenerated: true,
      })),
    };

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
      if (canonicalReading?.decision) {
        return l("Já existe uma proposta da Airia baseada no seu contexto atual. Você pode confirmar, corrigir ou vetar abaixo antes de abrir outra frente.", "Airia already has a proposal based on your current context. You can confirm, correct, or veto it below before opening another front.");
      }
      if (response.action === "create_task" || response.action === "create_agenda") {
        if (!FEATURES.planner) {
          return l("O Planner está desativado. Vou manter a orientação ligada aos seus Objetivos, sem criar um bloco paralelo.", "Planner is disabled. I will keep this guidance attached to your Goals instead of creating a parallel block.");
        }
        const blocks = buildTimelineBlocks(response.payload);
        if (blocks.length === 0) {
          return t("aura.needDates");
        }

        if (response.needsConfirmation) {
          setPendingTaskConfirmation({ blocks });
          return null;
        }

        // Rotina montada na conversa: a pessoa escolhe o que entra. Item solto
        // entra sozinho — o trabalho de confirmar um bloco não vale o atrito.
        if (blocks.length > 1) {
          setRoutineProposal({ blocks, accepted: [], dismissed: [] });
          return null;
        }

        await syncTimelineBlocks(blocks);
        setActionCard({
          eyebrow: t("aura.plannerUpdated"),
          title: t("aura.oneTaskCreated"),
          items: blocks.map((block) => formatTimelineBlock(block, resolveIntlLocale(i18n.language))),
          ctaLabel: t("aura.viewHome"),
          ctaPath: "/home",
          undo: {
            label: l("Desfazer", "Undo"),
            run: async () => {
              const today = new Date().toISOString().slice(0, 10);
              const current = await api.get(`/timeline/${blocks[0]?.date ?? today}`) as Array<{ id: string; title: string }>;
              const created = current.find((item) => item.title === blocks[0]?.title);
              if (created) await api.delete(`/timeline/${created.id}`);
              await refreshData();
              setActionCard(null);
            },
          },
        });
        showSuccess(t("aura.taskAdded"));
        return null;
      }

      if (response.action === "create_habit") {
        if (!FEATURES.habits) {
          return l("Hábitos está desativado nesta versão. Posso registrar o contexto no Diário ou ligar a ação a um Objetivo.", "Habits is disabled in this version. I can record the context in Journal or attach the action to a Goal.");
        }
        const title = typeof response.payload.title === "string" ? response.payload.title.trim() : "";
        if (!title) return null;
        const daysOfWeek = Array.isArray(response.payload.daysOfWeek)
          ? (response.payload.daysOfWeek as unknown[]).filter((day): day is number => typeof day === "number")
          : [];
        const created = await api.post("/habits", {
          title,
          frequency: response.payload.frequency === "weekly" ? "weekly" : "daily",
          targetDays: daysOfWeek,
          timeOfDay: typeof response.payload.timeOfDay === "string" ? response.payload.timeOfDay : "anytime",
          durationMinutes: typeof response.payload.durationMinutes === "number" ? response.payload.durationMinutes : 15,
          icon: typeof response.payload.icon === "string" ? response.payload.icon : null,
        }) as { id?: string };
        await refreshData();

        setActionCard({
          eyebrow: l("HÁBITO CRIADO", "HABIT CREATED"),
          title,
          items: [],
          ctaLabel: l("Ver hábitos", "See habits"),
          ctaPath: "/habits",
          undo: created?.id
            ? {
                label: l("Desfazer", "Undo"),
                run: async () => {
                  await api.patch(`/habits/${created.id}`, { archived: true });
                  await refreshData();
                  setActionCard(null);
                },
              }
            : undefined,
        });
        return null;
      }

      if (response.action === "start_task") {
        const taskId = typeof response.payload.taskId === "string" ? response.payload.taskId : "";
        if (!taskId) return null;
        // Dizer que começou abre a execução passo a passo, não só registra.
        navigate("/run", {
          state: {
            taskId,
            title: typeof response.payload.title === "string" ? response.payload.title : undefined,
            steps: Array.isArray(response.payload.steps) ? response.payload.steps : undefined,
            checklist: Array.isArray(response.payload.checklist) ? response.payload.checklist : undefined,
          },
        });
        return null;
      }

      if (response.action === "postpone_task") {
        const taskId = typeof response.payload.taskId === "string" ? response.payload.taskId : "";
        if (!taskId) return null;
        const targetDate = typeof response.payload.targetDate === "string" ? response.payload.targetDate : undefined;
        await api.post(`/timeline/${taskId}/postpone`, targetDate ? { targetDate } : {});
        await refreshData();
        setActionCard({
          eyebrow: l("ADIADO", "POSTPONED"),
          title: typeof response.payload.title === "string" ? response.payload.title : l("Movido", "Moved"),
          items: targetDate ? [targetDate] : [],
          ctaLabel: t("aura.viewHome"),
          ctaPath: "/home",
        });
        return null;
      }

      if (response.action === "adapt_agenda") {
        const preview = await api.post("/agenda/adapt", { mode: "apply" }) as {
          appliedChanges?: Array<{ title?: string; reason?: string }>;
        };
        const applied = Array.isArray(preview?.appliedChanges) ? preview.appliedChanges : [];
        await refreshData();
        setActionCard({
          eyebrow: l("AGENDA AJUSTADA", "SCHEDULE ADJUSTED"),
          title: applied.length > 0
            ? l(`${applied.length} ${applied.length === 1 ? "mudança" : "mudanças"} no seu dia`, `${applied.length} change(s) to your day`)
            : l("Seu dia já estava do tamanho certo", "Your day was already the right size"),
          items: applied.slice(0, 4).map((change) => change.title ?? "").filter(Boolean),
          ctaLabel: t("aura.viewHome"),
          ctaPath: "/home",
        });
        return null;
      }

      if (response.action === "open_screen") {
        const screen = typeof response.payload.screen === "string" ? response.payload.screen : "";
        const routes: Record<string, string> = {
          home: "/home", goals: "/goals",
          insights: "/insights", journal: "/journal", checkin: "/checkin",
        };
        if (routes[screen]) navigate(routes[screen]);
        return null;
      }

      if (response.action === "create_goal") {
        const objective = await createObjectiveFromPayload(response.payload);
        if (!objective) return t("aura.needDetails", "Preciso do nome da meta antes de criar.");
        setActionCard({
          eyebrow: t("aura.goalCreated"),
          title: objective.title,
          items: objective.subgoals.slice(0, 4).map((item) => item.title),
          ctaLabel: t("aura.openGoals"),
          ctaPath: "/goals",
        });
        showSuccess(t("aura.goalAdded"));
        return null;
      }

      if (response.action === "create_checklist") {
        const checklist = await createObjectiveFromPayload(response.payload);
        if (!checklist || checklist.subgoals.length === 0) {
          return t("aura.needChecklistDetails", "Preciso do nome e dos itens da checklist antes de criar.");
        }
        setActionCard({
          eyebrow: t("aura.checklistCreated"),
          title: checklist.title,
          items: checklist.subgoals.slice(0, 4).map((item) => item.title),
          ctaLabel: t("aura.openGoals"),
          ctaPath: "/goals",
        });
        showSuccess(t("aura.checklistCreated"));
        return null;
      }

      if (response.action === "handoff_to_journal") {
        const summary =
          pickString(response.payload, ["journalSummary", "summary"]) ??
          t("aura.journalSummary");
        const themes = extractStringList(response.payload, ["journalThemes", "themes"]).slice(0, 2);

        setActionCard({
          eyebrow: t("aura.journalSaved"),
          title: t("aura.conversationSaved"),
          items: [
            summary,
            ...themes.map((theme) => t("aura.theme", { theme })),
          ],
        });
        showSuccess(t("aura.journalSaved"));
        return null;
      }

      if (response.action === "complete_items") {
        const items = Array.isArray(response.payload.items) ? response.payload.items as Array<{ title: string; type: string }> : [];
        if (items.length === 0) return null;

        const result = await api.post("/aura/complete-report", {
          items,
          localDate: new Date().toISOString().slice(0, 10),
          moodCycleContext: response.payload.moodCycleContext ?? null,
        }) as {
          matched: string[]; created: string[]; evaluation: string;
          rewards?: Array<{ headline: string; detail: string | null; animation: string; intensity: string }>;
        };

        const matched: string[] = Array.isArray(result.matched) ? result.matched : [];
        const created: string[] = Array.isArray(result.created) ? result.created : [];
        const evaluation: string = typeof result.evaluation === "string" ? result.evaluation : "";
        const confirmationLines = [
          ...matched.map((t: string) => `✓ ${t}`),
          ...created.map((t: string) => `+ ${t} (criada como concluída)`),
        ];

        const firstReward = Array.isArray(result.rewards) ? result.rewards[0] : undefined;
        setActionCard({
          eyebrow: t("aura.registered"),
          title: firstReward?.headline ?? t("aura.itemsDone", { count: matched.length + created.length }),
          items: confirmationLines.slice(0, 4),
          ctaLabel: t("aura.viewHome"),
          ctaPath: "/home",
          reward: firstReward,
        });

        return evaluation ?? null;
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("aura.errors.execute");
      if (message.toLowerCase().includes("conflitos de horário")) {
        return t("aura.conflict");
      }
      throw error;
    }
  }

  async function applyCommandPlan() {
    if (!commandPlan || isApplyingPlan) return;
    const selectedOperations = commandPlan.operations.filter((operation) => operation.selected && operation.status !== "applied");
    if (selectedOperations.length === 0) return;

    setIsApplyingPlan(true);
    try {
      const patched = await api.patch(`/aura/command/plans/${commandPlan.id}`, {
        operations: commandPlan.operations.map((operation) => ({
          id: operation.id,
          selected: operation.selected,
          payload: operation.payload,
        })),
      }) as { plan: AuraCommandPlan };
      const key = applyKeyRef.current[commandPlan.id]
        ?? `${commandPlan.id}:${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
      applyKeyRef.current[commandPlan.id] = key;
      const applied = await api.post(`/aura/command/plans/${commandPlan.id}/apply`, {
        operationIds: selectedOperations.map((operation) => operation.id),
        idempotencyKey: key,
      }) as { plan: AuraCommandPlan; execution: AuraCommandExecution };
      setCommandPlan(applied.plan ?? patched.plan);
      await refreshData();
      if (applied.execution.status === "applied") {
        showAppliedCheckinReceipt(applied.execution);
        showSuccess(t("aura.commandPlan.success", "Ações aplicadas."));
      } else {
        showError(t("aura.commandPlan.partial", "Algumas ações não foram aplicadas. Veja os detalhes."));
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : t("aura.errors.execute"));
    } finally {
      setIsApplyingPlan(false);
    }
  }

  function showAppliedCheckinReceipt(execution: AuraCommandExecution | null | undefined) {
    const receipt = checkinReceiptFromExecution(execution);
    if (!receipt) return;
    setActionCard({
      eyebrow: l("CHECK-IN REGISTRADO", "CHECK-IN LOGGED"),
      title: receipt.stateLabel ?? l("Anotei como você está agora", "I saved how you are right now"),
      items: [
        l(`Humor ${receipt.moodScore}/10`, `Mood ${receipt.moodScore}/10`),
        l(`Energia ${receipt.energyScore}/10`, `Energy ${receipt.energyScore}/10`),
        receipt.stateSummary ?? "",
      ].filter(Boolean),
      ctaLabel: l("Ajustar check-in", "Adjust check-in"),
      ctaPath: "/checkin",
    });
  }

  function handleNavigationAction(response: AuraCommandResponse) {
    if (response.action !== "start_routine_builder") return;
    const sourceText = typeof response.payload.sourceText === "string" ? response.payload.sourceText : "";
    if (!hasSubstantiveRoutineSource(sourceText)) {
      navigate("/comecar");
      return;
    }
    navigate("/routine-builder", {
      state: {
        initialSource: sourceText,
        focus: typeof response.payload.focus === "string" && response.payload.focus.trim()
          ? response.payload.focus
          : t("routineBuilder.defaultFocus", { defaultValue: "Organizar minha rotina" }),
      },
    });
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
    setCommandPlan(null);
    setLastRiskSafety(null);
    setPendingTaskConfirmation(null);

    try {
      const { data: { session: auth } } = await supabase.auth.getSession();
      const language = getCurrentLanguage();
      const locale = resolveIntlLocale(language);
      const response = await fetch(`${API_URL}/aura/command/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth?.access_token}`,
          "Content-Type": "application/json",
          "Accept-Language": language,
          "Content-Language": language,
        },
        body: JSON.stringify({
          sessionId,
          message: trimmed,
          history,
          moodCycleContext: cycleReport.aiContext,
          mode: routeMode,
          language,
          locale,
          ...getClientTimeContext(),
          ...getAdaptiveSnapshot(),
        }),
      });

      if (response.status === 404) {
        sessionStorage.removeItem(STORAGE_KEY_SESSION);
        setSessionId(null);
        throw new Error(t("aura.errors.sessionExpired", "Reabri a Airia. Envie o pedido mais uma vez."));
      }
      if (!response.ok || !response.body) {
        throw new Error(t("aura.errors.process"));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completedResponse: AuraCommandResponse | null = null;
      let completedPlan: AuraCommandPlan | null = null;
      let completedExecution: AuraCommandExecution | null = null;
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
            completedPlan = data.plan as AuraCommandPlan | null;
            completedExecution = data.execution as AuraCommandExecution | null;
          } else if (data.error) {
            throw new Error(typeof data.error === "string" ? data.error : t("aura.errors.stream"));
          }
        }
      }

      if (!completedResponse) {
        throw new Error(t("aura.errors.interpret"));
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: completedResponse!.assistantMessage },
      ]);
      if (completedPlan) {
        setCommandPlan(completedPlan);
        if (completedExecution?.status === "applied") {
          await refreshData();
          showAppliedCheckinReceipt(completedExecution);
          showSuccess(t("aura.commandPlan.success", "Ações aplicadas."));
        }
      }

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

      // Uma fala pode ter mais de uma ação. A Airia executa todas, na ordem, e a
      // primeira devolutiva não-vazia é a que vira mensagem.
      const steps: AuraCommandResponse[] = [
        completedResponse,
        ...(completedResponse.actions ?? []).map((step) => ({
          ...completedResponse,
          action: step.action,
          payload: step.payload,
          actions: undefined,
        })),
      ];
      const planManagedActions = new Set<AuraCommandAction>([
        "create_task",
        "create_agenda",
        "create_goal",
        "create_checklist",
        "create_capture",
        "create_checkin",
        "record_checkin",
        "create_habit",
        "create_calendar_event",
        "update_task",
        "delete_task",
        "complete_items",
        "handoff_to_journal",
      ]);
      let executionFollowUp: string | null = null;
      for (const step of steps) {
        handleNavigationAction(step);
        if (completedPlan && planManagedActions.has(step.action)) continue;
        const followUp = await executeAuraAction(step);
        if (followUp && !executionFollowUp) executionFollowUp = followUp;
      }
      if (executionFollowUp) {
        setMessages((prev) => [...prev, { role: "assistant", content: executionFollowUp }]);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : t("aura.errors.chat"));
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("aura.retry") },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  async function confirmPendingTask() {
    if (!pendingTaskConfirmation || isApplyingPendingAction) return;

    setIsApplyingPendingAction(true);
    try {
      await syncTimelineBlocks(pendingTaskConfirmation.blocks);
      const total = pendingTaskConfirmation.blocks.length;
      setActionCard({
        eyebrow: total > 1 ? t("aura.scheduleConfirmed") : t("aura.commitmentConfirmed"),
        title: total > 1 ? t("aura.commitmentsSaved", { count: total }) : t("aura.oneCommitmentSaved"),
        items: pendingTaskConfirmation.blocks
          .slice(0, 6)
          .map((block) => formatTimelineBlock(block, resolveIntlLocale(i18n.language))),
        ctaLabel: t("aura.viewHome"),
        ctaPath: "/home",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: total > 1 ? t("aura.savedMany") : t("aura.savedOne"),
        },
      ]);
      setPendingTaskConfirmation(null);
      showSuccess(total > 1 ? t("aura.confirmedMany") : t("aura.confirmedOne"));
    } catch (error) {
      showError(error instanceof Error ? error.message : t("aura.errors.confirm"));
    } finally {
      setIsApplyingPendingAction(false);
    }
  }

  function cancelPendingTask() {
    if (!pendingTaskConfirmation || isApplyingPendingAction) return;

    setPendingTaskConfirmation(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: t("aura.cancelledCommitment") },
    ]);
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (recognitionRef.current) {
      stopActiveRecognition(recognitionRef);
      setIsRecording(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = resolveIntlLocale();
    recognition.continuous = true;
    recognition.interimResults = true;
    const transcriptSession = new TranscriptSession();
    voiceInputBaseRef.current = input;
    recognition.onresult = createTranscriptResultHandler(transcriptSession, (snapshot) => {
      setInput([voiceInputBaseRef.current.trim(), snapshot.text].filter(Boolean).join(" "));
      inputRef.current?.focus();
    });
    recognition.onend = () => {
      transcriptSession.reset();
      if (!releaseRecognition(recognitionRef, recognition)) return;
      setIsRecording(false);
    };
    recognition.onerror = () => {
      transcriptSession.reset();
      if (!releaseRecognition(recognitionRef, recognition)) return;
      setIsRecording(false);
    };
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          {/* Aqui o mascote é a presença da própria Airia na conversa, no lugar
              de um avatar genérico. Fica no cabeçalho porque a lista de
              mensagens rola: um mascote entre balões sairia da tela na primeira
              resposta longa. */}
          <AiriaMascot phase={cycleReport.phase} motion="listen" size={44} decorative />
          <div style={{ flex: 1 }}>
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

      {/* Sem chips de sugestão: a Airia é agente, não menu. A pessoa fala o que
          precisa e ela identifica a intenção e executa. Oferecer quatro atalhos
          prontos ensinava o contrário — que só aquilo ali era possível. */}

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
                  boxShadow: "0 0 0 4px rgba(169,210,187,.14)",
                }}
              />
            )}
            <div
              style={{
                maxWidth: "min(92%, 440px)",
                padding: "9px 13px",
                borderRadius: message.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: message.role === "user" ? "rgba(169,210,187,.58)" : "rgba(255,255,255,.68)",
                color: message.role === "user" ? "#fff" : "var(--text-1)",
                fontSize: 13.5,
                lineHeight: 1.55,
                boxShadow:
                  message.role === "user"
                    ? "0 10px 24px rgba(169,210,187,.18)"
                    : "0 10px 24px rgba(169,210,187,.08)",
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
                boxShadow: "0 0 0 4px rgba(169,210,187,.14)",
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
                boxShadow: "0 10px 24px rgba(169,210,187,.08)",
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
              boxShadow: "0 12px 24px rgba(169,210,187,.08)",
              backdropFilter: "blur(18px)",
            }}
          >
            {actionCard.reward && (
              <div
                className={`aura-reward aura-reward--${actionCard.reward.animation}`}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
              >
                <span aria-hidden="true" style={{ fontSize: actionCard.reward.intensity === "big" ? 22 : 16 }}>
                  {actionCard.reward.animation === "confetti" ? "🎉" : actionCard.reward.animation === "streak" ? "🔥" : "✨"}
                </span>
                {actionCard.reward.detail && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-peach-ink, var(--text-2))" }}>
                    {actionCard.reward.detail}
                  </span>
                )}
              </div>
            )}
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
            <div style={{ display: "flex", gap: 8 }}>
              {actionCard.ctaPath && actionCard.ctaLabel && (
                <AuraButtonV2
                  onClick={() => navigate(actionCard.ctaPath!)}
                  variant="primary"
                  size="sm"
                  style={{ flex: 1 }}
                >
                  {actionCard.ctaLabel}
                </AuraButtonV2>
              )}
              {/* Item que entrou sozinho sai sozinho: desfazer fica aqui, não em
                  outra tela. Sem isso, autonomia vira coisa que a pessoa tem que
                  ir consertar. */}
              {actionCard.undo && (
                <AuraButtonV2
                  onClick={() => { void actionCard.undo!.run(); }}
                  variant="outline"
                  size="sm"
                  style={{ flex: actionCard.ctaPath ? 0 : 1, minWidth: 96 }}
                >
                  {actionCard.undo.label}
                </AuraButtonV2>
              )}
            </div>
          </div>
        )}

        {/* Rotina montada na conversa: cada item é aceito ou descartado aqui, e o
            que entra vai direto para as próximas ações. */}
        {routineProposal && (
          <div
            style={{
              margin: "6px 0 10px 33px",
              background: "rgba(255,255,255,.72)",
              border: "1px solid rgba(255,255,255,.84)",
              borderRadius: 18,
              padding: "12px 14px",
              boxShadow: "0 12px 24px rgba(169,210,187,.08)",
              backdropFilter: "blur(18px)",
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-peach)", margin: "0 0 8px" }}>
              {l("ROTINA MONTADA", "ROUTINE BUILT")}
            </p>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-2)" }}>
              {l("Aceite o que servir. O que você aceitar entra nas suas próximas ações.", "Accept what fits. Whatever you accept goes to your next actions.")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {routineProposal.blocks.map((block, index) => {
                const accepted = routineProposal.accepted.includes(index);
                const dismissed = routineProposal.dismissed.includes(index);
                if (dismissed) return null;
                return (
                  <div key={`${block.title}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-2)", opacity: accepted ? 0.55 : 1 }}>
                      {formatTimelineBlock(block, resolveIntlLocale(i18n.language))}
                    </span>
                    {accepted ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-sage, var(--text-3))" }}>
                        {l("nas próximas ações", "in next actions")}
                      </span>
                    ) : (
                      <>
                        <AuraButtonV2
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            void (async () => {
                              await syncTimelineBlocks([block]);
                              setRoutineProposal((current) => current
                                ? { ...current, accepted: [...current.accepted, index] }
                                : current);
                            })();
                          }}
                        >
                          {l("Aceitar", "Accept")}
                        </AuraButtonV2>
                        <AuraButtonV2
                          size="sm"
                          variant="ghost"
                          onClick={() => setRoutineProposal((current) => current
                            ? { ...current, dismissed: [...current.dismissed, index] }
                            : current)}
                        >
                          {l("Não", "No")}
                        </AuraButtonV2>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <AuraButtonV2
                size="sm"
                variant="primary"
                style={{ flex: 1 }}
                onClick={() => {
                  void (async () => {
                    const pending = routineProposal.blocks.filter((_, index) => (
                      !routineProposal.accepted.includes(index) && !routineProposal.dismissed.includes(index)
                    ));
                    if (pending.length > 0) await syncTimelineBlocks(pending);
                    setRoutineProposal(null);
                    showSuccess(t("aura.agendaSent"));
                  })();
                }}
              >
                {l("Aceitar tudo", "Accept all")}
              </AuraButtonV2>
              <AuraButtonV2 size="sm" variant="ghost" onClick={() => setRoutineProposal(null)}>
                {l("Fechar", "Close")}
              </AuraButtonV2>
            </div>
          </div>
        )}

        {shouldRenderCommandPlan(commandPlan) && commandPlan && (
          <CommandPlanCard
            plan={commandPlan}
            applying={isApplyingPlan}
            onChange={updatePlanOperation}
            onApply={applyCommandPlan}
          />
        )}

        {pendingTaskConfirmation && (
          <div
            style={{
              margin: "6px 0 10px 33px",
              background: "rgba(255,255,255,.72)",
              border: "1px solid rgba(255,255,255,.84)",
              borderRadius: 18,
              padding: "12px 14px",
              boxShadow: "0 12px 24px rgba(169,210,187,.08)",
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
              {l("CONFIRMAR COMPROMISSO", "CONFIRM COMMITMENT")}
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
              {t("goals.reviewBeforeSave")}
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
                  {formatTimelineBlock(block, resolveIntlLocale(i18n.language))}
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
                {t("common.cancel")}
              </AuraButtonV2>
              <AuraButtonV2
                onClick={confirmPendingTask}
                disabled={isApplyingPendingAction}
                variant="primary"
                size="sm"
                style={{ flex: 1 }}
              >
                {isApplyingPendingAction ? l("Salvando...", "Saving...") : l("Confirmar", "Confirm")}
              </AuraButtonV2>
            </div>
          </div>
        )}

        {canonicalReading?.decision && sharedRiskSafety?.route !== "crisis_protocol" && sharedRiskSafety?.route !== "human_support" && (
          <section style={{ margin: "6px 0 10px 33px", padding: 12, borderRadius: 14, border: "1px solid rgba(143,192,164,.34)", background: "rgba(255,255,255,.82)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 800, color: "var(--accent-primary-ink)", textTransform: "uppercase", letterSpacing: ".1em" }}>{l("Proposta atual da Airia", "Airia's current proposal")}</p>
            <p style={{ margin: 0, color: "var(--text-1)", fontWeight: 800, fontSize: 13 }}>{canonicalReading.decision.title}</p>
            <p style={{ margin: "5px 0 9px", color: "var(--text-2)", fontSize: 11.5, lineHeight: 1.45 }}>{canonicalReading.decision.reason}</p>
            {canonicalCorrectionOpen ? <>
              <textarea value={canonicalCorrection} onChange={(event) => setCanonicalCorrection(event.target.value)} rows={2} maxLength={500} placeholder={l("O que precisa mudar?", "What needs to change?")} style={{ width: "100%", boxSizing: "border-box", padding: 8, borderRadius: 9, border: "1px solid var(--warm-border)" }} />
              <AuraButtonV2 className="btn btn-primary btn-full" size="sm" disabled={!canonicalCorrection.trim() || canonicalFeedbackPending} onClick={() => void feedbackCanonicalDecision("corrected")}>{l("Corrigir leitura", "Correct reading")}</AuraButtonV2>
            </> : canonicalReading.decision.requiresConfirmation && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              <AuraButtonV2 className="btn btn-ghost" size="sm" disabled={canonicalFeedbackPending} onClick={() => void feedbackCanonicalDecision("rejected")}>{l("Não agora", "Not now")}</AuraButtonV2>
              <AuraButtonV2 className="btn btn-primary" size="sm" disabled={canonicalFeedbackPending} onClick={() => void feedbackCanonicalDecision("accepted")}>{l("Faz sentido", "That fits")}</AuraButtonV2>
              <AuraButtonV2 className="btn btn-ghost" size="sm" style={{ gridColumn: "1 / -1" }} onClick={() => setCanonicalCorrectionOpen(true)}>{l("Corrigir a Airia", "Correct Airia")}</AuraButtonV2>
            </div>}
          </section>
        )}

        <div style={{ margin: sharedRiskSafety && sharedRiskSafety.route !== "self_support" ? "6px 0 10px 33px" : 0 }}>
          <SafetyProtocolCard
            riskSafety={sharedRiskSafety}
            surface="aura_chat"
            
          />
        </div>

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
            boxShadow: "0 12px 24px rgba(169,210,187,.08)",
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

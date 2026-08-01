import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePause,
  Clock3,
  Edit3,
  Pause,
  Play,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import { useToast } from "../components/Toast";
import { RewardBurst, type Reward } from "../components/RewardBurst";
import { useAuraStore } from "../features/aura/store";
import { useLocalizedCopy } from "../i18n";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import {
  buildGoalCardModel,
  buildGoalTaskSchedule,
  parsePausedGoalIds,
  togglePausedGoalId,
  type GoalTaskPlacement,
} from "../utils/goal-priority-actions";
import "../styles/aura.css";
import "../styles/editorial.css";

type GoalLike = {
  id: string | number;
  title: string;
  completedPct: number;
  subtasks: Array<{ id: string | number; title: string; done: boolean; order?: number; plannerBlockId?: string | null }>;
};

type GoalTemplate = {
  direction: string;
  result: string;
  nextAction: string;
};

type TaskDraft = {
  goalId: string | number;
  goalTitle: string;
  actionId: string | number;
  actionTitle: string;
};

type ScheduledAction = {
  taskId: string | number;
  date: string;
  time: string;
};

const PAUSED_GOALS_KEY = "airia-paused-goals-v1";
const SCHEDULED_ACTIONS_KEY = "airia-goal-action-tasks-v1";

export const GOAL_STARTER_TEMPLATES: GoalTemplate[] = [
  {
    direction: "Minha rotina",
    result: "Ter uma manhã que caiba na minha energia",
    nextAction: "Definir o horário possível de acordar amanhã",
  },
  {
    direction: "Casa",
    result: "Deixar a sala pronta para uso",
    nextAction: "Separar por 15 minutos o que não pertence à sala",
  },
  {
    direction: "Projeto",
    result: "Publicar a primeira versão do meu projeto",
    nextAction: "Listar as três entregas da primeira versão",
  },
  {
    direction: "Saúde",
    result: "Retomar meu acompanhamento de saúde",
    nextAction: "Localizar o contato do profissional ou serviço",
  },
  {
    direction: "Dinheiro",
    result: "Organizar as contas deste mês",
    nextAction: "Reunir as contas que vencem neste mês",
  },
  {
    direction: "Trabalho ou estudo",
    result: "Concluir minha próxima apresentação",
    nextAction: "Escrever os títulos dos três primeiros slides",
  },
];

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,.86)",
  border: "1px solid rgba(99,152,169,.16)",
  borderRadius: 24,
  boxShadow: "0 12px 34px rgba(66,49,43,.06)",
};

const quietButtonStyle: CSSProperties = {
  minHeight: 40,
  border: "1px solid rgba(99,152,169,.22)",
  borderRadius: 999,
  background: "rgba(255,255,255,.72)",
  color: "var(--text-2)",
  padding: "8px 13px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

function readScheduledActions(): Record<string, ScheduledAction> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCHEDULED_ACTIONS_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function actionKey(goalId: string | number, actionId: string | number): string {
  return `${goalId}:${actionId}`;
}

function CreationSheet({
  open,
  saving,
  onClose,
  onCreate,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (result: string) => Promise<void>;
}) {
  const l = useLocalizedCopy();
  const [result, setResult] = useState("");
  const [selectedDirection, setSelectedDirection] = useState("");

  useEffect(() => {
    if (!open) {
      setResult("");
      setSelectedDirection("");
    }
  }, [open]);

  if (!open) return null;

  const ready = result.trim().length >= 3;
  const chooseTemplate = (template: GoalTemplate) => {
    setSelectedDirection(template.direction);
    setResult(template.result);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={l("Criar objetivo", "Create goal")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(26,22,20,.30)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(100%, 560px)",
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: "32px 32px 0 0",
          background: "var(--warm-bg)",
          padding: "18px 18px calc(24px + env(safe-area-inset-bottom))",
          boxShadow: "0 -18px 50px rgba(34,28,25,.16)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ width: 42, height: 4, borderRadius: 99, background: "rgba(26,22,20,.14)", margin: "0 auto 18px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px", color: "var(--lagune)", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" }}>
              {l("Novo objetivo", "New goal")}
            </p>
            <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: 22, lineHeight: 1.2 }}>
              {l("O que você quer tornar real?", "What do you want to make real?")}
            </h2>
          </div>
          <button aria-label={l("Fechar", "Close")} onClick={onClose} style={{ ...quietButtonStyle, width: 40, padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: "0 0 9px", color: "var(--text-2)", fontSize: 13, fontWeight: 700 }}>
          {l("Comece por uma direção", "Start with a direction")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 18 }}>
          {GOAL_STARTER_TEMPLATES.map((template) => {
            const selected = selectedDirection === template.direction;
            return (
              <button
                key={template.direction}
                onClick={() => chooseTemplate(template)}
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  border: selected ? "1.5px solid var(--nectarine)" : "1px solid rgba(99,152,169,.20)",
                  background: selected ? "var(--nectarine-a3)" : "rgba(255,255,255,.78)",
                  color: selected ? "var(--nectarine-11)" : "var(--text-2)",
                  padding: "10px 12px",
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 750,
                  cursor: "pointer",
                }}
              >
                {template.direction}
              </button>
            );
          })}
        </div>

        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ display: "block", marginBottom: 6, color: "var(--text-2)", fontSize: 12, fontWeight: 800 }}>
            {l("Resultado desejado", "Desired result")}
          </span>
          <input
            value={result}
            onChange={(event) => setResult(event.target.value)}
            placeholder={l("Ex.: deixar a sala pronta para uso", "E.g. make the living room ready to use")}
            maxLength={180}
            style={{
              width: "100%",
              minHeight: 48,
              boxSizing: "border-box",
              border: "1.5px solid rgba(99,152,169,.24)",
              borderRadius: 14,
              background: "#fff",
              color: "var(--text-1)",
              padding: "12px 14px",
              fontSize: 15,
              outline: "none",
            }}
          />
        </label>

        <p style={{ margin: "0 0 18px", color: "var(--text-3)", fontSize: 12, lineHeight: 1.45 }}>
          {l("A Airia organiza o caminho em microações e deixa só o primeiro movimento em foco.", "Airia turns this into micro-actions and keeps only the first move in focus.")}
        </p>

        <button
          disabled={!ready || saving}
          onClick={() => ready && onCreate(result.trim())}
          style={{
            width: "100%",
            minHeight: 52,
            border: 0,
            borderRadius: 14,
            background: ready ? "var(--nectarine)" : "rgba(26,22,20,.10)",
            color: ready ? "#fff" : "var(--text-3)",
            fontSize: 14,
            fontWeight: 850,
            cursor: ready && !saving ? "pointer" : "default",
          }}
        >
          {saving ? l("Organizando ações…", "Organizing actions…") : l("Criar caminho com a Airia", "Create path with Airia")}
        </button>
      </div>
    </div>
  );
}

function TaskPlacementSheet({
  draft,
  saving,
  onClose,
  onChoose,
}: {
  draft: TaskDraft | null;
  saving: boolean;
  onClose: () => void;
  onChoose: (placement: GoalTaskPlacement) => Promise<void>;
}) {
  const l = useLocalizedCopy();
  if (!draft) return null;

  const nowSchedule = buildGoalTaskSchedule("now");
  const laterSchedule = buildGoalTaskSchedule("later");
  const options: Array<{ value: GoalTaskPlacement; label: string; detail: string }> = [
    { value: "now", label: l("Agora", "Now"), detail: `${l("hoje", "today")}, ${nowSchedule.time}` },
    { value: "later", label: l("Mais tarde", "Later"), detail: `${l("hoje", "today")}, ${laterSchedule.time}` },
    { value: "tomorrow", label: l("Amanhã", "Tomorrow"), detail: l("às 9h", "at 9 AM") },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={l("Colocar próxima ação no dia", "Place next action in your day")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 125,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(26,22,20,.30)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(100%, 560px)",
          borderRadius: "32px 32px 0 0",
          background: "var(--warm-bg)",
          padding: "18px 18px calc(24px + env(safe-area-inset-bottom))",
          boxShadow: "0 -18px 50px rgba(34,28,25,.16)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ width: 42, height: 4, borderRadius: 99, background: "rgba(26,22,20,.14)", margin: "0 auto 18px" }} />
        <p style={{ margin: "0 0 5px", color: "var(--lagune)", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" }}>
          {l("Próxima ação", "Next action")}
        </p>
        <h2 style={{ margin: "0 0 7px", color: "var(--text-1)", fontSize: 20, lineHeight: 1.3 }}>
          {draft.actionTitle}
        </h2>
        <p style={{ margin: "0 0 18px", color: "var(--text-3)", fontSize: 12 }}>
          {l("Ligada ao resultado:", "Linked to result:")} {draft.goalTitle}
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {options.map((option) => (
            <button
              key={option.value}
              disabled={saving}
              onClick={() => onChoose(option.value)}
              style={{
                minHeight: 58,
                borderRadius: 16,
                border: "1px solid rgba(99,152,169,.22)",
                background: "#fff",
                color: "var(--text-1)",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                textAlign: "left",
                cursor: saving ? "default" : "pointer",
              }}
            >
              <Clock3 size={18} color="var(--lagune)" />
              <span style={{ flex: 1 }}>
                <strong style={{ display: "block", fontSize: 14 }}>{option.label}</strong>
                <span style={{ color: "var(--text-3)", fontSize: 11 }}>{option.detail}</span>
              </span>
              <ArrowRight size={16} color="var(--text-3)" />
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ ...quietButtonStyle, width: "100%", marginTop: 10 }}>
          {l("Voltar sem agendar", "Go back without scheduling")}
        </button>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  paused,
  focused,
  scheduledActions,
  loadingSuggestion,
  suggestionDraft,
  completingActionId,
  onToggleAction,
  onAddAction,
  onRequestSuggestion,
  onAcceptSuggestion,
  onPlanAction,
  onEditResult,
  onPause,
  onArchive,
}: {
  goal: GoalLike;
  paused: boolean;
  focused: boolean;
  scheduledActions: Record<string, ScheduledAction>;
  loadingSuggestion: boolean;
  suggestionDraft: string[];
  completingActionId: string | number | null;
  onToggleAction: (actionId: string | number) => Promise<void>;
  onAddAction: (title: string) => Promise<void>;
  onRequestSuggestion: () => Promise<void>;
  onAcceptSuggestion: (title: string) => Promise<void>;
  onPlanAction: (draft: TaskDraft) => void;
  onEditResult: (title: string) => Promise<void>;
  onPause: () => void;
  onArchive: () => Promise<void>;
}) {
  const l = useLocalizedCopy();
  const model = buildGoalCardModel(goal);
  const [open, setOpen] = useState(focused || !paused);
  const [addingAction, setAddingAction] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [editingResult, setEditingResult] = useState(false);
  const [resultTitle, setResultTitle] = useState(goal.title);
  const [showManagement, setShowManagement] = useState(false);

  useEffect(() => {
    if (focused) setOpen(true);
  }, [focused]);

  const scheduled = model.nextAction
    ? scheduledActions[actionKey(goal.id, model.nextAction.id)]
    : null;
  const orderedActions = [...goal.subtasks]
    .map((action, index) => ({ action, index }))
    .sort((left, right) => (left.action.order ?? left.index) - (right.action.order ?? right.index) || left.index - right.index)
    .map(({ action }) => action);
  const linkedPlannerBlockId = model.nextAction
    ? orderedActions.find((action) => action.id === model.nextAction?.id)?.plannerBlockId
    : null;

  return (
    <article
      id={`goal-${goal.id}`}
      style={{
        ...cardStyle,
        overflow: "hidden",
        opacity: paused ? 0.78 : 1,
        outline: focused ? "2px solid rgba(99,152,169,.34)" : "none",
      }}
    >
      <button
        onClick={() => setOpen((value) => !value)}
        style={{
          width: "100%",
          border: 0,
          background: "transparent",
          padding: "16px 16px 14px",
          display: "flex",
          gap: 12,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          flexShrink: 0,
          background: model.completed ? "rgba(150,199,179,.20)" : "var(--nectarine-a3)",
          display: "grid",
          placeItems: "center",
          color: model.completed ? "var(--menthe)" : "var(--nectarine)",
        }}>
          {model.completed ? <CheckCircle2 size={19} /> : <Target size={19} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", marginBottom: 4, color: "var(--text-3)", fontSize: 10, fontWeight: 850, letterSpacing: ".09em", textTransform: "uppercase" }}>
            {l("Resultado desejado", "Desired result")}
          </span>
          <span style={{ display: "block", color: "var(--text-1)", fontSize: 16, fontWeight: 820, lineHeight: 1.32 }}>
            {goal.title}
          </span>
          <span style={{ display: "block", marginTop: 6, color: model.completed ? "var(--menthe)" : "var(--text-3)", fontSize: 11, fontWeight: 700 }}>
            {model.progressLabel}
          </span>
        </span>
        {open ? <ChevronUp size={18} color="var(--text-3)" /> : <ChevronDown size={18} color="var(--text-3)" />}
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{
            borderRadius: 18,
            border: "1px solid rgba(150,199,179,.34)",
            background: "rgba(150,199,179,.10)",
            padding: "13px",
          }}>
            <p style={{ margin: "0 0 6px", color: "var(--menthe)", fontSize: 10, fontWeight: 900, letterSpacing: ".09em", textTransform: "uppercase" }}>
              {l("Próxima ação", "Next action")}
            </p>

            {model.completed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--text-2)" }}>
                <CheckCircle2 size={20} color="var(--menthe)" />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 720, lineHeight: 1.45 }}>
                  {l("Os movimentos previstos foram concluídos. Este resultado fica guardado como conquista.", "The planned moves are complete. This result is kept as an achievement.")}
                </p>
              </div>
            ) : model.nextAction ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <button
                    aria-label={l("Marcar ação como concluída", "Mark action as completed")}
                    disabled={completingActionId !== null}
                    onClick={() => onToggleAction(model.nextAction!.id)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 9,
                      border: "1.5px solid var(--menthe)",
                      background: "#fff",
                      color: "var(--menthe)",
                      display: "grid",
                      placeItems: "center",
                      cursor: completingActionId === null ? "pointer" : "default",
                      opacity: completingActionId === null ? 1 : 0.55,
                      flexShrink: 0,
                    }}
                  >
                    <Check size={15} />
                  </button>
                  <p style={{ flex: 1, margin: 0, color: "var(--text-1)", fontSize: 14, fontWeight: 750, lineHeight: 1.45 }}>
                    {model.nextAction.title}
                  </p>
                </div>

                {scheduled ? (
                  <div style={{
                    marginTop: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    color: "var(--lagune)",
                    fontSize: 11,
                    fontWeight: 750,
                  }}>
                    <CalendarPlus size={14} />
                    {l("No seu dia em", "In your day on")} {scheduled.date} · {scheduled.time}
                  </div>
                ) : linkedPlannerBlockId ? (
                  <p style={{ margin: "11px 0 0", color: "var(--lagune)", fontSize: 11, fontWeight: 750 }}>
                    <CalendarPlus size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                    {l("Esta ação já está no seu Planner.", "This action is already in your Planner.")}
                  </p>
                ) : (
                  <button
                    onClick={() => onPlanAction({
                      goalId: goal.id,
                      goalTitle: goal.title,
                      actionId: model.nextAction!.id,
                      actionTitle: model.nextAction!.title,
                    })}
                    style={{
                      width: "100%",
                      minHeight: 43,
                      marginTop: 12,
                      border: 0,
                      borderRadius: 13,
                      background: "var(--lagune)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      fontSize: 12,
                      fontWeight: 850,
                      cursor: "pointer",
                    }}
                  >
                    <CalendarPlus size={16} />
                    {l("Colocar no meu dia", "Place in my day")}
                  </button>
                )}
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 11px", color: "var(--text-2)", fontSize: 13, lineHeight: 1.45 }}>
                  {l("Este resultado ainda não tem um passo concreto. Você decide o primeiro; a Airia não inventa por você.", "This result has no concrete step yet. You decide the first one; Airia does not invent it for you.")}
                </p>
                {!addingAction && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setAddingAction(true)} style={{ ...quietButtonStyle, flex: 1 }}>
                      <Plus size={14} /> {l("Definir próxima ação", "Define next action")}
                    </button>
                    <button disabled={loadingSuggestion} onClick={onRequestSuggestion} style={{ ...quietButtonStyle, flex: 1, color: "var(--nectarine-11)", borderColor: "var(--nectarine-a5)" }}>
                      <Sparkles size={14} /> {loadingSuggestion ? l("Pensando…", "Thinking…") : l("Pedir opções à Airia", "Ask Airia for options")}
                    </button>
                  </div>
                )}
              </>
            )}

            {addingAction && (
              <div style={{ marginTop: 10 }}>
                <input
                  autoFocus
                  value={actionTitle}
                  onChange={(event) => setActionTitle(event.target.value)}
                  placeholder={l("Verbo + objeto concreto", "Verb + concrete object")}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    boxSizing: "border-box",
                    border: "1.5px solid rgba(150,199,179,.55)",
                    borderRadius: 12,
                    background: "#fff",
                    padding: "10px 12px",
                    color: "var(--text-1)",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                  <button
                    disabled={actionTitle.trim().length < 3}
                    onClick={async () => {
                      if (actionTitle.trim().length < 3) return;
                      await onAddAction(actionTitle.trim());
                      setActionTitle("");
                      setAddingAction(false);
                    }}
                    style={{
                      ...quietButtonStyle,
                      flex: 1,
                      background: "var(--menthe)",
                      borderColor: "var(--menthe)",
                      color: "#fff",
                      opacity: actionTitle.trim().length < 3 ? 0.45 : 1,
                    }}
                  >
                    {l("Salvar ação", "Save action")}
                  </button>
                  <button onClick={() => setAddingAction(false)} style={quietButtonStyle}>
                    {l("Cancelar", "Cancel")}
                  </button>
                </div>
              </div>
            )}

            {suggestionDraft.length > 0 && !model.nextAction && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: "0 0 7px", color: "var(--text-3)", fontSize: 11, lineHeight: 1.4 }}>
                  {l("Opções para você escolher — nenhuma foi criada ainda:", "Options for you to choose — none have been created yet:")}
                </p>
                <div style={{ display: "grid", gap: 7 }}>
                  {suggestionDraft.slice(0, 3).map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => onAcceptSuggestion(suggestion)}
                      style={{
                        minHeight: 43,
                        borderRadius: 12,
                        border: "1px solid rgba(215,137,127,.30)",
                        background: "#fff",
                        color: "var(--text-1)",
                        padding: "9px 11px",
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {goal.subtasks.length > 1 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", color: "var(--text-3)", fontSize: 11, fontWeight: 750 }}>
                {l("Ver caminho completo", "View full path")} · {model.completedActions}/{model.totalActions}
              </summary>
              <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
                {orderedActions.map((action) => {
                  const active = !action.done && model.nextAction?.id === action.id;
                  const actionable = active && completingActionId === null;
                  return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={!actionable}
                    onClick={() => actionable && onToggleAction(action.id)}
                    style={{
                      border: active ? "1px solid rgba(150,199,179,.55)" : 0,
                      borderRadius: active ? 10 : 0,
                      background: active ? "rgba(150,199,179,.14)" : "transparent",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 9,
                      padding: active ? "8px" : "4px 0",
                      color: action.done ? "var(--text-3)" : "var(--text-2)",
                      textAlign: "left",
                      cursor: actionable ? "pointer" : "default",
                      opacity: action.done || active ? 1 : 0.7,
                    }}
                  >
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      border: action.done ? "1px solid var(--menthe)" : "1px solid rgba(99,152,169,.30)",
                      background: action.done ? "var(--menthe)" : "#fff",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}>
                      {action.done && <Check size={12} />}
                    </span>
                    <span style={{ fontSize: 12, lineHeight: 1.4, textDecoration: action.done ? "line-through" : "none" }}>
                      {action.title}
                      {active ? <small style={{ display: "block", marginTop: 2, color: "var(--menthe)", fontWeight: 800 }}>{l("Agora", "Now")}</small> : null}
                    </span>
                  </button>
                  );
                })}
              </div>
            </details>
          )}

          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowManagement((value) => !value)} style={{ ...quietButtonStyle, width: "100%", minHeight: 36, border: 0, background: "transparent", color: "var(--text-3)" }}>
              {l("Gerenciar objetivo", "Manage goal")}
              {showManagement ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showManagement && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginTop: 6 }}>
                <button onClick={() => setEditingResult(true)} style={{ ...quietButtonStyle, padding: "8px 6px" }}>
                  <Edit3 size={14} /> {l("Editar", "Edit")}
                </button>
                <button onClick={onPause} style={{ ...quietButtonStyle, padding: "8px 6px" }}>
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                  {paused ? l("Retomar", "Resume") : l("Pausar", "Pause")}
                </button>
                <button onClick={onArchive} style={{ ...quietButtonStyle, padding: "8px 6px", color: "var(--nectarine-11)" }}>
                  <Archive size={14} /> {l("Arquivar", "Archive")}
                </button>
              </div>
            )}
          </div>

          {editingResult && (
            <div style={{ marginTop: 10, display: "flex", gap: 7 }}>
              <input
                autoFocus
                value={resultTitle}
                onChange={(event) => setResultTitle(event.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "1.5px solid rgba(99,152,169,.30)",
                  borderRadius: 12,
                  background: "#fff",
                  color: "var(--text-1)",
                  padding: "9px 11px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                onClick={async () => {
                  if (resultTitle.trim().length < 3) return;
                  await onEditResult(resultTitle.trim());
                  setEditingResult(false);
                }}
                style={{ ...quietButtonStyle, background: "var(--lagune)", color: "#fff" }}
              >
                {l("Salvar", "Save")}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function GoalsPage() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    state,
    addGoalWithSubGoals,
    addSubGoals,
    linkGoalActionToPlannerBlock,
    toggleSubGoal,
    removeGoal,
    updateGoal,
    addTask,
  } = useAuraStore();
  const { showError, showSuccess } = useToast();

  const [creationOpen, setCreationOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [pausedOpen, setPausedOpen] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | number | null>(null);
  const [completingActionId, setCompletingActionId] = useState<string | number | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string[]>>({});
  const [pausedIds, setPausedIds] = useState<string[]>(() => {
    try {
      return parsePausedGoalIds(localStorage.getItem(PAUSED_GOALS_KEY));
    } catch {
      return [];
    }
  });
  const [scheduledActions, setScheduledActions] = useState<Record<string, ScheduledAction>>(() => {
    try {
      return readScheduledActions();
    } catch {
      return {};
    }
  });

  const focusedGoalId = (location.state as { openGoalId?: string | number } | null)?.openGoalId;
  const goals = state.goals as unknown as GoalLike[];

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.completedPct < 100 && !pausedIds.includes(String(goal.id))),
    [goals, pausedIds],
  );
  const pausedGoals = useMemo(
    () => goals.filter((goal) => goal.completedPct < 100 && pausedIds.includes(String(goal.id))),
    [goals, pausedIds],
  );
  const completedGoals = useMemo(
    () => goals.filter((goal) => goal.completedPct >= 100),
    [goals],
  );
  const goalsWithAction = activeGoals.filter((goal) => buildGoalCardModel(goal).nextAction).length;

  useEffect(() => {
    localStorage.setItem(PAUSED_GOALS_KEY, JSON.stringify(pausedIds));
  }, [pausedIds]);

  useEffect(() => {
    localStorage.setItem(SCHEDULED_ACTIONS_KEY, JSON.stringify(scheduledActions));
  }, [scheduledActions]);

  useEffect(() => {
    if (!focusedGoalId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`goal-${focusedGoalId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusedGoalId]);

  async function createGoal(result: string) {
    setCreating(true);
    try {
      const response = await api.post("/ai/suggest", {
        type: "goal-subtasks",
        context: { goalTitle: result, existingSubtasks: [] },
      }) as { suggestion?: unknown };
      const parsed = parseAiSuggestion<{ items?: string[] } | string[]>(response.suggestion);
      const actions = (Array.isArray(parsed) ? parsed : parsed?.items ?? [])
        .map((item) => String(item).trim())
        .filter((item, index, all) => item.length >= 3 && all.indexOf(item) === index)
        .slice(0, 5);
      if (actions.length < 2) {
        throw new Error(l("A Airia não conseguiu montar um caminho executável agora.", "Airia could not assemble an executable path right now."));
      }
      await addGoalWithSubGoals(result, actions);
      setCreationOpen(false);
      showSuccess(l("Objetivo criado com o primeiro movimento em foco.", "Goal created with the first move in focus."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível criar o objetivo.", "Could not create the goal."));
    } finally {
      setCreating(false);
    }
  }

  async function requestSuggestion(goal: GoalLike) {
    setLoadingSuggestion(goal.id);
    try {
      const response = await api.post("/ai/suggest", {
        type: "goal-subtasks",
        context: {
          goalTitle: goal.title,
          existingSubtasks: goal.subtasks.map((subtask) => subtask.title),
        },
      }) as { suggestion?: unknown };
      const parsed = parseAiSuggestion<{ items?: string[] } | string[]>(response.suggestion);
      const items = (Array.isArray(parsed) ? parsed : parsed?.items ?? [])
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 3);

      if (items.length === 0) {
        showError(l("A Airia não encontrou uma opção concreta. Defina o primeiro passo com suas palavras.", "Airia did not find a concrete option. Define the first step in your own words."));
        return;
      }
      setSuggestionDrafts((current) => ({ ...current, [String(goal.id)]: items }));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível gerar opções agora.", "Could not generate options right now."));
    } finally {
      setLoadingSuggestion(null);
    }
  }

  async function addAction(goalId: string | number, title: string) {
    try {
      await addSubGoals(goalId, [title]);
      setSuggestionDrafts((current) => ({ ...current, [String(goalId)]: [] }));
      showSuccess(l("Próxima ação adicionada.", "Next action added."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível adicionar a ação.", "Could not add the action."));
    }
  }

  function togglePaused(goalId: string | number) {
    setPausedIds((current) => togglePausedGoalId(current, goalId));
  }

  async function archiveGoal(goal: GoalLike) {
    const confirmed = window.confirm(
      l(
        `Arquivar “${goal.title}”? O histórico fica preservado, mas ele sai dos objetivos ativos.`,
        `Archive “${goal.title}”? Its history is preserved, but it leaves active goals.`,
      ),
    );
    if (!confirmed) return;

    try {
      await removeGoal(goal.id);
      setPausedIds((current) => current.filter((id) => id !== String(goal.id)));
      showSuccess(l("Objetivo arquivado.", "Goal archived."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível arquivar.", "Could not archive."));
    }
  }

  async function placeAction(placement: GoalTaskPlacement) {
    if (!taskDraft) return;
    setScheduling(true);
    try {
      const schedule = buildGoalTaskSchedule(placement);
      const created = await addTask(taskDraft.actionTitle, schedule.time, "objetivo", {
        date: schedule.date,
        note: `${l("Próxima ação de", "Next action for")}: ${taskDraft.goalTitle}`,
      });
      if (!created) throw new Error(l("A tarefa não foi criada.", "The task was not created."));
      await linkGoalActionToPlannerBlock(taskDraft.goalId, taskDraft.actionId, created.id);

      setScheduledActions((current) => ({
        ...current,
        [actionKey(taskDraft.goalId, taskDraft.actionId)]: {
          taskId: created.id,
          date: schedule.date,
          time: schedule.time,
        },
      }));
      setTaskDraft(null);
      showSuccess(l("A próxima ação entrou no seu dia.", "The next action was added to your day."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível colocar a ação no seu dia.", "Could not place the action in your day."));
    } finally {
      setScheduling(false);
    }
  }

  const renderGoal = (goal: GoalLike) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      paused={pausedIds.includes(String(goal.id))}
      focused={focusedGoalId != null && String(focusedGoalId) === String(goal.id)}
      scheduledActions={scheduledActions}
      loadingSuggestion={loadingSuggestion === goal.id}
      suggestionDraft={suggestionDrafts[String(goal.id)] ?? []}
      completingActionId={completingActionId}
      onToggleAction={async (actionId) => {
        if (completingActionId !== null) return;
        setCompletingActionId(actionId);
        try {
          const outcome = await toggleSubGoal(goal.id, actionId);
          if (outcome?.objectiveCompletedNow) {
            setReward({
              headline: l("Objetivo concluído", "Goal completed"),
              detail: l("Você percorreu todas as ações previstas.", "You completed every planned action."),
              animation: "confetti",
              intensity: "big",
            });
          }
        } catch (error) {
          showError(error instanceof Error ? error.message : l("Não foi possível atualizar a ação.", "Could not update the action."));
        } finally {
          setCompletingActionId(null);
        }
      }}
      onAddAction={(title) => addAction(goal.id, title)}
      onRequestSuggestion={() => requestSuggestion(goal)}
      onAcceptSuggestion={(title) => addAction(goal.id, title)}
      onPlanAction={setTaskDraft}
      onEditResult={async (title) => {
        try {
          await updateGoal(goal.id, { title });
          showSuccess(l("Resultado atualizado.", "Result updated."));
        } catch (error) {
          showError(error instanceof Error ? error.message : l("Não foi possível atualizar.", "Could not update."));
        }
      }}
      onPause={() => togglePaused(goal.id)}
      onArchive={() => archiveGoal(goal)}
    />
  );

  return (
    <div className="page-shell" style={{ minHeight: "100%", background: "var(--warm-bg)" }}>
      <div className="screen-content" style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 118 }}>
        <header style={{ padding: "18px 2px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 5px", color: "var(--lagune)", fontSize: 11, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>
                {l("Direção e movimento", "Direction and movement")}
              </p>
              <h1 style={{ margin: "0 0 7px", color: "var(--text-1)", fontSize: 28, lineHeight: 1.18 }}>
                {l("Objetivos", "Goals")}
              </h1>
              <p style={{ margin: 0, maxWidth: 440, color: "var(--text-2)", fontSize: 13, lineHeight: 1.5 }}>
                {l("Resultados que você quer tornar reais, sempre ligados a um próximo passo possível.", "Results you want to make real, always linked to a possible next step.")}
              </p>
            </div>
            <button
              onClick={() => setCreationOpen(true)}
              style={{
                minHeight: 44,
                border: 0,
                borderRadius: 14,
                background: "var(--nectarine)",
                color: "#fff",
                padding: "10px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                fontWeight: 850,
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(215,137,127,.22)",
              }}
            >
              <Plus size={17} />
              {l("Criar objetivo", "Create goal")}
            </button>
          </div>
        </header>

        {activeGoals.length > 0 && (
          <section
            style={{
              ...cardStyle,
              marginBottom: 14,
              padding: "14px 15px",
              background: "linear-gradient(135deg, rgba(150,199,179,.14), rgba(255,255,255,.88))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 36, height: 36, borderRadius: 13, background: "rgba(150,199,179,.18)", color: "var(--menthe)", display: "grid", placeItems: "center" }}>
                <Sparkles size={18} />
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 3px", color: "var(--text-1)", fontSize: 13, fontWeight: 820 }}>
                  {goalsWithAction === activeGoals.length
                    ? l("Todos os objetivos têm um próximo passo", "Every goal has a next step")
                    : l(`${goalsWithAction} de ${activeGoals.length} objetivos têm um próximo passo`, `${goalsWithAction} of ${activeGoals.length} goals have a next step`)}
                </p>
                <p style={{ margin: 0, color: "var(--text-3)", fontSize: 11, lineHeight: 1.4 }}>
                  {l("Avançar é encontrar o movimento possível — não preencher uma barra.", "Progress means finding the possible move — not filling a bar.")}
                </p>
              </div>
            </div>
          </section>
        )}

        <main style={{ display: "grid", gap: 12 }}>
          {activeGoals.length === 0 ? (
            <section style={{ ...cardStyle, padding: "24px 18px", textAlign: "center" }}>
              <span style={{ width: 52, height: 52, margin: "0 auto 12px", borderRadius: 18, background: "var(--nectarine-a3)", color: "var(--nectarine)", display: "grid", placeItems: "center" }}>
                <Target size={24} />
              </span>
              <h2 style={{ margin: "0 0 7px", color: "var(--text-1)", fontSize: 18 }}>
                {pausedGoals.length > 0 ? l("Seus objetivos ativos estão pausados", "Your active goals are paused") : l("Escolha algo que merece virar realidade", "Choose something worth making real")}
              </h2>
              <p style={{ margin: "0 auto 15px", maxWidth: 360, color: "var(--text-2)", fontSize: 13, lineHeight: 1.5 }}>
                {l("Você escolhe a direção. A Airia ajuda a separar o resultado do primeiro movimento.", "You choose the direction. Airia helps separate the result from the first move.")}
              </p>
              <button onClick={() => setCreationOpen(true)} style={{ ...quietButtonStyle, minHeight: 46, background: "var(--nectarine)", borderColor: "var(--nectarine)", color: "#fff" }}>
                <Plus size={16} /> {l("Criar meu primeiro objetivo", "Create my first goal")}
              </button>
            </section>
          ) : activeGoals.map(renderGoal)}
        </main>

        {pausedGoals.length > 0 && (
          <section style={{ marginTop: 18 }}>
            <button onClick={() => setPausedOpen((value) => !value)} style={{ ...quietButtonStyle, width: "100%", border: 0, background: "transparent", justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <CirclePause size={16} color="var(--lagune)" />
                {l("Objetivos pausados", "Paused goals")} · {pausedGoals.length}
              </span>
              {pausedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {pausedOpen && <div style={{ display: "grid", gap: 12, marginTop: 8 }}>{pausedGoals.map(renderGoal)}</div>}
          </section>
        )}

        {completedGoals.length > 0 && (
          <section style={{ marginTop: 12 }}>
            <button onClick={() => setCompletedOpen((value) => !value)} style={{ ...quietButtonStyle, width: "100%", border: 0, background: "transparent", justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={16} color="var(--menthe)" />
                {l("Resultados alcançados", "Achieved results")} · {completedGoals.length}
              </span>
              {completedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {completedOpen && <div style={{ display: "grid", gap: 12, marginTop: 8 }}>{completedGoals.map(renderGoal)}</div>}
          </section>
        )}

        {activeGoals.length > 0 && (
          <button onClick={() => navigate("/planner")} style={{ ...quietButtonStyle, width: "100%", marginTop: 18, border: 0, background: "transparent", color: "var(--lagune)" }}>
            {l("Ver as ações que já estão no meu dia", "See actions already in my day")} <ArrowRight size={15} />
          </button>
        )}
      </div>

      <CreationSheet open={creationOpen} saving={creating} onClose={() => !creating && setCreationOpen(false)} onCreate={createGoal} />
      <TaskPlacementSheet draft={taskDraft} saving={scheduling} onClose={() => !scheduling && setTaskDraft(null)} onChoose={placeAction} />
      <RewardBurst reward={reward} onDone={() => setReward(null)} />
    </div>
  );
}

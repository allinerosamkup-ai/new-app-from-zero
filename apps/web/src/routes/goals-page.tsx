import { FEATURES } from "../config/features";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  Edit3,
  Pause,
  Play,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";

import { useToast } from "../components/Toast";
import { RewardBurst, type Reward } from "../components/RewardBurst";
import { AiriaMascot } from "../components/airia/AiriaMascot";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import { GoalActionRecoveryError, useAuraStore } from "../features/aura/store";
import { useLocalizedCopy } from "../i18n";
import { api, ApiRequestError } from "../lib/api";
import { trackProductEvent } from "../lib/track";
import { useAiriaReading } from "../lib/airia-reading";
import { SafetyProtocolCard } from "../components/aura/SafetyProtocolCard";
import {
  buildGoalCardModel,
} from "../utils/goal-priority-actions";
import "../styles/aura.css";
import "../styles/editorial.css";

type GoalLike = {
  id: string | number;
  title: string;
  completedPct: number;
  /** Texto livre do objetivo. É onde fica o que a pessoa já respondeu sobre ele. */
  progress?: string;
  subtasks: Array<{
    id: string | number; title: string; done: boolean; order?: number;
    milestoneId?: string | null; scheduledFor?: string | null; doneWhen?: string | null;
    effortSize?: 'small' | 'medium' | 'large' | null; status?: 'pending' | 'done' | 'rejected' | 'deferred';
    aiGenerated?: boolean;
    basedOn?: 'stated' | 'inferred';
    userEdited?: boolean;
    evidenceRefs?: string[];
    patternBasis?: Array<{
      pattern: string; evidenceCount: number; distinctDays: number; windowDays: number;
      confidence: number; limitation: string; impact: string;
    }>;
  }>;
  description?: string | null;
  resultDefinition?: string | null;
  currentReality?: string | null;
  milestones?: Array<{ id: string; title: string; order: number; doneWhen?: string | null }>;
  pathVersion?: number;
  pathStatus?: 'not_started' | 'generating' | 'retrying' | 'needs_answer' | 'ready';
  pathQuestion?: string | null;
  needsActionReview?: boolean;
  deadline?: string | null;
  pausedAt?: string | null;
  isPrimary?: boolean;
  pathProposal?: unknown;
};

type GoalTemplate = {
  direction: string;
  result: string;
  nextAction: string;
};

type GoalPathProposal = {
  reason?: string;
  resultDefinition?: string;
  currentReality?: string;
  milestones?: Array<{ id?: string | number; title?: string }>;
};

function normalizeGoalPathProposal(value: unknown): GoalPathProposal | null {
  if (!value || typeof value !== 'object') return null;
  const proposal = value as Record<string, unknown>;
  return {
    reason: typeof proposal.reason === 'string' ? proposal.reason : undefined,
    resultDefinition: typeof proposal.resultDefinition === 'string' ? proposal.resultDefinition : undefined,
    currentReality: typeof proposal.currentReality === 'string' ? proposal.currentReality : undefined,
    milestones: Array.isArray(proposal.milestones)
      ? proposal.milestones
        .filter((milestone): milestone is Record<string, unknown> => Boolean(milestone) && typeof milestone === 'object')
        .map((milestone) => ({
          id: typeof milestone.id === 'string' || typeof milestone.id === 'number' ? milestone.id : undefined,
          title: typeof milestone.title === 'string' ? milestone.title : undefined,
        }))
      : undefined,
  };
}


export async function recoverGoalActionsOnce(
  guard: { status: 'idle' | 'inFlight' | 'completed' },
  recoverGoalActions: () => Promise<void>,
): Promise<void> {
  if (guard.status !== 'idle') return;
  guard.status = 'inFlight';
  try {
    await recoverGoalActions();
    guard.status = 'completed';
  } catch (error) {
    guard.status = 'idle';
    throw error;
  }
}

export function GoalRecoveryNotice({
  message,
  retryLabel,
  retrying,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <section
      role="alert"
      style={{
        marginBottom: 14,
        padding: '13px 14px',
        border: '1px solid rgba(134,183,154,.35)',
        borderRadius: 16,
        background: 'rgba(255,255,255,.9)',
      }}
    >
      <p style={{ margin: '0 0 10px', color: 'var(--text-2)', fontSize: 12, lineHeight: 1.45 }}>
        {message}
      </p>
      <button
        type="button"
        disabled={retrying}
        onClick={onRetry}
        style={{
          minHeight: 40,
          border: '1px solid var(--nectarine)',
          borderRadius: 12,
          background: 'transparent',
          color: 'var(--nectarine)',
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 800,
          cursor: retrying ? 'wait' : 'pointer',
        }}
      >
        {retrying ? '…' : retryLabel}
      </button>
    </section>
  );
}

function getGoalStarterTemplates(l: (portuguese: string, english: string) => string): GoalTemplate[] {
  return [
    {
      direction: l("Minha rotina", "My routine"),
      result: l("Ter uma manhã que caiba na minha energia", "Have a morning that fits my energy"),
      nextAction: l("Definir o horário possível de acordar amanhã", "Choose a realistic wake-up time for tomorrow"),
    },
    {
      direction: l("Casa", "Home"),
      result: l("Deixar a sala pronta para uso", "Make the living room ready to use"),
      nextAction: l("Separar por 15 minutos o que não pertence à sala", "Set aside what does not belong in the living room for 15 minutes"),
    },
    {
      direction: l("Projeto", "Project"),
      result: l("Publicar a primeira versão do meu projeto", "Publish the first version of my project"),
      nextAction: l("Listar as três entregas da primeira versão", "List the first version’s three deliverables"),
    },
    {
      direction: l("Saúde", "Health"),
      result: l("Retomar meu acompanhamento de saúde", "Resume my health follow-up"),
      nextAction: l("Localizar o contato do profissional ou serviço", "Find the professional or service contact"),
    },
    {
      direction: l("Dinheiro", "Money"),
      result: l("Organizar as contas deste mês", "Organize this month’s bills"),
      nextAction: l("Reunir as contas que vencem neste mês", "Gather the bills due this month"),
    },
    {
      direction: l("Trabalho ou estudo", "Work or study"),
      result: l("Concluir minha próxima apresentação", "Finish my next presentation"),
      nextAction: l("Escrever os títulos dos três primeiros slides", "Write the titles of the first three slides"),
    },
  ];
}

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

function CreationSheet({
  open,
  saving,
  onClose,
  onCreate,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (result: string, deadline: string | null) => Promise<void>;
}) {
  const l = useLocalizedCopy();
  const [result, setResult] = useState("");
  const [selectedDirection, setSelectedDirection] = useState("");
  const [deadline, setDeadline] = useState("");
  const starterTemplates = getGoalStarterTemplates(l);

  useEffect(() => {
    if (!open) {
      setResult("");
      setSelectedDirection("");
      setDeadline("");
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
        background: "rgba(20,27,23,.30)",
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
          boxShadow: "0 -18px 50px rgba(26,34,29,.16)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ width: 42, height: 4, borderRadius: 99, background: "rgba(20,27,23,.14)", margin: "0 auto 18px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px", color: "var(--lagune)", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" }}>
              {l("Novo objetivo", "New goal")}
            </p>
            <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: 22, lineHeight: 1.2 }}>
              {l("O que você quer fazer avançar?", "What would you like to move forward?")}
            </h2>
          </div>
          <button aria-label={l("Fechar", "Close")} onClick={onClose} style={{ ...quietButtonStyle, width: 40, padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: "0 0 9px", color: "var(--text-2)", fontSize: 13, fontWeight: 700 }}>
          {l("Escolha uma área ou escreva do seu jeito", "Choose an area or write it in your own way")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 18 }}>
          {starterTemplates.map((template) => {
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

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ display: "block", marginBottom: 6, color: "var(--text-2)", fontSize: 12, fontWeight: 800 }}>
            {l("Prazo (opcional)", "Deadline (optional)")}
          </span>
          <input
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            aria-label={l("Prazo do objetivo", "Goal deadline")}
            style={{
              width: "100%",
              minHeight: 46,
              boxSizing: "border-box",
              border: "1.5px solid rgba(99,152,169,.24)",
              borderRadius: 14,
              background: "#fff",
              color: "var(--text-1)",
              padding: "10px 14px",
              fontSize: 14,
            }}
          />
          <span style={{ display: "block", marginTop: 5, color: "var(--text-3)", fontSize: 11 }}>
            {l("Pode ficar sem prazo. A data ajuda a ordenar, mas não decide sozinha o que importa.", "It can stay open-ended. The date helps ordering, but does not decide importance alone.")}
          </span>
        </label>

        <p style={{ margin: "0 0 18px", color: "var(--text-3)", fontSize: 12, lineHeight: 1.45 }}>
          {l("A Airia pode ajudar a organizar os próximos passos. Você continua decidindo o que entra e o que espera.", "Airia can help organize the next steps. You still decide what belongs and what can wait.")}
        </p>

        <button
          disabled={!ready || saving}
          onClick={() => ready && onCreate(result.trim(), deadline || null)}
          style={{
            width: "100%",
            minHeight: 52,
            border: 0,
            borderRadius: 14,
            background: ready ? "var(--nectarine)" : "rgba(20,27,23,.10)",
            color: ready ? "#fff" : "var(--text-3)",
            fontSize: 14,
            fontWeight: 850,
            cursor: ready && !saving ? "pointer" : "default",
          }}
        >
          {saving ? l("Preparando seu primeiro passo…", "Preparing your first step…") : l("Criar objetivo", "Create goal")}
        </button>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  paused,
  focused,
  loadingSuggestion,
  suggestionDraft,
  completingActionId,
  onToggleAction,
  onAddAction,
  onRequestSuggestion,
  onAcceptSuggestion,
  onUpdateAction,
  onAdvance,
  onConfirmRevision,
  onEditResult,
  onEditDeadline,
  onPause,
  onArchive,
  onDelete,
}: {
  goal: GoalLike;
  paused: boolean;
  focused: boolean;
  loadingSuggestion: boolean;
  suggestionDraft: string[];
  completingActionId: string | number | null;
  onToggleAction: (actionId: string | number) => Promise<void>;
  onAddAction: (action: { title: string; doneWhen: string }) => Promise<void>;
  onRequestSuggestion: () => Promise<void>;
  onAcceptSuggestion: (title: string) => Promise<void>;
  onUpdateAction: (actionId: string | number, patch: { title?: string; doneWhen?: string; state?: 'pending' | 'rejected' | 'deferred' }) => Promise<void>;
  onAdvance: () => Promise<void>;
  onConfirmRevision: () => Promise<void>;
  onEditResult: (title: string) => Promise<void>;
  onEditDeadline: (deadline: string | null) => Promise<void>;
  onPause: () => void;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const l = useLocalizedCopy();
  const model = buildGoalCardModel(goal);
  const pathProposal = normalizeGoalPathProposal(goal.pathProposal);
  const [open, setOpen] = useState(focused || !paused);
  const [addingAction, setAddingAction] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [editingResult, setEditingResult] = useState(false);
  const [resultTitle, setResultTitle] = useState(goal.title);
  const [showManagement, setShowManagement] = useState(false);
  const [editingAction, setEditingAction] = useState(false);
  const [actionEditTitle, setActionEditTitle] = useState("");
  const [actionEditDoneWhen, setActionEditDoneWhen] = useState("");
  const [actionDoneWhen, setActionDoneWhen] = useState("");

  useEffect(() => {
    if (focused) setOpen(true);
  }, [focused]);

  const orderedActions = [...goal.subtasks]
    .map((action, index) => ({ action, index }))
    .sort((left, right) => (left.action.order ?? left.index) - (right.action.order ?? right.index) || left.index - right.index)
    .map(({ action }) => action);
  const currentAction = model.nextAction
    ? orderedActions.find((action) => action.id === model.nextAction?.id) ?? null
    : null;
  const deferredAction = orderedActions.find((action) => !action.done && action.status === 'deferred') ?? null;
  const rejectedAction = orderedActions.find((action) => !action.done && action.status === 'rejected') ?? null;
  const milestones = [...(goal.milestones ?? [])].sort((left, right) => left.order - right.order);
  const currentMilestoneId = currentAction?.milestoneId
    ?? deferredAction?.milestoneId
    ?? [...orderedActions].reverse().find((action) => action.done)?.milestoneId
    ?? milestones[0]?.id
    ?? null;
  const currentMilestone = milestones.find((milestone) => milestone.id === currentMilestoneId) ?? milestones[0] ?? null;
  const currentMilestoneLabel = currentMilestone?.title.trim().toLocaleLowerCase('pt-BR') === 'caminho atual'
    ? l('Caminho atual', 'Current step')
    : currentMilestone?.title ?? null;
  const futureMilestones = currentMilestone
    ? milestones.filter((milestone) => milestone.order > currentMilestone.order)
    : milestones.slice(1);
  const progressLabel = model.completed
    ? l("Resultado alcançado", "Result achieved")
    : model.totalActions === 0
      ? l("Pronto para escolher o primeiro passo", "Ready to choose the first step")
      : model.completedActions === 0
        ? l("Primeiro passo pronto", "First step ready")
        : l(
            `${model.completedActions} ${model.completedActions === 1 ? "passo concluído" : "passos concluídos"}`,
            `${model.completedActions} ${model.completedActions === 1 ? "step completed" : "steps completed"}`,
          );

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
            {l("Seu foco", "Your focus")}
          </span>
          <span style={{ display: "block", color: "var(--text-1)", fontSize: 16, fontWeight: 820, lineHeight: 1.32 }}>
            {goal.title}
          </span>
          <span style={{ display: "block", marginTop: 6, color: model.completed ? "var(--menthe)" : "var(--text-3)", fontSize: 11, fontWeight: 700 }}>
            {progressLabel}
          </span>
        </span>
        {open ? <ChevronUp size={18} color="var(--text-3)" /> : <ChevronDown size={18} color="var(--text-3)" />}
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ marginBottom: 12, padding: "0 2px" }}>
            <p style={{ margin: "0 0 5px", color: "var(--text-3)", fontSize: 10, fontWeight: 900, letterSpacing: ".09em", textTransform: "uppercase" }}>
              {l("Resultado", "Outcome")}
            </p>
            <p style={{ margin: 0, color: "var(--text-1)", fontSize: 14, fontWeight: 750, lineHeight: 1.45 }}>
              {goal.resultDefinition || goal.title}
            </p>
          </div>

          <div style={{
            borderRadius: 18,
            border: "1px solid rgba(150,199,179,.34)",
            background: "rgba(150,199,179,.10)",
            padding: "13px",
          }}>
            <p style={{ margin: "0 0 3px", color: "var(--menthe)", fontSize: 10, fontWeight: 900, letterSpacing: ".09em", textTransform: "uppercase" }}>
              {l("Agora", "Now")}
            </p>
            {currentMilestoneLabel && (
              <p style={{ margin: "0 0 9px", color: "var(--text-3)", fontSize: 11, lineHeight: 1.4 }}>
                {l("Etapa atual", "Current stage")} · {currentMilestoneLabel}
              </p>
            )}
            {goal.currentReality && (
              <p style={{ margin: '0 0 11px', color: 'var(--text-3)', fontSize: 11, lineHeight: 1.45 }}>
                <strong>{l('Hoje:', 'Today:')}</strong> {goal.currentReality}
              </p>
            )}

            {model.completed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--text-2)" }}>
                <CheckCircle2 size={20} color="var(--menthe)" />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 720, lineHeight: 1.45 }}>
                  {l("Você concluiu o que tinha escolhido para este objetivo. Esta conquista fica registrada aqui.", "You completed what you chose for this goal. This achievement stays recorded here.")}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, color: "var(--text-1)", fontSize: 14, fontWeight: 750, lineHeight: 1.45 }}>
                    {model.nextAction.title}
                    </p>
                    {currentAction?.doneWhen && (
                      <p style={{ margin: "5px 0 0", color: "var(--text-2)", fontSize: 11, lineHeight: 1.4 }}>
                        <strong>{l("Pronto quando:", "Done when:")}</strong> {currentAction.doneWhen}
                      </p>
                    )}
                  </div>
                </div>
                <p style={{ margin: "9px 0 0 36px", color: "var(--text-3)", fontSize: 11, lineHeight: 1.4 }}>
                  {currentAction?.scheduledFor
                    ? l("Você reservou este passo para uma data. Pode ajustar isso em Gerenciar objetivo.", "You reserved this step for a date. You can adjust it in Manage goal.")
                    : l("Faça quando houver espaço no seu dia; o importante é que este seja um passo possível.", "Do it when there is room in your day; what matters is that this is a possible step.")}
                </p>

                {editingAction ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    <input
                      autoFocus
                      value={actionEditTitle}
                      onChange={(event) => setActionEditTitle(event.target.value)}
                      aria-label={l('Editar ação atual', 'Edit current action')}
                      style={{ minHeight: 42, border: '1px solid rgba(99,152,169,.35)', borderRadius: 11, padding: '8px 10px' }}
                    />
                    <input
                      value={actionEditDoneWhen}
                      onChange={(event) => setActionEditDoneWhen(event.target.value)}
                      aria-label={l('Critério de término da ação atual', 'Completion criterion for the current action')}
                      placeholder={l('Pronto quando…', 'Done when…')}
                      style={{ minHeight: 42, border: '1px solid rgba(99,152,169,.35)', borderRadius: 11, padding: '8px 10px' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        disabled={actionEditTitle.trim().length < 3 || actionEditDoneWhen.trim().length < 3}
                        onClick={async () => {
                          await onUpdateAction(model.nextAction!.id, { title: actionEditTitle.trim(), doneWhen: actionEditDoneWhen.trim() });
                          setEditingAction(false);
                        }}
                        style={{ ...quietButtonStyle, flex: 1 }}
                      >
                        {l('Salvar', 'Save')}
                      </button>
                      <button onClick={() => setEditingAction(false)} style={quietButtonStyle}>{l('Cancelar', 'Cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                    <button
                      onClick={() => { setActionEditTitle(model.nextAction!.title); setActionEditDoneWhen(currentAction?.doneWhen ?? ''); setEditingAction(true); }}
                      style={{ ...quietButtonStyle, flex: 1 }}
                    >
                      <Edit3 size={13} /> {l('Editar', 'Edit')}
                    </button>
                    <button
                      onClick={() => onUpdateAction(model.nextAction!.id, { state: 'deferred' })}
                      style={{ ...quietButtonStyle, flex: 1 }}
                    >
                      <CirclePause size={13} /> {l('Deixar para depois', 'Leave for later')}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(l('Remover esta ação do caminho futuro?', 'Remove this action from the future path?'))) {
                          void onUpdateAction(model.nextAction!.id, { state: 'rejected' });
                        }
                      }}
                      style={{ ...quietButtonStyle, flex: 1, color: 'var(--text-2)' }}
                    >
                      <X size={13} /> {l('Retirar do caminho', 'Remove from path')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 11px", color: "var(--text-2)", fontSize: 13, lineHeight: 1.45 }}>
                  {deferredAction
                    ? l('Você deixou esta ação para depois. Quando fizer sentido, ela continua disponível aqui.', 'You left this action for later. It remains available here when it makes sense.')
                    : rejectedAction
                      ? l('Você retirou esta ação do caminho atual. Ela continua registrada, mas não conta como concluída.', 'You removed this action from the current path. It stays recorded, but does not count as completed.')
                    : futureMilestones.length > 0
                    ? l('Você concluiu o que estava em foco. Veja o próximo momento apenas quando quiser seguir.', 'You completed what was in focus. See what comes next only when you want to continue.')
                    : goal.pathStatus === 'generating'
                      ? l('Seu objetivo está salvo. A Airia está encontrando o primeiro movimento possível.', 'Your goal is saved. Airia is finding the first possible move.')
                    : goal.pathStatus === 'retrying'
                      ? l('Seu objetivo está salvo e é sério — a Airia está lendo de novo com mais calma para montar um caminho que faça sentido. Já já aparece algo aqui.', 'Your goal is saved and taken seriously — Airia is re-reading it carefully to build a path that makes sense. Something will appear here shortly.')
                    : goal.needsActionReview
                      ? l('Alguns passos antigos não dizem como terminam, e a Airia prefere não transformar passo pela metade em caminho. Escreva um passo completo ou peça um caminho novo.', 'Some older steps don’t say how they end, and Airia prefers not to turn half-finished steps into a path. Write a complete step or ask for a new path.')
                      : l("Ainda falta escolher uma ação concreta. Você pode escrever a primeira ou pedir ideias à Airia.", "A concrete action still needs to be chosen. You can write the first one or ask Airia for ideas.")}
                </p>
                {deferredAction && (
                  <button onClick={() => onUpdateAction(deferredAction.id, { state: 'pending' })} style={{ ...quietButtonStyle, width: '100%' }}>
                    <Play size={13} /> {l('Retomar esta ação', 'Resume this action')}
                  </button>
                )}
                {!deferredAction && futureMilestones.length > 0 && (
                  <button onClick={onAdvance} style={{ ...quietButtonStyle, width: '100%' }}>
                    <Sparkles size={13} /> {l(`Abrir: ${futureMilestones[0].title}`, `Open: ${futureMilestones[0].title}`)}
                  </button>
                )}
                {!deferredAction && !rejectedAction && !addingAction && futureMilestones.length === 0 && (
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
                <input
                  value={actionDoneWhen}
                  onChange={(event) => setActionDoneWhen(event.target.value)}
                  placeholder={l("Pronto quando…", "Done when…")}
                  aria-label={l("Critério de término da nova ação", "Completion criterion for the new action")}
                  style={{ width: "100%", minHeight: 44, boxSizing: "border-box", marginTop: 8, border: "1.5px solid rgba(150,199,179,.55)", borderRadius: 12, background: "#fff", padding: "10px 12px", color: "var(--text-1)", fontSize: 13, outline: "none" }}
                />
                <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                  <button
                    disabled={actionTitle.trim().length < 3 || actionDoneWhen.trim().length < 3}
                    onClick={async () => {
                      if (actionTitle.trim().length < 3 || actionDoneWhen.trim().length < 3) return;
                      await onAddAction({ title: actionTitle.trim(), doneWhen: actionDoneWhen.trim() });
                      setActionTitle("");
                      setActionDoneWhen("");
                      setAddingAction(false);
                    }}
                    style={{
                      ...quietButtonStyle,
                      flex: 1,
                      background: "var(--menthe)",
                      borderColor: "var(--menthe)",
                      color: "#fff",
                      opacity: actionTitle.trim().length < 3 || actionDoneWhen.trim().length < 3 ? 0.45 : 1,
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
                        border: "1px solid rgba(134,183,154,.30)",
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

          {(goal.subtasks.length > 1 || futureMilestones.length > 0 || currentMilestone) && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", color: "var(--text-3)", fontSize: 11, fontWeight: 750 }}>
                {l("Caminho", "Path")} · {model.completedActions}/{model.totalActions}
              </summary>
              <div style={{ display: "grid", gap: 10, marginTop: 9 }}>
                {currentMilestone && (
                  <div style={{ borderLeft: "2px solid var(--menthe)", padding: "5px 0 5px 10px" }}>
                    <span style={{ display: "block", marginBottom: 3, color: "var(--menthe)", fontSize: 10, fontWeight: 850, letterSpacing: ".08em", textTransform: "uppercase" }}>
                      {l("Etapa atual", "Current stage")}
                    </span>
                    <strong style={{ display: "block", color: "var(--text-2)", fontSize: 12 }}>{currentMilestone.title}</strong>
                    {currentMilestone.doneWhen && <span style={{ color: "var(--text-3)", fontSize: 11 }}>{currentMilestone.doneWhen}</span>}
                  </div>
                )}

                {goal.subtasks.length > 1 && (
                  <div style={{ display: "grid", gap: 7 }}>
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
                            {action.doneWhen && <small style={{ display: "block", marginTop: 3, color: "var(--text-3)", fontWeight: 500, textDecoration: "none" }}>{l("Pronto quando:", "Done when:")} {action.doneWhen}</small>}
                            {action.aiGenerated && !action.userEdited && !action.done && (
                              <small style={{ display: "block", marginTop: 2, color: "var(--text-3)", fontWeight: 500, textDecoration: "none" }}>
                                {l("Sugerido pela Airia — você pode editar", "Suggested by Airia — you can edit it")}
                              </small>
                            )}
                            {active ? <small style={{ display: "block", marginTop: 2, color: "var(--menthe)", fontWeight: 800 }}>{l("Agora", "Now")}</small> : null}
                            {action.patternBasis?.map((basis) => (
                              <small key={`${action.id}-${basis.pattern}`} style={{ display: "block", marginTop: 5, color: "var(--text-3)", fontWeight: 500, lineHeight: 1.45, textDecoration: "none" }}>
                                {l("Base desta adaptação", "Basis for this adaptation")}: {basis.pattern} · {basis.evidenceCount} {l("evidências", "evidence")} em {basis.distinctDays} {l("dias", "days")}/{basis.windowDays} · {Math.round(basis.confidence * 100)}% {l("confiança", "confidence")}. {basis.impact} {basis.limitation}
                              </small>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {futureMilestones.length > 0 && (
                  <div style={{ display: "grid", gap: 7 }}>
                    <span style={{ color: "var(--text-3)", fontSize: 10, fontWeight: 850, letterSpacing: ".08em", textTransform: "uppercase" }}>
                      {l("Próximas etapas", "Next stages")}
                    </span>
                    {futureMilestones.map((milestone) => (
                      <div key={milestone.id} style={{ borderLeft: "2px solid rgba(99,152,169,.22)", padding: "5px 0 5px 10px" }}>
                        <strong style={{ display: "block", color: "var(--text-2)", fontSize: 12 }}>{milestone.title}</strong>
                        {milestone.doneWhen && <span style={{ color: "var(--text-3)", fontSize: 11 }}>{milestone.doneWhen}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}

          {pathProposal && (
            <div style={{ marginTop: 12, border: '1px solid rgba(225,154,104,.3)', borderRadius: 14, padding: 11, background: 'rgba(225,154,104,.08)' }}>
              <strong style={{ display: 'block', color: 'var(--text-1)', fontSize: 12 }}>{l('Uma sugestão de ajuste', 'A suggested adjustment')}</strong>
              <span style={{ display: 'block', margin: '4px 0 9px', color: 'var(--text-3)', fontSize: 11 }}>{pathProposal.reason ?? l('Novo contexto mudou o caminho futuro.', 'New context changed the future path.')}</span>
              {pathProposal.resultDefinition && pathProposal.resultDefinition !== goal.resultDefinition && (
                <span style={{ display: 'block', marginBottom: 6, color: 'var(--text-2)', fontSize: 11 }}>
                  <strong>{l('O que poderia mudar:', 'What could change:')}</strong> {pathProposal.resultDefinition}
                </span>
              )}
              {pathProposal.currentReality && pathProposal.currentReality !== goal.currentReality && (
                <span style={{ display: 'block', marginBottom: 8, color: 'var(--text-2)', fontSize: 11 }}>
                  <strong>{l('Como isso está hoje:', 'How this stands today:')}</strong> {pathProposal.currentReality}
                </span>
              )}
              {pathProposal.milestones && (
                <div style={{ display: 'grid', gap: 5, margin: '0 0 10px' }}>
                  {pathProposal.milestones.slice(1).map((milestone, index) => (
                    <span key={String(milestone.id ?? index)} style={{ color: 'var(--text-2)', fontSize: 11 }}>
                      → {milestone.title ?? l('Próxima etapa', 'Next stage')}
                    </span>
                  ))}
                </div>
              )}
              <button onClick={onConfirmRevision} style={{ ...quietButtonStyle, width: '100%' }}>{l('Ver o ajuste e decidir', 'Review the adjustment and decide')}</button>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowManagement((value) => !value)} style={{ ...quietButtonStyle, width: "100%", minHeight: 36, border: 0, background: "transparent", color: "var(--text-3)" }}>
              {l("Gerenciar objetivo", "Manage goal")}
              {showManagement ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showManagement && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7, marginTop: 6 }}>
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
                <button onClick={() => { void onDelete(); }} style={{ ...quietButtonStyle, gridColumn: '1 / -1', padding: "8px 6px", color: "#A6574B", borderColor: "rgba(166,87,75,.24)" }}>
                  <Trash2 size={14} /> {l("Excluir definitivamente", "Delete permanently")}
                </button>
                <label style={{ ...quietButtonStyle, gridColumn: '1 / -1', padding: '8px 10px' }}>
                  <CalendarPlus size={14} />
                  <span>{goal.deadline ? l('Prazo', 'Deadline') : l('Definir prazo', 'Set deadline')}</span>
                  <input
                    type="date"
                    value={goal.deadline ?? ''}
                    aria-label={l('Prazo do objetivo', 'Goal deadline')}
                    onChange={(event) => { void onEditDeadline(event.target.value || null); }}
                    style={{ minWidth: 0, flex: 1, border: 0, background: 'transparent', color: 'var(--text-1)' }}
                  />
                  {goal.deadline && (
                    <button
                      type="button"
                      aria-label={l('Remover prazo', 'Remove deadline')}
                      onClick={(event) => { event.preventDefault(); void onEditDeadline(null); }}
                      style={{ border: 0, background: 'transparent', color: 'var(--text-3)', padding: 2 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
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
    refreshObjectives,
    toggleSubGoal,
    removeGoal,
    updateGoal,
    recoverGoalActions,
  } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const { reading: canonicalReading } = useAiriaReading();

  const [creationOpen, setCreationOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [pausedOpen, setPausedOpen] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | number | null>(null);
  const [completingActionId, setCompletingActionId] = useState<string | number | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const recoveryGuardRef = useRef<{ status: 'idle' | 'inFlight' | 'completed' }>({ status: 'idle' });
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveringGoals, setRecoveringGoals] = useState(false);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string[]>>({});

  const focusedGoalId = (location.state as { openGoalId?: string | number } | null)?.openGoalId;
  const goals = state.goals as unknown as GoalLike[];
  const goalsOpenedRef = useRef(false);

  useEffect(() => {
    if (goalsOpenedRef.current) return;
    goalsOpenedRef.current = true;
    trackProductEvent("goals.opened.v1", "goals", {
      activeGoalsCount: goals.filter((goal) => goal.completedPct < 100 && !goal.pausedAt).length,
    });
  }, [goals]);

  useEffect(() => {
    // A criação já respondeu; só acompanhamos a decisão enquanto ela estiver
    // realmente em andamento. Não há polling de agenda nem chamada contínua.
    if (!goals.some((goal) => goal.pathStatus === 'generating')) return;
    let stopped = false;
    let inFlight = false;
    const refreshWhenReady = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        await refreshObjectives();
      } finally {
        inFlight = false;
      }
    };
    void refreshWhenReady();
    const timer = window.setInterval(() => { void refreshWhenReady(); }, 1800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [goals, refreshObjectives]);

  // A fase vem do mesmo motor de sempre. O mascote não a calcula nem a infere:
  // se cada tela adivinhasse por conta própria, o mascote diria uma coisa e a
  // Home diria outra sobre o mesmo dia.
  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.completedPct < 100 && !goal.pausedAt),
    [goals],
  );
  const pausedGoals = useMemo(
    () => goals.filter((goal) => goal.completedPct < 100 && Boolean(goal.pausedAt)),
    [goals],
  );
  const completedGoals = useMemo(
    () => goals.filter((goal) => goal.completedPct >= 100),
    [goals],
  );
  const goalsWithAction = activeGoals.filter((goal) => buildGoalCardModel(goal).nextAction).length;

  async function executeGoalRecovery() {
    await recoverGoalActionsOnce(recoveryGuardRef.current, async () => {
      setRecoveringGoals(true);
      setRecoveryError(null);
      try {
        await recoverGoalActions();
      } catch (error) {
        const message = error instanceof GoalActionRecoveryError
          ? l(
              `Ainda faltam microações em ${error.result.eligible - error.result.recovered} objetivo(s). Tente novamente para continuar.`,
              `${error.result.eligible - error.result.recovered} goal(s) still need micro-actions. Try again to continue.`,
            )
          : error instanceof Error
            ? error.message
            : l(
              'Não foi possível atualizar os passos dos objetivos antigos agora.',
              'Could not update older goal actions right now.',
            );
        console.error('Failed to recover legacy objective actions.', error);
        setRecoveryError(message);
        showError(message);
        throw error;
      } finally {
        setRecoveringGoals(false);
      }
    });
  }

  useEffect(() => {
    // A recuperação pode acionar IA em objetivos antigos; não bloqueie o primeiro
    // paint da tela. A hidratação canônica chega pelo store antes desta tentativa.
    const timer = window.setTimeout(() => {
      void executeGoalRecovery().catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
    // Uma tentativa automática por montagem. Falha volta o guard para idle e
    // fica sob controle explícito do botão de retry, sem loop de custo de IA.
  }, []);

  useEffect(() => {
    if (!focusedGoalId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`goal-${focusedGoalId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusedGoalId]);

  /**
   * Cria o objetivo e deixa a Airia decidir internamente o primeiro movimento.
   * A criação nunca abre uma pergunta contextual; quando a IA não consegue
   * validar um caminho, o backend entrega o fallback canônico.
   */
  async function createGoal(result: string, deadline: string | null) {
    setCreating(true);
    try {
      const objective = await api.post('/objectives', {
        title: result,
        category: 'geral',
        deadline,
        locale: navigator.language || 'pt-BR',
      }) as GoalLike;
      await refreshObjectives();
      setCreationOpen(false);
      trackProductEvent("goal.created.v1", "goals", {
        goalId: String(objective.id),
        creationMode: "manual",
        hasDeadline: Boolean(deadline),
      });
      if (objective.pathStatus === 'generating') {
        showSuccess(l('Objetivo salvo. A Airia está encontrando o primeiro movimento possível.', 'Goal saved. Airia is finding the first possible move.'));
      } else if (objective.pathStatus === 'retrying') {
        showError(l('O objetivo foi salvo. A Airia vai tentar interpretar o caminho novamente.', 'The goal was saved. Airia will retry the path interpretation.'));
      } else {
        showSuccess(l('Objetivo criado com um caminho ligado à sua realidade.', 'Goal created with a path grounded in your reality.'));
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível criar o objetivo.", "Could not create the goal."));
    } finally {
      setCreating(false);
    }
  }

  async function requestSuggestion(goal: GoalLike, clarifications: string[] = []) {
    setLoadingSuggestion(goal.id);
    try {
      const response = await api.post(`/objectives/${goal.id}/path/generate`, {
        locale: navigator.language || 'pt-BR',
        userStatements: clarifications,
      }) as { status: string; objective?: GoalLike };
      await refreshObjectives();
      if (response.status === 'ready') showSuccess(l('O caminho foi atualizado.', 'The path was updated.'));
      else showError(l('O objetivo continua salvo; a Airia tentará novamente.', 'The goal remains saved; Airia will retry.'));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível gerar opções agora.", "Could not generate options right now."));
    } finally {
      setLoadingSuggestion(null);
    }
  }

  async function addAction(goalId: string | number, action: { title: string; doneWhen: string }) {
    try {
      const goal = goals.find((item) => String(item.id) === String(goalId));
      if (!goal) return;
      const response = await api.post(`/objectives/${goalId}/actions`, { ...action, expectedVersion: goal.pathVersion ?? 1 }) as { action: { id: string } };
      await refreshObjectives();
      trackProductEvent("goal.action_changed.v1", "goals", {
        goalId: String(goalId),
        actionId: response.action.id,
        changeType: "created",
      });
      setSuggestionDrafts((current) => ({ ...current, [String(goalId)]: [] }));
      showSuccess(l("Próxima ação adicionada.", "Next action added."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível adicionar a ação.", "Could not add the action."));
    }
  }

  async function togglePaused(goalId: string | number) {
    const goal = goals.find((item) => String(item.id) === String(goalId));
    if (!goal) return;
    await api.patch(`/objectives/${goalId}`, { pausedAt: goal.pausedAt ? null : new Date().toISOString() });
    await refreshObjectives();
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
      await api.patch(`/objectives/${goal.id}`, { archived: true });
      await refreshObjectives();
      showSuccess(l("Objetivo arquivado.", "Goal archived."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível arquivar.", "Could not archive."));
    }
  }

  async function deleteGoal(goal: GoalLike) {
    const confirmed = window.confirm(
      l(
        `Excluir “${goal.title}” definitivamente? O objetivo, suas microtarefas e o histórico ligado a ele serão removidos.`,
        `Delete “${goal.title}” permanently? The goal, its microtasks, and linked history will be removed.`,
      ),
    );
    if (!confirmed) return;

    try {
      await removeGoal(goal.id);
      showSuccess(l("Objetivo excluído.", "Goal deleted."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível excluir o objetivo.", "Could not delete the goal."));
    }
  }

  const renderGoal = (goal: GoalLike) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      paused={Boolean(goal.pausedAt)}
      focused={focusedGoalId != null && String(focusedGoalId) === String(goal.id)}
      loadingSuggestion={loadingSuggestion === goal.id}
      suggestionDraft={suggestionDrafts[String(goal.id)] ?? []}
      completingActionId={completingActionId}
      onToggleAction={async (actionId) => {
        if (completingActionId !== null) return;
        setCompletingActionId(actionId);
        try {
          const outcome = await toggleSubGoal(goal.id, actionId);
          trackProductEvent("goal.action_changed.v1", "goals", {
            goalId: String(goal.id),
            actionId: String(actionId),
            changeType: "completed",
          });
          // Agora CADA micro-ação paga, não só o objetivo inteiro. O texto vem
          // do backend para ser igual em toda superfície; o fallback existe só
          // para o caso de uma resposta antiga sem `reward`.
          if (outcome?.completedNow) {
            setReward(outcome.reward ?? {
              headline: outcome.objectiveCompletedNow
                ? l("Objetivo concluído", "Goal completed")
                : l("Feito.", "Done."),
              detail: outcome.objectiveCompletedNow
                ? l("Você percorreu todas as ações previstas.", "You completed every planned action.")
                : null,
              animation: outcome.objectiveCompletedNow ? "confetti" : "spark",
              intensity: outcome.objectiveCompletedNow ? "big" : "small",
            });
          }
        } catch (error) {
          if (error instanceof ApiRequestError && error.status === 422 && error.details?.actionStillPending) {
            // O auditor da Airia não sentiu o trabalho à altura do que a ação
            // promete — a ação não virou concluída, e a tela recebe o que ainda
            // falta em vez de um erro técnico.
            const feedbackText = [
              typeof error.details.feedback === 'string' ? error.details.feedback : null,
              typeof error.details.encouragement === 'string' ? error.details.encouragement : null,
            ].filter(Boolean).join(' ');
            showSuccess(feedbackText || l('Quase lá — ajusta o que falta e marca de novo.', 'Almost there — adjust what is missing and mark it again.'));
          } else {
            showError(error instanceof Error ? error.message : l("Não foi possível atualizar a ação.", "Could not update the action."));
          }
        } finally {
          setCompletingActionId(null);
        }
      }}
      onAddAction={(action) => addAction(goal.id, action)}
      onRequestSuggestion={() => requestSuggestion(goal)}
      onAcceptSuggestion={(title) => addAction(goal.id, { title, doneWhen: l('a evidência combinada estiver registrada', 'the agreed evidence is recorded') })}
      onUpdateAction={async (actionId, patch) => {
        try {
          await api.patch(`/objectives/${goal.id}/actions/${actionId}`, {
            expectedVersion: goal.pathVersion ?? 1,
            ...patch,
          });
          await refreshObjectives();
          trackProductEvent("goal.action_changed.v1", "goals", {
            goalId: String(goal.id),
            actionId: String(actionId),
            changeType: patch.state === "deferred" ? "deferred"
              : patch.state === "pending" ? "restored"
                : "edited",
          });
          showSuccess(patch.state === 'deferred'
            ? l('A ação ficou para depois.', 'The action was left for later.')
            : patch.state === 'rejected'
              ? l('A ação saiu do caminho futuro.', 'The action was removed from the future path.')
              : patch.state === 'pending'
                ? l('A ação voltou para o caminho atual.', 'The action is active again.')
                : l('Ação atualizada.', 'Action updated.'));
        } catch (error) {
          showError(error instanceof Error ? error.message : l('Não foi possível atualizar a ação.', 'Could not update the action.'));
        }
      }}
      onAdvance={async () => {
        try {
          await api.post(`/objectives/${goal.id}/path/advance`, { expectedVersion: goal.pathVersion ?? 1, locale: navigator.language || 'pt-BR' });
          await refreshObjectives();
        } catch (error) {
          showError(error instanceof Error ? error.message : l('Não foi possível abrir a próxima etapa.', 'Could not open the next stage.'));
        }
      }}
      onConfirmRevision={async () => {
        try {
          await api.post(`/objectives/${goal.id}/path/confirm-revision`, { expectedVersion: goal.pathVersion ?? 1 });
          await refreshObjectives();
          showSuccess(l('O caminho futuro foi revisado.', 'The future path was revised.'));
        } catch (error) {
          showError(error instanceof Error ? error.message : l('O objetivo mudou; gere uma nova proposta.', 'The goal changed; generate a new proposal.'));
        }
      }}
      onEditResult={async (title) => {
        try {
          await updateGoal(goal.id, { title });
          showSuccess(l("Resultado atualizado.", "Result updated."));
        } catch (error) {
          showError(error instanceof Error ? error.message : l("Não foi possível atualizar.", "Could not update."));
        }
      }}
      onPause={() => { void togglePaused(goal.id); }}
      onArchive={() => archiveGoal(goal)}
      onDelete={() => deleteGoal(goal)}
      onEditDeadline={async (deadline) => {
        try {
          await api.patch(`/objectives/${goal.id}`, { deadline });
          await refreshObjectives();
          showSuccess(deadline ? l('Prazo atualizado.', 'Deadline updated.') : l('Objetivo deixado sem prazo.', 'Goal left open-ended.'));
        } catch (error) {
          showError(error instanceof Error ? error.message : l('Não foi possível atualizar o prazo.', 'Could not update the deadline.'));
        }
      }}
    />
  );

  return (
    <div className="page-shell" style={{ minHeight: "100%", background: "var(--warm-bg)" }}>
      <div className="screen-content" style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 118 }}>
        <SafetyProtocolCard riskSafety={canonicalReading?.riskSafety} surface="goals" />
        <header style={{ padding: "18px 2px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            {/* Aqui a Airia apoia o próximo movimento — órbita firme, discreta,
                e fora do caminho do botão de criar objetivo. */}
            <AiriaMascot phase={cycleReport.phase} motion="action" size={56} decorative />
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
                boxShadow: "0 8px 20px rgba(134,183,154,.22)",
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

        {recoveryError && (
          <GoalRecoveryNotice
            message={recoveryError}
            retryLabel={l('Tentar novamente', 'Try again')}
            retrying={recoveringGoals}
            onRetry={() => { void executeGoalRecovery().catch(() => {}); }}
          />
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

        {FEATURES.planner && activeGoals.length > 0 && (
          <button onClick={() => navigate("/planner")} style={{ ...quietButtonStyle, width: "100%", marginTop: 18, border: 0, background: "transparent", color: "var(--lagune)" }}>
            {l("Ver as ações que já estão no meu dia", "See actions already in my day")} <ArrowRight size={15} />
          </button>
        )}
      </div>

      <CreationSheet open={creationOpen} saving={creating} onClose={() => !creating && setCreationOpen(false)} onCreate={createGoal} />

      <RewardBurst reward={reward} onDone={() => setReward(null)} />
    </div>
  );
}

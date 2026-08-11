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
  Star,
  Target,
  X,
} from "lucide-react";

import { useToast } from "../components/Toast";
import { RewardBurst, type Reward } from "../components/RewardBurst";
import { AiriaMascot } from "../components/airia/AiriaMascot";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import { GoalActionRecoveryError, useAuraStore } from "../features/aura/store";
import { useLocalizedCopy } from "../i18n";
import { api } from "../lib/api";
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
  }>;
  description?: string | null;
  resultDefinition?: string | null;
  currentReality?: string | null;
  milestones?: Array<{ id: string; title: string; order: number; doneWhen?: string | null }>;
  pathVersion?: number;
  pathStatus?: 'not_started' | 'retrying' | 'needs_answer' | 'ready';
  pathQuestion?: string | null;
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
          {l("A Airia organiza o caminho em microações e deixa só o primeiro movimento em foco.", "Airia turns this into micro-actions and keeps only the first move in focus.")}
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
          {saving ? l("Organizando ações…", "Organizing actions…") : l("Criar caminho com a Airia", "Create path with Airia")}
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
  onScheduleAction,
  onUpdateAction,
  onAdvance,
  onConfirmRevision,
  onEditResult,
  onEditDeadline,
  onPause,
  onArchive,
  isPrimary,
  onMakePrimary,
}: {
  goal: GoalLike;
  paused: boolean;
  focused: boolean;
  loadingSuggestion: boolean;
  suggestionDraft: string[];
  completingActionId: string | number | null;
  onToggleAction: (actionId: string | number) => Promise<void>;
  onAddAction: (title: string) => Promise<void>;
  onRequestSuggestion: () => Promise<void>;
  onAcceptSuggestion: (title: string) => Promise<void>;
  onScheduleAction: (actionId: string | number, date: string | null) => Promise<void>;
  onUpdateAction: (actionId: string | number, patch: { title?: string; state?: 'pending' | 'rejected' | 'deferred' }) => Promise<void>;
  onAdvance: () => Promise<void>;
  onConfirmRevision: () => Promise<void>;
  onEditResult: (title: string) => Promise<void>;
  onEditDeadline: (deadline: string | null) => Promise<void>;
  onPause: () => void;
  onArchive: () => Promise<void>;
  isPrimary: boolean;
  onMakePrimary: () => void;
}) {
  const l = useLocalizedCopy();
  const model = buildGoalCardModel(goal);
  const [open, setOpen] = useState(focused || !paused);
  const [addingAction, setAddingAction] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [editingResult, setEditingResult] = useState(false);
  const [resultTitle, setResultTitle] = useState(goal.title);
  const [showManagement, setShowManagement] = useState(false);
  const [editingAction, setEditingAction] = useState(false);
  const [actionEditTitle, setActionEditTitle] = useState("");

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
  const milestones = [...(goal.milestones ?? [])].sort((left, right) => left.order - right.order);
  const currentMilestoneId = currentAction?.milestoneId
    ?? deferredAction?.milestoneId
    ?? [...orderedActions].reverse().find((action) => action.done)?.milestoneId
    ?? milestones[0]?.id
    ?? null;
  const currentMilestone = milestones.find((milestone) => milestone.id === currentMilestoneId) ?? milestones[0] ?? null;
  const futureMilestones = currentMilestone
    ? milestones.filter((milestone) => milestone.order > currentMilestone.order)
    : milestones.slice(1);

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
              {currentMilestone ? `${l('Etapa atual', 'Current stage')} · ${currentMilestone.title}` : l("Próxima ação", "Next action")}
            </p>

            {goal.resultDefinition && (
              <p style={{ margin: '0 0 8px', color: 'var(--text-2)', fontSize: 12, lineHeight: 1.45 }}>
                <strong>{l('Resultado:', 'Outcome:')}</strong> {goal.resultDefinition}
              </p>
            )}
            {goal.currentReality && (
              <p style={{ margin: '0 0 11px', color: 'var(--text-3)', fontSize: 11, lineHeight: 1.45 }}>
                <strong>{l('Ponto de partida:', 'Starting point:')}</strong> {goal.currentReality}
              </p>
            )}

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

                <label
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
                    cursor: "default",
                  }}
                >
                  <CalendarPlus size={16} />
                  <span>{currentAction?.scheduledFor ? l("Planejada para", "Planned for") : l("Escolher uma data", "Choose a date")}</span>
                  <input
                    key={currentAction?.scheduledFor ?? 'without-date'}
                    type="date"
                    value={currentAction?.scheduledFor ?? ''}
                    aria-label={l('Data da ação', 'Action date')}
                    onChange={(event) => {
                      const nextDate = event.target.value || null;
                      const previousDate = currentAction?.scheduledFor ?? null;
                      if (previousDate && nextDate !== previousDate && !window.confirm(l('Confirmar a mudança da data desta ação?', 'Confirm changing this action date?'))) {
                        event.currentTarget.value = previousDate;
                        return;
                      }
                      void onScheduleAction(model.nextAction!.id, nextDate);
                    }}
                    style={{ maxWidth: 132, border: 0, borderRadius: 8, padding: '5px 7px', color: 'var(--text-1)' }}
                  />
                </label>

                {editingAction ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    <input
                      autoFocus
                      value={actionEditTitle}
                      onChange={(event) => setActionEditTitle(event.target.value)}
                      aria-label={l('Editar ação atual', 'Edit current action')}
                      style={{ minHeight: 42, border: '1px solid rgba(99,152,169,.35)', borderRadius: 11, padding: '8px 10px' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        disabled={actionEditTitle.trim().length < 3}
                        onClick={async () => {
                          await onUpdateAction(model.nextAction!.id, { title: actionEditTitle.trim() });
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
                      onClick={() => { setActionEditTitle(model.nextAction!.title); setEditingAction(true); }}
                      style={{ ...quietButtonStyle, flex: 1 }}
                    >
                      <Edit3 size={13} /> {l('Editar', 'Edit')}
                    </button>
                    <button
                      onClick={() => onUpdateAction(model.nextAction!.id, { state: 'deferred' })}
                      style={{ ...quietButtonStyle, flex: 1 }}
                    >
                      <CirclePause size={13} /> {l('Pode esperar', 'Can wait')}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(l('Remover esta ação do caminho futuro?', 'Remove this action from the future path?'))) {
                          void onUpdateAction(model.nextAction!.id, { state: 'rejected' });
                        }
                      }}
                      style={{ ...quietButtonStyle, flex: 1, color: 'var(--text-2)' }}
                    >
                      <X size={13} /> {l('Não faz sentido', 'Not relevant')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 11px", color: "var(--text-2)", fontSize: 13, lineHeight: 1.45 }}>
                  {deferredAction
                    ? l('Esta ação ficou para depois. Ela continua protegida no caminho e pode ser retomada aqui.', 'This action was left for later. It stays protected in the path and can be resumed here.')
                    : futureMilestones.length > 0
                    ? l('A etapa atual terminou. A próxima só ganha ações quando você confirmar que quer abri-la.', 'The current stage is complete. The next one only gets actions after you confirm opening it.')
                    : goal.pathStatus === 'retrying'
                      ? l('O objetivo está salvo. A Airia está retomando a interpretação sem preencher com uma lista genérica.', 'The goal is saved. Airia is retrying without filling it with a generic list.')
                      : l("Este resultado ainda não tem um passo concreto. Você decide o primeiro; a Airia não inventa por você.", "This result has no concrete step yet. You decide the first one; Airia does not invent it for you.")}
                </p>
                {deferredAction && (
                  <button onClick={() => onUpdateAction(deferredAction.id, { state: 'pending' })} style={{ ...quietButtonStyle, width: '100%' }}>
                    <Play size={14} /> {l('Retomar esta ação', 'Resume this action')}
                  </button>
                )}
                {!deferredAction && futureMilestones.length > 0 && (
                  <button onClick={onAdvance} style={{ ...quietButtonStyle, width: '100%', color: 'var(--nectarine-11)', borderColor: 'var(--nectarine-a5)' }}>
                    <Sparkles size={14} /> {l(`Abrir: ${futureMilestones[0].title}`, `Open: ${futureMilestones[0].title}`)}
                  </button>
                )}
                {!deferredAction && !addingAction && futureMilestones.length === 0 && (
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

          {futureMilestones.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, fontWeight: 750 }}>
                {l('Próximas etapas', 'Future stages')} · {futureMilestones.length}
              </summary>
              <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                {futureMilestones.map((milestone) => (
                  <div key={milestone.id} style={{ borderLeft: '2px solid rgba(99,152,169,.22)', padding: '5px 0 5px 10px' }}>
                    <strong style={{ display: 'block', color: 'var(--text-2)', fontSize: 12 }}>{milestone.title}</strong>
                    {milestone.doneWhen && <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{milestone.doneWhen}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}

          {Boolean(goal.pathProposal) && (
            <div style={{ marginTop: 12, border: '1px solid rgba(225,154,104,.3)', borderRadius: 14, padding: 11, background: 'rgba(225,154,104,.08)' }}>
              <strong style={{ display: 'block', color: 'var(--text-1)', fontSize: 12 }}>{l('Proposta de revisão', 'Revision proposal')}</strong>
              <span style={{ display: 'block', margin: '4px 0 9px', color: 'var(--text-3)', fontSize: 11 }}>{String((goal.pathProposal as any).reason ?? l('Novo contexto mudou o caminho futuro.', 'New context changed the future path.'))}</span>
              {(goal.pathProposal as any)?.resultDefinition && (goal.pathProposal as any).resultDefinition !== goal.resultDefinition && (
                <span style={{ display: 'block', marginBottom: 6, color: 'var(--text-2)', fontSize: 11 }}>
                  <strong>{l('Resultado proposto:', 'Proposed outcome:')}</strong> {String((goal.pathProposal as any).resultDefinition)}
                </span>
              )}
              {(goal.pathProposal as any)?.currentReality && (goal.pathProposal as any).currentReality !== goal.currentReality && (
                <span style={{ display: 'block', marginBottom: 8, color: 'var(--text-2)', fontSize: 11 }}>
                  <strong>{l('Nova leitura do ponto de partida:', 'Updated starting point:')}</strong> {String((goal.pathProposal as any).currentReality)}
                </span>
              )}
              {Array.isArray((goal.pathProposal as any)?.milestones) && (
                <div style={{ display: 'grid', gap: 5, margin: '0 0 10px' }}>
                  {(goal.pathProposal as any).milestones.slice(1).map((milestone: any) => (
                    <span key={String(milestone.id)} style={{ color: 'var(--text-2)', fontSize: 11 }}>
                      → {String(milestone.title)}
                    </span>
                  ))}
                </div>
              )}
              <button onClick={onConfirmRevision} style={{ ...quietButtonStyle, width: '100%' }}>{l('Revisar e aceitar mudanças futuras', 'Review and accept future changes')}</button>
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
                {/* Quem sabe o que é urgente é ela, não a porcentagem de
                    conclusão. A heurística continua sendo o padrão; isto é a
                    palavra final. */}
                <button
                  onClick={onMakePrimary}
                  style={{
                    ...quietButtonStyle,
                    padding: "8px 6px",
                    ...(isPrimary
                      ? { borderColor: "var(--accent-primary-strong)", color: "var(--accent-primary-ink)" }
                      : {}),
                  }}
                >
                  <Star size={14} />
                  {isPrimary ? l("É o principal", "Is primary") : l("Tornar principal", "Make primary")}
                </button>
                <button onClick={onPause} style={{ ...quietButtonStyle, padding: "8px 6px" }}>
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                  {paused ? l("Retomar", "Resume") : l("Pausar", "Pause")}
                </button>
                <button onClick={onArchive} style={{ ...quietButtonStyle, padding: "8px 6px", color: "var(--nectarine-11)" }}>
                  <Archive size={14} /> {l("Arquivar", "Archive")}
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
    refreshData,
    toggleSubGoal,
    removeGoal,
    updateGoal,
    recoverGoalActions,
  } = useAuraStore();
  const { showError, showSuccess } = useToast();

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
  const [pendingQuestion, setPendingQuestion] = useState<{ goalId?: string | number; goalTitle: string; question: string } | null>(null);
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [primaryGoalId, setPrimaryGoalId] = useState<string | null>(null);

  const focusedGoalId = (location.state as { openGoalId?: string | number } | null)?.openGoalId;
  const goals = state.goals as unknown as GoalLike[];

  useEffect(() => {
    setPrimaryGoalId(goals.find((goal) => goal.isPrimary)?.id?.toString() ?? null);
  }, [goals]);

  useEffect(() => {
    if (pendingQuestion) return;
    const waiting = goals.find((goal) => goal.pathStatus === 'needs_answer' && goal.pathQuestion);
    if (waiting?.pathQuestion) setPendingQuestion({ goalId: waiting.id, goalTitle: waiting.title, question: waiting.pathQuestion });
  }, [goals, pendingQuestion]);

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
    void executeGoalRecovery().catch(() => {});
    // Uma tentativa automática por montagem. Falha volta o guard para idle e
    // fica sob controle explícito do botão de retry, sem loop de custo de IA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusedGoalId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`goal-${focusedGoalId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusedGoalId]);

  /**
   * Cria o objetivo interpretando o que ele significa.
   *
   * A Airia pode responder com uma PERGUNTA em vez de um caminho — é o caso de
   * objetivo amplo demais ("organizar minhas finanças" pode ser dívida, gasto
   * mensal ou controle). Nesse caso o objetivo é criado do mesmo jeito, sem
   * ações, e a pergunta aparece na tela. Bloquear a criação até a pessoa
   * responder seria transferir para ela o custo de um problema que é nosso.
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
      await refreshData();
      setCreationOpen(false);
      if (objective.pathQuestion) {
        setPendingQuestion({ goalId: objective.id, goalTitle: objective.title, question: objective.pathQuestion });
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
      }) as { status: string; question?: string | null; objective?: GoalLike };
      await refreshData();
      if (response.question) setPendingQuestion({ goalId: goal.id, goalTitle: goal.title, question: response.question });
      else if (response.status === 'ready') showSuccess(l('O caminho foi atualizado.', 'The path was updated.'));
      else showError(l('O objetivo continua salvo; a Airia tentará novamente.', 'The goal remains saved; Airia will retry.'));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível gerar opções agora.", "Could not generate options right now."));
    } finally {
      setLoadingSuggestion(null);
    }
  }

  /**
   * Resposta da pessoa vira contexto permanente do objetivo.
   *
   * Guardar na descrição é o que impede a mesma pergunta de voltar amanhã: o
   * campo já viaja em toda leitura do objetivo e alimenta a próxima geração.
   */
  async function answerPendingQuestion() {
    const answer = questionAnswer.trim();
    if (!pendingQuestion || !answer) return;
    setQuestionAnswer("");
    const target = pendingQuestion;
    setPendingQuestion(null);

    const goalId = target.goalId
      ?? (state.goals || []).find((goal) => goal.title === target.goalTitle)?.id;
    if (goalId === undefined) return;

    try {
      const response = await api.post(`/objectives/${goalId}/path/answer`, {
        answer,
        locale: navigator.language || 'pt-BR',
      }) as { status: string; question?: string | null };
      await refreshData();
      if (response.question) setPendingQuestion({ goalId, goalTitle: target.goalTitle, question: response.question });
    } catch (error) {
      showError(error instanceof Error ? error.message : l('Não foi possível salvar a resposta.', 'Could not save the answer.'));
    }
  }

  async function addAction(goalId: string | number, title: string) {
    try {
      const goal = goals.find((item) => String(item.id) === String(goalId));
      if (!goal) return;
      await api.post(`/objectives/${goalId}/actions`, { title, expectedVersion: goal.pathVersion ?? 1 });
      await refreshData();
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
    await refreshData();
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
      showSuccess(l("Objetivo arquivado.", "Goal archived."));
    } catch (error) {
      showError(error instanceof Error ? error.message : l("Não foi possível arquivar.", "Could not archive."));
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
          showError(error instanceof Error ? error.message : l("Não foi possível atualizar a ação.", "Could not update the action."));
        } finally {
          setCompletingActionId(null);
        }
      }}
      onAddAction={(title) => addAction(goal.id, title)}
      onRequestSuggestion={() => requestSuggestion(goal)}
      onAcceptSuggestion={(title) => addAction(goal.id, title)}
      onScheduleAction={async (actionId, date) => {
        try {
          await api.patch(`/objectives/${goal.id}/actions/${actionId}`, { expectedVersion: goal.pathVersion ?? 1, scheduledFor: date });
          await refreshData();
          showSuccess(l('Data da ação atualizada.', 'Action date updated.'));
        } catch (error) {
          showError(error instanceof Error ? error.message : l('Não foi possível atualizar a data.', 'Could not update the date.'));
        }
      }}
      onUpdateAction={async (actionId, patch) => {
        try {
          await api.patch(`/objectives/${goal.id}/actions/${actionId}`, {
            expectedVersion: goal.pathVersion ?? 1,
            ...patch,
          });
          await refreshData();
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
          const response = await api.post(`/objectives/${goal.id}/path/advance`, { expectedVersion: goal.pathVersion ?? 1, locale: navigator.language || 'pt-BR' }) as { question?: string | null };
          await refreshData();
          if (response.question) setPendingQuestion({ goalId: goal.id, goalTitle: goal.title, question: response.question });
        } catch (error) {
          showError(error instanceof Error ? error.message : l('Não foi possível abrir a próxima etapa.', 'Could not open the next stage.'));
        }
      }}
      onConfirmRevision={async () => {
        try {
          await api.post(`/objectives/${goal.id}/path/confirm-revision`, { expectedVersion: goal.pathVersion ?? 1 });
          await refreshData();
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
      isPrimary={String(goal.id) === primaryGoalId}
      onMakePrimary={() => {
        const next = String(goal.id) === primaryGoalId ? null : goal.id;
        void (async () => {
          try {
            await api.put('/objectives/primary', { objectiveId: next === null ? null : String(next) });
            await refreshData();
            setPrimaryGoalId(next === null ? null : String(next));
            showSuccess(next === null
              ? l('A Airia volta a sugerir o foco sem fixá-lo.', 'Airia will suggest focus again without pinning it.')
              : l('Esse é o seu objetivo em foco agora.', 'This is your focus goal now.'));
          } catch (error) {
            showError(error instanceof Error ? error.message : l('Não foi possível atualizar o foco.', 'Could not update focus.'));
          }
        })();
      }}
      onEditDeadline={async (deadline) => {
        try {
          await api.patch(`/objectives/${goal.id}`, { deadline });
          await refreshData();
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

      {/* Pergunta em vez de tarefa inventada.
          Quando a Airia não tem base para uma boa próxima ação, ela pergunta —
          uma pergunta, curta e decisiva, não uma bateria. A resposta vira
          contexto permanente do objetivo. */}
      {pendingQuestion && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", inset: 0, zIndex: 1200, display: "flex",
            alignItems: "flex-end", justifyContent: "center", padding: 16,
            background: "rgba(17,24,39,.32)", backdropFilter: "blur(6px)",
          }}
        >
          <div style={{
            width: "min(100%, 440px)", borderRadius: 22, padding: 18,
            background: "rgba(255,253,249,.98)", border: "1px solid var(--warm-border)",
            boxShadow: "0 24px 60px rgba(17,24,39,.18)",
          }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nectarine-11)" }}>
              {l("Para eu te ajudar direito", "So I can actually help")}
            </p>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.4 }}>
              {pendingQuestion.question}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--text-3)" }}>
              {l("Objetivo", "Goal")}: {pendingQuestion.goalTitle}
            </p>
            <textarea
              value={questionAnswer}
              onChange={(event) => setQuestionAnswer(event.target.value)}
              rows={3}
              maxLength={500}
              autoFocus
              placeholder={l("Responda com suas palavras", "Answer in your own words")}
              style={{
                width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 12,
                border: "1.5px solid var(--warm-border-2)", resize: "vertical", fontSize: 13,
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => { setPendingQuestion(null); setQuestionAnswer(""); }}
                style={{ ...quietButtonStyle, flex: 1, justifyContent: "center" }}
              >
                {l("Agora não", "Not now")}
              </button>
              <button
                type="button"
                onClick={() => { void answerPendingQuestion(); }}
                disabled={!questionAnswer.trim()}
                style={{
                  flex: 2, minHeight: 44, borderRadius: 999, border: 0,
                  background: "var(--accent-primary-strong, #8FC0A4)", color: "#2C5340",
                  fontSize: 14, fontWeight: 800,
                  cursor: questionAnswer.trim() ? "pointer" : "default",
                  opacity: questionAnswer.trim() ? 1 : 0.6,
                }}
              >
                {l("Responder", "Answer")}
              </button>
            </div>
          </div>
        </div>
      )}
      <RewardBurst reward={reward} onDone={() => setReward(null)} />
    </div>
  );
}

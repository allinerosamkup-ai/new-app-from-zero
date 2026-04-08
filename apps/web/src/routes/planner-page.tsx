// Planner Page v4 — notas+checklist unificados, AI buttons, recorrente com dias
import React, { useEffect, useMemo, useRef, useState } from "react";

import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
import { useToast } from "../components/Toast";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import {
  buildPlannerAgendaSlots,
  buildTimelineBlockInput,
  mapIntensityToEnergyLevel,
  normalizePlannerCategory,
  type TimelineBlockIntensity,
  type TimelineBlockStatus,
} from "./planner-page.helpers";
import {
  getTaskMeta,
  setTaskMeta,
  DEFAULT_RECURRING,
  type ChecklistItem,
  type NoteMode,
  type RecurringConfig,
} from "../utils/task-metadata";
import { getLocalNoonDate } from "../utils/day-context";
import "../styles/aura.css";
import "../styles/aura-v2.css";

const CATEGORY_OPTIONS = [
  { value: "trabalho" as const, label: "Trabalho", shortLabel: "TRABALHO", cor: "var(--lagune)", bg: "rgba(176,180,196,.14)", textColor: "var(--lagune-11)" },
  { value: "autocuidado" as const, label: "Autocuidado", shortLabel: "AUTOCUIDADO", cor: "var(--menthe)", bg: "rgba(180,185,169,.14)", textColor: "var(--menthe-11)" },
  { value: "social" as const, label: "Social", shortLabel: "SOCIAL", cor: "var(--social-color)", bg: "rgba(217,206,197,.18)", textColor: "var(--social-text)" },
  { value: "pessoal" as const, label: "Pessoal", shortLabel: "PESSOAL", cor: "var(--nectarine)", bg: "rgba(243,176,140,.14)", textColor: "var(--nectarine-11)" },
];

const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  height: "46px",
  borderRadius: "8px",
  border: "1.5px solid var(--warm-border-2)",
  padding: "0 14px",
  fontSize: "14px",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "var(--text-1)",
  background: "rgba(255,255,255,.72)",
  outline: "none",
  boxSizing: "border-box",
  backdropFilter: "blur(14px)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const PLANNER_SUMMARY_CARD_STYLE: React.CSSProperties = {
  borderRadius: 20,
  padding: "16px",
  marginBottom: "14px",
  background: "linear-gradient(135deg, rgba(243,176,140,.12), rgba(255,255,255,.58))",
  border: "1px solid rgba(255,255,255,.78)",
  boxShadow: "0 16px 38px rgba(243,176,140,.09), 0 1px 0 rgba(255,255,255,.82) inset",
};

const EMPTY_TIMELINE_CARD_STYLE: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "rgba(255,251,247,.78)",
  border: "1.5px dashed rgba(243,176,140,.22)",
  borderLeft: "4px solid rgba(243,176,140,.42)",
};

type FormState = {
  title: string;
  time: string;
  category: string;
  noteMode: NoteMode;
  note: string;
  checklist: ChecklistItem[];
  checklistInput: string;
  recurring: RecurringConfig;
  energyLevel: "alta" | "media" | "leve";
};

type PlannerTask = {
  id: string;
  title: string;
  time: string;
  endTime: string;
  done: boolean;
  category?: string | null;
  intensity?: string | null;
  status?: string | null;
};

const EMPTY_FORM: FormState = {
  title: "",
  time: "09:00",
  category: "pessoal",
  noteMode: "text",
  note: "",
  checklist: [],
  checklistInput: "",
  recurring: { ...DEFAULT_RECURRING },
  energyLevel: "media",
};

const DIAS = ["Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb.", "Dom."];
const MESES = ["Jan.", "Fev.", "Mar.", "Abr.", "Mai.", "Jun.", "Jul.", "Ago.", "Set.", "Out.", "Nov.", "Dez."];

function buildChecklistItems(items: string[]): ChecklistItem[] {
  return items
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      done: false,
    }));
}

function mergeChecklistItems(existing: ChecklistItem[], incoming: string[]): ChecklistItem[] {
  const seen = new Set(existing.map((item) => item.text.trim().toLowerCase()));
  const nextItems = incoming
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !seen.has(item.toLowerCase()));

  return [...existing, ...buildChecklistItems(nextItems)];
}

function resolveStoredNoteMode(note: string, checklist: ChecklistItem[]): NoteMode {
  return note.trim().length === 0 && checklist.length > 0 ? "checklist" : "text";
}

function formatDateLabel(date: Date) {
  return `${DIAS[date.getDay() === 0 ? 6 : date.getDay() - 1]}, ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createBaseDate() {
  return getLocalNoonDate();
}

function diffMinutes(start: string, end: string) {
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;
  const delta = endTotal - startTotal;

  return delta > 0 ? delta : 30;
}

function mapTaskFromApi(task: any): PlannerTask {
  return {
    id: String(task.id),
    title: task.title,
    time: task.startTime,
    endTime: task.endTime,
    done: task.status === "completed",
    category: task.category,
    intensity: task.intensity,
    status: task.status,
  };
}

function buildFormStateFromTask(task: PlannerTask): FormState {
  const meta = getTaskMeta(task.id);
  const checklist = meta.checklist ?? [];
  const note = meta.note ?? "";

  return {
    ...EMPTY_FORM,
    title: task.title,
    time: task.time,
    category: normalizePlannerCategory(task.category, task.title),
    note,
    checklist,
    noteMode: resolveStoredNoteMode(note, checklist),
    recurring: meta.recurring ?? { ...DEFAULT_RECURRING },
    energyLevel: meta.energyLevel ?? mapIntensityToEnergyLevel(task.intensity),
  };
}

const NoteSection = React.memo(function NoteSection({
  form,
  setForm,
  context,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  context: { title: string; category: string; energyLevel: FormState["energyLevel"] };
}) {
  const [aiLoading, setAiLoading] = useState<null | "content" | "split">(null);
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const { showError } = useToast();

  async function letAuraOrganize() {
    setAiLoading("content");
    try {
      const res = await api.post("/ai/suggest", {
        type: "task-content",
        context: { ...context, currentNote: form.note, currentChecklist: form.checklist.map((item) => item.text) },
      });

      if (!res.suggestion) return;

      const parsed = parseAiSuggestion<{ mode?: "note" | "checklist" | "mixed"; note?: string; items?: string[] }>(res.suggestion);
      setForm((current) => {
        const nextNote = parsed.note?.trim() || current.note;
        const nextChecklist = mergeChecklistItems(current.checklist, parsed.items || []);
        return {
          ...current,
          note: nextNote,
          checklist: nextChecklist,
          noteMode: resolveStoredNoteMode(nextNote, nextChecklist),
        };
      });
    } catch (error: any) {
      showError(error.message);
    } finally {
      setAiLoading(null);
    }
  }

  function toggleVoiceNote() {
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
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          transcript += event.results[index][0].transcript;
        }
      }
      if (!transcript) return;

      setForm((current) => ({
        ...current,
        note: current.note ? `${current.note} ${transcript}` : transcript,
      }));
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }

  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={LABEL_STYLE}>Notas e checklist</span>
        <AuraButtonV2 variant="outline" size="sm" onClick={letAuraOrganize} disabled={aiLoading !== null}>
          {aiLoading === "content" ? "Lendo..." : "Aura decide"}
        </AuraButtonV2>
      </div>
      <div style={{ position: "relative", marginBottom: "10px" }}>
        <textarea
          value={form.note}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          placeholder="Notas..."
          rows={3}
          style={{ ...INPUT_STYLE, width: "100%", height: "80px", padding: "10px" }}
        />
        <button
          onClick={toggleVoiceNote}
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            borderRadius: "50%",
            width: 28,
            height: 28,
            border: "none",
            background: isRecording ? "var(--menthe)" : "var(--warm-border)",
          }}
        >
          🎙️
        </button>
      </div>
    </div>
  );
});

function RecurringSection({
  recurring,
  setRecurring,
}: {
  recurring: RecurringConfig;
  setRecurring: (value: RecurringConfig) => void;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={LABEL_STYLE}>Recorrente</span>
        <input type="checkbox" checked={recurring.enabled} onChange={(event) => setRecurring({ ...recurring, enabled: event.target.checked })} />
      </div>
    </div>
  );
}

function PlannerSheetBody({
  form,
  setForm,
  onSave,
  onCancel,
  saveLabel,
  extraBtn,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  saveLabel: string;
  extraBtn?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        value={form.title}
        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        style={INPUT_STYLE}
        placeholder="Título"
      />
      <input
        type="time"
        value={form.time}
        onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
        style={INPUT_STYLE}
      />
      <NoteSection
        form={form}
        setForm={setForm}
        context={{
          title: form.title,
          category: form.category,
          energyLevel: form.energyLevel,
        }}
      />
      <RecurringSection recurring={form.recurring} setRecurring={(recurring) => setForm((current) => ({ ...current, recurring }))} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {extraBtn}
        <AuraButtonV2 variant="ghost" onClick={onCancel}>
          Cancelar
        </AuraButtonV2>
        <AuraButtonV2 variant="primary" onClick={onSave}>
          {saveLabel}
        </AuraButtonV2>
      </div>
    </div>
  );
}

export function PlannerPage() {
  const { refreshData } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const [offsetDias, setOffsetDias] = useState(0);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<FormState>({ ...EMPTY_FORM });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ ...EMPTY_FORM });
  const [todayAnchor, setTodayAnchor] = useState(() => createBaseDate());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTodayAnchor(createBaseDate());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const dataAtual = useMemo(() => {
    const date = new Date(todayAnchor);
    date.setDate(todayAnchor.getDate() + offsetDias);
    return date;
  }, [offsetDias, todayAnchor]);
  const selectedDateKey = useMemo(() => formatDateKey(dataAtual), [dataAtual]);
  const emptyAgendaSlots = useMemo(() => buildPlannerAgendaSlots([]), []);
  const agendaSlots = useMemo(() => buildPlannerAgendaSlots(plannerTasks), [plannerTasks]);
  const visibleAgendaSlots = plannerLoading ? emptyAgendaSlots : agendaSlots;
  const plannerSummary = plannerLoading
    ? "Montando a visualização da sua agenda."
    : plannerTasks.length === 0
      ? "Seu dia ainda está livre, mas a timeline continua visível para você organizar sem cair numa tela vazia."
      : `${plannerTasks.length} bloco${plannerTasks.length > 1 ? "s" : ""} organizado${plannerTasks.length > 1 ? "s" : ""} na sua agenda de hoje.`;
  const plannerBadgeLabel = plannerLoading
    ? "Carregando"
    : plannerTasks.length === 0
      ? "Agenda livre"
      : `${plannerTasks.length} bloco${plannerTasks.length > 1 ? "s" : ""}`;

  useEffect(() => {
    let ignore = false;

    async function loadPlannerTasks() {
      setPlannerLoading(true);
      try {
        const timeline = await api.get(`/timeline/${selectedDateKey}`);
        if (ignore) return;
        setPlannerTasks(Array.isArray(timeline) ? timeline.map(mapTaskFromApi) : []);
      } catch (error) {
        if (!ignore) {
          console.error("[planner/load] Failed to load timeline", error);
        }
      } finally {
        if (!ignore) {
          setPlannerLoading(false);
        }
      }
    }

    loadPlannerTasks();

    return () => {
      ignore = true;
    };
  }, [selectedDateKey]);

  async function reloadPlannerTasks() {
    const timeline = await api.get(`/timeline/${selectedDateKey}`);
    setPlannerTasks(Array.isArray(timeline) ? timeline.map(mapTaskFromApi) : []);
  }

  function closeNewForm() {
    setShowNewForm(false);
    setNewForm({ ...EMPTY_FORM });
  }

  function openNewFormAt(time: string) {
    setNewForm({ ...EMPTY_FORM, time });
    setShowNewForm(true);
  }

  function closeEditForm() {
    setEditingTaskId(null);
    setEditForm({ ...EMPTY_FORM });
  }

  function openEditForm(task: PlannerTask) {
    setEditingTaskId(task.id);
    setEditForm(buildFormStateFromTask(task));
  }

  async function handleAddBlock() {
    if (!newForm.title.trim()) return;

    try {
      const res: any = await api.post("/timeline", {
        date: selectedDateKey,
        forceSave: true,
        blocks: [buildTimelineBlockInput(newForm)],
      });

      const savedBlock = Array.isArray(res.savedBlocks) ? res.savedBlocks[0] : null;
      if (!savedBlock) return;

      setTaskMeta(savedBlock.id, {
        note: newForm.note,
        checklist: newForm.checklist,
        recurring: newForm.recurring,
        energyLevel: newForm.energyLevel,
      });

      await reloadPlannerTasks();
      await refreshData();
      closeNewForm();
      showSuccess("Bloco adicionado.");
    } catch (error: any) {
      showError(error.message);
    }
  }

  async function handleSaveEdit() {
    if (!editingTaskId) return;

    const currentTask = plannerTasks.find((task) => task.id === editingTaskId);
    if (!currentTask || !editForm.title.trim()) return;

    try {
      await api.post("/timeline", {
        date: selectedDateKey,
        forceSave: true,
        blocks: [
          buildTimelineBlockInput(editForm, {
            id: currentTask.id,
            durationMinutes: diffMinutes(currentTask.time, currentTask.endTime),
            fallbackIntensity: ((currentTask.intensity ?? "M").toUpperCase() as TimelineBlockIntensity),
            fallbackStatus: ((currentTask.status ?? (currentTask.done ? "completed" : "planned")) as TimelineBlockStatus),
          }),
        ],
      });

      setTaskMeta(currentTask.id, {
        note: editForm.note,
        checklist: editForm.checklist,
        recurring: editForm.recurring,
        energyLevel: editForm.energyLevel,
      });

      await reloadPlannerTasks();
      await refreshData();
      closeEditForm();
      showSuccess("Bloco salvo.");
    } catch (error: any) {
      showError(error.message);
    }
  }

  async function handleDeleteBlock() {
    if (!editingTaskId) return;

    try {
      await api.delete(`/timeline/${editingTaskId}`);
      await reloadPlannerTasks();
      await refreshData();
      closeEditForm();
      showSuccess("Bloco excluído.");
    } catch (error: any) {
      showError(error.message);
    }
  }

  return (
    <div style={{ flex: 1, padding: "20px", background: "var(--warm-bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <AuraButtonV2 onClick={() => setOffsetDias((current) => current - 1)}>‹ Anterior</AuraButtonV2>
        <span style={{ fontWeight: 700 }}>{formatDateLabel(dataAtual)}</span>
        <AuraButtonV2 onClick={() => setOffsetDias((current) => current + 1)}>Próximo ›</AuraButtonV2>
      </div>

      <div className="glass-card" style={PLANNER_SUMMARY_CARD_STYLE}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...LABEL_STYLE, color: "var(--nectarine-11)", marginBottom: 6 }}>Agenda</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.2 }}>Timeline do dia</h2>
            <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: "var(--text-3)" }}>{plannerSummary}</p>
          </div>
          <span
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 28,
              padding: "0 10px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--nectarine-11)",
              background: "var(--nectarine-a3)",
              border: "1px solid var(--nectarine-a5)",
            }}
          >
            {plannerBadgeLabel}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", paddingBottom: 88 }}>
        {visibleAgendaSlots.map((slot) => {
          if (slot.kind === "task") {
            const categoryOption = CATEGORY_OPTIONS.find((option) => option.value === slot.category) ?? CATEGORY_OPTIONS[3];

            return (
              <div key={slot.key} className="timeline-slot">
                <span className="timeline-time">{slot.time}</span>
                <div className="timeline-line" />
                <button
                  type="button"
                  className="timeline-block-card interactive-card"
                  onClick={() => openEditForm(slot.task)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    borderLeftColor: categoryOption.cor,
                    opacity: slot.task.done ? 0.74 : 1,
                  }}
                >
                  <div
                    className="block-title"
                    style={{
                      textDecoration: slot.task.done ? "line-through" : "none",
                    }}
                  >
                    {slot.task.title}
                  </div>
                  <div className="block-meta">
                    {slot.time} — {slot.endTime} · {slot.durationLabel}
                  </div>
                  <div
                    className="block-chip"
                    style={{
                      background: categoryOption.bg,
                      color: categoryOption.textColor,
                      border: `1px solid ${categoryOption.cor}33`,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: categoryOption.cor }} />
                    {categoryOption.shortLabel}
                  </div>
                </button>
              </div>
            );
          }

          return (
            <div key={slot.key} className="timeline-slot">
              <span className="timeline-time">{slot.time}</span>
              <div className="timeline-line" />
              <button
                type="button"
                className="timeline-block-card interactive-card"
                onClick={() => openNewFormAt(slot.time)}
                style={EMPTY_TIMELINE_CARD_STYLE}
              >
                <div className="block-title" style={{ color: "var(--text-2)" }}>
                  {slot.title}
                </div>
                <div className="block-meta" style={{ marginTop: 4, lineHeight: 1.6 }}>
                  {slot.description}
                </div>
                <div
                  className="block-chip"
                  style={{
                    background: "var(--nectarine-a3)",
                    color: "var(--nectarine-11)",
                    border: "1px solid var(--nectarine-a5)",
                  }}
                >
                  <span style={{ fontSize: 11, lineHeight: 1 }}>+</span>
                  Criar bloco
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <AuraButtonV2
        variant="outline"
        onClick={() => openNewFormAt("09:00")}
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          borderRadius: 999,
          padding: "0 18px",
          background: "rgba(255,253,249,.92)",
          boxShadow: "0 10px 28px rgba(243,176,140,.14)",
          zIndex: 20,
        }}
      >
        + Novo bloco
      </AuraButtonV2>

      {showNewForm ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <div style={{ background: "#fff", width: "100%", padding: 20, borderRadius: "20px 20px 0 0" }}>
            <h3>Novo Bloco</h3>
            <PlannerSheetBody form={newForm} setForm={setNewForm} onSave={handleAddBlock} onCancel={closeNewForm} saveLabel="Adicionar" />
          </div>
        </div>
      ) : null}

      {editingTaskId ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <div style={{ background: "#fff", width: "100%", padding: 20, borderRadius: "20px 20px 0 0" }}>
            <h3>Editar Bloco</h3>
            <PlannerSheetBody
              form={editForm}
              setForm={setEditForm}
              onSave={handleSaveEdit}
              onCancel={closeEditForm}
              saveLabel="Salvar"
              extraBtn={
                <AuraButtonV2 variant="ghost" onClick={handleDeleteBlock}>
                  Excluir
                </AuraButtonV2>
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

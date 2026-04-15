// Planner Page v4 — notas+checklist unificados, AI buttons, recorrente com dias
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Bell, Clock, Sparkles, Waves, Info, Star, Heart, Briefcase, Home, ShoppingCart, Coffee, Book, Music, Mic, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useLocation } from "react-router-dom";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useToast } from "../components/Toast";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
// AuraToggle removed — no longer needed in PlannerSheetBody
import { parseAiSuggestion } from "../lib/ai";
import {
  addMinutesToTime,
  subtractMinutesFromTime,
  buildGoogleCalendarTaskId,
  buildPlannerAgendaSlots,
  buildTimelineBlockInput,
  mapIntensityToEnergyLevel,
  normalizePlannerCategory,
  parseGoogleCalendarTaskId,
  resolveTaskCardSwipeAction,
  resolvePlannerBlockDate,
  shouldNavigateAgendaBySwipe,
  stripGoogleCalendarTaskTitle,
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
import { aggregateCheckinsByDay, computeMoodCycle } from "../utils/mood-cycle-engine";
import "../styles/aura.css";
import "../styles/editorial.css";

const CATEGORY_OPTIONS = [
  { value: "trabalho" as const, label: "Trabalho", shortLabel: "TRABALHO", cor: "var(--accent-sky)", bg: "rgba(176,180,196,.14)", textColor: "var(--accent-sky-ink)" },
  { value: "autocuidado" as const, label: "Autocuidado", shortLabel: "AUTOCUIDADO", cor: "var(--accent-sage)", bg: "rgba(180,185,169,.14)", textColor: "var(--accent-sage-ink)" },
  { value: "social" as const, label: "Social", shortLabel: "SOCIAL", cor: "var(--social-color)", bg: "rgba(229,219,247,.32)", textColor: "var(--social-text)" },
  { value: "pessoal" as const, label: "Pessoal", shortLabel: "PESSOAL", cor: "var(--accent-peach)", bg: "rgba(244,190,168,.30)", textColor: "var(--accent-peach-ink)" },
  { value: "casa" as const, label: "Casa", shortLabel: "CASA", cor: "var(--buttercup)", bg: "rgba(247,231,166,.38)", textColor: "#7C641A" }
];

function getCategoryStyles(val: string) {
  const norm = (val || "").trim().toLowerCase();
  const option = CATEGORY_OPTIONS.find(o => o.value === norm);
  if (option) return option;
  
  let sum = 0;
  for(let i=0; i<norm.length; i++) sum += norm.charCodeAt(i);
  const colorSet = [
    { cor: "#D9A0C3", bg: "rgba(217, 160, 195, 0.14)", textColor: "#7C4A6A" },
    { cor: "#F0C85A", bg: "rgba(240, 200, 90, 0.14)", textColor: "#8B6B15" },
    { cor: "#8CB3A8", bg: "rgba(140, 179, 168, 0.14)", textColor: "#446B60" },
    { cor: "#A5AADA", bg: "rgba(165, 170, 218, 0.14)", textColor: "#484E8F" },
  ];
  return {
    value: norm,
    label: val.toUpperCase(),
    shortLabel: val.toUpperCase(),
    ...colorSet[sum % colorSet.length]
  };
}

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
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.4)',
  border: '1px dashed rgba(17,24,39,0.08)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  textAlign: 'left',
  gap: 4,
  boxShadow: 'none',
};

function TimelineProgressIndicator({ nowMinutes, slots }: { nowMinutes: number; slots: any[] }) {
  // Glow effect based on current mood or generic warm tone
  return (
    <div style={{ position: "absolute", left: 4, top: 0, bottom: 0, width: 5, background: "rgba(17,24,39,0.02)", zIndex: 0, borderRadius: 99, overflow: 'hidden' }}>
       <div style={{
         position: "absolute", top: 0, left: 0, width: "100%",
         background: "linear-gradient(to bottom, var(--accent-peach) 0%, var(--accent-sky) 50%, var(--accent-sage) 100%)", 
         borderRadius: 99, transition: "height 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
         boxShadow: "0 0 15px var(--accent-peach-a3)",
         height: (() => {
            const firstSlot = slots[0];
            const lastSlot = slots[slots.length - 1];
            if (!firstSlot || !lastSlot) return "0%";
            const startMinutes = timeToMinutesValue(firstSlot.time);
            const lastMinutes = timeToMinutesValue(lastSlot.time) + 60; 
            const totalRange = lastMinutes - startMinutes;
            if (totalRange <= 0) return "0%";
            const progress = Math.max(0, Math.min(1, (nowMinutes - startMinutes) / totalRange));
            return `${progress * 100}%`;
         })()
       }} />
    </div>
  );
}

type FormState = {
  date: string;
  title: string;
  time: string;
  endTime: string;
  category: string;
  noteMode: NoteMode;
  note: string;
  checklist: ChecklistItem[];
  checklistInput: string;
  recurring: RecurringConfig;
  energyLevel: 1 | 2 | 3 | 4 | 5;
  lastResetDate?: string;
  persistentReminderEnabled: boolean;
  persistentReminderIntervalMinutes: number;
  vibrateEnabled: boolean;
  alarmEnabled: boolean;
  recurringNotificationEnabled: boolean;
  visualRepeatEnabled: boolean;
  icon?: string;
  color?: string;
  alerts: string[];
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
  source?: string;
  link?: string;
  noteMode?: NoteMode | null;
  note?: string | null;
  checklist?: ChecklistItem[] | null;
  recurring?: RecurringConfig | null;
  energyLevel?: 1 | 2 | 3 | 4 | 5 | null;
  lastResetDate?: string | null;
  persistentReminderEnabled?: boolean | null;
  persistentReminderIntervalMinutes?: number | null;
  vibrateEnabled?: boolean | null;
  alarmEnabled?: boolean | null;
  recurringNotificationEnabled?: boolean | null;
  isAiSuggested?: boolean | null;
  aiReasoning?: string | null;
  calendarId?: string | null;
  visualRepeatEnabled?: boolean | null;
  icon?: string | null;
  color?: string | null;
};

const EMPTY_FORM: FormState = {
  date: "",
  title: "",
  time: "09:00",
  endTime: "10:00",
  category: "pessoal",
  noteMode: "text",
  note: "",
  checklist: [],
  checklistInput: "",
  recurring: { ...DEFAULT_RECURRING },
  energyLevel: 3,
  persistentReminderEnabled: false,
  persistentReminderIntervalMinutes: 60,
  vibrateEnabled: true,
  alarmEnabled: false,
  recurringNotificationEnabled: false,
  visualRepeatEnabled: false,
  icon: "lucide-check",
  color: "var(--accent-peach)",
  alerts: ["start", "end", "before-15"],
};

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

function timeToMinutesValue(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesAsTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
    noteMode: normalizeNoteMode(task.noteMode),
    note: typeof task.note === "string" ? task.note : null,
    checklist: normalizeChecklist(task.checklist),
    recurring: normalizeRecurring(task.recurring),
    energyLevel: normalizeEnergyLevel(task.energyLevel),
    lastResetDate: typeof task.lastResetDate === "string" ? task.lastResetDate : null,
    persistentReminderEnabled: Boolean(task.persistentReminderEnabled),
    persistentReminderIntervalMinutes: typeof task.persistentReminderIntervalMinutes === "number" ? task.persistentReminderIntervalMinutes : null,
    vibrateEnabled: Boolean(task.vibrateEnabled),
    alarmEnabled: Boolean(task.alarmEnabled),
    recurringNotificationEnabled: Boolean(task.recurringNotificationEnabled),
    visualRepeatEnabled: Boolean(task.visualRepeatEnabled),
    icon: typeof task.icon === "string" ? task.icon : null,
    color: typeof task.color === "string" ? task.color : null,
    isAiSuggested: Boolean(task.isAiSuggested),
    aiReasoning: typeof task.aiReasoning === "string" ? task.aiReasoning : null,
  };
}

function mapGoogleCalendarEventFromApi(event: any, selectedDateKey: string): PlannerTask | null {
  const toLocalHHMM = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    } catch { return iso.slice(11, 16); }
  };

  const rawDate = event.start?.dateTime || event.start?.date || "";
  const eventDate = event.start?.date
    ? event.start.date
    : rawDate
      ? new Date(rawDate).toLocaleDateString("sv-SE")
      : "";

  if (eventDate !== selectedDateKey) return null;

  const startTime = event.start?.dateTime ? toLocalHHMM(event.start.dateTime) : "00:00";
  const endTime = event.end?.dateTime ? toLocalHHMM(event.end.dateTime) : "23:59";
  const summary = typeof event.summary === "string" && event.summary.trim() ? event.summary.trim() : "Evento";

  return {
    id: buildGoogleCalendarTaskId(event.calendarId ?? "primary", event.id),
    title: summary,
    time: startTime,
    endTime,
    category: "social",
    intensity: "L",
    status: event.airiaStatus === "completed" ? "completed" : "planned",
    done: event.airiaStatus === "completed",
    source: "gcal",
    link: event.link,
    calendarId: event.calendarId ?? "primary",
    note: event.note || "",
  };
}

function normalizeNoteMode(value: unknown): NoteMode | null {
  return value === "text" || value === "checklist" ? value : null;
}

function normalizeChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<ChecklistItem>;
      const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : "";
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
      if (!id || !text) return null;
      return { id, text, done: Boolean(candidate.done) };
    })
    .filter((item): item is ChecklistItem => item !== null);
}

function normalizeRecurring(value: unknown): RecurringConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<RecurringConfig>;
  const frequency = candidate.frequency === "weekly" || candidate.frequency === "custom" ? candidate.frequency : "daily";
  const days = Array.isArray(candidate.days)
    ? candidate.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const everyNDays = Number.isInteger(candidate.everyNDays) && Number(candidate.everyNDays) > 0
    ? Number(candidate.everyNDays)
    : 1;

  return {
    enabled: Boolean(candidate.enabled),
    frequency,
    days,
    everyNDays,
  };
}

function normalizeEnergyLevel(val: any): 1 | 2 | 3 | 4 | 5 {
  if (typeof val === "number") {
    if (val >= 1 && val <= 5) return val as 1 | 2 | 3 | 4 | 5;
    return 3;
  }
  if (val === "alta" || val === "P") return 4;
  if (val === "leve" || val === "L") return 2;
  return 3;
}

function hasApiMetadata(task: PlannerTask): boolean {
  const hasNote = typeof task.note === "string" && task.note.trim().length > 0;
  const hasChecklist = Array.isArray(task.checklist) && task.checklist.length > 0;
  const hasRecurring = Boolean(task.recurring?.enabled);
  const hasNonDefaultEnergy = task.energyLevel !== 3 && task.energyLevel !== null;
  const hasResetDate = Boolean(task.lastResetDate);
  const hasPersistentReminder = Boolean(task.persistentReminderEnabled);
  const hasVibrate = Boolean(task.vibrateEnabled);
  const hasAlarm = Boolean(task.alarmEnabled);

  return hasNote || hasChecklist || hasRecurring || hasNonDefaultEnergy || hasResetDate || hasPersistentReminder || hasVibrate || hasAlarm;
}

function buildFormStateFromTask(task: PlannerTask): FormState {
  const meta = getTaskMeta(task.id);
  const useApiMetadata = hasApiMetadata(task);
  const energyLevel = normalizeEnergyLevel(task.energyLevel ?? task.intensity);

  const note = useApiMetadata
    ? (typeof task.note === "string" ? task.note : "")
    : (meta.note ?? "");
  const checklist = useApiMetadata
    ? normalizeChecklist(task.checklist)
    : (meta.checklist ?? []);
  const recurring = useApiMetadata
    ? (normalizeRecurring(task.recurring) ?? { ...DEFAULT_RECURRING })
    : (meta.recurring ?? { ...DEFAULT_RECURRING });

  return {
    ...EMPTY_FORM,
    date: "",
    title: task.source === "gcal" ? stripGoogleCalendarTaskTitle(task.title) : task.title,
    time: task.time,
    endTime: task.endTime,
    category: normalizePlannerCategory(task.category, task.title),
    note,
    checklist,
    noteMode: useApiMetadata ? (task.noteMode ?? resolveStoredNoteMode(note, checklist)) : (meta.noteMode ?? resolveStoredNoteMode(note, checklist)),
    recurring,
    energyLevel,
    lastResetDate: useApiMetadata ? task.lastResetDate ?? undefined : meta.lastResetDate,
    persistentReminderEnabled: useApiMetadata ? Boolean(task.persistentReminderEnabled) : Boolean(meta.persistentReminderEnabled),
    persistentReminderIntervalMinutes: useApiMetadata
      ? (task.persistentReminderIntervalMinutes ?? 60)
      : (meta.persistentReminderIntervalMinutes ?? 60),
    vibrateEnabled: useApiMetadata ? Boolean(task.vibrateEnabled) : Boolean(meta.vibrateEnabled),
    alarmEnabled: useApiMetadata ? Boolean(task.alarmEnabled) : Boolean(meta.alarmEnabled),
    recurringNotificationEnabled: useApiMetadata ? Boolean(task.recurringNotificationEnabled) : Boolean(meta.recurringNotificationEnabled),
    visualRepeatEnabled: useApiMetadata ? Boolean(task.visualRepeatEnabled) : Boolean(meta.visualRepeatEnabled),
    icon: (useApiMetadata ? task.icon : meta.icon) || "lucide-check",
    color: (useApiMetadata ? task.color : meta.color) || "var(--accent-peach)",
    alerts: [],
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
        context: { 
          ...context, 
          currentNote: `[SYSTEM: Use OBRIGATORIAMENTE o título "${context.title}" como base única. Não sugira nada aleatório. Foque apenas em desdobramentos e detalhes do que está escrito no título. Notas atuais: ${form.note}]`, 
          currentChecklist: form.checklist.map((item) => item.text) 
        },
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

  async function splitIntoSubtasks() {
    setAiLoading("split");
    try {
      const res = await api.post("/ai/suggest", {
        type: "task-content",
        context: { 
          ...context, 
          currentNote: `[SYSTEM: Ignore notes. Use OBRIGATORIAMENTE o título "${context.title}" como base. Split em sub-tarefas altamente acionáveis e específicas APENAS para este título. JSON items array.]`, 
          currentChecklist: [] 
        },
      });

      if (!res.suggestion) return;

      const parsed = parseAiSuggestion<{ items?: string[] }>(res.suggestion);
      setForm((current) => {
        const nextChecklist = mergeChecklistItems(current.checklist, parsed.items || []);
        return {
          ...current,
          checklist: nextChecklist,
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
        <span style={LABEL_STYLE}>Algum detalhe?</span>
        <div style={{ display: "flex", gap: 6 }}>
          <AuraButtonV2 variant="outline" size="sm" onClick={letAuraOrganize} disabled={aiLoading !== null}>
            {aiLoading === "content" ? "Lendo..." : "Airia"}
          </AuraButtonV2>
          <AuraButtonV2 variant="outline" size="sm" onClick={splitIntoSubtasks} disabled={aiLoading !== null}>
            {aiLoading === "split" ? "Splitando..." : "Split Tarefa"}
          </AuraButtonV2>
        </div>
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
            background: isRecording ? "var(--accent-sage)" : "var(--warm-border)",
          }}
        >
          🎙️
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={form.checklistInput}
          onChange={(e) => setForm(c => ({ ...c, checklistInput: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = form.checklistInput.trim();
              if (val) {
                setForm(c => ({ ...c, checklist: [...c.checklist, ...buildChecklistItems([val])], checklistInput: "" }));
              }
            }
          }}
          placeholder="Adicionar item..."
          style={{ ...INPUT_STYLE, height: "38px" }}
        />
        <button
          onClick={() => {
            const val = form.checklistInput.trim();
            if (val) {
              setForm(c => ({ ...c, checklist: [...c.checklist, ...buildChecklistItems([val])], checklistInput: "" }));
            }
          }}
          style={{
            padding: "0 16px", borderRadius: "8px", border: "none",
            background: "rgba(244,190,168,0.2)", color: "var(--accent-peach-ink)",
            fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap"
          }}
        >
          Adicionar Subtarefa
        </button>
      </div>
      {form.checklist.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {form.checklist.map((item, idx) => (
            <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-1)' }}>
              <input 
                type="checkbox" 
                checked={item.done}
                onChange={(e) => {
                  const lst = [...form.checklist];
                  lst[idx] = { ...item, done: e.target.checked };
                  setForm(cur => ({...cur, checklist: lst}));
                }}
                style={{ width: 16, height: 16, accentColor: 'var(--accent-peach)' }}
              />
              <span style={{ textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.5 : 1, transition: 'all 0.2s' }}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
});

const DIAS_RECORRENCIA = [
  { label: "D", val: 6 },
  { label: "S", val: 0 },
  { label: "T", val: 1 },
  { label: "Q", val: 2 },
  { label: "Q", val: 3 },
  { label: "S", val: 4 },
  { label: "S", val: 5 },
];

function RecurringSection({
  recurring,
  setRecurring,
}: {
  recurring: RecurringConfig;
  setRecurring: (value: RecurringConfig) => void;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em" }}>Repetir nos dias</span>
        <span style={{ fontSize: 10, color: "var(--accent-peach)", fontWeight: 700 }}>{recurring.days.length} DIAS</span>
      </div>
      <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
        {DIAS_RECORRENCIA.map(d => {
          const isSelected = recurring.days.includes(d.val);
          return (
             <button
               key={d.val}
               type="button"
               onClick={() => {
                 const cur = new Set(recurring.days);
                 if (cur.has(d.val)) cur.delete(d.val);
                 else cur.add(d.val);
                 setRecurring({ ...recurring, days: Array.from(cur) });
               }}
               style={{
                 width: 38, height: 38, borderRadius: '12px', border: '1.5px solid transparent',
                 background: isSelected ? 'var(--accent-peach)' : 'var(--surface-variant)',
                 color: isSelected ? '#fff' : 'var(--text-2)',
                 fontWeight: 800, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
                 boxShadow: isSelected ? '0 4px 12px rgba(244,190,168,0.25)' : 'none'
               }}
             >{d.label}</button>
          )
        })}
      </div>
    </div>
  );
}


const ICON_GRID = [
  "✅", "📅", "🕐", "⭐", "❤️", "💼", "🏠", "🛒",
  "☕", "💪", "📚", "🎵", "🏃", "🧘", "🎯", "🔥", "✍️", "💡"
];

const COLOR_GRID = [
  "var(--accent-peach)", "#E8A0A0", "#E8C080", "#C8D8A0", "var(--accent-sky)", "var(--accent-sage)", "#D9A0C3", "#A5AADA"
];

const ALERT_PRESETS: { id: string; label: string }[] = [
  { id: "start", label: "No início de tarefas" },
  { id: "end", label: "Ao final de tarefas" },
  { id: "before-15", label: "15m antes do início" },
  { id: "before-30", label: "30m antes do início" },
  { id: "before-60", label: "1h antes do início" },
];

const ENERGY_GRAY = "#C5B5A8";

function renderEnergyIcon(level: number, color: string) {
  switch (level) {
    case 1: return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19c-3.5 0-6-2.5-6-6 0-4.5 6-10 6-10s6 5.5 6 10c0 3.5-2.5 6-6 6z"/>
        <path d="M12 19c-1.5 0-2.5-1.2-2.5-3s2.5-4 2.5-4 2.5 2.2 2.5 4-1 3-2.5 3z"/>
      </svg>
    );
    case 2: return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>
      </svg>
    );
    case 3: return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    );
    case 4: return (
      <svg width="24" height="20" viewBox="0 0 30 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M10 2L3 12h6l-1 8 7-10H9l3-8z"/><path d="M22 2l-7 10h6l-1 8 7-10h-6l3-8z"/>
      </svg>
    );
    case 5: return (
      <svg width="24" height="20" viewBox="0 0 28 22" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <path d="M2 6c3-2.5 5 2.5 8 0s5 2.5 8 0s5 2.5 8 0"/>
        <path d="M2 11c3-2.5 5 2.5 8 0s5 2.5 8 0s5 2.5 8 0"/>
        <path d="M2 16c3-2.5 5 2.5 8 0s5 2.5 8 0s5 2.5 8 0"/>
      </svg>
    );
    default: return null;
  }
}

function PlannerSheetBody({
  form,
  setForm,
  onSave,
  onCancel: _onCancel,
  saveLabel,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  saveLabel: string;
}) {
  void _onCancel; // kept in contract for parent callers
  const [showConfig, setShowConfig] = useState(false);
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const titleEmpty = !form.title.trim();

  const STITLE: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 800,
    color: "var(--text-2)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "12px",
    display: "block",
  };

  const INPUT_WRAP: React.CSSProperties = {
    background: "var(--surface-variant)",
    borderRadius: "16px",
    padding: "14px 18px",
    border: "1px solid var(--outline-variant)",
    width: "100%",
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text-1)",
    outline: "none",
    transition: "all 0.2s",
  };

  const currentDuration = diffMinutes(form.time, form.endTime);
  const setDuration = (mins: number) => {
    setForm(prev => ({ ...prev, endTime: addMinutesToTime(prev.time, mins) }));
  };

  const frequency = !form.recurring.enabled ? "once"
    : form.recurring.frequency === "daily" ? "daily"
    : form.recurring.frequency === "weekly" ? "weekly"
    : (form.recurring.everyNDays ?? 0) >= 28 ? "monthly"
    : "once";

  function setFrequency(f: string) {
    setForm(c => ({
      ...c,
      recurring: f === "once"
        ? { ...DEFAULT_RECURRING, enabled: false }
        : f === "daily"
          ? { enabled: true, frequency: "daily" as const, days: [0,1,2,3,4,5,6], everyNDays: 1 }
          : f === "weekly"
            ? { enabled: true, frequency: "weekly" as const, days: c.recurring.days.length > 0 ? c.recurring.days : [1,2,3,4,5], everyNDays: 1 }
            : { enabled: true, frequency: "custom" as const, days: [], everyNDays: 30 }
    }));
  }

  const dateDisplay = form.date ? (() => { const [y, m, d] = form.date.split("-"); return `${d}/${m}/${y}`; })() : "Hoje";

  const contextBefore = [
    subtractMinutesFromTime(form.time, 30),
    subtractMinutesFromTime(form.time, 15),
  ].filter(t => t !== form.time);
  
  const contextAfter = [
    addMinutesToTime(form.endTime, 0), // current end
    addMinutesToTime(form.endTime, 15),
  ].filter(t => t !== form.time);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px", paddingBottom: "40px" }}>
      
      {/* ── 1. Título + Ícone ── */}
      <section>
        <label style={STITLE}>O que vamos realizar?</label>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            style={{
              width: 48, height: 48, borderRadius: 16, border: "1.5px solid var(--outline-variant)",
              background: "var(--surface-variant)", color: form.color || "var(--accent-peach)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              cursor: "pointer", flexShrink: 0
            }}
          >
            {form.icon ? <span style={{ fontSize: 22 }}>{form.icon}</span> : <Sparkles size={20} />}
          </button>
          <input
            value={form.title}
            onChange={(e) => setForm(c => ({ ...c, title: e.target.value }))}
            onBlur={() => setTitleTouched(true)}
            style={{
              ...INPUT_WRAP,
              fontSize: "20px", fontWeight: 800, border: "none",
              borderBottom: `2px solid ${titleTouched && titleEmpty ? "var(--accent-peach)" : "var(--outline-variant)"}`,
              borderRadius: 0, background: "transparent", padding: "8px 0"
            }}
            placeholder="Ex: Treino de perna"
            autoFocus
          />
        </div>
        {showConfig && (
          <div style={{ marginTop: 16, background: "var(--surface-variant)", padding: 16, borderRadius: 20, border: "1px solid var(--outline-variant)" }}>
             <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ICON_GRID.map(ic => (
                  <button key={ic} type="button" onClick={() => { setForm(c => ({...c, icon: ic})); setShowConfig(false); }} style={{
                    width: 36, height: 36, borderRadius: 10, border: form.icon === ic ? "2px solid var(--accent-peach)" : "none",
                    background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <span style={{ fontSize: 18 }}>{ic}</span>
                  </button>
                ))}
             </div>
          </div>
        )}
      </section>

      {/* ── 2. Horário & Data ── */}
      <section>
        <label style={STITLE}>Horário & Data</label>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "10px 0" }}>
          {contextBefore.map((t) => (
            <button key={t} type="button" onClick={() => { const d = currentDuration; setForm(c => ({ ...c, time: t, endTime: addMinutesToTime(t, d) })); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 8px", fontSize: 13, fontWeight: 600, color: "var(--text-3)", opacity: 0.4 }}
            >{t}</button>
          ))}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => timeInputRef.current?.showPicker?.() ?? timeInputRef.current?.click()}
              style={{
                background: "var(--accent-peach)", color: "#fff",
                padding: "14px 28px", borderRadius: "18px", fontSize: "18px", fontWeight: 800,
                boxShadow: "0 8px 24px rgba(244,168,150,0.3)",
                display: "flex", alignItems: "center", gap: 8, border: "none", cursor: "pointer"
              }}
            >
              <Clock size={18} /> {form.time}
            </button>
            <input
              ref={timeInputRef}
              type="time"
              value={form.time}
              onChange={(e) => {
                if (!e.target.value) return;
                const d = currentDuration;
                setForm(c => ({ ...c, time: e.target.value, endTime: addMinutesToTime(e.target.value, d) }));
              }}
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
            />
          </div>
          {contextAfter.slice(1).map((t) => (
            <button key={t} type="button" onClick={() => { const d = currentDuration; setForm(c => ({ ...c, time: t, endTime: addMinutesToTime(t, d) })); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 8px", fontSize: 13, fontWeight: 600, color: "var(--text-3)", opacity: 0.4 }}
            >{t}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            style={{ background: "var(--surface-variant)", padding: "8px 16px", borderRadius: "12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--outline-variant)", cursor: "pointer" }}
          >
            <Calendar size={14} color="var(--accent-peach)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{dateDisplay}</span>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={form.date}
            onChange={(e) => setForm(c => ({ ...c, date: e.target.value }))}
            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
          />
        </div>
      </section>

      {/* ── 3. Duração ── */}
      <section>
        <label style={STITLE}>Quanto tempo?</label>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
          background: "var(--surface-variant)", padding: "6px", borderRadius: "18px", border: "1px solid var(--outline-variant)"
        }}>
          {[15, 30, 45, 60, 90].map(mins => {
            const isSel = currentDuration === mins;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => setDuration(mins)}
                style={{
                  padding: "12px 0", borderRadius: "12px", fontSize: "13px", fontWeight: 800,
                  background: isSel ? "#fff" : "transparent",
                  color: isSel ? "var(--accent-peach)" : "var(--text-3)",
                  border: "none", cursor: "pointer", transition: "all 0.2s",
                  boxShadow: isSel ? "0 4px 12px rgba(0,0,0,0.05)" : "none"
                }}
              >
                {mins}m
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 4. Quanta energia? ── */}
      <section>
        <h4 style={STITLE}>Quanta energia exige?</h4>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
          background: "var(--surface-variant)", padding: 8, borderRadius: 20, border: "1px solid var(--outline-variant)"
        }}>
          {([1,2,3,4,5] as const).map(level => {
            const isSel = form.energyLevel === level;
            const labels = ["Exausto", "Baixo", "Médio", "Alto", "Pico"];
            return (
              <button
                key={level}
                type="button"
                onClick={() => setForm(c => ({ ...c, energyLevel: level }))}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "10px 0", borderRadius: 14, border: "none",
                  background: isSel ? "#fff" : "transparent",
                  boxShadow: isSel ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                  cursor: "pointer", transition: "all 0.25s", gap: 6
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isSel ? "var(--accent-peach)" : "transparent",
                  transition: "all 0.25s"
                }}>
                  {renderEnergyIcon(level, isSel ? "#fff" : "var(--text-3)")}
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, color: isSel ? "var(--accent-peach)" : "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  {labels[level - 1]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 5. Categoria ── */}
      <section>
        <label style={STITLE}>Categoria</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CATEGORY_OPTIONS.map(opt => {
            const isSel = form.category === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(c => ({ ...c, category: opt.value }))}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: "16px",
                  border: isSel ? `2px solid ${opt.cor}` : "1.5px solid var(--outline-variant)",
                  background: isSel ? opt.bg : "var(--surface-variant)",
                  cursor: "pointer", transition: "all 0.2s"
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: opt.cor }} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: isSel ? opt.textColor : "var(--text-2)" }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 6. Cor Personalizada ── */}
      <section>
        <label style={STITLE}>Cor do Bloco</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {COLOR_GRID.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setForm(c => ({ ...c, color }))}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: color, border: form.color === color ? "3px solid #fff" : "none",
                boxShadow: form.color === color ? `0 0 0 2px ${color}` : "none",
                cursor: "pointer", transition: "all 0.2s"
              }}
            />
          ))}
        </div>
      </section>

      {/* ── 6. Alertas ── */}
      <section>
        <label style={STITLE}>Alertas</label>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {form.alerts.map((alertId) => {
            const preset = ALERT_PRESETS.find(p => p.id === alertId);
            const label = preset ? preset.label : alertId;
            return (
              <div key={alertId} style={{ 
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", background: "var(--surface-variant)", borderRadius: "14px",
                border: "1px solid var(--outline-variant)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Bell size={16} color="var(--accent-peach)" />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)" }}>{label}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setForm(c => ({ ...c, alerts: c.alerts.filter(a => a !== alertId) }))}
                  style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}
                >
                  <Trash2 size={16} color="var(--text-3)" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowAddAlert(!showAddAlert)}
          style={{
            width: "100%", padding: "12px", borderRadius: "14px", border: "1.5px dashed var(--accent-peach)",
            background: "rgba(244,190,168,0.05)", color: "var(--accent-peach-ink)",
            fontSize: "14px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}
        >
          <Plus size={18} /> Adicionar Alerta
        </button>

        {showAddAlert && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, background: "var(--surface-variant)", padding: 12, borderRadius: 16, border: "1px solid var(--outline-variant)" }}>
            {ALERT_PRESETS.filter(p => !form.alerts.includes(p.id)).map(p => (
              <button key={p.id} type="button" onClick={() => {
                setForm(c => ({ ...c, alerts: [...c.alerts, p.id] }));
                setShowAddAlert(false);
              }} style={{
                textAlign: "left", padding: "12px", borderRadius: "10px", border: "none", background: "#fff",
                fontSize: "13px", fontWeight: 700, color: "var(--text-1)", cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
              }}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── 7. Recorrência ── */}
      <section>
        <label style={STITLE}>Repetir compromisso</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["once", "daily", "weekly", "monthly"].map(f => (
            <button key={f} type="button" onClick={() => setFrequency(f)}
              style={{ 
                flex: 1, padding: "10px", borderRadius: "12px", fontSize: "12px", fontWeight: 800,
                background: frequency === f ? "var(--accent-peach)" : "var(--surface-variant)",
                color: frequency === f ? "#fff" : "var(--text-3)",
                border: "1px solid var(--outline-variant)"
              }}
            >
              {f === "once" ? "Uma vez" : f === "daily" ? "Diária" : f === "weekly" ? "Semanal" : "Mensal"}
            </button>
          ))}
        </div>

        {frequency === "weekly" && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
            {[
              { label: "D", val: 0 }, { label: "S", val: 1 }, { label: "T", val: 2 },
              { label: "Q", val: 3 }, { label: "Q", val: 4 }, { label: "S", val: 5 }, { label: "S", val: 6 }
            ].map(d => {
              const isSel = form.recurring.days.includes(d.val);
              return (
                <button key={d.val} type="button" 
                  onClick={() => {
                    const days = form.recurring.days.includes(d.val) 
                      ? form.recurring.days.filter(v => v !== d.val)
                      : [...form.recurring.days, d.val];
                    setForm(c => ({ ...c, recurring: { ...c.recurring, days, enabled: true, frequency: "weekly" } }));
                  }}
                  style={{ 
                    width: 36, height: 36, borderRadius: "50%", fontSize: "12px", fontWeight: 800,
                    background: isSel ? "var(--accent-peach)" : "var(--surface-variant)",
                    color: isSel ? "#fff" : "var(--text-3)",
                    border: "1px solid var(--outline-variant)", cursor: "pointer"
                  }}
                >{d.label}</button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 7. Notas & Checklist ── */}
      <section>
        <h4 style={STITLE}>Notas e Detalhes</h4>
        <NoteSection
          form={form}
          setForm={setForm}
          context={{ title: form.title, category: form.category, energyLevel: form.energyLevel }}
        />
      </section>

      {/* ── 8. Ações ── */}
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <AuraButtonV2
          onClick={() => { setTitleTouched(true); if (!titleEmpty) onSave(); }}
          style={{
            flex: 1, padding: "18px", borderRadius: "18px", fontSize: "16px", fontWeight: 800,
            opacity: titleEmpty ? 0.5 : 1,
          }}
        >
          {saveLabel}
        </AuraButtonV2>
      </div>
      {titleTouched && titleEmpty && (
        <p style={{ fontSize: 12, color: "var(--accent-peach)", textAlign: "center", marginTop: -8 }}>
          Dá um nome pra tarefa primeiro
        </p>
      )}
    </div>
  );
}

function WeeklyAgendaHeader({ todayAnchor, offsetDias, setOffsetDias }: { todayAnchor: Date; offsetDias: number; setOffsetDias: (v: any) => void }) {
  const headerDateRef = useRef<HTMLInputElement>(null);
  const selectedDate = new Date(todayAnchor);
  selectedDate.setDate(selectedDate.getDate() + offsetDias);
  const selectedDateDateString = selectedDate.toDateString();

  const currentDayOfWeek = selectedDate.getDay(); 
  const startOfWeek = new Date(selectedDate);
  startOfWeek.setDate(selectedDate.getDate() - currentDayOfWeek);

  const days = Array.from({length: 7}).map((_, i) => {
     const d = new Date(startOfWeek);
     d.setDate(d.getDate() + i);
     return d;
  });

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [y, m, day] = e.target.value.split('-').map(Number);
    const date = new Date(y, m - 1, day);
    const diffTime = Math.round((date.getTime() - todayAnchor.getTime()) / (1000 * 3600 * 24));
    setOffsetDias(diffTime);
  };

  const yyyy = selectedDate.getFullYear();
  const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const dd = String(selectedDate.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}-${mm}-${dd}`;

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button 
           style={{ border: 'none', background: 'var(--surface-variant)', borderRadius: "50%", width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
           onClick={() => setOffsetDias((c: number) => c - 7)}
        >
          <ChevronLeft size={18} color="var(--text-1)" />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, textTransform: 'capitalize', color: 'var(--text-1)', letterSpacing: "-0.01em" }}>
            {selectedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          
          <button
            type="button"
            onClick={() => headerDateRef.current?.showPicker?.() ?? headerDateRef.current?.click()}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: "50%", background: "var(--surface-variant)", border: "none", cursor: "pointer" }}
          >
            <Calendar size={14} color="var(--text-2)" />
            <input
              ref={headerDateRef}
              type="date"
              style={{ position: 'absolute', opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
              onChange={handleDateChange}
              value={formattedDate}
            />
          </button>
        </div>

        <button 
           style={{ border: 'none', background: 'var(--surface-variant)', borderRadius: "50%", width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
           onClick={() => setOffsetDias((c: number) => c + 7)}
        >
          <ChevronRight size={18} color="var(--text-1)" />
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        {days.map(d => {
          const isSelected = d.toDateString() === selectedDateDateString;
          const isToday = d.toDateString() === todayAnchor.toDateString();
          const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
          return (
            <div 
              key={d.toISOString()} 
              onClick={() => {
                const timeDiff = d.getTime() - todayAnchor.getTime();
                setOffsetDias(Math.round(timeDiff / (1000 * 3600 * 24)));
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '10px 0', borderRadius: 16, flex: 1,
                background: isSelected ? 'var(--accent-peach)' : 'var(--surface-variant)',
                color: isSelected ? '#fff' : 'var(--text-1)',
                cursor: 'pointer',
                transition: "all 0.2s",
                boxShadow: isSelected ? '0 8px 16px rgba(244,190,168,0.25)' : 'none'
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-3)', letterSpacing: "0.05em" }}>
                {DIAS_CURTOS[d.getDay()]}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{d.getDate()}</span>
              {isToday && <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : 'var(--accent-peach)', marginTop: 2 }} />}
            </div>
          )
        })}
      </div>
    </div>
  );
}

function EnergyBattery({ used, capacity }: { used: number; capacity: number }) {
  const percent = Math.min(100, Math.max(0, (used / capacity) * 100));
  const isOver = used > capacity;
  
  return (
    <div className="glass-card" style={{ 
      padding: "16px", borderRadius: 20, 
      display: "flex", flexDirection: "column", gap: 10,
      marginBottom: 24,
      background: "linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0.4))",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ 
            width: 28, height: 28, borderRadius: 8, 
            background: isOver ? "var(--accent-peach-a3)" : "var(--accent-sage-a3)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <span style={{ fontSize: 14 }}>{isOver ? "⚠️" : "🔋"}</span>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: isOver ? "var(--accent-peach-ink)" : "var(--accent-sage-ink)" }}>
              {isOver ? "Limite Excedido" : "Energia Disponível"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-1)" }}>
            {used.toFixed(0)} <span style={{ opacity: 0.4, fontWeight: 600, fontSize: 10 }}>/ {capacity.toFixed(0)} UP</span>
          </span>
        </div>
      </div>
      <div style={{ height: 8, background: "rgba(0,0,0,0.04)", borderRadius: 10, overflow: "hidden", position: "relative" }}>
        <div style={{ 
          position: "absolute", left: 0, top: 0, bottom: 0, 
          width: `${percent}%`, 
          background: isOver ? "var(--accent-peach)" : "var(--accent-sage)",
          borderRadius: 10, transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
        }} />
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--text-2)", lineHeight: 1.5, fontWeight: 500 }}>
        {isOver 
          ? "Você ultrapassou seu limite planejado. Tente delegar ou adiar blocos pesados."
          : `Você ainda tem ${(capacity - used).toFixed(0)} UP para investir hoje sem esgotamento.`}
      </p>
    </div>
  );
}

function SwipeableTaskCard({ slot, categoryOption, onClick, onComplete, onDelete, onDragStart }: any) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const lastDelta = useRef({ deltaX: 0, deltaY: 0 });
  
  const isGcal = slot.task.source === 'gcal';

  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    lastDelta.current = { deltaX: 0, deltaY: 0 };
    setDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const diff = e.touches[0].clientX - startX.current;
    const deltaY = startY.current === null ? 0 : e.touches[0].clientY - startY.current;
    lastDelta.current = { deltaX: diff, deltaY };
    const isHorizontal = Math.abs(diff) > 16 && Math.abs(diff) > Math.abs(deltaY) * 1.35;

    if (!isHorizontal) {
      setOffset(0);
      return;
    }

    e.stopPropagation();
    setOffset(Math.max(-120, Math.min(120, diff)));
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.stopPropagation();
    setDragging(false);
    startX.current = null;
    startY.current = null;
    const action = resolveTaskCardSwipeAction(lastDelta.current);
    if (action === "complete") {
      onComplete(slot.task);
    } else if (action === "delete") {
      onDelete(slot.task);
    }
    setOffset(0);
    lastDelta.current = { deltaX: 0, deltaY: 0 };
  }

  return (
    <div 
       style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 18, background: "transparent", marginBottom: "10px" }}
       draggable
onDragStart={(e) => {
          onDragStart(e, slot.task.id);
        }}
    >
      <div style={{ 
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, 
        display: 'flex', alignItems: 'center', 
        justifyContent: offset < 0 ? 'flex-end' : 'flex-start', 
        padding: '0 28px', color: '#fff', zIndex: 0, borderRadius: 18, 
        transition: 'all 0.2s ease', 
        background: offset === 0 ? 'transparent' : (offset < 0 ? 'var(--accent-sage)' : 'var(--accent-peach)'),
        opacity: Math.abs(offset) > 10 ? 1 : 0
      }}>
         <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>{offset < 0 ? 'Concluir' : 'Excluir'}</span>
      </div>
      <div
        role="button"
        tabIndex={0}
        className="timeline-block-card interactive-card glass-card"
        onClick={() => { 
          if(Math.abs(offset) < 10) onClick(); 
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: "100%", textAlign: "left", 
          border: `1px solid ${categoryOption.cor}44`,
          borderLeft: `4px solid ${categoryOption.cor}`,
          borderRadius: 18,
          opacity: slot.task.done ? 0.55 : 1, 
          transform: `translateX(${offset}px)`, 
          transition: dragging ? 'none' : 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)', 
          position: 'relative', 
          zIndex: 1, 
          background: '#FFFFFF',
          cursor: 'pointer',
          touchAction: "pan-y",
          padding: "18px 20px",
          boxShadow: slot.task.done ? 'none' : '0 10px 40px rgba(0,0,0,0.06)',
          display: "flex",
          gap: 18,
          alignItems: "center"
        }}
      >
        {/* Energy Icon em destaque à esquerda */}
        <div style={{ 
          width: 46, height: 46, borderRadius: 14, 
          background: slot.task.done ? 'var(--surface-variant)' : `${categoryOption.cor}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          flexShrink: 0,
          border: slot.task.done ? 'none' : `1.5px solid ${categoryOption.cor}30`
        }}>
           { (() => { 
                const meta = getTaskMeta(slot.task.id);
                const rawLvl = meta.energyLevel || slot.task.energyLevel || 3;
                const lvl = normalizeEnergyLevel(rawLvl);
                if (lvl === 1) return '🌸';
                if (lvl === 2) return '🎯';
                if (lvl === 3) return '⚡';
                if (lvl === 4) return '⚡⚡';
                if (lvl === 5) return '🔥';
                return '⚡';
           })() }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {isGcal && (
            <div style={{ fontSize: 9, color: categoryOption.cor, display: "flex", alignItems: "center", gap: 4, fontWeight: 800, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <img src="https://www.google.com/favicon.ico" width={10} height={10} alt="GCal" style={{ filter: 'grayscale(0.2)' }} /> Google Agenda
            </div>
          )}
          <div className="block-title" style={{ 
            fontSize: 15,
            fontWeight: 800,
            marginBottom: 3,
            color: 'var(--text-1)',
            textDecoration: slot.task.done ? "line-through" : "none",
            letterSpacing: "-0.01em"
          }}>{slot.task.title}</div>
          
          <div className="block-meta" style={{ fontSize: 11, opacity: 0.5, fontWeight: 600, marginBottom: 8, color: "var(--text-2)" }}>
            {slot.time} — {slot.endTime} · {slot.durationLabel}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="block-chip" style={{ 
              padding: '3px 10px',
              fontSize: 10,
              fontWeight: 800,
              borderRadius: 8,
              background: categoryOption.bg, 
              color: categoryOption.textColor, 
              border: `1px solid ${categoryOption.cor}22`,
              display: "flex", alignItems: "center", gap: 5,
              textTransform: "uppercase",
              letterSpacing: "0.03em"
            }}>
              {slot.task.icon ? (
                <i className={slot.task.icon} style={{ fontSize: 11 }}></i>
              ) : (
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: categoryOption.cor }} />
              )}
              {categoryOption.shortLabel}
            </div>

            {slot.task.persistentReminderEnabled && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(244,190,168,0.1)", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(244,190,168,0.2)" }}>
                <Bell size={10} color="var(--accent-peach)" />
                <span style={{ fontSize: 9, fontWeight: 800, color: "var(--accent-peach-ink)" }}>{slot.task.persistentReminderIntervalMinutes}m</span>
              </div>
            )}

            {(slot.task.alarmEnabled || slot.task.vibrateEnabled) && (
               <div style={{ display: "flex", gap: 5, opacity: 0.7 }}>
                  {slot.task.alarmEnabled && <span style={{ fontSize: 12 }}>⏰</span>}
                  {slot.task.vibrateEnabled && <span style={{ fontSize: 12 }}>📳</span>}
               </div>
            )}

            {slot.task.isAiSuggested && (
              <div className="block-chip" style={{ background: "rgba(244,190,168,.12)", color: "var(--accent-peach-ink)", border: "1px solid rgba(244,190,168,.30)", fontWeight: 800, fontSize: 9 }}>
                AIRIA
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlannerPage() {
  const { refreshData, state, toggleSubGoal } = useAuraStore();
  const { showError, showSuccess } = useToast();
  const location = useLocation();

  // ── Modo Proteção de Fase Baixa (7.2) ──────────────────────
  const cycleReport = useMemo(() => {
    const aggregated = aggregateCheckinsByDay(state.checkinHistory || []);
    return computeMoodCycle(aggregated);
  }, [state.checkinHistory]);
  const isLowPhase = cycleReport.phase === "low" || cycleReport.phase === "depleted";
  const [offsetDias, setOffsetDias] = useState(0);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<FormState>({ ...EMPTY_FORM });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ ...EMPTY_FORM });
  const [todayAnchor, setTodayAnchor] = useState(() => createBaseDate());
  const [now, setNow] = useState(() => new Date());
  const [dragOverTime, setDragOverTime] = useState<string | null>(null);
  const openedTaskFromLocationRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTodayAnchor(createBaseDate());
      setNow(new Date());
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
  const allDayTasks = useMemo(() => plannerTasks.filter(t => t.time === "00:00" && t.endTime === "23:59"), [plannerTasks]);
  const agendaSlots = useMemo(() => buildPlannerAgendaSlots(plannerTasks), [plannerTasks]);
  const visibleAgendaSlots = plannerLoading ? emptyAgendaSlots : agendaSlots;
  
  // ── Inteligência de Energia (Bateria) ───────────────────────
  const dailyCapacity = useMemo(() => {
    // Escala de Capacidade Biológica (UP - Units of Power)
    // Se não houver histórico, começamos com 15 UP (média basal conservadora)
    const baseCap = (cycleReport.avgEnergy7d || 5) * 3; 
    return Math.max(10, baseCap);
  }, [cycleReport.avgEnergy7d]);

  const usedEnergy = useMemo(() => {
    return plannerTasks.reduce((acc, t) => {
      // Use numeric energyLevel if available, otherwise map from intensity string
      const lvl = t.energyLevel ?? mapIntensityToEnergyLevel(t.intensity);
      // Level 1-5 corresponds directly to 1-5 UP (Units of Power)
      return acc + (lvl || 3);
    }, 0);
  }, [plannerTasks]);

  // ── Proatividade da IA: Sugestões de Brechas ────────────────
  const [gapSuggestions, setGapSuggestions] = useState<Record<string, { title: string, description: string }>>({});

  useEffect(() => {
    if (plannerLoading || plannerTasks.length === 0) return;

    const findGaps = () => {
       return agendaSlots
         .filter(s => s.kind === "empty" && !s.title)
         .slice(0, 3); // Apenas as 3 primeiras para não sobrecarregar
    };

    const gaps = findGaps();
    if (gaps.length === 0) return;

    async function fetchGapSuggestions() {
      try {
        const promptContext = {
          date: selectedDateKey,
          phase: cycleReport.phaseLabel,
          energyRemaining: dailyCapacity - usedEnergy,
          existingTasks: plannerTasks.map(t => t.title).join(", "),
          gaps: gaps.map(g => g.time)
        };

        const res = await api.post("/ai/suggest", {
          type: "agenda-blocks",
          context: promptContext
        });

        if (res && res.suggestions) {
          const newSuggestions = { ...gapSuggestions };
          res.suggestions.forEach((s: any) => {
            if (s.time) newSuggestions[s.time] = { title: s.title, description: s.description };
          });
          setGapSuggestions(newSuggestions);
        }
      } catch (e) {
        // Falha silenciosa conforme lei do sistema
        console.warn("[Aura/AI] Gap suggestion failed - keeping silent");
      }
    }

    fetchGapSuggestions();
  }, [selectedDateKey, plannerTasks.length, plannerLoading]);

  const agendaWithAi = useMemo(() => {
    return visibleAgendaSlots.map(slot => {
      if (slot.kind === "empty" && gapSuggestions[slot.time]) {
        return {
          ...slot,
          title: gapSuggestions[slot.time].title,
          description: gapSuggestions[slot.time].description,
        };
      }
      return slot;
    });
  }, [visibleAgendaSlots, gapSuggestions]);

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

  // ── Foco do dia — GTD tasks + first uncompleted goal subtask ──
  const [gtdFocusItems, setGtdFocusItems] = useState<Array<{
    id: string; text: string; type: "tarefa" | "meta"; goalTitle?: string; goalId?: number | string;
  }>>(() => {
    try {
      const raw: any[] = JSON.parse(localStorage.getItem("gtd-inbox-v1") || "[]");
      return raw
        .filter(i => !i.archived && !i.sentToGoal && !i.done && i.clarified && i.tipo === "proxima_acao" && !i.linkedGoalId)
        .map(i => ({ id: i.id, text: i.titulo || i.text, type: "tarefa" as const }));
    } catch { return []; }
  });

  const goalFocusItems = useMemo(() => {
    return state.goals
      .map(g => {
        const nextSub = g.subtasks.find(s => !s.done);
        if (!nextSub) return null;
        return { id: `goal-${g.id}-${nextSub.id}`, text: nextSub.title, type: "meta" as const, goalTitle: g.title, goalId: g.id, subId: nextSub.id };
      })
      .filter(Boolean) as Array<{ id: string; text: string; type: "meta"; goalTitle: string; goalId: number | string; subId: number | string }>;
  }, [state.goals]);

  function toggleGtdFocusItem(itemId: string) {
    try {
      const raw: any[] = JSON.parse(localStorage.getItem("gtd-inbox-v1") || "[]");
      const updated = raw.map(i => i.id === itemId ? { ...i, done: true } : i);
      localStorage.setItem("gtd-inbox-v1", JSON.stringify(updated));
    } catch {}
    setGtdFocusItems(prev => prev.filter(i => i.id !== itemId));
  }

  useEffect(() => {
    let ignore = false;

    async function loadPlannerTasks() {
      setPlannerLoading(true);
      try {
        const [timeline, gcalRes] = await Promise.all([
           api.get(`/timeline/${selectedDateKey}`),
           api.get(`/gcal/events?date=${selectedDateKey}`).catch(() => ({ connected: false, events: [] }))
        ]);
        if (ignore) return;
        
        let merged: any[] = Array.isArray(timeline) ? timeline.map(mapTaskFromApi) : [];
        
        if (gcalRes && gcalRes.connected) {
          if (Array.isArray(gcalRes.events)) {
             const dayEvents = gcalRes.events
               .map((event: any) => mapGoogleCalendarEventFromApi(event, selectedDateKey))
               .filter((event: PlannerTask | null): event is PlannerTask => event !== null);
             merged = [...merged, ...dayEvents];
             merged.sort((a,b) => a.time.localeCompare(b.time));
          }
        }

        setPlannerTasks(merged);
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

  useEffect(() => {
    const taskId = (location.state as { openTaskId?: string | number } | null)?.openTaskId;
    if (!taskId) return;
    const normalizedTaskId = String(taskId);
    if (openedTaskFromLocationRef.current === normalizedTaskId) return;
    const task = plannerTasks.find((item) => item.id === normalizedTaskId);
    if (!task) return;

    openedTaskFromLocationRef.current = normalizedTaskId;
    openEditForm(task);
  }, [location.state, plannerTasks]);

  async function reloadPlannerTasks() {
    try {
        const [timeline, gcalRes] = await Promise.all([
           api.get(`/timeline/${selectedDateKey}`),
           api.get(`/gcal/events?date=${selectedDateKey}`).catch(() => ({ connected: false, events: [] }))
        ]);
        let merged: any[] = Array.isArray(timeline) ? timeline.map(mapTaskFromApi) : [];

        if (gcalRes && gcalRes.connected) {
          if (Array.isArray(gcalRes.events)) {
             const dayEvents = gcalRes.events
               .map((event: any) => mapGoogleCalendarEventFromApi(event, selectedDateKey))
               .filter((event: PlannerTask | null): event is PlannerTask => event !== null);
             merged = [...merged, ...dayEvents];
             merged.sort((a,b) => a.time.localeCompare(b.time));
          }
        }
        setPlannerTasks(merged);
    } catch (e) {
        console.error('[reloadPlannerTasks]', e);
        showError("Erro ao carregar agenda. Tente novamente.");
    }
  }

  function closeNewForm() {
    setShowNewForm(false);
    setNewForm({ ...EMPTY_FORM });
  }

  function openNewFormAt(time: string) {
    const defaultEnd = addMinutesToTime(time, 60);
    setNewForm({ ...EMPTY_FORM, date: selectedDateKey, time, endTime: defaultEnd });
    setShowNewForm(true);
  }

  function closeEditForm() {
    setEditingTaskId(null);
    setEditForm({ ...EMPTY_FORM });
  }

  function openEditForm(task: PlannerTask) {
    setEditingTaskId(task.id);
    setEditForm({ ...buildFormStateFromTask(task), date: selectedDateKey });
  }

  function getGoogleCalendarEventEndpoint(task: PlannerTask) {
    const { calendarId, eventId } = parseGoogleCalendarTaskId(task.id);
    return `/gcal/events/${encodeURIComponent(eventId)}?calendarId=${encodeURIComponent(calendarId)}`;
  }

  function getOffsetForDateKey(dateKey: string) {
    const target = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(target.getTime())) return offsetDias;

    const base = new Date(todayAnchor);
    base.setHours(12, 0, 0, 0);
    return Math.round((target.getTime() - base.getTime()) / 86_400_000);
  }

  async function handleAddBlock() {
    if (!newForm.title.trim()) return;

    const targetDate = resolvePlannerBlockDate(newForm.date, selectedDateKey);

    try {
      const res: any = await api.post("/timeline", {
        date: targetDate,
        forceSave: true,
        blocks: [buildTimelineBlockInput(newForm)],
      });

      const savedBlock = Array.isArray(res.savedBlocks) ? res.savedBlocks[0] : null;
      if (!savedBlock) return;

      setTaskMeta(savedBlock.id, {
        noteMode: newForm.noteMode,
        note: newForm.note,
        checklist: newForm.checklist,
        recurring: newForm.recurring,
        energyLevel: newForm.energyLevel,
        lastResetDate: newForm.lastResetDate,
        persistentReminderEnabled: newForm.persistentReminderEnabled,
        persistentReminderIntervalMinutes: newForm.persistentReminderIntervalMinutes,
        vibrateEnabled: newForm.vibrateEnabled,
        alarmEnabled: newForm.alarmEnabled,
        recurringNotificationEnabled: newForm.recurringNotificationEnabled,
        visualRepeatEnabled: newForm.visualRepeatEnabled,
        icon: newForm.icon,
        color: newForm.color,
      });

      if (targetDate === selectedDateKey) {
        await reloadPlannerTasks();
      } else {
        setOffsetDias(getOffsetForDateKey(targetDate));
      }
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

    const targetDate = resolvePlannerBlockDate(editForm.date, selectedDateKey);

    try {
      if (currentTask.source === "gcal") {
        await api.patch(getGoogleCalendarEventEndpoint(currentTask), {
          date: targetDate,
          title: editForm.title.trim(),
          startTime: editForm.time,
          endTime: editForm.endTime || addMinutesToTime(editForm.time, diffMinutes(currentTask.time, currentTask.endTime)),
          note: editForm.note, // Bidirectional sync: send local note/description to GCal
        });

        if (targetDate === selectedDateKey) {
          await reloadPlannerTasks();
        } else {
          setOffsetDias(getOffsetForDateKey(targetDate));
        }
        closeEditForm();
        showSuccess("Evento salvo no Google Agenda.");
        return;
      }

      await api.post("/timeline", {
        date: targetDate,
        forceSave: true,
        blocks: [
          buildTimelineBlockInput(editForm, {
            id: currentTask.id,
            durationMinutes: diffMinutes(currentTask.time, currentTask.endTime),
            fallbackIntensity: ((currentTask.intensity ?? "M").toUpperCase() as TimelineBlockIntensity),
            fallbackStatus: ((currentTask.status ?? (currentTask.done ? "completed" : "planned")) as TimelineBlockStatus),
            isAiSuggested: currentTask.isAiSuggested ? false : undefined,
            aiReasoning: currentTask.isAiSuggested ? null : undefined,
          }),
        ],
      });

      setTaskMeta(currentTask.id, {
        noteMode: editForm.noteMode,
        note: editForm.note,
        checklist: editForm.checklist,
        recurring: editForm.recurring,
        energyLevel: editForm.energyLevel,
        lastResetDate: editForm.lastResetDate,
        persistentReminderEnabled: editForm.persistentReminderEnabled,
        persistentReminderIntervalMinutes: editForm.persistentReminderIntervalMinutes,
        vibrateEnabled: editForm.vibrateEnabled,
        alarmEnabled: editForm.alarmEnabled,
        recurringNotificationEnabled: editForm.recurringNotificationEnabled,
        visualRepeatEnabled: editForm.visualRepeatEnabled,
        icon: editForm.icon,
        color: editForm.color,
      });

      if (targetDate === selectedDateKey) {
        await reloadPlannerTasks();
      } else {
        setOffsetDias(getOffsetForDateKey(targetDate));
      }
      await refreshData();
      closeEditForm();
      showSuccess("Bloco salvo.");
    } catch (error: any) {
      showError(error.message);
    }
  }

  const [globalTouchStartX, setGlobalTouchStartX] = useState<number | null>(null);
  const [globalTouchStartY, setGlobalTouchStartY] = useState<number | null>(null);

  function handleAgendaTouchStart(e: React.TouchEvent) {
     setGlobalTouchStartX(e.touches[0].clientX);
     setGlobalTouchStartY(e.touches[0].clientY);
  }

  function handleAgendaTouchEnd(e: React.TouchEvent) {
     if (globalTouchStartX === null) return;
     const deltaX = e.changedTouches[0].clientX - globalTouchStartX;
     const deltaY = globalTouchStartY === null ? 0 : e.changedTouches[0].clientY - globalTouchStartY;
     if (shouldNavigateAgendaBySwipe({ deltaX, deltaY })) {
       if (deltaX > 0) setOffsetDias(c => c - 1);
       else setOffsetDias(c => c + 1);
     }
     setGlobalTouchStartX(null);
     setGlobalTouchStartY(null);
  }

  async function handleCompleteTaskDirect(task: PlannerTask) {
    try {
      if (task.source === "gcal") {
        await api.patch(getGoogleCalendarEventEndpoint(task), {
          date: selectedDateKey,
          title: stripGoogleCalendarTaskTitle(task.title),
          startTime: task.time,
          endTime: task.endTime,
          status: task.done ? "planned" : "completed",
        });
        await reloadPlannerTasks();
        showSuccess(task.done ? "Evento reaberto." : "Evento concluído.");
        return;
      }

      await api.post("/timeline", {
        date: selectedDateKey,
        forceSave: true,
        blocks: [ {
          id: task.id,
          title: task.title,
          startTime: task.time,
          endTime: task.endTime,
          status: task.done ? 'planned' : 'completed',
          category: normalizePlannerCategory(task.category, task.title),
          intensity: ((task.intensity ?? "M").toUpperCase() as TimelineBlockIntensity),
          persistentReminderEnabled: task.persistentReminderEnabled ?? false,
          persistentReminderIntervalMinutes: task.persistentReminderIntervalMinutes ?? null,
          vibrateEnabled: task.vibrateEnabled ?? false,
          alarmEnabled: task.alarmEnabled ?? false,
          recurringNotificationEnabled: task.recurringNotificationEnabled ?? false,
          icon: task.icon,
          color: task.color,
        } ],
      });
      await reloadPlannerTasks();
      await refreshData();
      showSuccess(task.done ? "Bloco reaberto." : "Bloco concluído.");
    } catch (error: any) {
      showError(error.message);
    }
  }

  async function handleDeleteTaskDirect(task: PlannerTask) {
    try {
      if (task.source === "gcal") {
        await api.delete(getGoogleCalendarEventEndpoint(task));
        await reloadPlannerTasks();
        showSuccess("Evento excluído no Google Agenda.");
        return;
      }

      await api.delete(`/timeline/${task.id}`);
      await reloadPlannerTasks();
      await refreshData();
      showSuccess("Bloco excluído.");
    } catch (error: any) {
      showError(error.message);
    }
  }

  async function handleDropTaskToTime(taskId: string, newTime: string) {
    const task = plannerTasks.find(t => t.id === taskId);
    if (!task) return;
    const durMinutes = diffMinutes(task.time, task.endTime);
    const startTotal = timeToMinutesValue(newTime);
    const endTotal = startTotal + durMinutes;
    if (endTotal >= 24 * 60) {
      showError("Esse bloco não cabe nesse horário.");
      return;
    }
    const newEndTime = formatMinutesAsTime(endTotal);

    try {
      if (task.source === "gcal") {
        await api.patch(getGoogleCalendarEventEndpoint(task), {
          date: selectedDateKey,
          title: stripGoogleCalendarTaskTitle(task.title),
          startTime: newTime,
          endTime: newEndTime,
        });
        await reloadPlannerTasks();
        return;
      }

      // Sync local meta to ensures fields like checklist/notes are preserved
      const meta = getTaskMeta(task.id);
      
      const payload = buildTimelineBlockInput({
        title: task.title,
        time: newTime,
        endTime: newEndTime,
        category: task.category || "pessoal",
        energyLevel: normalizeEnergyLevel(meta.energyLevel || task.energyLevel || 3),
        note: meta.note || task.note || undefined,
        noteMode: meta.noteMode || task.noteMode || undefined,
        checklist: meta.checklist || task.checklist || undefined,
        recurring: meta.recurring || task.recurring || undefined,
        persistentReminderEnabled: meta.persistentReminderEnabled || task.persistentReminderEnabled || undefined,
        persistentReminderIntervalMinutes: meta.persistentReminderIntervalMinutes || task.persistentReminderIntervalMinutes || undefined,
        alarmEnabled: meta.alarmEnabled || task.alarmEnabled || undefined,
        vibrateEnabled: meta.vibrateEnabled || task.vibrateEnabled || undefined,
        recurringNotificationEnabled: meta.recurringNotificationEnabled || task.recurringNotificationEnabled || undefined,
        visualRepeatEnabled: meta.visualRepeatEnabled || task.visualRepeatEnabled || undefined,
        icon: meta.icon || task.icon || undefined,
        color: meta.color || task.color || undefined,
      }, {
        id: task.id,
        fallbackIntensity: ((task.intensity ?? "M").toUpperCase() as TimelineBlockIntensity),
        fallbackStatus: ((task.status ?? (task.done ? "completed" : "planned")) as TimelineBlockStatus),
        isAiSuggested: task.isAiSuggested ? false : undefined,
        aiReasoning: task.isAiSuggested ? null : undefined,
      });

      await api.post("/timeline", {
        date: selectedDateKey,
        forceSave: true,
        blocks: [ payload ]
      });
      await reloadPlannerTasks();
      await refreshData();
    } catch (error: any) {
      showError(error.message);
    }
  }

  return (
    <div className="bg-white min-h-screen" style={{ flex: 1, padding: "20px", overflowX: 'hidden' }}>
      <WeeklyAgendaHeader todayAnchor={todayAnchor} offsetDias={offsetDias} setOffsetDias={setOffsetDias} />

      <EnergyBattery used={usedEnergy} capacity={dailyCapacity} />



      {/* ── Banner: Modo Proteção de Fase Baixa ── */}
      {isLowPhase && (
        <div style={{
          borderRadius: 18, padding: "14px 16px", marginBottom: 18,
          background: cycleReport.phase === "depleted"
            ? "rgba(161,125,108,.08)"
            : "rgba(197,165,147,.08)",
          border: cycleReport.phase === "depleted"
            ? "1px solid rgba(161,125,108,.15)"
            : "1px solid rgba(197,165,147,.15)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>
              {cycleReport.phase === "depleted" ? "😴" : "🌙"}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: 12, fontWeight: 800, margin: "0 0 4px",
                color: cycleReport.phase === "depleted" ? "#A17D6C" : "var(--accent-peach-ink)",
                textTransform: "uppercase", letterSpacing: "0.05em"
              }}>
                Modo Proteção — {cycleReport.phaseLabel}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-2)", margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
                {cycleReport.phase === "depleted"
                  ? "Seu sistema está em exaustão. Priorize apenas o essencial e reserve janelas de silêncio."
                  : "Fase de baixa energia detectada. Otimize sua agenda para tarefas leves e evite grandes pressões hoje."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── All-Day Tasks Section (Smaller Cards) ── */}
      {allDayTasks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingLeft: 4 }}>
            <Calendar size={12} color="var(--accent-sage)" />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--accent-sage-ink)" }}>
              Dia Inteiro
            </span>
          </div>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: allDayTasks.length > 1 ? "repeat(auto-fill, minmax(150px, 1fr))" : "1fr",
            gap: 10 
          }}>
            {allDayTasks.map(task => (
              <div 
                key={task.id}
                onClick={() => openEditForm(task)}
                className="glass-card"
                style={{
                  padding: "10px 12px",
                  borderRadius: 16,
                  border: `1.5px solid ${getCategoryStyles(task.category || "").cor}30`,
                  borderLeft: `4px solid ${getCategoryStyles(task.category || "").cor}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {task.title}
                </div>
                {task.source === "gcal" && (
                  <div style={{ fontSize: 9, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                    <img src="https://www.google.com/favicon.ico" width={10} height={10} alt="GCal" /> Google Agenda
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card" style={{ ...PLANNER_SUMMARY_CARD_STYLE, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...LABEL_STYLE, color: "var(--accent-peach-ink)", marginBottom: 8 }}>Planejamento</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.1 }}>Sua Timeline</h2>
            <p style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: "var(--text-2)", fontWeight: 500 }}>{plannerSummary}</p>
          </div>
          <span
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 28,
              padding: "0 12px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--accent-peach-ink)",
              background: "var(--accent-peach-a3)",
              border: "1.5px solid var(--accent-peach-a5)",
            }}
          >
            {plannerBadgeLabel}
          </span>
        </div>
      </div>

      {/* ── Foco do dia — GTD tasks + next goal actions ── */}
      {(gtdFocusItems.length > 0 || goalFocusItems.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, paddingLeft: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-peach-ink)" }}>
              Foco Prioritário
            </span>
            <span style={{
              background: "var(--accent-peach-a3)", color: "var(--accent-peach-ink)",
              borderRadius: 999, padding: "0 8px", fontSize: 10, fontWeight: 800,
              border: "1.5px solid var(--accent-peach-a5)",
            }}>{gtdFocusItems.length + goalFocusItems.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gtdFocusItems.map(item => (
              <div key={item.id} className="glass-card" style={{
                display: "flex", alignItems: "center", gap: 12,
                borderLeft: "4px solid var(--accent-sky)",
                borderRadius: 16, padding: "12px 16px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              }}>
                <button
                  onClick={() => toggleGtdFocusItem(item.id)}
                  style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                    background: "transparent", border: "2px solid var(--accent-sky)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".08em", color: "var(--accent-sky)", textTransform: "uppercase", marginBottom: 2 }}>
                    ⚡ Captura
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.text}
                  </div>
                </div>
              </div>
            ))}
            {goalFocusItems.map(item => (
              <div key={item.id} className="glass-card" style={{
                display: "flex", alignItems: "center", gap: 12,
                borderLeft: "4px solid var(--accent-peach)",
                borderRadius: 16, padding: "12px 16px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              }}>
                <button
                  onClick={() => { toggleSubGoal(item.goalId, item.subId); }}
                  style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                    background: "rgba(215,137,127,0.08)", border: "2px solid var(--accent-peach)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".08em", color: "var(--accent-peach)", textTransform: "uppercase", marginBottom: 2 }}>
                    🎯 {item.goalTitle}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
         style={{ display: "flex", flexDirection: "column", paddingBottom: 100, overflowX: "hidden", position: "relative" }}
         onTouchStart={handleAgendaTouchStart}
         onTouchEnd={handleAgendaTouchEnd}
      >
        <TimelineProgressIndicator 
           nowMinutes={now.getHours() * 60 + now.getMinutes()} 
           slots={agendaWithAi} 
        />
        
        {agendaWithAi.map((slot) => {
          const isDragOver = dragOverTime === slot.time;

          if (slot.kind === "task") {
            const categoryOption = getCategoryStyles(slot.category);

            return (
              <div
                key={slot.key}
                className="timeline-slot"
                data-drop-time={slot.time}
                onDragOver={e => { e.preventDefault(); setDragOverTime(slot.time); }}
                onDragLeave={() => setDragOverTime(null)}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const tid = e.dataTransfer.getData('text/plain');
                  if (tid) handleDropTaskToTime(tid, slot.time);
                }}
                style={{ 
                  borderRadius: 12, background: "transparent", paddingLeft: 24,
                  border: isDragOver ? "2px dashed var(--accent-peach)" : "none",
                  transition: "all 0.2s"
                }}
              >
                <span className="timeline-time" style={{ fontWeight: 700, fontSize: 13 }}>{slot.time}</span>
                <div className="timeline-line" style={{ left: 10 }} />
                <SwipeableTaskCard 
                   slot={slot} 
                   categoryOption={categoryOption} 
                   onClick={() => openEditForm(slot.task)}
                   onComplete={handleCompleteTaskDirect}
                   onDelete={handleDeleteTaskDirect}
onDragStart={(e: any, id: string) => {
                       e.dataTransfer.setData('text/plain', id);
                       e.dataTransfer.effectAllowed = "move";
                    }}
                />
              </div>
            );
          }

          return (
            <div key={slot.key} className="timeline-slot" data-drop-time={slot.time} 
                 style={{ 
                   minHeight: slot.title ? 110 : 60, borderRadius: 12, background: "transparent", paddingLeft: 24,
                   border: isDragOver ? "2px dashed var(--accent-peach)" : "none",
                   transition: "all 0.2s"
                 }}
                 onDragOver={e => { e.preventDefault(); setDragOverTime(slot.time); }}
                 onDragLeave={() => setDragOverTime(null)}
                 onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tid = e.dataTransfer.getData('text/plain');
                    if (tid) handleDropTaskToTime(tid, slot.time);
                 }}
            >
              <span className="timeline-time" style={{ opacity: slot.title ? 1 : 0.4, fontWeight: 700, fontSize: 13 }}>{slot.time}</span>
              <div className="timeline-line" style={{ opacity: slot.title ? 0.8 : 0.15, left: 10 }} />
              <button
                type="button"
                className="timeline-block-card interactive-card glass-card"
                onClick={() => openNewFormAt(slot.time)}
                style={slot.title ? { ...EMPTY_TIMELINE_CARD_STYLE, borderRadius: 16 } : { width: '100%', background: 'transparent', border: 'none', borderLeft: '2px solid transparent', textAlign: 'left', opacity: 0.5, display: 'flex', alignItems: 'center', boxShadow: 'none' }}
              >
                {slot.title ? (
                  <>
                    <div className="block-title" style={{ color: "var(--text-1)", fontWeight: 700, fontSize: 15 }}>
                      {slot.title}
                    </div>
                    <div className="block-meta" style={{ marginTop: 6, lineHeight: 1.6, fontSize: 12, color: "var(--text-2)" }}>
                      {slot.description}
                    </div>
                    <div
                      className="block-chip"
                      style={{
                        background: "var(--accent-peach-a3)",
                        color: "var(--accent-peach-ink)",
                        border: "1px solid var(--accent-peach-a5)",
                        marginTop: 12,
                        borderRadius: 10,
                        padding: "4px 10px",
                        fontSize: 10,
                        fontWeight: 800
                      }}
                    >
                      + CRIAR BLOCO
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 16, color: 'var(--text-3)', paddingLeft: 12 }}>+</div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAB — Novo bloco */}
      <button
        onClick={() => openNewFormAt("09:00")}
        aria-label="Novo bloco"
        style={{
          position: "fixed",
          bottom: "calc(88px + env(safe-area-inset-bottom))",
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--accent-peach, #F4A896)",
          border: "none",
          boxShadow: "0 6px 20px rgba(244,168,150,.45)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 40,
          transition: "transform 150ms, box-shadow 150ms",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>


      {showNewForm ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div style={{ 
            background: "#fff", width: "100%", padding: "24px 20px", 
            borderRadius: "32px 32px 0 0", maxHeight: "92vh", overflowY: "auto",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.15)",
            position: "relative"
          }}>
            <div style={{ width: 40, height: 5, background: "var(--warm-border-2)", borderRadius: 10, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button onClick={closeNewForm} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "var(--text-2)", padding: 4 }}>✕</button>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)", margin: 0 }}>Nova <span style={{ color: "var(--accent-peach)" }}>Tarefa</span></h3>
            </div>
            <PlannerSheetBody form={newForm} setForm={setNewForm} onSave={handleAddBlock} onCancel={closeNewForm} saveLabel="Criar Tarefa" />
          </div>
        </div>
      ) : null}

      {editingTaskId ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div style={{ 
            background: "#fff", width: "100%", padding: "24px 20px", 
            borderRadius: "32px 32px 0 0", maxHeight: "92vh", overflowY: "auto",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.15)",
            position: "relative"
          }}>
            <div style={{ width: 40, height: 5, background: "var(--warm-border-2)", borderRadius: 10, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button onClick={closeEditForm} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "var(--text-2)", padding: 4 }}>✕</button>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)", margin: 0 }}>Editar <span style={{ color: "var(--accent-peach)" }}>Tarefa</span></h3>
            </div>
            <PlannerSheetBody
              form={editForm}
              setForm={setEditForm}
              onSave={handleSaveEdit}
              onCancel={closeEditForm}
              saveLabel="Salvar"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

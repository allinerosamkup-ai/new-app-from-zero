// Planner Page v4 — notas+checklist unificados, AI buttons, recorrente com dias
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, CalendarRange } from "lucide-react";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useToast } from "../components/Toast";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import {
  addMinutesToTime,
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
import { aggregateCheckinsByDay, computeMoodCycle } from "../utils/mood-cycle-engine";
import "../styles/aura.css";
import "../styles/editorial.css";

const CATEGORY_OPTIONS = [
  { value: "trabalho" as const, label: "Trabalho", shortLabel: "TRABALHO", cor: "var(--accent-sky)", bg: "rgba(176,180,196,.14)", textColor: "var(--accent-sky-ink)" },
  { value: "autocuidado" as const, label: "Autocuidado", shortLabel: "AUTOCUIDADO", cor: "var(--accent-sage)", bg: "rgba(180,185,169,.14)", textColor: "var(--accent-sage-ink)" },
  { value: "social" as const, label: "Social", shortLabel: "SOCIAL", cor: "var(--social-color)", bg: "rgba(217,206,197,.18)", textColor: "var(--social-text)" },
  { value: "pessoal" as const, label: "Pessoal", shortLabel: "PESSOAL", cor: "var(--accent-peach)", bg: "rgba(243,176,140,.14)", textColor: "var(--accent-peach-ink)" },
  { value: "casa" as const, label: "Casa", shortLabel: "CASA", cor: "#E5A08A", bg: "rgba(229,160,138,.14)", textColor: "#8C4A36" }
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
  width: "100%",
  textAlign: "left",
  background: "rgba(255,251,247,.78)",
  border: "1.5px dashed rgba(243,176,140,.22)",
  borderLeft: "4px solid rgba(243,176,140,.42)",
};

type FormState = {
  title: string;
  time: string;
  endTime: string;
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
  endTime: "10:00",
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
    endTime: task.endTime,
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

  async function splitIntoSubtasks() {
    setAiLoading("split");
    try {
      const res = await api.post("/ai/suggest", {
        type: "task-content",
        context: { 
          ...context, 
          currentNote: `[SYSTEM: Ignore notes, strictly split the main task "${context.title}" into highly actionable, step-by-step subtasks. Return as items array in JSON]`, 
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
        <span style={LABEL_STYLE}>Notas e checklist</span>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={LABEL_STYLE}>Recorrente</span>
        <input type="checkbox" checked={recurring.enabled} onChange={(event) => setRecurring({ ...recurring, enabled: event.target.checked })} />
      </div>
      {recurring.enabled && (
        <div style={{ display: "flex", gap: "6px", marginTop: "10px", justifyContent: "space-between" }}>
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
                   width: 34, height: 34, borderRadius: '50%', border: 'none',
                   background: isSelected ? 'var(--accent-sage)' : 'var(--warm-border-2)',
                   color: isSelected ? 'var(--accent-sage-ink)' : 'var(--text-2)',
                   fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                 }}
               >{d.label}</button>
            )
          })}
        </div>
      )}
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
  const [customTag, setCustomTag] = useState("");
  const [showCustomConfig, setShowCustomConfig] = useState(false);

  // Derive active options
  const isCustomActive = form.category && !CATEGORY_OPTIONS.some(o => o.value === form.category);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "16px 0" }}>
      <input
        value={form.title}
        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        style={{ ...INPUT_STYLE, height: "54px", fontSize: "16px", fontWeight: 700 }}
        placeholder="O que você vai fazer?"
        autoFocus
      />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={LABEL_STYLE}>Início</span>
          <input
            type="time"
            value={form.time}
            onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
            style={INPUT_STYLE}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={LABEL_STYLE}>Fim</span>
          <input
            type="time"
            value={form.endTime || ''}
            onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
            style={INPUT_STYLE}
          />
        </div>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={LABEL_STYLE}>Tag de Evento</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CATEGORY_OPTIONS.map(opt => {
            const isSel = form.category === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setForm(c => ({...c, category: opt.value}))}
                style={{
                  padding: "4px 10px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  border: `1px solid ${isSel ? opt.cor : 'transparent'}`,
                  background: isSel ? opt.bg : 'var(--warm-border-2)',
                  color: isSel ? opt.textColor : 'var(--text-2)',
                  cursor: "pointer"
                }}
              >{opt.label}</button>
            )
          })}
          
          {isCustomActive && (
              <button
                style={{
                  padding: "4px 10px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  border: `1px solid var(--text-2)`,
                  background: 'transparent',
                  color: 'var(--text-1)',
                }}
              >{form.category}</button>
          )}

          <button
            onClick={() => setShowCustomConfig(!showCustomConfig)}
            style={{
               padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
               border: '1px dashed var(--text-3)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer'
            }}
          >+ Nova</button>
        </div>

        {showCustomConfig && (
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input 
              value={customTag} 
              onChange={e => setCustomTag(e.target.value)} 
              placeholder="Nome da tag..."
              style={{ ...INPUT_STYLE, height: 32, fontSize: 12 }}
            />
            <AuraButtonV2 size="sm" variant="outline" onClick={() => {
              if (customTag.trim()) {
                setForm(c => ({...c, category: customTag.trim().toLowerCase()}));
              }
              setShowCustomConfig(false);
              setCustomTag("");
            }}>Salvar</AuraButtonV2>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={LABEL_STYLE}>Energia Gasta</span>
        <div style={{ display: "flex", gap: 6 }}>
           {(["leve", "media", "alta"] as const).map(lvl => {
              const isSel = form.energyLevel === lvl;
              const emoji = lvl === 'leve' ? '🔋 Leve' : lvl === 'media' ? '⚡ Média' : '🔥 Alta';
              return (
                 <button
                   key={lvl}
                   type="button"
                   onClick={() => setForm(c => ({...c, energyLevel: lvl}))}
                   style={{
                     flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                     border: `1.5px solid ${isSel ? 'var(--accent-peach)' : 'var(--warm-border-2)'}`,
                     background: isSel ? 'var(--accent-peach-a3)' : 'var(--warm-bg)',
                     color: isSel ? 'var(--accent-peach-ink)' : 'var(--text-2)'
                   }}
                 >{emoji}</button>
              )
           })}
        </div>
      </div>

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

function WeeklyAgendaHeader({ todayAnchor, offsetDias, setOffsetDias }: { todayAnchor: Date; offsetDias: number; setOffsetDias: (v: any) => void }) {
  const selectedDate = new Date(todayAnchor);
  selectedDate.setDate(selectedDate.getDate() + offsetDias);

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
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button 
           style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex' }}
           onClick={() => setOffsetDias((c: number) => c - 7)}
        >
          <ChevronLeft size={24} color="var(--text-2)" />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, textTransform: 'capitalize', color: 'var(--text-1)' }}>
            {selectedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} color="var(--text-2)" />
            <input 
              type="date"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              onChange={handleDateChange}
              value={formattedDate}
            />
          </div>
        </div>

        <button 
           style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex' }}
           onClick={() => setOffsetDias((c: number) => c + 7)}
        >
          <ChevronRight size={24} color="var(--text-2)" />
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {days.map(d => {
          const isSelected = d.toDateString() === selectedDate.toDateString();
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
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px', borderRadius: 16,
                background: isSelected ? 'var(--accent-peach)' : 'transparent',
                color: isSelected ? 'var(--accent-peach-ink)' : 'var(--text-1)',
                cursor: 'pointer',
                minWidth: 40
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? 'var(--accent-peach-ink)' : 'var(--text-3)' }}>
                {DIAS_CURTOS[d.getDay()]}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{d.getDate()}</span>
              {isToday && <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'var(--accent-peach-ink)' : 'var(--accent-peach)', marginTop: 2 }} />}
            </div>
          )
        })}
      </div>
    </div>
  );
}

function SwipeableTaskCard({ slot, categoryOption, onClick, onComplete, onDelete, onDragStart }: any) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  
  const isGcal = slot.task.source === 'gcal';

  function handleTouchStart(e: React.TouchEvent) {
    if (isGcal) return;
    startX.current = e.touches[0].clientX;
    setDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (isGcal || startX.current === null) return;
    const diff = e.touches[0].clientX - startX.current;
    if (Math.abs(diff) > 20) {
       e.stopPropagation(); 
    }
    setOffset(Math.max(-120, Math.min(120, diff)));
  }

  function handleTouchEnd() {
    if (isGcal) return;
    setDragging(false);
    startX.current = null;
    if (offset < -70) {
      onComplete(slot.task);
    } else if (offset > 70) {
      onDelete(slot.task);
    }
    setOffset(0);
  }

  return (
    <div 
       style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 12 }}
       draggable={!isGcal}
       onDragStart={(e) => {
         if (!isGcal) onDragStart(e, slot.task.id);
         else e.preventDefault();
       }}
    >
      {!isGcal && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: offset < 0 ? 'flex-end' : 'flex-start', padding: '0 20px', color: '#fff', zIndex: 0, borderRadius: 12, transition: 'background 0.2s', background: offset < 0 ? 'var(--accent-sage)' : 'var(--error-color, #E5A08A)' }}>
           <span style={{ fontWeight: 800, fontSize: 13 }}>{offset < 0 ? '✓ Concluir' : '🗑️ Excluir'}</span>
        </div>
      )}
      <button
        type="button"
        className="timeline-block-card interactive-card"
        onClick={() => { 
          if(isGcal) return; 
          if(Math.abs(offset) < 10) onClick(); 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: "100%", textAlign: "left", 
          borderLeft: isGcal ? 'none' : `4px solid ${categoryOption.cor}`,
          border: isGcal ? '1px dashed var(--accent-sky)' : 'none',
          opacity: slot.task.done ? 0.74 : 1, 
          transform: `translateX(${offset}px)`, 
          transition: dragging ? 'none' : 'transform 0.2s', 
          position: 'relative', 
          zIndex: 1, 
          background: isGcal ? 'var(--accent-sky-a3)' : 'rgba(255,255,255,0.95)',
          cursor: isGcal ? 'default' : 'pointer'
        }}
      >
        <div className="block-title" style={{ textDecoration: slot.task.done ? "line-through" : "none" }}>{slot.task.title}</div>
        <div className="block-meta">
          {slot.time} — {slot.endTime} · {slot.durationLabel} · { (() => { 
                const meta = getTaskMeta(slot.task.id); if (meta.energyLevel === 'leve') return '🔋'; if (meta.energyLevel === 'alta') return '🔥'; return '⚡';
          })() }
        </div>
        <div className="block-chip" style={{ background: categoryOption.bg, color: categoryOption.textColor, border: `1px solid ${categoryOption.cor}33` }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: categoryOption.cor }} />{categoryOption.shortLabel}
        </div>
      </button>
    </div>
  );
}

export function PlannerPage() {
  const { refreshData, state } = useAuraStore();
  const { showError, showSuccess } = useToast();

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

  const [gcalConnected, setGcalConnected] = useState(false);

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
          setGcalConnected(true);
          if (Array.isArray(gcalRes.events)) {
             const dayEvents = gcalRes.events.filter((e: any) => {
                  const dateStr = (e.start?.dateTime || e.start?.date || '');
                  const eventDate = dateStr ? new Date(dateStr).toLocaleDateString('sv-SE') : '';
                 return eventDate === selectedDateKey;
             }).map((e: any) => {
                 const startStr = e.start?.dateTime ? e.start.dateTime.slice(11,16) : '00:00';
                 const endStr = e.end?.dateTime ? e.end.dateTime.slice(11,16) : '23:59';
                 return {
                    id: `gcal-${e.id}`,
                    title: `📅 ${e.summary}`,
                    time: startStr,
                    endTime: endStr,
                    category: "social",
                    intensity: 2,
                    done: false,
                    source: 'gcal'
                 };
             });
             merged = [...merged, ...dayEvents];
             merged.sort((a,b) => a.time.localeCompare(b.time));
          }
        } else {
          setGcalConnected(false);
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

  async function reloadPlannerTasks() {
    try {
        const [timeline, gcalRes] = await Promise.all([
           api.get(`/timeline/${selectedDateKey}`),
           api.get(`/gcal/events?date=${selectedDateKey}`).catch(() => ({ connected: false, events: [] }))
        ]);
        let merged: any[] = Array.isArray(timeline) ? timeline.map(mapTaskFromApi) : [];

        if (gcalRes && gcalRes.connected) {
          setGcalConnected(true);
          if (Array.isArray(gcalRes.events)) {
             const dayEvents = gcalRes.events.filter((e: any) => {
                  const dateStr = (e.start?.dateTime || e.start?.date || '');
                  const eventDate = dateStr ? new Date(dateStr).toLocaleDateString('sv-SE') : '';
                 return eventDate === selectedDateKey;
             }).map((e: any) => {
                 const startStr = e.start?.dateTime ? e.start.dateTime.slice(11,16) : '00:00';
                 const endStr = e.end?.dateTime ? e.end.dateTime.slice(11,16) : '23:59';
                 return {
                    id: `gcal-${e.id}`,
                    title: `📅 ${e.summary}`,
                    time: startStr,
                    endTime: endStr,
                    category: "social",
                    intensity: 2,
                    done: false,
                    source: 'gcal'
                 };
             });
             merged = [...merged, ...dayEvents];
             merged.sort((a,b) => a.time.localeCompare(b.time));
          }
        } else {
          setGcalConnected(false);
        }
        setPlannerTasks(merged);
    } catch (e) {
        console.error(e);
    }
  }

  function closeNewForm() {
    setShowNewForm(false);
    setNewForm({ ...EMPTY_FORM });
  }

  function openNewFormAt(time: string) {
    const defaultEnd = addMinutesToTime(time, 60);
    setNewForm({ ...EMPTY_FORM, time, endTime: defaultEnd });
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

  const [globalTouchStartX, setGlobalTouchStartX] = useState<number | null>(null);

  function handleAgendaTouchStart(e: React.TouchEvent) {
     setGlobalTouchStartX(e.touches[0].clientX);
  }

  function handleAgendaTouchEnd(e: React.TouchEvent) {
     if (globalTouchStartX === null) return;
     const diff = e.changedTouches[0].clientX - globalTouchStartX;
     if (diff > 100) setOffsetDias(c => c - 1);
     else if (diff < -100) setOffsetDias(c => c + 1);
     setGlobalTouchStartX(null);
  }

  async function handleCompleteTaskDirect(task: PlannerTask) {
    try {
      await api.post("/timeline", {
        date: selectedDateKey,
        forceSave: true,
        blocks: [ { id: task.id, title: task.title, startTime: task.time, endTime: task.endTime, status: task.done ? 'planned' : 'completed', category: task.category, intensity: task.intensity } ],
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
    const [h, m] = newTime.split(':').map(Number);
    const endTotal = h * 60 + m + durMinutes;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    const newEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    try {
      await api.post("/timeline", {
        date: selectedDateKey,
        forceSave: true,
        blocks: [ { id: task.id, title: task.title, startTime: newTime, endTime: newEndTime, status: task.status, category: task.category, intensity: task.intensity } ]
      });
      await reloadPlannerTasks();
      await refreshData();
      showSuccess("Horário atualizado.");
    } catch (error: any) {
      showError(error.message);
    }
  }

  return (
    <div style={{ flex: 1, padding: "20px", background: "var(--warm-bg)", overflowX: 'hidden' }}>
      <WeeklyAgendaHeader todayAnchor={todayAnchor} offsetDias={offsetDias} setOffsetDias={setOffsetDias} />

      {!gcalConnected && (
        <div style={{ padding: "12px 14px", background: "var(--surface-color)", borderRadius: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", border: "1px solid var(--border-neutral)" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarRange size={16} color="var(--accent-peach)" />
            <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>Conectar ao Google Agenda</span>
          </div>
          <AuraButtonV2 variant="ghost" onClick={async () => {
             try {
                const res = await api.get('/gcal/auth-url');
                if (res?.url) window.location.href = res.url;
             } catch (e) {
                console.error(e);
             }
          }}>
            Conectar
          </AuraButtonV2>
        </div>
      )}

      {/* ── Banner: Modo Proteção de Fase Baixa ── */}
      {isLowPhase && (
        <div style={{
          borderRadius: 14, padding: "12px 14px", marginBottom: 14,
          background: cycleReport.phase === "depleted"
            ? "rgba(161,125,108,.12)"
            : "rgba(197,165,147,.10)",
          border: cycleReport.phase === "depleted"
            ? "1.5px solid rgba(161,125,108,.30)"
            : "1.5px solid rgba(197,165,147,.28)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>
              {cycleReport.phase === "depleted" ? "😴" : "🌙"}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: 12, fontWeight: 800, margin: "0 0 3px",
                color: cycleReport.phase === "depleted" ? "#A17D6C" : "var(--accent-peach)",
              }}>
                Modo Proteção Ativo — {cycleReport.phaseLabel}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                {cycleReport.phase === "depleted"
                  ? "Você está em esgotamento. Considere adiar tarefas não urgentes e priorizar descanso."
                  : "Fase baixa detectada. Evite sobrecarregar a agenda — tarefas leves e autocuidado em primeiro lugar."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card" style={PLANNER_SUMMARY_CARD_STYLE}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...LABEL_STYLE, color: "var(--accent-peach-ink)", marginBottom: 6 }}>Agenda</div>
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
              color: "var(--accent-peach-ink)",
              background: "var(--accent-peach-a3)",
              border: "1px solid var(--accent-peach-a5)",
            }}
          >
            {plannerBadgeLabel}
          </span>
        </div>
      </div>

      <div 
         style={{ display: "flex", flexDirection: "column", paddingBottom: 88, overflowX: "hidden" }}
         onTouchStart={handleAgendaTouchStart}
         onTouchEnd={handleAgendaTouchEnd}
      >
        {visibleAgendaSlots.map((slot) => {
          if (slot.kind === "task") {
            const categoryOption = getCategoryStyles(slot.category);

            return (
              <div key={slot.key} className="timeline-slot">
                <span className="timeline-time">{slot.time}</span>
                <div className="timeline-line" />
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
            <div key={slot.key} className="timeline-slot" style={{ minHeight: slot.title ? 100 : 54 }}
                 onDragOver={e => e.preventDefault()}
                 onDrop={e => {
                    e.preventDefault();
                    const tid = e.dataTransfer.getData('text/plain');
                    if (tid) handleDropTaskToTime(tid, slot.time);
                 }}
            >
              <span className="timeline-time" style={{ opacity: slot.title ? 1 : 0.45 }}>{slot.time}</span>
              <div className="timeline-line" style={{ opacity: slot.title ? 1 : 0.2 }} />
              <button
                type="button"
                className="timeline-block-card interactive-card"
                onClick={() => openNewFormAt(slot.time)}
                style={slot.title ? EMPTY_TIMELINE_CARD_STYLE : { width: '100%', background: 'transparent', border: 'none', borderLeft: '2px solid transparent', textAlign: 'left', opacity: 0.6, display: 'flex', alignItems: 'center', boxShadow: 'none' }}
              >
                {slot.title ? (
                  <>
                    <div className="block-title" style={{ color: "var(--text-2)" }}>
                      {slot.title}
                    </div>
                    <div className="block-meta" style={{ marginTop: 4, lineHeight: 1.6 }}>
                      {slot.description}
                    </div>
                    <div
                      className="block-chip"
                      style={{
                        background: "var(--accent-peach-a3)",
                        color: "var(--accent-peach-ink)",
                        border: "1px solid var(--accent-peach-a5)",
                        marginTop: 10
                      }}
                    >
                      <span style={{ fontSize: 11, lineHeight: 1 }}>+</span>
                      Criar bloco
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>&nbsp;&nbsp;+&nbsp;</div>
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


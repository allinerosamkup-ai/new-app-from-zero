// Planner Page v4 — notas+checklist unificados, AI buttons, recorrente com dias
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { parseAiSuggestion } from "../lib/ai";
import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
import { useToast } from "../components/Toast";
import { computeMoodCycle } from '../utils/mood-cycle-engine';
import {
  getTaskMeta, setTaskMeta,
  DEFAULT_META, DEFAULT_RECURRING,
  type ChecklistItem, type RecurringConfig, type NoteMode,
} from "../utils/task-metadata";
import "../styles/aura.css";
import "../styles/aura-v2.css";

// ─── helpers ───────────────────────────────────────────────
function deriveCategory(title: string) {
  const t = title.toLowerCase();
  if (t.includes("meditação") || t.includes("meditar") || t.includes("yoga") || t.includes("autocuidado"))
    return { cat: "AUTOCUIDADO", cor: "var(--menthe)" };
  if (t.includes("reunião") || t.includes("análise") || t.includes("trabalho") || t.includes("projeto"))
    return { cat: "TRABALHO", cor: "var(--lagune)" };
  if (t.includes("almoço") || t.includes("social") || t.includes("amigo"))
    return { cat: "SOCIAL", cor: "var(--social-color)" };
  return { cat: "PESSOAL", cor: "var(--nectarine)" };
}

const CATEGORY_OPTIONS = [
  { label: "Trabalho", cor: "var(--lagune)" },
  { label: "Autocuidado", cor: "var(--menthe)" },
  { label: "Social", cor: "var(--social-color)" },
  { label: "Pessoal", cor: "var(--nectarine)" },
];

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS = ["Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb.", "Dom."];
const MESES = ["Jan.", "Fev.", "Mar.", "Abr.", "Mai.", "Jun.", "Jul.", "Ago.", "Set.", "Out.", "Nov.", "Dez."];

function formatDateLabel(date: Date) {
  return `${DIAS[date.getDay() === 0 ? 6 : date.getDay() - 1]}, ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--nectarine)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <rect x="2" y="3" width="12" height="11" rx="2" /><line x1="2" y1="7" x2="14" y2="7" />
      <line x1="5.5" y1="1.5" x2="5.5" y2="4.5" /><line x1="10.5" y1="1.5" x2="10.5" y2="4.5" />
    </svg>
  );
}

// AI sparkle button
function AiBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <AuraButtonV2
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      style={{ width: "32px", height: "32px", padding: 0 }}
    >
      {loading 
        ? <div className="spinner-sm" style={{ width: "14px", height: "14px", border: "2px solid var(--nectarine)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" /></svg>
      }
    </AuraButtonV2>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  flex: 1, height: "46px", borderRadius: "8px", border: "1.5px solid var(--warm-border-2)",
  padding: "0 14px", fontSize: "14px", fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "var(--text-1)", background: "rgba(255,255,255,.72)", outline: "none", boxSizing: "border-box",
  backdropFilter: "blur(14px)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "var(--text-3)",
  textTransform: "uppercase", letterSpacing: ".08em",
};

// ─── form state types ───────────────────────────────────────
type FormState = {
  title: string;
  time: string;
  category: string;
  noteMode: NoteMode;
  note: string;
  checklist: ChecklistItem[];
  checklistInput: string;
  recurring: RecurringConfig;
  energyLevel: 'alta' | 'media' | 'leve';
};

const EMPTY_FORM: FormState = {
  title: "", time: "09:00", category: "Pessoal",
  noteMode: "text", note: "", checklist: [], checklistInput: "",
  recurring: { ...DEFAULT_RECURRING },
  energyLevel: 'media',
};

// ─── NoteSection component ──────────────────────────────────
function NoteSection({
  form, setForm, context,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  context: { title: string; category: string };
}) {
  const [aiLoading, setAiLoading] = useState<null | "notes" | "checklist" | "item">(null);
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const { showError } = useToast();

  async function suggestNotes() {
    setAiLoading("notes");
    try {
      const res = await api.post('/ai/suggest', { type: 'task-notes', context });
      if (res.suggestion) setForm(f => ({ ...f, note: res.suggestion }));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel gerar notas.");
    } finally { setAiLoading(null); }
  }

  async function suggestChecklist() {
    setAiLoading("checklist");
    try {
      const res = await api.post('/ai/suggest', { type: 'task-checklist', context });
      if (res.suggestion) {
        const parsed = parseAiSuggestion<string[]>(res.suggestion);
        const items: ChecklistItem[] = parsed.map(text => ({ id: Date.now().toString() + Math.random(), text, done: false }));
        setForm(f => ({ ...f, checklist: [...f.checklist, ...items] }));
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel gerar checklist.");
    } finally { setAiLoading(null); }
  }

  function addChecklistItem() {
    const text = form.checklistInput.trim();
    if (!text) return;
    setForm(f => ({ ...f, checklist: [...f.checklist, { id: Date.now().toString(), text, done: false }], checklistInput: "" }));
  }

  const checklistRecRef = useRef<any>(null);
  const [checklistRecording, setChecklistRecording] = useState(false);

  function toggleVoiceChecklistInput() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (checklistRecording && checklistRecRef.current) {
      checklistRecRef.current.stop();
      setChecklistRecording(false);
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setForm(f => ({ ...f, checklistInput: f.checklistInput ? f.checklistInput + " " + transcript : transcript }));
    };
    rec.onend = () => setChecklistRecording(false);
    rec.onerror = () => setChecklistRecording(false);
    rec.start();
    checklistRecRef.current = rec;
    setChecklistRecording(true);
  }

  function toggleVoiceNote() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setForm(f => ({ ...f, note: f.note ? f.note + " " + transcript : transcript }));
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }

  return (
    <div style={{ marginBottom: "12px" }}>
      {/* Section header + mode tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={LABEL_STYLE}>Notas</span>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["text", "checklist"] as NoteMode[]).map(mode => (
            <AuraButtonV2 key={mode} onClick={() => setForm(f => ({ ...f, noteMode: mode }))}
              style={{ padding: "4px 10px", borderRadius: "6px", border: "1.5px solid", borderColor: form.noteMode === mode ? "var(--nectarine)" : "var(--warm-border)", background: form.noteMode === mode ? "var(--nectarine-a3)" : "transparent", color: form.noteMode === mode ? "var(--nectarine)" : "var(--text-3)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {mode === "text" ? "Texto" : "Checklist"}
            </AuraButtonV2>
          ))}
        </div>
      </div>

      {/* TEXT MODE */}
      {form.noteMode === "text" && (
        <div style={{ position: "relative" }}>
          <textarea
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="Observações, contexto, links importantes..."
            rows={3}
            style={{
              width: "100%", borderRadius: "8px",
              border: "1.5px solid var(--warm-border-2)",
              padding: "10px 90px 10px 14px",
              fontSize: "13px", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-1)",
              background: "var(--warm-bg)", outline: "none", resize: "none", boxSizing: "border-box"
            }}
          />
          <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px" }}>
            <AuraButtonV2
              onClick={toggleVoiceNote}
              title={isRecording ? "Parar microfone" : "Ditado por voz"}
              style={{
                width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--warm-border-2)",
                background: isRecording ? "var(--menthe)" : "rgba(255,255,255,.9)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isRecording ? "#fff" : "var(--text-2)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </AuraButtonV2>
            <AiBtn onClick={suggestNotes} loading={aiLoading === "notes"} />
          </div>
        </div>
      )}

      {/* CHECKLIST MODE */}
      {form.noteMode === "checklist" && (
        <div>
          {form.checklist.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <AuraButtonV2 onClick={() => setForm(f => ({ ...f, checklist: f.checklist.map(i => i.id === item.id ? { ...i, done: !i.done } : i) }))}
                style={{ width: "20px", height: "20px", borderRadius: "4px", border: `2px solid ${item.done ? "var(--menthe)" : "var(--warm-border-2)"}`, background: item.done ? "var(--menthe)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.done && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </AuraButtonV2>
              <span style={{ flex: 1, fontSize: "13px", color: item.done ? "var(--text-3)" : "var(--text-1)", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
              <AuraButtonV2 onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter(i => i.id !== item.id) }))}
                style={{ border: "none", background: "none", color: "var(--text-3)", cursor: "pointer", fontSize: "16px", padding: "0 2px", lineHeight: 1 }}>×</AuraButtonV2>
            </div>
          ))}
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input value={form.checklistInput} onChange={e => setForm(f => ({ ...f, checklistInput: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addChecklistItem()}
                placeholder="Novo item..." style={{ ...INPUT_STYLE, height: "38px", width: "100%", paddingRight: "42px" }} />
              <button
                type="button"
                onClick={toggleVoiceChecklistInput}
                title={checklistRecording ? "Parar microfone" : "Ditado por voz"}
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--warm-border-2)",
                  background: checklistRecording ? "var(--menthe)" : "rgba(255,255,255,.9)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={checklistRecording ? "#fff" : "var(--text-2)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            </div>
            <AiBtn onClick={suggestChecklist} loading={aiLoading === "checklist"} />
            <AuraButtonV2 onClick={addChecklistItem} style={{ height: "38px", width: "38px", borderRadius: "8px", border: "none", background: "var(--nectarine)", color: "#fff", fontWeight: 700, fontSize: "18px", cursor: "pointer" }}>+</AuraButtonV2>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RecurringSection component ─────────────────────────────
function RecurringSection({ recurring, setRecurring }: {
  recurring: RecurringConfig;
  setRecurring: (r: RecurringConfig) => void;
}) {
  function toggleDay(dayIdx: number) {
    const days = recurring.days.includes(dayIdx)
      ? recurring.days.filter(d => d !== dayIdx)
      : [...recurring.days, dayIdx];
    setRecurring({ ...recurring, days });
  }

  return (
    <div style={{ marginBottom: "12px" }}>
      {/* Toggle row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: recurring.enabled ? "12px" : 0 }}>
        <span style={LABEL_STYLE}>Recorrente</span>
        <AuraButtonV2 onClick={() => setRecurring({ ...recurring, enabled: !recurring.enabled })}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "36px", height: "20px", borderRadius: "999px", background: recurring.enabled ? "var(--menthe)" : "var(--warm-border-2)", position: "relative", transition: "background 200ms" }}>
            <div style={{ position: "absolute", top: "2px", left: recurring.enabled ? "18px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "#fff", transition: "left 200ms", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
          </div>
        </AuraButtonV2>
      </div>

      {recurring.enabled && (
        <>
          {/* Frequency chips */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            {(["daily", "weekly", "custom"] as const).map(freq => {
              const labels = { daily: "Diária", weekly: "Semanal", custom: "Personalizada" };
              const isActive = recurring.frequency === freq;
              return (
                <AuraButtonV2 key={freq} onClick={() => setRecurring({ ...recurring, frequency: freq })}
                  style={{ padding: "5px 12px", borderRadius: "999px", border: `1.5px solid ${isActive ? "var(--lagune)" : "var(--warm-border)"}`, background: isActive ? "rgba(176,180,196,.12)" : "transparent", color: isActive ? "var(--lagune)" : "var(--text-2)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {labels[freq]}
                </AuraButtonV2>
              );
            })}
          </div>

          {/* Days selector (weekly and custom) */}
          {(recurring.frequency === "weekly" || recurring.frequency === "custom") && (
            <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
              {DAY_LABELS.map((d, i) => {
                const isActive = recurring.days.includes(i);
                return (
                  <AuraButtonV2 key={i} onClick={() => toggleDay(i)}
                    style={{ flex: 1, height: "32px", borderRadius: "8px", border: `1.5px solid ${isActive ? "var(--nectarine)" : "var(--warm-border)"}`, background: isActive ? "var(--nectarine)" : "transparent", color: isActive ? "#fff" : "var(--text-3)", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                    {d}
                  </AuraButtonV2>
                );
              })}
            </div>
          )}

          {/* Every N days (custom) */}
          {recurring.frequency === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "var(--text-2)" }}>A cada</span>
              <input type="number" min={1} max={365} value={recurring.everyNDays}
                onChange={e => setRecurring({ ...recurring, everyNDays: Math.max(1, Number(e.target.value)) })}
                style={{ width: "60px", height: "36px", borderRadius: "8px", border: "1.5px solid var(--warm-border-2)", padding: "0 10px", fontSize: "14px", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-1)", background: "var(--warm-bg)", outline: "none", textAlign: "center" }} />
              <span style={{ fontSize: "13px", color: "var(--text-2)" }}>dias</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────
export function PlannerPage() {
  const { state, addTask, updateTask, removeTask, reorderTasks } = useAuraStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showSuccess } = useToast();

  const [dataBase] = useState(() => new Date(2026, 2, 18));
  const [offsetDias, setOffsetDias] = useState(0);
  const [showMonth, setShowMonth] = useState(false);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<FormState>({ ...EMPTY_FORM });

  const [editingTaskId, setEditingTaskId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ ...EMPTY_FORM });

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  const [aiTitleLoading, setAiTitleLoading] = useState(false);

  const dataAtual = new Date(dataBase);
  dataAtual.setDate(dataBase.getDate() + offsetDias);

  const cycleReport = useMemo(() => computeMoodCycle(state.checkinHistory || []), [state.checkinHistory]);

  // #5 — Google Calendar
  type GcalEvent = { id: string; summary: string; start: { dateTime?: string; date?: string }; end?: { dateTime?: string } };
  const [gcalConnected, setGcalConnected] = useState(() => localStorage.getItem("gcal_connected") === "1");
  const [gcalEvents, setGcalEvents] = useState<GcalEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);

  // Detect ?gcal=connected redirect from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal") === "connected") {
      setGcalConnected(true);
      localStorage.setItem("gcal_connected", "1");
      navigate("/planner", { replace: true });
    }
  }, []);

  // Fetch calendar events when connected
  useEffect(() => {
    if (!gcalConnected) return;
    setGcalLoading(true);
    api.get("/gcal/events")
      .then((res: any) => setGcalEvents(res?.events?.slice(0, 5) || []))
      .catch(() => {
        // Token may be expired — disconnect silently
        localStorage.removeItem("gcal_connected");
        setGcalConnected(false);
      })
      .finally(() => setGcalLoading(false));
  }, [gcalConnected]);

  function formatGcalTime(ev: GcalEvent) {
    const raw = ev.start.dateTime || ev.start.date;
    if (!raw) return "";
    const d = new Date(raw);
    if (ev.start.date && !ev.start.dateTime) return "Dia todo";
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const isLowPhase = cycleReport.phase === "low" || cycleReport.phase === "depleted";
  const isElevatedPhase = cycleReport.phase === "elevated";

  async function connectGcal() {
    try {
      const res: any = await api.get("/gcal/auth-url");
      if (res?.url) window.location.href = res.url;
    } catch {
      showError("Não foi possível iniciar a conexão com o Google.");
    }
  }

  async function disconnectGcal() {
    try {
      await api.post("/gcal/disconnect", {});
    } catch { /* ignore */ }
    localStorage.removeItem("gcal_connected");
    setGcalConnected(false);
    setGcalEvents([]);
  }

  // #6 — Planner adaptativo: detecta se a fase mudou desde a última visita
  const [phaseAtLoad] = useState<string>(() => {
    const stored = localStorage.getItem("aura_planner_phase_at_load");
    const current = localStorage.getItem("aura_last_phase");
    return stored ?? current ?? "";
  });
  const [adaptBannerDismissed, setAdaptBannerDismissed] = useState(false);
  const [adaptLoading, setAdaptLoading] = useState(false);

  // Salva a fase atual na primeira renderização para comparação na próxima visita
  useEffect(() => {
    if (cycleReport.phase !== "insufficient_data") {
      localStorage.setItem("aura_planner_phase_at_load", cycleReport.phase);
    }
  }, [cycleReport.phase]);

  const showAdaptBanner =
    !adaptBannerDismissed &&
    phaseAtLoad &&
    phaseAtLoad !== cycleReport.phase &&
    cycleReport.phase !== "insufficient_data" &&
    state.tasks.length > 0;

  useEffect(() => {
    const openTaskId = (location.state as any)?.openTaskId;
    if (openTaskId) {
      const task = state.tasks.find(t => t.id === openTaskId);
      if (task) openEditSheet(task.id, task.title, task.time);
      navigate("/planner", { replace: true, state: {} });
    }
  }, [location.state, state.tasks]);

  function openEditSheet(id: string | number, title: string, time: string) {
    const meta = getTaskMeta(id);
    const catOpt = CATEGORY_OPTIONS.find(o => deriveCategory(title).cat === o.label.toUpperCase()) ?? CATEGORY_OPTIONS[3];
    setEditForm({
      title, time, category: catOpt.label,
      noteMode: meta.noteMode ?? "text",
      note: meta.note,
      checklist: [...meta.checklist],
      checklistInput: "",
      recurring: meta.recurring ? { ...meta.recurring } : { ...DEFAULT_RECURRING },
      energyLevel: meta.energyLevel ?? 'media',
    });
    setEditingTaskId(id);
  }

  async function handleSaveEdit() {
    if (!editingTaskId) return;
    await updateTask(editingTaskId, { title: editForm.title.trim() || editForm.title, time: editForm.time, category: editForm.category });
    setTaskMeta(editingTaskId, { 
      noteMode: editForm.noteMode, 
      note: editForm.note, 
      checklist: editForm.checklist, 
      recurring: editForm.recurring,
      energyLevel: editForm.energyLevel,
    });
    setEditingTaskId(null);
  }

  async function handleDeleteTask() {
    if (!editingTaskId) return;
    await removeTask(editingTaskId);
    setEditingTaskId(null);
  }

  async function handleAddBlock() {
    const title = newForm.title.trim();
    if (!title) return;
    try {
      await addTask(title, newForm.time, newForm.category);
      setTimeout(() => {
        const task = state.tasks.find(t => t.title === title);
        if (task) setTaskMeta(task.id, { 
          noteMode: newForm.noteMode, 
          note: newForm.note, 
          checklist: newForm.checklist, 
          recurring: newForm.recurring,
          energyLevel: newForm.energyLevel,
        });
      }, 600);
      setNewForm({ ...EMPTY_FORM });
      setShowNewForm(false);
      showSuccess("Bloco adicionado ao planner.");
    } catch (err) {
      console.error("Erro ao adicionar:", err);
      showError(err instanceof Error ? err.message : "Nao foi possivel adicionar o bloco.");
    }
  }

  async function suggestTitle(form: FormState, setForm: React.Dispatch<React.SetStateAction<FormState>>) {
    setAiTitleLoading(true);
    try {
      const res = await api.post('/ai/suggest', { type: 'task-title', context: { category: form.category, time: form.time } });
      if (res.suggestion) setForm(f => ({ ...f, title: res.suggestion }));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel gerar titulo.");
    } finally { setAiTitleLoading(false); }
  }

  function handlePointerUp() {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) reorderTasks(dragIdx, dragOverIdx);
    setDragIdx(null);
    setDragOverIdx(null);
    isDraggingRef.current = false;
  }

  const blocos = (state.tasks || []).map(task => {
    const { cat, cor } = deriveCategory(task.title);
    return { id: task.id, hora: task.time, titulo: task.title, done: task.done, cat, cor };
  });

  function renderMonthModal() {
    const year = dataAtual.getFullYear(), month = dataAtual.getMonth();
    const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const cells: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const checkinDates = new Set((state.checkinHistory || []).map(c => c.date));
    return (
      <>
        <div onClick={() => setShowMonth(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 29 }} />
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--warm-bg)", borderRadius: "16px", padding: "16px", boxShadow: "0 8px 32px rgba(0,0,0,.18)", maxWidth: "320px", width: "90%", zIndex: 30 }}>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "14px", fontWeight: 700, color: "var(--text-1)", textAlign: "center", marginBottom: "8px" }}>{MESES[month]} {year}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
            {["S","T","Q","Q","S","S","D"].map((d, i) => <span key={i} style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>{d}</span>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isSel = day === dataAtual.getDate();
              return (
                <AuraButtonV2 key={i} onClick={() => { const t = new Date(year,month,day); setOffsetDias(Math.round((t.getTime()-dataBase.getTime())/(86400000))); setShowMonth(false); }}
                  style={{ width: "100%", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", cursor: "pointer", background: isSel ? "rgba(243,176,140,.92)" : "transparent", color: isSel ? "#fff" : "var(--text-2)", fontSize: 12, fontWeight: isSel ? 800 : 400, fontFamily: "'Plus Jakarta Sans', sans-serif", position: "relative" }}>
                  {day}
                  {checkinDates.has(dateStr) && !isSel && <span style={{ position: "absolute", bottom: 2, width: 4, height: 4, borderRadius: "50%", background: "var(--menthe)" }} />}
                </AuraButtonV2>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ─── shared sheet body ──────────────────────────────────
  function SheetBody({ form, setForm, onSave, onCancel, saveLabel, extraBtn }: {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    onSave: () => void;
    onCancel: () => void;
    saveLabel: string;
    extraBtn?: React.ReactNode;
  }) {
    const titleRecRef = useRef<any>(null);
    const [titleRecording, setTitleRecording] = useState(false);

    function toggleVoiceTitle() {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      if (titleRecording && titleRecRef.current) {
        titleRecRef.current.stop();
        setTitleRecording(false);
        return;
      }
      const rec = new SR();
      rec.lang = "pt-BR";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setForm(f => ({ ...f, title: f.title ? f.title + " " + transcript : transcript }));
      };
      rec.onend = () => setTitleRecording(false);
      rec.onerror = () => setTitleRecording(false);
      rec.start();
      titleRecRef.current = rec;
      setTitleRecording(true);
    }

    return (
      <>
        {/* Title row */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "10px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input type="text" placeholder="Nome do bloco" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={{ ...INPUT_STYLE, width: "100%", paddingRight: "42px" }} />
            <button
              type="button"
              onClick={toggleVoiceTitle}
              title={titleRecording ? "Parar microfone" : "Ditado por voz"}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--warm-border-2)",
                background: titleRecording ? "var(--menthe)" : "rgba(255,255,255,.9)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={titleRecording ? "#fff" : "var(--text-2)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
          </div>
          <AiBtn onClick={() => suggestTitle(form, setForm)} loading={aiTitleLoading} />
        </div>

        {/* Time */}
        <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
          style={{ ...INPUT_STYLE, flex: "none", width: "100%", marginBottom: "10px" }} />

        {/* Energy Level Selector */}
        <div style={{ marginBottom: "12px" }}>
          <span style={LABEL_STYLE}>Energia Necessária</span>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            {(['leve', 'media', 'alta'] as const).map(level => {
              const isActive = form.energyLevel === level;
              const color = level === 'alta' ? 'var(--nectarine-10)' : level === 'media' ? '#E6B84A' : 'var(--menthe)';
              const emoji = level === 'alta' ? '🔴' : level === 'media' ? '🟡' : '🟢';
              return (
                <AuraButtonV2 key={level} onClick={() => setForm(f => ({ ...f, energyLevel: level }))}
                  style={{ flex: 1, padding: "8px", borderRadius: "10px", border: isActive ? `2px solid ${color}` : "1.5px solid var(--warm-border)", background: isActive ? `${color}15` : "transparent", color: isActive ? color : "var(--text-2)", fontSize: "12px", fontWeight: 700, textTransform: "capitalize" }}>
                  {emoji} {level}
                </AuraButtonV2>
              );
            })}
          </div>
        </div>

        {/* Category chips */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
          {CATEGORY_OPTIONS.map(opt => {
            const isActive = form.category === opt.label;
            return (
              <AuraButtonV2 key={opt.label} onClick={() => setForm(f => ({ ...f, category: opt.label }))}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "999px", border: isActive ? `2px solid ${opt.cor}` : "1.5px solid var(--warm-border)", background: isActive ? `${opt.cor}1A` : "transparent", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-1)" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: opt.cor }} />{opt.label}
              </AuraButtonV2>
            );
          })}
        </div>

        {/* Notes + Checklist (unified) */}
        <NoteSection form={form} setForm={setForm} context={{ title: form.title, category: form.category }} />

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--warm-border)", margin: "4px 0 12px" }} />

        {/* Recurring */}
        <RecurringSection recurring={form.recurring} setRecurring={r => setForm(f => ({ ...f, recurring: r }))} />

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end", alignItems: "center" }}>
          {extraBtn}
          <AuraButtonV2 variant="ghost" onClick={onCancel}>
            Cancelar
          </AuraButtonV2>
          <AuraButtonV2 variant="primary" onClick={onSave}>
            {saveLabel}
          </AuraButtonV2>
        </div>
      </>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)", position: "relative" }}>
      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header sticky */}
      <div className="planner-sticky-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <AuraButtonV2 variant="outline" size="sm" onClick={() => setOffsetDias(d => d - 1)} style={{ width: "32px", height: "32px", padding: 0 }}>‹</AuraButtonV2>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "15px", fontWeight: 700, color: "var(--text-1)" }}>{formatDateLabel(dataAtual)}</span>
            <AuraButtonV2 onClick={() => setShowMonth(m => !m)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}><CalendarIcon /></AuraButtonV2>
          </div>
          <AuraButtonV2 variant="outline" size="sm" onClick={() => setOffsetDias(d => d + 1)} style={{ width: "32px", height: "32px", padding: 0 }}>›</AuraButtonV2>
        </div>
        <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--nectarine)", textAlign: "center" }}>Timeline do dia</p>
      </div>

      {/* Week strip */}
      <div className="planner-week-strip">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(dataBase);
          d.setDate(dataBase.getDate() + offsetDias - dataAtual.getDay() + i + 1);
          const isToday = d.getDate() === dataAtual.getDate() && d.getMonth() === dataAtual.getMonth();
          return (
            <AuraButtonV2 key={i} onClick={() => setOffsetDias(Math.round((d.getTime() - dataBase.getTime()) / 86400000))}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 0", borderRadius: 10, border: "none", cursor: "pointer", background: isToday ? "var(--nectarine)" : "transparent", color: isToday ? "#fff" : "var(--text-2)" }}>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][i]}</span>
              <span style={{ fontSize: 14, fontWeight: isToday ? 800 : 500, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{d.getDate()}</span>
            </AuraButtonV2>
          );
        })}
      </div>

      {showMonth && renderMonthModal()}

      {/* ── #6: Planner Adaptativo — banner de fase mudou ── */}
      {showAdaptBanner && (
        <div style={{
          margin: "8px 12px 0",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1.5px solid rgba(215,137,127,.35)",
          background: "rgba(215,137,127,.08)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{cycleReport.phaseEmoji}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "var(--nectarine)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 2px" }}>
                Sua fase mudou
              </p>
              <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.4 }}>
                Você entrou em <strong>{cycleReport.phaseLabel}</strong>. Quer que a Aura reajuste seu planner para esta fase?
              </p>
            </div>
            <button
              onClick={() => setAdaptBannerDismissed(true)}
              style={{ width: 20, height: 20, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-3)", fontSize: 13, padding: 0 }}
            >✕</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={adaptLoading}
              onClick={async () => {
                setAdaptLoading(true);
                try {
                  const res: any = await api.post("/ai/suggest", {
                    type: "agenda-blocks",
                    context: {
                      mood: state.mood,
                      moodLabel: cycleReport.phaseLabel,
                      energia: cycleReport.avgEnergy7d,
                      wakeTime: "07:00",
                      sleepTime: "22:00",
                      history: (state.checkinHistory || []).slice(0, 3).map(h => ({
                        date: h.date, humor: h.humor, energia: h.energia,
                      })),
                      moodCycleContext: cycleReport.aiContext,
                    },
                  });
                  if (res?.suggestion) {
                    showSuccess("Sugestões geradas! Confira no chat da Aura.");
                    navigate("/aura");
                  }
                } catch {
                  showError("Não foi possível gerar o reajuste agora.");
                } finally {
                  setAdaptLoading(false);
                  setAdaptBannerDismissed(true);
                }
              }}
              style={{
                flex: 1, height: 32, borderRadius: 8, border: "none",
                background: adaptLoading ? "rgba(215,137,127,.4)" : "var(--nectarine)",
                color: "white", fontSize: 12, fontWeight: 700, cursor: adaptLoading ? "default" : "pointer",
              }}
            >
              {adaptLoading ? "Gerando..." : "Reajustar planner"}
            </button>
            <button
              onClick={() => setAdaptBannerDismissed(true)}
              style={{ flex: 1, height: 32, borderRadius: 8, border: "1.5px solid var(--warm-border-2)", background: "transparent", color: "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Manter como está
            </button>
          </div>
        </div>
      )}

      {/* ── #5: Google Calendar Panel ── */}
      <div style={{ margin: "10px 12px 0" }}>
        {!gcalConnected ? (
          <button
            onClick={connectGcal}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "10px",
              padding: "11px 14px", borderRadius: "12px", cursor: "pointer",
              background: "rgba(255,255,255,.62)", backdropFilter: "blur(20px)",
              border: "1.5px solid rgba(255,255,255,.70)",
              boxShadow: "0 2px 12px rgba(0,0,0,.07)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="var(--lagune)" strokeWidth="1.8"/>
              <line x1="3" y1="9" x2="21" y2="9" stroke="var(--lagune)" strokeWidth="1.8"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="var(--lagune)" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="var(--lagune)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text-1)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Conectar Google Calendar</p>
              <p style={{ margin: 0, fontSize: "11px", color: "var(--text-3)" }}>Veja seus eventos aqui e receba insights de fase</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ) : (
          <div style={{
            borderRadius: "14px", overflow: "hidden",
            background: "rgba(255,255,255,.62)", backdropFilter: "blur(20px)",
            border: "1.5px solid rgba(255,255,255,.70)",
            boxShadow: "0 2px 12px rgba(0,0,0,.07)",
          }}>
            {/* Phase-aware banner */}
            {isElevatedPhase && (
              <div style={{ padding: "8px 14px", background: "rgba(99,152,169,.15)", borderBottom: "1px solid rgba(99,152,169,.25)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>⚡</span>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--lagune-11)", fontWeight: 700 }}>
                  Fase Elevada — janela de alta produtividade. Priorize entregas importantes hoje.
                </p>
              </div>
            )}
            {isLowPhase && (
              <div style={{ padding: "8px 14px", background: "rgba(215,137,127,.12)", borderBottom: "1px solid rgba(215,137,127,.25)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>🛑</span>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--nectarine-11)", fontWeight: 700 }}>
                  Fase {cycleReport.phaseLabel} — evite agendar novos compromissos. Priorize descanso.
                </p>
              </div>
            )}
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="17" rx="2" stroke="var(--lagune)" strokeWidth="1.8"/>
                  <line x1="3" y1="9" x2="21" y2="9" stroke="var(--lagune)" strokeWidth="1.8"/>
                  <line x1="8" y1="2" x2="8" y2="6" stroke="var(--lagune)" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="16" y1="2" x2="16" y2="6" stroke="var(--lagune)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-1)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: ".03em" }}>Google Calendar</span>
              </div>
              <button
                onClick={disconnectGcal}
                style={{ fontSize: "10px", color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
              >Desconectar</button>
            </div>
            {/* Events list */}
            {gcalLoading ? (
              <div style={{ padding: "12px 14px", display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--lagune)", borderTopColor: "transparent", animation: "spin .7s linear infinite" }} />
                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>Carregando eventos…</span>
              </div>
            ) : gcalEvents.length === 0 ? (
              <p style={{ padding: "10px 14px 12px", margin: 0, fontSize: "12px", color: "var(--text-3)" }}>Nenhum evento nos próximos 7 dias.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingBottom: 8 }}>
                {gcalEvents.map(ev => {
                  const time = formatGcalTime(ev);
                  const isHighPriority = isElevatedPhase;
                  return (
                    <div key={ev.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 14px",
                      background: isHighPriority ? "rgba(99,152,169,.07)" : "transparent",
                      borderLeft: isHighPriority ? "3px solid var(--lagune)" : "3px solid transparent",
                    }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--lagune)", minWidth: 36, flexShrink: 0 }}>{time}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-1)", fontFamily: "'Plus Jakarta Sans', sans-serif", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.summary || "(Sem título)"}</span>
                      {isHighPriority && <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: "rgba(99,152,169,.2)", color: "var(--lagune-11)", flexShrink: 0 }}>⚡ ALTA</span>}
                      {isLowPhase && <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: "rgba(215,137,127,.15)", color: "var(--nectarine-11)", flexShrink: 0 }}>🛑 CHECAR</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="screen-content" style={{ paddingTop: "14px", paddingBottom: "100px", display: "flex", flexDirection: "column", gap: 0 }}>
        {blocos.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-3)", fontSize: "13px" }}>
            Nenhum bloco para hoje. Toque em "+ Novo bloco".
          </div>
        )}
        {blocos.map((bloco, idx) => {
          const meta = getTaskMeta(bloco.id);
          const checkCount = meta.checklist.length;
          const doneCount = meta.checklist.filter(i => i.done).length;
          const energyLevel = meta.energyLevel || 'media';
          const energyWarning = energyLevel === 'alta' && (cycleReport.energyForecast === 'low' || cycleReport.energyForecast === 'rest');

          return (
            <div key={idx} className="timeline-slot"
              onPointerEnter={() => { if (dragIdx !== null) setDragOverIdx(idx); }}
              style={{ borderTop: dragOverIdx === idx && dragIdx !== null ? "2px solid var(--nectarine)" : "2px solid transparent" }}>
              <span className="timeline-time">{bloco.hora}</span>
              <div className="timeline-line" />
              <div className="timeline-block-card"
                style={{ 
                  borderLeftColor: bloco.cor, 
                  cursor: dragIdx !== null ? "grabbing" : "grab", 
                  opacity: dragIdx === idx ? 0.6 : 1, 
                  boxShadow: dragIdx === idx ? "0 8px 24px rgba(0,0,0,.15)" : undefined, 
                  transition: "opacity 150ms, box-shadow 150ms", 
                  touchAction: "none",
                  border: energyWarning ? "1.5px solid var(--nectarine)" : undefined,
                  background: energyWarning ? "var(--nectarine-a3)" : undefined
                }}
                onPointerDown={e => { e.preventDefault(); isDraggingRef.current = false; setDragIdx(idx); }}
                onPointerMove={() => { isDraggingRef.current = true; }}
                onPointerUp={handlePointerUp}
                onClick={() => { if (!isDraggingRef.current) openEditSheet(bloco.id, bloco.titulo, bloco.hora); }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                  <p className="block-title" style={{ textDecoration: bloco.done ? "line-through" : "none", color: bloco.done ? "var(--text-3)" : "var(--text-1)", flex: 1, margin: 0 }}>{bloco.titulo}</p>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <div style={{ 
                      fontSize: "10px", 
                      fontWeight: 800, 
                      padding: "2px 6px", 
                      borderRadius: "4px", 
                      background: energyLevel === 'alta' ? "var(--nectarine-10)" : energyLevel === 'media' ? "#E6B84A" : "var(--menthe)",
                      color: "#fff",
                      textTransform: "uppercase"
                    }}>
                      {energyLevel}
                    </div>
                    {!bloco.done && (
                      <button
                        type="button"
                        title="Iniciar Pomodoro"
                        onClick={e => { e.stopPropagation(); navigate("/pomodoro", { state: { taskTitle: bloco.titulo } }); }}
                        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: "1.5px solid var(--warm-border-2)", background: "var(--warm-bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}
                      >
                        ⏱
                      </button>
                    )}
                  </div>
                </div>
                {energyWarning && (
                  <div style={{ fontSize: "10px", color: "var(--nectarine-10)", fontWeight: 700, marginBottom: "4px" }}>
                    ⚠️ Aura sugere adiar — energia baixa hoje
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <p className="block-meta" style={{ margin: 0 }}>{bloco.hora} · {bloco.done ? "Concluído" : "Pendente"}</p>
                  {checkCount > 0 && <span style={{ fontSize: "11px", color: doneCount === checkCount ? "var(--menthe)" : "var(--text-3)", fontWeight: 600 }}>☑ {doneCount}/{checkCount}</span>}
                  {meta.recurring?.enabled && <span style={{ fontSize: "10px" }}>🔄</span>}
                  {meta.note && <span style={{ fontSize: "10px" }}>📝</span>}
                </div>
                <div className="block-chip" style={{ background: `${bloco.cor}1A`, color: bloco.cor === "var(--menthe)" ? "var(--menthe-11)" : bloco.cor === "var(--lagune)" ? "var(--lagune-11)" : bloco.cor === "var(--social-color)" ? "var(--social-text)" : "var(--nectarine-11)", border: `1px solid ${bloco.cor}40` }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: bloco.cor }} />{bloco.cat}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB */}
      <AuraButtonV2
        className="btn-fab"
        onClick={() => { setNewForm({ ...EMPTY_FORM }); setShowNewForm(true); }}
        title="Novo bloco"
        style={{ zIndex: 20 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </AuraButtonV2>

      {/* NEW BLOCK SHEET */}
      {showNewForm && (
        <>
          <div onClick={() => setShowNewForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 29 }} />
          <div className="planner-sheet">
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 700, color: "var(--text-1)", marginBottom: "14px" }}>Novo bloco</p>
            <SheetBody form={newForm} setForm={setNewForm} onSave={handleAddBlock} onCancel={() => setShowNewForm(false)} saveLabel="Adicionar" />
          </div>
        </>
      )}

      {/* EDIT SHEET */}
      {editingTaskId !== null && (
        <>
          <div onClick={() => setEditingTaskId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 29 }} />
          <div className="planner-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Editar bloco</p>
            </div>
            <SheetBody form={editForm} setForm={setEditForm} onSave={handleSaveEdit} onCancel={() => setEditingTaskId(null)} saveLabel="Salvar"
              extraBtn={
                <AuraButtonV2 variant="ghost" size="sm" onClick={handleDeleteTask} style={{ color: "var(--semantic-error)" }}>
                  Excluir
                </AuraButtonV2>
              } />
          </div>
        </>
      )}
    </div>
  );
}


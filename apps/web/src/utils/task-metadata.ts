// Task metadata — notes, checklist, recurring (stored in localStorage)

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type RecurringConfig = {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'custom';
  days: number[]; // 0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex, 5=Sáb, 6=Dom
  everyNDays: number; // used when frequency === 'custom'
};

export type NoteMode = 'text' | 'checklist';

export type TaskMeta = {
  noteMode: NoteMode;
  note: string;
  checklist: ChecklistItem[];
  recurring: RecurringConfig;
  energyLevel?: 'alta' | 'media' | 'leve';
  lastResetDate?: string;
};

export const DEFAULT_RECURRING: RecurringConfig = {
  enabled: false,
  frequency: 'daily',
  days: [],
  everyNDays: 1,
};

export const DEFAULT_META: TaskMeta = {
  noteMode: 'text',
  note: '',
  checklist: [],
  recurring: { ...DEFAULT_RECURRING },
  energyLevel: 'media',
};

const STORAGE_KEY = 'aura-task-meta-v2';

function loadAll(): Record<string, TaskMeta> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, TaskMeta>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function getTaskMeta(taskId: string | number): TaskMeta {
  const all = loadAll();
  const meta: TaskMeta = all[String(taskId)] ?? { ...DEFAULT_META, recurring: { ...DEFAULT_RECURRING } };
  // Auto-reset checklist for recurring tasks on a new day
  if (meta.recurring.enabled && meta.lastResetDate && meta.lastResetDate !== todayStr()) {
    const reset: TaskMeta = {
      ...meta,
      checklist: meta.checklist.map(i => ({ ...i, done: false })),
      lastResetDate: undefined,
    };
    all[String(taskId)] = reset;
    saveAll(all);
    return reset;
  }
  return meta;
}

export function setTaskMeta(taskId: string | number, updates: Partial<TaskMeta>) {
  const all = loadAll();
  const id = String(taskId);
  const current = getTaskMeta(id);
  all[id] = { ...current, ...updates };
  saveAll(all);
}

export function toggleChecklistItem(taskId: string | number, itemId: string) {
  const meta = getTaskMeta(taskId);
  const checklist = meta.checklist.map(i =>
    i.id === itemId ? { ...i, done: !i.done } : i
  );
  const allDone = checklist.length > 0 && checklist.every(i => i.done);
  setTaskMeta(taskId, {
    checklist,
    lastResetDate: allDone ? todayStr() : meta.lastResetDate,
  });
}

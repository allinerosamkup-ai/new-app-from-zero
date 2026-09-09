import type { Goal, GoalNote, SubGoal } from "../../features/aura/types";

export type ComposerMode = "ai-goal" | "note" | "reschedule" | "manual" | null;

export type TreeNode = {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  done: boolean;
  estimatedMinutes: number;
  scheduledFor?: string | null;
  doneWhen?: string | null;
  conflict: boolean;
  actionId?: string;
  children: TreeNode[];
};

export type PreviewTask = {
  id: string;
  title: string;
  doneWhen: string;
  estimatedMinutes: number;
  effortSize: "small" | "medium" | "large";
  level: 1 | 2 | 3;
  milestoneId?: string;
  parentId?: string | null;
  basedOn: "stated" | "inferred";
};

const EFFORT_MINUTES = { small: 25, medium: 60, large: 120 } as const;

export function effortToMinutes(effort?: SubGoal["effortSize"]): number {
  return EFFORT_MINUTES[effort ?? "small"];
}

export function readWideLayout(query?: { matches: boolean } | null): boolean {
  return Boolean(query?.matches);
}

export function pickActiveGoal<T extends { id: string | number }>(
  active: T[],
  selectedId?: string | number | null,
  focusedId?: string | number | null,
): T | null {
  const wanted = selectedId ?? focusedId ?? null;
  if (wanted != null) {
    const match = active.find((goal) => String(goal.id) === String(wanted));
    if (match) return match;
  }
  return active[0] ?? null;
}

export function isAiBrokenDown(goal: Pick<Goal, "pathStatus" | "subtasks">): boolean {
  return goal.pathStatus === "ready" && (goal.subtasks ?? []).some((action) => action.aiGenerated);
}

export function readComposerMode(state: unknown): { mode: ComposerMode; noteDraft: string; openGoalId: string | number | null } {
  if (!state || typeof state !== "object") return { mode: null, noteDraft: "", openGoalId: null };
  const value = state as {
    composer?: unknown;
    noteDraft?: unknown;
    openGoalId?: unknown;
    objectiveId?: unknown;
  };
  const mode = value.composer === "ai-goal" || value.composer === "note" || value.composer === "reschedule" || value.composer === "manual"
    ? value.composer
    : null;
  const openGoalId = typeof value.openGoalId === "string" || typeof value.openGoalId === "number"
    ? value.openGoalId
    : typeof value.objectiveId === "string" || typeof value.objectiveId === "number"
      ? value.objectiveId
      : null;
  return {
    mode,
    noteDraft: typeof value.noteDraft === "string" ? value.noteDraft : "",
    openGoalId,
  };
}

export function resolveNotes(goal: Goal): GoalNote[] {
  if (Array.isArray(goal.notes) && goal.notes.length > 0) return goal.notes;
  const text = (goal.description ?? "").trim();
  if (!text) return [];
  return [{ id: `desc-${goal.id}`, content: text, createdAt: new Date(0).toISOString(), source: "manual" }];
}

export function dayLoadConflicts(actions: SubGoal[]): Set<string> {
  const byDay = new Map<string, SubGoal[]>();
  for (const action of actions) {
    if (action.done || !action.scheduledFor) continue;
    const list = byDay.get(action.scheduledFor) ?? [];
    list.push(action);
    byDay.set(action.scheduledFor, list);
  }
  const flagged = new Set<string>();
  for (const list of byDay.values()) {
    const heavy = list.filter((action) => action.effortSize === "medium" || action.effortSize === "large");
    if (heavy.length >= 2) heavy.forEach((action) => flagged.add(String(action.id)));
  }
  return flagged;
}

export function buildTaskTree(goal: Goal): TreeNode[] {
  const actions = [...(goal.subtasks ?? [])].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const conflicts = dayLoadConflicts(actions);
  const milestones = [...(goal.milestones ?? [])].sort((left, right) => left.order - right.order);
  const byParent = new Map<string, SubGoal[]>();
  for (const action of actions) {
    if (!action.parentId) continue;
    const list = byParent.get(String(action.parentId)) ?? [];
    list.push(action);
    byParent.set(String(action.parentId), list);
  }

  const toActionNode = (action: SubGoal, level: 2 | 3): TreeNode => ({
    id: String(action.id),
    title: action.title,
    level,
    done: action.done,
    estimatedMinutes: effortToMinutes(action.effortSize),
    scheduledFor: action.scheduledFor,
    doneWhen: action.doneWhen,
    conflict: conflicts.has(String(action.id)),
    actionId: String(action.id),
    children: (byParent.get(String(action.id)) ?? []).map((child) => toActionNode(child, 3)),
  });

  if (milestones.length === 0) {
    return actions
      .filter((action) => !action.parentId)
      .map((action) => toActionNode(action, 2));
  }

  return milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    level: 1 as const,
    done: false,
    estimatedMinutes: 60,
    doneWhen: milestone.doneWhen,
    conflict: false,
    children: actions
      .filter((action) => action.milestoneId === milestone.id && !action.parentId)
      .map((action) => toActionNode(action, 2)),
  }));
}

export function previewToSubgoals(tasks: PreviewTask[]) {
  return tasks
    .filter((task) => task.level !== 1)
    .map((task, index) => ({
      id: task.id,
      title: task.title,
      done: false,
      milestoneId: task.milestoneId ?? null,
      parentId: task.level === 3 ? task.parentId ?? null : null,
      doneWhen: task.doneWhen,
      effortSize: task.effortSize,
      aiGenerated: true,
      basedOn: task.basedOn,
      order: index,
    }));
}

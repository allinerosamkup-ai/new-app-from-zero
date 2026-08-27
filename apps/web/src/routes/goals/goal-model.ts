import type { CSSProperties } from "react";

export type GoalLike = {
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

export type GoalTemplate = {
  direction: string;
  result: string;
  nextAction: string;
};

export type GoalPathProposal = {
  reason?: string;
  resultDefinition?: string;
  currentReality?: string;
  milestones?: Array<{ id?: string | number; title?: string }>;
};

export function normalizeGoalPathProposal(value: unknown): GoalPathProposal | null {
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

export const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,.86)",
  border: "1px solid rgba(99,152,169,.16)",
  borderRadius: 24,
  boxShadow: "0 12px 34px rgba(66,49,43,.06)",
};

export const quietButtonStyle: CSSProperties = {
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

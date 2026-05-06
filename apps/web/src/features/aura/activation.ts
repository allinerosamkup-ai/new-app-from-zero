import type { AuraState } from "./types";

export type ActivationLevel = "empty" | "started" | "calibrating" | "active";
export type ActivationActionId = "checkin" | "planner" | "journal" | "explore";

export type ActivationAction = {
  id: ActivationActionId;
  label: string;
  title: string;
  description: string;
  route: string;
};

export type ActivationState = {
  isNewUser: boolean;
  hasCheckin: boolean;
  hasPlannerItem: boolean;
  hasJournalEntry: boolean;
  activationLevel: ActivationLevel;
  checkinCount: number;
  plannerItemCount: number;
  journalEntryCount: number;
  completedSteps: number;
  nextAction: ActivationAction;
};

type ActivationOptions = {
  now?: Date;
  journalEntryCount?: number;
  hasLocalJournalEntry?: boolean;
};

const RECENT_ACCOUNT_DAYS = 7;

export const ACTIVATION_ACTIONS: Record<ActivationActionId, ActivationAction> = {
  checkin: {
    id: "checkin",
    label: "Fazer meu check-in",
    title: "Comece pelo check-in",
    description: "A Airia precisa saber como estao seu humor e energia hoje para orientar o resto.",
    route: "/checkin",
  },
  planner: {
    id: "planner",
    label: "Montar meu dia",
    title: "Ajuste seu dia",
    description: "Depois do check-in, transforme o estado de hoje em uma agenda possivel.",
    route: "/planner",
  },
  journal: {
    id: "journal",
    label: "Abrir meu diario",
    title: "Dê contexto para a Airia",
    description: "Use o diario para registrar o que pesou, o que ajudou ou o que precisa ser lembrado.",
    route: "/journal",
  },
  explore: {
    id: "explore",
    label: "Ver minha Home",
    title: "Airia calibrada",
    description: "Voce ja tem base suficiente para explorar padroes, metas e ajustes do dia.",
    route: "/home",
  },
};

function isRecentAccount(accountCreatedAt: string | null | undefined, now: Date) {
  if (!accountCreatedAt) return false;
  const createdAt = new Date(accountCreatedAt).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return now.getTime() - createdAt <= RECENT_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
}

export function getActivationState(state: AuraState, options: ActivationOptions = {}): ActivationState {
  const now = options.now ?? new Date();
  const checkinCount = state.checkinHistory?.length ?? 0;
  const plannerItemCount = (state.tasks?.length ?? 0) + (state.goals?.length ?? 0) + (state.habits?.length ?? 0);
  const journalEntryCount = Math.max(
    options.journalEntryCount ?? 0,
    options.hasLocalJournalEntry || state.journal?.trim() ? 1 : 0,
  );

  const hasCheckin = checkinCount > 0;
  const hasPlannerItem = plannerItemCount > 0;
  const hasJournalEntry = journalEntryCount > 0;
  const completedSteps = [hasCheckin, hasPlannerItem, hasJournalEntry].filter(Boolean).length;

  const activationLevel: ActivationLevel =
    completedSteps === 0 ? "empty" :
    completedSteps === 1 ? "started" :
    completedSteps === 2 ? "calibrating" :
    "active";

  const isNewUser =
    !state.onboardingDone ||
    isRecentAccount(state.accountCreatedAt, now) ||
    checkinCount < 3 ||
    completedSteps < 3;

  const nextAction = !hasCheckin
    ? ACTIVATION_ACTIONS.checkin
    : !hasPlannerItem
      ? ACTIVATION_ACTIONS.planner
      : !hasJournalEntry
        ? ACTIVATION_ACTIONS.journal
        : ACTIVATION_ACTIONS.explore;

  return {
    isNewUser,
    hasCheckin,
    hasPlannerItem,
    hasJournalEntry,
    activationLevel,
    checkinCount,
    plannerItemCount,
    journalEntryCount,
    completedSteps,
    nextAction,
  };
}

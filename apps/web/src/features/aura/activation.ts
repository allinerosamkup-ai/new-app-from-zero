import type { AuraState } from "./types";
import { getLocalDateKey } from "../../utils/day-context";

export type ActivationLevel = "empty" | "started" | "calibrating" | "active";
export type ActivationActionId = "checkin" | "goal" | "journal" | "explore";

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
  hasGoal: boolean;
  hasJournalEntry: boolean;
  activationLevel: ActivationLevel;
  checkinCount: number;
  goalCount: number;
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
  goal: {
    id: "goal",
    label: "Definir meu objetivo",
    title: "Escolha o que quer destravar",
    description: "Um objetivo aqui vira uma sequencia de passos, e o app mostra so o proximo.",
    route: "/goals",
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

/** A regra de ativação não depende de idioma; a apresentação, sim. */
export function getLocalizedActivationAction(
  id: ActivationActionId,
  l: (portuguese: string, english: string) => string,
): ActivationAction {
  const action = ACTIVATION_ACTIONS[id];
  const copy: Record<ActivationActionId, Pick<ActivationAction, "label" | "title" | "description">> = {
    checkin: {
      label: l("Fazer meu check-in", "Do my check-in"),
      title: l("Comece pelo check-in", "Start with a check-in"),
      description: l(
        "A Airia começa entendendo como estão seu humor e sua energia hoje.",
        "Airia starts by understanding your mood and energy today.",
      ),
    },
    goal: {
      label: l("Definir meu objetivo", "Set my goal"),
      title: l("Escolha o que quer destravar", "Choose what you want to move forward"),
      description: l(
        "Transforme uma intenção em próximos passos pequenos e possíveis.",
        "Turn an intention into small, doable next steps.",
      ),
    },
    journal: {
      label: l("Abrir meu diário", "Open my journal"),
      title: l("Dê contexto para a Airia", "Give Airia some context"),
      description: l(
        "Registre o que pesou, ajudou ou merece ser lembrado hoje.",
        "Write down what felt heavy, helped, or is worth remembering today.",
      ),
    },
    explore: {
      label: l("Ver minha Home", "Go to my Home"),
      title: l("Airia já tem um começo", "Airia has a starting point"),
      description: l(
        "Agora você pode explorar seus registros, objetivos e o ritmo do dia.",
        "You can now explore your records, goals, and today’s rhythm.",
      ),
    },
  };

  return { ...action, ...copy[id] };
}

function isRecentAccount(accountCreatedAt: string | null | undefined, now: Date) {
  if (!accountCreatedAt) return false;
  const createdAt = new Date(accountCreatedAt).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return now.getTime() - createdAt <= RECENT_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
}

export function getActivationState(state: AuraState, options: ActivationOptions = {}): ActivationState {
  const now = options.now ?? new Date();
  const todayKey = getLocalDateKey(now);
  const checkinCount = state.checkinHistory?.length ?? 0;
  const todayCheckinCount = (state.checkinHistory ?? []).filter((entry) => entry.date === todayKey).length;
  const goalCount = state.goals?.length ?? 0;
  const journalEntryCount = Math.max(
    options.journalEntryCount ?? 0,
    options.hasLocalJournalEntry || state.journal?.trim() ? 1 : 0,
  );

  const hasCheckin = todayCheckinCount > 0;
  const hasGoal = goalCount > 0;
  const hasJournalEntry = journalEntryCount > 0;
  const completedSteps = [hasCheckin, hasGoal, hasJournalEntry].filter(Boolean).length;

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
    : !hasGoal
      ? ACTIVATION_ACTIONS.goal
      : !hasJournalEntry
        ? ACTIVATION_ACTIONS.journal
        : ACTIVATION_ACTIONS.explore;

  return {
    isNewUser,
    hasCheckin,
    hasGoal,
    hasJournalEntry,
    activationLevel,
    checkinCount,
    goalCount,
    journalEntryCount,
    completedSteps,
    nextAction,
  };
}

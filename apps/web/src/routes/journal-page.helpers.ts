import { getLocalDateKey } from "../utils/day-context.ts";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeTime(value: string | undefined | null): string {
  return typeof value === "string" && TIME_PATTERN.test(value) ? value : "09:00";
}

function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = Math.max(0, Math.min(20 * 60, hours * 60 + mins + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function buildJournalPlannerSlot(input: {
  time?: string | null;
  dayOffset: number;
  referenceDate?: Date;
}): { date: string; startTime: string; endTime: string } {
  const referenceDate = input.referenceDate ? new Date(input.referenceDate) : new Date();
  referenceDate.setDate(referenceDate.getDate() + input.dayOffset);

  let startTime = normalizeTime(input.time);
  const hour = Number(startTime.split(":")[0]);

  if (hour < 8) {
    startTime = "08:00";
  } else if (hour >= 20) {
    startTime = input.dayOffset > 0 ? "09:00" : "19:00";
  }

  return {
    date: getLocalDateKey(referenceDate),
    startTime,
    endTime: addMinutes(startTime, 60),
  };
}

/**
 * Copy de fechamento da sessão de diário.
 *
 * O localizador chega por parâmetro de propósito: a função é pura e testada
 * fora do React, e importar a instância do i18n aqui traria o bootstrap inteiro
 * (detector, catálogos, `localStorage`) para dentro de um cálculo de texto.
 */
export function buildJournalClosePrompt(input: {
  hasSummary: boolean;
  suggestedTaskCount: number;
  commitmentCount: number;
  l: (portuguese: string, english: string) => string;
}): { label: string; description: string } {
  const { l } = input;
  const taskCount = Math.max(0, input.suggestedTaskCount);
  const commitmentCount = Math.max(0, input.commitmentCount);
  const hasAction = taskCount > 0 || commitmentCount > 0;

  if (!input.hasSummary && !hasAction) {
    return {
      label: l("Fechar", "Close"),
      description: l(
        "Sessão salva. Sem ação nova extraída deste diário.",
        "Session saved. No new action extracted from this journal entry.",
      ),
    };
  }

  if (!hasAction) {
    return {
      label: l("Revisar o dia", "Review the day"),
      description: l(
        "Use o resumo salvo para fechar o dia sem criar tarefa solta.",
        "Use the saved summary to close the day without creating a loose task.",
      ),
    };
  }

  const taskText = l(
    taskCount === 1 ? "1 tarefa" : `${taskCount} tarefas`,
    taskCount === 1 ? "1 task" : `${taskCount} tasks`,
  );
  const commitmentText = l(
    commitmentCount === 1 ? "1 compromisso" : `${commitmentCount} compromissos`,
    commitmentCount === 1 ? "1 commitment" : `${commitmentCount} commitments`,
  );

  return {
    label: l("Revisar o dia", "Review the day"),
    description: l(
      `Use o resumo, ${taskText} e ${commitmentText} para escolher a próxima ação.`,
      `Use the summary, ${taskText}, and ${commitmentText} to pick the next action.`,
    ),
  };
}

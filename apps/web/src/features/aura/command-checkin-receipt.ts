import type { AuraCommandExecution } from "./command-types";

export type AppliedCheckinReceipt = {
  checkinId: string;
  moodScore: number;
  energyScore: number;
  stateLabel: string | null;
  stateSummary: string | null;
};

export function shouldRenderCommandPlan(plan: { operations: unknown[] } | null | undefined): boolean {
  return Boolean(plan && plan.operations.length > 0);
}

export function checkinReceiptFromExecution(execution: AuraCommandExecution | null | undefined): AppliedCheckinReceipt | null {
  if (!execution) return null;
  const applied = execution.operations.find((operation) =>
    operation.type === "record_checkin" && operation.status === "applied" && operation.result);
  const result = applied?.result;
  if (!result || typeof result.checkinId !== "string") return null;
  if (typeof result.moodScore !== "number" || typeof result.energyScore !== "number") return null;
  return {
    checkinId: result.checkinId,
    moodScore: result.moodScore,
    energyScore: result.energyScore,
    stateLabel: typeof result.stateLabel === "string" ? result.stateLabel : null,
    stateSummary: typeof result.stateSummary === "string" ? result.stateSummary : null,
  };
}

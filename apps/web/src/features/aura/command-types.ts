export type AuraCommandOperation = {
  id: string;
  type:
    | "create_planner_task"
    | "create_calendar_event"
    | "create_goal"
    | "create_habit"
    | "create_capture"
    | "create_checkin"
    | "update_item"
    | "complete_item"
    | "delete_item"
    | "handoff_to_journal";
  status: "proposed" | "pending" | "applied" | "failed" | "undone";
  selected: boolean;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: { message?: string } | null;
};

export type AuraCommandPlan = {
  id: string;
  sessionId: string;
  sourceMessageId: string;
  status: "draft" | "proposed" | "applying" | "applied" | "partial" | "failed" | "cancelled";
  executionPolicy: "auto_apply" | "review_required" | "clarification";
  confidence: number;
  assistantMessage: string;
  missingFields: string[];
  operations: AuraCommandOperation[];
};

export type AuraCommandExecution = {
  planId: string;
  status: "applied" | "partial" | "failed";
  operations: Array<{
    id: string;
    type: string;
    status: "applied" | "failed";
    result?: Record<string, unknown>;
    error?: { message?: string };
  }>;
};

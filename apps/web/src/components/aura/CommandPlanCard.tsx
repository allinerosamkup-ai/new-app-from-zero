import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { TFunction } from "i18next";

import { AuraButtonV2 } from "../editorial/AuraButtonV2";
import type { AuraCommandOperation, AuraCommandPlan } from "../../features/aura/command-types";
import { FEATURES } from "../../config/features";

type Props = {
  plan: AuraCommandPlan;
  applying: boolean;
  onChange: (operationId: string, patch: { selected?: boolean; payload?: Record<string, unknown> }) => void;
  onApply: () => void;
};

const TYPE_DESTINATION: Partial<Record<AuraCommandOperation["type"], string>> = {
  create_planner_task: "/home",
  create_calendar_event: "/home",
  create_goal: "/goals",
  create_habit: "/habits",
  create_capture: "/captures",
  create_checkin: "/checkin",
  record_checkin: "/checkin",
  handoff_to_journal: "/journal",
};

function itemLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    const record = item as Record<string, unknown>;
    return typeof record.title === "string" ? record.title : typeof record.text === "string" ? record.text : "";
  }).filter(Boolean);
}

function operationTitle(operation: AuraCommandOperation, t: TFunction) {
  const titles: Record<AuraCommandOperation["type"], string> = {
    create_planner_task: t("aura.commandPlan.task", "Nova tarefa"),
    create_calendar_event: t("aura.commandPlan.appointment", "Compromisso no Google Agenda"),
    create_goal: t("aura.commandPlan.goal", "Meta e pequenas ações"),
    create_habit: t("aura.commandPlan.habit", "Hábito"),
    create_capture: t("aura.commandPlan.capture", "Nota ou checklist"),
    create_checkin: t("aura.commandPlan.checkin", "Check-in"),
    record_checkin: t("aura.commandPlan.checkin", "Check-in"),
    update_item: t("aura.commandPlan.update", "Alteração"),
    complete_item: t("aura.commandPlan.complete", "Conclusão"),
    delete_item: t("aura.commandPlan.delete", "Exclusão"),
    handoff_to_journal: t("aura.commandPlan.journal", "Registro no diário"),
  };
  return titles[operation.type];
}

export function CommandPlanCard({ plan, applying, onChange, onApply }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const visibleOperations = plan.operations.filter((operation) => (
    !(operation.type === "create_habit" && !FEATURES.habits)
    && !(operation.type === "create_planner_task" && !FEATURES.planner)
    && !(operation.type === "create_calendar_event" && !FEATURES.planner)
  ));
  const selected = visibleOperations.filter((operation) => operation.selected);
  const canApply = plan.executionPolicy !== "clarification"
    && selected.some((operation) => operation.status !== "applied")
    && !applying;

  const updatePayload = (operation: AuraCommandOperation, key: string, value: unknown) => {
    onChange(operation.id, { payload: { ...operation.payload, [key]: value } });
  };

  return (
    <section
      aria-label={t("aura.commandPlan.title", "Plano de ação da Airia")}
      style={{
        margin: "8px 0 12px 33px",
        borderRadius: 20,
        border: "1px solid rgba(155,191,168,.25)",
        background: "rgba(255,255,255,.78)",
        boxShadow: "0 16px 34px rgba(54,96,74,.08)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-peach-ink)", fontWeight: 800 }}>
            {plan.status === "applied"
              ? t("aura.commandPlan.done", "Executado")
              : t("aura.commandPlan.review", "Revise antes de aplicar")}
          </p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-1)" }}>
            {t("aura.commandPlan.title", "Plano de ação da Airia")}
          </p>
        </div>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {visibleOperations.length} {visibleOperations.length === 1 ? t("aura.commandPlan.action", "ação") : t("aura.commandPlan.actions", "ações")}
        </span>
      </div>

      {plan.missingFields.length > 0 && (
        <div role="alert" style={{ padding: "9px 10px", borderRadius: 12, background: "rgba(79,138,107,.09)", color: "var(--text-2)", fontSize: 12, marginBottom: 10 }}>
          {t("aura.commandPlan.missing", "Ainda preciso confirmar")}: {plan.missingFields.join(", ")}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {visibleOperations.map((operation) => {
          const payload = operation.payload;
          const title = typeof payload.title === "string" ? payload.title : "";
          const dateKey = typeof payload.date === "string" ? "date" : typeof payload.localDate === "string" ? "localDate" : null;
          const timeKey = typeof payload.startTime === "string" ? "startTime" : typeof payload.reminderTime === "string" ? "reminderTime" : null;
          const items = itemLabels(payload.subgoals ?? payload.items ?? payload.checklist);
          const destination = TYPE_DESTINATION[operation.type];
          return (
            <article key={operation.id} style={{ borderRadius: 14, border: "1px solid rgba(155,191,168,.18)", padding: 10, background: "rgba(255,250,247,.66)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  aria-label={t("aura.commandPlan.select", "Selecionar ação")}
                  type="checkbox"
                  checked={operation.selected}
                  disabled={operation.status === "applied" || applying}
                  onChange={(event) => onChange(operation.id, { selected: event.target.checked })}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>{operationTitle(operation, t)}</p>
                  {title ? (
                    <input
                      value={title}
                      disabled={operation.status === "applied" || applying}
                      onChange={(event) => updatePayload(operation, "title", event.target.value)}
                      style={{ width: "100%", border: 0, background: "transparent", color: "var(--text-1)", fontWeight: 700, fontSize: 13, padding: "3px 0", outline: "none" }}
                    />
                  ) : (
                    <p style={{ margin: "3px 0 0", color: "var(--text-1)", fontWeight: 700, fontSize: 13 }}>
                      {operation.type === "delete_item"
                        ? t("aura.commandPlan.deleteSelected", "Excluir o item selecionado")
                        : operation.type === "update_item"
                          ? t("aura.commandPlan.updateSelected", "Atualizar o item selecionado")
                          : operationTitle(operation, t)}
                    </p>
                  )}
                </div>
                {operation.status === "applied" && destination && (
                  <button type="button" onClick={() => navigate(destination)} style={{ border: 0, background: "transparent", color: "var(--accent-peach-ink)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                    {t("aura.commandPlan.open", "Abrir")}
                  </button>
                )}
              </div>

              {(dateKey || timeKey) && (
                <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                  {dateKey && (
                    <input
                      aria-label={t("aura.commandPlan.date", "Data")}
                      type="date"
                      value={String(payload[dateKey])}
                      disabled={operation.status === "applied" || applying}
                      onChange={(event) => updatePayload(operation, dateKey, event.target.value)}
                      style={{ flex: 1, minWidth: 0, border: "1px solid rgba(155,191,168,.22)", borderRadius: 9, background: "#fff", padding: "7px 8px", color: "var(--text-1)", fontSize: 12 }}
                    />
                  )}
                  {timeKey && (
                    <input
                      aria-label={t("aura.commandPlan.time", "Horário")}
                      type="time"
                      value={String(payload[timeKey])}
                      disabled={operation.status === "applied" || applying}
                      onChange={(event) => updatePayload(operation, timeKey, event.target.value)}
                      style={{ flex: 1, minWidth: 0, border: "1px solid rgba(155,191,168,.22)", borderRadius: 9, background: "#fff", padding: "7px 8px", color: "var(--text-1)", fontSize: 12 }}
                    />
                  )}
                </div>
              )}

              {(operation.type === "create_checkin" || operation.type === "record_checkin") && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 8 }}>
                  {(["moodScore", "energyScore", "clarityScore", "irritabilityScore"] as const).map((key) => (
                    <label key={key} style={{ fontSize: 10, color: "var(--text-3)" }}>
                      {t(`aura.commandPlan.${key}`, key)}
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={typeof payload[key] === "number" ? String(payload[key]) : ""}
                        disabled={operation.status === "applied" || applying}
                        onChange={(event) => updatePayload(operation, key, event.target.value ? Number(event.target.value) : null)}
                        style={{ display: "block", width: "100%", boxSizing: "border-box", border: "1px solid rgba(155,191,168,.22)", borderRadius: 9, background: "#fff", padding: "7px 8px", color: "var(--text-1)" }}
                      />
                    </label>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <ul style={{ margin: "7px 0 0 22px", padding: 0, color: "var(--text-2)", fontSize: 12 }}>
                  {items.slice(0, 6).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
              )}

              {operation.error?.message && (
                <p role="alert" style={{ margin: "7px 0 0", color: "#3F6E56", fontSize: 11 }}>{operation.error.message}</p>
              )}
            </article>
          );
        })}
      </div>

      {plan.operations.length > 0 && plan.status !== "applied" && (
        <AuraButtonV2
          onClick={onApply}
          disabled={!canApply}
          variant="primary"
          size="sm"
          style={{ width: "100%", marginTop: 10, justifyContent: "center", opacity: canApply ? 1 : 0.5 }}
        >
          {applying ? t("aura.commandPlan.applying", "Aplicando…") : t("aura.commandPlan.apply", "Aplicar ações selecionadas")}
        </AuraButtonV2>
      )}
    </section>
  );
}

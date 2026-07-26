import { CalendarClock, Check, Circle, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { groupPlannerTasksForList, type PlannerTaskLike } from "../../routes/planner-page.helpers";

type TaskListTab = "active" | "unscheduled" | "completed";

export function TaskListView<T extends PlannerTaskLike>({
  tasks,
  onOpen,
  onToggle,
  onCreate,
}: {
  tasks: T[];
  onOpen: (task: T) => void;
  onToggle: (task: T) => void;
  onCreate: () => void;
}) {
  const [tab, setTab] = useState<TaskListTab>("active");
  const groups = useMemo(() => groupPlannerTasksForList(tasks), [tasks]);
  const tabs: Array<{ id: TaskListTab; label: string; count: number }> = [
    { id: "active", label: "A fazer", count: groups.active.length },
    { id: "unscheduled", label: "Sem horário", count: groups.unscheduled.length },
    { id: "completed", label: "Concluídas", count: groups.completed.length },
  ];
  const visible = groups[tab];

  return (
    <section aria-label="Lista de tarefas do dia" style={{ display: "grid", gap: 14, paddingBottom: 110 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5,
        padding: 5, borderRadius: 17, background: "rgba(74,63,60,.055)",
      }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            style={{
              minHeight: 42, border: 0, borderRadius: 13, cursor: "pointer",
              background: tab === item.id ? "#fff" : "transparent",
              color: tab === item.id ? "var(--text-1)" : "var(--text-3)",
              boxShadow: tab === item.id ? "0 4px 14px rgba(74,63,60,.07)" : "none",
              fontSize: 11, fontWeight: 800,
            }}
          >
            {item.label} <span style={{ opacity: .7 }}>{item.count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={{
          padding: "28px 18px", textAlign: "center", borderRadius: 22,
          border: "1px dashed var(--warm-border-2)", background: "rgba(255,255,255,.5)",
        }}>
          <Circle size={25} color="var(--accent-sky)" style={{ margin: "0 auto 10px" }} />
          <strong style={{ display: "block", fontSize: 14, color: "var(--text-1)" }}>
            {tab === "completed" ? "Nenhuma tarefa concluída ainda" : "Nada esperando aqui"}
          </strong>
          <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-3)" }}>
            {tab === "active" ? "Crie uma tarefa ou use o montador para distribuir sua rotina." : "A lista se atualiza conforme você organiza o dia."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visible.map((task) => (
            <article
              key={task.id}
              style={{
                display: "flex", alignItems: "center", gap: 11, minHeight: 64,
                padding: "10px 12px", borderRadius: 18,
                border: "1px solid rgba(74,63,60,.095)", background: "rgba(255,255,255,.78)",
                opacity: task.done ? .65 : 1,
              }}
            >
              <button
                type="button"
                aria-label={task.done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
                onClick={() => onToggle(task)}
                style={{
                  width: 26, height: 26, flexShrink: 0, borderRadius: 9, cursor: "pointer",
                  display: "grid", placeItems: "center",
                  border: task.done ? 0 : "2px solid var(--accent-sage, #96C7B3)",
                  background: task.done ? "var(--accent-sage, #96C7B3)" : "transparent",
                }}
              >
                {task.done && <Check size={15} color="#fff" />}
              </button>
              <button
                type="button"
                onClick={() => onOpen(task)}
                style={{
                  flex: 1, minWidth: 0, border: 0, background: "transparent",
                  textAlign: "left", cursor: "pointer", padding: 0,
                }}
              >
                <strong style={{
                  display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontSize: 14, lineHeight: 1.35, color: "var(--text-1)",
                  textDecoration: task.done ? "line-through" : "none",
                }}>
                  {task.title}
                </strong>
                <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 10, color: "var(--text-3)" }}>
                  <CalendarClock size={11} />
                  {task.time === "00:00" && task.endTime === "23:59"
                    ? "Sem horário"
                    : `${task.time}${task.endTime ? `–${task.endTime}` : ""}`}
                  {task.source === "gcal" ? " · compromisso protegido" : ""}
                </span>
              </button>
            </article>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onCreate}
        style={{
          minHeight: 50, border: 0, borderRadius: 999, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: "var(--accent-peach, #D7897F)", color: "#fff",
          boxShadow: "0 10px 24px rgba(215,137,127,.2)", fontSize: 14, fontWeight: 800,
        }}
      >
        <Plus size={17} /> Nova tarefa
      </button>
    </section>
  );
}

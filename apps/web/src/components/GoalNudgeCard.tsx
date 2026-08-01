import { useState } from "react";
import { Target, Sparkles, ChevronRight, X } from "lucide-react";
import type { Goal, Task } from "../features/aura/types";
import { useLocalizedCopy } from "../i18n";

interface GoalNudgeCardProps {
  goals: Goal[];
  tasks: Task[];
  onAddTask?: (title: string, goalId: string | number) => void;
}

function pickMicroAction(goal: Goal): string {
  // Subtarefa pendente mais relevante
  const pending = goal.subtasks.filter((s) => !s.done);
  if (pending.length > 0) return pending[0].title;

  // Fallback: sugestão genérica baseada no título da meta
  const title = goal.title.toLowerCase();
  if (title.includes("exerc") || title.includes("movimento")) return "Mover o corpo por 10 minutos";
  if (title.includes("leitura") || title.includes("livro")) return "Ler uma página hoje";
  if (title.includes("estud")) return "Revisar anotações por 15 minutos";
  if (title.includes("escrev") || title.includes("texto")) return "Escrever um parágrafo";
  if (title.includes("descans") || title.includes("sono")) return "Planejar horário de dormir hoje";
  return `Dar um pequeno passo em "${goal.title}"`;
}

export function GoalNudgeCard({ goals, tasks, onAddTask }: GoalNudgeCardProps) {
  const l = useLocalizedCopy();
  const [dismissed, setDismissed] = useState(false);
  const [added, setAdded] = useState(false);

  if (dismissed) return null;

  const pendingTasks = tasks.filter((t) => !t.done);

  // Só mostra se agenda vazia e há meta ativa com progresso < 100%
  const activeGoals = goals.filter((g) => g.completedPct < 100);
  if (pendingTasks.length > 0 || activeGoals.length === 0) return null;

  const goal = activeGoals[0];
  const microAction = pickMicroAction(goal);

  function handleAdd() {
    onAddTask?.(microAction, goal.id);
    setAdded(true);
    setTimeout(() => setDismissed(true), 1500);
  }

  return (
    <div style={{
      padding: "14px 16px",
      borderRadius: 18,
      background: "rgba(150,199,179,0.06)",
      border: "1px solid rgba(150,199,179,0.22)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      position: "relative",
    }}>
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute", top: 10, right: 10,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-3)", padding: 2,
        }}
      >
        <X size={14} />
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingRight: 20 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(150,199,179,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginTop: 1,
        }}>
          <Target size={15} color="var(--accent-sage)" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-sage)" }}>
            {l("Sugestão para hoje", "Suggestion for today")}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 13.5, fontWeight: 700, color: "var(--text-1)", lineHeight: 1.35 }}>
            {microAction}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--text-3)" }}>
            {l("Meta", "Goal")}: {goal.title}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleAdd}
          disabled={added}
          style={{
            flex: 1, height: 36, borderRadius: 999, border: "none",
            background: added ? "rgba(150,199,179,0.2)" : "var(--accent-sage)",
            color: added ? "var(--accent-sage)" : "#fff",
            fontSize: 12, fontWeight: 800, cursor: added ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            transition: "all .2s",
          }}
        >
          {added ? (
            <>
              <Sparkles size={12} />
              {l("Adicionado!", "Added!")}
            </>
          ) : (
            <>
              <ChevronRight size={13} />
              {l("Adicionar ao dia", "Add to day")}
            </>
          )}
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{
            height: 36, padding: "0 14px", borderRadius: 999,
            border: "1px solid rgba(150,199,179,0.25)",
            background: "transparent", color: "var(--text-3)",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {l("Agora não", "Not now")}
        </button>
      </div>
    </div>
  );
}

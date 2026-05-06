import { CalendarCheck, CheckCircle2, Circle, MessageSquareText, SmilePlus } from "lucide-react";

import type { ActivationState } from "../../features/aura/activation";

const STEPS = [
  {
    id: "checkin",
    title: "Check-in",
    description: "Registre humor e energia.",
    icon: SmilePlus,
  },
  {
    id: "planner",
    title: "Planner",
    description: "Monte um dia possivel.",
    icon: CalendarCheck,
  },
  {
    id: "journal",
    title: "Diario",
    description: "Dê contexto para a Airia.",
    icon: MessageSquareText,
  },
] as const;

type Props = {
  activation: ActivationState;
};

export function ActivationChecklist({ activation }: Props) {
  const doneByStep = {
    checkin: activation.hasCheckin,
    planner: activation.hasPlannerItem,
    journal: activation.hasJournalEntry,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      {STEPS.map((step) => {
        const done = doneByStep[step.id];
        const current = activation.nextAction.id === step.id;
        const Icon = step.icon;
        return (
          <div
            key={step.id}
            style={{
              minHeight: 92,
              borderRadius: 16,
              border: `1.5px solid ${done ? "rgba(80,112,91,.26)" : current ? "rgba(244,190,168,.42)" : "var(--warm-border)"}`,
              background: done
                ? "rgba(191,220,203,.14)"
                : current
                  ? "rgba(244,190,168,.12)"
                  : "rgba(255,255,255,.72)",
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <Icon size={16} color={done ? "var(--accent-sage-ink)" : current ? "var(--accent-peach-ink)" : "var(--text-3)"} />
              {done ? (
                <CheckCircle2 size={15} color="var(--accent-sage-ink)" />
              ) : (
                <Circle size={14} color={current ? "var(--accent-peach-ink)" : "var(--text-3)"} />
              )}
            </div>
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 900, color: "var(--text-1)" }}>{step.title}</p>
              <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.35, color: "var(--text-2)" }}>{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

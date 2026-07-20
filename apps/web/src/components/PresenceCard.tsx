import type { CheckinEntry } from "../features/aura/types";
import { useLocalizedCopy } from "../i18n";

interface PresenceCardProps {
  checkinHistory: CheckinEntry[];
}

function getWeekDays(): string[] {
  const days: string[] = [];
  const today = new Date();
  // Monday of current week
  const monday = new Date(today);
  const dayOfWeek = today.getDay(); // 0=Sun
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(today.getDate() + diff);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

const DAY_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function PresenceCard({ checkinHistory }: PresenceCardProps) {
  const l = useLocalizedCopy();
  const checkedDays = new Set(checkinHistory.map((c) => c.date));
  const totalDays = checkedDays.size;

  const weekDays = getWeekDays();
  const weekPresent = weekDays.filter((d) => checkedDays.has(d)).length;
  const todayKey = new Date().toISOString().split("T")[0];

  // Label baseado em total de dias
  function presenceLabel(n: number): string {
    if (n === 0) return "Bem-vinda";
    if (n === 1) return "Primeira presença";
    if (n < 7) return `${n} dias de presença`;
    if (n < 30) return `${n} dias com você`;
    if (n < 90) return `${n} dias juntas`;
    return `${n} dias de história`;
  }

  return (
    <div style={{
      padding: "16px 18px",
      borderRadius: 20,
      background: "rgba(255,253,249,.95)",
      border: "1px solid var(--warm-border)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)" }}>
            {l("Sua presença", "Your presence")}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 900, color: "var(--text-1)" }}>
            {presenceLabel(totalDays)}
          </p>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "rgba(215,137,127,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>
          🌱
        </div>
      </div>

      {/* Dots da semana */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {weekDays.map((day, i) => {
          const present = checkedDays.has(day);
          const isToday = day === todayKey;
          const isPast = day < todayKey;
          return (
            <div key={day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: present
                  ? "var(--accent-peach)"
                  : isPast
                    ? "rgba(215,137,127,0.08)"
                    : "transparent",
                border: isToday && !present
                  ? "1.5px dashed var(--accent-peach)"
                  : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {present && (
                  <span style={{ fontSize: 13 }}>✓</span>
                )}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
                color: isToday ? "var(--accent-peach)" : "var(--text-3)",
              }}>
                {DAY_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>

      {weekPresent > 0 && (
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.4 }}>
          {weekPresent === 7
            ? l("Semana completa — que presença bonita.", "A full week — beautiful consistency.")
            : weekPresent >= 5
              ? l(`${weekPresent} de 7 dias essa semana. Consistência real.`, `${weekPresent} of 7 days this week. Real consistency.`)
              : weekPresent >= 3
                ? l(`${weekPresent} dias essa semana. Cada um conta.`, `${weekPresent} days this week. Each one counts.`)
                : l(`${weekPresent} ${weekPresent === 1 ? "dia" : "dias"} essa semana. Todo começo vale.`, `${weekPresent} ${weekPresent === 1 ? "day" : "days"} this week. Every start matters.`)}
        </p>
      )}
    </div>
  );
}

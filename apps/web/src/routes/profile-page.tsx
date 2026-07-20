// Profile Page v2 — Padrões / Ciclagem
import { useAuraStore } from "../features/aura/store";
import { useLocalizedCopy } from "../i18n";
import "../styles/aura.css";

const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const moodValues = [72, 65, 80, 55, 88, 78, 82];
const energyValues = [60, 70, 75, 50, 82, 70, 76];

const insights = [
  {
    emoji: "🌙",
    title: "Seu pico de energia é às manhãs",
    desc: "Entre 8h–11h você mostra desempenho 40% acima da média semanal.",
    color: "var(--accent-peach-a3)",
    border: "var(--accent-peach)",
  },
  {
    emoji: "📉",
    title: "Quarta-feiras tendem a ser mais pesadas",
    desc: "Humor médio de 55 nos últimos 4 ciclos. Considere tarefas leves.",
    color: "rgba(176,180,196,.1)",
    border: "var(--accent-sky)",
  },
  {
    emoji: "✨",
    title: "Fins de semana recarregam bem",
    desc: "Sábado e domingo consistentemente acima de 75 nos últimos 3 ciclos.",
    color: "rgba(180,185,169,.1)",
    border: "var(--accent-sage)",
  },
];

export function ProfilePage() {
  const l = useLocalizedCopy();
  const { state } = useAuraStore();

  const displayName = state.name
    ? state.name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : "você";

  const maxMood = Math.max(...moodValues);
  const maxEnergy = Math.max(...energyValues);

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
      <div className="screen-content">
        {/* Header */}
        <div style={{ marginBottom: "calc(var(--a) * 1.2)" }}>
          <h2
            style={{
              fontFamily: "'Poppins'",
              fontSize: "17px",
              fontWeight: 800,
              color: "var(--text-1)",
              margin: 0,
            }}
          >
          {l("Padrões", "Patterns")}
          </h2>
          <p style={{ fontSize: "11px", color: "var(--text-3)", margin: "2px 0 0" }}>
            Ciclagem de humor e energia · {displayName}
          </p>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "8px",
            marginBottom: "calc(var(--a) * 1.2)",
          }}
        >
          {[
            { label: l("Média de humor", "Average mood"), value: "74", unit: "/100", color: "var(--accent-sage)" },
            { label: l("Média de energia", "Average energy"), value: "69", unit: "/100", color: "var(--accent-sky)" },
            { label: "Check-ins", value: "12", unit: l(" dias", " days"), color: "var(--accent-peach)" },
          ].map((stat) => (
            <div key={stat.label} className="aura-card" style={{ padding: "12px 10px", textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "'Poppins'",
                  fontSize: "22px",
                  fontWeight: 800,
                  color: stat.color,
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                {stat.value}
                <span style={{ fontSize: "11px", fontWeight: 600 }}>{stat.unit}</span>
              </p>
              <p style={{ fontSize: "9.5px", color: "var(--text-3)", marginTop: "4px", fontWeight: 600 }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="aura-card" style={{ marginBottom: "calc(var(--a) * 1.2)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-1)" }}>Semana atual</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <span style={{ fontSize: "10px", color: "var(--accent-sage)", fontWeight: 700 }}>● Humor</span>
              <span style={{ fontSize: "10px", color: "var(--accent-sky)", fontWeight: 700 }}>● Energia</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "80px" }}>
            {weekDays.map((day, i) => (
              <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: "68px" }}>
                  <div
                    style={{
                      width: "10px",
                      height: `${(moodValues[i] / maxMood) * 60}px`,
                      background: "var(--accent-sage)",
                      borderRadius: "3px 3px 0 0",
                      opacity: i === 6 ? 1 : 0.7,
                    }}
                  />
                  <div
                    style={{
                      width: "10px",
                      height: `${(energyValues[i] / maxEnergy) * 60}px`,
                      background: "var(--accent-sky)",
                      borderRadius: "3px 3px 0 0",
                      opacity: i === 6 ? 1 : 0.7,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "9px",
                    color: i === 6 ? "var(--text-1)" : "var(--text-3)",
                    fontWeight: i === 6 ? 700 : 400,
                  }}
                >
                  {day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Insight cards */}
        <p className="section-title" style={{ marginBottom: "8px" }}>Insights da semana</p>
        {insights.map((ins) => (
          <div
            key={ins.title}
            className="aura-card"
            style={{
              marginBottom: "8px",
              borderLeft: `4px solid ${ins.border}`,
              background: ins.color,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span style={{ fontSize: "20px", lineHeight: 1.2 }}>{ins.emoji}</span>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{ins.title}</p>
                <p style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "4px", lineHeight: 1.5 }}>{ins.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


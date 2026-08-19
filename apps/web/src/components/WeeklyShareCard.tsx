import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useLocalizedCopy } from "../i18n";

interface WeeklyShareCardProps {
  phaseName: string;
  phaseColor: string;
  avgMood: number;
  avgEnergy: number;
  insight?: string;
  weekLabel?: string;
}

export function WeeklyShareCard({
  phaseName,
  phaseColor,
  avgMood,
  avgEnergy,
  insight,
  weekLabel,
}: WeeklyShareCardProps) {
  const l = useLocalizedCopy();
  const [shared, setShared] = useState(false);

  const moodBar = Math.round((avgMood / 5) * 100);
  const energyBar = Math.round((avgEnergy / 5) * 100);

  const shareText = [
    `📊 Minha semana com Airia`,
    weekLabel ? `🗓 ${weekLabel}` : "",
    `✨ Ritmo observado: ${phaseName}`,
    `💛 Humor médio: ${avgMood.toFixed(1)}/5`,
    `⚡ Energia média: ${avgEnergy.toFixed(1)}/5`,
    insight ? `\n"${insight}"` : "",
    `\n→ airia.pro`,
  ].filter(Boolean).join("\n");

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url: "https://airia.pro" });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {/* user cancelled */}
  }

  return (
    <div style={{
      borderRadius: 20,
      overflow: "hidden",
      border: "1px solid var(--warm-border)",
      background: "rgba(255,253,249,.97)",
    }}>
      {/* Card visual que aparece na tela */}
      <div style={{
        padding: "20px",
        background: `linear-gradient(135deg, ${phaseColor}18 0%, rgba(255,253,249,0) 60%)`,
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)" }}>
          {weekLabel ?? "Esta semana"}
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 900, color: "var(--text-1)" }}>
          {l(`Seu ritmo: ${phaseName}`, `Your rhythm: ${phaseName}`)}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {[
            { label: l("Humor", "Mood"), value: avgMood, bar: moodBar, color: "var(--accent-sage)" },
            { label: l("Energia", "Energy"), value: avgEnergy, bar: energyBar, color: "var(--accent-sky)" },
          ].map(({ label, value, bar, color }) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: "var(--text-1)" }}>{value.toFixed(1)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,0.06)" }}>
                <div style={{ height: "100%", width: `${bar}%`, borderRadius: 999, background: color, transition: "width .6s ease" }} />
              </div>
            </div>
          ))}
        </div>

        {insight && (
          <p style={{
            margin: 0, fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5,
            fontStyle: "italic",
            padding: "10px 12px",
            background: "rgba(255,255,255,.6)",
            borderRadius: 12,
            borderLeft: `3px solid ${phaseColor}`,
          }}>
            "{insight}"
          </p>
        )}
      </div>

      {/* Botão de share */}
      <div style={{ padding: "0 20px 16px" }}>
        <button
          onClick={handleShare}
          style={{
            width: "100%", height: 42, borderRadius: 999, border: "none",
            background: shared ? "rgba(150,199,179,0.15)" : "var(--accent-peach)",
            color: shared ? "var(--accent-sage)" : "#fff",
            fontSize: 13, fontWeight: 800, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            transition: "all .2s",
          }}
        >
          {shared ? <><Check size={14} /> {l("Compartilhado!", "Shared!")}</> : <><Share2 size={14} /> {l("Compartilhar semana", "Share week")}</>}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLocalizedCopy } from "../i18n";

/**
 * Faixa de progresso da Home.
 *
 * Mostra nível, XP e sequência — e nada mais. Não existe barra de meta diária,
 * não existe aviso de sequência em risco, não existe comparação com ontem.
 * O que aparece aqui é o que já aconteceu; o que não aconteceu fica em silêncio.
 */

type Progress = {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streak: { current: number; best: number; protectedDays: number; isProtectedToday: boolean };
  streakMessage: string | null;
};

export function ProgressStrip() {
  const l = useLocalizedCopy();
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    let active = true;
    api.get("/progress")
      .then((value) => { if (active) setProgress(value as Progress); })
      .catch(() => { /* progresso é enfeite: falhar aqui não pode atrapalhar a Home */ });
    return () => { active = false; };
  }, []);

  if (!progress) return null;

  const percent = Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForNextLevel) * 100));
  const { streak } = progress;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 18,
        background: "rgba(255,255,255,.66)",
        border: "1px solid rgba(255,255,255,.82)",
        boxShadow: "0 10px 22px rgba(243,176,140,.07)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-1)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {l(`Nível ${progress.level}`, `Level ${progress.level}`)}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {progress.xpIntoLevel}/{progress.xpForNextLevel}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={l("Progresso do nível", "Level progress")}
          style={{ height: 6, borderRadius: 999, background: "rgba(243,176,140,.18)", overflow: "hidden" }}
        >
          <div style={{ width: `${percent}%`, height: "100%", borderRadius: 999, background: "var(--accent-peach, #F3B08C)", transition: "width 420ms cubic-bezier(.16,1,.3,1)" }} />
        </div>
      </div>

      {(streak.current > 0 || streak.isProtectedToday) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span aria-hidden="true" style={{ fontSize: 18, opacity: streak.isProtectedToday ? 0.6 : 1 }}>
            {streak.isProtectedToday ? "🌙" : "🔥"}
          </span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <strong style={{ fontSize: 14, fontWeight: 800, color: "var(--text-1)" }}>{streak.current}</strong>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)" }}>
              {streak.isProtectedToday ? l("guardada", "held") : l("dias", "days")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

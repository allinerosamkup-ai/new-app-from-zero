import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLocalizedCopy } from "../i18n";
import { PROGRESS_UPDATED_EVENT } from "../features/aura/store";

/**
 * Faixa de progresso da Home.
 *
 * Mostra nível, XP e sequência — e nada mais. Não existe barra de meta diária,
 * não existe aviso de sequência em risco, não existe comparação com ontem.
 * O que aparece aqui é o que já aconteceu; o que não aconteceu fica em silêncio.
 */

type StreakShape = { current: number; best: number; protectedDays: number; isProtectedToday: boolean };

type Progress = {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streak: StreakShape;
  streakMessage: string | null;
  /** Opcional: resposta de servidor antigo não traz, e a faixa segue funcionando. */
  counters?: {
    actionsCompleted: number;
    goalsCompleted: number;
    actionStreak: StreakShape;
  };
};

export function ProgressStrip() {
  const l = useLocalizedCopy();
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      api.get("/progress")
        .then((value) => { if (active) setProgress(value as Progress); })
        .catch(() => { /* progresso é enfeite: falhar aqui não pode atrapalhar a Home */ });
    };
    load();
    // Concluir uma ação atualiza os números na hora, sem esperar recarregar a
    // tela — senão a recompensa aparece e o contador continua no valor velho.
    window.addEventListener(PROGRESS_UPDATED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(PROGRESS_UPDATED_EVENT, load);
    };
  }, []);

  if (!progress) return null;

  const percent = Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForNextLevel) * 100));
  const { streak, counters } = progress;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 18,
        background: "rgba(255,255,255,.66)",
        border: "1px solid rgba(255,255,255,.82)",
        boxShadow: "0 10px 22px rgba(169,210,187,.07)",
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
          style={{ height: 6, borderRadius: 999, background: "rgba(169,210,187,.18)", overflow: "hidden" }}
        >
          <div style={{ width: `${percent}%`, height: "100%", borderRadius: 999, background: "var(--accent-peach, #A9D2BB)", transition: "width 420ms cubic-bezier(.16,1,.3,1)" }} />
        </div>
      </div>

      {/* Contadores só aparecem depois de existirem: zero na tela no primeiro
          dia leria como cobrança, e a regra da casa é celebrar o que aconteceu
          e calar sobre o que não aconteceu. */}
      {counters && counters.actionsCompleted > 0 && (
        <Counter value={counters.actionsCompleted} label={l("ações", "actions")} />
      )}
      {counters && counters.goalsCompleted > 0 && (
        <Counter value={counters.goalsCompleted} label={l("objetivos", "goals")} />
      )}

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

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, flexShrink: 0, textAlign: "center" }}>
      <strong style={{ fontSize: 14, fontWeight: 800, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)" }}>
        {label}
      </span>
    </div>
  );
}

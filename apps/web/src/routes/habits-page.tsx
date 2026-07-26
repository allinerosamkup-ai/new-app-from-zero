import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { RewardBurst, type Reward } from "../components/RewardBurst";
import type { Habit } from "../features/aura/types";
import { HabitIdeasModal, type HabitModalPayload } from "../features/aura/HabitIdeasModal";
import { HABIT_SUGGESTIONS, type HabitSuggestion } from "../features/aura/habit-presets";
import {
  buildHabitDraftFromSuggestion,
  categorizeHabitsForDate,
  formatHabitFrequency,
  formatHabitTimeOfDay,
  getHabitCompletionCount,
  getHabitProgressLabel,
  getHabitTargetCount,
  isHabitCompleteForDate,
  isHabitDueOnDate,
  parseHabitDayDecisions,
  type HabitDayDecision,
  type HabitDayDecisions,
} from "../features/aura/habit-helpers";
import { SmartEmptyState } from "../components/activation/SmartEmptyState";
import { useToast } from "../components/Toast";
import { ChevronLeft, Plus, Flame, Check, ChevronDown, Pause, Pencil, RotateCcw, SkipForward, Sparkles, TimerReset } from "lucide-react";
import { api } from "../lib/api";
import { trackEvent } from "../lib/track";
import { getLocalDateKey } from "../utils/day-context";
import { useLocalizedCopy } from "../i18n";

// ─── Confetti burst (CSS-only, no dependency) ────────────────────────────────
const CONFETTI_COLORS = ["#D7897F","#96C7B3","#6398A9","#B5A4C8","#F9C784","#fff"];
const CONFETTI_COUNT = 42;

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-10px) rotate(0deg) scale(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scale(0.4); opacity: 0; }
        }
        @keyframes confetti-drift {
          0%   { margin-left: 0; }
          25%  { margin-left: 20px; }
          75%  { margin-left: -20px; }
          100% { margin-left: 0; }
        }
      `}</style>
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const left = `${Math.random() * 100}%`;
        const delay = `${Math.random() * 0.6}s`;
        const duration = `${1.2 + Math.random() * 1.4}s`;
        const size = 6 + Math.floor(Math.random() * 8);
        const shape = i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0%";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left,
              width: size,
              height: size * (i % 3 === 1 ? 2.5 : 1),
              borderRadius: shape,
              background: color,
              animation: `confetti-fall ${duration} ${delay} ease-in forwards, confetti-drift ${duration} ${delay} ease-in-out infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Achievements ────────────────────────────────────────────────────────────
type AchievementDef = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  color: string;
  check: (habits: any[], history: any[]) => boolean;
};

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_habit",
    icon: "🌱", title: "Primeiro passo", color: "var(--accent-sage)",
    desc: "Criou seu primeiro hábito",
    check: (h) => h.length >= 1,
  },
  {
    id: "habit_trio",
    icon: "🎯", title: "Trifeta", color: "var(--accent-sky)",
    desc: "Tem 3 ou mais hábitos ativos",
    check: (h) => h.length >= 3,
  },
  {
    id: "streak_7",
    icon: "🔥", title: "Semana de fogo", color: "var(--accent-peach)",
    desc: "7 dias seguidos em algum hábito",
    check: (h) => h.some((x: any) => x.bestStreak >= 7),
  },
  {
    id: "streak_14",
    icon: "🦁", title: "Maratona", color: "var(--accent-peach)",
    desc: "14 dias seguidos em algum hábito",
    check: (h) => h.some((x: any) => x.bestStreak >= 14),
  },
  {
    id: "streak_30",
    icon: "💎", title: "Compromisso real", color: "#B5A4C8",
    desc: "30 dias seguidos em algum hábito",
    check: (h) => h.some((x: any) => x.bestStreak >= 30),
  },
  {
    id: "completions_50",
    icon: "💪", title: "50 completudes", color: "var(--accent-sage)",
    desc: "50 conclusões acumuladas entre todos os hábitos",
    check: (h) => h.reduce((s: number, x: any) => s + x.totalCompletions, 0) >= 50,
  },
  {
    id: "completions_100",
    icon: "💯", title: "Centenário", color: "var(--accent-peach)",
    desc: "100 conclusões acumuladas",
    check: (h) => h.reduce((s: number, x: any) => s + x.totalCompletions, 0) >= 100,
  },
  {
    id: "checkin_7",
    icon: "📅", title: "Uma semana registrada", color: "var(--accent-sky)",
    desc: "7 check-ins registrados",
    check: (_h, history) => history.length >= 7,
  },
  {
    id: "checkin_30",
    icon: "🗓️", title: "Mês de registros", color: "var(--accent-sky)",
    desc: "30 check-ins registrados",
    check: (_h, history) => history.length >= 30,
  },
  {
    id: "good_mood_5",
    icon: "☀️", title: "Semana radiante", color: "#F9C784",
    desc: "5 ou mais dias com humor ≥ 4",
    check: (_h, history) => history.filter((x: any) => x.humor >= 4).length >= 5,
  },
];

// ─── Category config ─────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  health:       { label: "Saúde",         color: "var(--accent-sage)",    bg: "rgba(150,199,179,0.14)" },
  productivity: { label: "Produtividade", color: "var(--accent-sky)",    bg: "rgba(99,152,169,0.14)"  },
  mindfulness:  { label: "Mindfulness",   color: "var(--accent-peach)", bg: "rgba(215,137,127,0.14)" },
  social:       { label: "Social",        color: "#B5A4C8",          bg: "rgba(181,164,200,0.14)" },
  learning:     { label: "Aprendizado",   color: "var(--accent-sky)",    bg: "rgba(99,152,169,0.14)"  },
  leisure:      { label: "Lazer",         color: "var(--accent-peach)", bg: "rgba(215,137,127,0.14)" },
  geral:        { label: "Geral",         color: "var(--text-3)",    bg: "rgba(150,150,150,0.10)" },
};

const CATALOG_THEME_LABELS: Record<HabitSuggestion["theme"], { pt: string; en: string }> = {
  starter: { pt: "Rotina leve", en: "Light routine" },
  autocuidado: { pt: "Autocuidado", en: "Self-care" },
  casa: { pt: "Casa", en: "Home" },
  social: { pt: "Relações", en: "Relationships" },
  criativo: { pt: "Criatividade", en: "Creativity" },
  natureza: { pt: "Ao ar livre", en: "Outdoors" },
};

const HABIT_DAY_DECISIONS_PREFIX = "airia:habit-day:";

// ─── Streak dots visualization ─────────────────────────────────────────────
function StreakDots({ streakCount, completedToday }: { streakCount: number; completedToday: boolean }) {
  const totalDots = 7;
  const filledFromRight = completedToday ? Math.min(streakCount, totalDots) : Math.min(streakCount, totalDots - 1);

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {Array.from({ length: totalDots }, (_, i) => {
        const pos = totalDots - 1 - i; // 0 = today (rightmost)
        const isFilled = pos < filledFromRight;
        const isToday = pos === 0;
        return (
          <div
            key={i}
            style={{
              width: isToday ? 10 : 7,
              height: isToday ? 10 : 7,
              borderRadius: "50%",
              background: isFilled
                ? "var(--accent-peach)"
                : isToday
                  ? "rgba(215,137,127,0.25)"
                  : "var(--warm-border)",
              border: isToday ? "1.5px solid rgba(215,137,127,0.5)" : "none",
              transition: "all 0.2s ease",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Habit card (today view) ──────────────────────────────────────────────
function HabitCard({
  habit,
  dateKey,
  onToggle,
  onEdit,
  onPostpone,
  onSkip,
  onPause,
  onRestore,
  dayDecision,
  isToggling,
}: {
  habit: Habit;
  dateKey: string;
  onToggle: () => void;
  onEdit: () => void;
  onPostpone: () => void;
  onSkip: () => void;
  onPause: () => void;
  onRestore: () => void;
  dayDecision?: HabitDayDecision;
  isToggling: boolean;
}) {
  const { i18n } = useTranslation();
  const l = useLocalizedCopy();
  const language = i18n.resolvedLanguage?.startsWith("en") ? "en" : "pt";
  const completedToday = isHabitCompleteForDate(habit, dateKey);
  const progressLabel = getHabitProgressLabel(habit, dateKey);
  const targetCount = getHabitTargetCount(habit);
  const cat = CATEGORY_CONFIG[habit.category] ?? CATEGORY_CONFIG.geral;
  const [pausing, setPausing] = useState(false);

  return (
    <div
      style={{
        background: completedToday
          ? "rgba(150,199,179,0.06)"
          : "var(--card-bg, rgba(255,255,255,0.04))",
        border: `1.5px solid ${completedToday ? "rgba(150,199,179,0.22)" : "var(--warm-border)"}`,
        borderRadius: 18, // Ligeiramente maior para respiro
        padding: "12px 12px 12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition: "all 0.25s ease",
        opacity: completedToday ? 0.72 : 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Icon Area */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: cat.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.05)", // Polimento na borda do ícone
        }}
      >
        {habit.icon || "✨"}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            margin: 0,
            color: "var(--text-1)",
            textDecoration: completedToday ? "line-through" : "none",
            opacity: completedToday ? 0.6 : 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {habit.title}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.35 }}>
          {formatHabitFrequency(habit, language)} · {formatHabitTimeOfDay(habit.timeOfDay, language)}
          {habit.durationMinutes ? ` · ${habit.durationMinutes} min` : ""}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <StreakDots streakCount={habit.streakCount} completedToday={completedToday} />
          <span style={{ fontSize: 10, color: "var(--accent-peach)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
            <Flame size={10} /> {habit.streakCount}
          </span>
          {targetCount > 1 && (
            <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>
              {progressLabel}
            </span>
          )}
        </div>
        {!completedToday && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {dayDecision === "postponed" ? (
              <button
                type="button"
                onClick={onRestore}
                style={{
                  minHeight: 30,
                  borderRadius: 999,
                  border: "1px solid rgba(99,152,169,.28)",
                  background: "rgba(99,152,169,.09)",
                  color: "var(--accent-sky)",
                  padding: "5px 10px",
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <RotateCcw size={12} />
                {l("Retomar agora", "Resume now")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPostpone}
                  style={{
                    minHeight: 30,
                    borderRadius: 999,
                    border: "1px solid rgba(99,152,169,.24)",
                    background: "rgba(99,152,169,.07)",
                    color: "var(--accent-sky)",
                    padding: "5px 10px",
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <TimerReset size={12} />
                  {l("Adiar", "Postpone")}
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  style={{
                    minHeight: 30,
                    borderRadius: 999,
                    border: "1px solid var(--warm-border)",
                    background: "rgba(255,255,255,.72)",
                    color: "var(--text-2)",
                    padding: "5px 10px",
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <SkipForward size={12} />
                  {l("Pular hoje", "Skip today")}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={async () => {
                if (pausing) return;
                setPausing(true);
                await onPause();
                setPausing(false);
              }}
              disabled={pausing}
              style={{
                minHeight: 30,
                borderRadius: 999,
                border: "none",
                background: "transparent",
                color: "var(--text-3)",
                padding: "5px 8px",
                fontSize: 10.5,
                fontWeight: 800,
                cursor: pausing ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Pause size={12} />
              {pausing ? l("Pausando...", "Pausing...") : l("Pausar", "Pause")}
            </button>
          </div>
        )}
      </div>

      {/* Edição rápida sem tirar o foco da ação principal. */}
      {!completedToday && (
        <div style={{ display: "flex", gap: 4, marginRight: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1.5px solid rgba(99,152,169,0.2)",
              background: "rgba(99,152,169,0.06)",
              color: "var(--accent-sky)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={13} />
          </button>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        disabled={isToggling}
        aria-label={completedToday
          ? l(`Desmarcar ${habit.title}`, `Uncheck ${habit.title}`)
          : l(`Fazer ${habit.title}`, `Do ${habit.title}`)}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: `2px solid ${completedToday ? "var(--accent-sage)" : "var(--warm-border)"}`,
          background: completedToday ? "var(--accent-sage)" : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.2s ease",
          opacity: isToggling ? 0.5 : 1,
        }}
      >
        {completedToday ? <Check size={20} color="#fff" strokeWidth={3} /> : targetCount > 1 ? (
          <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 900 }}>
            {Math.min(getHabitCompletionCount(habit, dateKey), targetCount)}
          </span>
        ) : null}
      </button>
    </div>
  );
}

// ─── Habit completion calendar (4 weeks × 7 days) ────────────────────────
function HabitCalendar({ habitId, color }: { habitId: string; color: string }) {
  const { t } = useTranslation();
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get(`/habits/${habitId}/history?weeks=4`)
      .then((data: { dates: string[] }) => {
        setCompletedDates(new Set(data.dates));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [habitId]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (27 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
  // Align to calendar: figure out what weekday the first day falls on
  const firstDayOfWeek = new Date(days[0] + 'T12:00:00').getDay(); // 0=Sun
  const gridDays: (string | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...days,
  ];
  // Pad to complete last row
  while (gridDays.length % 7 !== 0) gridDays.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < gridDays.length; i += 7) weeks.push(gridDays.slice(i, i + 7));

  if (!loaded) {
    return (
      <div style={{ padding: "8px 0", display: "flex", justifyContent: "center" }}>
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>{t("habits.loading")}</span>
      </div>
    );
  }

  const filledCount = Array.from(completedDates).filter(d => days.includes(d)).length;

  return (
    <div style={{ marginTop: 12 }}>
      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
        {DAY_LABELS.map((l, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 8, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
            {l}
          </div>
        ))}
      </div>
      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
          {week.map((dateStr, di) => {
            if (!dateStr) return <div key={di} />;
            const isCompleted = completedDates.has(dateStr);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={di}
                title={dateStr}
                style={{
                  aspectRatio: "1",
                  borderRadius: 4,
                  background: isCompleted ? color : "var(--warm-border)",
                  border: isToday ? `1.5px solid ${color}` : "1.5px solid transparent",
                  opacity: isCompleted ? 0.9 : isToday ? 0.6 : 0.35,
                  transition: "all 0.15s",
                }}
              />
            );
          })}
        </div>
      ))}
      {/* Summary */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 600 }}>{t("habits.lastWeeks")}</span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{filledCount}/28 dias</span>
      </div>
    </div>
  );
}

// ─── All habits card (expandable with calendar) ───────────────────────────
function AllHabitCard({ habit, dateKey, onArchive, onEdit }: { habit: Habit; dateKey: string; onArchive: () => void; onEdit: () => void }) {
  const { t, i18n } = useTranslation();
  const l = useLocalizedCopy();
  const language = i18n.resolvedLanguage?.startsWith("en") ? "en" : "pt";
  const cat = CATEGORY_CONFIG[habit.category] ?? CATEGORY_CONFIG.geral;
  const completedToday = isHabitCompleteForDate(habit, dateKey);
  const [expanded, setExpanded] = useState(false);
  const [archiving, setArchiving] = useState(false);

  return (
    <div
      style={{
        background: "var(--card-bg, rgba(255,255,255,0.04))",
        border: "1.5px solid var(--warm-border)",
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        transition: "all 0.2s ease",
      }}
    >
      {/* Main row */}
      <div
        style={{
          width: "100%",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          textAlign: "left",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: 0,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: cat.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {habit.icon || "✨"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{habit.title}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 700 }}>
                {formatHabitFrequency(habit, language)}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>
                {formatHabitTimeOfDay(habit.timeOfDay, language)}
                {habit.durationMinutes ? ` · ${habit.durationMinutes} min` : ""}
              </span>
              <span
                style={{
                  fontSize: 10,
                  background: cat.bg,
                  color: cat.color,
                  borderRadius: 6,
                  padding: "2px 7px",
                  fontWeight: 700,
                }}
              >
                {cat.label}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                <Flame size={10} /> {habit.streakCount}d
              </span>
              <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>
                {habit.totalCompletions} total
              </span>
              {getHabitTargetCount(habit) > 1 && (
                <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>
                  {getHabitProgressLabel(habit, dateKey)}
                </span>
              )}
            </div>
          </div>
          {completedToday && (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--accent-sage)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Check size={12} color="#fff" strokeWidth={3} />
            </div>
          )}
          <ChevronDown
            size={16}
            color="var(--text-3)"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              flexShrink: 0,
            }}
          />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${habit.title}`}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1.5px solid rgba(99,152,169,0.25)",
              background: "rgba(99,152,169,0.08)",
              color: "var(--accent-sky)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (archiving) return;
              setArchiving(true);
              await onArchive();
            }}
            disabled={archiving}
            aria-label={l(`Pausar ${habit.title}`, `Pause ${habit.title}`)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1.5px solid rgba(215,137,127,0.25)",
              background: "rgba(215,137,127,0.06)",
              color: archiving ? "var(--text-3)" : "var(--accent-peach)",
              cursor: archiving ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pause size={13} />
          </button>
        </div>
      </div>

      {/* Calendar + archive expand */}
      {expanded && (
        <div
          style={{
            padding: "0 14px 14px",
            borderTop: "1px solid var(--warm-border)",
          }}
        >
          <HabitCalendar habitId={habit.id} color={cat.color} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "9px 0",
              borderRadius: 10,
              border: "1.5px solid rgba(99,152,169,0.25)",
              background: "rgba(99,152,169,0.08)",
              color: "var(--accent-sky)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.15s",
            }}
          >
            <Pencil size={13} />
            {t("habits.editTitle")}
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (archiving) return;
              setArchiving(true);
              await onArchive();
            }}
            disabled={archiving}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "9px 0",
              borderRadius: 10,
              border: "1.5px solid rgba(215,137,127,0.25)",
              background: "rgba(215,137,127,0.06)",
              color: archiving ? "var(--text-3)" : "var(--accent-peach)",
              fontSize: 12,
              fontWeight: 700,
              cursor: archiving ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.15s",
            }}
          >
            <Pause size={13} />
            {archiving ? l("Pausando...", "Pausing...") : l("Pausar hábito", "Pause habit")}
          </button>
        </div>
      )}
    </div>
  );
}

function HabitCatalog({
  onChoose,
  onCreateCustom,
}: {
  onChoose: (suggestion: HabitSuggestion) => void;
  onCreateCustom: () => void;
}) {
  const { i18n } = useTranslation();
  const l = useLocalizedCopy();
  const language = i18n.resolvedLanguage?.startsWith("en") ? "en" : "pt";
  const [theme, setTheme] = useState<HabitSuggestion["theme"]>("starter");
  const suggestions = HABIT_SUGGESTIONS.filter((suggestion) => suggestion.theme === theme).slice(0, 8);

  return (
    <section
      aria-labelledby="habit-catalog-title"
      style={{
        marginBottom: 22,
        padding: "18px 16px",
        borderRadius: 24,
        border: "1.5px solid rgba(215,137,127,.18)",
        background: "linear-gradient(145deg, rgba(255,255,255,.94), rgba(215,137,127,.07))",
        boxShadow: "0 12px 32px rgba(74,63,60,.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-peach)" }}>
            {l("Catálogo por toque", "Tap-first catalog")}
          </p>
          <h2 id="habit-catalog-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: "var(--text-1)" }}>
            {l("Comece com uma ideia pronta", "Start with a ready-made idea")}
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.45, color: "var(--text-2)" }}>
            {l(
              "Toque em uma opção e ajuste apenas os dias que combinam com sua semana.",
              "Tap an option and adjust only the days that fit your week.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateCustom}
          style={{
            minHeight: 38,
            borderRadius: 999,
            border: "1px solid rgba(215,137,127,.28)",
            background: "rgba(255,255,255,.9)",
            color: "var(--nectarine-11, #8B4A43)",
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {l("Criar do zero", "Create from scratch")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 8, marginBottom: 10 }}>
        {(Object.keys(CATALOG_THEME_LABELS) as HabitSuggestion["theme"][]).map((item) => {
          const active = item === theme;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setTheme(item)}
              aria-pressed={active}
              style={{
                minHeight: 34,
                borderRadius: 999,
                border: active ? "1px solid var(--accent-peach)" : "1px solid var(--warm-border)",
                background: active ? "rgba(215,137,127,.13)" : "rgba(255,255,255,.76)",
                color: active ? "var(--nectarine-11, #8B4A43)" : "var(--text-2)",
                padding: "7px 11px",
                fontSize: 10.5,
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {language === "en" ? CATALOG_THEME_LABELS[item].en : CATALOG_THEME_LABELS[item].pt}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 }}>
        {suggestions.map((suggestion) => (
          <button
            key={`${suggestion.theme}:${suggestion.title}`}
            type="button"
            onClick={() => onChoose(suggestion)}
            style={{
              minHeight: 116,
              borderRadius: 18,
              border: "1px solid rgba(74,63,60,.09)",
              background: "rgba(255,255,255,.86)",
              padding: 12,
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 9,
              boxShadow: "0 6px 16px rgba(74,63,60,.04)",
            }}
          >
            <span style={{ fontSize: 24 }}>{suggestion.icon}</span>
            <span>
              <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.28, fontWeight: 850, color: "var(--text-1)" }}>
                {suggestion.title}
              </span>
              <span style={{ display: "block", marginTop: 5, fontSize: 10, fontWeight: 750, color: "var(--text-3)" }}>
                {formatHabitTimeOfDay(suggestion.timeOfDay, language)}
                {suggestion.durationMinutes ? ` · ${suggestion.durationMinutes} min` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export function HabitsPage() {
  const { t } = useTranslation();
  const l = useLocalizedCopy();
  const { state, addHabit, updateHabit, toggleHabit, archiveHabit, unarchiveHabit } = useAuraStore();
  const [reward, setReward] = useState<Reward | null>(null);
  const navigate = useNavigate();
  const { showSuccess, showError, showUndo } = useToast();
  const todayKey = getLocalDateKey();

  async function handleArchiveHabit(habit: Habit) {
    try {
      await archiveHabit(habit.id);
      showUndo(`"${habit.title}" pausado`, () => {
        unarchiveHabit(habit.id).catch(() => showError(l("Não consegui retomar o hábito.", "I couldn't resume the habit.")));
      });
    } catch {
      showError(l("Não consegui pausar o hábito.", "I couldn't pause the habit."));
    }
  }
  const [tab, setTab] = useState<"today" | "all" | "badges">("today");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitDraft, setNewHabitDraft] = useState<ReturnType<typeof buildHabitDraftFromSuggestion> | undefined>();
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const habitsOpenedRef = useRef(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [dayDecisions, setDayDecisions] = useState<HabitDayDecisions>(() => {
    if (typeof window === "undefined") return {};
    return parseHabitDayDecisions(window.localStorage.getItem(`${HABIT_DAY_DECISIONS_PREFIX}${todayKey}`));
  });

  const habits = state.habits || [];
  const todayGroups = useMemo(
    () => categorizeHabitsForDate(habits, todayKey, dayDecisions),
    [dayDecisions, habits, todayKey],
  );
  const todayHabits = habits.filter((habit) => isHabitDueOnDate(habit, todayKey));
  const completedToday = todayGroups.done.length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streakCount), 0);
  const pendingToday = todayGroups.pending;
  const postponedToday = todayGroups.postponed;
  const skippedToday = todayGroups.skipped;
  const doneToday = todayGroups.done;
  const editingHabitDraft = useMemo(
    () => (editingHabit ? buildHabitEditDraft(editingHabit) : undefined),
    [editingHabit],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`${HABIT_DAY_DECISIONS_PREFIX}${todayKey}`, JSON.stringify(dayDecisions));
  }, [dayDecisions, todayKey]);

  useEffect(() => {
    if (habitsOpenedRef.current) return;
    habitsOpenedRef.current = true;
    trackEvent("habits_opened", {
      habits_count: habits.length,
      today_count: todayHabits.length,
    });
  }, [habits.length, todayHabits.length]);

  async function handleToggle(habitId: string) {
    if (togglingIds.has(habitId)) return;
    const habit = habits.find(h => h.id === habitId);
    const wasCompleted = habit ? isHabitCompleteForDate(habit, todayKey) : false;
    const willComplete = habit
      ? !wasCompleted && getHabitCompletionCount(habit, todayKey) + 1 >= getHabitTargetCount(habit)
      : false;
    setTogglingIds((prev) => new Set([...prev, habitId]));
    try {
      const reward = await toggleHabit(habitId);
      if (reward) setReward(reward);
      setDayDecisions((current) => {
        if (!current[habitId]) return current;
        const next = { ...current };
        delete next[habitId];
        return next;
      });
      // Disparar confetti se acabou de completar o último hábito pendente
      if (willComplete && pendingToday.length + postponedToday.length === 1 && todayHabits.length > 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } catch {
      showError(t("habits.updateError"));
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  }

  function setHabitDayDecision(habitId: string, decision?: HabitDayDecision) {
    setDayDecisions((current) => {
      if (!decision) {
        if (!current[habitId]) return current;
        const next = { ...current };
        delete next[habitId];
        return next;
      }
      return { ...current, [habitId]: decision };
    });
  }

  function openBlankHabit() {
    setNewHabitDraft(undefined);
    setShowAddModal(true);
  }

  function openHabitSuggestion(suggestion: HabitSuggestion) {
    setNewHabitDraft(buildHabitDraftFromSuggestion(suggestion));
    setShowAddModal(true);
  }

  async function handleAddHabit(data: HabitModalPayload) {
    try {
      await addHabit(data);
      setShowAddModal(false);
      setNewHabitDraft(undefined);
      showSuccess(t("habits.created"));
      return true;
    } catch {
      showError(t("habits.createError"));
      return false;
    }
  }

  async function handleEditHabit(data: HabitModalPayload) {
    if (!editingHabit) return false;
    try {
      await updateHabit(editingHabit.id, data);
      setEditingHabit(null);
      showSuccess(t("habits.saved"));
      return true;
    } catch {
      showError(t("habits.saveError"));
      return false;
    }
  }

  function buildHabitEditDraft(habit: Habit) {
    return {
      title: habit.title,
      category: habit.category,
      frequency: habit.frequency,
      targetDays: habit.targetDays ?? [],
      targetCount: habit.targetCount ?? 1,
      icon: habit.icon ?? "✨",
      timeOfDay: habit.timeOfDay ?? "anytime",
      description: habit.description ?? "",
      durationMinutes: habit.durationMinutes ?? undefined,
      reminderEnabled: habit.reminderEnabled,
      reminderTime: habit.reminderTime ?? "09:00",
      persistentReminderEnabled: habit.persistentReminderEnabled ?? false,
      persistentReminderIntervalMinutes: habit.persistentReminderIntervalMinutes ?? 60,
    };
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)", paddingBottom: 100 }}>
      <ConfettiBurst active={showConfetti} />
      <div className="screen-content">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, marginTop: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-1)", padding: 4 }}
          >
            <ChevronLeft size={24} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{t("habits.title")}</h1>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)", lineHeight: 1.35 }}>
              {t("habits.smallForPhase")}
            </p>
          </div>
          <button
            onClick={openBlankHabit}
            aria-label={l("Adicionar hábito", "Add habit")}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--accent-peach)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={18} color="#fff" />
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              border: "1.5px solid rgba(150,199,179,0.2)",
              background: "rgba(150,199,179,0.07)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 22 }}>✅</div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--accent-sage)" }}>
                {completedToday}/{todayHabits.length}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, fontWeight: 600, textTransform: "uppercase" }}>
                {t("common.today")}
              </p>
            </div>
          </div>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              border: "1.5px solid rgba(215,137,127,0.2)",
              background: "rgba(215,137,127,0.07)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Flame size={22} color="var(--accent-peach)" />
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--accent-peach)" }}>
                {bestStreak}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, fontWeight: 600, textTransform: "uppercase" }}>
                {l("Melhor sequência", "Best streak")}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 20,
            borderRadius: 12,
            border: "1.5px solid var(--warm-border)",
            overflow: "hidden",
          }}
        >
          {(["today", "all", "badges"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "10px 0",
                border: "none",
                background: tab === t ? "var(--accent-peach)" : "transparent",
                color: tab === t ? "#fff" : "var(--text-3)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.18s",
              }}
            >
              {t === "today" ? l("Hoje", "Today") : t === "all" ? l("Todos", "All") : l("Marcos", "Milestones")}
            </button>
          ))}
        </div>

        {/* ── TODAY TAB ────────────────────────────────────────── */}
        {tab === "today" && (
          <div>
            {todayHabits.length === 0 ? (
              <SmartEmptyState
                icon={Sparkles}
                title={habits.length > 0
                  ? l("Nenhum hábito para hoje", "No habits for today")
                  : l("Crie um hábito pequeno", "Create a small habit")}
                description={habits.length > 0
                  ? l(
                    "Os hábitos dos outros dias continuam guardados. Hoje só aparece o que realmente vence agora.",
                    "Habits for other days stay saved. Today only shows what is actually due now.",
                  )
                  : l(
                    "Escolha uma ideia pronta e ajuste os dias sem preencher um formulário longo.",
                    "Choose a ready-made idea and adjust the days without filling out a long form.",
                  )}
                ctaLabel={habits.length > 0
                  ? l("Ver todos os hábitos", "View all habits")
                  : l("Escolher uma ideia", "Choose an idea")}
                onAction={() => setTab("all")}
                examples={[
                  { title: l("Beber água ao acordar", "Drink water after waking up"), description: l("2 minutos · todos os dias", "2 minutes · every day") },
                  { title: l("Caminhada curta", "Short walk"), description: l("20 minutos · escolha os dias", "20 minutes · choose the days") },
                  { title: l("Preparar a bolsa de amanhã", "Prepare tomorrow's bag"), description: l("6 minutos · à noite", "6 minutes · in the evening") },
                ]}
              />
            ) : (
              <>
                {/* Pending */}
                {pendingToday.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", margin: "0 0 10px" }}>
                      {l(`Para fazer (${pendingToday.length})`, `To do (${pendingToday.length})`)}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {pendingToday.map((h) => (
                        <HabitCard
                          key={h.id}
                          habit={h}
                          dateKey={todayKey}
                          onToggle={() => handleToggle(h.id)}
                          onEdit={() => setEditingHabit(h)}
                          onPostpone={() => setHabitDayDecision(h.id, "postponed")}
                          onSkip={() => setHabitDayDecision(h.id, "skipped")}
                          onPause={() => handleArchiveHabit(h)}
                          onRestore={() => setHabitDayDecision(h.id)}
                          isToggling={togglingIds.has(h.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {postponedToday.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "var(--accent-sky)", textTransform: "uppercase", margin: "0 0 10px" }}>
                      {l(`Para mais tarde (${postponedToday.length})`, `For later (${postponedToday.length})`)}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {postponedToday.map((habit) => (
                        <HabitCard
                          key={habit.id}
                          habit={habit}
                          dateKey={todayKey}
                          dayDecision="postponed"
                          onToggle={() => handleToggle(habit.id)}
                          onEdit={() => setEditingHabit(habit)}
                          onPostpone={() => setHabitDayDecision(habit.id, "postponed")}
                          onSkip={() => setHabitDayDecision(habit.id, "skipped")}
                          onPause={() => handleArchiveHabit(habit)}
                          onRestore={() => setHabitDayDecision(habit.id)}
                          isToggling={togglingIds.has(habit.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {skippedToday.length > 0 && (
                  <div
                    style={{
                      marginBottom: 18,
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px dashed var(--warm-border)",
                      background: "rgba(255,255,255,.55)",
                    }}
                  >
                    <p style={{ margin: "0 0 9px", fontSize: 11, lineHeight: 1.4, color: "var(--text-2)", fontWeight: 750 }}>
                      {l(
                        `Pulados hoje (${skippedToday.length}). Sem cobrança — você pode trazer qualquer um de volta.`,
                        `Skipped today (${skippedToday.length}). No pressure — you can bring any of them back.`,
                      )}
                    </p>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {skippedToday.map((habit) => (
                        <button
                          key={habit.id}
                          type="button"
                          onClick={() => setHabitDayDecision(habit.id)}
                          style={{
                            minHeight: 32,
                            borderRadius: 999,
                            border: "1px solid var(--warm-border)",
                            background: "rgba(255,255,255,.85)",
                            color: "var(--text-2)",
                            padding: "6px 10px",
                            fontSize: 10.5,
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <RotateCcw size={12} />
                          {habit.icon || "✨"} {habit.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Done */}
                {doneToday.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-sage)", textTransform: "uppercase", margin: "0 0 10px" }}>
                      {t("habits.completedToday", { count: doneToday.length })}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {doneToday.map((h) => (
                        <HabitCard
                          key={h.id}
                          habit={h}
                          dateKey={todayKey}
                          onToggle={() => handleToggle(h.id)}
                          onEdit={() => setEditingHabit(h)}
                          onPostpone={() => setHabitDayDecision(h.id, "postponed")}
                          onSkip={() => setHabitDayDecision(h.id, "skipped")}
                          onPause={() => handleArchiveHabit(h)}
                          onRestore={() => setHabitDayDecision(h.id)}
                          isToggling={togglingIds.has(h.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Motivational if all done */}
                {pendingToday.length === 0 && postponedToday.length === 0 && doneToday.length > 0 && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: 20,
                      borderRadius: 16,
                      background: "rgba(150,199,179,0.10)",
                      border: "1.5px solid rgba(150,199,179,0.22)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                    <p style={{ fontWeight: 800, color: "var(--accent-sage)", margin: "0 0 4px", fontSize: 15 }}>
                      {t("habits.allDone")}
                    </p>
                    <p style={{ color: "var(--text-3)", fontSize: 12, margin: 0 }}>
                      {t("habits.consistencyPath")}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ALL TAB ──────────────────────────────────────────── */}
        {tab === "all" && (
          <div>
            <HabitCatalog onChoose={openHabitSuggestion} onCreateCustom={openBlankHabit} />
            {habits.length === 0 ? (
              <SmartEmptyState
                icon={Sparkles}
                title={l("Sua biblioteca ainda está vazia", "Your library is still empty")}
                description={l("Escolha uma ideia acima ou crie algo específico da sua rotina.", "Choose an idea above or create something specific to your routine.")}
                ctaLabel={l("Criar hábito do zero", "Create a habit from scratch")}
                onAction={openBlankHabit}
                examples={[
                  { title: l("Check-in da manhã", "Morning check-in"), description: l("Humor e energia antes da agenda.", "Mood and energy before planning.") },
                  { title: l("Fechamento do dia", "End-of-day review"), description: l("Olhar o que ficou pendente.", "Review what remains pending.") },
                  { title: l("Pausa curta", "Short break"), description: l("Proteger energia sem abandonar o dia.", "Protect energy without abandoning the day.") },
                ]}
              />
            ) : (
              (() => {
                const grouped = habits.reduce<Record<string, Habit[]>>((acc, h) => {
                  const cat = h.category || "geral";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(h);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([cat, catHabits]) => {
                  const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.geral;
                  return (
                    <div key={cat} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
                        <p style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: "uppercase", margin: 0 }}>
                          {cfg.label}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {catHabits.map((h) => (
                          <AllHabitCard
                            key={h.id}
                            habit={h}
                            dateKey={todayKey}
                            onArchive={() => handleArchiveHabit(h)}
                            onEdit={() => setEditingHabit(h)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}
        {/* ── BADGES TAB ───────────────────────────────────────── */}
        {tab === "badges" && (() => {
          const unlockedIds = new Set(
            ACHIEVEMENTS.filter(a => a.check(habits, state.checkinHistory || [])).map(a => a.id)
          );
          const unlockedCount = unlockedIds.size;

          return (
            <div>
              {/* Progress header */}
              <div style={{
                padding: "14px 16px",
                borderRadius: 16,
                background: "rgba(215,137,127,0.07)",
                border: "1.5px solid rgba(215,137,127,0.18)",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}>
                <div style={{ fontSize: 32 }}>🏆</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text-1)" }}>
                    {unlockedCount}/{ACHIEVEMENTS.length} conquistas
                  </p>
                  <div style={{ height: 5, borderRadius: 999, background: "rgba(0,0,0,.08)", overflow: "hidden", marginTop: 6 }}>
                    <div style={{
                      width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%`,
                      height: "100%", borderRadius: 999,
                      background: "linear-gradient(90deg, var(--accent-peach), var(--accent-sage))",
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              </div>

              {/* Achievement grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {ACHIEVEMENTS.map(achievement => {
                  const unlocked = unlockedIds.has(achievement.id);
                  return (
                    <div
                      key={achievement.id}
                      style={{
                        padding: "14px 12px",
                        borderRadius: 16,
                        border: unlocked
                          ? `1.5px solid ${achievement.color}44`
                          : "1.5px solid var(--warm-border)",
                        background: unlocked
                          ? `${achievement.color}10`
                          : "rgba(150,150,150,0.04)",
                        opacity: unlocked ? 1 : 0.5,
                        transition: "all 0.2s ease",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {unlocked && (
                        <div style={{
                          position: "absolute", top: 8, right: 8,
                          width: 18, height: 18, borderRadius: "50%",
                          background: achievement.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>
                        </div>
                      )}
                      <div style={{ fontSize: 28, marginBottom: 8, filter: unlocked ? "none" : "grayscale(100%)" }}>
                        {achievement.icon}
                      </div>
                      <p style={{
                        fontSize: 12, fontWeight: 800, margin: "0 0 3px",
                        color: unlocked ? "var(--text-1)" : "var(--text-3)",
                      }}>
                        {achievement.title}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0, lineHeight: 1.4 }}>
                        {achievement.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {unlockedCount === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-3)", fontSize: 13 }}>
                  Comece a usar o app para desbloquear conquistas!
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* FAB — quick add fixo no bottom */}
      <button
        onClick={openBlankHabit}
        aria-label={l("Adicionar hábito", "Add habit")}
        style={{
          position: "fixed",
          bottom: 88,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--accent-peach)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(215,137,127,0.45)",
          zIndex: 100,
          transition: "transform 0.15s ease",
        }}
        onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
        onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Plus size={22} color="#fff" strokeWidth={2.5} />
      </button>

      {/* Add modal */}
      {showAddModal && (
        <HabitIdeasModal
          onClose={() => {
            setShowAddModal(false);
            setNewHabitDraft(undefined);
          }}
          onSave={handleAddHabit}
          initialDraft={newHabitDraft}
          title={newHabitDraft
            ? l("Ajuste esta ideia à sua semana", "Fit this idea to your week")
            : l("Adicionar hábito", "Add habit")}
          subtitle={l("Escolha a frequência e os dias. Você pode mudar tudo depois.", "Choose the frequency and days. You can change everything later.")}
        />
      )}

      {editingHabit && (
        <HabitIdeasModal
          onClose={() => setEditingHabit(null)}
          onSave={handleEditHabit}
          initialDraft={editingHabitDraft}
          title={t("habits.editTitle")}
          subtitle={t("habits.editSubtitle")}
          saveLabel={t("habits.saveChanges")}
        />
      )}

      {/* Concluir sem nada acontecer não registra como conquista. */}
      <RewardBurst reward={reward} onDone={() => setReward(null)} />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import type { Habit } from "../features/aura/types";
import { HabitIdeasModal, type HabitModalPayload } from "../features/aura/HabitIdeasModal";
import { getHabitCompletionCount, getHabitProgressLabel, getHabitTargetCount, isHabitCompleteForDate, isHabitDueOnWeekday } from "../features/aura/habit-helpers";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useToast } from "../components/Toast";
import { ChevronLeft, Plus, Flame, Check, ChevronDown, Archive } from "lucide-react";
import { api } from "../lib/api";
import { getLocalDateKey } from "../utils/day-context";

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
  isToggling,
}: {
  habit: Habit;
  dateKey: string;
  onToggle: () => void;
  isToggling: boolean;
}) {
  const completedToday = isHabitCompleteForDate(habit, dateKey);
  const progressLabel = getHabitProgressLabel(habit, dateKey);
  const targetCount = getHabitTargetCount(habit);
  const cat = CATEGORY_CONFIG[habit.category] ?? CATEGORY_CONFIG.geral;

  return (
    <div
      style={{
        background: completedToday
          ? "rgba(150,199,179,0.06)"
          : "var(--card-bg, rgba(255,255,255,0.04))",
        border: `1.5px solid ${completedToday ? "rgba(150,199,179,0.22)" : "var(--warm-border)"}`,
        borderRadius: 16,
        padding: "14px 14px 14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        transition: "all 0.25s ease",
        opacity: completedToday ? 0.72 : 1,
        borderLeft: `4px solid ${cat.color}`,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: cat.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          flexShrink: 0,
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <StreakDots streakCount={habit.streakCount} completedToday={completedToday} />
          <span style={{ fontSize: 11, color: "var(--accent-peach)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
            <Flame size={11} /> {habit.streakCount}
          </span>
          {targetCount > 1 && (
            <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>
              {progressLabel}
            </span>
          )}
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        disabled={isToggling}
        style={{
          width: 42,
          height: 42,
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
        {completedToday ? <Check size={18} color="#fff" strokeWidth={3} /> : targetCount > 1 ? (
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 900 }}>
            {Math.min(getHabitCompletionCount(habit, dateKey), targetCount)}
          </span>
        ) : null}
      </button>
    </div>
  );
}

// ─── Habit completion calendar (4 weeks × 7 days) ────────────────────────
function HabitCalendar({ habitId, color }: { habitId: string; color: string }) {
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
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>carregando...</span>
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
        <span style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 600 }}>Últimas 4 semanas</span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{filledCount}/28 dias</span>
      </div>
    </div>
  );
}

// ─── All habits card (expandable with calendar) ───────────────────────────
function AllHabitCard({ habit, dateKey, onArchive }: { habit: Habit; dateKey: string; onArchive: () => void }) {
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
        borderLeft: `3px solid ${cat.color}`,
        transition: "all 0.2s ease",
      }}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
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
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>{habit.title}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
            }}
          />
        </div>
      </button>

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
            <Archive size={13} />
            {archiving ? "Arquivando..." : "Arquivar hábito"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export function HabitsPage() {
  const { state, addHabit, toggleHabit, archiveHabit } = useAuraStore();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<"today" | "all" | "badges">("today");
  const [showAddModal, setShowAddModal] = useState(false);

  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);

  const habits = state.habits || [];
  const todayKey = getLocalDateKey();
  const todayWeekday = new Date(`${todayKey}T12:00:00`).getDay();
  const todayHabits = habits.filter((h) => isHabitDueOnWeekday(h, todayWeekday));
  const completedToday = todayHabits.filter((h) => isHabitCompleteForDate(h, todayKey)).length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streakCount), 0);
  const pendingToday = todayHabits.filter((h) => !isHabitCompleteForDate(h, todayKey));
  const doneToday = todayHabits.filter((h) => isHabitCompleteForDate(h, todayKey));

  async function handleToggle(habitId: string) {
    if (togglingIds.has(habitId)) return;
    const habit = habits.find(h => h.id === habitId);
    const wasCompleted = habit ? isHabitCompleteForDate(habit, todayKey) : false;
    const willComplete = habit
      ? !wasCompleted && getHabitCompletionCount(habit, todayKey) + 1 >= getHabitTargetCount(habit)
      : false;
    setTogglingIds((prev) => new Set([...prev, habitId]));
    try {
      await toggleHabit(habitId);
      // Disparar confetti se acabou de completar o último hábito pendente
      if (willComplete && pendingToday.length === 1 && todayHabits.length > 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } catch {
      showError("Erro ao atualizar hábito.");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  }

  async function handleAddHabit(data: HabitModalPayload) {
    try {
      await addHabit(data);
      setShowAddModal(false);
      showSuccess("Hábito criado.");
      return true;
    } catch {
      showError("Erro ao criar hábito.");
      return false;
    }
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
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, flex: 1 }}>Meus Hábitos</h1>
          <button
            onClick={() => setShowAddModal(true)}
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
                Hoje
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
                Melhor streak
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
              {t === "today" ? "Hoje" : t === "all" ? "Todos" : "🏆"}
            </button>
          ))}
        </div>

        {/* ── TODAY TAB ────────────────────────────────────────── */}
        {tab === "today" && (
          <div>
            {todayHabits.length === 0 ? (
              <div className="empty-state" style={{ border: "2px dashed var(--warm-border)", borderRadius: 20 }}>
                <div className="empty-state-icon">🌱</div>
                <div className="empty-state-title">Nenhum hábito ainda</div>
                <div className="empty-state-sub">Pequenos hábitos diários constroem grandes mudanças. Crie o primeiro agora.</div>
                <AuraButtonV2 variant="primary" size="sm" onClick={() => setShowAddModal(true)} leftIcon={<Plus size={14} />} style={{ marginTop: 4 }}>
                  Criar hábito
                </AuraButtonV2>
              </div>
            ) : (
              <>
                {/* Pending */}
                {pendingToday.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", margin: "0 0 10px" }}>
                      Para fazer ({pendingToday.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {pendingToday.map((h) => (
                        <HabitCard
                          key={h.id}
                          habit={h}
                          dateKey={todayKey}
                          onToggle={() => handleToggle(h.id)}
                          isToggling={togglingIds.has(h.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Done */}
                {doneToday.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-sage)", textTransform: "uppercase", margin: "0 0 10px" }}>
                      Concluídos hoje ({doneToday.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {doneToday.map((h) => (
                        <HabitCard
                          key={h.id}
                          habit={h}
                          dateKey={todayKey}
                          onToggle={() => handleToggle(h.id)}
                          isToggling={togglingIds.has(h.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Motivational if all done */}
                {pendingToday.length === 0 && doneToday.length > 0 && (
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
                      Todos os hábitos do dia!
                    </p>
                    <p style={{ color: "var(--text-3)", fontSize: 12, margin: 0 }}>
                      Consistência é o caminho.
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
            {habits.length === 0 ? (
              <div className="empty-state" style={{ border: "2px dashed var(--warm-border)", borderRadius: 20 }}>
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">Sem hábitos cadastrados</div>
                <div className="empty-state-sub">Adicione hábitos e acompanhe seu progresso ao longo do tempo.</div>
                <AuraButtonV2 variant="primary" size="sm" onClick={() => setShowAddModal(true)} leftIcon={<Plus size={14} />} style={{ marginTop: 4 }}>
                  Criar hábito
                </AuraButtonV2>
              </div>
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
                          <AllHabitCard key={h.id} habit={h} dateKey={todayKey} onArchive={() => archiveHabit(h.id)} />
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

      {/* Add modal */}
      {showAddModal && (
        <HabitIdeasModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddHabit}
        />
      )}
    </div>
  );
}

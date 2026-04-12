import { useState } from "react";
import { Sparkles } from "lucide-react";

import { AuraButtonV2 } from "../../components/editorial/AuraButtonV2";
import { HABIT_SUGGESTIONS, type HabitSuggestion } from "./habit-presets";
import { buildHabitPayload, type HabitFormDraft, type HabitPayload, type HabitFrequency } from "./habit-helpers";

export type HabitModalPayload = HabitPayload;

const HABIT_THEME_META: Record<HabitSuggestion["theme"], { label: string; accent: string; bg: string }> = {
  starter: { label: "Cotidiano leve", accent: "var(--accent-peach)", bg: "rgba(244,190,168,.18)" },
  autocuidado: { label: "Autocuidado", accent: "var(--sweet-mint)", bg: "rgba(192,220,203,.22)" },
  casa: { label: "Casa em ordem", accent: "var(--horizon)", bg: "rgba(189,207,236,.22)" },
  social: { label: "Vínculos", accent: "var(--horizon)", bg: "rgba(218,206,235,.24)" },
  criativo: { label: "Criativo", accent: "var(--atomic-tangerine)", bg: "rgba(248,215,193,.24)" },
  natureza: { label: "Natureza", accent: "var(--accent-sage)", bg: "rgba(200,220,210,.24)" },
};

const CATEGORY_OPTIONS = [
  { value: "health", label: "Saúde" },
  { value: "productivity", label: "Produtividade" },
  { value: "mindfulness", label: "Mindfulness" },
  { value: "social", label: "Social" },
  { value: "learning", label: "Aprendizado" },
  { value: "leisure", label: "Lazer" },
  { value: "geral", label: "Geral" },
];

const TIME_OF_DAY_OPTIONS = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
  { value: "anytime", label: "Livre" },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: "D" },
  { value: 1, label: "S" },
  { value: 2, label: "T" },
  { value: 3, label: "Q" },
  { value: 4, label: "Q" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
];

const EMOJI_OPTIONS = ["✨", "🌿", "🧡", "💧", "🪴", "🧘", "🏃", "📚", "✍️", "💤", "🥗", "🎨", "🎵", "💪", "🧠", "🌙"];

function groupHabitSuggestions() {
  const groups = new Map<HabitSuggestion["theme"], HabitSuggestion[]>();

  HABIT_SUGGESTIONS.forEach((suggestion) => {
    const current = groups.get(suggestion.theme) ?? [];
    current.push(suggestion);
    groups.set(suggestion.theme, current);
  });

  return Array.from(groups.entries()).map(([theme, suggestions]) => ({
    theme,
    meta: HABIT_THEME_META[theme],
    suggestions,
  }));
}

function createInitialDraft(): HabitFormDraft {
  return {
    title: "",
    category: "geral",
    frequency: "daily",
    targetCount: 1,
    targetDays: [],
    icon: "✨",
    timeOfDay: "anytime",
    description: "",
    reminderEnabled: false,
    reminderTime: "09:00",
    persistentReminderEnabled: false,
    persistentReminderIntervalMinutes: 60,
  };
}

function toggleArrayValue(values: number[], value: number): number[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value].sort();
}

export function HabitIdeasModal({
  onClose,
  onSave,
  onViewAll,
}: {
  onClose: () => void;
  onSave: (payload: HabitModalPayload) => Promise<boolean>;
  onViewAll?: () => void;
}) {
  const groupedSuggestions = groupHabitSuggestions();
  const [draft, setDraft] = useState<HabitFormDraft>(() => createInitialDraft());
  const [saving, setSaving] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  function updateDraft(patch: Partial<HabitFormDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function setFrequency(frequency: HabitFrequency) {
    setDraft((current) => ({
      ...current,
      frequency,
      targetDays: frequency === "weekly" && current.targetDays.length === 0 ? [new Date().getDay()] : current.targetDays,
    }));
  }

  function applySuggestion(suggestion: HabitSuggestion) {
    setSelectedSuggestion(suggestion.title);
    setDraft((current) => ({
      ...current,
      title: suggestion.title,
      icon: suggestion.icon,
      category: suggestion.category,
      timeOfDay: suggestion.timeOfDay,
      durationMinutes: suggestion.durationMinutes,
    }));
  }

  async function handleSave() {
    const payload = buildHabitPayload(draft);
    if (!payload.title) return;
    setSaving(true);
    const ok = await onSave(payload);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(252,248,245,.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "16px 12px 0",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "rgba(255,255,255,.96)",
          border: "1px solid rgba(17,24,39,.06)",
          borderRadius: "30px 30px 0 0",
          boxShadow: "0 -8px 40px rgba(17,24,39,.10)",
          padding: "18px 18px 28px",
        }}
      >
        <div style={{ width: 46, height: 5, borderRadius: 999, background: "rgba(17,24,39,.10)", margin: "0 auto 18px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)" }}>
              Hábitos com mais charme
            </p>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Escolha um ritual para hoje</h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--text-2)" }}>
              Ajuste a frequência, os dias e os lembretes antes de salvar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid rgba(17,24,39,.08)",
              background: "rgba(255,255,255,.85)",
              color: "var(--text-2)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "56px 1fr",
            gap: 10,
            padding: 14,
            borderRadius: 22,
            background: "linear-gradient(135deg, rgba(244,190,168,.16), rgba(229,219,247,.18))",
            border: "1px solid rgba(17,24,39,.05)",
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => {
              const currentIndex = EMOJI_OPTIONS.indexOf(draft.icon);
              updateDraft({ icon: EMOJI_OPTIONS[(currentIndex + 1) % EMOJI_OPTIONS.length] });
            }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              border: "1px solid rgba(17,24,39,.06)",
              background: "rgba(255,255,255,.88)",
              fontSize: 28,
              cursor: "pointer",
            }}
          >
            {draft.icon}
          </button>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text-3)" }}>
              Entrada livre
            </p>
            <input
              type="text"
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              placeholder="Ex: beber água, regar as plantas, 5 min de silêncio"
              style={{
                width: "100%",
                height: 44,
                borderRadius: 14,
                border: "1px solid rgba(17,24,39,.08)",
                background: "rgba(255,255,255,.92)",
                padding: "0 14px",
                fontSize: 14,
                color: "var(--text-1)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)" }}>
              Frequência
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(["daily", "weekly"] as const).map((frequency) => (
                <button
                  key={frequency}
                  type="button"
                  onClick={() => setFrequency(frequency)}
                  style={{
                    height: 38,
                    borderRadius: 12,
                    border: `1px solid ${draft.frequency === frequency ? "var(--accent-peach)" : "rgba(17,24,39,.08)"}`,
                    background: draft.frequency === frequency ? "rgba(244,190,168,.18)" : "rgba(255,255,255,.8)",
                    color: draft.frequency === frequency ? "var(--accent-peach-ink)" : "var(--text-2)",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {frequency === "daily" ? "Por dia" : "Por semana"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)" }}>
              {draft.frequency === "daily" ? "Vezes por dia" : "Vezes por semana"}
            </p>
            <input
              type="number"
              min={1}
              max={24}
              value={draft.targetCount}
              onChange={(event) => updateDraft({ targetCount: Number(event.target.value) })}
              style={{
                width: "100%",
                height: 38,
                borderRadius: 12,
                border: "1px solid rgba(17,24,39,.08)",
                background: "rgba(255,255,255,.88)",
                padding: "0 12px",
                fontSize: 14,
                fontWeight: 800,
                color: "var(--text-1)",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {draft.frequency === "weekly" && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)" }}>
              Dias da semana
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {WEEKDAY_OPTIONS.map((day) => {
                const selected = draft.targetDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => updateDraft({ targetDays: toggleArrayValue(draft.targetDays, day.value) })}
                    style={{
                      height: 34,
                      borderRadius: 12,
                      border: `1px solid ${selected ? "var(--accent-sage)" : "rgba(17,24,39,.08)"}`,
                      background: selected ? "rgba(192,220,203,.28)" : "rgba(255,255,255,.82)",
                      color: selected ? "var(--accent-sage-ink)" : "var(--text-2)",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)" }}>
              Categoria
            </p>
            <select
              value={draft.category}
              onChange={(event) => updateDraft({ category: event.target.value })}
              style={{ width: "100%", height: 40, borderRadius: 12, border: "1px solid rgba(17,24,39,.08)", background: "rgba(255,255,255,.9)", padding: "0 10px", color: "var(--text-1)", fontWeight: 700 }}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)" }}>
              Período
            </p>
            <select
              value={draft.timeOfDay}
              onChange={(event) => updateDraft({ timeOfDay: event.target.value })}
              style={{ width: "100%", height: 40, borderRadius: 12, border: "1px solid rgba(17,24,39,.08)", background: "rgba(255,255,255,.9)", padding: "0 10px", color: "var(--text-1)", fontWeight: 700 }}
            >
              {TIME_OF_DAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(17,24,39,.06)", borderRadius: 18, padding: 12, background: "rgba(255,255,255,.66)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text-1)" }}>Lembrete</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)" }}>Avise no horário escolhido.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!draft.reminderEnabled) {
                  const { requestNotificationPermission } = await import("../../hooks/useHabitReminders");
                  await requestNotificationPermission();
                }
                updateDraft({
                  reminderEnabled: !draft.reminderEnabled,
                  persistentReminderEnabled: draft.reminderEnabled ? false : draft.persistentReminderEnabled,
                });
              }}
              style={{
                width: 48,
                height: 28,
                borderRadius: 999,
                border: "none",
                background: draft.reminderEnabled ? "var(--accent-sage)" : "rgba(17,24,39,.12)",
                cursor: "pointer",
                position: "relative",
              }}
              aria-label="Ativar lembrete"
            >
              <span style={{ position: "absolute", top: 4, left: draft.reminderEnabled ? 24 : 4, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.16)", transition: "left .2s" }} />
            </button>
          </div>

          {draft.reminderEnabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <input
                type="time"
                value={draft.reminderTime}
                onChange={(event) => updateDraft({ reminderTime: event.target.value })}
                style={{ height: 40, borderRadius: 12, border: "1px solid rgba(150,199,179,.45)", background: "rgba(150,199,179,.08)", padding: "0 10px", color: "var(--text-1)", fontWeight: 800 }}
              />
              <select
                value={draft.persistentReminderIntervalMinutes}
                disabled={!draft.persistentReminderEnabled}
                onChange={(event) => updateDraft({ persistentReminderIntervalMinutes: Number(event.target.value) })}
                style={{ height: 40, borderRadius: 12, border: "1px solid rgba(17,24,39,.08)", background: draft.persistentReminderEnabled ? "rgba(255,255,255,.9)" : "rgba(17,24,39,.04)", padding: "0 10px", color: "var(--text-1)", fontWeight: 700 }}
              >
                <option value={30}>A cada 30 min</option>
                <option value={60}>A cada 1 hora</option>
                <option value={120}>A cada 2 horas</option>
                <option value={180}>A cada 3 horas</option>
              </select>
              <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)", fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={draft.persistentReminderEnabled}
                  onChange={(event) => updateDraft({ persistentReminderEnabled: event.target.checked })}
                  style={{ width: 16, height: 16, accentColor: "var(--accent-peach)" }}
                />
                Notificação insistente até marcar como feito
              </label>
            </div>
          )}
        </div>

        <textarea
          value={draft.description}
          onChange={(event) => updateDraft({ description: event.target.value })}
          placeholder="Por que isso importa? Opcional."
          rows={2}
          style={{
            width: "100%",
            borderRadius: 14,
            border: "1px solid rgba(17,24,39,.08)",
            background: "rgba(255,255,255,.86)",
            padding: "10px 12px",
            fontSize: 13,
            color: "var(--text-1)",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 14,
          }}
        />

        <AuraButtonV2 variant="primary" onClick={handleSave} disabled={saving || !draft.title.trim()} style={{ width: "100%", height: 48, marginBottom: 18 }}>
          {saving ? "Salvando..." : "Salvar hábito"}
        </AuraButtonV2>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groupedSuggestions.map(({ theme, meta, suggestions }) => (
            <div key={theme}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: meta.bg,
                    color: meta.accent,
                  }}
                >
                  <Sparkles size={14} />
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text-1)" }}>{meta.label}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--text-3)" }}>{suggestions.length} ideias para puxar a rotina</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                {suggestions.map((suggestion) => {
                  const selected = selectedSuggestion === suggestion.title;
                  return (
                    <button
                      key={suggestion.title}
                      type="button"
                      onClick={() => applySuggestion(suggestion)}
                      style={{
                        minWidth: 180,
                        maxWidth: 180,
                        padding: 14,
                        borderRadius: 22,
                        border: `1px solid ${selected ? `${meta.accent}55` : "rgba(17,24,39,.06)"}`,
                        background: selected ? "rgba(255,255,255,.98)" : meta.bg,
                        boxShadow: "0 10px 22px rgba(17,24,39,.06)",
                        cursor: "pointer",
                        textAlign: "left",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: 24 }}>{suggestion.icon}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: meta.accent }}>
                          {suggestion.durationMinutes > 0 ? `${suggestion.durationMinutes} min` : "flex"}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.3 }}>
                        {suggestion.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "var(--text-2)" }}>
                        {selected ? "Ajuste os detalhes acima e salve." : "Toque para preencher o formulário."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            style={{
              width: "100%",
              marginTop: 18,
              height: 46,
              borderRadius: 16,
              border: "1px solid rgba(17,24,39,.08)",
              background: "rgba(255,255,255,.9)",
              color: "var(--text-1)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Ver página completa de hábitos
          </button>
        )}
      </div>
    </div>
  );
}

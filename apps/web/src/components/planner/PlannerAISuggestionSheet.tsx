import { useMemo, useState } from "react";
import { Sparkles, Check, X as XIcon, Clock, AlertTriangle, Info } from "lucide-react";

import { AiriaBottomSheet } from "../airia";
import { useTranslation } from "react-i18next";

export type PlannerAIScheduleItem = {
  startTime: string;
  endTime: string;
  title: string;
  category: string;
  intensity: "L" | "M" | "P";
  isRoutine: boolean;
  reasoning: string;
  confidence: number;
};

export type PlannerAIAdjustItem = {
  id: string;
  action: "MOVE_TOMORROW" | "DOWNGRADE_INTENSITY" | "CANCEL" | "KEEP";
  reason: string;
  confidence: number;
  /** Título do bloco original (preenchido pelo caller). */
  blockTitle?: string;
  /** Horário do bloco original. */
  blockTime?: string;
};

export type PlannerAISuggestionResult = {
  schedule: PlannerAIScheduleItem[];
  adjustedExisting: PlannerAIAdjustItem[];
  adjustments: string[];
  warnings: string[];
};

type Props = {
  open: boolean;
  loading: boolean;
  result: PlannerAISuggestionResult | null;
  errorMessage?: string | null;
  onClose: () => void;
  onAcceptSchedule: (item: PlannerAIScheduleItem, index: number) => Promise<void> | void;
  onRejectSchedule: (item: PlannerAIScheduleItem, index: number) => Promise<void> | void;
  onAcceptAdjust: (item: PlannerAIAdjustItem, index: number) => Promise<void> | void;
  onRejectAdjust: (item: PlannerAIAdjustItem, index: number) => Promise<void> | void;
};

const ACTION_ICON_COLOR: Record<PlannerAIAdjustItem["action"], string> = {
  MOVE_TOMORROW: "var(--accent-sky, #6398A9)",
  DOWNGRADE_INTENSITY: "var(--accent-sage-ink, #50705B)",
  CANCEL: "var(--accent-peach, #86B79A)",
  KEEP: "var(--text-3)",
};

function confidenceLabel(value: number): { key: "high" | "medium" | "low"; color: string } {
  if (value >= 0.8) return { key: "high", color: "var(--accent-sage-ink, #50705B)" };
  if (value >= 0.6) return { key: "medium", color: "#7C641A" };
  return { key: "low", color: "var(--text-3)" };
}

export function PlannerAISuggestionSheet(props: Props) {
  const { t } = useTranslation();
  const { open, loading, result, errorMessage, onClose } = props;

  // Estado local: quais itens já foram resolvidos (aceitos OU rejeitados)
  const [resolvedSchedule, setResolvedSchedule] = useState<Set<number>>(new Set());
  const [resolvedAdjust, setResolvedAdjust] = useState<Set<number>>(new Set());
  const [busyIndexes, setBusyIndexes] = useState<Set<string>>(new Set());

  // Reseta ao abrir nova rodada
  useMemo(() => {
    if (open && result) {
      setResolvedSchedule(new Set());
      setResolvedAdjust(new Set());
      setBusyIndexes(new Set());
    }
  }, [open, result]);

  const totalPending = (result?.schedule.length ?? 0) - resolvedSchedule.size
    + (result?.adjustedExisting.filter((a) => a.action !== "KEEP").length ?? 0) - resolvedAdjust.size;

  async function handleScheduleAccept(item: PlannerAIScheduleItem, index: number) {
    const key = `s-${index}`;
    if (busyIndexes.has(key)) return;
    setBusyIndexes((prev) => new Set(prev).add(key));
    try {
      await props.onAcceptSchedule(item, index);
      setResolvedSchedule((prev) => new Set(prev).add(index));
    } finally {
      setBusyIndexes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleScheduleReject(item: PlannerAIScheduleItem, index: number) {
    const key = `s-${index}`;
    if (busyIndexes.has(key)) return;
    setBusyIndexes((prev) => new Set(prev).add(key));
    try {
      await props.onRejectSchedule(item, index);
      setResolvedSchedule((prev) => new Set(prev).add(index));
    } finally {
      setBusyIndexes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleAdjustAccept(item: PlannerAIAdjustItem, index: number) {
    const key = `a-${index}`;
    if (busyIndexes.has(key)) return;
    setBusyIndexes((prev) => new Set(prev).add(key));
    try {
      await props.onAcceptAdjust(item, index);
      setResolvedAdjust((prev) => new Set(prev).add(index));
    } finally {
      setBusyIndexes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleAdjustReject(item: PlannerAIAdjustItem, index: number) {
    const key = `a-${index}`;
    if (busyIndexes.has(key)) return;
    setBusyIndexes((prev) => new Set(prev).add(key));
    try {
      await props.onRejectAdjust(item, index);
      setResolvedAdjust((prev) => new Set(prev).add(index));
    } finally {
      setBusyIndexes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <AiriaBottomSheet
      open={open}
      onClose={onClose}
      title={t("plannerAi.title")}
      description={
        loading
          ? t("plannerAi.thinking")
          : totalPending > 0
            ? t("plannerAi.pending", { count: totalPending })
            : t("plannerAi.confirm")
      }
      icon={<Sparkles size={18} color="var(--accent-peach, #86B79A)" />}
    >
      {loading && (
        <p style={{ textAlign: "center", padding: 24, color: "var(--text-3)", fontSize: 13 }}>
          {t("plannerAi.crossing")}
        </p>
      )}

      {errorMessage && (
        <div
          style={{
            display: "flex",
            gap: 8,
            background: "rgba(134,183,154,.08)",
            border: "1.5px solid rgba(134,183,154,.45)",
            color: "var(--accent-peach-ink, #42775C)",
            borderRadius: 12,
            padding: 12,
            margin: "8px 0 16px",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {!loading && !errorMessage && result && (
        <>
          {/* WARNINGS gerais */}
          {result.warnings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    background: "rgba(247,231,166,.32)",
                    border: "1.5px solid rgba(247,231,166,.7)",
                    color: "#7C641A",
                    borderRadius: 12,
                    padding: "10px 12px",
                    marginBottom: 8,
                    fontSize: 12.5,
                    lineHeight: 1.45,
                  }}
                >
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* AJUSTES gerais (texto livre) */}
          {result.adjustments.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {result.adjustments.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    background: "rgba(99,152,169,.08)",
                    border: "1px solid rgba(99,152,169,.25)",
                    color: "var(--text-2)",
                    borderRadius: 10,
                    padding: "8px 12px",
                    marginBottom: 6,
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  <Info size={13} style={{ flexShrink: 0, marginTop: 2, color: "var(--accent-sky, #6398A9)" }} />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}

          {/* SCHEDULE — novos blocos sugeridos */}
          {result.schedule.length > 0 && (
            <section style={{ marginBottom: 18 }}>
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--text-2)",
                  margin: "0 0 8px 4px",
                }}
              >
                {t("plannerAi.newBlocks")}
              </h3>
              {result.schedule.map((item, idx) => {
                const isResolved = resolvedSchedule.has(idx);
                const conf = confidenceLabel(item.confidence);
                const busy = busyIndexes.has(`s-${idx}`);
                return (
                  <div
                    key={`schedule-${idx}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: 12,
                      borderRadius: 12,
                      border: "1.5px solid var(--accent-peach-a3, rgba(134,183,154,.25))",
                      borderLeft: "4px solid var(--accent-peach, #86B79A)",
                      background: isResolved ? "rgba(134,183,154,.04)" : "rgba(255,253,249,.97)",
                      opacity: isResolved ? 0.55 : 1,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-3)" }}>
                      <Clock size={11} />
                      <span>{item.startTime}–{item.endTime}</span>
                      <span>·</span>
                      <span>{item.category}</span>
                      <span>·</span>
                      <span>{t("plannerAi.intensity", { value: t(`plannerAi.intensityLabels.${item.intensity}`) })}</span>
                      <span style={{ marginLeft: "auto", color: conf.color, fontWeight: 700 }}>
                        {t("plannerAi.confidence", { value: t(`plannerAi.confidenceLabels.${conf.key}`) })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
                      {item.title}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
                      {item.reasoning}
                    </p>
                    {!isResolved && (
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => void handleScheduleAccept(item, idx)}
                          disabled={busy}
                          style={{
                            flex: 1,
                            border: "1.5px solid var(--accent-sage, #96C7B3)",
                            background: busy ? "rgba(150,199,179,.18)" : "rgba(150,199,179,.08)",
                            color: "var(--accent-sage-ink, #50705B)",
                            borderRadius: 999,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: busy ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <Check size={14} />
                          {t("plannerAi.accept")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleScheduleReject(item, idx)}
                          disabled={busy}
                          style={{
                            flex: 1,
                            border: "1.5px solid var(--warm-border-2, rgba(0,0,0,.12))",
                            background: "transparent",
                            color: "var(--text-3)",
                            borderRadius: 999,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: busy ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <XIcon size={14} />
                          {t("plannerAi.decline")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* ADJUSTED EXISTING — mudanças propostas em blocos atuais */}
          {result.adjustedExisting.filter((a) => a.action !== "KEEP").length > 0 && (
            <section style={{ marginBottom: 18 }}>
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--text-2)",
                  margin: "0 0 8px 4px",
                }}
              >
                {t("plannerAi.changes")}
              </h3>
              {result.adjustedExisting.map((item, idx) => {
                if (item.action === "KEEP") return null;
                const isResolved = resolvedAdjust.has(idx);
                const conf = confidenceLabel(item.confidence);
                const busy = busyIndexes.has(`a-${idx}`);
                return (
                  <div
                    key={`adj-${idx}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: 12,
                      borderRadius: 12,
                      border: `1.5px solid ${ACTION_ICON_COLOR[item.action]}40`,
                      borderLeft: `4px solid ${ACTION_ICON_COLOR[item.action]}`,
                      background: isResolved ? "rgba(0,0,0,.02)" : "rgba(255,253,249,.97)",
                      opacity: isResolved ? 0.55 : 1,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-3)" }}>
                      <span style={{ fontWeight: 800, color: ACTION_ICON_COLOR[item.action] }}>
                        {t(`plannerAi.actions.${item.action}`)}
                      </span>
                      {item.blockTime && (
                        <>
                          <span>·</span>
                          <span>{item.blockTime}</span>
                        </>
                      )}
                      <span style={{ marginLeft: "auto", color: conf.color, fontWeight: 700 }}>
                        {t("plannerAi.confidence", { value: t(`plannerAi.confidenceLabels.${conf.key}`) })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
                      {item.blockTitle ?? t("plannerAi.block", { id: item.id })}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
                      {item.reason}
                    </p>
                    {!isResolved && (
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => void handleAdjustAccept(item, idx)}
                          disabled={busy}
                          style={{
                            flex: 1,
                            border: "1.5px solid var(--accent-sage, #96C7B3)",
                            background: busy ? "rgba(150,199,179,.18)" : "rgba(150,199,179,.08)",
                            color: "var(--accent-sage-ink, #50705B)",
                            borderRadius: 999,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: busy ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <Check size={14} />
                          {t("plannerAi.apply")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAdjustReject(item, idx)}
                          disabled={busy}
                          style={{
                            flex: 1,
                            border: "1.5px solid var(--warm-border-2, rgba(0,0,0,.12))",
                            background: "transparent",
                            color: "var(--text-3)",
                            borderRadius: 999,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: busy ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <XIcon size={14} />
                          {t("plannerAi.keep")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* Estado vazio */}
          {result.schedule.length === 0
            && result.adjustedExisting.filter((a) => a.action !== "KEEP").length === 0
            && result.adjustments.length === 0
            && result.warnings.length === 0
            && (
              <p style={{ textAlign: "center", padding: 24, color: "var(--text-3)", fontSize: 13 }}>
                {t("plannerAi.aligned")}
              </p>
            )}
        </>
      )}
    </AiriaBottomSheet>
  );
}

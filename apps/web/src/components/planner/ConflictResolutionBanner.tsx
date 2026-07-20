import { AlertTriangle, ArrowRight, CalendarClock, ChevronsDown, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ConflictResolutionType =
  | "MOVE_BLOCK_LATER"
  | "MOVE_BLOCK_EARLIER"
  | "DOWNGRADE_INTENSITY"
  | "POSTPONE_TOMORROW"
  | "CANCEL";

export type ConflictResolution = {
  type: ConflictResolutionType;
  targetBlockId: string;
  targetBlockTitle: string;
  parameters?: Record<string, unknown>;
  reason: string;
  confidence: number;
};

export type Conflict = {
  block1: string;
  block2: string;
  block1Id?: string;
  block2Id?: string;
  overlapMinutes: number;
  suggestedResolutions?: ConflictResolution[];
};

type Props = {
  conflicts: Conflict[];
  onApply: (resolution: ConflictResolution) => Promise<void> | void;
  onDismiss?: () => void;
  busyResolutionKey?: string | null;
};

const RESOLUTION_ICON: Record<ConflictResolutionType, LucideIcon> = {
  MOVE_BLOCK_LATER: ArrowRight,
  MOVE_BLOCK_EARLIER: ArrowRight,
  DOWNGRADE_INTENSITY: ChevronsDown,
  POSTPONE_TOMORROW: CalendarClock,
  CANCEL: Trash2,
};

export function ConflictResolutionBanner({ conflicts, onApply, onDismiss, busyResolutionKey }: Props) {
  const { t } = useTranslation();
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div
      style={{
        background: "rgba(247,231,166,.32)",
        border: "1.5px solid rgba(247,231,166,.7)",
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <AlertTriangle size={16} style={{ color: "#7C641A", marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#7C641A", lineHeight: 1.4 }}>
            {conflicts.length === 1
              ? t("conflicts.one")
              : t("conflicts.many", { count: conflicts.length })}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              border: "none",
              background: "transparent",
              color: "#7C641A",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 6px",
            }}
          >
            {t("conflicts.dismiss")}
          </button>
        )}
      </div>

      {conflicts.map((conflict, idx) => (
        <div
          key={`conflict-${idx}`}
          style={{
            background: "rgba(255,253,249,.95)",
            borderRadius: 10,
            padding: 10,
            marginBottom: idx < conflicts.length - 1 ? 8 : 0,
          }}
        >
          <p style={{ margin: "0 0 4px", fontSize: 12.5, color: "var(--text-1)", fontWeight: 600 }}>
            "{conflict.block1}" × "{conflict.block2}"
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-3)" }}>
            {t("conflicts.overlap", { minutes: conflict.overlapMinutes })}
          </p>

          {(conflict.suggestedResolutions ?? []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(conflict.suggestedResolutions ?? []).map((resolution, ridx) => {
                const Icon = RESOLUTION_ICON[resolution.type] ?? ArrowRight;
                const key = `${idx}-${ridx}-${resolution.type}-${resolution.targetBlockId}`;
                const busy = busyResolutionKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void onApply(resolution)}
                    disabled={busy}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      border: "1.5px solid rgba(124,100,26,.25)",
                      background: busy ? "rgba(247,231,166,.5)" : "rgba(255,253,249,.95)",
                      borderRadius: 8,
                      cursor: busy ? "default" : "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <Icon size={13} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text-1)" }}>
                        {t(`conflicts.${({ MOVE_BLOCK_LATER: "moveLater", MOVE_BLOCK_EARLIER: "moveEarlier", DOWNGRADE_INTENSITY: "reduce", POSTPONE_TOMORROW: "tomorrow", CANCEL: "cancel" } as const)[resolution.type]}`)}
                        {resolution.targetBlockTitle ? ` · "${resolution.targetBlockTitle}"` : ""}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>
                        {resolution.reason}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

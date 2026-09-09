import type { ReactNode } from "react";

export function SplitLayout({
  wide,
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  wide: boolean;
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="ow-split" data-layout={wide ? "wide" : "stacked"}>
      <section className="ow-pane ow-pane--left" aria-label={leftLabel}>
        {left}
      </section>
      <section className="ow-pane ow-pane--right" aria-label={rightLabel}>
        {right}
      </section>
    </div>
  );
}

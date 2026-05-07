import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type AiriaCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: "default" | "compact" | "action";
};

export function AiriaCard({ children, tone = "default", className, ...props }: AiriaCardProps) {
  return (
    <div className={clsx("airia-card", `airia-card--${tone}`, className)} {...props}>
      {children}
    </div>
  );
}

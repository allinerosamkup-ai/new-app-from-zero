import type { HTMLAttributes } from "react";
import { cn } from "../../utils/class-names";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return <div className={cn("aura-card", className)} {...props} />;
}

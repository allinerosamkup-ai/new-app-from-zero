import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type AiriaIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  variant?: "plain" | "soft" | "outline";
};

export function AiriaIconButton({ icon, variant = "soft", className, ...props }: AiriaIconButtonProps) {
  return (
    <button
      className={clsx("airia-icon-button", `airia-icon-button--${variant}`, className)}
      type="button"
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

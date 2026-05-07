import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type AiriaButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "soft";
  size?: "sm" | "md" | "lg";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
};

export function AiriaButton({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  ...props
}: AiriaButtonProps) {
  return (
    <button
      className={clsx(
        "airia-button",
        `airia-button--${variant}`,
        `airia-button--${size}`,
        fullWidth && "airia-button--full",
        className,
      )}
      {...props}
    >
      {leftIcon ? <span className="airia-button__icon" aria-hidden="true">{leftIcon}</span> : null}
      <span className="airia-button__label">{children}</span>
      {rightIcon ? <span className="airia-button__icon" aria-hidden="true">{rightIcon}</span> : null}
    </button>
  );
}

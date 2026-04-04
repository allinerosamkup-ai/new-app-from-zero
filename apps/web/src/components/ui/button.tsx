import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/class-names";

type AuraButtonVariant = "primary" | "secondary" | "ghost" | "soft";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AuraButtonVariant;
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("aura-button", `aura-button--${variant}`, className)}
      {...props}
    />
  );
}

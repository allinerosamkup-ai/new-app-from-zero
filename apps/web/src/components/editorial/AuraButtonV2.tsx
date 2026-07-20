import React from "react";
import clsx from "clsx";
import { AuraIcon } from "../AuraIcon";
import { tapHaptic } from "../../utils/haptics";

/**
 * AuraButtonV2 — Design System v5.0 (Spring Meadow Edition)
 * Botões com arredondamento Full Pill, gradientes Spring Meadow e Glass LUX.
 */

type AuraButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "glass" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  useAuraIcon?: boolean;
};

export function AuraButtonV2({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  useAuraIcon,
  className,
  children,
  onClick,
  ...props
}: AuraButtonProps) {
  const baseClasses = "btn-aura";

  // Design emocional P1: todo botão primário responde ao toque (háptico leve).
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (!props.disabled) tapHaptic();
    onClick?.(event);
  };
  
  const iconSize = size === "sm" ? 12 : size === "md" ? 14 : 16;
  const finalLeftIcon = useAuraIcon ? <AuraIcon size={iconSize} /> : leftIcon;

  const variantClasses = {
    primary: "btn-aura-primary",
    glass: "btn-aura-glass",
    outline: "btn-aura-outline",
    ghost: "btn-aura-ghost",
  };

  const sizeClasses = {
    sm: "btn-aura-sm",
    md: "btn-aura-md",
    lg: "btn-aura-lg",
  };

  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {finalLeftIcon && <span className="btn-aura__icon" aria-hidden="true">{finalLeftIcon}</span>}
      <span className="btn-aura__label">{children}</span>
      {rightIcon && <span className="btn-aura__icon" aria-hidden="true">{rightIcon}</span>}
    </button>
  );
}

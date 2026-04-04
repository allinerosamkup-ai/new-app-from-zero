import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/class-names";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
};

export function Input({ className, icon, ...props }: InputProps) {
  return (
    <div className="aura-input-wrap">
      {icon ? <span className="aura-input-icon">{icon}</span> : null}
      <input
        className={cn("aura-input", !!icon && "aura-input--with-icon", className)}
        {...props}
      />
    </div>
  );
}

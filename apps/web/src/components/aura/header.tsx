import type { ReactNode } from "react";

type AuraHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function AuraHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: AuraHeaderProps) {
  return (
    <header className="aura-header">
      <div>
        <p className="aura-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? <p className="aura-subcopy">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

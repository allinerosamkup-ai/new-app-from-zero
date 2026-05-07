import type { ReactNode } from "react";

type AiriaSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function AiriaSectionHeader({ eyebrow, title, description, action }: AiriaSectionHeaderProps) {
  return (
    <div className="airia-section-header">
      <div className="airia-section-header__copy">
        {eyebrow ? <span className="airia-section-header__eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="airia-section-header__action">{action}</div> : null}
    </div>
  );
}

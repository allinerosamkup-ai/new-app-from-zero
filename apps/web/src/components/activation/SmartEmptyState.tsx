import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AiriaButton, AiriaCard } from "../airia";

type Example = {
  title: string;
  description?: string;
};

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  route?: string;
  onAction?: () => void;
  examples?: Example[];
};

export function SmartEmptyState({ icon: Icon, title, description, ctaLabel, route, onAction, examples = [] }: Props) {
  const navigate = useNavigate();

  function handleAction() {
    if (onAction) {
      onAction();
      return;
    }
    if (route) navigate(route);
  }

  return (
    <AiriaCard tone="action" className="airia-empty-state">
      <div className="airia-empty-state__lead">
        <div className="airia-empty-state__icon">
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      {examples.length > 0 && (
        <div className="airia-empty-state__examples">
          {examples.slice(0, 3).map((example) => (
            <div key={example.title} className="airia-empty-state__example">
              <strong>{example.title}</strong>
              {example.description && (
                <span>{example.description}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <AiriaButton
        variant="primary"
        size="md"
        onClick={handleAction}
        rightIcon={<ArrowRight size={14} />}
        fullWidth
      >
        {ctaLabel}
      </AiriaButton>
    </AiriaCard>
  );
}

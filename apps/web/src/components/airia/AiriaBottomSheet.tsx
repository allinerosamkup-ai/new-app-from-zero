import type { ReactNode } from "react";
import { X } from "lucide-react";

import { AiriaIconButton } from "./AiriaIconButton";

type AiriaBottomSheetProps = {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  maxHeight?: string;
};

export function AiriaBottomSheet({
  open,
  title,
  description,
  icon,
  children,
  footer,
  onClose,
  closeLabel = "Fechar",
  maxHeight = "88vh",
}: AiriaBottomSheetProps) {
  if (!open) return null;

  return (
    <div className="airia-sheet-backdrop" role="presentation">
      <section
        className="airia-bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxHeight }}
      >
        <div className="airia-bottom-sheet__handle" />
        <header className="airia-bottom-sheet__header">
          {icon ? <div className="airia-bottom-sheet__icon">{icon}</div> : null}
          <div className="airia-bottom-sheet__copy">
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <AiriaIconButton
            aria-label={closeLabel}
            icon={<X size={17} />}
            variant="plain"
            onClick={onClose}
          />
        </header>
        <div className="airia-bottom-sheet__body">{children}</div>
        {footer ? <footer className="airia-bottom-sheet__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

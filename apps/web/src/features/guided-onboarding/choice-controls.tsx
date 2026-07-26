import type { CSSProperties, ReactNode } from 'react';

import type { GuidedCategory, GuidedOption } from './types';

/**
 * Controles de escolha do onboarding guiado.
 *
 * Regra da tela: tudo se resolve tocando. Nenhum controle aqui abre teclado —
 * digitar é exceção, não caminho principal.
 */

const CARD_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '13px 14px',
  borderRadius: 16,
  border: '1.5px solid var(--warm-border-2)',
  background: 'var(--surface-1, #FFFFFF)',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  minHeight: 52,
  transition: 'border-color 140ms ease, background 140ms ease, transform 140ms ease',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-1)',
};

const CARD_SELECTED: CSSProperties = {
  borderColor: 'var(--accent-peach-strong, #E8A08F)',
  background: 'var(--accent-peach-a, rgba(244,190,168,.12))',
  color: 'var(--accent-peach-ink)',
};

export function ChoiceCard({
  option,
  selected,
  onToggle,
}: {
  option: GuidedOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      style={{ ...CARD_BASE, ...(selected ? CARD_SELECTED : null) }}
    >
      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }} aria-hidden>{option.emoji}</span>
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>{option.label}</span>
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          borderRadius: '50%',
          border: selected ? 'none' : '1.5px solid var(--warm-border-2)',
          background: selected ? 'var(--accent-peach-strong, #E8A08F)' : 'transparent',
          color: '#FFF',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
        }}
      >
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}

export function ChoiceGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
      {children}
    </div>
  );
}

/**
 * Escolhas agrupadas por categoria. Sem isso, "o que te drena" vira uma lista
 * de trinta itens soltos — cansa antes de responder.
 */
export function CategorySections({
  categories,
  selected,
  onToggle,
}: {
  categories: GuidedCategory[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {categories.map((category) => (
        <section key={category.id}>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              margin: '0 0 8px',
            }}
          >
            {category.label}
          </h3>
          <ChoiceGrid>
            {category.options.map((option) => (
              <ChoiceCard
                key={option.id}
                option={option}
                selected={selected.includes(option.id)}
                onToggle={() => onToggle(option.id)}
              />
            ))}
          </ChoiceGrid>
        </section>
      ))}
    </div>
  );
}

/** Escala de 1 a 10 por toque — o check-in inicial não pede texto. */
export function ScalePicker({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-peach-ink)' }}>{value}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((step) => (
          <button
            key={step}
            type="button"
            aria-label={`${label}: ${step}`}
            aria-pressed={value === step}
            onClick={() => onChange(step)}
            style={{
              height: 38,
              borderRadius: 10,
              border: value === step ? 'none' : '1.5px solid var(--warm-border-2)',
              background: value >= step ? 'var(--accent-peach-strong, #E8A08F)' : 'transparent',
              opacity: value >= step ? (value === step ? 1 : 0.45) : 1,
              color: value >= step ? '#FFF' : 'var(--text-3)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {step}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{lowLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{highLabel}</span>
      </div>
    </div>
  );
}

/** Grupo de opções curtas em linha — usado para respostas de uma palavra. */
export function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            style={{
              padding: '9px 15px',
              borderRadius: 999,
              minHeight: 40,
              border: selected ? 'none' : '1.5px solid var(--warm-border-2)',
              background: selected ? 'var(--accent-peach-strong, #E8A08F)' : 'transparent',
              color: selected ? '#FFF' : 'var(--text-2)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

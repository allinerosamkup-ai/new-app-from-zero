import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AuraButtonV2 } from '../components/editorial/AuraButtonV2';
import { CategorySections, ChoiceCard, ChoiceGrid, PillGroup, ScalePicker } from '../features/guided-onboarding/choice-controls';
import {
  EMPTY_ANSWERS,
  WEEKDAYS,
  buildAvailabilityWindows,
  habitFromTemplate,
  type AvailabilityPeriod,
  type FixedCommitment,
  type GuidedAnswers,
  type GuidedLibrary,
  type HabitTemplate,
} from '../features/guided-onboarding/types';
import { routineBuilderApi } from '../features/routine-builder/api';
import { getClientTimeContext } from '../lib/api';
import { useToast } from '../components/Toast';
import '../styles/aura.css';

/** Mesma chave que a prévia lê para retomar a sessão. */
const SESSION_KEY = 'airia:routine-builder:session';

/**
 * Onboarding guiado — da primeira tela a uma rotina utilizável em poucos minutos.
 *
 * Só a etapa de nome abre teclado. Todo o resto se resolve tocando em cartão,
 * dia da semana ou escala. Documento não aparece aqui: fica em Configurações
 * para quem quiser importar depois.
 */

type Step = {
  id: string;
  /** Etapa opcional pode ser pulada sem escolha nenhuma. */
  optional: boolean;
};

const STEPS: Step[] = [
  { id: 'areas', optional: false },
  { id: 'availability', optional: false },
  { id: 'commitments', optional: true },
  { id: 'energy', optional: false },
  { id: 'intentions', optional: false },
  { id: 'habits', optional: false },
  { id: 'today', optional: false },
];

const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

const SLEEP_OPTION_IDS = [
  { id: 'ruim', labelKey: 'sleepBad' },
  { id: 'razoável', labelKey: 'sleepOk' },
  { id: 'bem', labelKey: 'sleepGood' },
] as const;

function addHour(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const next = Math.min(23, h + hours);
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function GuidedOnboardingPage() {
  const navigate = useNavigate();
  const { showError } = useToast();
  const { t } = useTranslation();
  const g = (key: string, options?: Record<string, unknown>) => t(`guidedOnboarding.${key}`, options);

  const [library, setLibrary] = useState<GuidedLibrary | null>(null);
  const [libraryError, setLibraryError] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<GuidedAnswers>(EMPTY_ANSWERS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    routineBuilderApi.library()
      .then((data: GuidedLibrary) => {
        if (active) setLibrary(data);
      })
      .catch(() => {
        if (active) setLibraryError(true);
      });
    return () => { active = false; };
  }, []);

  /**
   * Hábitos sugeridos vêm do mapa intenção→hábito que o backend serve.
   * O que ela já marcou continua na lista mesmo se ela voltar e trocar a
   * intenção — escolha feita não some sem ela mandar.
   */
  const suggestedHabits = useMemo<HabitTemplate[]>(() => {
    if (!library) return [];

    const wanted = new Set<string>();
    for (const intention of library.intentions) {
      if (!answers.intentions.includes(intention.id)) continue;
      for (const templateId of intention.habitTemplateIds) wanted.add(templateId);
    }
    for (const habit of answers.selectedHabits) wanted.add(habit.templateId);

    return library.habitTemplates.filter((template) => wanted.has(template.id));
  }, [library, answers.intentions, answers.selectedHabits]);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const canContinue = useMemo(() => {
    if (step.optional) return true;
    switch (step.id) {
      case 'areas': return answers.lifeAreas.length > 0;
      case 'availability': return answers.availability.length > 0;
      case 'energy': return answers.energyDrains.length > 0 || answers.energyRestorers.length > 0;
      case 'intentions': return answers.intentions.length > 0;
      case 'habits': return true;
      case 'today': return true;
      default: return true;
    }
  }, [step, answers]);

  function goBack() {
    if (stepIndex === 0) {
      navigate(-1);
      return;
    }
    setStepIndex((current) => current - 1);
  }

  async function handleContinue() {
    if (!canContinue || submitting) return;
    if (!isLast) {
      setStepIndex((current) => current + 1);
      return;
    }

    setSubmitting(true);
    try {
      const { localDate } = getClientTimeContext();
      const session = await routineBuilderApi.createGuided({
        weekStart: localDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
      });

      await routineBuilderApi.submitGuided(session.id, answers, localDate);

      // A prévia retoma a sessão por aqui — mesmo contrato do fluxo de importação.
      localStorage.setItem(SESSION_KEY, session.id);
      navigate('/routine-builder');
    } catch (error) {
      showError(g('submitError'));
      setSubmitting(false);
    }
  }

  function addCommitment(commitment: FixedCommitment) {
    setAnswers((current) => ({
      ...current,
      fixedCommitments: [...current.fixedCommitments, commitment],
    }));
  }

  function removeCommitment(index: number) {
    setAnswers((current) => ({
      ...current,
      fixedCommitments: current.fixedCommitments.filter((_, position) => position !== index),
    }));
  }

  function toggleHabit(template: HabitTemplate) {
    setAnswers((current) => {
      const already = current.selectedHabits.some((habit) => habit.templateId === template.id);
      return {
        ...current,
        selectedHabits: already
          ? current.selectedHabits.filter((habit) => habit.templateId !== template.id)
          : [...current.selectedHabits, habitFromTemplate(template)],
      };
    });
  }

  if (libraryError) {
    return (
      <div className="aura-page-shell">
        <div className="screen-content" style={{ padding: 24 }}>
          <h1 className="aura-page-title">{g('loadError')}</h1>
          <p className="aura-page-subtitle">{g('loadErrorHint')}</p>
          <AuraButtonV2 onClick={() => window.location.reload()}>{g('retry')}</AuraButtonV2>
        </div>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="aura-page-shell">
        <div className="screen-content" style={{ padding: 24 }}>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--warm-border)', marginBottom: 20 }} />
          <div style={{ height: 28, width: '70%', borderRadius: 8, background: 'var(--warm-border)', marginBottom: 12 }} />
          <div style={{ display: 'grid', gap: 8 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} style={{ height: 52, borderRadius: 16, background: 'var(--warm-border)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aura-page-shell">
      <div
        className="screen-content"
        style={{ display: 'flex', flexDirection: 'column', padding: '18px 20px 120px', minHeight: '100dvh' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button
            type="button"
            onClick={goBack}
            aria-label={g('back')}
            style={{
              width: 36, height: 36, borderRadius: 12, flexShrink: 0,
              border: '1.5px solid var(--warm-border-2)', background: 'transparent',
              color: 'var(--text-2)', fontSize: 16, cursor: 'pointer',
            }}
          >
            ←
          </button>
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--warm-border)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${((stepIndex + 1) / STEPS.length) * 100}%`,
                background: 'var(--accent-peach-strong, #E8A08F)',
                borderRadius: 999,
                transition: 'width 220ms ease',
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>
            {stepIndex + 1}/{STEPS.length}
          </span>
        </div>

        <h1 className="aura-page-title" style={{ marginBottom: 6 }}>{g(`step${step.id.charAt(0).toUpperCase()}${step.id.slice(1)}Title`)}</h1>
        <p className="aura-page-subtitle" style={{ marginBottom: 22 }}>{g(`step${step.id.charAt(0).toUpperCase()}${step.id.slice(1)}Hint`)}</p>

        <div style={{ flex: 1 }}>
          {step.id === 'areas' && (
            <ChoiceGrid>
              {library.lifeAreas.map((option) => (
                <ChoiceCard
                  key={option.id}
                  option={option}
                  selected={answers.lifeAreas.includes(option.id)}
                  onToggle={() => setAnswers((current) => ({ ...current, lifeAreas: toggle(current.lifeAreas, option.id) }))}
                />
              ))}
            </ChoiceGrid>
          )}

          {step.id === 'availability' && (
            <AvailabilityStep
              availability={answers.availability}
              onChange={(availability) => setAnswers((current) => ({ ...current, availability }))}
              g={g}
            />
          )}

          {step.id === 'commitments' && (
            <CommitmentStep
              areas={library.lifeAreas.filter((area) => answers.lifeAreas.includes(area.id))}
              commitments={answers.fixedCommitments}
              onAdd={addCommitment}
              onRemove={removeCommitment}
              g={g}
            />
          )}

          {step.id === 'energy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 14px' }}>
                  {g('drains')}
                </h2>
                <CategorySections
                  categories={library.energyDrains}
                  selected={answers.energyDrains}
                  onToggle={(id) => setAnswers((current) => ({ ...current, energyDrains: toggle(current.energyDrains, id) }))}
                />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 14px' }}>
                  {g('restorers')}
                </h2>
                <CategorySections
                  categories={library.energyRestorers}
                  selected={answers.energyRestorers}
                  onToggle={(id) => setAnswers((current) => ({ ...current, energyRestorers: toggle(current.energyRestorers, id) }))}
                />
              </div>
            </div>
          )}

          {step.id === 'intentions' && (
            <ChoiceGrid>
              {library.intentions.map((option) => (
                <ChoiceCard
                  key={option.id}
                  option={option}
                  selected={answers.intentions.includes(option.id)}
                  onToggle={() => setAnswers((current) => ({ ...current, intentions: toggle(current.intentions, option.id) }))}
                />
              ))}
            </ChoiceGrid>
          )}

          {step.id === 'habits' && (
            <HabitStep
              templates={suggestedHabits.length > 0 ? suggestedHabits : library.habitTemplates}
              selectedIds={answers.selectedHabits.map((habit) => habit.templateId)}
              onToggle={toggleHabit}
              g={g}
            />
          )}

          {step.id === 'today' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <ScalePicker
                label={g('mood')}
                value={answers.currentState.mood}
                lowLabel={g('moodLow')}
                highLabel={g('moodHigh')}
                onChange={(mood) => setAnswers((current) => ({ ...current, currentState: { ...current.currentState, mood } }))}
              />
              <ScalePicker
                label={g('energy')}
                value={answers.currentState.energy}
                lowLabel={g('energyLow')}
                highLabel={g('energyHigh')}
                onChange={(energy) => setAnswers((current) => ({ ...current, currentState: { ...current.currentState, energy } }))}
              />
              <ScalePicker
                label={g('focus')}
                value={answers.currentState.focus}
                lowLabel={g('focusLow')}
                highLabel={g('focusHigh')}
                onChange={(focus) => setAnswers((current) => ({ ...current, currentState: { ...current.currentState, focus } }))}
              />
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', display: 'block', marginBottom: 10 }}>
                  {g('sleep')}
                </span>
                <PillGroup
                  options={SLEEP_OPTION_IDS.map((option) => ({ id: option.id, label: g(option.labelKey) }))}
                  value={answers.currentState.sleepQuality}
                  onChange={(sleepQuality) => setAnswers((current) => ({ ...current, currentState: { ...current.currentState, sleepQuality } }))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          padding: '14px 20px calc(20px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, var(--surface-0, #FFF) 68%, transparent)',
          display: 'flex', gap: 10, alignItems: 'center',
        }}
      >
        {step.optional && (
          <button
            type="button"
            onClick={() => setStepIndex((current) => current + 1)}
            style={{
              padding: '14px 18px', borderRadius: 16, border: 'none', background: 'transparent',
              color: 'var(--text-3)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {g('skip')}
          </button>
        )}
        <AuraButtonV2
          onClick={handleContinue}
          disabled={!canContinue || submitting}
          style={{ flex: 1 }}
        >
          {submitting ? g('building') : isLast ? g('build') : g('continue')}
        </AuraButtonV2>
      </div>
    </div>
  );
}

function AvailabilityStep({
  availability,
  onChange,
  g,
}: {
  availability: GuidedAnswers['availability'];
  onChange: (availability: GuidedAnswers['availability']) => void;
  g: (key: string, options?: Record<string, unknown>) => string;
}) {
  const selectedDays = availability.map((window) => window.dayOfWeek);
  const firstWindow = availability[0];
  const period: AvailabilityPeriod = firstWindow?.startTime === '09:00'
    ? 'daytime'
    : firstWindow?.startTime === '17:00'
      ? 'evening'
      : firstWindow?.endTime === '13:00'
        ? 'morning'
        : 'flexible';

  function apply(nextDays: number[], nextPeriod: AvailabilityPeriod = period) {
    onChange(buildAvailabilityWindows(nextDays, nextPeriod));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <span style={{ display: 'block', marginBottom: 10, color: 'var(--text-1)', fontSize: 14, fontWeight: 800 }}>
          {g('availableDays')}
        </span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => apply([1, 2, 3, 4, 5])} style={quickChoiceStyle}>
            {g('weekdays')}
          </button>
          <button type="button" onClick={() => apply([0, 1, 2, 3, 4, 5, 6])} style={quickChoiceStyle}>
            {g('allDays')}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {WEEKDAYS.map((day) => {
            const selected = selectedDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-label={day.label}
                aria-pressed={selected}
                onClick={() => apply(selected
                  ? selectedDays.filter((value) => value !== day.value)
                  : [...selectedDays, day.value])}
                style={{
                  height: 44, borderRadius: 12, padding: 0,
                  border: selected ? 'none' : '1.5px solid var(--warm-border-2)',
                  background: selected ? 'var(--accent-peach-strong, #E8A08F)' : 'transparent',
                  color: selected ? '#FFF' : 'var(--text-2)',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                }}
              >
                {day.short}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span style={{ display: 'block', marginBottom: 10, color: 'var(--text-1)', fontSize: 14, fontWeight: 800 }}>
          {g('availablePeriod')}
        </span>
        <PillGroup
          options={[
            { id: 'morning', label: g('periodMorning') },
            { id: 'daytime', label: g('periodDaytime') },
            { id: 'evening', label: g('periodEvening') },
            { id: 'flexible', label: g('periodFlexible') },
          ]}
          value={period}
          onChange={(value) => apply(selectedDays, value as AvailabilityPeriod)}
        />
        <p style={{ margin: '10px 0 0', color: 'var(--text-3)', fontSize: 12, lineHeight: 1.45 }}>
          {g('availabilityNote')}
        </p>
      </div>
    </div>
  );
}

const quickChoiceStyle = {
  minHeight: 38,
  padding: '8px 13px',
  borderRadius: 999,
  border: '1.5px solid var(--warm-border-2)',
  background: 'var(--surface-1, #FFF)',
  color: 'var(--text-2)',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
} as const;

/** Compromisso fixo montado por toque: título vem das áreas escolhidas, horário é lista. */
function CommitmentStep({
  areas,
  commitments,
  onAdd,
  onRemove,
  g,
}: {
  g: (key: string, options?: Record<string, unknown>) => string;
  areas: { id: string; label: string; emoji: string }[];
  commitments: FixedCommitment[];
  onAdd: (commitment: FixedCommitment) => void;
  onRemove: (index: number) => void;
}) {
  const [draftArea, setDraftArea] = useState(areas[0]?.label ?? 'Compromisso');
  const [draftDays, setDraftDays] = useState<number[]>([]);
  const [draftStart, setDraftStart] = useState('09:00');

  const canAdd = draftDays.length > 0;

  function confirm() {
    if (!canAdd) return;
    for (const dayOfWeek of draftDays) {
      onAdd({ title: draftArea, dayOfWeek, startTime: draftStart, endTime: addHour(draftStart, 1) });
    }
    setDraftDays([]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {commitments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {commitments.map((commitment, index) => (
            <div
              key={`${commitment.title}-${commitment.dayOfWeek}-${commitment.startTime}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderRadius: 14, border: '1.5px solid var(--warm-border-2)',
              }}
            >
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                {commitment.title}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>
                {WEEKDAYS[commitment.dayOfWeek].label.slice(0, 3)} · {commitment.startTime}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={g('removeAria', { title: commitment.title })}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', padding: 4 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {areas.length > 0 && (
        <div>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>
            {g('what')}
          </span>
          <PillGroup
            options={areas.map((area) => ({ id: area.label, label: `${area.emoji} ${area.label}` }))}
            value={draftArea}
            onChange={setDraftArea}
          />
        </div>
      )}

      <div>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>
          {g('whichDays')}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {WEEKDAYS.map((day) => {
            const selected = draftDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-label={day.label}
                aria-pressed={selected}
                onClick={() => setDraftDays((current) => current.includes(day.value)
                  ? current.filter((value) => value !== day.value)
                  : [...current, day.value])}
                style={{
                  height: 44, borderRadius: 12,
                  border: selected ? 'none' : '1.5px solid var(--warm-border-2)',
                  background: selected ? 'var(--accent-peach-strong, #E8A08F)' : 'transparent',
                  color: selected ? '#FFF' : 'var(--text-2)',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: 0,
                }}
              >
                {day.short}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>
          {g('startTime')}
        </span>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {HOURS.map((hour) => (
            <button
              key={hour}
              type="button"
              aria-pressed={draftStart === hour}
              onClick={() => setDraftStart(hour)}
              style={{
                flexShrink: 0, padding: '10px 14px', borderRadius: 12, minHeight: 42,
                border: draftStart === hour ? 'none' : '1.5px solid var(--warm-border-2)',
                background: draftStart === hour ? 'var(--accent-peach-strong, #E8A08F)' : 'transparent',
                color: draftStart === hour ? '#FFF' : 'var(--text-2)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {hour}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={confirm}
        disabled={!canAdd}
        style={{
          padding: '13px 0', borderRadius: 14, width: '100%',
          border: '1.5px dashed var(--warm-border-2)', background: 'transparent',
          color: canAdd ? 'var(--accent-peach-ink)' : 'var(--text-3)',
          fontSize: 14, fontWeight: 700, cursor: canAdd ? 'pointer' : 'default',
        }}
      >
        {g('addCommitment')}
      </button>
    </div>
  );
}

/** Hábito é cartão com frequência visível — ela vê o compromisso antes de aceitar. */
function HabitStep({
  templates,
  selectedIds,
  onToggle,
  g,
}: {
  g: (key: string, options?: Record<string, unknown>) => string;
  templates: HabitTemplate[];
  selectedIds: string[];
  onToggle: (template: HabitTemplate) => void;
}) {
  function frequencyLabel(template: HabitTemplate): string {
    if (template.frequency === 'daily') return g('everyDay');
    if (template.daysOfWeek.length === 0) return g('everyWeek');
    return template.daysOfWeek.map((day) => WEEKDAYS[day].label.slice(0, 3).toLowerCase()).join(', ');
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {templates.map((template) => {
        const selected = selectedIds.includes(template.id);
        return (
          <button
            key={template.id}
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={() => onToggle(template)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
              borderRadius: 16, width: '100%', textAlign: 'left', cursor: 'pointer',
              minHeight: 60,
              border: selected ? '1.5px solid var(--accent-peach-strong, #E8A08F)' : '1.5px solid var(--warm-border-2)',
              background: selected ? 'var(--accent-peach-a, rgba(244,190,168,.12))' : 'var(--surface-1, #FFF)',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden>{template.emoji}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: selected ? 'var(--accent-peach-ink)' : 'var(--text-1)' }}>
                {template.title}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {frequencyLabel(template)} · {template.durationMinutes} min
              </span>
            </span>
            <span
              aria-hidden
              style={{
                width: 20, height: 20, flexShrink: 0, borderRadius: '50%',
                border: selected ? 'none' : '1.5px solid var(--warm-border-2)',
                background: selected ? 'var(--accent-peach-strong, #E8A08F)' : 'transparent',
                color: '#FFF', fontSize: 12, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {selected ? '✓' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default GuidedOnboardingPage;

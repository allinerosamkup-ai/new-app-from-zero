import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  Info,
  LoaderCircle,
  Paperclip,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { routineBuilderApi } from '../features/routine-builder/api';
import {
  applyPlanEntryEdit,
  buildRoutineSuggestionCards,
  nextBuilderStep,
  remainingRoutineSourceItemIds,
  shouldAutoStartRoutineSource,
  shouldRestoreRoutineSession,
} from '../features/routine-builder/helpers';
import { RoutineItemCard } from '../features/routine-builder/routine-item-card';
import type { RoutineItem, RoutineItemKind, RoutineSession } from '../features/routine-builder/types';
import { WeekPreview } from '../features/routine-builder/week-preview';
import '../features/routine-builder/routine-builder.css';

const SESSION_KEY = 'airia:routine-builder:session';
const ACCEPTED_FILES = '.txt,.md,.pdf,.docx,.xlsx';

function localMonday(): string {
  const date = new Date();
  const distance = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - distance);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function confirmedItems(items: RoutineItem[]): RoutineItem[] {
  return items.map((item) => item.reviewState === 'excluded'
    ? item
    : { ...item, reviewState: 'confirmed' as const });
}

export function RoutineBuilderPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (location.state as { initialSource?: string; focus?: string } | null) ?? {};
  const [session, setSession] = useState<RoutineSession | null>(null);
  const [focus, setFocus] = useState(incoming.focus ?? 'Organizar minha rotina');
  const [sourceText, setSourceText] = useState(incoming.initialSource ?? '');
  const [weekStart, setWeekStart] = useState(localMonday());
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savingSourceItemIds, setSavingSourceItemIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const autoStartedSourceRef = useRef<string | null>(null);

  const step = session ? nextBuilderStep(session) : 'source';
  const kindLabels = t('routineBuilder.kinds', { returnObjects: true }) as Record<RoutineItemKind, string>;
  const cards = useMemo(() => (
    session?.draftPlan
      ? buildRoutineSuggestionCards({
          items: session.items,
          plan: session.draftPlan,
          appliedSourceItemIds: session.applyResult?.appliedSourceItemIds ?? [],
        })
      : []
  ), [session]);
  const remainingSourceItemIds = useMemo(() => remainingRoutineSourceItemIds(cards), [cards]);
  const proposedCounts = useMemo(() => cards.reduce(
    (counts, card) => {
      if (card.kind === 'habit') counts.habits += 1;
      else if (card.kind === 'goal' || card.kind === 'project') counts.objectives += 1;
      else counts.tasks += 1;
      return counts;
    },
    { habits: 0, objectives: 0, tasks: 0 },
  ), [cards]);

  useEffect(() => {
    if (!shouldRestoreRoutineSession(incoming)) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return;
    setBusy(true);
    routineBuilderApi.get(sessionId)
      .then((value) => {
        setSession(value);
        setItems(value.items ?? []);
      })
      .catch(() => localStorage.removeItem(SESSION_KEY))
      .finally(() => setBusy(false));
  }, [incoming.focus, incoming.initialSource]);

  useEffect(() => {
    if (!session) return;
    setItems(session.items ?? []);
    localStorage.setItem(SESSION_KEY, session.id);
  }, [session]);

  const allAnswersReady = useMemo(
    () => (session?.questions ?? []).every((question) => Boolean(answers[question.id]?.trim())),
    [answers, session?.questions],
  );

  async function run<T>(operation: () => Promise<T>, onDone: (value: T) => void): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      onDone(await operation());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('common.unexpectedError'));
    } finally {
      setBusy(false);
    }
  }

  async function moveClassifiedSourceToProposal(classified: RoutineSession): Promise<RoutineSession> {
    const eligible = classified.items.filter((item) => item.reviewState !== 'excluded');
    if (eligible.length === 0) return classified;
    const reviewed = await routineBuilderApi.updateItems(classified.id, confirmedItems(classified.items));
    return reviewed.status === 'ready'
      ? routineBuilderApi.compose(reviewed.id)
      : reviewed;
  }

  async function createProposal(input: {
    text: string;
    attachment: File | null;
    organizationFocus: string;
  }): Promise<RoutineSession> {
    const created = await routineBuilderApi.create({
      focus: input.organizationFocus.trim() || 'Organizar minha rotina',
      weekStart,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
      locale: i18n.language === 'en' ? 'en-US' : 'pt-BR',
      limits: { wakeTime: '07:00', sleepTime: '23:00', maxDailyLoadMinutes: 360, unavailable: [] },
    });
    localStorage.setItem(SESSION_KEY, created.id);
    const classified = input.attachment
      ? await routineBuilderApi.upload(created.id, input.attachment)
      : await routineBuilderApi.sendText(created.id, input.text.trim());
    return moveClassifiedSourceToProposal(classified);
  }

  async function start(): Promise<void> {
    if (!sourceText.trim() && !file) return;
    await run(
      () => createProposal({ text: sourceText, attachment: file, organizationFocus: focus }),
      setSession,
    );
  }

  function updateItem(next: RoutineItem): void {
    setItems((current) => current.map((item) => item.id === next.id ? next : item));
  }

  function confirmItems(): void {
    if (!session) return;
    void run(async () => {
      const reviewed = await routineBuilderApi.updateItems(session.id, confirmedItems(items));
      return reviewed.status === 'ready' ? routineBuilderApi.compose(reviewed.id) : reviewed;
    }, setSession);
  }

  function submitAnswers(): void {
    if (!session) return;
    const payload = session.questions.map((question) => ({
      questionId: question.id,
      answer: answers[question.id],
    }));
    void run(async () => {
      const answered = await routineBuilderApi.answer(session.id, payload);
      return answered.status === 'ready' ? routineBuilderApi.compose(answered.id) : answered;
    }, setSession);
  }

  function compose(): void {
    if (!session) return;
    void run(() => routineBuilderApi.compose(session.id), setSession);
  }

  async function applySelected(sourceItemIds?: string[]): Promise<void> {
    if (!session) return;
    const savingIds = sourceItemIds ?? remainingSourceItemIds;
    setSavingSourceItemIds((current) => new Set([...current, ...savingIds]));
    setError(null);
    try {
      await routineBuilderApi.apply(session.id, sourceItemIds);
      setSession(await routineBuilderApi.get(session.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('common.unexpectedError'));
    } finally {
      setSavingSourceItemIds((current) => {
        const next = new Set(current);
        savingIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  async function reviseRoutineItem(
    sourceItemId: string,
    patch: {
      title?: string;
      kind?: RoutineItem['kind'];
      date?: string;
      startTime?: string;
      durationMinutes?: number;
      excluded?: boolean;
      recurrence?: RoutineItem['recurrence'];
    },
  ): Promise<void> {
    if (!session) return;
    const revisedItems = applyPlanEntryEdit(session.items, sourceItemId, patch);
    await run(async () => {
      const reviewed = await routineBuilderApi.updateItems(session.id, revisedItems);
      return reviewed.status === 'ready' ? routineBuilderApi.compose(reviewed.id) : reviewed;
    }, setSession);
  }

  useEffect(() => {
    const incomingKey = `${incoming.focus ?? ''}\u0000${incoming.initialSource ?? ''}`;
    if (!shouldAutoStartRoutineSource(incoming, {
      hasSession: Boolean(session),
      busy,
      alreadyStarted: autoStartedSourceRef.current === incomingKey,
    })) return;
    autoStartedSourceRef.current = incomingKey;
    void start();
  }, [busy, incoming.focus, incoming.initialSource, session]);

  function restart(options: { keepSource?: boolean } = {}): void {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setItems([]);
    setAnswers({});
    setSavingSourceItemIds(new Set());
    setError(null);
    if (!options.keepSource) {
      setSourceText('');
      setFile(null);
    }
  }

  function regenerate(): void {
    if (!sourceText.trim() && !file) {
      restart();
      return;
    }
    void run(
      () => createProposal({ text: sourceText, attachment: file, organizationFocus: focus }),
      setSession,
    );
  }

  return (
    <main className="routine-builder-page">
      <div className="routine-builder-shell">
        <header className="routine-builder-header">
          <button type="button" className="routine-builder-header__back" onClick={() => navigate('/home')}>
            <ArrowLeft size={18} /> {t('routineBuilder.backHome')}
          </button>
          {step !== 'source' && (
            <>
              <p className="routine-builder-header__eyebrow">{t('routineBuilder.eyebrow')}</p>
              <h1>{t('routineBuilder.proposalHeading', { defaultValue: 'Sua rotina, pronta para decidir.' })}</h1>
            </>
          )}
        </header>

        <section className={`routine-panel routine-panel--${step}`} aria-busy={busy}>
          {!session && busy && (
            <div className="routine-loading">
              <LoaderCircle size={24} className="spin" />
              <strong>{t('routineBuilder.generating', { defaultValue: 'Separando tarefas, hábitos e metas…' })}</strong>
              <span>{t('routineBuilder.generatingBody', { defaultValue: 'A Airia está cruzando seus planos com a capacidade da semana.' })}</span>
            </div>
          )}

          {step === 'source' && !busy && (
            <div className="routine-source-stage">
              <div className="routine-source-hero">
                <p>{t('routineBuilder.hello', { defaultValue: 'Olá!' })}</p>
                <h1>{t('routineBuilder.sourceQuestion', { defaultValue: 'Que tarefas você precisa organizar?' })}</h1>
              </div>

              <div className="routine-source-examples" aria-label={t('routineBuilder.examples', { defaultValue: 'Exemplos' })}>
                {[
                  t('routineBuilder.exampleRoutine', { defaultValue: 'Criar uma rotina de conteúdo 3 vezes por semana' }),
                  t('routineBuilder.exampleHome', { defaultValue: 'Organizar casa, trabalho e autocuidado' }),
                  t('routineBuilder.exampleProject', { defaultValue: 'Dividir um projeto grande em próximos passos' }),
                ].map((example) => (
                  <button key={example} type="button" onClick={() => setSourceText(example)}>
                    <Sparkles size={15} /> {example}
                  </button>
                ))}
              </div>

              <div className="routine-source-composer">
                <textarea
                  id="routine-source"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder={t('routineBuilder.sourcePrompt', { defaultValue: 'Me diga seus planos…' })}
                />
                <label className="routine-source-attachment" aria-label={t('routineBuilder.fileLabel')}>
                  <Paperclip size={19} />
                  <input type="file" accept={ACCEPTED_FILES} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
                <button
                  className="routine-source-generate"
                  type="button"
                  disabled={!sourceText.trim() && !file}
                  onClick={() => void start()}
                >
                  <Sparkles size={18} />
                  <span>{t('routineBuilder.generate', { defaultValue: 'Gerar rotina' })}</span>
                </button>
              </div>
              {file && <p className="routine-source-file"><FileText size={14} /> {file.name}</p>}

              <details className="routine-import-option">
                <summary>
                  <span>{t('routineBuilder.moreOptions', { defaultValue: 'Ajustar semana e foco' })}</span>
                  <ChevronDown size={16} />
                </summary>
                <div className="routine-import-option__body">
                  <div className="routine-field">
                    <label htmlFor="routine-focus">{t('routineBuilder.focusLabel')}</label>
                    <input id="routine-focus" value={focus} onChange={(event) => setFocus(event.target.value)} />
                  </div>
                  <div className="routine-field">
                    <label htmlFor="routine-week">{t('routineBuilder.weekLabel')}</label>
                    <input id="routine-week" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
                  </div>
                  <button className="routine-secondary" type="button" onClick={() => navigate('/onboarding/guiado')}>
                    {t('routineBuilder.guidedStartAction', { defaultValue: 'Prefiro montar por botões' })}
                  </button>
                </div>
              </details>
            </div>
          )}

          {step === 'review' && (
            <>
              <h2>{t('routineBuilder.reviewTitle')}</h2>
              <p>{t('routineBuilder.reviewBody')}</p>
              <div className="routine-review-list">
                {items.map((item) => <RoutineItemCard key={item.id} item={item} labels={kindLabels} onChange={updateItem} />)}
              </div>
              <div className="routine-actions">
                <button className="routine-primary" type="button" disabled={busy || items.every((item) => item.reviewState === 'excluded')} onClick={confirmItems}>
                  {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
                  {t('routineBuilder.confirmItems')}
                </button>
              </div>
            </>
          )}

          {step === 'clarify' && (
            <>
              <h2>{t('routineBuilder.clarifyTitle')}</h2>
              <p>{t('routineBuilder.clarifyBody')}</p>
              {session?.questions.map((question) => (
                <div className="routine-question" key={question.id}>
                  <strong>{question.prompt}</strong>
                  <p>{question.reason}</p>
                  <div className="routine-field">
                    {question.answerType === 'frequency' ? (
                      <select value={answers[question.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}>
                        <option value="">{t('routineBuilder.choose')}</option>
                        {question.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <input type={question.answerType === 'datetime' ? 'datetime-local' : 'text'} value={answers[question.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
                    )}
                  </div>
                </div>
              ))}
              <div className="routine-actions">
                <button className="routine-primary" type="button" disabled={busy || !allAnswersReady} onClick={submitAnswers}>
                  {busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}
                  {t('routineBuilder.continue')}
                </button>
              </div>
            </>
          )}

          {step === 'compose' && (
            <div className="routine-loading">
              <Sparkles size={24} />
              <strong>{t('routineBuilder.composeTitle')}</strong>
              <span>{t('routineBuilder.composeBody')}</span>
              <button className="routine-primary" type="button" disabled={busy} onClick={compose}>
                {busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}
                {t('routineBuilder.composeAction')}
              </button>
            </div>
          )}

          {step === 'preview' && session?.draftPlan && (
            <>
              {(sourceText || file) && (
                <details className="routine-source-recap" open>
                  <summary>
                    <span>{t('routineBuilder.yourPlans', { defaultValue: 'Seus planos' })}</span>
                    <ChevronDown size={17} />
                  </summary>
                  <div>
                    <p>{sourceText || file?.name}</p>
                    <footer>
                      <small>{sourceText.length}/2000</small>
                      <button type="button" onClick={regenerate} disabled={busy}>
                        <Sparkles size={15} /> {t('routineBuilder.regenerate', { defaultValue: 'Gerar de novo' })}
                      </button>
                    </footer>
                  </div>
                </details>
              )}

              <div className="routine-ai-warning">
                <Info size={17} />
                <span>{t('routineBuilder.aiWarning', { defaultValue: 'Revise horários e tarefas importantes antes de salvar.' })}</span>
              </div>

              <section className="routine-proposal-summary">
                <strong>
                  {t('routineBuilder.proposalSummary', {
                    defaultValue: 'Rotina proposta: {{habits}} hábito(s), {{tasks}} tarefa(s) e {{objectives}} meta(s).',
                    ...proposedCounts,
                  })}
                </strong>
                <span>{session.draftPlan.capacity.reason}</span>
              </section>

              <WeekPreview
                plan={session.draftPlan}
                items={session.items}
                appliedSourceItemIds={session.applyResult?.appliedSourceItemIds ?? []}
                savingSourceItemIds={savingSourceItemIds}
                locale={i18n.language === 'en' ? 'en-US' : 'pt-BR'}
                saving={busy}
                onAddCard={(sourceItemId) => applySelected([sourceItemId])}
                onEditItem={reviseRoutineItem}
                onToggleDiscard={(sourceItemId, discarded) => reviseRoutineItem(sourceItemId, { excluded: discarded })}
              />

              <div className="routine-actions routine-actions--final">
                <button className="routine-secondary" type="button" disabled={busy || savingSourceItemIds.size > 0} onClick={() => restart({ keepSource: true })}>
                  <RotateCcw size={16} /> {t('routineBuilder.startAgain', { defaultValue: 'Recomeçar' })}
                </button>
                <button
                  className="routine-primary"
                  type="button"
                  disabled={busy || savingSourceItemIds.size > 0}
                  onClick={() => void applySelected(remainingSourceItemIds.length > 0 ? remainingSourceItemIds : undefined)}
                >
                  {savingSourceItemIds.size > 0 ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
                  {remainingSourceItemIds.length > 0
                    ? t('routineBuilder.acceptAll', { defaultValue: 'Aceitar todos' })
                    : t('routineBuilder.finish', { defaultValue: 'Concluir rotina' })}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="routine-success">
              <div className="routine-success__mark"><Check size={30} /></div>
              <h2>{t('routineBuilder.doneTitle')}</h2>
              <p>{t('routineBuilder.doneBody', session?.applyResult?.counts ?? {})}</p>
              <div className="routine-actions">
                <button className="routine-secondary" type="button" onClick={() => restart()}>
                  <RotateCcw size={16} /> {t('routineBuilder.newRoutine')}
                </button>
                <button className="routine-primary" type="button" onClick={() => navigate('/home')}>
                  {t('routineBuilder.openHome')}
                </button>
              </div>
            </div>
          )}

          {error && <div className="routine-error" role="alert">{error}</div>}
        </section>
      </div>
    </main>
  );
}

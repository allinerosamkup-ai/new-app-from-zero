import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, FileText, ListChecks, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { routineBuilderApi } from '../features/routine-builder/api';
import { nextBuilderStep, shouldRestoreRoutineSession } from '../features/routine-builder/helpers';
import { RoutineItemCard } from '../features/routine-builder/routine-item-card';
import type { RoutineItem, RoutineItemKind, RoutineSession } from '../features/routine-builder/types';
import { WeekPreview } from '../features/routine-builder/week-preview';
import { getClientTimeContext } from '../lib/api';
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

export function RoutineBuilderPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (location.state as { initialSource?: string; focus?: string } | null) ?? {};
  const [session, setSession] = useState<RoutineSession | null>(null);
  const [focus, setFocus] = useState(incoming.focus ?? '');
  const [sourceText, setSourceText] = useState(incoming.initialSource ?? '');
  const [weekStart, setWeekStart] = useState(localMonday());
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = session ? nextBuilderStep(session) : 'source';
  const stepOrder = ['source', 'review', 'clarify', 'compose', 'preview', 'done'];
  const progress = Math.max(1, stepOrder.indexOf(step) + 1);
  const kindLabels = t('routineBuilder.kinds', { returnObjects: true }) as Record<RoutineItemKind, string>;

  useEffect(() => {
    if (!shouldRestoreRoutineSession(incoming)) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return;
    setBusy(true);
    routineBuilderApi.get(sessionId)
      .then((value) => { setSession(value); setItems(value.items ?? []); })
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
    try { onDone(await operation()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : t('common.unexpectedError')); }
    finally { setBusy(false); }
  }

  async function start(): Promise<void> {
    if (!focus.trim() || (!sourceText.trim() && !file)) return;
    await run(async () => {
      const created = await routineBuilderApi.create({
        focus: focus.trim(),
        weekStart,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        locale: i18n.language === 'en' ? 'en-US' : 'pt-BR',
        limits: { wakeTime: '07:00', sleepTime: '23:00', maxDailyLoadMinutes: 360, unavailable: [] },
      });
      localStorage.setItem(SESSION_KEY, created.id);
      return file ? routineBuilderApi.upload(created.id, file) : routineBuilderApi.sendText(created.id, sourceText.trim());
    }, setSession);
  }

  function updateItem(next: RoutineItem): void {
    setItems((current) => current.map((item) => item.id === next.id ? next : item));
  }

  function confirmItems(): void {
    const reviewed = items.map((item) => item.reviewState === 'excluded' ? item : { ...item, reviewState: 'confirmed' as const });
    void run(() => routineBuilderApi.updateItems(session!.id, reviewed), setSession);
  }

  function submitAnswers(): void {
    const payload = (session?.questions ?? []).map((question) => ({ questionId: question.id, answer: answers[question.id] }));
    void run(() => routineBuilderApi.answer(session!.id, payload), setSession);
  }

  function compose(): void {
    void run(() => routineBuilderApi.compose(session!.id), setSession);
  }

  function applyPlan(): void {
    void run(() => routineBuilderApi.apply(session!.id), (result) => {
      setSession({ ...session!, status: 'applied', applyResult: result });
    });
  }

  function restart(): void {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setItems([]);
    setAnswers({});
    setFile(null);
    setError(null);
  }

  return (
    <main className="routine-builder-page">
      <div className="routine-builder-shell">
        <header className="routine-builder-header">
          <button type="button" className="routine-builder-header__back" onClick={() => navigate('/planner')}>
            <ArrowLeft size={16} /> {t('routineBuilder.backPlanner')}
          </button>
          <p className="routine-builder-header__eyebrow">{t('routineBuilder.eyebrow')}</p>
          <h1>{t('routineBuilder.title')}</h1>
          <p>{t('routineBuilder.subtitle')}</p>
          <div className="routine-progress" aria-label={t('routineBuilder.progress')}>
            {[1, 2, 3, 4, 5].map((value) => <span key={value} className={value <= Math.min(progress, 5) ? 'is-active' : ''} />)}
          </div>
        </header>

        <section className="routine-panel" aria-busy={busy}>
          {!session && busy && <p><LoaderCircle size={17} className="spin" /> {t('common.loading')}</p>}

          {step === 'source' && !busy && (
            <>
              <div className="routine-guided-start">
                <div className="routine-guided-start__icon"><ListChecks size={24} /></div>
                <div>
                  <h2>{t('routineBuilder.guidedStartTitle', { defaultValue: 'Monte sua rotina por escolhas simples' })}</h2>
                  <p>{t('routineBuilder.guidedStartBody', { defaultValue: 'A Airia pergunta o que ocupa seus dias, seus horários e o que você quer sustentar. Depois entrega a semana pronta para revisão.' })}</p>
                </div>
                <button className="routine-primary" type="button" onClick={() => navigate('/onboarding/guiado')}>
                  <Sparkles size={17} /> {t('routineBuilder.guidedStartAction', { defaultValue: 'Montar minha rotina' })}
                </button>
              </div>

              <details className="routine-import-option" open={Boolean(incoming.initialSource)}>
                <summary>
                  <span><FileText size={17} /> {t('routineBuilder.importOptional', { defaultValue: 'Já tenho uma rotina ou documento' })}</span>
                  <ChevronDown size={16} />
                </summary>
                <div className="routine-import-option__body">
                  <p>{t('routineBuilder.sourceBody')}</p>
                  <div className="routine-field">
                    <label htmlFor="routine-focus">{t('routineBuilder.focusLabel')}</label>
                    <input id="routine-focus" value={focus} onChange={(event) => setFocus(event.target.value)} placeholder={t('routineBuilder.focusPlaceholder')} />
                  </div>
                  <div className="routine-field">
                    <label htmlFor="routine-week">{t('routineBuilder.weekLabel')}</label>
                    <input id="routine-week" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
                  </div>
                  <div className="routine-field">
                    <label htmlFor="routine-source">{t('routineBuilder.sourceLabel')}</label>
                    <textarea id="routine-source" value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder={t('routineBuilder.sourcePlaceholder')} />
                  </div>
                  <label className="routine-drop">
                    <FileText size={20} />
                    <span>{file ? file.name : t('routineBuilder.fileLabel')}</span>
                    <input type="file" accept={ACCEPTED_FILES} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                  </label>
                  <div className="routine-actions">
                    <button className="routine-secondary" type="button" disabled={!focus.trim() || (!sourceText.trim() && !file)} onClick={() => void start()}>
                      <FileText size={17} /> {t('routineBuilder.readSource')}
                    </button>
                  </div>
                </div>
              </details>
            </>
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
                  {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />} {t('routineBuilder.confirmItems')}
                </button>
              </div>
            </>
          )}

          {step === 'clarify' && (
            <>
              <h2>{t('routineBuilder.clarifyTitle')}</h2>
              <p>{t('routineBuilder.clarifyBody')}</p>
              {(session?.questions ?? []).map((question) => (
                <div className="routine-question" key={question.id}>
                  <strong>{question.prompt}</strong><p>{question.reason}</p>
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
              <div className="routine-actions"><button className="routine-primary" type="button" disabled={busy || !allAnswersReady} onClick={submitAnswers}>{t('routineBuilder.continue')}</button></div>
            </>
          )}

          {step === 'compose' && (
            <>
              <h2>{t('routineBuilder.composeTitle')}</h2>
              <p>{t('routineBuilder.composeBody')}</p>
              <div className="routine-actions"><button className="routine-primary" type="button" disabled={busy} onClick={compose}><Sparkles size={17} /> {t('routineBuilder.composeAction')}</button></div>
            </>
          )}

          {step === 'preview' && session?.draftPlan && (
            <>
              <h2>{t('routineBuilder.previewTitle')}</h2>
              <p>{t('routineBuilder.previewBody')}</p>
              <WeekPreview
                plan={session.draftPlan}
                locale={i18n.language === 'en' ? 'en-US' : 'pt-BR'}
                today={getClientTimeContext().localDate}
              />
              <div className="routine-actions">
                <button className="routine-secondary" type="button" disabled={busy} onClick={() => setSession({ ...session, draftPlan: null, status: 'classified' })}>{t('routineBuilder.backReview')}</button>
                <button className="routine-primary" type="button" disabled={busy} onClick={applyPlan}>{busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />} {t('routineBuilder.apply')}</button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="routine-success">
              <div className="routine-success__mark"><Check size={30} /></div>
              <h2>{t('routineBuilder.doneTitle')}</h2>
              <p>{t('routineBuilder.doneBody', session?.applyResult?.counts ?? {})}</p>
              <div className="routine-actions">
                <button className="routine-secondary" type="button" onClick={restart}><RotateCcw size={16} /> {t('routineBuilder.newRoutine')}</button>
                <button className="routine-primary" type="button" onClick={() => navigate('/planner')}>{t('routineBuilder.openPlanner')}</button>
              </div>
            </div>
          )}

          {error && <div className="routine-error" role="alert">{error}</div>}
        </section>
      </div>
    </main>
  );
}

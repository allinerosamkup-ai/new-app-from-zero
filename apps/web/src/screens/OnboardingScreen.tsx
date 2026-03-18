import React, { useState } from 'react';
import { useNavigation } from '../navigation';
import { useAuthStore } from '../stores/auth_store';
import { apiPost, apiFetch } from '../lib/api';

const QUESTIONS = [
  { id: 'currentFeeling', prompt: 'Como você está se sentindo agora?', placeholder: 'Ex: Cansada mas esperançosa...' },
  { id: 'sleepQuality', prompt: 'Como tem sido seu sono ultimamente?', placeholder: 'Ex: Irregular, acordo no meio da noite...' },
  { id: 'wakeSleep', prompt: 'Qual horário você costuma acordar e dormir?', placeholder: '', input: 'wakeSleep' as const },
  { id: 'routineText', prompt: 'Descreva brevemente sua rotina atual.', placeholder: 'Ex: Trabalho das 9 às 18, academia à noite...' },
  { id: 'mainEnergyPressure', prompt: 'O que mais pesa na sua energia ou no seu dia?', placeholder: 'Ex: Carga de trabalho, insônia...' },
  { id: 'primaryGoal', prompt: 'O que você quer melhorar primeiro com o app?', placeholder: 'Ex: Ter mais energia à tarde...' },
];

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="mb-3 mr-10 rounded-[22px] p-4 animate-fade-in glass-card">
      <p className="text-[14px] leading-[22px]" style={{ color: 'var(--text-primary)' }}>{text}</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="mb-3 ml-10 self-end rounded-[22px] px-4 py-3.5 text-right animate-fade-in" style={{ background: 'var(--bg-dark)' }}>
      <p className="text-[14px] leading-[22px] text-white">{text}</p>
    </div>
  );
}

export default function OnboardingScreen() {
  const { navigate } = useNavigation();
  const { fullName } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [wakeDraft, setWakeDraft] = useState('07:00');
  const [sleepDraft, setSleepDraft] = useState('23:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<{ aiProfileSummary?: string; aiTopThemes?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const question = QUESTIONS[currentIndex];
  const progress = Math.min(currentIndex, QUESTIONS.length);
  const transcript = QUESTIONS.slice(0, currentIndex).map((q) => ({
    question: q.prompt,
    answer: q.input === 'wakeSleep' ? `${answers.wakeTime || '07:00'} / ${answers.sleepTime || '23:00'}` : (answers[q.id] || ''),
  }));

  const handleSubmit = () => {
    if (!question) return;
    if (question.input === 'wakeSleep') {
      setAnswers((prev) => ({ ...prev, wakeTime: wakeDraft, sleepTime: sleepDraft }));
    } else {
      if (!draft.trim()) return;
      setAnswers((prev) => ({ ...prev, [question.id]: draft.trim() }));
    }
    setDraft('');
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCurrentIndex(QUESTIONS.length);
    }
  };

  const handleFinalize = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const wakeTime = answers.wakeTime ?? wakeDraft;
      const sleepTime = answers.sleepTime ?? sleepDraft;

      // Save preferences
      await apiFetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ wakeTime, sleepTime }),
      });

      // Call onboarding AI
      const result = await apiPost<{ aiProfileSummary?: string; aiTopThemes?: string[] }>('/api/onboarding/process', {
        fullName: fullName ?? 'Usuário',
        age: null,
        currentFeeling: answers.currentFeeling ?? '',
        sleepQualityNote: answers.sleepQuality ?? '',
        wakeTime,
        sleepTime,
        routineText: answers.routineText ?? '',
        mainEnergyPressure: answers.mainEnergyPressure ?? '',
        primaryGoal: answers.primaryGoal ?? '',
        supportGoals: [],
      });

      setAiResult(result);
    } catch (e) {
      setError('Erro ao processar perfil. Continuando mesmo assim...');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnterApp = () => {
    navigate('home');
  };

  const done = currentIndex >= QUESTIONS.length;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      <div className="px-5 pt-4 pb-3">
        <p className="text-[11px] uppercase tracking-[3px] font-semibold" style={{ color: 'var(--accent-teal)' }}>
          Onboarding
        </p>
        <h1 className="mt-2 text-[20px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Vamos conhecer sua ciclagem.
        </h1>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(31,59,50,0.08)' }}>
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${(progress / QUESTIONS.length) * 100}%`, background: 'var(--accent-9)' }}
          />
        </div>
        <p className="mt-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {Math.max(progress, 1)}/{QUESTIONS.length}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <AssistantBubble text="Vou te fazer 6 perguntas rápidas para entender sua rotina, sua ciclagem de humor e começar a adaptar o app para você." />

        {transcript.map((item, i) => (
          <div key={i} className="mb-3">
            <AssistantBubble text={item.question} />
            <UserBubble text={item.answer} />
          </div>
        ))}

        {!done && question && <AssistantBubble text={question.prompt} />}

        {done && !aiResult && !isProcessing && (
          <div className="glass-card rounded-[24px] p-5 mt-2 animate-fade-in">
            <h2 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Pronto! Gerando seu perfil...
            </h2>
            <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>
              Nossa IA está analisando suas respostas.
            </p>
            {error && (
              <p className="text-[12px] mt-2" style={{ color: 'var(--accent-rose)' }}>{error}</p>
            )}
            <button
              onClick={handleFinalize}
              disabled={isProcessing}
              className="btn-aura mt-5 w-full rounded-[20px] py-[16px] text-center text-[15px] font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'var(--accent-9)', boxShadow: 'var(--shadow-lg)' }}
            >
              {isProcessing ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analisando...</>
              ) : 'Criar meu perfil →'}
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="glass-card rounded-[24px] p-8 mt-2 flex flex-col items-center animate-fade-in">
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-4"
              style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Analisando sua ciclagem...
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              A IA está personalizando o app para você
            </p>
          </div>
        )}

        {aiResult && (
          <div className="glass-card rounded-[24px] p-5 mt-2 animate-fade-in">
            <h2 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Perfil de ciclagem criado
            </h2>
            {aiResult.aiProfileSummary && (
              <div className="mt-4 glass-card rounded-[18px] p-4">
                <p className="text-[12px] font-bold" style={{ color: 'var(--accent-green)' }}>Resumo da IA</p>
                <p className="mt-2 text-[13px] leading-[20px]" style={{ color: 'var(--text-secondary)' }}>
                  {aiResult.aiProfileSummary}
                </p>
              </div>
            )}
            {aiResult.aiTopThemes && aiResult.aiTopThemes.length > 0 && (
              <div className="mt-3 glass-card rounded-[18px] p-4">
                <p className="text-[12px] font-bold" style={{ color: 'var(--accent-green)' }}>Temas identificados</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {aiResult.aiTopThemes.map((t) => (
                    <span key={t} className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                      style={{ background: 'rgba(31,59,50,0.06)', color: 'var(--text-secondary)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={handleEnterApp}
              className="btn-aura mt-5 w-full rounded-[20px] py-[16px] text-center text-[15px] font-bold text-white transition-all active:scale-[0.98]"
              style={{ background: 'var(--accent-9)', boxShadow: 'var(--shadow-lg)' }}
            >
              Entrar no app →
            </button>
          </div>
        )}
      </div>

      {!done && question && (
        <div className="glass-strong px-5 py-4" style={{ borderTop: '1px solid rgba(31,59,50,0.06)' }}>
          {question.input === 'wakeSleep' ? (
            <div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[2px]" style={{ color: 'var(--text-muted)' }}>
                    Acordar
                  </label>
                  <input
                    value={wakeDraft}
                    onChange={(e) => setWakeDraft(e.target.value)}
                    placeholder="07:00"
                    className="w-full glass-card rounded-[18px] px-4 py-3.5 text-[14px] outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[2px]" style={{ color: 'var(--text-muted)' }}>
                    Dormir
                  </label>
                  <input
                    value={sleepDraft}
                    onChange={(e) => setSleepDraft(e.target.value)}
                    placeholder="23:00"
                    className="w-full glass-card rounded-[18px] px-4 py-3.5 text-[14px] outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={handleSubmit}
                  className="btn-aura rounded-full px-5 py-3.5 font-bold text-white text-[14px] transition-all active:scale-[0.98]"
                  style={{ background: 'var(--accent-9)' }}>
                  Salvar horário
                </button>
              </div>
            </div>
          ) : (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={question.placeholder}
                className="w-full min-h-[80px] glass-card rounded-[20px] px-4 py-3.5 text-[14px] outline-none resize-none"
                style={{ color: 'var(--text-primary)' }}
              />
              <div className="mt-3 flex items-center justify-between">
                {currentIndex > 0 ? (
                  <button onClick={() => setCurrentIndex((i) => i - 1)} className="rounded-full px-4 py-3 font-semibold text-[13px]"
                    style={{ color: 'var(--text-secondary)' }}>
                    Voltar
                  </button>
                ) : <div />}
                <button
                  onClick={handleSubmit}
                  disabled={!draft.trim()}
                  className="btn-aura rounded-full px-5 py-3.5 font-bold text-white text-[14px] transition-all active:scale-[0.98]"
                  style={{ background: !draft.trim() ? 'rgba(31,59,50,0.25)' : 'var(--accent-9)' }}
                >
                  {currentIndex === QUESTIONS.length - 1 ? 'Concluir' : 'Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

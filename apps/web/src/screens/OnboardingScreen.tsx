import React, { useState } from 'react';
import { useNavigation } from '../navigation';

const QUESTIONS = [
  { id: 'currentFeeling', prompt: 'Como você está se sentindo agora?', placeholder: 'Ex: Cansada mas esperançosa...' },
  { id: 'sleepQuality', prompt: 'Como tem sido seu sono ultimamente?', placeholder: 'Ex: Irregular, acordo no meio da noite...' },
  { id: 'wakeSleep', prompt: 'Qual horário você costuma acordar e dormir?', placeholder: '', input: 'wakeSleep' as const },
  { id: 'routineText', prompt: 'Descreva brevemente sua rotina atual.', placeholder: 'Ex: Trabalho das 9 às 18, academia à noite...' },
  { id: 'mainEnergyPressure', prompt: 'O que mais pesa na sua energia ou no seu dia?', placeholder: 'Ex: Carga de trabalho, insônia...' },
  { id: 'primaryGoal', prompt: 'O que você quer melhorar primeiro?', placeholder: 'Ex: Ter mais energia à tarde...' },
];

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="mb-3 mr-10 rounded-[28px] bg-white px-4 py-4">
      <p className="text-base leading-6 text-[#1f1b16]">{text}</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="mb-3 ml-10 self-end rounded-[28px] bg-[#1f3b32] px-4 py-4 text-right">
      <p className="text-base leading-6 text-white">{text}</p>
    </div>
  );
}

export default function OnboardingScreen() {
  const { navigate } = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [wakeDraft, setWakeDraft] = useState('07:00');
  const [sleepDraft, setSleepDraft] = useState('23:00');

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

  const handleFinalize = () => {
    navigate('home');
  };

  const done = currentIndex >= QUESTIONS.length;

  return (
    <div className="flex flex-col h-full bg-[#f5f1ea]">
      <div className="px-6 pt-5 pb-3">
        <p className="text-xs uppercase tracking-[3px] text-[#7d776d] font-medium">Onboarding</p>
        <h1 className="mt-2 text-2xl font-bold text-[#1f1b16]">
          Vamos começar a te conhecer de um jeito simples.
        </h1>
        <div className="mt-4 h-2 rounded-full bg-[#e7dfd2]">
          <div
            className="h-2 rounded-full bg-[#1f3b32] transition-all duration-300"
            style={{ width: `${(progress / QUESTIONS.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-[#6e675d]">
          {Math.max(progress, 1)}/{QUESTIONS.length}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <AssistantBubble text="Vou te fazer 6 perguntas essenciais para entender seu momento, sua rotina e começar a montar sugestões mais úteis para você." />

        {transcript.map((item, i) => (
          <div key={i} className="mb-4">
            <AssistantBubble text={item.question} />
            <UserBubble text={item.answer} />
          </div>
        ))}

        {!done && question && <AssistantBubble text={question.prompt} />}

        {done && (
          <div className="rounded-[28px] bg-white p-5 mt-2">
            <h2 className="text-lg font-bold text-[#1f1b16]">Perfil gerado pela IA</h2>
            <div className="mt-4 rounded-[22px] bg-[#f7f2ea] p-4">
              <p className="text-sm font-bold text-[#1f1b16]">Resumo inicial</p>
              <p className="mt-2 text-[#4c463f] text-sm">
                Você parece estar em um momento de transição, buscando mais equilíbrio entre produtividade e descanso. Sua rotina tem potencial para ajustes que podem melhorar sua energia ao longo do dia.
              </p>
            </div>
            <div className="mt-3 rounded-[22px] bg-[#f7f2ea] p-4">
              <p className="text-sm font-bold text-[#1f1b16]">Temas iniciais</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {['sono', 'energia', 'rotina'].map((t) => (
                  <span key={t} className="rounded-full bg-[#efe7d8] px-3 py-2 text-sm text-[#4c463f]">{t}</span>
                ))}
              </div>
            </div>
            <button
              onClick={handleFinalize}
              className="mt-6 w-full rounded-[24px] bg-[#1f3b32] px-5 py-4 text-center text-base font-bold text-white"
            >
              Entrar no app
            </button>
          </div>
        )}
      </div>

      {!done && question && (
        <div className="border-t border-[#e7dfd2] bg-[#f5f1ea] px-6 py-4">
          {question.input === 'wakeSleep' ? (
            <div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[2px] text-[#7b756c]">Acordar</label>
                  <input
                    value={wakeDraft}
                    onChange={(e) => setWakeDraft(e.target.value)}
                    placeholder="07:00"
                    className="w-full rounded-[20px] bg-white px-4 py-4 text-base text-[#1f1b16] placeholder-[#9b9489] outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[2px] text-[#7b756c]">Dormir</label>
                  <input
                    value={sleepDraft}
                    onChange={(e) => setSleepDraft(e.target.value)}
                    placeholder="23:00"
                    className="w-full rounded-[20px] bg-white px-4 py-4 text-base text-[#1f1b16] placeholder-[#9b9489] outline-none"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={handleSubmit} className="rounded-full bg-[#1f3b32] px-5 py-4 font-bold text-white">
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
                className="w-full min-h-[84px] rounded-[24px] bg-white px-4 py-4 text-base text-[#1f1b16] placeholder-[#9b9489] outline-none resize-none"
              />
              <div className="mt-4 flex items-center justify-between">
                {currentIndex > 0 ? (
                  <button onClick={() => setCurrentIndex((i) => i - 1)} className="rounded-full px-4 py-3 font-semibold text-[#6e675d]">
                    Voltar
                  </button>
                ) : <div />}
                <button
                  onClick={handleSubmit}
                  disabled={!draft.trim()}
                  className={`rounded-full px-5 py-4 font-bold text-white ${
                    !draft.trim() ? 'bg-[#cdd7d2]' : 'bg-[#1f3b32]'
                  }`}
                >
                  {currentIndex === QUESTIONS.length - 1 ? 'Concluir perguntas' : 'Enviar resposta'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

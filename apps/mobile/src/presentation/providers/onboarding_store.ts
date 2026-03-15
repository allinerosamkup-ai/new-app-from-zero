import { create } from 'zustand';

import api from '../../services/api_service';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from './auth_store';

export type OnboardingQuestionId =
  | 'fullName'
  | 'age'
  | 'currentFeeling'
  | 'sleepQualityNote'
  | 'wakeSleep'
  | 'routineText'
  | 'mainEnergyPressure'
  | 'primaryGoal';

export type OnboardingQuestion = {
  id: OnboardingQuestionId;
  prompt: string;
  placeholder: string;
  input: 'text' | 'number' | 'wakeSleep';
};

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'fullName',
    prompt: 'Como você gosta de ser chamada?',
    placeholder: 'Digite o nome que devo usar com você',
    input: 'text',
  },
  {
    id: 'age',
    prompt: 'Quantos anos você tem?',
    placeholder: 'Digite sua idade',
    input: 'number',
  },
  {
    id: 'currentFeeling',
    prompt: 'Como você está se sentindo neste momento?',
    placeholder: 'Conte em poucas palavras como você está agora',
    input: 'text',
  },
  {
    id: 'sleepQualityNote',
    prompt: 'Como tem sido seu sono nos últimos dias?',
    placeholder: 'Ex: sono leve, acordando no meio da noite, dormindo pouco...',
    input: 'text',
  },
  {
    id: 'wakeSleep',
    prompt: 'Que horas você costuma acordar e dormir?',
    placeholder: 'Use os campos de horário abaixo',
    input: 'wakeSleep',
  },
  {
    id: 'routineText',
    prompt: 'Como é a sua rotina hoje?',
    placeholder: 'Ex: trabalho, estudo, casa, filhos, deslocamento, horários...',
    input: 'text',
  },
  {
    id: 'mainEnergyPressure',
    prompt: 'O que mais tem pesado na sua energia ou no seu dia ultimamente?',
    placeholder: 'Conte o que mais vem drenando ou desorganizando você',
    input: 'text',
  },
  {
    id: 'primaryGoal',
    prompt: 'O que você mais gostaria que o app te ajudasse a melhorar primeiro?',
    placeholder: 'Ex: rotina, sono, energia, foco, organização do dia...',
    input: 'text',
  },
];

export const SUPPORT_GOAL_OPTIONS = [
  { id: 'crashes', label: 'Diminuir crashes de energia' },
  { id: 'stability', label: 'Estabilizar o humor' },
  { id: 'routine', label: 'Ter uma rotina mais realista' },
  { id: 'planner', label: 'Organizar melhor o dia' },
];

type OnboardingAiProfile = {
  profileSummary: string;
  routineSummaryNormalized: string;
  initialStateSummary: string;
  topThemes: string[];
  initialSuggestions: string[];
};

type OnboardingAnswers = {
  fullName: string;
  age: string;
  currentFeeling: string;
  sleepQualityNote: string;
  wakeTime: string;
  sleepTime: string;
  routineText: string;
  mainEnergyPressure: string;
  primaryGoal: string;
  supportGoals: string[];
  consents: {
    healthData: boolean;
    aiProcessing: boolean;
  };
};

type OnboardingStage = 'questions' | 'processing' | 'summary';

interface OnboardingState {
  currentQuestionIndex: number;
  stage: OnboardingStage;
  answers: OnboardingAnswers;
  aiProfile: OnboardingAiProfile | null;
  isLoading: boolean;
  error: string | null;
  submitAnswer: (answer: string | { wakeTime: string; sleepTime: string }) => void;
  goBack: () => void;
  toggleSupportGoal: (goalId: string) => void;
  setConsent: (field: 'healthData' | 'aiProcessing', value: boolean) => void;
  completeOnboarding: (userId: string) => Promise<void>;
  finalizeOnboarding: () => Promise<void>;
  reset: () => void;
}

const initialAnswers: OnboardingAnswers = {
  fullName: '',
  age: '',
  currentFeeling: '',
  sleepQualityNote: '',
  wakeTime: '07:00',
  sleepTime: '23:00',
  routineText: '',
  mainEnergyPressure: '',
  primaryGoal: '',
  supportGoals: [],
  consents: {
    healthData: false,
    aiProcessing: false,
  },
};

function parseAge(age: string): number | null {
  const parsed = Number.parseInt(age.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildContextNotes(answers: OnboardingAnswers): string {
  return [
    `Momento atual: ${answers.currentFeeling}`,
    `Sono recente: ${answers.sleepQualityNote}`,
    `Pressão principal: ${answers.mainEnergyPressure}`,
    `Objetivo inicial: ${answers.primaryGoal}`,
  ].join(' | ');
}

function buildRawRoutineSummary(answers: OnboardingAnswers): string {
  return `Costuma acordar por volta de ${answers.wakeTime} e dormir por volta de ${answers.sleepTime}.`;
}

let pendingFinalizeUserId: string | null = null;

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentQuestionIndex: 0,
  stage: 'questions',
  answers: initialAnswers,
  aiProfile: null,
  isLoading: false,
  error: null,

  submitAnswer(answer) {
    const question = ONBOARDING_QUESTIONS[get().currentQuestionIndex];

    if (!question) {
      return;
    }

    set((state) => {
      const nextAnswers = { ...state.answers };

      if (question.id === 'wakeSleep' && typeof answer !== 'string') {
        nextAnswers.wakeTime = answer.wakeTime;
        nextAnswers.sleepTime = answer.sleepTime;
      } else if (typeof answer === 'string') {
        nextAnswers[question.id as keyof Pick<
          OnboardingAnswers,
          'fullName' | 'age' | 'currentFeeling' | 'sleepQualityNote' | 'routineText' | 'mainEnergyPressure' | 'primaryGoal'
        >] = answer as never;
      }

      return {
        answers: nextAnswers,
        currentQuestionIndex: Math.min(state.currentQuestionIndex + 1, ONBOARDING_QUESTIONS.length),
        error: null,
      };
    });
  },

  goBack() {
    set((state) => ({
      currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
      error: null,
    }));
  },

  toggleSupportGoal(goalId) {
    set((state) => {
      const exists = state.answers.supportGoals.includes(goalId);

      return {
        answers: {
          ...state.answers,
          supportGoals: exists
            ? state.answers.supportGoals.filter((goal) => goal !== goalId)
            : [...state.answers.supportGoals, goalId],
        },
      };
    });
  },

  setConsent(field, value) {
    set((state) => ({
      answers: {
        ...state.answers,
        consents: {
          ...state.answers.consents,
          [field]: value,
        },
      },
    }));
  },

  async completeOnboarding(userId) {
    const { answers, currentQuestionIndex } = get();

    if (currentQuestionIndex < ONBOARDING_QUESTIONS.length) {
      set({ error: 'Responda todas as perguntas antes de continuar.' });
      return;
    }

    if (!answers.consents.aiProcessing) {
      set({ error: 'Ative o consentimento de IA para concluir o onboarding.' });
      return;
    }

    set({ isLoading: true, stage: 'processing', error: null });

    try {
      const rawRoutineSummary = buildRawRoutineSummary(answers);
      const age = parseAge(answers.age);

      const [rawResult, preferenceResult, consentResult, profileResult] = await Promise.all([
        supabase.from('onboarding_responses').upsert(
          {
            user_id: userId,
            support_goals: answers.supportGoals,
            age,
            current_feeling: answers.currentFeeling,
            sleep_quality_note: answers.sleepQualityNote,
            routine_text: answers.routineText,
            routine_summary: rawRoutineSummary,
            main_energy_pressure: answers.mainEnergyPressure,
            primary_goal: answers.primaryGoal,
            context_notes: buildContextNotes(answers),
            version: 'v1',
          },
          { onConflict: 'user_id' },
        ),
        supabase.from('user_preferences').upsert(
          {
            user_id: userId,
            wake_time: answers.wakeTime,
            sleep_time: answers.sleepTime,
          },
          { onConflict: 'user_id' },
        ),
        supabase.from('consents').upsert(
          [
            {
              user_id: userId,
              consent_type: 'health_data',
              granted: answers.consents.healthData,
              version: 'v1',
              granted_at: answers.consents.healthData ? new Date().toISOString() : null,
              revoked_at: answers.consents.healthData ? null : new Date().toISOString(),
            },
            {
              user_id: userId,
              consent_type: 'ai_processing',
              granted: answers.consents.aiProcessing,
              version: 'v1',
              granted_at: answers.consents.aiProcessing ? new Date().toISOString() : null,
              revoked_at: answers.consents.aiProcessing ? null : new Date().toISOString(),
            },
          ],
          { onConflict: 'user_id,consent_type,version' },
        ),
        supabase.from('profiles').update({ full_name: answers.fullName }).eq('id', userId),
      ]);

      const rawError =
        rawResult.error ??
        preferenceResult.error ??
        consentResult.error ??
        profileResult.error;

      if (rawError) {
        throw rawError;
      }

      const aiResponse = await api.post<OnboardingAiProfile>('/api/onboarding/process', {
        fullName: answers.fullName,
        age,
        currentFeeling: answers.currentFeeling,
        sleepQualityNote: answers.sleepQualityNote,
        wakeTime: answers.wakeTime,
        sleepTime: answers.sleepTime,
        routineText: answers.routineText,
        mainEnergyPressure: answers.mainEnergyPressure,
        primaryGoal: answers.primaryGoal,
        supportGoals: answers.supportGoals,
      });

      const aiProfile = aiResponse.data;

      const aiSaveResult = await supabase.from('onboarding_responses').upsert(
        {
          user_id: userId,
          support_goals: answers.supportGoals,
          age,
          current_feeling: answers.currentFeeling,
          sleep_quality_note: answers.sleepQualityNote,
          routine_text: answers.routineText,
          routine_summary: aiProfile.routineSummaryNormalized,
          main_energy_pressure: answers.mainEnergyPressure,
          primary_goal: answers.primaryGoal,
          context_notes: buildContextNotes(answers),
          ai_profile_summary: aiProfile.profileSummary,
          ai_routine_summary: aiProfile.routineSummaryNormalized,
          ai_initial_state_summary: aiProfile.initialStateSummary,
          ai_top_themes: aiProfile.topThemes,
          ai_initial_suggestions: aiProfile.initialSuggestions,
          ai_profile_payload: aiProfile,
          version: 'v1',
        },
        { onConflict: 'user_id' },
      );

      if (aiSaveResult.error) {
        throw aiSaveResult.error;
      }

      pendingFinalizeUserId = userId;

      set({
        aiProfile,
        isLoading: false,
        stage: 'summary',
      });
    } catch (err: any) {
      set({
        isLoading: false,
        stage: 'questions',
        error: err.message || 'Falha ao concluir onboarding.',
      });
    }
  },

  async finalizeOnboarding() {
    if (!pendingFinalizeUserId) {
      set({ error: 'Perfil inicial ainda não foi preparado.' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await supabase
        .from('profiles')
        .update({ onboarding_done: true })
        .eq('id', pendingFinalizeUserId);

      if (result.error) {
        throw result.error;
      }

      await useAuthStore.getState().refresh();
      pendingFinalizeUserId = null;

      set({ isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Falha ao finalizar onboarding.',
      });
    }
  },

  reset() {
    pendingFinalizeUserId = null;
    set({
      currentQuestionIndex: 0,
      stage: 'questions',
      answers: initialAnswers,
      aiProfile: null,
      isLoading: false,
      error: null,
    });
  },
}));

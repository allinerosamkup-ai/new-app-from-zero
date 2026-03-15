import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuthStore } from '../providers/auth_store';
import {
  ONBOARDING_QUESTIONS,
  SUPPORT_GOAL_OPTIONS,
  useOnboardingStore,
} from '../providers/onboarding_store';

function getCurrentDraft(questionId: string | undefined, answers: ReturnType<typeof useOnboardingStore.getState>['answers']) {
  if (!questionId) {
    return { text: '', wakeTime: answers.wakeTime, sleepTime: answers.sleepTime };
  }

  if (questionId === 'wakeSleep') {
    return {
      text: '',
      wakeTime: answers.wakeTime,
      sleepTime: answers.sleepTime,
    };
  }

  return {
    text: String(answers[questionId as keyof typeof answers] ?? ''),
    wakeTime: answers.wakeTime,
    sleepTime: answers.sleepTime,
  };
}

export default function OnboardingChatScreen() {
  const {
    currentQuestionIndex,
    stage,
    answers,
    aiProfile,
    isLoading,
    error,
    submitAnswer,
    goBack,
    toggleSupportGoal,
    setConsent,
    completeOnboarding,
    finalizeOnboarding,
  } = useOnboardingStore();
  const { userId } = useAuthStore();

  const currentQuestion = ONBOARDING_QUESTIONS[currentQuestionIndex];
  const [textDraft, setTextDraft] = useState('');
  const [wakeTimeDraft, setWakeTimeDraft] = useState(answers.wakeTime);
  const [sleepTimeDraft, setSleepTimeDraft] = useState(answers.sleepTime);

  useEffect(() => {
    const draft = getCurrentDraft(currentQuestion?.id, answers);
    setTextDraft(draft.text);
    setWakeTimeDraft(draft.wakeTime);
    setSleepTimeDraft(draft.sleepTime);
  }, [currentQuestion?.id, answers]);

  const transcript = useMemo(() => {
    return ONBOARDING_QUESTIONS.map((question, index) => {
      if (index >= currentQuestionIndex) {
        return null;
      }

      if (question.id === 'wakeSleep') {
        return {
          question: question.prompt,
          answer: `${answers.wakeTime} / ${answers.sleepTime}`,
        };
      }

      const value = answers[question.id as keyof typeof answers];

      return {
        question: question.prompt,
        answer: String(value ?? ''),
      };
    }).filter(Boolean) as Array<{ question: string; answer: string }>;
  }, [answers, currentQuestionIndex]);

  const progress = Math.min(currentQuestionIndex, ONBOARDING_QUESTIONS.length);

  const handleSubmit = () => {
    if (!currentQuestion || isLoading) {
      return;
    }

    if (currentQuestion.input === 'wakeSleep') {
      if (!wakeTimeDraft.trim() || !sleepTimeDraft.trim()) {
        return;
      }

      submitAnswer({
        wakeTime: wakeTimeDraft.trim(),
        sleepTime: sleepTimeDraft.trim(),
      });
      return;
    }

    if (!textDraft.trim()) {
      return;
    }

    submitAnswer(textDraft.trim());
  };

  const handleGenerateProfile = async () => {
    if (!userId) {
      return;
    }

    await completeOnboarding(userId);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f5f1ea]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="px-6 pt-5 pb-3">
          <Text className="text-xs uppercase tracking-[3px] text-[#7d776d]">Onboarding</Text>
          <Text className="mt-2 text-3xl font-bold text-[#1f1b16]">
            Vamos começar a te conhecer de um jeito simples.
          </Text>
          <View className="mt-4 h-2 rounded-full bg-[#e7dfd2]">
            <View
              className="h-2 rounded-full bg-[#1f3b32]"
              style={{ width: `${(progress / ONBOARDING_QUESTIONS.length) * 100}%` }}
            />
          </View>
          <Text className="mt-2 text-sm text-[#6e675d]">
            {Math.max(progress, 1)}/{ONBOARDING_QUESTIONS.length}
          </Text>
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 24 }}>
          <AssistantBubble text="Vou te fazer 8 perguntas essenciais para entender seu momento, sua rotina e começar a montar sugestões mais úteis para você." />

          {transcript.map((item, index) => (
            <View key={`${index}-${item.question}`} className="mb-4">
              <AssistantBubble text={item.question} />
              <UserBubble text={item.answer} />
            </View>
          ))}

          {stage === 'questions' && currentQuestion && (
            <AssistantBubble text={currentQuestion.prompt} />
          )}

          {stage === 'questions' && !currentQuestion && (
            <View className="rounded-[28px] bg-white p-5">
              <Text className="text-lg font-bold text-[#1f1b16]">Último passo antes de começar</Text>
              <Text className="mt-2 text-[#6e675d]">
                Se quiser, escolha metas rápidas para eu considerar desde o início e confirme os consentimentos necessários.
              </Text>

              <View className="mt-5 flex-row flex-wrap">
                {SUPPORT_GOAL_OPTIONS.map((goal) => {
                  const active = answers.supportGoals.includes(goal.id);
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      onPress={() => toggleSupportGoal(goal.id)}
                      className={`mr-2 mb-2 rounded-full px-4 py-3 ${
                        active ? 'bg-[#1f3b32]' : 'bg-[#efe7d8]'
                      }`}
                    >
                      <Text className={`${active ? 'text-white' : 'text-[#4c463f]'} font-semibold`}>
                        {goal.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ConsentRow
                label="Autorizo o armazenamento dos meus dados de humor e saúde."
                value={answers.consents.healthData}
                onToggle={(value) => setConsent('healthData', value)}
              />
              <ConsentRow
                label="Autorizo o processamento dos meus relatos pela IA para gerar insights."
                value={answers.consents.aiProcessing}
                onToggle={(value) => setConsent('aiProcessing', value)}
              />

              <TouchableOpacity
                onPress={() => void handleGenerateProfile()}
                disabled={isLoading}
                className={`mt-5 rounded-[24px] px-5 py-4 ${isLoading ? 'bg-[#80958c]' : 'bg-[#1f3b32]'}`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center text-base font-bold text-white">
                    Gerar meu perfil inicial
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {stage === 'processing' && (
            <View className="items-center rounded-[28px] bg-white p-8">
              <ActivityIndicator size="large" color="#1f3b32" />
              <Text className="mt-4 text-center text-lg font-bold text-[#1f1b16]">
                Processando seu perfil inicial
              </Text>
              <Text className="mt-2 text-center text-[#6e675d]">
                Estou cruzando sono, rotina, estado atual e prioridades para começar as sugestões.
              </Text>
            </View>
          )}

          {stage === 'summary' && aiProfile && (
            <View className="rounded-[28px] bg-white p-5">
              <Text className="text-xs uppercase tracking-[3px] text-[#7d776d]">Perfil inicial</Text>
              <Text className="mt-3 text-2xl font-bold text-[#1f1b16]">
                Já tenho uma primeira leitura do seu momento.
              </Text>

              <SummaryCard title="Resumo inicial" body={aiProfile.profileSummary} />
              <SummaryCard title="Rotina percebida" body={aiProfile.routineSummaryNormalized} />
              <SummaryCard title="Momento atual" body={aiProfile.initialStateSummary} />

              <View className="mt-4">
                <Text className="text-sm font-bold text-[#1f1b16]">Temas iniciais</Text>
                <View className="mt-2 flex-row flex-wrap">
                  {aiProfile.topThemes.map((theme) => (
                    <View key={theme} className="mr-2 mb-2 rounded-full bg-[#efe7d8] px-3 py-2">
                      <Text className="text-[#4c463f]">{theme}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="mt-4">
                <Text className="text-sm font-bold text-[#1f1b16]">Primeiras sugestões</Text>
                {aiProfile.initialSuggestions.map((suggestion) => (
                  <Text key={suggestion} className="mt-2 text-[#4c463f]">
                    • {suggestion}
                  </Text>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => void finalizeOnboarding()}
                disabled={isLoading}
                className={`mt-6 rounded-[24px] px-5 py-4 ${isLoading ? 'bg-[#80958c]' : 'bg-[#1f3b32]'}`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center text-base font-bold text-white">
                    Entrar no app
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {error ? (
            <Text className="mt-4 rounded-2xl bg-[#ffe7e4] px-4 py-3 text-[#9d2c2c]">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        {stage === 'questions' && currentQuestion ? (
          <View className="border-t border-[#e7dfd2] bg-[#f5f1ea] px-6 py-4">
            {currentQuestion.input === 'wakeSleep' ? (
              <View>
                <View className="flex-row">
                  <TimeField
                    label="Acordar"
                    value={wakeTimeDraft}
                    onChangeText={setWakeTimeDraft}
                  />
                  <View className="w-3" />
                  <TimeField
                    label="Dormir"
                    value={sleepTimeDraft}
                    onChangeText={setSleepTimeDraft}
                  />
                </View>
                <FooterActions
                  showBack={currentQuestionIndex > 0}
                  onBack={goBack}
                  onSubmit={handleSubmit}
                  submitLabel="Salvar horário"
                  disabled={isLoading || !wakeTimeDraft.trim() || !sleepTimeDraft.trim()}
                />
              </View>
            ) : (
              <View>
                <TextInput
                  value={textDraft}
                  onChangeText={setTextDraft}
                  placeholder={currentQuestion.placeholder}
                  placeholderTextColor="#9b9489"
                  keyboardType={currentQuestion.input === 'number' ? 'number-pad' : 'default'}
                  multiline={currentQuestion.input === 'text'}
                  className="min-h-[84px] rounded-[24px] bg-white px-4 py-4 text-base text-[#1f1b16]"
                />

                {currentQuestion.id === 'primaryGoal' && (
                  <View className="mt-3 flex-row flex-wrap">
                    {SUPPORT_GOAL_OPTIONS.map((goal) => {
                      const active = answers.supportGoals.includes(goal.id);
                      return (
                        <TouchableOpacity
                          key={goal.id}
                          onPress={() => toggleSupportGoal(goal.id)}
                          className={`mr-2 mb-2 rounded-full px-4 py-2 ${
                            active ? 'bg-[#1f3b32]' : 'bg-[#efe7d8]'
                          }`}
                        >
                          <Text className={`${active ? 'text-white' : 'text-[#4c463f]'} font-semibold`}>
                            {goal.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <FooterActions
                  showBack={currentQuestionIndex > 0}
                  onBack={goBack}
                  onSubmit={handleSubmit}
                  submitLabel={currentQuestionIndex === ONBOARDING_QUESTIONS.length - 1 ? 'Concluir perguntas' : 'Enviar resposta'}
                  disabled={isLoading || !textDraft.trim()}
                />
              </View>
            )}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <View className="mb-3 mr-10 rounded-[28px] bg-white px-4 py-4">
      <Text className="text-base leading-6 text-[#1f1b16]">{text}</Text>
    </View>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View className="mb-3 ml-10 self-end rounded-[28px] bg-[#1f3b32] px-4 py-4">
      <Text className="text-base leading-6 text-white">{text}</Text>
    </View>
  );
}

function FooterActions({
  showBack,
  onBack,
  onSubmit,
  submitLabel,
  disabled,
}: {
  showBack: boolean;
  onBack: () => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled: boolean;
}) {
  return (
    <View className="mt-4 flex-row items-center justify-between">
      {showBack ? (
        <TouchableOpacity onPress={onBack} className="rounded-full px-4 py-3">
          <Text className="font-semibold text-[#6e675d]">Voltar</Text>
        </TouchableOpacity>
      ) : (
        <View />
      )}

      <TouchableOpacity
        onPress={onSubmit}
        disabled={disabled}
        className={`rounded-full px-5 py-4 ${disabled ? 'bg-[#cdd7d2]' : 'bg-[#1f3b32]'}`}
      >
        <Text className="font-bold text-white">{submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function TimeField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View className="flex-1">
      <Text className="mb-2 text-xs font-bold uppercase tracking-[2px] text-[#7b756c]">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="07:00"
        placeholderTextColor="#9b9489"
        className="rounded-[20px] bg-white px-4 py-4 text-base text-[#1f1b16]"
      />
    </View>
  );
}

function ConsentRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <TouchableOpacity onPress={() => onToggle(!value)} className="mt-4 flex-row items-center">
      <View className={`mr-3 h-6 w-6 rounded-md border-2 ${value ? 'border-[#1f3b32] bg-[#1f3b32]' : 'border-[#b6aea2]'}`}>
        {value ? <Text className="text-center text-xs text-white">✓</Text> : null}
      </View>
      <Text className="flex-1 text-[#4c463f]">{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryCard({ title, body }: { title: string; body: string }) {
  return (
    <View className="mt-4 rounded-[22px] bg-[#f7f2ea] p-4">
      <Text className="text-sm font-bold text-[#1f1b16]">{title}</Text>
      <Text className="mt-2 text-[#4c463f]">{body}</Text>
    </View>
  );
}

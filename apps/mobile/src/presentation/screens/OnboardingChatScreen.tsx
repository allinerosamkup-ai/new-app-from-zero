import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  View,
} from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  Card,
  ProgressBar, 
  Surface, 
  Avatar, 
  Chip, 
  Checkbox,
  ActivityIndicator,
  MD3Colors,
  IconButton
} from 'react-native-paper';
import { useAuthStore } from '../providers/auth_store';
import {
  ONBOARDING_QUESTIONS,
  SUPPORT_GOAL_OPTIONS,
  useOnboardingStore,
} from '../providers/onboarding_store';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

function getCurrentDraft(questionId: string | undefined, answers: ReturnType<typeof useOnboardingStore.getState>['answers']) {
  if (!questionId) return { text: '', wakeTime: answers.wakeTime, sleepTime: answers.sleepTime };
  if (questionId === 'wakeSleep') return { text: '', wakeTime: answers.wakeTime, sleepTime: answers.sleepTime };
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
      if (index >= currentQuestionIndex) return null;
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
    if (!currentQuestion || isLoading) return;
    if (currentQuestion.input === 'wakeSleep') {
      if (!wakeTimeDraft.trim() || !sleepTimeDraft.trim()) return;
      submitAnswer({ wakeTime: wakeTimeDraft.trim(), sleepTime: sleepTimeDraft.trim() });
      return;
    }
    if (!textDraft.trim()) return;
    submitAnswer(textDraft.trim());
  };

  const handleGenerateProfile = async () => {
    if (!userId) return;
    await completeOnboarding(userId);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ padding: appSpacing.lg }}>
          <Text variant="labelSmall" style={{ letterSpacing: 3, textTransform: 'uppercase', color: appColors.textSecondary }}>ONBOARDING</Text>
          <Text variant="headlineSmall" style={{ fontWeight: '800', marginTop: 8, color: appColors.textPrimary }}>
            Vamos começar a te conhecer de um jeito simples.
          </Text>
          <ProgressBar 
            progress={progress / ONBOARDING_QUESTIONS.length} 
            color={appColors.primary} 
            style={{ marginTop: 16, height: 8, borderRadius: 4 }} 
          />
          <Text variant="labelSmall" style={{ marginTop: 8, textAlign: 'right', color: appColors.textSecondary }}>
            {Math.max(progress, 1)}/{ONBOARDING_QUESTIONS.length}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: appSpacing.lg, paddingBottom: 40 }}>
          <AssistantBubble text="Vou te fazer 8 perguntas essenciais para entender seu momento, sua rotina e começar a montar sugestões mais úteis para você." />

          {transcript.map((item, index) => (
            <View key={`${index}-${item.question}`}>
              <AssistantBubble text={item.question} />
              <UserBubble text={item.answer} />
            </View>
          ))}

          {stage === 'questions' && currentQuestion && (
            <AssistantBubble text={currentQuestion.prompt} />
          )}

          {stage === 'questions' && !currentQuestion && (
            <Card style={{ borderRadius: 28, backgroundColor: appColors.surface }} mode="outlined">
              <Card.Content>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>Último passo antes de começar</Text>
                <Text variant="bodySmall" style={{ color: appColors.textSecondary, marginTop: 8 }}>
                  Se quiser, escolha metas rápidas para eu considerar desde o início e confirme os consentimentos necessários.
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  {SUPPORT_GOAL_OPTIONS.map((goal) => (
                    <Chip
                      key={goal.id}
                      selected={answers.supportGoals.includes(goal.id)}
                      onPress={() => toggleSupportGoal(goal.id)}
                      mode="outlined"
                    >
                      {goal.label}
                    </Chip>
                  ))}
                </View>

                <ConsentRow
                  label="Autorizo o armazenamento dos meus dados de humor e saúde."
                  value={answers.consents.healthData}
                  onToggle={(value) => setConsent('healthData', value)}
                />
                <ConsentRow
                  label="Autorizo o processamento pela IA."
                  value={answers.consents.aiProcessing}
                  onToggle={(value) => setConsent('aiProcessing', value)}
                />

                <Button
                  mode="contained"
                  onPress={() => void handleGenerateProfile()}
                  loading={isLoading}
                  disabled={isLoading}
                  style={{ marginTop: 24, borderRadius: appRadius.md }}
                >
                  Gerar meu perfil inicial
                </Button>
              </Card.Content>
            </Card>
          )}

          {stage === 'processing' && (
            <Surface style={{ padding: 40, borderRadius: 28, alignItems: 'center', backgroundColor: appColors.surface }} elevation={1}>
              <ActivityIndicator animating size="large" color={appColors.primary} />
              <Text variant="titleMedium" style={{ fontWeight: '700', marginTop: 16 }}>
                Processando seu perfil inicial
              </Text>
              <Text variant="bodySmall" style={{ textAlign: 'center', color: appColors.textSecondary, marginTop: 8 }}>
                Estou cruzando sono, rotina, estado atual e prioridades para começar as sugestões.
              </Text>
            </Surface>
          )}

          {stage === 'summary' && aiProfile && (
            <Card style={{ borderRadius: 28, backgroundColor: appColors.surface }} mode="outlined">
              <Card.Content>
                <Text variant="labelSmall" style={{ letterSpacing: 2, textTransform: 'uppercase', color: appColors.textSecondary }}>PERFIL INICIAL</Text>
                <Text variant="titleLarge" style={{ fontWeight: '700', marginTop: 8 }}>
                  Já tenho uma primeira leitura do seu momento.
                </Text>

                <SummarySection title="Resumo inicial" body={aiProfile.profileSummary} />
                <SummarySection title="Rotina percebida" body={aiProfile.routineSummaryNormalized} />

                <View style={{ marginTop: 16 }}>
                  <Text variant="labelLarge" style={{ fontWeight: '700' }}>Temas iniciais</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {aiProfile.topThemes.map((theme) => (
                      <Chip key={theme} mode="flat" style={{ backgroundColor: appColors.primarySoft }}>{theme}</Chip>
                    ))}
                  </View>
                </View>

                <Button
                  mode="contained"
                  onPress={() => void finalizeOnboarding()}
                  loading={isLoading}
                  disabled={isLoading}
                  style={{ marginTop: 24, borderRadius: appRadius.md }}
                >
                  Entrar no app
                </Button>
              </Card.Content>
            </Card>
          )}

          {error && (
            <Text style={{ color: MD3Colors.error50, marginTop: 16, textAlign: 'center' }}>{error}</Text>
          )}
        </ScrollView>

        {stage === 'questions' && currentQuestion ? (
          <Surface style={{ padding: appSpacing.lg, borderTopWidth: 1, borderColor: appColors.borderSubtle, backgroundColor: appColors.surface }} elevation={4}>
            {currentQuestion.input === 'wakeSleep' ? (
              <View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TextInput
                    label="Acordar"
                    mode="outlined"
                    value={wakeTimeDraft}
                    onChangeText={setWakeTimeDraft}
                    style={{ flex: 1 }}
                    placeholder="07:00"
                  />
                  <TextInput
                    label="Dormir"
                    mode="outlined"
                    value={sleepTimeDraft}
                    onChangeText={setSleepTimeDraft}
                    style={{ flex: 1 }}
                    placeholder="23:00"
                  />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  {currentQuestionIndex > 0 ? <Button onPress={goBack}>Voltar</Button> : <View />}
                  <Button mode="contained" onPress={handleSubmit} disabled={!wakeTimeDraft.trim() || !sleepTimeDraft.trim()}>Salvar horário</Button>
                </View>
              </View>
            ) : (
              <View>
                <TextInput
                  label={currentQuestion.prompt}
                  mode="outlined"
                  value={textDraft}
                  onChangeText={setTextDraft}
                  placeholder={currentQuestion.placeholder}
                  keyboardType={currentQuestion.input === 'number' ? 'number-pad' : 'default'}
                  multiline={currentQuestion.input === 'text'}
                  style={{ maxHeight: 120 }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  {currentQuestionIndex > 0 ? <Button onPress={goBack}>Voltar</Button> : <View />}
                  <Button mode="contained" onPress={handleSubmit} disabled={!textDraft.trim()}>
                    {currentQuestionIndex === ONBOARDING_QUESTIONS.length - 1 ? 'Concluir' : 'Enviar'}
                  </Button>
                </View>
              </View>
            )}
          </Surface>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <View style={{ marginBottom: 12, marginRight: 40, alignSelf: 'flex-start' }}>
      <Surface style={{ padding: 16, borderRadius: 20, borderBottomLeftRadius: 4, backgroundColor: 'white' }} elevation={1}>
        <Text variant="bodyMedium" style={{ lineHeight: 22 }}>{text}</Text>
      </Surface>
    </View>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View style={{ marginBottom: 12, marginLeft: 40, alignSelf: 'flex-end' }}>
      <Surface style={{ padding: 16, borderRadius: 20, borderBottomRightRadius: 4, backgroundColor: appColors.primary }} elevation={1}>
        <Text variant="bodyMedium" style={{ color: '#0b1120', fontWeight: '600' }}>{text}</Text>
      </Surface>
    </View>
  );
}

function ConsentRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
      <Checkbox status={value ? 'checked' : 'unchecked'} onPress={() => onToggle(!value)} />
      <Text variant="bodySmall" style={{ flex: 1, color: appColors.textSecondary }} onPress={() => onToggle(!value)}>{label}</Text>
    </View>
  );
}

function SummarySection({ title, body }: { title: string; body: string }) {
  return (
    <Surface style={{ marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: MD3Colors.neutralVariant95 }} mode="flat">
      <Text variant="labelLarge" style={{ fontWeight: '700', marginBottom: 4 }}>{title}</Text>
      <Text variant="bodySmall" style={{ color: appColors.textSecondary }}>{body}</Text>
    </Surface>
  );
}

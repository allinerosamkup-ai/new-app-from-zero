import React, { useState } from 'react';
import { View, ScrollView, Image, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Text,
  Card,
  Button,
  TextInput,
  TouchableRipple
} from 'react-native-paper';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useCheckinStore } from '../providers/checkin_store';
import { useAuthStore } from '../providers/auth_store';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';
import { MenstrualCycleWidget } from '../components/MenstrualCycleWidget';
import { MenstrualPhase, PhysicalSymptom } from '../../domain/entities/checkin';

// Fluent Emoji 3D — Microsoft open source (MIT)
const FLUENT_EMOJI_3D: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Crying%20face/3D/crying_face_3d.png',
  2: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Slightly%20frowning%20face/3D/slightly_frowning_face_3d.png',
  3: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Neutral%20face/3D/neutral_face_3d.png',
  4: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Slightly%20smiling%20face/3D/slightly_smiling_face_3d.png',
  5: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Beaming%20face%20with%20smiling%20eyes/3D/beaming_face_with_smiling_eyes_3d.png',
  6: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Neutral%20face/3D/neutral_face_3d.png',
  7: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Slightly%20smiling%20face/3D/slightly_smiling_face_3d.png',
  8: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Slightly%20smiling%20face/3D/slightly_smiling_face_3d.png',
  9: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Beaming%20face%20with%20smiling%20eyes/3D/beaming_face_with_smiling_eyes_3d.png',
  10: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Beaming%20face%20with%20smiling%20eyes/3D/beaming_face_with_smiling_eyes_3d.png',
};

/**
 * CheckinScreen: Formulário de estado diário com UI do Paper.
 */
export default function CheckinScreen() {
  const navigation = useNavigation<any>();
  const { isLoading, submitCheckin, error } = useCheckinStore();
  const { userId } = useAuthStore();

  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [clarity, setClarity] = useState<number | null>(null);
  const [irritability, setIrritability] = useState<number | null>(null);
  const [note, setNote] = useState('');

  // Estados Saúde Feminina
  const [menstrualPhase, setMenstrualPhase] = useState<MenstrualPhase | undefined>();
  const [selectedSymptoms, setSelectedSymptoms] = useState<PhysicalSymptom[]>([]);
  // Fluxo
  const [isFlowing, setIsFlowing] = useState<boolean | undefined>();
  const [flowDay, setFlowDay] = useState<number | undefined>();
  const [flowIntensity, setFlowIntensity] = useState<import('../../domain/entities/checkin').FlowIntensity | undefined>();
  const [symptomLevels, setSymptomLevels] = useState<Partial<Record<import('../../domain/entities/checkin').GradedSymptom, import('../../domain/entities/checkin').SymptomLevel>>>({});

  function handleSymptomLevel(symptom: import('../../domain/entities/checkin').GradedSymptom, level: import('../../domain/entities/checkin').SymptomLevel) {
    setSymptomLevels(prev => ({ ...prev, [symptom]: level }));
  }

  const toggleSymptom = (symptom: PhysicalSymptom) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSubmit = async () => {
    if (!userId) return;

    await submitCheckin({
      userId,
      localDate: new Date().toISOString().split('T')[0],
      moodScore: mood,
      energyScore: energy,
      ...(clarity !== null ? { clarityScore: clarity } : {}),
      ...(irritability !== null ? { irritabilityScore: irritability } : {}),
      note,
      // Novos campos
      menstrualPhase,
      physicalSymptoms: selectedSymptoms,
      isFlowing,
      flowDay,
      flowIntensity,
      symptomLevels,
    });

    if (!useCheckinStore.getState().error) {
      navigation.navigate('CheckInResult');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: appColors.background }} contentContainerStyle={{ padding: appSpacing.lg, paddingBottom: 40 }}>
      <Text variant="headlineSmall" style={{ fontWeight: '700', textAlign: 'center', marginBottom: appSpacing.xl, color: appColors.textPrimary }}>
        Como você está hoje?
      </Text>

      <MoodSelector value={mood} onSelect={setMood} />

      <MenstrualCycleWidget
        phase={menstrualPhase}
        onPhaseSelect={setMenstrualPhase}
        selectedSymptoms={selectedSymptoms}
        onToggleSymptom={toggleSymptom}
        isFlowing={isFlowing}
        onFlowingChange={setIsFlowing}
        flowDay={flowDay}
        onFlowDayChange={setFlowDay}
        flowIntensity={flowIntensity}
        onFlowIntensityChange={setFlowIntensity}
        symptomLevels={symptomLevels}
        onSymptomLevelChange={handleSymptomLevel}
      />

      <Card style={{ marginBottom: appSpacing.lg, backgroundColor: appColors.surface }} mode="outlined">
        <Card.Content>
          <ScoreSelector 
            label="Como está seu nível de energia?" 
            value={energy} 
            onSelect={(value) => { if (value !== null) setEnergy(value); }}
          />
          
          <View style={{ height: 1, backgroundColor: appColors.borderSubtle, marginVertical: appSpacing.md, opacity: 0.5 }} />

          <ScoreSelector 
            label="Como está sua clareza mental?" 
            value={clarity} 
            onSelect={setClarity} 
            optional
          />

          <View style={{ height: 1, backgroundColor: appColors.borderSubtle, marginVertical: appSpacing.md, opacity: 0.5 }} />

          <ScoreSelector 
            label="Nível de irritabilidade" 
            value={irritability} 
            onSelect={setIrritability} 
            optional
          />
        </Card.Content>
      </Card>

      <View style={{ marginTop: appSpacing.md }}>
        <Text variant="labelLarge" style={{ color: appColors.textSecondary, marginBottom: appSpacing.xs }}>
          Quer comentar algo sobre o momento?
        </Text>
        <TextInput
          mode="outlined"
          multiline
          placeholder="Ex: Dormi pouco, mas me sinto bem..."
          value={note}
          onChangeText={setNote}
          style={{ height: 120, backgroundColor: appColors.surface }}
        />
      </View>

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={isLoading}
        disabled={isLoading || !userId}
        style={{ marginTop: appSpacing.xl, borderRadius: appRadius.md }}
        contentStyle={{ paddingVertical: 8 }}
      >
        {userId ? 'Confirmar check-in' : 'Entre para fazer check-in'}
      </Button>

      {error && (
        <Text variant="bodySmall" style={{ color: appColors.danger, textAlign: 'center', marginTop: appSpacing.md }}>
          {error}
        </Text>
      )}
    </ScrollView>
  );
}

function Emoji3D({ score, isSelected, onSelect }: { score: number; isSelected: boolean; onSelect: () => void }) {
  const labels = ['Muito mal', 'Muito mal', 'Mal', 'Mal', 'Neutro', 'Neutro', 'Bem', 'Bem', 'Muito bem', 'Muito bem'];

  const scale     = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotateY   = useSharedValue(0);   // 3D horizontal spin
  const rotateX   = useSharedValue(0);   // 3D vertical tilt
  const shadowR   = useSharedValue(3);

  React.useEffect(() => {
    if (isSelected) {
      // Coin-flip reveal when selected
      rotateY.value = withSequence(
        withTiming(360, { duration: 600 }),
        withRepeat(
          withSequence(withTiming(15, { duration: 1200 }), withTiming(-15, { duration: 1200 })),
          -1, true
        )
      );
      rotateX.value = withRepeat(
        withSequence(withTiming(12, { duration: 900 }), withTiming(-8, { duration: 900 })),
        -1, true
      );
      translateY.value = withRepeat(
        withSequence(withTiming(-8, { duration: 700 }), withTiming(0, { duration: 700 })),
        -1, true
      );
      scale.value = withSpring(1.15, { damping: 6, stiffness: 180 });
      shadowR.value = withSpring(18);
    } else {
      rotateY.value  = withSpring(0, { damping: 8 });
      rotateX.value  = withSpring(0, { damping: 8 });
      translateY.value = withSpring(0);
      scale.value    = withSpring(1.0);
      shadowR.value  = withSpring(3);
    }
  }, [isSelected]);

  const handlePress = () => {
    // Quick 3D pop on tap
    scale.value = withSequence(
      withSpring(1.4, { damping: 3, stiffness: 400 }),
      withSpring(isSelected ? 1.15 : 1.0, { damping: 6 })
    );
    rotateY.value = withSequence(
      withTiming(180, { duration: 300 }),
      withTiming(360, { duration: 300 })
    );
    onSelect();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 500 },
      { scale: scale.value },
      { translateY: translateY.value },
      { rotateY: `${rotateY.value}deg` },
      { rotateX: `${rotateX.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowRadius: shadowR.value,
    elevation: shadowR.value,
  }));

  return (
    <Pressable onPress={handlePress} style={{ alignItems: 'center', width: '20%', paddingVertical: 8 }}>
      <Animated.View style={[
        animStyle,
        glowStyle,
        {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: isSelected ? appColors.primarySoft : 'rgba(0,0,0,0.04)',
          borderWidth: 2,
          borderColor: isSelected ? appColors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: isSelected ? appColors.primary : '#000',
          shadowOffset: { width: 0, height: isSelected ? 6 : 1 },
          shadowOpacity: isSelected ? 0.4 : 0.1,
        }
      ]}>
        <Image
          source={{ uri: FLUENT_EMOJI_3D[score] }}
          style={{ width: 36, height: 36 }}
          resizeMode="contain"
        />
      </Animated.View>
      {isSelected && (
        <Text variant="labelSmall" style={{ color: appColors.primary, fontWeight: '700', marginTop: 6 }}>
          {labels[score - 1]}
        </Text>
      )}
    </Pressable>
  );
}

function MoodSelector({ value, onSelect }: { value: number; onSelect: (v: number) => void }) {
  return (
    <View style={{ marginBottom: appSpacing.xl }}>
      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: appSpacing.md }}>
        Como está seu humor agora?
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: appSpacing.sm }}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
          <Emoji3D
            key={score}
            score={score}
            isSelected={value === score}
            onSelect={() => onSelect(score)}
          />
        ))}
      </View>
    </View>
  );
}

function ScoreSelector({ label, value, onSelect, optional = false }: { label: string; value: number | null; onSelect: (v: number | null) => void; optional?: boolean }) {
  return (
    <View>
      <Text variant="labelLarge" style={{ color: appColors.textPrimary, fontWeight: '600', marginBottom: appSpacing.sm }}>
        {label}
      </Text>
      {optional && (
        <TouchableRipple onPress={() => onSelect(null)} style={{ alignSelf: 'flex-start', marginBottom: 6, borderRadius: appRadius.sm, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text variant="labelSmall" style={{ color: value === null ? appColors.primary : appColors.textSecondary }}>
            {value === null ? 'Não informado' : 'Limpar'}
          </Text>
        </TouchableRipple>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', backgroundColor: appColors.background, borderRadius: appRadius.md, padding: 4 }}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => {
          const isSelected = value === score;
          return (
            <TouchableRipple
              key={score}
              onPress={() => onSelect(score)}
              style={{
                width: '20%',
                paddingVertical: 10,
                borderRadius: appRadius.sm,
                backgroundColor: isSelected ? appColors.surface : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              borderless
            >
              <Text style={{ fontWeight: '700', color: isSelected ? appColors.primary : appColors.textSecondary }}>
                {score}
              </Text>
            </TouchableRipple>
          );
        })}
      </View>
    </View>
  );
}

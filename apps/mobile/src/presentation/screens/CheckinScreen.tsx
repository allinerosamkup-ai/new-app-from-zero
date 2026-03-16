import React, { useState } from 'react';
import { View, ScrollView, Image, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Text,
  Card,
  Button,
  TextInput,
  Surface,
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

// Fluent Emoji 3D — Microsoft open source (MIT)
const FLUENT_EMOJI_3D: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Crying%20face/3D/crying_face_3d.png',
  2: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Slightly%20frowning%20face/3D/slightly_frowning_face_3d.png',
  3: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Neutral%20face/3D/neutral_face_3d.png',
  4: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Slightly%20smiling%20face/3D/slightly_smiling_face_3d.png',
  5: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Beaming%20face%20with%20smiling%20eyes/3D/beaming_face_with_smiling_eyes_3d.png',
};

/**
 * CheckinScreen: Formulário de estado diário com UI do Paper.
 */
export default function CheckinScreen() {
  const navigation = useNavigation<any>();
  const { isLoading, submitCheckin, error } = useCheckinStore();
  const { userId } = useAuthStore();

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [clarity, setClarity] = useState(3);
  const [irritability, setIrritability] = useState(3);
  const [note, setNote] = useState('');

  const handleSubmit = async () => {
    if (!userId) return;

    await submitCheckin({
      userId,
      localDate: new Date().toISOString().split('T')[0],
      moodScore: mood,
      energyScore: energy,
      clarityScore: clarity,
      irritabilityScore: irritability,
      note,
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

      <Card style={{ marginBottom: appSpacing.lg, backgroundColor: appColors.surface }} mode="outlined">
        <Card.Content>
          <ScoreSelector 
            label="Como está seu nível de energia?" 
            value={energy} 
            onSelect={setEnergy} 
          />
          
          <View style={{ height: 1, backgroundColor: appColors.borderSubtle, marginVertical: appSpacing.md, opacity: 0.5 }} />

          <ScoreSelector 
            label="Como está sua clareza mental?" 
            value={clarity} 
            onSelect={setClarity} 
          />

          <View style={{ height: 1, backgroundColor: appColors.borderSubtle, marginVertical: appSpacing.md, opacity: 0.5 }} />

          <ScoreSelector 
            label="Nível de irritabilidade" 
            value={irritability} 
            onSelect={setIrritability} 
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
  const labels = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'];

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
    <Pressable onPress={handlePress} style={{ alignItems: 'center', flex: 1, paddingVertical: 8 }}>
      <Animated.View style={[
        animStyle,
        glowStyle,
        {
          width: 62,
          height: 62,
          borderRadius: 31,
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
          style={{ width: 46, height: 46 }}
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: appSpacing.sm }}>
        {[1, 2, 3, 4, 5].map((score) => (
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

function ScoreSelector({ label, value, onSelect }: { label: string; value: number; onSelect: (v: number) => void }) {
  return (
    <View>
      <Text variant="labelLarge" style={{ color: appColors.textPrimary, fontWeight: '600', marginBottom: appSpacing.sm }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: appColors.background, borderRadius: appRadius.md, padding: 4 }}>
        {[1, 2, 3, 4, 5].map((score) => {
          const isSelected = value === score;
          return (
            <TouchableRipple
              key={score}
              onPress={() => onSelect(score)}
              style={{
                flex: 1,
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

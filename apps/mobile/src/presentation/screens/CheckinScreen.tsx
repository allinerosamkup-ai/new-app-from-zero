import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { 
  Text, 
  Card, 
  Button, 
  TextInput, 
  ActivityIndicator, 
  IconButton, 
  MD3Colors,
  Surface,
  TouchableRipple
} from 'react-native-paper';
import { useCheckinStore } from '../providers/checkin_store';
import { useAuthStore } from '../providers/auth_store';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

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

function MoodSelector({ value, onSelect }: { value: number; onSelect: (v: number) => void }) {
  const emojis = ['😢', '😕', '😐', '🙂', '😄'];
  const labels = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'];

  return (
    <View style={{ marginBottom: appSpacing.xl }}>
      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: appSpacing.md }}>
        Como está seu humor agora?
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {emojis.map((emoji, index) => {
          const score = index + 1;
          const isSelected = value === score;
          return (
            <Surface
              key={score}
              style={{
                borderRadius: appRadius.lg,
                backgroundColor: isSelected ? appColors.primarySoft : 'transparent',
                borderWidth: 2,
                borderColor: isSelected ? appColors.primary : 'transparent',
                elevation: isSelected ? 2 : 0,
              }}
            >
              <TouchableRipple
                onPress={() => onSelect(score)}
                style={{ padding: appSpacing.md, alignItems: 'center' }}
                borderless
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 32 }}>{emoji}</Text>
                  {isSelected && (
                    <Text variant="labelSmall" style={{ color: appColors.primary, fontWeight: '700', marginTop: 4 }}>
                      {labels[index]}
                    </Text>
                  )}
                </View>
              </TouchableRipple>
            </Surface>
          );
        })}
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

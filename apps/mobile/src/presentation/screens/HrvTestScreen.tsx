import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, TextInput, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

// Estimativa de HRV (RMSSD) a partir da FC de repouso
// Baseado na relação inversa FC × HRV em adultos saudáveis
function estimateHrv(bpm: number): number {
  if (bpm <= 0) return 0;
  // Equação empírica simplificada: RMSSD ≈ 3000 / BPM  (±20ms variação individual)
  return Math.round(3000 / bpm);
}

function hrv_zone(rmssd: number): 'baixa' | 'moderada' | 'alta' {
  if (rmssd < 30) return 'baixa';
  if (rmssd < 60) return 'moderada';
  return 'alta';
}

const STEPS = [
  {
    icon: '🧘',
    title: 'Prepare-se',
    desc: 'Sente-se confortavelmente. Respire fundo 3 vezes. Fique em repouso por 1 minuto antes de medir.',
  },
  {
    icon: '⌚',
    title: 'Meça sua frequência cardíaca',
    desc: 'Use o dedo no pulso, no pescoço ou seu smartwatch. Conte os batimentos por 60 segundos.',
  },
  {
    icon: '🔢',
    title: 'Digite o resultado',
    desc: 'Informe sua frequência cardíaca de repouso. Vamos calcular seu HRV estimado.',
  },
];

export default function HrvTestScreen() {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState(0);
  const [bpm, setBpm] = useState('');
  const inputRef = useRef<TextInput>(null);

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      return;
    }
    // Último step — calcular
    const bpmNum = parseInt(bpm, 10);
    if (!bpm || isNaN(bpmNum) || bpmNum < 30 || bpmNum > 220) {
      Alert.alert('Valor inválido', 'Digite uma frequência cardíaca entre 30 e 220 bpm.');
      return;
    }
    const rmssd = estimateHrv(bpmNum);
    const zone = hrv_zone(rmssd);
    navigation.replace('HrvResult', { bpm: bpmNum, rmssd, zone });
  }

  const isLastStep = step === STEPS.length - 1;
  const canProceed = isLastStep ? (bpm.length > 0 && parseInt(bpm) >= 30) : true;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teste HRV</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i <= step && styles.dotActive, i < step && styles.dotDone]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Step card */}
        <View style={styles.stepCard}>
          <Text style={styles.stepIcon}>{STEPS[step].icon}</Text>
          <Text style={styles.stepTitle}>{STEPS[step].title}</Text>
          <Text style={styles.stepDesc}>{STEPS[step].desc}</Text>

          {/* Passo 3: input BPM */}
          {isLastStep && (
            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                style={styles.bpmInput}
                value={bpm}
                onChangeText={setBpm}
                placeholder="Ex: 62"
                placeholderTextColor={appColors.textSecondary}
                keyboardType="number-pad"
                maxLength={3}
                autoFocus
              />
              <Text style={styles.bpmUnit}>bpm</Text>
            </View>
          )}
        </View>

        {/* Info extra */}
        {step === 0 && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>💡 O que é HRV?</Text>
            <Text style={styles.infoText}>
              HRV (Heart Rate Variability) mede a variação entre batimentos cardíacos.
              Valores mais altos indicam melhor recuperação e resiliência ao estresse.
            </Text>
          </View>
        )}

        {step === 1 && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📍 Como medir no pulso</Text>
            <Text style={styles.infoText}>
              Coloque dois dedos (indicador + médio) na parte interna do pulso, abaixo do polegar.
              Pressione levemente e conte os batimentos por 60s.
            </Text>
          </View>
        )}

        {isLastStep && bpm.length > 0 && parseInt(bpm) >= 30 && (
          <View style={[styles.infoBox, styles.infoPreview]}>
            <Text style={styles.infoTitle}>Prévia</Text>
            <Text style={styles.infoText}>
              FC: <Text style={{ fontWeight: '700' }}>{bpm} bpm</Text>
              {'  →  '}HRV estimado: <Text style={{ fontWeight: '700' }}>{estimateHrv(parseInt(bpm))} ms</Text>
            </Text>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, !canProceed && styles.btnDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <Text style={styles.btnTxt}>
            {isLastStep ? 'Ver meu resultado →' : 'Continuar →'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.stepCount}>Passo {step + 1} de {STEPS.length}</Text>
      </View>
    </SafeAreaView>
  );
}

const NECTARINE = '#D7897F';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF6F2' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.md, paddingBottom: appSpacing.sm,
  },
  backBtn: { width: 60 },
  backTxt: { fontSize: 14, color: NECTARINE, fontWeight: '600' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: appColors.textPrimary },
  dotsRow: {
    flexDirection: 'row', gap: 8, justifyContent: 'center',
    paddingVertical: appSpacing.sm,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(215,137,127,.2)',
  },
  dotActive: { backgroundColor: NECTARINE, width: 20, borderRadius: 4 },
  dotDone: { backgroundColor: '#96C7B3', width: 8 },
  content: { paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.md, paddingBottom: 120 },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: appRadius.lg,
    padding: appSpacing.xl,
    alignItems: 'center',
    marginBottom: appSpacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stepIcon: { fontSize: 48, marginBottom: appSpacing.md },
  stepTitle: { fontSize: 20, fontWeight: '800', color: appColors.textPrimary, marginBottom: 8, textAlign: 'center' },
  stepDesc: { fontSize: 14, color: appColors.textSecondary, lineHeight: 22, textAlign: 'center' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: appSpacing.xl, backgroundColor: '#FAF6F2',
    borderRadius: appRadius.md, borderWidth: 1.5, borderColor: NECTARINE,
    paddingHorizontal: appSpacing.lg, paddingVertical: appSpacing.sm,
  },
  bpmInput: {
    fontSize: 32, fontWeight: '800', color: appColors.textPrimary,
    minWidth: 80, textAlign: 'center',
  },
  bpmUnit: { fontSize: 16, color: appColors.textSecondary, fontWeight: '500' },
  infoBox: {
    backgroundColor: 'rgba(215,137,127,.08)',
    borderRadius: appRadius.md,
    borderLeftWidth: 3, borderLeftColor: NECTARINE,
    padding: appSpacing.lg, marginBottom: appSpacing.md,
  },
  infoPreview: {
    backgroundColor: 'rgba(150,199,179,.1)',
    borderLeftColor: '#96C7B3',
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary, marginBottom: 4 },
  infoText: { fontSize: 13, color: appColors.textSecondary, lineHeight: 20 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FAF6F2', padding: appSpacing.lg,
    borderTopWidth: 1, borderTopColor: 'rgba(215,137,127,.15)',
    alignItems: 'center', gap: 8,
  },
  btn: {
    width: '100%', height: 50, borderRadius: appRadius.pill,
    backgroundColor: NECTARINE, alignItems: 'center', justifyContent: 'center',
    shadowColor: NECTARINE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { backgroundColor: 'rgba(215,137,127,.35)', shadowOpacity: 0 },
  btnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  stepCount: { fontSize: 11, color: appColors.textSecondary },
});

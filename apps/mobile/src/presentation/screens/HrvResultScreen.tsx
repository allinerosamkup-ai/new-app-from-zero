import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type Zone = 'baixa' | 'moderada' | 'alta';

type RouteParams = {
  bpm: number;
  rmssd: number;
  zone: Zone;
};

const ZONE_CONFIG: Record<Zone, {
  emoji: string;
  label: string;
  color: string;
  bg: string;
  title: string;
  desc: string;
  tips: string[];
  recoveryMode: boolean;
}> = {
  baixa: {
    emoji: '🔴',
    label: 'Baixa',
    color: '#c0392b',
    bg: '#FEF2F2',
    title: 'Seu corpo pede descanso',
    desc: 'HRV baixo indica que seu sistema nervoso está sob estresse. É hora de priorizar recuperação.',
    tips: [
      'Reduza tarefas de alta carga cognitiva',
      'Priorize sono e hidratação',
      'Evite treinos intensos hoje',
      'Respiração 4-7-8 por 5 minutos',
    ],
    recoveryMode: true,
  },
  moderada: {
    emoji: '🟡',
    label: 'Moderada',
    color: '#d97706',
    bg: '#FFFBEB',
    title: 'Equilíbrio no radar',
    desc: 'HRV moderado — você está estável. Bom para tarefas rotineiras, sem sobrecarga extra.',
    tips: [
      'Mantenha ritmo regular de trabalho',
      'Inclua pausas de 5min a cada hora',
      'Treino leve ou caminhada está ótimo',
      'Evite decisões complexas no final do dia',
    ],
    recoveryMode: false,
  },
  alta: {
    emoji: '🟢',
    label: 'Alta',
    color: '#166534',
    bg: '#F0FDF4',
    title: 'Recuperada e pronta!',
    desc: 'HRV alto = sistema nervoso bem regulado. Ótimo momento para tarefas desafiadoras e criatividade.',
    tips: [
      'Aproveite para tarefas de alta concentração',
      'Bom dia para treino intenso',
      'Criatividade e tomada de decisão estão em alta',
      'Janela ideal: próximas 4–6 horas',
    ],
    recoveryMode: false,
  },
};

export default function HrvResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { bpm, rmssd, zone } = route.params as RouteParams;
  const config = ZONE_CONFIG[zone];

  const NECTARINE = '#D7897F';
  const MENTHE = '#96C7B3';

  // Barra de score visual (0–100ms como referência)
  const scorePct = Math.min((rmssd / 100) * 100, 100);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: config.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{config.emoji}</Text>
          <Text style={[styles.zoneLabel, { color: config.color }]}>HRV {config.label}</Text>
          <Text style={styles.heroTitle}>{config.title}</Text>
          <Text style={styles.heroDesc}>{config.desc}</Text>
        </View>

        {/* Score card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreValue}>{bpm}</Text>
              <Text style={styles.scoreUnit}>bpm FC</Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: config.color }]}>{rmssd}</Text>
              <Text style={styles.scoreUnit}>ms RMSSD</Text>
            </View>
          </View>

          {/* Barra visual */}
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${scorePct}%` as any,
              backgroundColor: zone === 'alta' ? MENTHE : zone === 'moderada' ? '#d97706' : '#c0392b',
            }]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabel}>0</Text>
            <Text style={styles.barLabel}>30</Text>
            <Text style={styles.barLabel}>60</Text>
            <Text style={styles.barLabel}>100ms</Text>
          </View>

          <Text style={styles.scoreNote}>
            * Estimativa baseada na sua FC de repouso. Para precisão máxima, use um wearable com sensor HRV.
          </Text>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>📋 Recomendações para hoje</Text>
          {config.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={[styles.tipDot, { backgroundColor: config.color }]} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Recovery Mode banner */}
        {config.recoveryMode && (
          <View style={styles.recoveryBanner}>
            <Text style={styles.recoveryEmoji}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.recoveryTitle}>Modo Recovery ativado</Text>
              <Text style={styles.recoveryDesc}>
                Sua agenda será ajustada para priorizar recuperação hoje.
              </Text>
            </View>
          </View>
        )}

        {/* CTAs */}
        <View style={styles.ctaGroup}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: NECTARINE }]}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.btnTxt}>Ver minha agenda →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => navigation.replace('HrvTest')}
          >
            <Text style={[styles.btnTxt, { color: appColors.textSecondary }]}>Refazer medição</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.xl, paddingBottom: 48 },
  hero: { alignItems: 'center', marginBottom: appSpacing.xl },
  heroEmoji: { fontSize: 56, marginBottom: 8 },
  zoneLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: appColors.textPrimary, textAlign: 'center', marginBottom: 8 },
  heroDesc: { fontSize: 14, color: appColors.textSecondary, lineHeight: 22, textAlign: 'center', maxWidth: 300 },
  scoreCard: {
    backgroundColor: '#fff', borderRadius: appRadius.lg, padding: appSpacing.xl,
    marginBottom: appSpacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: appSpacing.lg },
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreValue: { fontSize: 36, fontWeight: '800', color: appColors.textPrimary },
  scoreUnit: { fontSize: 11, color: appColors.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
  scoreDivider: { width: 1, height: 48, backgroundColor: appColors.borderSubtle, marginHorizontal: appSpacing.md },
  barTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', borderRadius: 999 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 10, color: appColors.textSecondary },
  scoreNote: { fontSize: 10, color: appColors.textSecondary, marginTop: appSpacing.md, lineHeight: 16, fontStyle: 'italic' },
  tipsCard: {
    backgroundColor: '#fff', borderRadius: appRadius.lg, padding: appSpacing.xl,
    marginBottom: appSpacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: appColors.textPrimary, marginBottom: appSpacing.md },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  tipText: { fontSize: 13, color: appColors.textSecondary, lineHeight: 20, flex: 1 },
  recoveryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(215,137,127,.1)',
    borderRadius: appRadius.md, borderLeftWidth: 3, borderLeftColor: '#D7897F',
    padding: appSpacing.lg, marginBottom: appSpacing.lg,
  },
  recoveryEmoji: { fontSize: 28 },
  recoveryTitle: { fontSize: 14, fontWeight: '700', color: '#A8544A', marginBottom: 2 },
  recoveryDesc: { fontSize: 12, color: appColors.textSecondary, lineHeight: 18 },
  ctaGroup: { gap: 10 },
  btn: {
    height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#D7897F', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnOutline: {
    height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: appColors.borderSubtle, backgroundColor: 'transparent',
  },
  btnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

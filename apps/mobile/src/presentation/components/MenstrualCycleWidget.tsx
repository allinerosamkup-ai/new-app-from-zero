import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Chip, IconButton } from 'react-native-paper';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';
import { MenstrualPhase, PhysicalSymptom, FlowIntensity, GradedSymptom, SymptomLevel } from '../../domain/entities/checkin';

interface MenstrualCycleWidgetProps {
  phase?: MenstrualPhase;
  onPhaseSelect: (phase: MenstrualPhase) => void;
  selectedSymptoms: PhysicalSymptom[];
  onToggleSymptom: (symptom: PhysicalSymptom) => void;
  // Fluxo
  isFlowing?: boolean;
  onFlowingChange: (v: boolean) => void;
  flowDay?: number;
  onFlowDayChange: (v: number) => void;
  flowIntensity?: FlowIntensity;
  onFlowIntensityChange: (v: FlowIntensity) => void;
  // Níveis de sintomas graduáveis
  symptomLevels?: Partial<Record<GradedSymptom, SymptomLevel>>;
  onSymptomLevelChange?: (symptom: GradedSymptom, level: SymptomLevel) => void;
}

const PHASES: { label: string; value: MenstrualPhase; icon: string }[] = [
  { label: 'Menstrual', value: 'menstrual', icon: 'water' },
  { label: 'Folicular', value: 'folicular', icon: 'leaf' },
  { label: 'Ovulatória', value: 'ovulatoria', icon: 'egg-outline' },
  { label: 'Lútea', value: 'lutea', icon: 'moon-waning-crescent' },
];

const SYMPTOMS: { label: string; value: PhysicalSymptom; icon: string }[] = [
  { label: 'Cólica', value: 'colica', icon: 'emoticon-sad-outline' },
  { label: 'Dor de cabeça', value: 'dor_cabeca', icon: 'head-alert-outline' },
  { label: 'Seios sensíveis', value: 'sensibilidade_seios', icon: 'gesture-tap' },
  { label: 'Inchaço', value: 'inchaco', icon: 'emoticon-confused-outline' },
  { label: 'Acne', value: 'acne', icon: 'face-man-profile' },
  { label: 'Fadiga', value: 'fadiga', icon: 'battery-low' },
  { label: 'Lombalgia', value: 'lombalgia', icon: 'human-handsdown' },
];

const FLOW_INTENSITIES: { label: string; value: FlowIntensity; emoji: string }[] = [
  { label: 'Leve',    value: 'leve',     emoji: '🩸' },
  { label: 'Moderado', value: 'moderado', emoji: '🩸🩸' },
  { label: 'Intenso', value: 'intenso',  emoji: '🩸🩸🩸' },
];

const GRADED_SYMPTOMS: GradedSymptom[] = ['colica', 'dor_cabeca'];
const GRADED_LABELS: Record<GradedSymptom, string> = { colica: 'Cólica', dor_cabeca: 'Dor de cabeça' };
const LEVEL_LABELS: Record<SymptomLevel, string> = { 1: 'Leve', 2: 'Moderada', 3: 'Intensa' };
const LEVEL_COLORS: Record<SymptomLevel, string> = { 1: '#5DAE8B', 2: '#d97706', 3: '#c0392b' };

export function MenstrualCycleWidget({
  phase,
  onPhaseSelect,
  selectedSymptoms,
  onToggleSymptom,
  isFlowing,
  onFlowingChange,
  flowDay,
  onFlowDayChange,
  flowIntensity,
  onFlowIntensityChange,
  symptomLevels,
  onSymptomLevelChange,
}: MenstrualCycleWidgetProps) {
  return (
    <View style={styles.container}>
      <Text variant="titleSmall" style={styles.title}>
        Saúde Feminina <Text style={styles.subtitle}>(Opcional)</Text>
      </Text>

      {/* Fluxo menstrual */}
      <View style={styles.section}>
        <Text variant="labelMedium" style={styles.label}>Está menstruada hoje?</Text>
        <View style={styles.flowToggleRow}>
          {[{ label: 'Sim', value: true }, { label: 'Não', value: false }].map(opt => (
            <TouchableOpacity
              key={String(opt.value)}
              onPress={() => onFlowingChange(opt.value)}
              style={[
                styles.flowToggleBtn,
                isFlowing === opt.value && styles.flowToggleBtnActive,
              ]}
            >
              <Text style={[
                styles.flowToggleTxt,
                isFlowing === opt.value && styles.flowToggleTxtActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isFlowing && (
          <>
            {/* Dia do fluxo */}
            <Text variant="labelMedium" style={[styles.label, { marginTop: appSpacing.sm }]}>
              Qual dia do fluxo?
            </Text>
            <View style={styles.flowDayRow}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => onFlowDayChange(d)}
                  style={[styles.flowDayBtn, flowDay === d && styles.flowDayBtnActive]}
                >
                  <Text style={[styles.flowDayTxt, flowDay === d && styles.flowDayTxtActive]}>
                    {d}º
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Intensidade */}
            <Text variant="labelMedium" style={[styles.label, { marginTop: appSpacing.sm }]}>
              Intensidade do fluxo
            </Text>
            <View style={styles.flowIntensityRow}>
              {FLOW_INTENSITIES.map(fi => (
                <TouchableOpacity
                  key={fi.value}
                  onPress={() => onFlowIntensityChange(fi.value)}
                  style={[
                    styles.flowIntensityBtn,
                    flowIntensity === fi.value && styles.flowIntensityBtnActive,
                  ]}
                >
                  <Text style={styles.flowIntensityEmoji}>{fi.emoji}</Text>
                  <Text style={[
                    styles.flowIntensityLabel,
                    flowIntensity === fi.value && styles.flowIntensityLabelActive,
                  ]}>
                    {fi.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="labelMedium" style={styles.label}>Em qual fase você está?</Text>
        <View style={styles.phaseGrid}>
          {PHASES.map((p) => {
            const isSelected = phase === p.value;
            return (
              <Chip
                key={p.value}
                selected={isSelected}
                onPress={() => onPhaseSelect(p.value)}
                icon={p.icon}
                style={[
                  styles.chip,
                  isSelected && { backgroundColor: appColors.primarySoft }
                ]}
                textStyle={[
                  styles.chipText,
                  isSelected && { color: appColors.primary }
                ]}
                mode="outlined"
              >
                {p.label}
              </Chip>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="labelMedium" style={styles.label}>Algum sintoma hoje?</Text>
        <View style={styles.symptomGrid}>
          {SYMPTOMS.map((s) => {
            const isSelected = selectedSymptoms.includes(s.value);
            return (
              <View key={s.value} style={styles.symptomItem}>
                <IconButton
                  icon={s.icon}
                  mode={isSelected ? 'contained' : 'outlined'}
                  containerColor={isSelected ? appColors.primarySoft : 'transparent'}
                  iconColor={isSelected ? appColors.primary : appColors.textSecondary}
                  size={24}
                  onPress={() => onToggleSymptom(s.value)}
                  style={styles.iconButton}
                />
                <Text
                  variant="labelSmall"
                  style={[
                    styles.symptomLabel,
                    isSelected && { color: appColors.primary, fontWeight: '700' }
                  ]}
                  numberOfLines={2}
                >
                  {s.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Nível de intensidade para cólica e dor de cabeça */}
        {GRADED_SYMPTOMS.map(gs => {
          if (!selectedSymptoms.includes(gs)) return null;
          const currentLevel = symptomLevels?.[gs];
          return (
            <View key={gs} style={styles.gradedWrap}>
              <Text variant="labelSmall" style={styles.gradedLabel}>
                Intensidade da {GRADED_LABELS[gs].toLowerCase()}:
              </Text>
              <View style={styles.gradedRow}>
                {([1, 2, 3] as SymptomLevel[]).map(lvl => (
                  <TouchableOpacity
                    key={lvl}
                    onPress={() => onSymptomLevelChange?.(gs, lvl)}
                    style={[
                      styles.gradedBtn,
                      currentLevel === lvl && { backgroundColor: LEVEL_COLORS[lvl], borderColor: LEVEL_COLORS[lvl] },
                    ]}
                  >
                    <Text style={[
                      styles.gradedBtnTxt,
                      currentLevel === lvl && { color: '#fff', fontWeight: '700' },
                    ]}>
                      {LEVEL_LABELS[lvl]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: appSpacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: appRadius.lg,
    padding: appSpacing.md,
    borderWidth: 1,
    borderColor: appColors.borderSubtle,
  },
  title: {
    fontWeight: '700',
    marginBottom: appSpacing.md,
    color: appColors.textPrimary,
  },
  subtitle: {
    fontWeight: '400',
    fontSize: 12,
    color: appColors.textSecondary,
  },
  section: {
    marginBottom: appSpacing.md,
  },
  label: {
    marginBottom: appSpacing.xs,
    color: appColors.textSecondary,
  },
  phaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  chipText: {
    fontSize: 12,
  },
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 12,
  },
  symptomItem: {
    alignItems: 'center',
    width: 60,
  },
  iconButton: {
    margin: 0,
    width: 44,
    height: 44,
  },
  symptomLabel: {
    textAlign: 'center',
    fontSize: 10,
    marginTop: 4,
    color: appColors.textSecondary,
  },
  flowToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: appSpacing.xs,
  },
  flowToggleBtn: {
    flex: 1, height: 38, borderRadius: appRadius.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: appColors.borderSubtle,
    backgroundColor: 'transparent',
  },
  flowToggleBtnActive: {
    backgroundColor: 'rgba(215,137,127,.12)',
    borderColor: '#D7897F',
  },
  flowToggleTxt: {
    fontSize: 13, fontWeight: '600', color: appColors.textSecondary,
  },
  flowToggleTxtActive: {
    color: '#A8544A', fontWeight: '700',
  },
  flowDayRow: {
    flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: appSpacing.xs,
  },
  flowDayBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: appColors.borderSubtle,
    backgroundColor: 'transparent',
  },
  flowDayBtnActive: {
    backgroundColor: '#D7897F', borderColor: '#D7897F',
  },
  flowDayTxt: {
    fontSize: 12, fontWeight: '600', color: appColors.textSecondary,
  },
  flowDayTxtActive: {
    color: '#fff', fontWeight: '800',
  },
  flowIntensityRow: {
    flexDirection: 'row', gap: 8, marginTop: appSpacing.xs,
  },
  flowIntensityBtn: {
    flex: 1, paddingVertical: 10, borderRadius: appRadius.md,
    alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: appColors.borderSubtle,
    backgroundColor: 'transparent',
  },
  flowIntensityBtnActive: {
    backgroundColor: 'rgba(215,137,127,.12)', borderColor: '#D7897F',
  },
  flowIntensityEmoji: { fontSize: 16 },
  flowIntensityLabel: {
    fontSize: 11, fontWeight: '600', color: appColors.textSecondary,
  },
  flowIntensityLabelActive: {
    color: '#A8544A', fontWeight: '700',
  },
  gradedWrap: {
    marginTop: appSpacing.sm,
    backgroundColor: 'rgba(215,137,127,.06)',
    borderRadius: appRadius.md, padding: appSpacing.sm,
  },
  gradedLabel: {
    fontSize: 11, color: appColors.textSecondary, marginBottom: 6,
  },
  gradedRow: { flexDirection: 'row', gap: 6 },
  gradedBtn: {
    flex: 1, paddingVertical: 7, borderRadius: appRadius.pill,
    alignItems: 'center', borderWidth: 1.5, borderColor: appColors.borderSubtle,
    backgroundColor: 'transparent',
  },
  gradedBtnTxt: { fontSize: 12, fontWeight: '500', color: appColors.textSecondary },
});

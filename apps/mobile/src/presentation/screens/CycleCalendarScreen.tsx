import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type Phase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea' | 'future';

const PHASE_CONFIG: Record<Phase, { emoji: string; label: string; color: string; bg: string; desc: string }> = {
  menstrual:  { emoji: '🌙', label: 'Menstrual',  color: '#D7897F', bg: 'rgba(215,137,127,.18)', desc: 'Introspecção, descanso, tarefas simples.' },
  folicular:  { emoji: '🌱', label: 'Folicular',  color: '#5DAE8B', bg: 'rgba(93,174,139,.18)',  desc: 'Energia crescendo, criatividade alta.' },
  ovulatoria: { emoji: '🚀', label: 'Ovulatória', color: '#6398A9', bg: 'rgba(99,152,169,.18)',  desc: 'Pico de energia e comunicação.' },
  lutea:      { emoji: '🌊', label: 'Lútea',      color: '#9B7AB8', bg: 'rgba(155,122,184,.18)', desc: 'Foco analítico, introspecção gradual.' },
  future:     { emoji: '',   label: '',            color: '#e2e8f0', bg: 'transparent',           desc: '' },
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Gera fase estimada para um dia do ciclo (baseado em offset desde última menstruação)
function getPhase(dayOfCycle: number): Phase {
  if (dayOfCycle >= 1  && dayOfCycle <= 5)  return 'menstrual';
  if (dayOfCycle >= 6  && dayOfCycle <= 13) return 'folicular';
  if (dayOfCycle >= 14 && dayOfCycle <= 16) return 'ovulatoria';
  if (dayOfCycle >= 17 && dayOfCycle <= 28) return 'lutea';
  return 'folicular'; // ciclos > 28 dias
}

// Simula: última menstruação foi há 8 dias
const CYCLE_START_OFFSET = 8;
const TODAY = new Date();

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; phase: Phase; isToday: boolean; isFuture: boolean }> = [];

  for (let i = 0; i < firstDay; i++) cells.push({ day: null, phase: 'future', isToday: false, isFuture: true });

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const diffDays = Math.floor((date.getTime() - TODAY.getTime()) / 86400000);
    const isFuture = diffDays > 0;
    const isToday = diffDays === 0;

    // Calcula dia do ciclo
    const dayOfCycle = ((CYCLE_START_OFFSET + (d - TODAY.getDate()) - 1) % 28) + 1;
    const phase = isFuture ? 'future' : getPhase(Math.max(1, dayOfCycle));

    cells.push({ day: d, phase, isToday, isFuture });
  }
  return cells;
}

export default function CycleCalendarScreen() {
  const navigation = useNavigation<any>();
  const [year, setYear] = useState(TODAY.getFullYear());
  const [month, setMonth] = useState(TODAY.getMonth());
  const [selected, setSelected] = useState<{ day: number; phase: Phase } | null>(null);

  const cells = buildCalendar(year, month);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Resumo de fases no mês
  const phaseCounts = cells.reduce((acc, c) => {
    if (c.day && !c.isFuture && c.phase !== 'future') acc[c.phase] = (acc[c.phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ciclo Mensal</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Navegação mês */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Dias da semana */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map(d => (
            <Text key={d} style={styles.weekDay}>{d}</Text>
          ))}
        </View>

        {/* Grid de dias */}
        <View style={styles.grid}>
          {cells.map((cell, i) => {
            if (!cell.day) return <View key={i} style={styles.emptyCell} />;
            const cfg = PHASE_CONFIG[cell.phase];
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dayCell,
                  { backgroundColor: cell.isFuture ? 'transparent' : cfg.bg },
                  cell.isToday && styles.todayCell,
                ]}
                onPress={() => !cell.isFuture && setSelected({ day: cell.day!, phase: cell.phase })}
                disabled={cell.isFuture}
              >
                {!cell.isFuture && cell.phase !== 'future' && (
                  <Text style={styles.dayEmoji}>{cfg.emoji}</Text>
                )}
                <Text style={[
                  styles.dayNum,
                  cell.isFuture && styles.dayFuture,
                  cell.isToday && { color: '#D7897F', fontWeight: '800' },
                ]}>
                  {cell.day}
                </Text>
                {cell.isToday && <View style={styles.todayDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legenda */}
        <View style={styles.legend}>
          {(Object.keys(PHASE_CONFIG) as Phase[]).filter(p => p !== 'future').map(phase => {
            const cfg = PHASE_CONFIG[phase];
            return (
              <View key={phase} style={styles.legendItem}>
                <Text style={styles.legendEmoji}>{cfg.emoji}</Text>
                <Text style={styles.legendLabel}>{cfg.label}</Text>
                {phaseCounts[phase] ? (
                  <Text style={[styles.legendCount, { color: cfg.color }]}>{phaseCounts[phase]}d</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Resumo do ciclo atual */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>📊 Este mês</Text>
          {(Object.keys(phaseCounts) as Phase[]).map(phase => {
            const cfg = PHASE_CONFIG[phase];
            return (
              <View key={phase} style={styles.summaryRow}>
                <Text style={styles.summaryEmoji}>{cfg.emoji}</Text>
                <Text style={styles.summaryPhase}>{cfg.label}</Text>
                <View style={styles.summaryBarTrack}>
                  <View style={[styles.summaryBarFill, {
                    width: `${(phaseCounts[phase] / 30) * 100}%` as any,
                    backgroundColor: cfg.color,
                  }]} />
                </View>
                <Text style={[styles.summaryDays, { color: cfg.color }]}>{phaseCounts[phase]}d</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal detalhe do dia */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelected(null)}>
          <View style={styles.modalSheet}>
            {selected && (() => {
              const cfg = PHASE_CONFIG[selected.phase];
              return (
                <>
                  <View style={styles.modalHandle} />
                  <Text style={styles.modalEmoji}>{cfg.emoji}</Text>
                  <Text style={styles.modalDay}>Dia {selected.day} de {MONTHS[month]}</Text>
                  <Text style={[styles.modalPhase, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.modalDesc}>{cfg.desc}</Text>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: cfg.color }]}
                    onPress={() => { setSelected(null); navigation.navigate('DailyAgenda', { day: selected.day, phase: selected.phase }); }}
                  >
                    <Text style={styles.modalBtnTxt}>Ver agenda deste dia →</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF6F2' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: appSpacing.lg, paddingVertical: appSpacing.md,
  },
  backBtn: { width: 60 },
  backTxt: { fontSize: 14, color: '#D7897F', fontWeight: '600' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: appColors.textPrimary },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: appSpacing.lg, marginBottom: appSpacing.md },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(215,137,127,.12)', alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 22, color: '#D7897F', fontWeight: '700', lineHeight: 26 },
  monthLabel: { fontSize: 17, fontWeight: '800', color: appColors.textPrimary },
  weekRow: { flexDirection: 'row', paddingHorizontal: appSpacing.lg, marginBottom: 6 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: appColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: appSpacing.lg, gap: 4 },
  emptyCell: { width: '13%', height: 52 },
  dayCell: {
    width: '13%', height: 52, borderRadius: appRadius.sm,
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  todayCell: { borderWidth: 2, borderColor: '#D7897F' },
  dayEmoji: { fontSize: 10 },
  dayNum: { fontSize: 13, fontWeight: '600', color: appColors.textPrimary },
  dayFuture: { color: appColors.borderSubtle },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D7897F' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 12, flexWrap: 'wrap', paddingHorizontal: appSpacing.lg, marginTop: appSpacing.lg, marginBottom: appSpacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendEmoji: { fontSize: 13 },
  legendLabel: { fontSize: 11, color: appColors.textSecondary },
  legendCount: { fontSize: 11, fontWeight: '700', marginLeft: 2 },
  summaryCard: {
    marginHorizontal: appSpacing.lg, backgroundColor: '#fff',
    borderRadius: appRadius.lg, padding: appSpacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary, marginBottom: appSpacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryEmoji: { fontSize: 14, width: 20 },
  summaryPhase: { fontSize: 12, color: appColors.textSecondary, width: 72 },
  summaryBarTrack: { flex: 1, height: 6, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden' },
  summaryBarFill: { height: '100%', borderRadius: 999 },
  summaryDays: { fontSize: 12, fontWeight: '700', width: 24, textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: appSpacing.xl, alignItems: 'center', paddingBottom: 36,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', marginBottom: appSpacing.lg },
  modalEmoji: { fontSize: 40, marginBottom: 8 },
  modalDay: { fontSize: 13, color: appColors.textSecondary, marginBottom: 4 },
  modalPhase: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: appColors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: appSpacing.xl },
  modalBtn: { width: '100%', height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modalBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

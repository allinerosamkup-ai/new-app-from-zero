import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type EnergyBlock = 'peak' | 'focus' | 'admin' | 'rest';
type Phase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea';

const ENERGY_BLOCK_CONFIG: Record<EnergyBlock, { label: string; color: string; bg: string; emoji: string }> = {
  peak:  { label: 'Pico de energia',  color: '#D7897F', bg: 'rgba(215,137,127,.12)', emoji: '⚡' },
  focus: { label: 'Foco profundo',    color: '#6398A9', bg: 'rgba(99,152,169,.12)',  emoji: '🎯' },
  admin: { label: 'Tarefas admin',    color: '#96C7B3', bg: 'rgba(150,199,179,.12)', emoji: '📋' },
  rest:  { label: 'Descanso/pausa',   color: '#9B7AB8', bg: 'rgba(155,122,184,.12)', emoji: '🌙' },
};

// Agenda otimizada por fase do ciclo
const AGENDA_BY_PHASE: Record<Phase, Array<{ time: string; block: EnergyBlock; task: string; duration: string }>> = {
  folicular: [
    { time: '07:00', block: 'peak',  task: 'Planejamento semanal + prioridades',  duration: '45min' },
    { time: '08:00', block: 'peak',  task: 'Tarefa criativa principal',           duration: '90min' },
    { time: '09:30', block: 'rest',  task: 'Pausa + hidratação',                  duration: '15min' },
    { time: '09:45', block: 'focus', task: 'Reuniões e colaboração',              duration: '75min' },
    { time: '11:00', block: 'focus', task: 'Escrita ou apresentações',            duration: '60min' },
    { time: '12:00', block: 'rest',  task: 'Almoço sem telas',                   duration: '60min' },
    { time: '13:00', block: 'admin', task: 'E-mails e mensagens',                duration: '45min' },
    { time: '14:00', block: 'focus', task: 'Projeto de médio prazo',              duration: '90min' },
    { time: '15:30', block: 'rest',  task: 'Pausa + caminhada curta',            duration: '20min' },
    { time: '16:00', block: 'admin', task: 'Revisões e checklist',               duration: '60min' },
    { time: '17:00', block: 'rest',  task: 'Encerramento do dia',                duration: '30min' },
  ],
  ovulatoria: [
    { time: '07:00', block: 'peak',  task: 'Exercício ou meditação energizante', duration: '30min' },
    { time: '07:30', block: 'peak',  task: 'Tarefa mais difícil do dia',         duration: '90min' },
    { time: '09:00', block: 'peak',  task: 'Reuniões importantes / negociações', duration: '90min' },
    { time: '10:30', block: 'rest',  task: 'Pausa ativa',                        duration: '15min' },
    { time: '10:45', block: 'focus', task: 'Brainstorm ou criação de conteúdo',  duration: '75min' },
    { time: '12:00', block: 'rest',  task: 'Almoço social (bom dia pra isso!)',  duration: '60min' },
    { time: '13:00', block: 'focus', task: 'Tomada de decisões estratégicas',    duration: '60min' },
    { time: '14:00', block: 'admin', task: 'Networking e follow-ups',            duration: '60min' },
    { time: '15:00', block: 'focus', task: 'Execução de projeto',                duration: '90min' },
    { time: '16:30', block: 'admin', task: 'Organização e planejamento amanhã',  duration: '30min' },
  ],
  lutea: [
    { time: '08:00', block: 'focus', task: 'Análise de dados e relatórios',      duration: '90min' },
    { time: '09:30', block: 'rest',  task: 'Pausa + chá quente',                 duration: '15min' },
    { time: '09:45', block: 'focus', task: 'Revisão e edição de trabalhos',      duration: '75min' },
    { time: '11:00', block: 'admin', task: 'E-mails e organização',              duration: '60min' },
    { time: '12:00', block: 'rest',  task: 'Almoço leve + descanso',             duration: '60min' },
    { time: '13:00', block: 'admin', task: 'Tarefas rotineiras e listas',        duration: '60min' },
    { time: '14:00', block: 'focus', task: 'Leitura ou aprendizado',             duration: '60min' },
    { time: '15:00', block: 'rest',  task: 'Pausa mais longa — ouça seu corpo',  duration: '30min' },
    { time: '15:30', block: 'admin', task: 'Organização do espaço de trabalho',  duration: '45min' },
    { time: '16:30', block: 'rest',  task: 'Encerramento gentil do dia',         duration: '30min' },
  ],
  menstrual: [
    { time: '08:30', block: 'rest',  task: 'Despertar suave + automassagem',     duration: '30min' },
    { time: '09:00', block: 'admin', task: 'Tarefas leves de lista',             duration: '60min' },
    { time: '10:00', block: 'rest',  task: 'Pausa com calor (bolsa/chá)',        duration: '20min' },
    { time: '10:20', block: 'focus', task: 'Leitura, podcast ou aprendizado',    duration: '60min' },
    { time: '11:20', block: 'admin', task: 'E-mails essenciais apenas',          duration: '40min' },
    { time: '12:00', block: 'rest',  task: 'Almoço nutritivo + repouso',         duration: '75min' },
    { time: '13:15', block: 'admin', task: 'Reuniões curtas se necessário',      duration: '45min' },
    { time: '14:00', block: 'focus', task: 'Reflexão + journaling',              duration: '45min' },
    { time: '14:45', block: 'rest',  task: 'Descanso — sem culpa',               duration: '60min' },
    { time: '15:45', block: 'admin', task: 'Planejamento leve da semana',        duration: '30min' },
    { time: '16:15', block: 'rest',  task: 'Encerramento antecipado',            duration: '30min' },
  ],
};

const PHASE_LABELS: Record<Phase, { emoji: string; label: string; color: string }> = {
  menstrual:  { emoji: '🌙', label: 'Menstrual',  color: '#D7897F' },
  folicular:  { emoji: '🌱', label: 'Folicular',  color: '#5DAE8B' },
  ovulatoria: { emoji: '🚀', label: 'Ovulatória', color: '#6398A9' },
  lutea:      { emoji: '🌊', label: 'Lútea',      color: '#9B7AB8' },
};

export default function DailyAgendaScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { day, phase = 'folicular' } = (route.params || {}) as { day?: number; phase?: Phase };

  const agenda = AGENDA_BY_PHASE[phase];
  const phaseInfo = PHASE_LABELS[phase];
  const [done, setDone] = useState<Set<string>>(new Set());

  function toggleDone(time: string) {
    const next = new Set(done);
    next.has(time) ? next.delete(time) : next.add(time);
    setDone(next);
  }

  const doneCount = done.size;
  const totalCount = agenda.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agenda do Dia</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Phase header */}
        <View style={[styles.phaseCard, { borderLeftColor: phaseInfo.color }]}>
          <Text style={styles.phaseEmoji}>{phaseInfo.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.phaseLabel, { color: phaseInfo.color }]}>Fase {phaseInfo.label}</Text>
            <Text style={styles.phaseDate}>
              {day ? `Dia ${day}` : 'Hoje'} · Agenda otimizada para você
            </Text>
          </View>
          {/* Progress */}
          <View style={styles.progress}>
            <Text style={[styles.progressPct, { color: phaseInfo.color }]}>{pct}%</Text>
            <Text style={styles.progressSub}>{doneCount}/{totalCount}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${pct}%` as any, backgroundColor: phaseInfo.color }]} />
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          {agenda.map((item, i) => {
            const blockCfg = ENERGY_BLOCK_CONFIG[item.block];
            const isDone = done.has(item.time);
            return (
              <TouchableOpacity key={i} style={styles.timelineRow} onPress={() => toggleDone(item.time)} activeOpacity={0.7}>
                {/* Time */}
                <Text style={styles.timeLabel}>{item.time}</Text>

                {/* Line + dot */}
                <View style={styles.timelineTrack}>
                  <View style={[styles.timelineDot, { backgroundColor: isDone ? '#96C7B3' : blockCfg.color }]} />
                  {i < agenda.length - 1 && <View style={styles.timelineLine} />}
                </View>

                {/* Block card */}
                <View style={[styles.blockCard, { backgroundColor: isDone ? 'rgba(150,199,179,.1)' : blockCfg.bg }, isDone && styles.blockCardDone]}>
                  <View style={styles.blockTop}>
                    <Text style={styles.blockEmoji}>{blockCfg.emoji}</Text>
                    <Text style={[styles.blockType, { color: isDone ? '#96C7B3' : blockCfg.color }]}>{blockCfg.label}</Text>
                    <Text style={styles.blockDuration}>{item.duration}</Text>
                  </View>
                  <Text style={[styles.blockTask, isDone && styles.blockTaskDone]}>{item.task}</Text>
                  {isDone && <Text style={styles.doneCheck}>✓ Concluído</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
  phaseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: appSpacing.lg, backgroundColor: '#fff',
    borderRadius: appRadius.lg, padding: appSpacing.lg,
    borderLeftWidth: 4, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  phaseEmoji: { fontSize: 28 },
  phaseLabel: { fontSize: 14, fontWeight: '800' },
  phaseDate: { fontSize: 12, color: appColors.textSecondary, marginTop: 2 },
  progress: { alignItems: 'center' },
  progressPct: { fontSize: 20, fontWeight: '800' },
  progressSub: { fontSize: 10, color: appColors.textSecondary },
  progressBarTrack: {
    marginHorizontal: appSpacing.lg, height: 4, backgroundColor: '#f1f5f9',
    borderRadius: 999, overflow: 'hidden', marginBottom: appSpacing.lg,
  },
  progressBarFill: { height: '100%', borderRadius: 999 },
  timeline: { paddingHorizontal: appSpacing.lg },
  timelineRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  timeLabel: { width: 44, fontSize: 11, color: appColors.textSecondary, fontWeight: '600', paddingTop: 12 },
  timelineTrack: { width: 20, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 13 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginTop: 2 },
  blockCard: {
    flex: 1, borderRadius: appRadius.md, padding: 12, marginBottom: 2,
  },
  blockCardDone: { opacity: 0.75 },
  blockTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  blockEmoji: { fontSize: 13 },
  blockType: { fontSize: 11, fontWeight: '700', flex: 1 },
  blockDuration: { fontSize: 10, color: appColors.textSecondary, backgroundColor: 'rgba(0,0,0,.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  blockTask: { fontSize: 13, color: appColors.textPrimary, lineHeight: 18 },
  blockTaskDone: { textDecorationLine: 'line-through', color: appColors.textSecondary },
  doneCheck: { fontSize: 11, color: '#5DAE8B', fontWeight: '700', marginTop: 4 },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type Metric = 'humor' | 'energia' | 'hrv' | 'sono';

const METRIC_CONFIG: Record<Metric, { label: string; color: string; unit: string; emoji: string }> = {
  humor:   { label: 'Humor',   color: '#D7897F', unit: '/10', emoji: '😊' },
  energia: { label: 'Energia', color: '#6398A9', unit: '/10', emoji: '⚡' },
  hrv:     { label: 'HRV',     color: '#96C7B3', unit: 'ms',  emoji: '💚' },
  sono:    { label: 'Sono',    color: '#9B7AB8', unit: 'h',   emoji: '😴' },
};

// Dados simulados — 7 dias
const MOCK_DATA: Record<Metric, number[]> = {
  humor:   [7, 6, 8, 5, 7, 9, 8],
  energia: [6, 5, 8, 4, 7, 8, 9],
  hrv:     [42, 38, 55, 30, 48, 62, 58],
  sono:    [7.5, 6, 8, 5.5, 7, 8.5, 7],
};

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const AI_INSIGHTS = [
  { emoji: '📈', title: 'Padrão detectado', desc: 'Seu humor e energia sobem consistentemente quinta → domingo. Agende tarefas críticas nesses dias.' },
  { emoji: '😴', title: 'Sono e HRV correlacionados', desc: 'Nas noites com 8h+, seu HRV aumenta em média 18ms no dia seguinte. Priorize dormir antes das 23h.' },
  { emoji: '⚠️', title: 'Quarta-feira de baixa', desc: 'Energia e humor caem toda quarta. Considere reduzir reuniões e tarefas pesadas nesse dia.' },
  { emoji: '💡', title: 'Janela de pico', desc: 'Sexta e sábado são seus melhores dias — aproveite para criatividade, exercício e decisões importantes.' },
];

function MiniChart({ data, color, max }: { data: number[]; color: string; max: number }) {
  const H = 60;

  // SVG via View components (sem dependência externa)
  return (
    <View style={{ height: H, position: 'relative' }}>
      {/* Linhas de grade */}
      {[0.25, 0.5, 0.75].map(pct => (
        <View key={pct} style={{
          position: 'absolute', left: 0, right: 0,
          top: H * (1 - pct), height: 1,
          backgroundColor: 'rgba(0,0,0,.05)',
        }} />
      ))}
      {/* Barras simulando o gráfico */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 6 }}>
        {data.map((v, i) => {
          const barH = (v / max) * H;
          const isMax = v === Math.max(...data);
          const isMin = v === Math.min(...data);
          return (
            <View key={i} style={{ flex: 1, height: H, justifyContent: 'flex-end' }}>
              <View style={{
                height: barH, borderRadius: 4,
                backgroundColor: isMax ? color : isMin ? `${color}55` : `${color}88`,
              }} />
            </View>
          );
        })}
      </View>
      {/* Labels nos dias */}
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {DAYS.map(d => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: appColors.textSecondary }}>{d}</Text>
        ))}
      </View>
    </View>
  );
}

export default function EnergyMapScreen() {
  const navigation = useNavigation<any>();
  const [activeMetric, setActiveMetric] = useState<Metric>('humor');

  const data = MOCK_DATA[activeMetric];
  const cfg = METRIC_CONFIG[activeMetric];
  const avg = (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1);
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const trend = data[data.length - 1] > data[0] ? '↑' : data[data.length - 1] < data[0] ? '↓' : '→';
  const trendColor = trend === '↑' ? '#5DAE8B' : trend === '↓' ? '#c0392b' : appColors.textSecondary;

  // Max para normalizar o gráfico
  const chartMax = activeMetric === 'hrv' ? 100 : activeMetric === 'sono' ? 10 : 10;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mapa de Energia</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Tabs de métrica */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {(Object.keys(METRIC_CONFIG) as Metric[]).map(m => {
            const c = METRIC_CONFIG[m];
            const active = m === activeMetric;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.tab, active && { backgroundColor: c.color }]}
                onPress={() => setActiveMetric(m)}
              >
                <Text style={styles.tabEmoji}>{c.emoji}</Text>
                <Text style={[styles.tabLabel, active && { color: '#fff' }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Gráfico principal */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{cfg.emoji} {cfg.label} — últimos 7 dias</Text>
            <Text style={[styles.chartTrend, { color: trendColor }]}>{trend}</Text>
          </View>

          <MiniChart data={data} color={cfg.color} max={chartMax} />

          {/* Stats resumo */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: cfg.color }]}>{avg}{cfg.unit}</Text>
              <Text style={styles.statLabel}>Média</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#5DAE8B' }]}>{maxVal}{cfg.unit}</Text>
              <Text style={styles.statLabel}>Máximo</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#c0392b' }]}>{minVal}{cfg.unit}</Text>
              <Text style={styles.statLabel}>Mínimo</Text>
            </View>
          </View>
        </View>

        {/* Comparativo fase do ciclo */}
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleTxt}>Por fase do ciclo</Text>
        </View>

        {[
          { phase: '🌙 Menstrual',  value: '5.8', delta: '-1.4' },
          { phase: '🌱 Folicular',  value: '7.6', delta: '+0.4' },
          { phase: '🚀 Ovulatória', value: '8.9', delta: '+1.7' },
          { phase: '🌊 Lútea',      value: '6.2', delta: '-1.0' },
        ].map(row => (
          <View key={row.phase} style={styles.phaseRow}>
            <Text style={styles.phaseRowLabel}>{row.phase}</Text>
            <View style={styles.phaseRowBar}>
              <View style={[styles.phaseRowFill, {
                width: `${(parseFloat(row.value) / 10) * 100}%` as any,
                backgroundColor: cfg.color,
              }]} />
            </View>
            <Text style={styles.phaseRowValue}>{row.value}</Text>
            <Text style={[styles.phaseRowDelta, { color: row.delta.startsWith('+') ? '#5DAE8B' : '#c0392b' }]}>
              {row.delta}
            </Text>
          </View>
        ))}

        {/* Insights IA */}
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleTxt}>🤖 Insights da Aura</Text>
        </View>

        {AI_INSIGHTS.map((insight, i) => (
          <View key={i} style={styles.insightCard}>
            <Text style={styles.insightEmoji}>{insight.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDesc}>{insight.desc}</Text>
            </View>
          </View>
        ))}

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
  tabs: { paddingHorizontal: appSpacing.lg, gap: 8, paddingBottom: appSpacing.md },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: appRadius.pill,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: appColors.borderSubtle,
  },
  tabEmoji: { fontSize: 14 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: appColors.textSecondary },
  chartCard: {
    marginHorizontal: appSpacing.lg, backgroundColor: '#fff',
    borderRadius: appRadius.lg, padding: appSpacing.lg,
    marginBottom: appSpacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: appSpacing.md },
  chartTitle: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary },
  chartTrend: { fontSize: 22, fontWeight: '800' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: appSpacing.lg },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: appColors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: appColors.borderSubtle },
  sectionTitle: { paddingHorizontal: appSpacing.lg, marginBottom: appSpacing.sm },
  sectionTitleTxt: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  phaseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: appSpacing.lg, marginBottom: 10,
  },
  phaseRowLabel: { width: 100, fontSize: 12, color: appColors.textSecondary },
  phaseRowBar: { flex: 1, height: 6, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden' },
  phaseRowFill: { height: '100%', borderRadius: 999 },
  phaseRowValue: { width: 30, fontSize: 12, fontWeight: '700', color: appColors.textPrimary, textAlign: 'right' },
  phaseRowDelta: { width: 36, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  insightCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    marginHorizontal: appSpacing.lg, backgroundColor: '#fff',
    borderRadius: appRadius.md, padding: appSpacing.lg,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  insightEmoji: { fontSize: 22, marginTop: 2 },
  insightTitle: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary, marginBottom: 4 },
  insightDesc: { fontSize: 12, color: appColors.textSecondary, lineHeight: 18 },
});

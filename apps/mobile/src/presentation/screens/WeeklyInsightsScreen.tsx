import React, { useEffect, useCallback } from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  ActivityIndicator, 
  IconButton, 
  Avatar, 
  ProgressBar, 
  Surface,
  Divider,
  MD3Colors
} from 'react-native-paper';
import { useInsightStore } from '../providers/insight_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideLineChart, LucideZap, LucideSmile, LucideCheckCircle2, LucideBrainCircuit, LucideArrowRight } from 'lucide-react-native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

/**
 * WeeklyInsightsScreen: Painel de análise semanal da IA com UI do Paper.
 */
export default function WeeklyInsightsScreen() {
  const { weeklyData, isLoading, error, fetchWeeklyInsights } = useInsightStore();
  const { userId } = useAuthStore();

  const load = useCallback(() => {
    if (!userId) return;
    const today = new Date();
    const sunday = new Date(today.setDate(today.getDate() - today.getDay()));
    const weekStartStr = sunday.toISOString().split('T')[0];
    fetchWeeklyInsights(userId, weekStartStr);
  }, [userId, fetchWeeklyInsights]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appColors.background }}>
        <ActivityIndicator animating size="large" color={appColors.primary} />
        <Text variant="bodyMedium" style={{ marginTop: appSpacing.md, color: appColors.textSecondary, fontWeight: '500' }}>
          IA está analisando sua semana...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: appSpacing.lg, backgroundColor: appColors.background }}>
        <Avatar.Icon size={64} icon="alert-circle-outline" style={{ backgroundColor: MD3Colors.error95 }} color={MD3Colors.error40} />
        <Text variant="bodyMedium" style={{ color: appColors.danger, textAlign: 'center', marginVertical: appSpacing.md }}>
          {error}
        </Text>
        <Button mode="contained" onPress={load}>Tentar novamente</Button>
      </View>
    );
  }

  if (!weeklyData) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: appSpacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text variant="labelLarge" style={{ color: appColors.textSecondary }}>Sua ciclagem</Text>
            <Text variant="headlineMedium" style={{ color: appColors.textPrimary, fontWeight: '700', marginTop: 4 }}>
              Insights da semana
            </Text>
          </View>
          <Avatar.Icon size={48} icon="chart-line" style={{ backgroundColor: appColors.primarySoft }} color={appColors.primary} />
        </View>

        {/* Resumo Numérico (Grid) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: appSpacing.xl }}>
          <StatCard 
            label="Humor Médio" 
            value={`${weeklyData.summary.avgMood}/5`} 
            icon="emoticon-happy-outline"
            color={MD3Colors.primary40}
          />
          <StatCard 
            label="Energia Média" 
            value={`${weeklyData.summary.avgEnergy}/5`} 
            icon="lightning-bolt-outline"
            color={MD3Colors.tertiary50}
          />
          <StatCard 
            label="Check-ins" 
            value={weeklyData.summary.checkinCount.toString()} 
            icon="calendar-check-outline"
            color={MD3Colors.secondary50}
          />
          <StatCard 
            label="Produtividade" 
            value={`${Math.round((weeklyData.summary.tasksCompleted / (weeklyData.summary.tasksTotal || 1)) * 100)}%`} 
            icon="trending-up"
            color={MD3Colors.neutral40}
          />
        </View>

        {/* Padrões Detectados (IA) */}
        <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: appSpacing.md }}>
          Padrões identificados
        </Text>
        <View style={{ marginBottom: appSpacing.xl }}>
          {weeklyData.patterns.map((pattern, index) => (
            <Card key={index} style={{ marginBottom: appSpacing.sm, backgroundColor: appColors.surface }} mode="outlined">
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text variant="labelSmall" style={{ fontWeight: '700', color: appColors.primary, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                    {pattern.type}
                  </Text>
                  <View style={{ marginLeft: 8, paddingHorizontal: 6, borderRadius: 4, backgroundColor: pattern.confidence === 'high' ? MD3Colors.primary95 : MD3Colors.secondary95 }}>
                    <Text variant="labelSmall" style={{ fontSize: 8 }}>Confiança: {pattern.confidence}</Text>
                  </View>
                </View>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{pattern.description}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* Recomendações (Ação) */}
        <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: appSpacing.md }}>
          Ações recomendadas
        </Text>
        <View style={{ marginBottom: appSpacing.xl }}>
          {weeklyData.recommendations.map((rec, index) => (
            <Surface key={index} style={{ borderRadius: appRadius.md, marginBottom: appSpacing.sm, backgroundColor: appColors.primary, overflow: 'hidden' }} elevation={1}>
              <Button 
                mode="text" 
                textColor="#0b1120" 
                onPress={() => {}}
                contentStyle={{ justifyContent: 'space-between', paddingVertical: 4 }}
                labelStyle={{ fontWeight: '700', flex: 1, textAlign: 'left' }}
                icon="arrow-right"
              >
                {rec.text}
              </Button>
            </Surface>
          ))}
        </View>

        {/* Análise Narrativa */}
        <Card style={{ backgroundColor: MD3Colors.secondary99, borderRadius: appRadius.lg }} mode="outlined">
          <Card.Content>
            <Text variant="labelSmall" style={{ color: appColors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 8 }}>
              RESUMO DA IA
            </Text>
            <Text variant="bodyMedium" style={{ fontStyle: 'italic', lineHeight: 22 }}>
              "{weeklyData.aiAnalysis}"
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <Card style={{ width: '47.5%', backgroundColor: appColors.surface }} mode="outlined">
      <Card.Content style={{ padding: appSpacing.sm + 4 }}>
        <IconButton icon={icon} iconColor={color} size={20} style={{ margin: 0, marginLeft: -8 }} />
        <Text variant="labelSmall" style={{ color: appColors.textSecondary, marginTop: 4 }}>{label}</Text>
        <Text variant="titleLarge" style={{ fontWeight: '800', marginTop: 2 }}>{value}</Text>
      </Card.Content>
    </Card>
  );
}

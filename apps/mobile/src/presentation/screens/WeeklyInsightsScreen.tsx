import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useInsightStore } from '../providers/insight_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideLineChart, LucideZap, LucideSmile, LucideCheckCircle2, LucideBrainCircuit, LucideArrowRight } from 'lucide-react-native';
import { appColors, appRadius, appSpacing, appTypography } from '../theme/appTheme';

/**
 * WeeklyInsightsScreen: Painel de análise semanal da IA.
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
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: appColors.background,
        }}
      >
        <ActivityIndicator size="large" color={appColors.primary} />
        <Text
          style={{
            marginTop: appSpacing.md,
            color: appColors.textSecondary,
            fontWeight: '500',
          }}
        >
          IA está analisando sua semana...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: appSpacing.lg,
          backgroundColor: appColors.background,
        }}
      >
        <Text
          style={{
            color: appColors.danger,
            textAlign: 'center',
            marginBottom: appSpacing.md,
          }}
        >
          {error}
        </Text>
        <TouchableOpacity
          onPress={load}
          style={{
            backgroundColor: appColors.primary,
            paddingHorizontal: appSpacing.lg,
            paddingVertical: appSpacing.sm + 2,
            borderRadius: appRadius.pill,
          }}
        >
          <Text
            style={{
              color: '#0b1120',
              fontWeight: '700',
            }}
          >
            Tentar novamente
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!weeklyData) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: appSpacing.lg,
          paddingTop: appSpacing.lg,
          paddingBottom: appSpacing.xl * 3,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            marginBottom: appSpacing.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text
              style={{
                color: appColors.textSecondary,
                fontWeight: '500',
              }}
            >
              Sua ciclagem
            </Text>
            <Text
              style={{
                ...appTypography.title,
                color: appColors.textPrimary,
                marginTop: 4,
              }}
            >
              Insights da semana
            </Text>
          </View>
          <LucideLineChart size={28} color={appColors.primary} />
        </View>

        {/* Resumo Numérico (Grid) */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            marginBottom: appSpacing.xl,
          }}
        >
          <StatCard 
            label="Humor Médio" 
            value={`${weeklyData.summary.avgMood}/5`} 
            icon={<LucideSmile size={18} color="#10b981" />}
            color={appColors.surface}
          />
          <StatCard 
            label="Energia Média" 
            value={`${weeklyData.summary.avgEnergy}/5`} 
            icon={<LucideZap size={18} color="#f59e0b" />}
            color={appColors.surface}
          />
          <StatCard 
            label="Check-ins" 
            value={weeklyData.summary.checkinCount.toString()} 
            icon={<LucideCheckCircle2 size={18} color="#3b82f6" />}
            color={appColors.surface}
          />
          <StatCard 
            label="Produtividade" 
            value={`${Math.round((weeklyData.summary.tasksCompleted / (weeklyData.summary.tasksTotal || 1)) * 100)}%`} 
            icon={<LucideLineChart size={18} color="#8b5cf6" />}
            color={appColors.surface}
          />
        </View>

        {/* Padrões Detectados (IA) */}
        <SectionTitle title="Padrões identificados" icon={<LucideBrainCircuit size={20} color={appColors.textSecondary} />} />
        <View style={{ marginBottom: appSpacing.xl }}>
          {weeklyData.patterns.map((pattern, index) => (
            <View
              key={index}
              style={{
                backgroundColor: appColors.surface,
                padding: appSpacing.md,
                borderRadius: appRadius.md,
                marginBottom: appSpacing.sm,
                borderLeftWidth: 3,
                borderLeftColor: appColors.primary,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: appColors.primary,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginRight: appSpacing.xs,
                  }}
                >
                  {pattern.type}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 6,
                    borderRadius: 999,
                    backgroundColor: pattern.confidence === 'high' ? 'rgba(34,197,94,0.14)' : 'rgba(249,115,22,0.14)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 8,
                      fontWeight: '700',
                      color: appColors.textSecondary,
                    }}
                  >
                    Confiança: {pattern.confidence}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  color: appColors.textPrimary,
                  fontSize: 13,
                  fontWeight: '500',
                }}
              >
                {pattern.description}
              </Text>
            </View>
          ))}
        </View>

        {/* Recomendações (Ação) */}
        <SectionTitle title="Ações recomendadas" icon={<LucideCheckCircle2 size={20} color={appColors.textSecondary} />} />
        <View style={{ marginBottom: appSpacing.xl }}>
          {weeklyData.recommendations.map((rec, index) => (
            <TouchableOpacity
              key={index}
              style={{
                backgroundColor: appColors.primary,
                padding: appSpacing.md,
                borderRadius: appRadius.md,
                marginBottom: appSpacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: '#0b1120',
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  {rec.category}
                </Text>
                <Text
                  style={{
                    color: '#0b1120',
                    fontWeight: '700',
                  }}
                >
                  {rec.text}
                </Text>
              </View>
              <LucideArrowRight size={20} color="#0b1120" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Análise Narrativa */}
        <View
          style={{
            backgroundColor: appColors.surface,
            padding: appSpacing.xl,
            borderRadius: appRadius.lg,
            marginBottom: appSpacing.xl,
          }}
        >
          <Text
            style={{
              color: appColors.primary,
              fontWeight: '700',
              marginBottom: 4,
              textTransform: 'uppercase',
              fontSize: 11,
              letterSpacing: 1.6,
            }}
          >
            Resumo da IA
          </Text>
          <Text
            style={{
              color: appColors.textPrimary,
              fontStyle: 'italic',
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            "{weeklyData.aiAnalysis}"
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Componente de Card de Estatística
 */
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View
      style={{
        width: '48%',
        backgroundColor: color,
        padding: appSpacing.md,
        borderRadius: appRadius.md,
        marginBottom: appSpacing.md,
        borderWidth: 1,
        borderColor: appColors.borderSubtle,
      }}
    >
      <View style={{ marginBottom: appSpacing.xs }}>{icon}</View>
      <Text
        style={{
          color: appColors.textSecondary,
          fontSize: 12,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: appColors.textPrimary,
          fontSize: 20,
          fontWeight: '700',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Título de Seção Padronizado
 */
function SectionTitle({ title, icon }: { title: string; icon: any }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: appSpacing.md,
      }}
    >
      {icon}
      <Text
        style={{
          ...appTypography.subtitle,
          color: appColors.textPrimary,
          marginLeft: appSpacing.sm,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

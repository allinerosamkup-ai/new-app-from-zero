import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useInsightStore } from '../providers/insight_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideLineChart, LucideZap, LucideSmile, LucideCheckCircle2, LucideBrainCircuit, LucideArrowRight } from 'lucide-react-native';

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
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-400 font-medium">IA está analisando sua semana...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-white">
        <Text className="text-red-500 text-center mb-4">{error}</Text>
        <TouchableOpacity
          onPress={load}
          className="bg-blue-600 px-6 py-3 rounded-full"
        >
          <Text className="text-white font-bold">Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!weeklyData) return null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-8 flex-row items-center justify-between">
          <View>
            <Text className="text-gray-400 font-medium">Sua Ciclagem</Text>
            <Text className="text-2xl font-bold text-gray-800">Insights da Semana</Text>
          </View>
          <LucideLineChart size={28} color="#3b82f6" />
        </View>

        {/* Resumo Numérico (Grid) */}
        <View className="flex-row flex-wrap justify-between mb-8">
          <StatCard 
            label="Humor Médio" 
            value={`${weeklyData.summary.avgMood}/5`} 
            icon={<LucideSmile size={18} color="#10b981" />}
            color="bg-green-50"
          />
          <StatCard 
            label="Energia Média" 
            value={`${weeklyData.summary.avgEnergy}/5`} 
            icon={<LucideZap size={18} color="#f59e0b" />}
            color="bg-yellow-50"
          />
          <StatCard 
            label="Check-ins" 
            value={weeklyData.summary.checkinCount.toString()} 
            icon={<LucideCheckCircle2 size={18} color="#3b82f6" />}
            color="bg-blue-50"
          />
          <StatCard 
            label="Produtividade" 
            value={`${Math.round((weeklyData.summary.tasksCompleted / (weeklyData.summary.tasksTotal || 1)) * 100)}%`} 
            icon={<LucideLineChart size={18} color="#8b5cf6" />}
            color="bg-purple-50"
          />
        </View>

        {/* Padrões Detectados (IA) */}
        <SectionTitle title="Padrões Identificados" icon={<LucideBrainCircuit size={20} color="#374151" />} />
        <View className="mb-8">
          {weeklyData.patterns.map((pattern, index) => (
            <View key={index} className="bg-gray-50 p-4 rounded-2xl mb-3 border-l-4 border-blue-500">
              <View className="flex-row items-center mb-1">
                <Text className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter mr-2">
                  {pattern.type}
                </Text>
                <View className={`px-1.5 rounded-full ${pattern.confidence === 'high' ? 'bg-green-100' : 'bg-orange-100'}`}>
                  <Text className="text-[8px] font-bold">Confiança: {pattern.confidence}</Text>
                </View>
              </View>
              <Text className="text-gray-800 text-sm font-medium">{pattern.description}</Text>
            </View>
          ))}
        </View>

        {/* Recomendações (Ação) */}
        <SectionTitle title="Ações Recomendadas" icon={<LucideCheckCircle2 size={20} color="#374151" />} />
        <View className="mb-8">
          {weeklyData.recommendations.map((rec, index) => (
            <TouchableOpacity key={index} className="bg-blue-600 p-4 rounded-2xl mb-3 flex-row items-center">
              <View className="flex-1">
                <Text className="text-blue-100 text-[10px] font-bold uppercase mb-1">{rec.category}</Text>
                <Text className="text-white font-bold">{rec.text}</Text>
              </View>
              <LucideArrowRight size={20} color="white" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Análise Narrativa */}
        <View className="bg-indigo-50 p-6 rounded-3xl mb-10">
          <Text className="text-indigo-800 font-bold mb-2 uppercase text-xs tracking-widest">Resumo da IA</Text>
          <Text className="text-indigo-900 italic text-base leading-relaxed">
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
    <View className={`w-[48%] ${color} p-4 rounded-2xl mb-4`}>
      <View className="mb-2">{icon}</View>
      <Text className="text-gray-500 text-xs font-medium">{label}</Text>
      <Text className="text-xl font-bold text-gray-800">{value}</Text>
    </View>
  );
}

/**
 * Título de Seção Padronizado
 */
function SectionTitle({ title, icon }: { title: string; icon: any }) {
  return (
    <View className="flex-row items-center mb-4">
      {icon}
      <Text className="text-lg font-bold text-gray-800 ml-2">{title}</Text>
    </View>
  );
}

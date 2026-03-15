import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCheckinStore } from '../providers/checkin_store';
import { usePlannerStore } from '../providers/planner_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideSparkles, LucideMessageCircle, LucideCalendar, LucidePlusCircle } from 'lucide-react-native';

/**
 * HomeScreen: Hub central do usuário.
 */
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { userId } = useAuthStore();
  const { todayCheckin, isLoading: checkinLoading } = useCheckinStore();
  const { blocks, fetchBlocks, isLoading: plannerLoading } = usePlannerStore();

  useEffect(() => {
    if (!userId) return;
    const dateStr = new Date().toISOString().split('T')[0];
    fetchBlocks(userId, dateStr);
  }, [userId]);

  const stateColors: Record<string, string> = {
    leve: 'bg-green-50 border-green-200 text-green-800',
    moderado: 'bg-blue-50 border-blue-200 text-blue-800',
    sensível: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    crítico: 'bg-red-50 border-red-200 text-red-800',
  };

  const currentType = todayCheckin?.stateLabelType || 'moderado';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4">
        {/* Header de Boas-vindas */}
        <View className="mb-8">
          <Text className="text-gray-400 font-medium">Bom dia,</Text>
          <Text className="text-2xl font-bold text-gray-800">Ciclagem & Humor</Text>
        </View>

        {/* AI State Card (Destaque Central) */}
        {todayCheckin ? (
          <View className={`p-6 rounded-3xl border ${stateColors[currentType]} mb-8`}>
            <View className="flex-row items-center mb-3">
              <LucideSparkles size={20} color={currentType === 'crítico' ? '#991B1B' : '#1E40AF'} />
              <Text className="text-lg font-bold ml-2 uppercase tracking-widest">
                {todayCheckin.stateLabel}
              </Text>
            </View>
            <Text className="text-gray-700 text-base leading-relaxed mb-4">
              {todayCheckin.aiState.analysis}
            </Text>
            <View className="bg-white/50 p-3 rounded-xl">
              <Text className="text-xs font-bold text-gray-500 mb-1 uppercase">Sugestão IA</Text>
              <Text className="text-gray-800 italic">"{todayCheckin.aiState.recommendations[0]}"</Text>
            </View>
          </View>
        ) : (
          <View className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8 items-center">
            <Text className="text-gray-400 text-center mb-4">Ainda não sei como você está hoje.</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Checkin')}
              className="bg-blue-600 px-6 py-3 rounded-full flex-row items-center"
            >
              <LucidePlusCircle size={20} color="white" />
              <Text className="text-white font-bold ml-2">Fazer Check-in</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Atalhos Rápidos */}
        <View className="flex-row space-x-4 mb-8">
          <TouchableOpacity
            onPress={() => navigation.navigate('Diário')}
            className="flex-1 bg-gray-50 p-4 rounded-2xl items-center border border-gray-100"
          >
            <LucideMessageCircle size={24} color="#3b82f6" />
            <Text className="text-gray-800 font-bold mt-2">Diário</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Planner')}
            className="flex-1 bg-gray-50 p-4 rounded-2xl items-center border border-gray-100"
          >
            <LucideCalendar size={24} color="#3b82f6" />
            <Text className="text-gray-800 font-bold mt-2">Planner</Text>
          </TouchableOpacity>
        </View>

        {/* Preview do Planner (Agenda de Hoje) */}
        <View className="mb-10">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800">Próximo na agenda</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Planner')}>
              <Text className="text-blue-600 font-bold">Ver tudo</Text>
            </TouchableOpacity>
          </View>

          {plannerLoading ? (
            <ActivityIndicator color="#3b82f6" />
          ) : blocks.length > 0 ? (
            blocks.slice(0, 3).map((block) => (
              <View key={block.id} className="flex-row items-center mb-4 bg-gray-50 p-4 rounded-2xl border-l-4 border-blue-400">
                <View className="w-12">
                  <Text className="text-gray-400 font-bold text-[10px]">{block.startTime}</Text>
                </View>
                <View className="flex-1 pl-4">
                  <Text className="text-gray-800 font-bold">{block.title}</Text>
                  <Text className="text-gray-500 text-xs">Intensidade: {block.intensity}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-gray-400 italic text-center py-4">Sua agenda está livre por enquanto.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

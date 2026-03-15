import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { LucideCheckCircle2, LucideSparkles, LucideHeart, LucideLightbulb, LucideArrowRight } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * DailySummaryScreen: Tela de feedback pós-diário ou check-in.
 * Exibe o processamento da IA de forma acolhedora.
 */
export default function DailySummaryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  // Dados vindos da navegação (ou mock para o MVP)
  const summaryData = route.params?.summary || {
    text: "Hoje você trouxe reflexões profundas sobre o equilíbrio entre trabalho e descanso. Parece que reconhecer seus limites está sendo um passo importante para sua regulação de energia.",
    emotions: ["cansada", "reflexiva", "esperançosa"],
    themes: ["trabalho", "autocuidado"],
    suggestions: ["Tente uma pausa de 10 min sem telas agora.", "Que tal uma bebida quente para relaxar?"]
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
        {/* Ícone de Sucesso */}
        <View className="items-center mb-6">
          <View className="bg-green-100 p-4 rounded-full">
            <LucideCheckCircle2 size={40} color="#10b981" />
          </View>
          <Text className="text-2xl font-bold text-gray-800 mt-4 text-center">
            Sessão Concluída
          </Text>
          <Text className="text-gray-500 text-center mt-1">
            Aqui está o que sua IA percebeu
          </Text>
        </View>

        {/* Emoções Detectadas (Tags) */}
        <View className="flex-row flex-wrap justify-center mb-8">
          {summaryData.emotions.map((emotion: string, index: number) => (
            <View key={index} className="bg-blue-50 px-4 py-2 rounded-full m-1 border border-blue-100 flex-row items-center">
              <LucideHeart size={14} color="#3b82f6" />
              <Text className="text-blue-600 font-bold ml-2 capitalize">{emotion}</Text>
            </View>
          ))}
        </View>

        {/* Card Principal de Resumo */}
        <View className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8">
          <View className="flex-row items-center mb-3">
            <LucideSparkles size={20} color="#9333ea" />
            <Text className="text-purple-700 font-bold ml-2 uppercase text-xs tracking-widest">
              Síntese da Conversa
            </Text>
          </View>
          <Text className="text-gray-800 text-lg leading-relaxed italic">
            "{summaryData.text}"
          </Text>
        </View>

        {/* Temas e Sugestões */}
        <View className="mb-10">
          <View className="flex-row items-center mb-4">
            <LucideLightbulb size={20} color="#f59e0b" />
            <Text className="text-lg font-bold text-gray-800 ml-2">Sugestões para agora</Text>
          </View>
          
          {summaryData.suggestions.map((suggestion: string, index: number) => (
            <View key={index} className="bg-white border border-gray-100 p-4 rounded-2xl mb-3 shadow-sm flex-row items-center">
              <View className="w-2 h-2 bg-yellow-400 rounded-full mr-3" />
              <Text className="text-gray-700 flex-1">{suggestion}</Text>
            </View>
          ))}
        </View>

        {/* Botão de Finalização */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('MainTabs' as any)}
          className="bg-blue-600 p-5 rounded-2xl flex-row justify-center items-center mb-10"
        >
          <Text className="text-white font-bold text-lg">Voltar para o Início</Text>
          <LucideArrowRight size={20} color="white" className="ml-2" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

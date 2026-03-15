import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { usePlannerStore, TimelineBlock } from '../providers/planner_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideSparkles, LucidePlus, LucideChevronLeft, LucideChevronRight, LucideLightbulb, LucideX } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

/**
 * PlannerScreen: Versão com Drag-and-drop fluido.
 * Tradução definitiva do Flutter para React Native (Expo).
 */
const CATEGORIES: TimelineBlock['category'][] = ['trabalho', 'pessoal', 'autocuidado', 'social', 'outro'];
const INTENSITIES: { label: string; value: TimelineBlock['intensity'] }[] = [
  { label: 'Leve', value: 'L' },
  { label: 'Médio', value: 'M' },
  { label: 'Pesado', value: 'P' },
];

export default function PlannerScreen() {
  const {
    selectedDate,
    blocks,
    isLoading,
    fetchBlocks,
    setSelectedDate,
    moveBlock,
    syncBlocks,
  } = usePlannerStore();
  const { userId } = useAuthStore();

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [newCategory, setNewCategory] = useState<TimelineBlock['category']>('trabalho');
  const [newIntensity, setNewIntensity] = useState<TimelineBlock['intensity']>('M');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchBlocks(userId, selectedDate);
    }
  }, [selectedDate, userId, fetchBlocks]);

  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleOpenModal = () => {
    setNewTitle('');
    setNewStartTime('09:00');
    setNewEndTime('10:00');
    setNewCategory('trabalho');
    setNewIntensity('M');
    setShowModal(true);
  };

  const handleSaveBlock = async () => {
    if (!userId || !newTitle.trim()) return;
    setIsSaving(true);
    await syncBlocks(userId, selectedDate, [
      {
        title: newTitle.trim(),
        startTime: newStartTime,
        endTime: newEndTime,
        category: newCategory,
        intensity: newIntensity,
        status: 'planned',
        isAiSuggested: false,
      },
    ]);
    await fetchBlocks(userId, selectedDate);
    setIsSaving(false);
    setShowModal(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
        {/* Date Navigator */}
        <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={() => changeDate(-1)} className="p-2">
            <LucideChevronLeft size={24} color="#374151" />
          </TouchableOpacity>
          
          <View className="items-center">
            <Text className="text-lg font-bold text-gray-800">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short' 
              })}
            </Text>
            <Text className="text-xs text-gray-500 uppercase tracking-widest">
              Timeline do Dia
            </Text>
          </View>

          <TouchableOpacity onPress={() => changeDate(1)} className="p-2">
            <LucideChevronRight size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Timeline View */}
        <View className="flex-1">
          {isLoading && blocks.length === 0 ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <ScrollView 
              className="flex-1"
              contentContainerStyle={{ height: 24 * 60 + 100 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Hour lines */}
              {Array.from({ length: 24 }).map((_, hour) => (
                <View 
                  key={hour} 
                  style={{ top: hour * 60 }}
                  className="absolute left-0 right-0 h-[1px] bg-gray-100 flex-row items-center"
                >
                  <View className="w-14 items-end pr-2">
                    <Text className="text-[10px] text-gray-400 font-medium">
                      {hour.toString().padStart(2, '0')}:00
                    </Text>
                  </View>
                  <View className="flex-1 h-[1px] bg-gray-100" />
                </View>
              ))}

              {/* Draggable Blocks */}
              {blocks.map((block) => (
                <DraggableBlock 
                  key={block.id} 
                  block={block} 
                  onMove={(newStartTime) => moveBlock(block.id, newStartTime)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Floating Actions Bar */}
        <View className="absolute bottom-6 left-6 right-6 flex-row justify-between items-center">
          <TouchableOpacity className="w-14 h-14 bg-purple-600 rounded-full items-center justify-center shadow-lg">
            <LucideLightbulb size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            className="w-16 h-16 bg-blue-600 rounded-full items-center justify-center shadow-xl border-4 border-white"
            onPress={handleOpenModal}
          >
            <LucidePlus size={32} color="white" />
          </TouchableOpacity>
        </View>

        {/* Modal: Novo Bloco */}
        <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end">
            <View className="bg-white rounded-t-3xl p-6 shadow-xl">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-800">Novo Bloco</Text>
                <TouchableOpacity onPress={() => setShowModal(false)} className="p-1">
                  <LucideX size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Título */}
              <Text className="text-sm font-semibold text-gray-600 mb-1">O que você vai fazer?</Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-3 text-gray-800 mb-4"
                placeholder="Ex: Foco no projeto, Caminhada..."
                value={newTitle}
                onChangeText={setNewTitle}
              />

              {/* Horários */}
              <View className="flex-row space-x-3 mb-4">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-600 mb-1">Início (HH:MM)</Text>
                  <TextInput
                    className="bg-gray-100 rounded-xl px-4 py-3 text-gray-800 text-center"
                    placeholder="09:00"
                    value={newStartTime}
                    onChangeText={setNewStartTime}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-600 mb-1">Fim (HH:MM)</Text>
                  <TextInput
                    className="bg-gray-100 rounded-xl px-4 py-3 text-gray-800 text-center"
                    placeholder="10:00"
                    value={newEndTime}
                    onChangeText={setNewEndTime}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              </View>

              {/* Categoria */}
              <Text className="text-sm font-semibold text-gray-600 mb-2">Categoria</Text>
              <View className="flex-row flex-wrap mb-4">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setNewCategory(cat)}
                    className={`mr-2 mb-2 px-3 py-1.5 rounded-full border ${
                      newCategory === cat ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                    }`}
                  >
                    <Text className={`text-xs font-semibold capitalize ${newCategory === cat ? 'text-white' : 'text-gray-600'}`}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Intensidade */}
              <Text className="text-sm font-semibold text-gray-600 mb-2">Intensidade</Text>
              <View className="flex-row space-x-3 mb-6">
                {INTENSITIES.map(({ label, value }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setNewIntensity(value)}
                    className={`flex-1 py-2 rounded-xl border items-center ${
                      newIntensity === value ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                    }`}
                  >
                    <Text className={`text-sm font-bold ${newIntensity === value ? 'text-white' : 'text-gray-600'}`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Botão Salvar */}
              <TouchableOpacity
                onPress={handleSaveBlock}
                disabled={isSaving || !newTitle.trim()}
                className={`py-4 rounded-2xl items-center ${
                  isSaving || !newTitle.trim() ? 'bg-gray-300' : 'bg-blue-600'
                }`}
              >
                {isSaving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">Adicionar ao Planner</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
  );
}

/**
 * DraggableBlock: Bloco interativo que responde a gestos (Drag-and-drop).
 * Tradução da lógica de Draggable do Flutter para Reanimated.
 */
function DraggableBlock({ block, onMove }: { block: TimelineBlock; onMove: (newStart: string) => void }) {
  const [startH, startM] = block.startTime.split(':').map(Number);
  const [endH, endM] = block.endTime.split(':').map(Number);
  
  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = endH * 60 + endM;
  const initialDuration = Math.max(endTotalMinutes - startTotalMinutes, 30);

  // Reanimated shared value para a posição vertical
  const translateY = useSharedValue(startTotalMinutes);
  const isDragging = useSharedValue(false);

  // Sincroniza translateY quando startTime muda via props (store update após drag)
  // useSharedValue não reinicializa em re-renders, então é necessário sincronizar manualmente
  useEffect(() => {
    if (!isDragging.value) {
      translateY.value = startTotalMinutes;
    }
  }, [startTotalMinutes]);

  // Lógica do Gesto (Pan Gesture)
  const gesture = Gesture.Pan()
    .activeOffsetY([-8, 8])   // Fix: distingue drag vertical de scroll da tela
    .failOffsetX([-10, 10])   // Fix: cancela o gesto se houver movimento horizontal antes
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      // Movimentação fluida baseada no arraste
      translateY.value = startTotalMinutes + event.translationY;
    })
    .onEnd(() => {
      isDragging.value = false;

      // Lógica de "Snap" (arredondar para o múltiplo de 15 minutos mais próximo)
      // Fix: clampa entre 00:00 (0) e 23:45 (1425) para não sair da timeline
      const rawY = Math.round(translateY.value / 15) * 15;
      const finalY = Math.max(0, Math.min(rawY, 23 * 60 + 45));
      translateY.value = withSpring(finalY);

      // Converter novo Y de volta para HH:mm e avisar o Store
      const hours = Math.floor(finalY / 60);
      const minutes = finalY % 60;
      const newTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      runOnJS(onMove)(newTime);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    // Fix: scale deve estar dentro de transform[], não como prop solta
    transform: [
      { translateY: translateY.value },
      { scale: withSpring(isDragging.value ? 1.05 : 1) },
    ],
    zIndex: isDragging.value ? 100 : 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: withSpring(isDragging.value ? 0.3 : 0),
    shadowRadius: 8,
    elevation: isDragging.value ? 8 : 0,
  }));

  const categoryColors = {
    trabalho: 'bg-blue-100 border-blue-300',
    pessoal: 'bg-green-100 border-green-300',
    autocuidado: 'bg-purple-100 border-purple-300',
    social: 'bg-orange-100 border-orange-300',
    outro: 'bg-gray-100 border-gray-300',
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 60,
            right: 16,
            height: initialDuration,
          },
          animatedStyle,
        ]}
        className={`p-2 rounded-xl border-l-4 ${categoryColors[block.category]} ${
          block.isAiSuggested ? 'border-purple-500' : ''
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 pr-2">
            <Text className="font-bold text-gray-800 text-[11px]" numberOfLines={1}>
              {block.title}
            </Text>
            {block.isAiSuggested && (
              <View className="ml-1">
                <LucideSparkles size={10} color="#9333ea" />
              </View>
            )}
          </View>
        </View>
        
        <Text className="text-[9px] text-gray-500 font-medium">
          {block.startTime} — {block.endTime}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

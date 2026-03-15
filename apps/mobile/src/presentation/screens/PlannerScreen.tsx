import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { usePlannerStore, TimelineBlock } from '../providers/planner_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideSparkles, LucidePlus, LucideChevronLeft, LucideChevronRight, LucideLightbulb, LucideX } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { appColors, appRadius, appSpacing, appTypography } from '../theme/appTheme';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      {/* Date Navigator */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: appSpacing.lg,
          paddingVertical: appSpacing.md,
          borderBottomWidth: 0,
        }}
      >
        <TouchableOpacity onPress={() => changeDate(-1)} style={{ padding: appSpacing.sm }}>
          <LucideChevronLeft size={22} color={appColors.textSecondary} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              ...appTypography.subtitle,
              color: appColors.textPrimary,
            }}
          >
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: appColors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            Timeline do Dia
          </Text>
        </View>

        <TouchableOpacity onPress={() => changeDate(1)} style={{ padding: appSpacing.sm }}>
          <LucideChevronRight size={22} color={appColors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Timeline View */}
      <View style={{ flex: 1 }}>
        {isLoading && blocks.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={appColors.primary} />
          </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ height: 24 * 60 + 120 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hour lines */}
            {Array.from({ length: 24 }).map((_, hour) => (
              <View
                key={hour}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: hour * 60,
                  height: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 56,
                    alignItems: 'flex-end',
                    paddingRight: appSpacing.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: appColors.textSecondary,
                      fontWeight: '500',
                    }}
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: appColors.borderSubtle,
                    opacity: 0.35,
                  }}
                />
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
      <View
        style={{
          position: 'absolute',
          bottom: appSpacing.xl * 1.2,
          left: appSpacing.lg,
          right: appSpacing.lg,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          style={{
            width: 56,
            height: 56,
            borderRadius: appRadius.pill,
            backgroundColor: appColors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: appColors.borderSubtle,
          }}
        >
          <LucideLightbulb size={24} color={appColors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            width: 64,
            height: 64,
            borderRadius: appRadius.pill,
            backgroundColor: appColors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: appColors.surfaceAlt,
          }}
          onPress={handleOpenModal}
        >
          <LucidePlus size={32} color="white" />
        </TouchableOpacity>
      </View>

      {/* Modal: Novo Bloco */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View
            style={{
              backgroundColor: appColors.surfaceAlt,
              borderTopLeftRadius: appRadius.lg * 1.3,
              borderTopRightRadius: appRadius.lg * 1.3,
              padding: appSpacing.lg,
              borderTopWidth: 1,
              borderColor: appColors.borderSubtle,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: appSpacing.lg,
              }}
            >
              <Text
                style={{
                  ...appTypography.title,
                  fontSize: 20,
                  color: appColors.textPrimary,
                }}
              >
                Novo bloco
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: appSpacing.xs }}>
                <LucideX size={22} color={appColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Título */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: appColors.textSecondary,
                marginBottom: 4,
              }}
            >
              O que você vai fazer?
            </Text>
            <TextInput
              style={{
                backgroundColor: appColors.surface,
                borderRadius: appRadius.md,
                paddingHorizontal: appSpacing.md,
                paddingVertical: appSpacing.sm + 2,
                color: appColors.textPrimary,
                marginBottom: appSpacing.md,
              }}
              placeholder="Ex: Foco no projeto, Caminhada..."
              placeholderTextColor={appColors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            {/* Horários */}
            <View
              style={{
                flexDirection: 'row',
                gap: appSpacing.md,
                marginBottom: appSpacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: appColors.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Início (HH:MM)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: appColors.surface,
                    borderRadius: appRadius.md,
                    paddingHorizontal: appSpacing.md,
                    paddingVertical: appSpacing.sm + 2,
                    color: appColors.textPrimary,
                    textAlign: 'center',
                  }}
                  placeholder="09:00"
                  placeholderTextColor={appColors.textSecondary}
                  value={newStartTime}
                  onChangeText={setNewStartTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: appColors.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Fim (HH:MM)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: appColors.surface,
                    borderRadius: appRadius.md,
                    paddingHorizontal: appSpacing.md,
                    paddingVertical: appSpacing.sm + 2,
                    color: appColors.textPrimary,
                    textAlign: 'center',
                  }}
                  placeholder="10:00"
                  placeholderTextColor={appColors.textSecondary}
                  value={newEndTime}
                  onChangeText={setNewEndTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>

            {/* Categoria */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: appColors.textSecondary,
                marginBottom: 6,
              }}
            >
              Categoria
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginBottom: appSpacing.md,
              }}
            >
              {CATEGORIES.map((cat) => {
                const isActive = newCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setNewCategory(cat)}
                    style={{
                      marginRight: appSpacing.sm,
                      marginBottom: appSpacing.sm,
                      paddingHorizontal: appSpacing.md,
                      paddingVertical: appSpacing.xs + 2,
                      borderRadius: appRadius.pill,
                      borderWidth: 1,
                      borderColor: isActive ? appColors.primary : appColors.borderSubtle,
                      backgroundColor: isActive ? appColors.primarySoft : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        color: isActive ? appColors.primary : appColors.textSecondary,
                      }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Intensidade */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: appColors.textSecondary,
                marginBottom: 6,
              }}
            >
              Intensidade
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: appSpacing.md,
                marginBottom: appSpacing.lg,
              }}
            >
              {INTENSITIES.map(({ label, value }) => {
                const isActive = newIntensity === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setNewIntensity(value)}
                    style={{
                      flex: 1,
                      paddingVertical: appSpacing.sm,
                      borderRadius: appRadius.md,
                      borderWidth: 1,
                      borderColor: isActive ? appColors.primary : appColors.borderSubtle,
                      backgroundColor: isActive ? appColors.primary : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: isActive ? '#0b1120' : appColors.textSecondary,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Botão Salvar */}
            <TouchableOpacity
              onPress={handleSaveBlock}
              disabled={isSaving || !newTitle.trim()}
              style={{
                paddingVertical: appSpacing.md,
                borderRadius: appRadius.lg,
                alignItems: 'center',
                backgroundColor:
                  isSaving || !newTitle.trim() ? appColors.borderSubtle : appColors.primary,
                marginBottom: Platform.OS === 'ios' ? appSpacing.sm : 0,
              }}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  style={{
                    color: '#0b1120',
                    fontWeight: '700',
                    fontSize: 15,
                  }}
                >
                  Adicionar ao planner
                </Text>
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
    trabalho: appColors.primarySoft,
    pessoal: 'rgba(34,197,94,0.14)',
    autocuidado: 'rgba(168,85,247,0.14)',
    social: 'rgba(249,115,22,0.14)',
    outro: 'rgba(148,163,184,0.18)',
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 68,
            right: 20,
            height: initialDuration,
            borderRadius: appRadius.md,
            borderLeftWidth: 3,
            borderColor: block.isAiSuggested ? appColors.primary : appColors.borderSubtle,
            backgroundColor: categoryColors[block.category],
          },
          animatedStyle,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: appSpacing.sm }}>
            <Text
              style={{
                fontWeight: '700',
                color: appColors.textPrimary,
                fontSize: 11,
              }}
              numberOfLines={1}
            >
              {block.title}
            </Text>
            {block.isAiSuggested && (
              <View style={{ marginLeft: 4 }}>
                <LucideSparkles size={10} color={appColors.primary} />
              </View>
            )}
          </View>
        </View>

        <Text
          style={{
            fontSize: 10,
            color: appColors.textSecondary,
            marginTop: 2,
          }}
        >
          {block.startTime} — {block.endTime}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

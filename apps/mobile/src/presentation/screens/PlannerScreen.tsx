import React, { useEffect, useState } from 'react';
import { View, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { 
  Appbar, 
  Text, 
  FAB, 
  Portal, 
  Modal, 
  TextInput, 
  Button, 
  ActivityIndicator, 
  IconButton, 
  MD3Colors,
  Card,
  SegmentedButtons,
  Chip
} from 'react-native-paper';
import { usePlannerStore, TimelineBlock } from '../providers/planner_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideSparkles, LucidePlus, LucideChevronLeft, LucideChevronRight, LucideLightbulb, LucideX } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { appColors, appRadius, appSpacing, appTypography } from '../theme/appTheme';

/**
 * PlannerScreen: Versão com Drag-and-drop fluido e UI baseada no Paper.
 */
const CATEGORIES: { label: string; value: TimelineBlock['category'] }[] = [
  { label: 'Trabalho', value: 'trabalho' },
  { label: 'Pessoal', value: 'pessoal' },
  { label: 'Autocuidado', value: 'autocuidado' },
  { label: 'Social', value: 'social' },
];

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
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: 'transparent' }}>
        <Appbar.Action icon={() => <LucideChevronLeft size={24} color={appColors.textSecondary} />} onPress={() => changeDate(-1)} />
        <Appbar.Content 
          title={new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })} 
          titleStyle={{ fontSize: 18, fontWeight: '700' }}
        />
        <Appbar.Action icon={() => <LucideChevronRight size={24} color={appColors.textSecondary} />} onPress={() => changeDate(1)} />
      </Appbar.Header>

      <View style={{ flex: 1 }}>
        {isLoading && blocks.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator animating size="large" color={appColors.primary} />
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
                  <Text variant="labelSmall" style={{ color: appColors.textSecondary }}>
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

      {/* Floating Actions */}
      <FAB
        icon="lightbulb-outline"
        style={{
          position: 'absolute',
          margin: 16,
          left: 0,
          bottom: 16,
          backgroundColor: appColors.surface,
        }}
        onPress={() => {}}
        mode="flat"
      />

      <FAB
        icon="plus"
        label="Novo bloco"
        extended
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 16,
          backgroundColor: appColors.primary,
        }}
        onPress={handleOpenModal}
        color="white"
      />

      {/* Modal: Novo Bloco */}
      <Portal>
        <Modal 
          visible={showModal} 
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={{
            backgroundColor: appColors.surface,
            padding: appSpacing.lg,
            margin: appSpacing.lg,
            borderRadius: appRadius.lg,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: appSpacing.lg }}>
              <Text variant="titleLarge" style={{ fontWeight: '700' }}>Novo bloco</Text>
              <IconButton icon="close" onPress={() => setShowModal(false)} />
            </View>

            <TextInput
              label="O que você vai fazer?"
              mode="outlined"
              value={newTitle}
              onChangeText={setNewTitle}
              style={{ marginBottom: appSpacing.md }}
            />

            <View style={{ flexDirection: 'row', gap: appSpacing.md, marginBottom: appSpacing.md }}>
              <TextInput
                label="Início"
                mode="outlined"
                value={newStartTime}
                onChangeText={setNewStartTime}
                style={{ flex: 1 }}
                placeholder="09:00"
                maxLength={5}
              />
              <TextInput
                label="Fim"
                mode="outlined"
                value={newEndTime}
                onChangeText={setNewEndTime}
                style={{ flex: 1 }}
                placeholder="10:00"
                maxLength={5}
              />
            </View>

            <Text variant="labelLarge" style={{ marginBottom: appSpacing.sm, fontWeight: '700' }}>Categoria</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: appSpacing.md }}>
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat.value}
                  selected={newCategory === cat.value}
                  onPress={() => setNewCategory(cat.value)}
                  mode="outlined"
                  showSelectedOverlay
                >
                  {cat.label}
                </Chip>
              ))}
            </View>

            <Text variant="labelLarge" style={{ marginBottom: appSpacing.sm, fontWeight: '700' }}>Intensidade</Text>
            <SegmentedButtons
              value={newIntensity}
              onValueChange={setNewIntensity as any}
              buttons={INTENSITIES.map(i => ({ value: i.value, label: i.label }))}
              style={{ marginBottom: appSpacing.lg }}
            />

            <Button
              mode="contained"
              onPress={handleSaveBlock}
              loading={isSaving}
              disabled={isSaving || !newTitle.trim()}
              contentStyle={{ paddingVertical: 6 }}
            >
              Adicionar ao planner
            </Button>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

/**
 * DraggableBlock: Bloco interativo que responde a gestos (Drag-and-drop).
 */
function DraggableBlock({ block, onMove }: { block: TimelineBlock; onMove: (newStart: string) => void }) {
  const [startH, startM] = block.startTime.split(':').map(Number);
  const [endH, endM] = block.endTime.split(':').map(Number);
  
  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = endH * 60 + endM;
  const initialDuration = Math.max(endTotalMinutes - startTotalMinutes, 30);

  const translateY = useSharedValue(startTotalMinutes);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    if (!isDragging.value) {
      translateY.value = startTotalMinutes;
    }
  }, [startTotalMinutes]);

  const gesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-10, 10])
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      translateY.value = startTotalMinutes + event.translationY;
    })
    .onEnd(() => {
      isDragging.value = false;
      const rawY = Math.round(translateY.value / 15) * 15;
      const finalY = Math.max(0, Math.min(rawY, 23 * 60 + 45));
      translateY.value = withSpring(finalY);

      const hours = Math.floor(finalY / 60);
      const minutes = finalY % 60;
      const newTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      runOnJS(onMove)(newTime);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: withSpring(isDragging.value ? 1.05 : 1) },
    ],
    zIndex: isDragging.value ? 100 : 1,
    elevation: isDragging.value ? 8 : 0,
  }));

  const categoryColors: Record<string, string> = {
    trabalho: 'rgba(56, 189, 248, 0.15)',
    pessoal: 'rgba(34, 197, 94, 0.15)',
    autocuidado: 'rgba(168, 85, 247, 0.15)',
    social: 'rgba(249, 115, 22, 0.15)',
    outro: 'rgba(148, 163, 184, 0.15)',
  };

  const categoryBorderColors: Record<string, string> = {
    trabalho: '#38bdf8',
    pessoal: '#22c55e',
    autocuidado: '#a855f7',
    social: '#f97316',
    outro: '#94a3b8',
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
            borderLeftWidth: 4,
            borderColor: categoryBorderColors[block.category] || appColors.primary,
            backgroundColor: categoryColors[block.category] || appColors.surface,
            padding: 8,
            justifyContent: 'center',
          },
          animatedStyle,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="labelSmall" style={{ fontWeight: '700', color: appColors.textPrimary }} numberOfLines={1}>
            {block.title}
          </Text>
          {block.isAiSuggested && <LucideSparkles size={12} color={appColors.primary} />}
        </View>
        <Text variant="labelSmall" style={{ color: appColors.textSecondary, fontSize: 9 }}>
          {block.startTime} — {block.endTime}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}


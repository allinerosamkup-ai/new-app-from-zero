import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { usePlannerStore, TimelineBlock } from '../providers/planner_store';
import { useAuthStore } from '../providers/auth_store';
import {
  LucidePlus,
  LucideBell,
  LucideTrash2,
  LucideCopy,
  LucideCheckCircle2,
  LucideX,
  LucidePencil,
  LucideChevronLeft,
  LucideChevronRight,
} from 'lucide-react-native';

// ── Constantes ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<TimelineBlock['category'], string> = {
  trabalho: '#3B82F6',
  pessoal: '#22C55E',
  autocuidado: '#A855F7',
  social: '#F97316',
  outro: '#6B7280',
};

const CATEGORY_LABELS: Record<TimelineBlock['category'], string> = {
  trabalho: 'Trabalho',
  pessoal: 'Pessoal',
  autocuidado: 'Autocuidado',
  social: 'Social',
  outro: 'Outro',
};

const CATEGORIES: TimelineBlock['category'][] = [
  'trabalho', 'pessoal', 'autocuidado', 'social', 'outro',
];

const INTENSITIES: { label: string; value: TimelineBlock['intensity'] }[] = [
  { label: 'Leve', value: 'L' },
  { label: 'Médio', value: 'M' },
  { label: 'Pesado', value: 'P' },
];

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDates(dateStr: string): Date[] {
  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay(); // 0=Dom
  // Começa na segunda
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getDurationLabel(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) return '';
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

// ── Week Header ──────────────────────────────────────────────────────────────

function WeekHeader({
  selectedDate,
  onDateSelect,
}: {
  selectedDate: string;
  onDateSelect: (d: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
      paddingHorizontal: 4,
      paddingTop: 10,
      paddingBottom: 8,
    }}>
      {weekDates.map((date) => {
        const dateStr = date.toISOString().split('T')[0];
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === today;
        const dowIdx = date.getDay();
        return (
          <TouchableOpacity
            key={dateStr}
            onPress={() => onDateSelect(dateStr)}
            style={{ flex: 1, alignItems: 'center' }}
          >
            <Text style={{
              fontSize: 10,
              fontWeight: '500',
              color: isSelected ? '#3B82F6' : '#9CA3AF',
              marginBottom: 4,
            }}>
              {DAY_NAMES[dowIdx]}
            </Text>
            <View style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: isSelected
                ? '#3B82F6'
                : isToday
                  ? '#DBEAFE'
                  : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: '700',
                color: isSelected ? 'white' : isToday ? '#3B82F6' : '#374151',
              }}>
                {date.getDate()}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Task Row (com corredor) ───────────────────────────────────────────────────

function TaskRow({
  block,
  isFirst,
  isLast,
  onTap,
}: {
  block: TimelineBlock;
  isFirst: boolean;
  isLast: boolean;
  onTap: (b: TimelineBlock) => void;
}) {
  const color = CATEGORY_COLORS[block.category];
  const isCompleted = block.status === 'completed';
  const duration = getDurationLabel(block.startTime, block.endTime);

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 12 }}>

      {/* Coluna de horário */}
      <View style={{ width: 46, alignItems: 'flex-end', paddingRight: 8, paddingTop: 12 }}>
        <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '500' }}>
          {block.startTime}
        </Text>
      </View>

      {/* Corredor vertical */}
      <View style={{ width: 22, alignItems: 'center' }}>
        {/* Linha acima do círculo */}
        <View style={{
          width: 2,
          height: isFirst ? 12 : 16,
          backgroundColor: isFirst ? 'transparent' : '#D1D5DB',
        }} />
        {/* Círculo da categoria */}
        <View style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: isCompleted ? '#D1D5DB' : color,
        }} />
        {/* Linha abaixo do círculo */}
        <View style={{
          width: 2,
          flex: 1,
          minHeight: 20,
          backgroundColor: isLast ? 'transparent' : '#D1D5DB',
        }} />
      </View>

      {/* Card da tarefa */}
      <View style={{ flex: 1, paddingLeft: 8, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => onTap(block)}
          activeOpacity={0.75}
          style={{
            backgroundColor: 'white',
            borderRadius: 12,
            borderLeftWidth: 4,
            borderLeftColor: color,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 3,
            elevation: 2,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: isCompleted ? '#9CA3AF' : '#1F2937',
              textDecorationLine: isCompleted ? 'line-through' : 'none',
            }}
          >
            {block.title}
          </Text>
          {duration ? (
            <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
              {block.startTime} – {block.endTime} ({duration})
            </Text>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Action Chip (ícone + label) ───────────────────────────────────────────────

function ActionChip({
  icon,
  label,
  labelColor,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: 'center' }}>
      <View style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
      }}>
        {icon}
      </View>
      <Text style={{ fontSize: 11, color: labelColor, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Action Bottom Sheet ──────────────────────────────────────────────────────

function ActionBottomSheet({
  block,
  visible,
  onClose,
  onDelete,
  onDuplicate,
  onComplete,
  onEdit,
  onNotification,
}: {
  block: TimelineBlock | null;
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onNotification: () => void;
}) {
  if (!block) return null;
  const color = CATEGORY_COLORS[block.category];
  const duration = getDurationLabel(block.startTime, block.endTime);
  const isCompleted = block.status === 'completed';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable>
          <View style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: 36,
            paddingHorizontal: 20,
          }}>
            {/* Handle */}
            <View style={{
              width: 40, height: 4,
              backgroundColor: '#E5E7EB',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 18,
            }} />

            {/* Info do bloco */}
            <View style={{
              borderLeftWidth: 4,
              borderLeftColor: color,
              paddingLeft: 12,
              marginBottom: 22,
            }}>
              <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
                {block.startTime} – {block.endTime}{duration ? ` (${duration})` : ''}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#1F2937', marginTop: 2 }}>
                {block.title}
              </Text>
              <Text style={{ fontSize: 11, color: CATEGORY_COLORS[block.category], marginTop: 2, fontWeight: '600' }}>
                {CATEGORY_LABELS[block.category]}
              </Text>
            </View>

            {/* Botões de ação */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              marginBottom: 20,
            }}>
              <ActionChip
                icon={<LucideTrash2 size={22} color="#EF4444" />}
                label="Excluir"
                labelColor="#EF4444"
                onPress={onDelete}
              />
              <ActionChip
                icon={<LucideCopy size={22} color="#3B82F6" />}
                label="Duplicar"
                labelColor="#3B82F6"
                onPress={onDuplicate}
              />
              <ActionChip
                icon={<LucideCheckCircle2 size={22} color={isCompleted ? '#9CA3AF' : '#22C55E'} />}
                label={isCompleted ? 'Reabrir' : 'Concluir'}
                labelColor={isCompleted ? '#9CA3AF' : '#22C55E'}
                onPress={onComplete}
              />
            </View>

            <View style={{ height: 1, backgroundColor: '#F3F4F6', marginHorizontal: -20, marginBottom: 4 }} />

            {/* Notificação recorrente */}
            <TouchableOpacity
              onPress={onNotification}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <LucideBell size={20} color="#6B7280" />
              <Text style={{ marginLeft: 12, fontSize: 15, color: '#374151', fontWeight: '500' }}>
                Notificação recorrente
              </Text>
            </TouchableOpacity>

            {/* Editar tarefa */}
            <TouchableOpacity
              onPress={onEdit}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
              }}
            >
              <LucidePencil size={20} color="#6B7280" />
              <Text style={{ marginLeft: 12, fontSize: 15, color: '#374151', fontWeight: '500' }}>
                Editar Tarefa
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Formulário de Tarefa (Adicionar / Editar) ────────────────────────────────

function TaskFormModal({
  visible,
  initialBlock,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  initialBlock?: Partial<TimelineBlock>;
  onClose: () => void;
  onSave: (data: {
    title: string;
    startTime: string;
    endTime: string;
    category: TimelineBlock['category'];
    intensity: TimelineBlock['intensity'];
  }) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<TimelineBlock['category']>('trabalho');
  const [intensity, setIntensity] = useState<TimelineBlock['intensity']>('M');

  useEffect(() => {
    if (visible) {
      setTitle(initialBlock?.title ?? '');
      setStartTime(initialBlock?.startTime ?? '09:00');
      setEndTime(initialBlock?.endTime ?? '10:00');
      setCategory(initialBlock?.category ?? 'trabalho');
      setIntensity(initialBlock?.intensity ?? 'M');
    }
  }, [visible]);

  const isEditing = Boolean(initialBlock?.title);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <View style={{
          backgroundColor: 'white',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 12,
          paddingHorizontal: 20,
          paddingBottom: 36,
          maxHeight: '92%',
        }}>
          {/* Handle */}
          <View style={{
            width: 40, height: 4,
            backgroundColor: '#E5E7EB',
            borderRadius: 2,
            alignSelf: 'center',
            marginBottom: 16,
          }} />

          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>
              {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <LucideX size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Título */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
              O que você vai fazer?
            </Text>
            <TextInput
              style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: '#1F2937',
                marginBottom: 16,
              }}
              placeholder="Ex: Foco no projeto, Caminhada..."
              placeholderTextColor="#D1D5DB"
              value={title}
              onChangeText={setTitle}
            />

            {/* Horários */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
                  Início (HH:MM)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: '#1F2937',
                    textAlign: 'center',
                  }}
                  value={startTime}
                  onChangeText={setStartTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
                  Fim (HH:MM)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: '#1F2937',
                    textAlign: 'center',
                  }}
                  value={endTime}
                  onChangeText={setEndTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>

            {/* Categoria */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>
              Categoria
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: category === cat ? CATEGORY_COLORS[cat] : '#E5E7EB',
                    backgroundColor: category === cat
                      ? CATEGORY_COLORS[cat] + '18'
                      : 'white',
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: category === cat ? CATEGORY_COLORS[cat] : '#6B7280',
                  }}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Intensidade */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>
              Intensidade
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {INTENSITIES.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setIntensity(value)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: intensity === value ? '#3B82F6' : '#E5E7EB',
                    backgroundColor: intensity === value ? '#EFF6FF' : 'white',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: intensity === value ? '#3B82F6' : '#6B7280',
                  }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Botão Salvar */}
            <TouchableOpacity
              onPress={() => onSave({ title: title.trim(), startTime, endTime, category, intensity })}
              disabled={isSaving || !title.trim()}
              style={{
                paddingVertical: 16,
                borderRadius: 16,
                backgroundColor: isSaving || !title.trim() ? '#D1D5DB' : '#3B82F6',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
                  {isEditing ? 'Salvar alterações' : 'Adicionar ao Planner'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Tela Principal ────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const {
    selectedDate,
    blocks,
    isLoading,
    fetchBlocks,
    setSelectedDate,
    syncBlocks,
    completeBlock,
    deleteBlock,
    duplicateBlock,
    updateBlock,
  } = usePlannerStore();
  const { userId } = useAuthStore();

  const [selectedBlock, setSelectedBlock] = useState<TimelineBlock | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimelineBlock | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userId) fetchBlocks(userId, selectedDate);
  }, [selectedDate, userId]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [blocks]
  );

  const handleTapBlock = useCallback((block: TimelineBlock) => {
    setSelectedBlock(block);
    setShowActionSheet(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedBlock) return;
    setShowActionSheet(false);
    Alert.alert(
      'Excluir tarefa',
      `Deseja excluir "${selectedBlock.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteBlock(selectedBlock.id),
        },
      ]
    );
  }, [selectedBlock, deleteBlock]);

  const handleDuplicate = useCallback(async () => {
    if (!selectedBlock) return;
    setShowActionSheet(false);
    await duplicateBlock(selectedBlock.id);
  }, [selectedBlock, duplicateBlock]);

  const handleComplete = useCallback(async () => {
    if (!selectedBlock) return;
    setShowActionSheet(false);
    await completeBlock(selectedBlock.id);
  }, [selectedBlock, completeBlock]);

  const handleEdit = useCallback(() => {
    setShowActionSheet(false);
    setEditingBlock(selectedBlock);
  }, [selectedBlock]);

  const handleNotification = useCallback(() => {
    Alert.alert(
      'Notificação recorrente',
      'Funcionalidade em desenvolvimento. Para ativar notificações, configure o expo-notifications no projeto.',
      [{ text: 'Entendi' }]
    );
  }, []);

  const handleSaveNew = useCallback(async (data: {
    title: string; startTime: string; endTime: string;
    category: TimelineBlock['category']; intensity: TimelineBlock['intensity'];
  }) => {
    if (!userId) return;
    setIsSaving(true);
    const success = await syncBlocks(userId, selectedDate, [{
      ...data,
      status: 'planned',
      isAiSuggested: false,
    }]);
    if (success) {
      await fetchBlocks(userId, selectedDate);
      setShowAddModal(false);
    }
    setIsSaving(false);
  }, [userId, selectedDate, syncBlocks, fetchBlocks]);

  const handleSaveEdit = useCallback(async (data: {
    title: string; startTime: string; endTime: string;
    category: TimelineBlock['category']; intensity: TimelineBlock['intensity'];
  }) => {
    if (!editingBlock) return;
    setIsSaving(true);
    await updateBlock(editingBlock.id, data);
    setEditingBlock(null);
    setIsSaving(false);
  }, [editingBlock, updateBlock]);

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>

      {/* Header de semana */}
      <WeekHeader selectedDate={selectedDate} onDateSelect={setSelectedDate} />

      {/* Label do dia selecionado */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}>
        <TouchableOpacity onPress={() => {
          const d = new Date(selectedDate + 'T00:00:00');
          d.setDate(d.getDate() - 1);
          setSelectedDate(d.toISOString().split('T')[0]);
        }}>
          <LucideChevronLeft size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <Text style={{
          fontSize: 13,
          fontWeight: '600',
          color: '#374151',
          textTransform: 'capitalize',
          flex: 1,
          textAlign: 'center',
        }}>
          {dateLabel}
        </Text>
        <TouchableOpacity onPress={() => {
          const d = new Date(selectedDate + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          setSelectedDate(d.toISOString().split('T')[0]);
        }}>
          <LucideChevronRight size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Timeline */}
      {isLoading && sortedBlocks.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : sortedBlocks.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{
            fontSize: 15,
            color: '#9CA3AF',
            textAlign: 'center',
            lineHeight: 24,
          }}>
            Nenhuma tarefa para hoje.{'\n'}Toque em + para adicionar.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {sortedBlocks.map((block, i) => (
            <TaskRow
              key={block.id}
              block={block}
              isFirst={i === 0}
              isLast={i === sortedBlocks.length - 1}
              onTap={handleTapBlock}
            />
          ))}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#3B82F6',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <LucidePlus size={26} color="white" />
      </TouchableOpacity>

      {/* Bottom Sheet de ações */}
      <ActionBottomSheet
        block={selectedBlock}
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onComplete={handleComplete}
        onEdit={handleEdit}
        onNotification={handleNotification}
      />

      {/* Modal: Nova tarefa */}
      <TaskFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveNew}
        isSaving={isSaving}
      />

      {/* Modal: Editar tarefa */}
      <TaskFormModal
        visible={editingBlock !== null}
        initialBlock={editingBlock ?? undefined}
        onClose={() => setEditingBlock(null)}
        onSave={handleSaveEdit}
        isSaving={isSaving}
      />
    </SafeAreaView>
  );
}

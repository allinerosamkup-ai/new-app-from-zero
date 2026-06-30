import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useHabitStore } from '../providers/habit_store';
import { useAuthStore } from '../providers/auth_store';
import { appColors, appSpacing, appRadius } from '../theme/appTheme';

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  starter:      { label: 'Cotidiano leve',  color: '#D7897F', bg: 'rgba(215,137,127,.10)' },
  autocuidado:  { label: 'Autocuidado',      color: '#5DAE8B', bg: 'rgba(93,174,139,.10)'  },
  casa:         { label: 'Casa em ordem',    color: '#6398A9', bg: 'rgba(99,152,169,.10)'  },
  social:       { label: 'Vínculos',         color: '#9B7AB8', bg: 'rgba(155,122,184,.10)' },
  criativo:     { label: 'Criativo',         color: '#E3904A', bg: 'rgba(227,144,74,.10)'  },
  natureza:     { label: 'Natureza',         color: '#7BAF83', bg: 'rgba(123,175,131,.10)' },
  geral:        { label: 'Geral',            color: '#8d7b68', bg: 'rgba(141,123,104,.08)' },
};

const ICON_OPTIONS = ['✨', '🌿', '🧡', '💧', '📚', '🏃', '🧘', '🎨', '🍎', '😴', '🌅', '🎵'];

export default function HabitsScreen() {
  const { userId } = useAuthStore();
  const { habits, fetchHabits, toggleHabit, addHabit, isLoading } = useHabitStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('✨');
  const [newCategory, setNewCategory] = useState('geral');
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (userId) fetchHabits(userId, today);
  }, [userId, fetchHabits, today]);

  const dailyHabits = habits.filter((h) => h.frequency === 'daily');
  const completed = dailyHabits.filter((h) =>
    h.completions?.some((c) => c.date.startsWith(today))
  );
  const pct = dailyHabits.length > 0 ? (completed.length / dailyHabits.length) * 100 : 0;

  // Agrupar por categoria
  const grouped = dailyHabits.reduce<Record<string, typeof dailyHabits>>((acc, h) => {
    const cat = h.category || 'geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(h);
    return acc;
  }, {});

  async function handleToggle(habitId: string) {
    if (!userId) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleHabit(userId, habitId, today);
    // Vibração especial se completou todos
    const nowCompleted = habits.filter((h) =>
      h.id === habitId
        ? !h.completions?.some((c) => c.date.startsWith(today))
        : h.completions?.some((c) => c.date.startsWith(today))
    );
    if (nowCompleted.length === dailyHabits.length) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleSave() {
    if (!userId || !newTitle.trim()) return;
    setSaving(true);
    await addHabit(userId, {
      title: newTitle.trim(),
      icon: newIcon,
      category: newCategory,
      frequency: 'daily',
    });
    setNewTitle('');
    setNewIcon('✨');
    setNewCategory('geral');
    setSaving(false);
    setShowAddModal(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: appSpacing.lg,
          paddingTop: appSpacing.lg,
          paddingBottom: appSpacing.xl * 3,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: appSpacing.xl }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: appColors.textSecondary }}>
              HÁBITOS
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: appColors.textPrimary, marginTop: 2 }}>
              Rituais de hoje
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: appColors.primary,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 26 }}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Barra de progresso diária */}
        {dailyHabits.length > 0 && (
          <View style={{
            padding: appSpacing.lg, borderRadius: appRadius.lg, marginBottom: appSpacing.xl,
            backgroundColor: appColors.surface,
            borderWidth: 1, borderColor: 'rgba(0,0,0,.05)',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: appSpacing.sm }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: appColors.textPrimary }}>
                Progresso de hoje
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: pct === 100 ? appColors.success : appColors.primary }}>
                {completed.length}/{dailyHabits.length}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
              <View style={{
                height: '100%', borderRadius: 999,
                width: `${pct}%`,
                backgroundColor: pct === 100 ? appColors.success : appColors.primary,
              }} />
            </View>
            {pct === 100 && (
              <Text style={{ fontSize: 12, color: appColors.success, fontWeight: '700', marginTop: appSpacing.sm, textAlign: 'center' }}>
                🎉 Todos os hábitos de hoje concluídos!
              </Text>
            )}
          </View>
        )}

        {/* Lista agrupada por categoria */}
        {isLoading ? (
          <ActivityIndicator animating color={appColors.primary} style={{ marginTop: appSpacing.xl }} />
        ) : dailyHabits.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: appSpacing.xl * 2 }}>
            <Text style={{ fontSize: 40, marginBottom: appSpacing.lg }}>🌱</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: appColors.textPrimary, marginBottom: appSpacing.sm }}>
              Nenhum hábito ainda
            </Text>
            <Text style={{ fontSize: 13, color: appColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              Toque no + para criar seu primeiro ritual do dia.
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([category, categoryHabits]) => {
            const meta = CATEGORY_META[category] ?? CATEGORY_META.geral;
            return (
              <View key={category} style={{ marginBottom: appSpacing.xl }}>
                {/* Cabeçalho de categoria */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm, marginBottom: appSpacing.md }}>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
                    backgroundColor: meta.bg,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: meta.color, letterSpacing: 0.8 }}>
                      {meta.label.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Hábitos da categoria */}
                <View style={{ gap: appSpacing.sm }}>
                  {categoryHabits.map((habit) => {
                    const isDone = habit.completions?.some((c) => c.date.startsWith(today)) ?? false;
                    return (
                      <TouchableOpacity
                        key={habit.id}
                        onPress={() => handleToggle(habit.id)}
                        activeOpacity={0.75}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: appSpacing.md,
                          padding: appSpacing.md, borderRadius: appRadius.lg,
                          backgroundColor: isDone ? 'rgba(150,199,179,.10)' : appColors.surface,
                          borderWidth: 1,
                          borderColor: isDone ? 'rgba(150,199,179,.35)' : 'rgba(0,0,0,.05)',
                        }}
                      >
                        {/* Ícone */}
                        <View style={{
                          width: 44, height: 44, borderRadius: 14,
                          backgroundColor: isDone ? 'rgba(150,199,179,.20)' : meta.bg,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 22 }}>{habit.icon || '✨'}</Text>
                        </View>

                        {/* Info */}
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 14, fontWeight: '700',
                            color: isDone ? appColors.textSecondary : appColors.textPrimary,
                            textDecorationLine: isDone ? 'line-through' : 'none',
                          }}>
                            {habit.title}
                          </Text>
                          {habit.streakCount > 0 && (
                            <Text style={{ fontSize: 11, color: appColors.primary, fontWeight: '600', marginTop: 2 }}>
                              🔥 {habit.streakCount} dia{habit.streakCount !== 1 ? 's' : ''} de sequência
                            </Text>
                          )}
                        </View>

                        {/* Checkbox */}
                        <View style={{
                          width: 26, height: 26, borderRadius: 13,
                          borderWidth: 2,
                          borderColor: isDone ? appColors.success : 'rgba(0,0,0,.18)',
                          backgroundColor: isDone ? appColors.success : 'transparent',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isDone && (
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>✓</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal de adicionar hábito */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.32)' }}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          />
          <View style={{
            backgroundColor: appColors.background,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: appSpacing.xl,
            paddingBottom: appSpacing.xl + (Platform.OS === 'ios' ? 16 : 0),
          }}>
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,.12)', alignSelf: 'center', marginBottom: appSpacing.xl }} />

            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: appColors.textSecondary, marginBottom: 4 }}>
              NOVO HÁBITO
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: appColors.textPrimary, marginBottom: appSpacing.xl }}>
              Criar ritual
            </Text>

            {/* Seletor de ícone */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: appColors.textSecondary, marginBottom: appSpacing.sm, textTransform: 'uppercase' }}>
              Ícone
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: appSpacing.lg }}>
              <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
                {ICON_OPTIONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    onPress={() => setNewIcon(icon)}
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: newIcon === icon ? appColors.primarySoft : 'rgba(0,0,0,.04)',
                      borderWidth: newIcon === icon ? 2 : 1,
                      borderColor: newIcon === icon ? appColors.primary : 'rgba(0,0,0,.06)',
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Nome */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: appColors.textSecondary, marginBottom: appSpacing.sm, textTransform: 'uppercase' }}>
              Nome
            </Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Ex: Beber 2L de água, 10 min de leitura..."
              placeholderTextColor={appColors.textSecondary}
              style={{
                height: 48, borderRadius: appRadius.md,
                borderWidth: 1, borderColor: 'rgba(0,0,0,.08)',
                backgroundColor: appColors.surface,
                paddingHorizontal: appSpacing.md,
                fontSize: 14, color: appColors.textPrimary,
                marginBottom: appSpacing.lg,
              }}
            />

            {/* Categoria */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: appColors.textSecondary, marginBottom: appSpacing.sm, textTransform: 'uppercase' }}>
              Categoria
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: appSpacing.xl }}>
              <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setNewCategory(key)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                      backgroundColor: newCategory === key ? meta.bg : 'rgba(0,0,0,.04)',
                      borderWidth: newCategory === key ? 1.5 : 1,
                      borderColor: newCategory === key ? meta.color : 'rgba(0,0,0,.06)',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: newCategory === key ? meta.color : appColors.textSecondary }}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Botão criar */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !newTitle.trim()}
              style={{
                height: 52, borderRadius: appRadius.lg,
                backgroundColor: saving || !newTitle.trim() ? 'rgba(0,0,0,.08)' : appColors.primary,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: saving || !newTitle.trim() ? appColors.textSecondary : '#fff' }}>
                {saving ? 'Salvando...' : 'Criar hábito'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

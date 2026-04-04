import React, { useEffect } from 'react';
import { View, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import { useCheckinStore } from '../providers/checkin_store';
import { usePlannerStore } from '../providers/planner_store';
import { useAuthStore } from '../providers/auth_store';
import { appColors, appGlass, appRadius, appSpacing } from '../theme/appTheme';
import {
  buildGentleGamificationSnapshot,
  resolveAdaptiveGuidance,
} from '../../../../../packages/domain/src/adaptive-guidance';

/**
 * HomeScreen: Hub central do usuário.
 */
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { userId } = useAuthStore();
  const { todayCheckin, recentCheckins, loadRecentCheckins } = useCheckinStore();
  const { blocks, fetchBlocks, isLoading: plannerLoading } = usePlannerStore();

  useEffect(() => {
    if (!userId) return;
    const dateStr = new Date().toISOString().split('T')[0];
    fetchBlocks(userId, dateStr);
    void loadRecentCheckins(userId, 7);
  }, [userId, fetchBlocks, loadRecentCheckins]);

  const stateColors: Record<string, { bg: string, border: string, text: string, icon: string }> = {
    leve: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', icon: '#166534' },
    moderado: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: '#1E40AF' },
    sensível: { bg: '#FFFBEB', border: '#FEF3C7', text: '#92400E', icon: '#92400E' },
    crítico: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '#991B1B' },
  };

  const currentType = todayCheckin?.stateLabelType || 'moderado';
  const colors = stateColors[currentType];

  const PHASE_BADGE: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
    menstrual:  { emoji: '🌙', label: 'Menstrual',  color: '#A8544A', bg: 'rgba(215,137,127,.14)' },
    folicular:  { emoji: '🌱', label: 'Folicular',  color: '#3A7A66', bg: 'rgba(93,174,139,.14)'  },
    ovulatoria: { emoji: '🚀', label: 'Ovulatória', color: '#2A5F72', bg: 'rgba(99,152,169,.14)'  },
    lutea:      { emoji: '🌊', label: 'Lútea',      color: '#5E3B84', bg: 'rgba(155,122,184,.14)' },
  };
  const phase = todayCheckin?.menstrualPhase;
  const phaseBadge = phase ? PHASE_BADGE[phase] : null;
  const support = resolveAdaptiveGuidance({
    moodLabelType: todayCheckin?.stateLabelType ?? null,
    energyScore: todayCheckin?.aiState?.suggestedIntensity === 'L' ? 2 : todayCheckin?.aiState?.suggestedIntensity === 'P' ? 4 : 3,
  });
  const tasksDoneToday = blocks.filter((block) => block.status === 'completed').length;
  const game = buildGentleGamificationSnapshot({
    hadCheckinToday: Boolean(todayCheckin),
    checkinDates: recentCheckins
      .map((entry) => entry.localDate ?? entry.date)
      .filter((value): value is string => Boolean(value)),
    tasksDoneToday,
    tasksTotalToday: blocks.length,
    supportMode: support.mode,
  });

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
        {/* Header de Boas-vindas */}
        <View style={{ marginBottom: appSpacing.xl, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Text variant="labelMedium" style={{ color: appColors.textSecondary }}>
              Bom dia,
            </Text>
            <Text variant="headlineMedium" style={{ color: appColors.textPrimary, fontWeight: '700' }}>
              Ciclagem & Humor
            </Text>
          </View>

          {/* Badge de fase do ciclo */}
          {phaseBadge ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('CycleCalendar')}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: phaseBadge.bg, borderRadius: 999,
                paddingHorizontal: 10, paddingVertical: 5, marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 13 }}>{phaseBadge.emoji}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: phaseBadge.color }}>
                {phaseBadge.label}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Checkin')}
              style={{
                backgroundColor: 'rgba(215,137,127,.1)', borderRadius: 999,
                paddingHorizontal: 10, paddingVertical: 5, marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#A8544A' }}>
                + fase
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AI State Card (Destaque Central) */}
        {todayCheckin ? (
          <Card
            style={{
              marginBottom: appSpacing.xl,
              backgroundColor: appColors.surface,
              borderWidth: 1,
              borderColor: appGlass.cardBorder,
              shadowColor: appGlass.cardShadow,
            }}
            mode="outlined"
          >
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: appSpacing.sm }}>
                <Text style={{ fontSize: 18, color: colors.icon }}>✦</Text>
                <Text
                  variant="labelLarge"
                  style={{
                    marginLeft: appSpacing.sm,
                    color: colors.text,
                    fontWeight: '700',
                    letterSpacing: 1.2,
                  }}
                >
                  {todayCheckin.stateLabel}
                </Text>
              </View>
              <Text
                variant="bodyMedium"
                style={{
                  color: appColors.textPrimary,
                  marginBottom: appSpacing.md,
                }}
              >
                {todayCheckin.aiState?.analysis ?? 'Análise em processamento...'}
              </Text>
              
              <View
                style={{
                  backgroundColor: appColors.surfaceAlt,
                  padding: appSpacing.sm,
                  borderRadius: appRadius.md,
                }}
              >
                <Text
                  variant="labelSmall"
                  style={{
                    fontWeight: '700',
                    color: appColors.textSecondary,
                    marginBottom: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  Sugestão IA
                </Text>
                <Text
                  variant="bodySmall"
                  style={{
                    color: appColors.textPrimary,
                    fontStyle: 'italic',
                  }}
                >
                  "{todayCheckin.aiState?.recommendations?.[0] ?? 'Continue com sua rotina habitual.'}"
                </Text>
              </View>
            </Card.Content>
          </Card>
        ) : (
          <Card style={{ marginBottom: appSpacing.xl }} mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: appSpacing.xl }}>
              <Text
                variant="bodyMedium"
                style={{
                  color: appColors.textSecondary,
                  textAlign: 'center',
                  marginBottom: appSpacing.lg,
                }}
              >
                Ainda não sei como você está hoje.
              </Text>
            <Button
              mode="contained"
              icon="plus-circle-outline"
              onPress={() => navigation.navigate('Checkin')}
              buttonColor={appColors.primary}
              textColor={appColors.textPrimary}
              contentStyle={{ paddingHorizontal: appSpacing.md }}
            >
              Fazer Check-in
            </Button>
          </Card.Content>
          </Card>
        )}

        <Card
          style={{
            marginBottom: appSpacing.lg,
            backgroundColor: appColors.surface,
            borderWidth: 1,
            borderColor: appGlass.cardBorder,
            shadowColor: appGlass.cardShadow,
          }}
          mode="outlined"
        >
          <Card.Content>
            <Text variant="labelSmall" style={{ color: appColors.primaryStrong, fontWeight: '700', letterSpacing: 1.1 }}>
              MODO DE HOJE
            </Text>
            <Text variant="titleMedium" style={{ color: appColors.textPrimary, fontWeight: '700', marginTop: 6 }}>
              {support.title}
            </Text>
            <Text variant="bodyMedium" style={{ color: appColors.textSecondary, marginTop: 6, lineHeight: 20 }}>
              {support.summary}
            </Text>

            <View style={{ marginTop: appSpacing.md, backgroundColor: appColors.surfaceAlt, borderRadius: appRadius.md, padding: appSpacing.md }}>
              <Text variant="labelSmall" style={{ color: appColors.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>
                Proximo passo sugerido
              </Text>
              <Text variant="bodyMedium" style={{ color: appColors.textPrimary, marginTop: 4 }}>
                {support.primaryAction}
              </Text>
            </View>

            <View style={{ marginTop: appSpacing.md, gap: appSpacing.sm }}>
              {support.anchors.map((anchor) => (
                <View key={anchor} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: appSpacing.sm }}>
                  <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: appColors.primary, marginTop: 6 }} />
                  <Text variant="bodySmall" style={{ color: appColors.textPrimary, flex: 1 }}>
                    {anchor}
                  </Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card
          style={{
            marginBottom: appSpacing.xl,
            backgroundColor: appColors.surface,
            borderWidth: 1,
            borderColor: appGlass.cardBorder,
            shadowColor: appGlass.cardShadow,
          }}
          mode="outlined"
        >
          <Card.Content>
            <Text variant="labelSmall" style={{ color: appColors.primaryStrong, fontWeight: '700', letterSpacing: 1.1 }}>
              PROGRESSO GENTIL
            </Text>
            <Text variant="titleMedium" style={{ color: appColors.textPrimary, fontWeight: '700', marginTop: 6 }}>
              {game.missionTitle}
            </Text>
            <Text variant="bodyMedium" style={{ color: appColors.textSecondary, marginTop: 6 }}>
              {game.missionReason}
            </Text>

            <View style={{ flexDirection: 'row', gap: appSpacing.sm, marginTop: appSpacing.md }}>
              <View style={{ flex: 1, backgroundColor: appColors.surfaceAlt, borderRadius: appRadius.md, padding: appSpacing.md }}>
                <Text variant="labelSmall" style={{ color: appColors.textSecondary, textTransform: 'uppercase' }}>
                  Ritmo
                </Text>
                <Text variant="titleMedium" style={{ color: appColors.textPrimary, fontWeight: '700', marginTop: 4 }}>
                  {game.streakDays} dias
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: appColors.surfaceAlt, borderRadius: appRadius.md, padding: appSpacing.md }}>
                <Text variant="labelSmall" style={{ color: appColors.textSecondary, textTransform: 'uppercase' }}>
                  Consistencia
                </Text>
                <Text variant="titleMedium" style={{ color: appColors.textPrimary, fontWeight: '700', marginTop: 4 }}>
                  {game.consistencyScore}%
                </Text>
              </View>
            </View>

            <View style={{ marginTop: appSpacing.md, gap: appSpacing.sm }}>
              {game.badges.map((badge) => (
                <View
                  key={badge.id}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: badge.tone === 'care' ? 'rgba(150,199,179,0.16)' : badge.tone === 'focus' ? 'rgba(99,152,169,0.16)' : appColors.primarySoft,
                    borderRadius: appRadius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text variant="labelSmall" style={{ color: appColors.textPrimary, fontWeight: '700' }}>
                    {badge.label}
                  </Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Atalhos Rápidos */}
        <View
          style={{
            flexDirection: 'row',
            gap: appSpacing.md,
            marginBottom: appSpacing.xl,
          }}
        >
          <Card 
            style={{ flex: 1, backgroundColor: appColors.surface }} 
            onPress={() => navigation.navigate('Diário')}
            mode="outlined"
          >
            <Card.Content style={{ alignItems: 'center', padding: appSpacing.md }}>
              <Text style={{ fontSize: 24, color: appColors.primary }}>✎</Text>
              <Text variant="labelLarge" style={{ marginTop: appSpacing.sm, fontWeight: '600' }}>
                Diário
              </Text>
            </Card.Content>
          </Card>
          
          <Card 
            style={{ flex: 1, backgroundColor: appColors.surface }} 
            onPress={() => navigation.navigate('Planner')}
            mode="outlined"
          >
            <Card.Content style={{ alignItems: 'center', padding: appSpacing.md }}>
              <Text style={{ fontSize: 24, color: appColors.primary }}>▦</Text>
              <Text variant="labelLarge" style={{ marginTop: appSpacing.sm, fontWeight: '600' }}>
                Planner
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Preview do Planner (Agenda de Hoje) */}
        <View style={{ marginBottom: appSpacing.xl * 1.5 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: appSpacing.md,
            }}
          >
            <Text variant="titleMedium" style={{ color: appColors.textPrimary, fontWeight: '700' }}>
              Próximo na agenda
            </Text>
            <Button compact mode="text" onPress={() => navigation.navigate('Planner')}>
              Ver tudo
            </Button>
          </View>

          {plannerLoading ? (
            <ActivityIndicator animating color={appColors.primary} />
          ) : blocks.length > 0 ? (
            blocks.slice(0, 3).map((block) => (
              <Card
                key={block.id}
                style={{
                  marginBottom: appSpacing.sm,
                  backgroundColor: appColors.surface,
                  borderLeftWidth: 4,
                  borderLeftColor: appColors.primary,
                }}
                mode="outlined"
              >
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: appSpacing.md }}>
                  <View style={{ width: 60 }}>
                    <Text variant="labelSmall" style={{ color: appColors.textSecondary, fontWeight: '700' }}>
                      {block.startTime}
                    </Text>
                  </View>
                  <View style={{ flex: 1, paddingLeft: appSpacing.sm }}>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }} numberOfLines={1}>
                      {block.title}
                    </Text>
                    <Text variant="labelSmall" style={{ color: appColors.textSecondary }}>
                      Intensidade: {block.intensity}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))
          ) : (
            <Text
              variant="bodySmall"
              style={{
                color: appColors.textSecondary,
                fontStyle: 'italic',
                textAlign: 'center',
                paddingVertical: appSpacing.md,
              }}
            >
              Sua agenda está livre por enquanto.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

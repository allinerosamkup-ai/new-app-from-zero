import React, { useEffect } from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, Text, Button, ActivityIndicator, IconButton, MD3Colors } from 'react-native-paper';
import { useCheckinStore } from '../providers/checkin_store';
import { usePlannerStore } from '../providers/planner_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideSparkles, LucideMessageCircle, LucideCalendar, LucidePlusCircle } from 'lucide-react-native';
import { appColors, appRadius, appSpacing, appTypography } from '../theme/appTheme';

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

  const stateColors: Record<string, { bg: string, border: string, text: string, icon: string }> = {
    leve: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', icon: '#166534' },
    moderado: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: '#1E40AF' },
    sensível: { bg: '#FFFBEB', border: '#FEF3C7', text: '#92400E', icon: '#92400E' },
    crítico: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '#991B1B' },
  };

  const currentType = todayCheckin?.stateLabelType || 'moderado';
  const colors = stateColors[currentType];

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
        <View style={{ marginBottom: appSpacing.xl }}>
          <Text variant="labelMedium" style={{ color: appColors.textSecondary }}>
            Bom dia,
          </Text>
          <Text variant="headlineMedium" style={{ color: appColors.textPrimary, fontWeight: '700' }}>
            Ciclagem & Humor
          </Text>
        </View>

        {/* AI State Card (Destaque Central) */}
        {todayCheckin ? (
          <Card
            style={{
              marginBottom: appSpacing.xl,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            mode="outlined"
          >
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: appSpacing.sm }}>
                <LucideSparkles size={20} color={colors.icon} />
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
                  color: '#111827',
                  marginBottom: appSpacing.md,
                }}
              >
                {todayCheckin.aiState.analysis}
              </Text>
              
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  padding: appSpacing.sm,
                  borderRadius: appRadius.md,
                }}
              >
                <Text
                  variant="labelSmall"
                  style={{
                    fontWeight: '700',
                    color: '#6b7280',
                    marginBottom: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  Sugestão IA
                </Text>
                <Text
                  variant="bodySmall"
                  style={{
                    color: '#111827',
                    fontStyle: 'italic',
                  }}
                >
                  "{todayCheckin.aiState.recommendations[0]}"
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
                icon={({ size, color }) => <LucidePlusCircle size={size} color={color} />}
                onPress={() => navigation.navigate('Checkin')}
                contentStyle={{ paddingHorizontal: appSpacing.md }}
              >
                Fazer Check-in
              </Button>
            </Card.Content>
          </Card>
        )}

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
              <LucideMessageCircle size={24} color={appColors.primary} />
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
              <LucideCalendar size={24} color={appColors.primary} />
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

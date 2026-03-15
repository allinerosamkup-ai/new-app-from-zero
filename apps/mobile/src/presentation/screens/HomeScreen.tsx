import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

  const stateColors: Record<string, string> = {
    leve: 'bg-green-50 border-green-200 text-green-800',
    moderado: 'bg-blue-50 border-blue-200 text-blue-800',
    sensível: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    crítico: 'bg-red-50 border-red-200 text-red-800',
  };

  const currentType = todayCheckin?.stateLabelType || 'moderado';

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
        <View
          style={{
            marginBottom: appSpacing.xl,
          }}
        >
          <Text
            style={{
              color: appColors.textSecondary,
              fontSize: 13,
              fontWeight: '500',
            }}
          >
            Bom dia,
          </Text>
          <Text
            style={{
              ...appTypography.title,
              color: appColors.textPrimary,
              marginTop: 4,
            }}
          >
            Ciclagem & Humor
          </Text>
        </View>

        {/* AI State Card (Destaque Central) */}
        {todayCheckin ? (
          <View
            style={{
              padding: appSpacing.xl,
              borderRadius: appRadius.lg * 1.2,
              borderWidth: 1,
              marginBottom: appSpacing.xl,
            }}
            className={stateColors[currentType]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: appSpacing.sm }}>
              <LucideSparkles size={20} color={currentType === 'crítico' ? '#991B1B' : '#1E40AF'} />
              <Text
                style={{
                  marginLeft: appSpacing.sm,
                  fontSize: 14,
                  fontWeight: '700',
                  letterSpacing: 1.6,
                }}
              >
                {todayCheckin.stateLabel}
              </Text>
            </View>
            <Text
              style={{
                color: '#111827',
                fontSize: 14,
                lineHeight: 20,
                marginBottom: appSpacing.md,
              }}
            >
              {todayCheckin.aiState.analysis}
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.75)',
                padding: appSpacing.sm,
                borderRadius: appRadius.md,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                }}
              >
                Sugestão IA
              </Text>
              <Text
                style={{
                  color: '#111827',
                  fontStyle: 'italic',
                  fontSize: 13,
                }}
              >
                "{todayCheckin.aiState.recommendations[0]}"
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: appColors.surface,
              padding: appSpacing.xl,
              borderRadius: appRadius.lg * 1.2,
              borderWidth: 1,
              borderColor: appColors.borderSubtle,
              marginBottom: appSpacing.xl,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: appColors.textSecondary,
                textAlign: 'center',
                marginBottom: appSpacing.md,
              }}
            >
              Ainda não sei como você está hoje.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Checkin')}
              style={{
                backgroundColor: appColors.primary,
                paddingHorizontal: appSpacing.lg,
                paddingVertical: appSpacing.sm + 2,
                borderRadius: appRadius.pill,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <LucidePlusCircle size={20} color="white" />
              <Text
                style={{
                  color: 'white',
                  fontWeight: '700',
                  marginLeft: appSpacing.sm,
                }}
              >
                Fazer Check-in
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Atalhos Rápidos */}
        <View
          style={{
            flexDirection: 'row',
            gap: appSpacing.md,
            marginBottom: appSpacing.xl,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate('Diário')}
            style={{
              flex: 1,
              backgroundColor: appColors.surface,
              padding: appSpacing.md,
              borderRadius: appRadius.md,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: appColors.borderSubtle,
            }}
          >
            <LucideMessageCircle size={24} color="#3b82f6" />
            <Text
              style={{
                color: appColors.textPrimary,
                fontWeight: '600',
                marginTop: appSpacing.sm,
              }}
            >
              Diário
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Planner')}
            style={{
              flex: 1,
              backgroundColor: appColors.surface,
              padding: appSpacing.md,
              borderRadius: appRadius.md,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: appColors.borderSubtle,
            }}
          >
            <LucideCalendar size={24} color="#3b82f6" />
            <Text
              style={{
                color: appColors.textPrimary,
                fontWeight: '600',
                marginTop: appSpacing.sm,
              }}
            >
              Planner
            </Text>
          </TouchableOpacity>
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
            <Text
              style={{
                ...appTypography.subtitle,
                color: appColors.textPrimary,
              }}
            >
              Próximo na agenda
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Planner')}>
              <Text
                style={{
                  color: appColors.primary,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                Ver tudo
              </Text>
            </TouchableOpacity>
          </View>

          {plannerLoading ? (
            <ActivityIndicator color={appColors.primary} />
          ) : blocks.length > 0 ? (
            blocks.slice(0, 3).map((block) => (
              <View
                key={block.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: appSpacing.sm,
                  backgroundColor: appColors.surface,
                  padding: appSpacing.md,
                  borderRadius: appRadius.md,
                  borderLeftWidth: 3,
                  borderLeftColor: appColors.primary,
                  borderWidth: 1,
                  borderColor: appColors.borderSubtle,
                }}
              >
                <View style={{ width: 52 }}>
                  <Text
                    style={{
                      color: appColors.textSecondary,
                      fontWeight: '700',
                      fontSize: 10,
                    }}
                  >
                    {block.startTime}
                  </Text>
                </View>
                <View style={{ flex: 1, paddingLeft: appSpacing.md }}>
                  <Text
                    style={{
                      color: appColors.textPrimary,
                      fontWeight: '600',
                      marginBottom: 2,
                    }}
                    numberOfLines={1}
                  >
                    {block.title}
                  </Text>
                  <Text
                    style={{
                      color: appColors.textSecondary,
                      fontSize: 11,
                    }}
                  >
                    Intensidade: {block.intensity}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text
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

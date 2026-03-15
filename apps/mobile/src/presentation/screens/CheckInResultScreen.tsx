import React from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  Surface, 
  Avatar, 
  Chip,
  MD3Colors 
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useCheckinStore } from '../providers/checkin_store';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type StateType = 'leve' | 'moderado' | 'sensível' | 'crítico';

const STATE_CONFIG: Record<StateType, {
  label: string;
  emoji: string;
  color: string;
  textColor: string;
  bgColor: string;
  focus: string;
  icon: string;
}> = {
  leve: {
    label: 'Energia Leve',
    emoji: '🌱',
    color: '#9AD7B4',
    textColor: '#166534',
    bgColor: '#F0FDF4',
    focus: 'Foco balanceado',
    icon: 'leaf-outline',
  },
  moderado: {
    label: 'Energia Radiante',
    emoji: '✨',
    color: '#FFBE7A',
    textColor: '#92400E',
    bgColor: '#FFFBEB',
    focus: 'Foco profundo',
    icon: 'sparkles',
  },
  sensível: {
    label: 'Dia Sensível',
    emoji: '🌙',
    color: '#D8C8FF',
    textColor: '#5B21B6',
    bgColor: '#FAF5FF',
    focus: 'Foco leve',
    icon: 'moon-waning-crescent',
  },
  crítico: {
    label: 'Modo Recuperação',
    emoji: '🌊',
    color: '#FF9BA5',
    textColor: '#9F1239',
    bgColor: '#FFF1F2',
    focus: 'Descanso',
    icon: 'waves',
  },
};

/**
 * CheckInResultScreen: Tela de revelação do estado do dia com UI do Paper.
 */
export default function CheckInResultScreen() {
  const navigation = useNavigation<any>();
  const { todayCheckin } = useCheckinStore();

  const stateType = (todayCheckin?.stateLabelType ?? 'leve') as StateType;
  const config = STATE_CONFIG[stateType] ?? STATE_CONFIG.leve;
  const summary = todayCheckin?.stateSummary ?? 'Seu estado de hoje foi registrado.';
  const recommendations: string[] = (todayCheckin as any)?.aiState?.recommendations ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: config.bgColor }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: appSpacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Blob + Emoji */}
        <View style={{ alignItems: 'center', marginTop: appSpacing.xl, marginBottom: appSpacing.lg }}>
          <Surface
            elevation={4}
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: config.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 56 }}>{config.emoji}</Text>
          </Surface>
        </View>

        {/* Label de estado */}
        <Text
          variant="headlineMedium"
          style={{
            fontWeight: '800',
            color: config.textColor,
            textAlign: 'center',
            marginBottom: appSpacing.xs,
          }}
        >
          {config.label}
        </Text>

        {/* Badge de foco */}
        <View style={{ alignItems: 'center', marginBottom: appSpacing.xl }}>
          <Chip 
            style={{ backgroundColor: config.color + '66' }} 
            textStyle={{ color: config.textColor, fontWeight: '700' }}
          >
            {config.focus}
          </Chip>
        </View>

        {/* Análise da IA */}
        <Card 
          style={{ 
            backgroundColor: 'rgba(255,255,255,0.6)', 
            marginBottom: appSpacing.lg,
            borderWidth: 0
          }} 
          mode="contained"
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={{
                color: config.textColor,
                lineHeight: 28,
                textAlign: 'center',
                fontStyle: 'italic'
              }}
            >
              {summary}
            </Text>
          </Card.Content>
        </Card>

        {/* Recomendações da IA */}
        {recommendations.length > 0 && (
          <View style={{ marginBottom: appSpacing.xl }}>
            <Text
              variant="labelLarge"
              style={{
                color: config.textColor,
                marginBottom: appSpacing.sm,
                textTransform: 'uppercase',
                fontWeight: '700',
                opacity: 0.7,
                letterSpacing: 1.2
              }}
            >
              Sugestões para hoje
            </Text>
            {recommendations.slice(0, 3).map((rec, i) => (
              <Surface
                key={i}
                elevation={1}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  borderRadius: appRadius.md,
                  padding: appSpacing.md,
                  marginBottom: appSpacing.sm,
                }}
              >
                <Avatar.Icon size={32} icon="lightbulb-outline" backgroundColor={config.color + '44'} color={config.textColor} />
                <Text
                  variant="bodyMedium"
                  style={{
                    color: config.textColor,
                    flex: 1,
                    marginLeft: appSpacing.md,
                    lineHeight: 20,
                  }}
                >
                  {rec}
                </Text>
              </Surface>
            ))}
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Button
          mode="contained"
          onPress={() => navigation.navigate('MainTabs')}
          style={{ 
            backgroundColor: config.textColor, 
            borderRadius: appRadius.md,
            paddingVertical: 6
          }}
          labelStyle={{ fontWeight: '700', fontSize: 16 }}
          icon="arrow-right"
          contentStyle={{ flexDirection: 'row-reverse' }}
        >
          Ver meu dia
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

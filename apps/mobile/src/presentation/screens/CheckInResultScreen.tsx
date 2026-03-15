import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCheckinStore } from '../providers/checkin_store';

type StateType = 'leve' | 'moderado' | 'sensível' | 'crítico';

const STATE_CONFIG: Record<StateType, {
  label: string;
  emoji: string;
  color: string;
  textColor: string;
  bgColor: string;
  focus: string;
}> = {
  leve: {
    label: 'Energia Leve',
    emoji: '🌱',
    color: '#9AD7B4',
    textColor: '#166534',
    bgColor: '#F0FDF4',
    focus: 'Foco balanceado',
  },
  moderado: {
    label: 'Energia Radiante',
    emoji: '✨',
    color: '#FFBE7A',
    textColor: '#92400E',
    bgColor: '#FFFBEB',
    focus: 'Foco profundo',
  },
  sensível: {
    label: 'Dia Sensível',
    emoji: '🌙',
    color: '#D8C8FF',
    textColor: '#5B21B6',
    bgColor: '#FAF5FF',
    focus: 'Foco leve',
  },
  crítico: {
    label: 'Modo Recuperação',
    emoji: '🌊',
    color: '#FF9BA5',
    textColor: '#9F1239',
    bgColor: '#FFF1F2',
    focus: 'Descanso',
  },
};

/**
 * CheckInResultScreen: Tela de revelação do estado do dia.
 * O "momento de valor" do app — mostra o diagnóstico da IA com cor + texto.
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
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Blob + Emoji */}
        <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 28 }}>
          <View
            style={{
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: config.color,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: config.color,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 18,
              elevation: 10,
            }}
          >
            <Text style={{ fontSize: 56 }}>{config.emoji}</Text>
          </View>
        </View>

        {/* Label de estado */}
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: config.textColor,
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          {config.label}
        </Text>

        {/* Badge de foco */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View
            style={{
              backgroundColor: config.color + '55',
              paddingHorizontal: 18,
              paddingVertical: 7,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: config.textColor,
                letterSpacing: 0.3,
              }}
            >
              {config.focus}
            </Text>
          </View>
        </View>

        {/* Análise da IA */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.65)',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: config.textColor,
              lineHeight: 26,
              textAlign: 'center',
              opacity: 0.9,
            }}
          >
            {summary}
          </Text>
        </View>

        {/* Recomendações da IA */}
        {recommendations.length > 0 && (
          <View style={{ marginBottom: 28 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: config.textColor,
                letterSpacing: 0.4,
                marginBottom: 10,
                textTransform: 'uppercase',
                opacity: 0.7,
              }}
            >
              Sugestões para hoje
            </Text>
            {recommendations.slice(0, 3).map((rec, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: 'rgba(255,255,255,0.65)',
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 14, marginRight: 10, marginTop: 1 }}>💡</Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: config.textColor,
                    flex: 1,
                    lineHeight: 21,
                  }}
                >
                  {rec}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs')}
          style={{
            backgroundColor: config.color,
            paddingVertical: 18,
            borderRadius: 16,
            alignItems: 'center',
            shadowColor: config.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 6,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: config.textColor,
            }}
          >
            Ver meu dia →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

import React from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  Avatar, 
  Chip, 
  Surface,
  IconButton,
  MD3Colors
} from 'react-native-paper';
import { LucideCheckCircle2, LucideSparkles, LucideHeart, LucideLightbulb, LucideArrowRight } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

/**
 * DailySummaryScreen: Tela de feedback pós-diário ou check-in com UI do Paper.
 */
export default function DailySummaryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  const summaryData = route.params?.summary || {
    text: "Hoje você trouxe reflexões profundas sobre o equilíbrio entre trabalho e descanso. Parece que reconhecer seus limites está sendo um passo importante para sua regulação de energia.",
    emotions: ["cansada", "reflexiva", "esperançosa"],
    themes: ["trabalho", "autocuidado"],
    suggestions: ["Tente uma pausa de 10 min sem telas agora.", "Que tal uma bebida quente para relaxar?"]
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.xl, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {/* Header de Sucesso */}
        <View style={{ alignItems: 'center', marginBottom: appSpacing.xl }}>
          <Avatar.Icon 
            size={80} 
            icon="check-circle" 
            backgroundColor={MD3Colors.primary95} 
            color={MD3Colors.primary40} 
          />
          <Text variant="headlineMedium" style={{ fontWeight: '700', marginTop: appSpacing.md, color: appColors.textPrimary }}>
            Sessão Concluída
          </Text>
          <Text variant="bodyMedium" style={{ color: appColors.textSecondary }}>
            Aqui está o que sua IA percebeu
          </Text>
        </View>

        {/* Emoções Detectadas (Chips) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: appSpacing.xl, gap: 8 }}>
          {summaryData.emotions.map((emotion: string, index: number) => (
            <Chip 
              key={index} 
              icon="heart-outline" 
              selectedColor={appColors.primary}
              style={{ backgroundColor: appColors.primarySoft }}
              textStyle={{ fontWeight: '700', textTransform: 'capitalize' }}
            >
              {emotion}
            </Chip>
          ))}
        </View>

        {/* Card Principal de Resumo */}
        <Card style={{ marginBottom: appSpacing.xl, backgroundColor: MD3Colors.secondary99 }} mode="outlined">
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: appSpacing.sm }}>
              <LucideSparkles size={18} color={MD3Colors.secondary40} />
              <Text variant="labelMedium" style={{ marginLeft: appSpacing.sm, fontWeight: '700', color: MD3Colors.secondary40, letterSpacing: 1.2 }}>
                SÍNTESE DA CONVERSA
              </Text>
            </View>
            <Text variant="titleMedium" style={{ fontStyle: 'italic', lineHeight: 26, color: appColors.textPrimary }}>
              "{summaryData.text}"
            </Text>
          </Card.Content>
        </Card>

        {/* Sugestões */}
        <View style={{ marginBottom: appSpacing.xl * 1.5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: appSpacing.md }}>
            <LucideLightbulb size={22} color={MD3Colors.tertiary50} />
            <Text variant="titleLarge" style={{ fontWeight: '700', marginLeft: appSpacing.sm }}>
              Sugestões para agora
            </Text>
          </View>
          
          {summaryData.suggestions.map((suggestion: string, index: number) => (
            <Surface 
              key={index} 
              style={{ 
                padding: appSpacing.md, 
                borderRadius: appRadius.md, 
                backgroundColor: appColors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: appSpacing.sm,
                elevation: 1
              }}
            >
              <Avatar.Icon size={32} icon="lightbulb-on-outline" backgroundColor={MD3Colors.tertiary95} color={MD3Colors.tertiary50} />
              <Text variant="bodyMedium" style={{ flex: 1, marginLeft: appSpacing.md, color: appColors.textPrimary }}>
                {suggestion}
              </Text>
            </Surface>
          ))}
        </View>

        {/* Botão Finalizar */}
        <Button
          mode="contained"
          onPress={() => navigation.navigate('MainTabs' as any)}
          icon="home"
          contentStyle={{ paddingVertical: 8 }}
          style={{ borderRadius: appRadius.md }}
        >
          Voltar para o Início
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

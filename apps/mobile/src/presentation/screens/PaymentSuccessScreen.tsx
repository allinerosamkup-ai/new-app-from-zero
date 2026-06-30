import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type RouteParams = {
  plan: 'pro' | 'premium';
  billing: 'monthly' | 'annual';
  price: number;
};

const PLAN_CONFIG = {
  pro: { name: 'Pro', emoji: '🚀', color: '#D7897F', unlocks: ['HRV e mapa de energia', 'Agenda por fase do ciclo', 'Google Calendar sync', 'Modo Recovery automático', 'Insights avançados com IA'] },
  premium: { name: 'Premium', emoji: '✨', color: '#9B7AB8', unlocks: ['Tudo do Pro', 'Relatórios PDF mensais', 'Apple Health / Google Fit', 'Planos de nutrição por fase', 'Suporte prioritário 24h'] },
};

export default function PaymentSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { plan, billing, price } = (route.params || { plan: 'pro', billing: 'annual', price: 19.9 }) as RouteParams;

  const cfg = PLAN_CONFIG[plan];

  // Animações de entrada
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {/* Ícone animado */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }], backgroundColor: cfg.color }]}>
          <Text style={styles.iconEmoji}>{cfg.emoji}</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          <Text style={styles.title}>Bem-vinda ao {cfg.name}! 🎉</Text>
          <Text style={styles.subtitle}>
            Plano {cfg.name} · {billing === 'annual' ? 'Anual' : 'Mensal'} · R$ {price.toFixed(2).replace('.', ',')}
          </Text>

          {/* Receipt card */}
          <View style={styles.receiptCard}>
            <Text style={styles.receiptTitle}>O que você desbloqueou</Text>
            {cfg.unlocks.map((item, i) => (
              <View key={i} style={styles.unlockRow}>
                <View style={[styles.unlockDot, { backgroundColor: cfg.color }]} />
                <Text style={styles.unlockTxt}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Próximos passos */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>✨ Próximos passos</Text>
            {[
              { step: '1', txt: 'Faça seu primeiro check-in completo com HRV' },
              { step: '2', txt: 'Conecte o Google Calendar para sincronizar sua agenda' },
              { step: '3', txt: 'Deixe a Aura montar seu plano semanal' },
            ].map(s => (
              <View key={s.step} style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: cfg.color }]}>
                  <Text style={styles.stepNumTxt}>{s.step}</Text>
                </View>
                <Text style={styles.stepTxt}>{s.txt}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* CTAs */}
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: cfg.color }]}
          onPress={() => navigation.navigate('GoogleCalendar')}
        >
          <Text style={styles.ctaTxt}>Conectar Google Calendar →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctaSecondary}
          onPress={() => navigation.navigate('MainTabs')}
        >
          <Text style={styles.ctaSecondaryTxt}>Explorar o app agora</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF6F2' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.xl * 2 },
  iconWrap: {
    width: 96, height: 96, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: appSpacing.xl,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  iconEmoji: { fontSize: 44 },
  title: { fontSize: 24, fontWeight: '800', color: appColors.textPrimary, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, color: appColors.textSecondary, marginBottom: appSpacing.xl },
  receiptCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: appRadius.lg,
    padding: appSpacing.lg, marginBottom: appSpacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  receiptTitle: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary, marginBottom: appSpacing.md },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  unlockDot: { width: 6, height: 6, borderRadius: 3 },
  unlockTxt: { fontSize: 13, color: appColors.textPrimary },
  stepsCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: appRadius.lg,
    padding: appSpacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  stepsTitle: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary, marginBottom: appSpacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepTxt: { fontSize: 13, color: appColors.textSecondary, flex: 1, lineHeight: 20 },
  footer: {
    padding: appSpacing.lg, gap: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(215,137,127,.15)',
  },
  ctaBtn: {
    height: 52, borderRadius: appRadius.pill,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  ctaTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  ctaSecondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ctaSecondaryTxt: { fontSize: 14, color: appColors.textSecondary, fontWeight: '600' },
});

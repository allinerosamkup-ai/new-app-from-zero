import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type PlanId = 'free' | 'pro' | 'premium';
type Billing = 'monthly' | 'annual';

const PLANS: Array<{
  id: PlanId;
  name: string;
  emoji: string;
  priceMonthly: number;
  priceAnnual: number;
  color: string;
  highlight: boolean;
  badge?: string;
  features: string[];
  missing: string[];
}> = [
  {
    id: 'free',
    name: 'Gratuito',
    emoji: '🌱',
    priceMonthly: 0,
    priceAnnual: 0,
    color: '#96C7B3',
    highlight: false,
    features: [
      'Check-in diário de humor e energia',
      'Calendário do ciclo (básico)',
      'Diário com IA (5 mensagens/dia)',
      'Insights semanais simples',
    ],
    missing: [
      'HRV e mapa de energia',
      'Agenda inteligente por fase',
      'Google Calendar sync',
      'Insights avançados com IA',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    emoji: '🚀',
    priceMonthly: 29.90,
    priceAnnual: 19.90,
    color: '#D7897F',
    highlight: true,
    badge: 'Mais popular',
    features: [
      'Tudo do Gratuito',
      'HRV e mapa de energia completo',
      'Agenda inteligente por fase do ciclo',
      'Diário com IA ilimitado',
      'Insights avançados semanais',
      'Modo Recovery automático',
      'Google Calendar sync',
    ],
    missing: [
      'Relatórios mensais exportáveis',
      'Suporte prioritário',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    emoji: '✨',
    priceMonthly: 49.90,
    priceAnnual: 34.90,
    color: '#9B7AB8',
    highlight: false,
    badge: 'Completo',
    features: [
      'Tudo do Pro',
      'Relatórios mensais exportáveis (PDF)',
      'Análise preditiva de fases',
      'Integração com Apple Health / Google Fit',
      'Planos de nutrição por fase',
      'Suporte prioritário 24h',
      'Acesso antecipado a novidades',
    ],
    missing: [],
  },
];

export default function PlansScreen() {
  const navigation = useNavigation<any>();
  const [billing, setBilling] = useState<Billing>('annual');
  const [selected, setSelected] = useState<PlanId>('pro');

  const annualDiscount = (plan: typeof PLANS[0]) =>
    Math.round((1 - plan.priceAnnual / plan.priceMonthly) * 100);

  const currentPlan = PLANS.find(p => p.id === selected)!;
  const price = billing === 'annual' ? currentPlan.priceAnnual : currentPlan.priceMonthly;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planos</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Sincronize com seu ritmo</Text>
          <Text style={styles.heroSub}>Escolha o plano que respeita o seu ciclo e potencializa sua energia.</Text>
        </View>

        {/* Billing toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[styles.billingBtn, billing === 'monthly' && styles.billingBtnActive]}
            onPress={() => setBilling('monthly')}
          >
            <Text style={[styles.billingTxt, billing === 'monthly' && styles.billingTxtActive]}>Mensal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.billingBtn, billing === 'annual' && styles.billingBtnActive]}
            onPress={() => setBilling('annual')}
          >
            <Text style={[styles.billingTxt, billing === 'annual' && styles.billingTxtActive]}>Anual</Text>
            <View style={styles.saveBadge}><Text style={styles.saveTxt}>-33%</Text></View>
          </TouchableOpacity>
        </View>

        {/* Cards de plano */}
        {PLANS.map(plan => {
          const isSelected = plan.id === selected;
          const planPrice = billing === 'annual' ? plan.priceAnnual : plan.priceMonthly;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, isSelected && { borderColor: plan.color, borderWidth: 2 }]}
              onPress={() => setSelected(plan.id)}
              activeOpacity={0.8}
            >
              {/* Badge */}
              {plan.badge && (
                <View style={[styles.planBadge, { backgroundColor: plan.color }]}>
                  <Text style={styles.planBadgeTxt}>{plan.badge}</Text>
                </View>
              )}

              <View style={styles.planTop}>
                <Text style={styles.planEmoji}>{plan.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.id !== 'free' && billing === 'annual' && (
                    <Text style={styles.planDiscount}>-{annualDiscount(plan)}% no anual</Text>
                  )}
                </View>
                {/* Seletor */}
                <View style={[styles.radio, isSelected && { borderColor: plan.color }]}>
                  {isSelected && <View style={[styles.radioDot, { backgroundColor: plan.color }]} />}
                </View>
              </View>

              {/* Preço */}
              <View style={styles.priceRow}>
                {plan.id === 'free' ? (
                  <Text style={[styles.priceMain, { color: plan.color }]}>Grátis</Text>
                ) : (
                  <>
                    <Text style={styles.priceCurrency}>R$</Text>
                    <Text style={[styles.priceMain, { color: plan.color }]}>{planPrice.toFixed(2).replace('.', ',')}</Text>
                    <Text style={styles.pricePer}>/mês</Text>
                  </>
                )}
              </View>
              {plan.id !== 'free' && billing === 'annual' && (
                <Text style={styles.priceAnnualNote}>R$ {(planPrice * 12).toFixed(2).replace('.', ',')} cobrado anualmente</Text>
              )}

              {/* Features */}
              <View style={styles.featuresList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={[styles.featureIcon, { color: plan.color }]}>✓</Text>
                    <Text style={styles.featureTxt}>{f}</Text>
                  </View>
                ))}
                {plan.missing.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={styles.featureIconMissing}>✗</Text>
                    <Text style={styles.featureTxtMissing}>{f}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Garantia */}
        <View style={styles.guarantee}>
          <Text style={styles.guaranteeEmoji}>🔒</Text>
          <Text style={styles.guaranteeTxt}>7 dias de garantia — cancele sem perguntas.</Text>
        </View>
      </ScrollView>

      {/* CTA fixo */}
      <View style={styles.footer}>
        {selected === 'free' ? (
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: '#96C7B3' }]} onPress={() => navigation.goBack()}>
            <Text style={styles.ctaTxt}>Continuar gratuitamente</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: currentPlan.color }]}
              onPress={() => navigation.navigate('PaymentSuccess', { plan: selected, billing, price })}
            >
              <Text style={styles.ctaTxt}>
                Assinar {currentPlan.name} · R$ {price.toFixed(2).replace('.', ',')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.footerNote}>Pagamento seguro · Cancele quando quiser</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF6F2' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: appSpacing.lg, paddingVertical: appSpacing.md,
  },
  backBtn: { width: 60 },
  backTxt: { fontSize: 14, color: '#D7897F', fontWeight: '600' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: appColors.textPrimary },
  hero: { paddingHorizontal: appSpacing.lg, paddingBottom: appSpacing.lg, alignItems: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: appColors.textPrimary, textAlign: 'center', marginBottom: 6 },
  heroSub: { fontSize: 14, color: appColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  billingToggle: {
    flexDirection: 'row', marginHorizontal: appSpacing.lg,
    backgroundColor: '#fff', borderRadius: appRadius.pill,
    padding: 4, marginBottom: appSpacing.lg,
    borderWidth: 1.5, borderColor: appColors.borderSubtle,
  },
  billingBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: appRadius.pill },
  billingBtnActive: { backgroundColor: '#D7897F' },
  billingTxt: { fontSize: 13, fontWeight: '600', color: appColors.textSecondary },
  billingTxtActive: { color: '#fff' },
  saveBadge: { backgroundColor: '#5DAE8B', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  saveTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  planCard: {
    marginHorizontal: appSpacing.lg, backgroundColor: '#fff',
    borderRadius: appRadius.lg, padding: appSpacing.lg,
    marginBottom: appSpacing.md, borderWidth: 1.5, borderColor: appColors.borderSubtle,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    position: 'relative', overflow: 'hidden',
  },
  planBadge: {
    position: 'absolute', top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
  },
  planBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planEmoji: { fontSize: 24 },
  planName: { fontSize: 17, fontWeight: '800', color: appColors.textPrimary },
  planDiscount: { fontSize: 11, color: '#5DAE8B', fontWeight: '600' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: appColors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 2 },
  priceCurrency: { fontSize: 14, fontWeight: '700', color: appColors.textSecondary, marginBottom: 4 },
  priceMain: { fontSize: 32, fontWeight: '800', lineHeight: 36 },
  pricePer: { fontSize: 13, color: appColors.textSecondary, marginBottom: 4 },
  priceAnnualNote: { fontSize: 11, color: appColors.textSecondary, marginBottom: appSpacing.md },
  featuresList: { gap: 8, marginTop: appSpacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureIcon: { fontSize: 13, fontWeight: '800', marginTop: 1 },
  featureTxt: { fontSize: 13, color: appColors.textPrimary, flex: 1, lineHeight: 18 },
  featureIconMissing: { fontSize: 13, color: appColors.borderSubtle, marginTop: 1 },
  featureTxtMissing: { fontSize: 13, color: appColors.borderSubtle, flex: 1, lineHeight: 18 },
  guarantee: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: appSpacing.lg, marginTop: 4,
  },
  guaranteeEmoji: { fontSize: 16 },
  guaranteeTxt: { fontSize: 12, color: appColors.textSecondary, lineHeight: 18 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FAF6F2', padding: appSpacing.lg,
    borderTopWidth: 1, borderTopColor: 'rgba(215,137,127,.15)',
    gap: 6,
  },
  ctaBtn: {
    height: 52, borderRadius: appRadius.pill,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  ctaTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  footerNote: { fontSize: 11, color: appColors.textSecondary, textAlign: 'center' },
});

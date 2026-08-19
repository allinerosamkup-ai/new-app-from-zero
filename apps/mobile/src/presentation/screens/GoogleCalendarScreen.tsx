import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type SyncStep = 'connect' | 'configure' | 'done';

type SyncOption = {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
};

const NECTARINE = '#D7897F';
const GOOGLE_BLUE = '#4285F4';

export default function GoogleCalendarScreen() {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<SyncStep>('connect');
  const [connecting, setConnecting] = useState(false);
  const [syncOptions, setSyncOptions] = useState<SyncOption[]>([
    { id: 'agenda',   label: 'Importar agenda',       desc: 'Puxa eventos do Google Calendar para a Aura', enabled: true },
    { id: 'energy',   label: 'Blocos de energia',      desc: 'Cria eventos de pico/foco/descanso no Calendar', enabled: true },
    { id: 'recovery', label: 'Modo Recovery',          desc: 'Marca dias de recuperação como ocupado', enabled: false },
    { id: 'cycle',    label: 'Fases do ciclo',         desc: 'Adiciona fases como eventos no Calendar', enabled: true },
    { id: 'tasks',    label: 'Tarefas da Aura',        desc: 'Sincroniza tarefas salvas com Google Tasks', enabled: false },
  ]);
  const [selectedCalendar, setSelectedCalendar] = useState('principal');

  const MOCK_CALENDARS = [
    { id: 'principal', name: 'Meu calendário', color: GOOGLE_BLUE },
    { id: 'trabalho',  name: 'Trabalho',        color: '#0F9D58' },
    { id: 'pessoal',   name: 'Pessoal',         color: '#DB4437' },
  ];

  function toggleOption(id: string) {
    setSyncOptions(prev => prev.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o));
  }

  function handleConnect() {
    setConnecting(true);
    // Em produção: OAuth2 flow via expo-auth-session + Google APIs
    // Aqui: simula o fluxo
    setTimeout(() => {
      setConnecting(false);
      setStep('configure');
    }, 1800);
  }

  function handleSave() {
    setStep('done');
  }

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneContent}>
          <View style={styles.doneIcon}>
            <Text style={{ fontSize: 44 }}>📅</Text>
          </View>
          <Text style={styles.doneTitle}>Calendário sincronizado!</Text>
          <Text style={styles.doneSub}>
            A Aura vai otimizar sua agenda respeitando seu ciclo e energia.
          </Text>

          <View style={styles.doneSummary}>
            <Text style={styles.doneSummaryTitle}>✅ Ativo agora</Text>
            {syncOptions.filter(o => o.enabled).map(o => (
              <View key={o.id} style={styles.doneSummaryRow}>
                <View style={[styles.doneDot, { backgroundColor: NECTARINE }]} />
                <Text style={styles.doneSummaryTxt}>{o.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: NECTARINE, marginTop: appSpacing.xl }]}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.btnTxt}>Ir para o app →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => setStep('configure')}
          >
            <Text style={styles.btnGhostTxt}>Ajustar configurações</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Google Calendar</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {(['connect', 'configure', 'done'] as SyncStep[]).map((s, i) => (
          <View key={s} style={[styles.progressDot,
            step === s && styles.progressDotActive,
            step === 'configure' && i === 0 ? styles.progressDotDone : null,
          ]} />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {step === 'connect' && (
          <View style={styles.connectContent}>
            {/* Google logo simulado */}
            <View style={styles.googleCard}>
              <Text style={styles.googleLogo}>G</Text>
              <View>
                <Text style={styles.googleTitle}>Google Calendar</Text>
                <Text style={styles.googleSub}>Conecte sua conta Google</Text>
              </View>
            </View>

            <Text style={styles.connectDesc}>
              A Aura vai usar seu Google Calendar para sincronizar sua agenda com suas fases do ciclo e blocos de energia ideais.
            </Text>

            {/* Permissões que serão solicitadas */}
            <View style={styles.permissionsCard}>
              <Text style={styles.permissionsTitle}>🔐 Permissões necessárias</Text>
              {[
                { icon: '📖', txt: 'Ler eventos do calendário' },
                { icon: '✏️', txt: 'Criar e editar eventos da Aura' },
                { icon: '🔔', txt: 'Gerenciar lembretes e notificações' },
              ].map((p, i) => (
                <View key={i} style={styles.permRow}>
                  <Text style={styles.permIcon}>{p.icon}</Text>
                  <Text style={styles.permTxt}>{p.txt}</Text>
                </View>
              ))}
            </View>

            <View style={styles.privacyNote}>
              <Text style={styles.privacyTxt}>
                🔒 Seus dados ficam no seu dispositivo. A Aura nunca compartilha informações do seu calendário com terceiros.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: GOOGLE_BLUE }, connecting && styles.btnLoading]}
              onPress={handleConnect}
              disabled={connecting}
            >
              <Text style={styles.btnTxt}>
                {connecting ? 'Conectando...' : '  Conectar com Google'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnGhost} onPress={() => navigation.navigate('MainTabs')}>
              <Text style={styles.btnGhostTxt}>Pular por enquanto</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'configure' && (
          <View style={styles.configContent}>
            <Text style={styles.configTitle}>Configure a sincronização</Text>
            <Text style={styles.configSub}>Escolha o que a Aura pode ver e criar no seu calendar.</Text>

            {/* Selecionar calendário */}
            <Text style={styles.sectionLabel}>Calendário principal</Text>
            {MOCK_CALENDARS.map(cal => (
              <TouchableOpacity
                key={cal.id}
                style={[styles.calendarRow, selectedCalendar === cal.id && styles.calendarRowSelected]}
                onPress={() => setSelectedCalendar(cal.id)}
              >
                <View style={[styles.calDot, { backgroundColor: cal.color }]} />
                <Text style={styles.calName}>{cal.name}</Text>
                {selectedCalendar === cal.id && (
                  <Text style={{ color: NECTARINE, fontWeight: '800' }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            {/* Opções de sync */}
            <Text style={[styles.sectionLabel, { marginTop: appSpacing.lg }]}>O que sincronizar</Text>
            {syncOptions.map(opt => (
              <View key={opt.id} style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionDesc}>{opt.desc}</Text>
                </View>
                <Switch
                  value={opt.enabled}
                  onValueChange={() => toggleOption(opt.id)}
                  trackColor={{ false: appColors.borderSubtle, true: 'rgba(215,137,127,.4)' }}
                  thumbColor={opt.enabled ? NECTARINE : '#fff'}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      {step === 'configure' && (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: NECTARINE }]} onPress={handleSave}>
            <Text style={styles.btnTxt}>Salvar configurações →</Text>
          </TouchableOpacity>
        </View>
      )}
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
  backTxt: { fontSize: 14, color: NECTARINE, fontWeight: '600' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: appColors.textPrimary },
  progressRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingBottom: appSpacing.md },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(215,137,127,.2)' },
  progressDotActive: { backgroundColor: NECTARINE, width: 20, borderRadius: 4 },
  progressDotDone: { backgroundColor: '#96C7B3' },
  connectContent: { paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.md },
  googleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: appRadius.lg, padding: appSpacing.lg,
    marginBottom: appSpacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  googleLogo: { fontSize: 32, fontWeight: '900', color: GOOGLE_BLUE },
  googleTitle: { fontSize: 16, fontWeight: '800', color: appColors.textPrimary },
  googleSub: { fontSize: 12, color: appColors.textSecondary },
  connectDesc: { fontSize: 14, color: appColors.textSecondary, lineHeight: 22, marginBottom: appSpacing.lg },
  permissionsCard: {
    backgroundColor: '#fff', borderRadius: appRadius.lg, padding: appSpacing.lg,
    marginBottom: appSpacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  permissionsTitle: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary, marginBottom: appSpacing.md },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  permIcon: { fontSize: 16 },
  permTxt: { fontSize: 13, color: appColors.textSecondary },
  privacyNote: {
    backgroundColor: 'rgba(150,199,179,.1)', borderRadius: appRadius.md,
    borderLeftWidth: 3, borderLeftColor: '#96C7B3',
    padding: appSpacing.md, marginBottom: appSpacing.lg,
  },
  privacyTxt: { fontSize: 12, color: appColors.textSecondary, lineHeight: 18 },
  btn: {
    height: 52, borderRadius: appRadius.pill, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  btnLoading: { opacity: 0.7 },
  btnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  btnGhost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  btnGhostTxt: { fontSize: 14, color: appColors.textSecondary, fontWeight: '600' },
  configContent: { paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.md },
  configTitle: { fontSize: 20, fontWeight: '800', color: appColors.textPrimary, marginBottom: 6 },
  configSub: { fontSize: 13, color: appColors.textSecondary, lineHeight: 20, marginBottom: appSpacing.lg },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: appColors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  calendarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: appRadius.md, padding: appSpacing.lg,
    marginBottom: 8, borderWidth: 1.5, borderColor: appColors.borderSubtle,
  },
  calendarRowSelected: { borderColor: NECTARINE },
  calDot: { width: 12, height: 12, borderRadius: 6 },
  calName: { flex: 1, fontSize: 14, fontWeight: '600', color: appColors.textPrimary },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: appRadius.md, padding: appSpacing.lg,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  optionLabel: { fontSize: 14, fontWeight: '600', color: appColors.textPrimary, marginBottom: 2 },
  optionDesc: { fontSize: 12, color: appColors.textSecondary },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FAF6F2', padding: appSpacing.lg,
    borderTopWidth: 1, borderTopColor: 'rgba(215,137,127,.15)',
  },
  doneContent: { flex: 1, alignItems: 'center', paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.xl * 2 },
  doneIcon: {
    width: 96, height: 96, borderRadius: 32,
    backgroundColor: 'rgba(215,137,127,.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: appSpacing.xl,
  },
  doneTitle: { fontSize: 24, fontWeight: '800', color: appColors.textPrimary, textAlign: 'center', marginBottom: 8 },
  doneSub: { fontSize: 14, color: appColors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: appSpacing.xl },
  doneSummary: {
    width: '100%', backgroundColor: '#fff', borderRadius: appRadius.lg,
    padding: appSpacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  doneSummaryTitle: { fontSize: 13, fontWeight: '700', color: appColors.textPrimary, marginBottom: appSpacing.md },
  doneSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  doneDot: { width: 6, height: 6, borderRadius: 3 },
  doneSummaryTxt: { fontSize: 13, color: appColors.textPrimary },
});

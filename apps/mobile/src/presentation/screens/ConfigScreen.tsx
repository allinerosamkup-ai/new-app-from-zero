import React, { useEffect, useState } from 'react';
import {
  View,
  SafeAreaView,
  Alert,
  ScrollView
} from 'react-native';
import { 
  List, 
  Avatar, 
  Surface, 
  Text, 
  Divider, 
  Button, 
  MD3Colors
} from 'react-native-paper';
import { useAuthStore } from '../providers/auth_store';
import { supabase } from '../../lib/supabase';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

/**
 * ConfigScreen: Configurações de conta e acesso com UI do Paper.
 */
export default function ConfigScreen() {
  const { fullName, signOut, isLoading } = useAuthStore();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then((result: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      setEmail(result.data.user?.email ?? null);
    });
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      <ScrollView contentContainerStyle={{ padding: appSpacing.lg }}>
        <Text variant="headlineMedium" style={{ fontWeight: '700', marginBottom: appSpacing.xl, color: appColors.textPrimary }}>
          Configurações
        </Text>

        {/* Perfil */}
        <Surface 
          style={{ 
            padding: appSpacing.lg, 
            borderRadius: appRadius.lg, 
            backgroundColor: appColors.surface,
            marginBottom: appSpacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 1
          }}
        >
          <Avatar.Icon 
            size={56} 
            icon="account" 
            style={{ backgroundColor: appColors.primarySoft }} 
            color={appColors.primary} 
          />
          <View style={{ flex: 1, marginLeft: appSpacing.md }}>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              {fullName ?? 'Usuária'}
            </Text>
            <Text variant="bodySmall" style={{ color: appColors.textSecondary }}>
              {email ?? 'carregando...'}
            </Text>
          </View>
        </Surface>

        {/* Opções de Menu */}
        <Surface 
          style={{ 
            borderRadius: appRadius.lg, 
            backgroundColor: appColors.surface,
            overflow: 'hidden',
            elevation: 1,
            marginBottom: appSpacing.lg
          }}
        >
          <List.Item
            title="Privacidade e dados"
            left={props => <List.Icon {...props} icon="shield-check-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('Em breve', 'Configurações de privacidade serão adicionadas.')}
          />
          <Divider />
          <List.Item
            title="Notificações"
            left={props => <List.Icon {...props} icon="bell-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
          />
          <Divider />
          <List.Item
            title="Tema do Aplicativo"
            description="Sistema"
            left={props => <List.Icon {...props} icon="palette-outline" />}
            onPress={() => {}}
          />
        </Surface>

        {/* Sair */}
        <Button
          mode="contained-tonal"
          icon="logout"
          onPress={handleSignOut}
          loading={isLoading}
          disabled={isLoading}
          textColor={MD3Colors.error50}
          style={{ borderRadius: appRadius.md }}
          contentStyle={{ paddingVertical: 6 }}
        >
          Sair da conta
        </Button>

        {/* Versão */}
        <Text variant="labelSmall" style={{ textAlign: 'center', color: appColors.textSecondary, marginTop: appSpacing.xl * 2 }}>
          Mood & Energy — MVP v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

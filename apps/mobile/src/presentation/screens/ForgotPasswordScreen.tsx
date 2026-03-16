import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  View,
} from 'react-native';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type Stage = 'idle' | 'loading' | 'success' | 'error';

/**
 * ForgotPasswordScreen
 * Envia um email de redefinição de senha via Supabase Auth.
 */
export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;

    setStage('loading');
    setErrorMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);

      if (error) {
        throw error;
      }

      setStage('success');
    } catch (err: any) {
      setErrorMessage(err.message ?? 'Não foi possível enviar o email. Tente novamente.');
      setStage('error');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, padding: appSpacing.lg }}
      >
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View>
            {/* Header card */}
            <Surface
              style={{
                backgroundColor: '#1f3b32',
                padding: appSpacing.xl,
                borderRadius: appRadius.lg * 1.5,
                marginBottom: appSpacing.xl,
                elevation: 4,
              }}
            >
              <Text variant="labelSmall" style={{ color: '#f7efe1', letterSpacing: 3, textTransform: 'uppercase' }}>
                MOOD & ENERGY
              </Text>
              <Text variant="headlineMedium" style={{ color: '#fff7eb', fontWeight: '800', marginTop: appSpacing.md }}>
                Vamos recuperar o seu acesso.
              </Text>
              <Text variant="bodyMedium" style={{ color: '#d8e5dc', marginTop: appSpacing.md, lineHeight: 22 }}>
                Informe seu email e enviaremos um link para criar uma nova senha.
              </Text>
            </Surface>

            {/* Email field — hidden after success */}
            {stage !== 'success' && (
              <TextInput
                label="Email"
                mode="outlined"
                value={email}
                onChangeText={setEmail}
                placeholder="voce@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                left={<TextInput.Icon icon="email-outline" />}
                disabled={stage === 'loading'}
              />
            )}

            {/* Success feedback */}
            {stage === 'success' && (
              <Surface
                style={{
                  padding: appSpacing.lg,
                  borderRadius: appRadius.md,
                  backgroundColor: '#e8f3eb',
                  borderWidth: 1,
                  borderColor: '#9ad7b4',
                }}
              >
                <Text variant="titleMedium" style={{ color: '#1f6b47', fontWeight: '700' }}>
                  Email enviado! ✉️
                </Text>
                <Text variant="bodyMedium" style={{ color: '#1f6b47', marginTop: 8, lineHeight: 22 }}>
                  Verifique sua caixa de entrada e clique no link para criar uma nova senha.
                </Text>
              </Surface>
            )}

            {/* Error feedback */}
            {stage === 'error' && (
              <HelperText type="error" visible style={{ fontSize: 14 }}>
                {errorMessage}
              </HelperText>
            )}
          </View>

          {/* Actions */}
          <View style={{ gap: appSpacing.sm, paddingBottom: appSpacing.md }}>
            {stage !== 'success' && (
              <Button
                mode="contained"
                onPress={handleReset}
                loading={stage === 'loading'}
                disabled={stage === 'loading' || !email.trim()}
                contentStyle={{ paddingVertical: 10 }}
                style={{ borderRadius: appRadius.pill }}
                labelStyle={{ fontSize: 16, fontWeight: '700' }}
              >
                Enviar link de redefinição
              </Button>
            )}

            <Button
              mode="text"
              onPress={() => navigation.goBack()}
              labelStyle={{ color: '#1f3b32', fontWeight: '600' }}
            >
              ← Voltar para o login
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

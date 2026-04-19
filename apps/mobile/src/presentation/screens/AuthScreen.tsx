import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  View,
  ScrollView,
} from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  Surface, 
  SegmentedButtons,
  HelperText,
  MD3Colors
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../providers/auth_store';
import { appColors, appRadius, appSpacing } from '../theme/appTheme';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const navigation = useNavigation<any>();
  const { signIn, signInWithGoogle, signUp, isLoading, error, infoMessage, clearMessages } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (value: string) => {
    clearMessages();
    setMode(value as AuthMode);
  };

  const handleSubmit = async () => {
    clearMessages();
    if (mode === 'signin') {
      await signIn(email, password);
    } else {
      await signUp({ fullName, email, password });
    }
  };

  const handleGoogleLogin = async () => {
    clearMessages();
    await signInWithGoogle();
  };

  const isSignup = mode === 'signup';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: appSpacing.lg }}>
          <Surface 
            style={{ 
              backgroundColor: '#1f3b32', 
              padding: appSpacing.xl, 
              borderRadius: appRadius.lg * 1.5,
              marginBottom: appSpacing.xl,
              elevation: 4
            }}
          >
            <Text variant="labelSmall" style={{ color: '#f7efe1', letterSpacing: 3, textTransform: 'uppercase' }}>
              MOOD & ENERGY
            </Text>
            <Text variant="headlineMedium" style={{ color: '#fff7eb', fontWeight: '800', marginTop: appSpacing.md }}>
              Seu ritmo merece um ponto de partida mais gentil.
            </Text>
            <Text variant="bodyMedium" style={{ color: '#d8e5dc', marginTop: appSpacing.md, lineHeight: 22 }}>
              Entre para acompanhar humor, energia e rotina em um fluxo que respeita o seu estado real.
            </Text>
          </Surface>

          <SegmentedButtons
            value={mode}
            onValueChange={switchMode}
            buttons={[
              { value: 'signin', label: 'Entrar' },
              { value: 'signup', label: 'Criar conta' },
            ]}
            style={{ marginBottom: appSpacing.xl }}
          />

          <View style={{ gap: appSpacing.md }}>
            {isSignup && (
              <TextInput
                label="Seu nome"
                mode="outlined"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Como você quer ser chamada?"
                left={<TextInput.Icon icon="account-outline" />}
              />
            )}

            <TextInput
              label="Email"
              mode="outlined"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@exemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              left={<TextInput.Icon icon="email-outline" />}
            />

            <TextInput
              label="Senha"
              mode="outlined"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Sua senha"
              left={<TextInput.Icon icon="lock-outline" />}
              right={
                <TextInput.Icon 
                  icon={showPassword ? "eye-off" : "eye"} 
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
          </View>

          {error && (
            <HelperText type="error" visible={!!error} style={{ marginTop: 8 }}>
              {error}
            </HelperText>
          )}

          {infoMessage && (
            <Surface 
              style={{ 
                marginTop: 16, 
                padding: 12, 
                borderRadius: 8, 
                backgroundColor: MD3Colors.primary95,
                borderWidth: 1,
                borderColor: MD3Colors.primary80
              }}
            >
              <Text style={{ color: MD3Colors.primary20 }}>{infoMessage}</Text>
            </Surface>
          )}

          <View style={{ flex: 1, justifyContent: 'flex-end', marginTop: appSpacing.xl }}>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              contentStyle={{ paddingVertical: 10 }}
              style={{ borderRadius: appRadius.pill }}
              labelStyle={{ fontSize: 16, fontWeight: '700' }}
            >
              {isSignup ? 'Criar conta e continuar' : 'Entrar e continuar'}
            </Button>

            <Button
              mode="outlined"
              onPress={handleGoogleLogin}
              disabled={isLoading}
              contentStyle={{ paddingVertical: 10 }}
              style={{ borderRadius: appRadius.pill, marginTop: appSpacing.md }}
              labelStyle={{ fontSize: 15, fontWeight: '700', color: appColors.textPrimary }}
            >
              Entrar com Google
            </Button>

            <Text
              variant="bodySmall"
              style={{
                textAlign: 'center',
                color: appColors.textSecondary,
                marginTop: appSpacing.md
              }}
            >
              {isSignup
                ? 'Ao continuar, você cria sua conta e segue para o onboarding.'
                : 'Depois do login, seguimos direto para a configuração inicial do app.'}
            </Text>

            {!isSignup && (
              <Button
                mode="text"
                onPress={() => navigation.navigate('ForgotPassword')}
                labelStyle={{ color: '#1f3b32', fontSize: 13 }}
                style={{ marginTop: appSpacing.xs }}
              >
                Esqueceu sua senha?
              </Button>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

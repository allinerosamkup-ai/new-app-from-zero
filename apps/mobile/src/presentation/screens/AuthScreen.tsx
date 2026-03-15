import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuthStore } from '../providers/auth_store';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { signIn, signUp, isLoading, error, infoMessage, clearMessages } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const switchMode = (nextMode: AuthMode) => {
    clearMessages();
    setMode(nextMode);
  };

  const handleSubmit = async () => {
    clearMessages();

    if (mode === 'signin') {
      await signIn(email, password);
      return;
    }

    await signUp({
      fullName,
      email,
      password,
    });
  };

  const isSignup = mode === 'signup';

  return (
    <SafeAreaView className="flex-1 bg-[#f6f3ed]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 px-6 py-8"
      >
        <View className="flex-1 justify-between">
          <View>
            <View className="rounded-[32px] bg-[#1f3b32] px-6 py-8">
              <Text className="text-[#f7efe1] text-xs uppercase tracking-[3px]">Mood Energy</Text>
              <Text className="mt-3 text-[#fff7eb] text-3xl font-bold">
                Seu ritmo merece um ponto de partida mais gentil.
              </Text>
              <Text className="mt-3 text-[#d8e5dc] text-base leading-6">
                Entre para acompanhar humor, energia e rotina em um fluxo que respeita o seu estado real.
              </Text>
            </View>

            <View className="mt-6 flex-row rounded-2xl bg-white p-1">
              <ToggleButton
                label="Entrar"
                active={mode === 'signin'}
                onPress={() => switchMode('signin')}
              />
              <ToggleButton
                label="Criar conta"
                active={mode === 'signup'}
                onPress={() => switchMode('signup')}
              />
            </View>

            <View className="mt-6 space-y-4">
              {isSignup && (
                <InputField
                  label="Seu nome"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Como você quer ser chamada?"
                />
              )}

              <InputField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="voce@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <InputField
                label="Senha"
                value={password}
                onChangeText={setPassword}
                placeholder="Sua senha"
                secureTextEntry
              />
            </View>

            {error && (
              <Text className="mt-4 rounded-2xl bg-[#ffe7e4] px-4 py-3 text-[#9d2c2c]">
                {error}
              </Text>
            )}

            {infoMessage && (
              <Text className="mt-4 rounded-2xl bg-[#e8f3eb] px-4 py-3 text-[#1f6b47]">
                {infoMessage}
              </Text>
            )}
          </View>

          <View className="pb-4">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className={`rounded-[28px] px-6 py-5 ${
                isLoading ? 'bg-[#7f978e]' : 'bg-[#1f3b32]'
              }`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center text-lg font-bold text-white">
                  {isSignup ? 'Criar conta e continuar' : 'Entrar e continuar'}
                </Text>
              )}
            </TouchableOpacity>

            <Text className="mt-4 text-center text-sm text-[#6f6a62]">
              {isSignup
                ? 'Ao continuar, você cria sua conta e segue para o onboarding.'
                : 'Depois do login, seguimos direto para a configuração inicial do app.'}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 rounded-2xl px-4 py-3 ${active ? 'bg-[#1f3b32]' : 'bg-transparent'}`}
    >
      <Text className={`text-center font-semibold ${active ? 'text-white' : 'text-[#4d4a45]'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View>
      <Text className="mb-2 text-xs font-bold uppercase tracking-[2px] text-[#7b756c]">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        className="rounded-2xl bg-white px-4 py-4 text-base text-[#1f1b16]"
        placeholderTextColor="#9b9489"
      />
    </View>
  );
}

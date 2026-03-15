import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LucideUser, LucideLogOut, LucideShield, LucideChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../providers/auth_store';
import { supabase } from '../../lib/supabase';

/**
 * ConfigScreen: Configurações de conta e acesso.
 */
export default function ConfigScreen() {
  const { fullName, signOut, isLoading } = useAuthStore();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
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
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="p-6">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Configurações</Text>

        {/* Perfil */}
        <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <View className="flex-row items-center">
            <View className="w-14 h-14 bg-blue-100 rounded-full items-center justify-center mr-4">
              <LucideUser size={26} color="#0284C7" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-gray-900">
                {fullName ?? 'Usuária'}
              </Text>
              {email ? (
                <Text className="text-sm text-gray-500 mt-0.5">{email}</Text>
              ) : (
                <View className="h-4 w-32 bg-gray-100 rounded mt-1" />
              )}
            </View>
          </View>
        </View>

        {/* Opções */}
        <View className="bg-white rounded-2xl mb-4 overflow-hidden">
          <TouchableOpacity
            className="flex-row items-center px-5 py-4 border-b border-gray-100"
            onPress={() => Alert.alert('Em breve', 'Configurações de privacidade serão adicionadas em breve.')}
          >
            <LucideShield size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base text-gray-700">Privacidade e dados</Text>
            <LucideChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Sair */}
        <TouchableOpacity
          onPress={handleSignOut}
          disabled={isLoading}
          className="bg-white rounded-2xl px-5 py-4 flex-row items-center"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#EF4444" style={{ marginRight: 12 }} />
          ) : (
            <LucideLogOut size={20} color="#EF4444" />
          )}
          <Text className="ml-3 text-base font-semibold text-red-500">Sair da conta</Text>
        </TouchableOpacity>

        {/* Versão */}
        <Text className="text-center text-xs text-gray-400 mt-8">
          Mood & Energy — MVP v1.0
        </Text>
      </View>
    </SafeAreaView>
  );
}

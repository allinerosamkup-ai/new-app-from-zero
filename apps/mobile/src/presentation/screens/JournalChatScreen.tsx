import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useJournalStore } from '../providers/journal_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideSend, LucideMic, LucideArrowLeft } from 'lucide-react-native';

/**
 * JournalChatScreen: Tela de chat de diário com IA.
 * Tradução do Flutter para React Native (Expo).
 */
export default function JournalChatScreen() {
  const {
    sessionId,
    messages,
    isLoading,
    isStreaming,
    context,
    startSession,
    sendMessage,
    finalizeSession,
    error,
  } = useJournalStore();
  const { userId } = useAuthStore();
  const navigation = useNavigation<any>();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!sessionId && userId) {
      void startSession(userId);
    }
  }, [sessionId, startSession, userId]);

  // Efeito para rolar para o final do chat quando novas mensagens chegarem
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isLoading, isStreaming]);

  const handleSend = () => {
    if (inputText.trim() === '' || !sessionId || isStreaming || !userId) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleEndSession = () => {
    Alert.alert(
      'Encerrar sessão?',
      'Vamos gerar um resumo da nossa conversa para que você possa revisar depois.',
      [
        { text: 'Continuar conversando', style: 'cancel' },
        {
          text: 'Encerrar e ver resumo',
          style: 'default',
          onPress: async () => {
            const result = await finalizeSession();
            if (result) {
              navigation.navigate('DailySummary', { summary: result.summary });
            }
          },
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Custom Header (AppBar) */}
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
        <TouchableOpacity className="p-2">
          <LucideArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Diário com IA</Text>
        <TouchableOpacity onPress={handleEndSession}>
          <Text className="text-blue-600 font-semibold">Encerrar</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages List */}
        <ScrollView 
          ref={scrollRef}
          className="flex-1 p-4"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {messages.length === 0 && context && (
            <View className="mb-4 bg-white border border-gray-200 rounded-3xl p-4">
              <Text className="text-sm font-semibold text-gray-700 mb-1">Boas-vindas</Text>
              <Text className="text-gray-600">
                {context.checkinToday?.stateLabel
                  ? `Estou vendo que hoje parece um ${context.checkinToday.stateLabel.toLowerCase()}. `
                  : ''}
                {context.promptSummary}
              </Text>
            </View>
          )}

          {messages.map((msg) => (
            <ChatBubble 
              key={msg.id} 
              content={msg.content} 
              isUser={msg.role === 'user'} 
            />
          ))}

          {/* Typing Indicator */}
          {(isLoading || isStreaming) && (
            <View className="flex-row items-center p-2">
              <ActivityIndicator size="small" color="#9CA3AF" />
              <Text className="text-gray-400 ml-2 italic">
                {userId ? (sessionId ? 'IA está respondendo...' : 'Iniciando sessão...') : 'Sessão indisponível sem login'}
              </Text>
            </View>
          )}

          {error && (
            <Text className="text-red-500 text-center mt-4">{error}</Text>
          )}
        </ScrollView>

        {/* Input Area */}
        <View className="p-4 bg-white border-t border-gray-200 shadow-sm flex-row items-center">
          <TouchableOpacity className="p-2 mr-2">
            <LucideMic size={24} color="#9CA3AF" />
          </TouchableOpacity>

          <View className="flex-1 bg-gray-100 rounded-2xl px-4 py-2">
            <TextInput
              className="text-gray-800 text-base"
              placeholder="Conta o que está acontecendo hoje..."
              multiline
              value={inputText}
              onChangeText={setInputText}
              editable={!!userId}
            />
          </View>

          <TouchableOpacity 
            onPress={handleSend}
            disabled={inputText.trim() === '' || !sessionId || isStreaming || !userId}
            className={`p-3 ml-2 rounded-full ${
              inputText.trim() === '' || !sessionId || isStreaming || !userId ? 'bg-gray-200' : 'bg-blue-600'
            }`}
          >
            <LucideSend size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * ChatBubble: Balão de mensagem traduzido do Flutter.
 */
function ChatBubble({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <View className={`flex-row mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <View 
        className={`max-w-[80%] p-4 rounded-3xl ${
          isUser 
            ? 'bg-blue-600 rounded-tr-sm' 
            : 'bg-gray-200 rounded-tl-sm'
        }`}
      >
        <Text className={`text-base ${isUser ? 'text-white' : 'text-gray-800'}`}>
          {content}
        </Text>
      </View>
    </View>
  );
}

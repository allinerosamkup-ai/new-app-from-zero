import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useJournalStore } from '../providers/journal_store';
import { useAuthStore } from '../providers/auth_store';
import { LucideSend, LucideMic, LucideArrowLeft } from 'lucide-react-native';
import { appColors, appRadius, appSpacing, appTypography } from '../theme/appTheme';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      {/* Custom Header (AppBar) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: appSpacing.lg,
          paddingVertical: appSpacing.md,
          borderBottomWidth: 0,
        }}
      >
        <TouchableOpacity style={{ padding: appSpacing.sm }} onPress={() => navigation.goBack()}>
          <LucideArrowLeft size={24} color={appColors.textSecondary} />
        </TouchableOpacity>
        <Text
          style={{
            ...appTypography.subtitle,
            color: appColors.textPrimary,
          }}
        >
          Diário com IA
        </Text>
        <TouchableOpacity onPress={handleEndSession}>
          <Text
            style={{
              color: appColors.primary,
              fontWeight: '600',
            }}
          >
            Encerrar
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages List */}
        <ScrollView 
          ref={scrollRef}
          style={{ flex: 1, paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.md }}
          contentContainerStyle={{ paddingBottom: appSpacing.xl * 2 }}
        >
          {messages.length === 0 && context && (
            <View
              style={{
                marginBottom: appSpacing.md,
                backgroundColor: appColors.surface,
                borderRadius: appRadius.lg,
                padding: appSpacing.md,
                borderWidth: 1,
                borderColor: appColors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: appColors.textPrimary,
                  marginBottom: 4,
                }}
              >
                Boas-vindas
              </Text>
              <Text
                style={{
                  color: appColors.textSecondary,
                  fontSize: 13,
                  lineHeight: 20,
                }}
              >
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: appSpacing.sm,
              }}
            >
              <ActivityIndicator size="small" color={appColors.textSecondary} />
              <Text
                style={{
                  color: appColors.textSecondary,
                  marginLeft: appSpacing.sm,
                  fontStyle: 'italic',
                  fontSize: 12,
                }}
              >
                {userId ? (sessionId ? 'IA está respondendo...' : 'Iniciando sessão...') : 'Sessão indisponível sem login'}
              </Text>
            </View>
          )}

          {error && (
            <Text
              style={{
                color: appColors.danger,
                textAlign: 'center',
                marginTop: appSpacing.md,
              }}
            >
              {error}
            </Text>
          )}
        </ScrollView>

        {/* Input Area */}
        <View
          style={{
            paddingHorizontal: appSpacing.lg,
            paddingVertical: appSpacing.md,
            backgroundColor: appColors.surfaceAlt,
            borderTopWidth: 1,
            borderColor: appColors.borderSubtle,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity style={{ padding: appSpacing.sm, marginRight: appSpacing.sm }}>
            <LucideMic size={24} color={appColors.textSecondary} />
          </TouchableOpacity>

          <View
            style={{
              flex: 1,
              backgroundColor: appColors.surface,
              borderRadius: appRadius.lg,
              paddingHorizontal: appSpacing.md,
              paddingVertical: appSpacing.sm,
            }}
          >
            <TextInput
              style={{
                color: appColors.textPrimary,
                fontSize: 15,
              }}
              placeholder="Conta o que está acontecendo hoje..."
              placeholderTextColor={appColors.textSecondary}
              multiline
              value={inputText}
              onChangeText={setInputText}
              editable={!!userId}
            />
          </View>

          <TouchableOpacity 
            onPress={handleSend}
            disabled={inputText.trim() === '' || !sessionId || isStreaming || !userId}
            style={{
              padding: appSpacing.sm,
              marginLeft: appSpacing.sm,
              borderRadius: appRadius.pill,
              backgroundColor:
                inputText.trim() === '' || !sessionId || isStreaming || !userId
                  ? appColors.borderSubtle
                  : appColors.primary,
            }}
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
    <View
      style={{
        flexDirection: 'row',
        marginBottom: appSpacing.sm,
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <View
        style={{
          maxWidth: '80%',
          padding: appSpacing.md,
          borderRadius: 24,
          borderTopRightRadius: isUser ? appRadius.sm : 24,
          borderTopLeftRadius: isUser ? 24 : appRadius.sm,
          backgroundColor: isUser ? appColors.primary : appColors.surface,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            color: isUser ? '#0b1120' : appColors.textPrimary,
          }}
        >
          {content}
        </Text>
      </View>
    </View>
  );
}

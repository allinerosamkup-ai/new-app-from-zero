import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, SafeAreaView } from 'react-native';
import { 
  Appbar, 
  Text, 
  TextInput, 
  IconButton, 
  ActivityIndicator, 
  Surface,
  Card,
  MD3Colors,
  Button
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useJournalStore } from '../providers/journal_store';
import { useAuthStore } from '../providers/auth_store';
import { appColors, appSpacing } from '../theme/appTheme';

/**
 * JournalChatScreen: Tela de chat de diário com IA e UI do Paper.
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
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: 'transparent' }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Diário com IA" titleStyle={{ fontWeight: '700' }} />
        <Button mode="text" onPress={handleEndSession} textColor={appColors.primary}>
          Encerrar
        </Button>
      </Appbar.Header>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.md, paddingBottom: 40 }}
        >
          {messages.length === 0 && context && (
            <Card style={{ marginBottom: appSpacing.md, backgroundColor: appColors.surface, borderStyle: 'dashed' }} mode="outlined">
              <Card.Content>
                <Text variant="labelSmall" style={{ letterSpacing: 2, color: appColors.primary, marginBottom: 12, opacity: 0.7 }}>
                  AURA • PRESENÇA
                </Text>
                <Text variant="bodyLarge" style={{ color: appColors.textPrimary, lineHeight: 26, fontStyle: 'italic' }}>
                  {context.promptSummary}
                </Text>
              </Card.Content>
            </Card>
          )}

          {messages.map((msg) => (
            <ChatBubble 
              key={msg.id} 
              content={msg.content} 
              isUser={msg.role === 'user'} 
            />
          ))}

          {(isLoading || isStreaming) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: appSpacing.sm }}>
              <ActivityIndicator animating size="small" color={appColors.textSecondary} />
              <Text variant="bodySmall" style={{ color: appColors.textSecondary, marginLeft: appSpacing.sm, fontStyle: 'italic' }}>
                {userId ? (sessionId ? 'IA está respondendo...' : 'Iniciando sessão...') : 'Sessão indisponível sem login'}
              </Text>
            </View>
          )}

          {error && (
            <Text variant="bodySmall" style={{ color: appColors.danger, textAlign: 'center', marginTop: appSpacing.md }}>
              {error}
            </Text>
          )}
        </ScrollView>

        {/* Input Area */}
        <Surface style={{ padding: appSpacing.md, backgroundColor: appColors.surface, elevation: 4 }} mode="flat">
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <IconButton icon="microphone" size={24} iconColor={appColors.textSecondary} onPress={() => {}} />
            
            <TextInput
              mode="flat"
              placeholder="Conta o que está acontecendo hoje..."
              multiline
              value={inputText}
              onChangeText={setInputText}
              editable={!!userId}
              style={{ flex: 1, backgroundColor: 'transparent', maxHeight: 120 }}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
            />

            <IconButton 
              icon="send" 
              mode="contained"
              containerColor={inputText.trim() === '' || !sessionId || isStreaming || !userId ? MD3Colors.neutralVariant90 : appColors.primary}
              iconColor="white"
              disabled={inputText.trim() === '' || !sessionId || isStreaming || !userId}
              onPress={handleSend}
              size={24}
            />
          </View>
        </Surface>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChatBubble({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: appSpacing.md, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <Surface
        style={{
          maxWidth: '85%',
          padding: appSpacing.md,
          borderRadius: 20,
          borderBottomRightRadius: isUser ? 4 : 20,
          borderBottomLeftRadius: isUser ? 20 : 4,
          backgroundColor: isUser ? appColors.primary : appColors.surface,
          elevation: 1
        }}
      >
        <Text variant="bodyLarge" style={{ color: isUser ? '#0b1120' : appColors.textPrimary }}>
          {content}
        </Text>
      </Surface>
    </View>
  );
}

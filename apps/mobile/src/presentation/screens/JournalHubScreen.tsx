import React, { useCallback, useEffect } from 'react';
import { FlatList, SafeAreaView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  FAB,
  Surface,
  Text,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../providers/auth_store';
import { useJournalStore, JournalSessionItem } from '../providers/journal_store';
import { appColors, appRadius, appSpacing, appTypography } from '../theme/appTheme';

/**
 * JournalHubScreen
 * Hub do diário: mostra histórico de sessões e botão para nova sessão.
 * Substitui JournalChatScreen como tela da aba "Diário".
 */
export default function JournalHubScreen() {
  const navigation = useNavigation<any>();
  const { userId } = useAuthStore();
  const { sessions, isLoadingSessions, loadSessions } = useJournalStore();

  const load = useCallback(() => {
    if (userId) loadSessions(userId);
  }, [userId, loadSessions]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNewSession = () => {
    navigation.navigate('JournalChat');
  };

  const handleOpenSession = (item: JournalSessionItem) => {
    if (item.status === 'active') {
      // Sessão ainda ativa — continuar o chat
      navigation.navigate('JournalChat');
    } else if (item.summary) {
      // Sessão concluída — ver resumo
      navigation.navigate('DailySummary', {
        summary: {
          text: item.summary,
          emotions: item.emotions,
          themes: item.themes,
          suggestions: [],
        },
      });
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const renderItem = ({ item }: { item: JournalSessionItem }) => (
    <Surface
      style={{
        marginHorizontal: appSpacing.lg,
        marginBottom: appSpacing.md,
        borderRadius: appRadius.lg,
        padding: appSpacing.lg,
        elevation: 1,
      }}
    >
      {/* Date + status */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: appSpacing.sm }}>
        <Text variant="titleSmall" style={{ fontWeight: '700', color: appColors.textPrimary }}>
          {formatDate(item.startedAt)}
        </Text>
        <Chip
          compact
          mode="flat"
          style={{
            backgroundColor: item.status === 'active' ? '#e8f3eb' : appColors.primarySoft,
          }}
          textStyle={{
            fontSize: 11,
            color: item.status === 'active' ? '#1f6b47' : appColors.primary,
          }}
        >
          {item.status === 'active' ? '● Em andamento' : '✓ Concluída'}
        </Chip>
      </View>

      {/* Summary excerpt */}
      {item.summary ? (
        <Text
          variant="bodySmall"
          style={{ color: appColors.textSecondary, lineHeight: 20, marginBottom: appSpacing.sm }}
          numberOfLines={2}
        >
          {item.summary}
        </Text>
      ) : (
        <Text variant="bodySmall" style={{ color: appColors.textSecondary, fontStyle: 'italic' }}>
          Sessão sem resumo
        </Text>
      )}

      {/* Emotion chips */}
      {item.emotions.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: appSpacing.sm }}>
          {item.emotions.slice(0, 4).map((e, i) => (
            <Chip
              key={i}
              compact
              mode="outlined"
              style={{ backgroundColor: 'transparent' }}
              textStyle={{ fontSize: 11, color: appColors.textSecondary }}
            >
              {e}
            </Chip>
          ))}
        </View>
      )}

      {/* Action */}
      <Button
        mode="text"
        compact
        onPress={() => handleOpenSession(item)}
        labelStyle={{ color: appColors.primary, fontSize: 13 }}
        style={{ alignSelf: 'flex-end', marginTop: appSpacing.xs }}
      >
        {item.status === 'active' ? 'Continuar →' : 'Ver resumo →'}
      </Button>
    </Surface>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: appSpacing.lg, paddingTop: appSpacing.xl, paddingBottom: appSpacing.md }}>
        <Text variant="labelSmall" style={{ color: appColors.textSecondary, letterSpacing: 2, textTransform: 'uppercase' }}>
          Diário
        </Text>
        <Text style={{ ...appTypography.title, fontSize: 28, color: appColors.textPrimary, marginTop: 4 }}>
          Suas reflexões
        </Text>
      </View>

      <Divider style={{ marginBottom: appSpacing.md }} />

      {/* Loading */}
      {isLoadingSessions && sessions.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator animating size="large" color={appColors.primary} />
        </View>
      ) : sessions.length === 0 ? (
        /* Empty state */
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: appSpacing.xl }}>
          <Text style={{ fontSize: 40, marginBottom: appSpacing.md }}>📓</Text>
          <Text variant="titleMedium" style={{ fontWeight: '700', color: appColors.textPrimary, textAlign: 'center' }}>
            Nenhuma sessão ainda
          </Text>
          <Text variant="bodyMedium" style={{ color: appColors.textSecondary, textAlign: 'center', marginTop: appSpacing.sm, lineHeight: 22 }}>
            Escreva sobre como está seu dia. A IA vai te ouvir e ajudar a entender seus padrões.
          </Text>
          <Button
            mode="contained"
            onPress={handleNewSession}
            style={{ marginTop: appSpacing.xl, borderRadius: appRadius.pill }}
            contentStyle={{ paddingHorizontal: appSpacing.xl, paddingVertical: 6 }}
            labelStyle={{ fontWeight: '700' }}
          >
            Começar agora
          </Button>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: appSpacing.sm, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onRefresh={load}
          refreshing={isLoadingSessions}
        />
      )}

      {/* FAB — Nova sessão */}
      {sessions.length > 0 && (
        <FAB
          icon="plus"
          label="Nova sessão"
          extended
          onPress={handleNewSession}
          style={{
            position: 'absolute',
            bottom: appSpacing.xl,
            right: appSpacing.lg,
            backgroundColor: appColors.primary,
          }}
          color="white"
        />
      )}
    </SafeAreaView>
  );
}

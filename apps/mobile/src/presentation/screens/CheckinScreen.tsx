import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCheckinStore } from '../providers/checkin_store';
import { useAuthStore } from '../providers/auth_store';

/**
 * CheckinScreen: Formulário de estado diário.
 */
export default function CheckinScreen() {
  const navigation = useNavigation<any>();
  const { isLoading, submitCheckin, error } = useCheckinStore();
  const { userId } = useAuthStore();

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [clarity, setClarity] = useState(3);
  const [irritability, setIrritability] = useState(3);
  const [note, setNote] = useState('');
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [locationLoading, setLocationLoading] = useState(false);

  const captureLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddress(undefined);
        return;
      }
      const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
      });
      if (place) {
        const parts = [place.street, place.district, place.city, place.region].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch {
      setAddress(undefined);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;

    await submitCheckin({
      userId,
      localDate: new Date().toISOString().split('T')[0],
      moodScore: mood,
      energyScore: energy,
      clarityScore: clarity,
      irritabilityScore: irritability,
      note,
      address,
    });

    // Navega para o resultado da IA se deu certo (sem erro no store)
    if (!useCheckinStore.getState().error) {
      navigation.navigate('CheckInResult');
    }
  };

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <Text className="text-xl font-bold mb-6 text-center">
        Como você está hoje?
      </Text>

      {/* Mood Selector (Substituto do _MoodSlider) */}
      <MoodSelector value={mood} onSelect={setMood} />

      {/* Energy Selector (Substituto do _EnergySelector) */}
      <ScoreSelector 
        label="Como está seu nível de energia?" 
        value={energy} 
        onSelect={setEnergy} 
      />

      {/* Clarity Selector */}
      <ScoreSelector 
        label="Como está sua clareza mental?" 
        value={clarity} 
        onSelect={setClarity} 
      />

      {/* Irritability Selector */}
      <ScoreSelector 
        label="Nível de irritabilidade" 
        value={irritability} 
        onSelect={setIrritability} 
      />

      {/* Note Field */}
      <View className="mt-6">
        <Text className="text-gray-700 mb-2">Quer comentar algo sobre o momento?</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 h-24 text-base"
          multiline
          placeholder="Ex: Dormi pouco, mas me sinto bem..."
          value={note}
          onChangeText={setNote}
          textAlignVertical="top"
        />
      </View>

      {/* Location Capture */}
      <View className="mt-6">
        <Text className="text-gray-700 mb-2">Onde você está agora? (opcional)</Text>
        <TouchableOpacity
          onPress={captureLocation}
          disabled={locationLoading}
          className="border border-gray-300 rounded-lg p-3 flex-row items-center"
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Text className={address ? 'text-gray-800' : 'text-gray-400'}>
              {address ?? 'Toque para capturar localização'}
            </Text>
          )}
        </TouchableOpacity>
        {address && (
          <TouchableOpacity onPress={() => setAddress(undefined)} className="mt-1">
            <Text className="text-xs text-red-400">Remover localização</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isLoading || !userId}
        className={`mt-8 mb-10 p-4 rounded-xl flex-row justify-center items-center ${
          isLoading || !userId ? 'bg-blue-300' : 'bg-blue-600'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-lg">
            {userId ? 'Confirmar check-in' : 'Entre para fazer check-in'}
          </Text>
        )}
      </TouchableOpacity>

      {error && (
        <Text className="text-red-500 text-center mt-2">{error}</Text>
      )}
    </ScrollView>
  );
}

/**
 * Seletor de Humor com Emojis (Tradução do _MoodSlider)
 */
function MoodSelector({ value, onSelect }: { value: number; onSelect: (v: number) => void }) {
  const emojis = ['😢', '😕', '😐', '🙂', '😄'];
  const labels = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'];

  return (
    <View className="mb-6">
      <Text className="text-lg font-semibold mb-4">Como está seu humor agora?</Text>
      <View className="flex-row justify-between">
        {emojis.map((emoji, index) => {
          const score = index + 1;
          const isSelected = value === score;
          return (
            <TouchableOpacity
              key={score}
              onPress={() => onSelect(score)}
              className={`items-center p-3 rounded-2xl border-2 ${
                isSelected ? 'bg-blue-50 border-blue-500' : 'border-transparent'
              }`}
            >
              <Text style={{ fontSize: 32 }}>{emoji}</Text>
              {isSelected && (
                <Text className="text-blue-600 text-xs font-bold mt-1">
                  {labels[index]}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Componente genérico para seletores de 1 a 5 (Substituto de Energy, Clarity, etc)
 */
function ScoreSelector({ label, value, onSelect }: { label: string; value: number; onSelect: (v: number) => void }) {
  return (
    <View className="mb-6">
      <Text className="text-gray-800 font-medium mb-3">{label}</Text>
      <View className="flex-row justify-between bg-gray-100 p-1 rounded-xl">
        {[1, 2, 3, 4, 5].map((score) => (
          <TouchableOpacity
            key={score}
            onPress={() => onSelect(score)}
            className={`flex-1 py-3 rounded-lg items-center ${
              value === score ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text className={`font-bold ${value === score ? 'text-blue-600' : 'text-gray-500'}`}>
              {score}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';

export default function NewPlaylistScreen() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  const router = useRouter();
  const normalizedCourseId = Array.isArray(courseId) ? courseId[0] : courseId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Error', 'El nombre es requerido'); return; }
    if (!normalizedCourseId) { Alert.alert('Error', 'No se pudo identificar el curso.'); return; }
    setIsSaving(true);
    try {
      await apiClient.createPlaylist({ name: name.trim(), description: description.trim() || undefined, course: normalizedCourseId, isPublic });
      Alert.alert('Creada', 'Lista de reproducción creada', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo crear');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 bg-amber-50" showsVerticalScrollIndicator={false}>
        <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Listas de Reproducción</Text>
            <Text className="text-white text-xl font-bold">Nueva Lista</Text>
          </View>
        </View>

        <View className="px-4 -mt-4">
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-gray-900 font-bold text-base mb-4">Información</Text>

            <View className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">Nombre *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Ej: Pensúm Bachata" placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base" />
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">Descripción</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder="Descripción opcional" placeholderTextColor="#9ca3af"
                multiline numberOfLines={3} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                style={{ minHeight: 80, textAlignVertical: 'top' }} />
            </View>

            <View className="flex-row items-center justify-between py-3 border-t border-gray-100">
              <View>
                <Text className="text-gray-800 font-semibold text-base">Lista pública</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Visible para los estudiantes</Text>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic}
                trackColor={{ false: '#e5e7eb', true: '#fbbf24' }} thumbColor={isPublic ? '#f59e0b' : '#f3f4f6'} />
            </View>
          </View>

          <TouchableOpacity onPress={handleCreate} disabled={isSaving}
            className="bg-amber-500 rounded-2xl py-4 items-center mb-4" style={{ opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Crear Lista</Text>}
          </TouchableOpacity>
          <View className="h-4" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

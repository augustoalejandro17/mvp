import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import { IClass, VideoStatus } from '@inti/shared-types';

const VIDEO_STATUS_CONFIG: Record<VideoStatus, { label: string; icon: string; color: string; bg: string }> = {
  [VideoStatus.READY]: { label: 'Lista', icon: 'checkmark-circle', color: '#16a34a', bg: '#f0fdf4' },
  [VideoStatus.PROCESSING]: { label: 'Procesando', icon: 'time', color: '#d97706', bg: '#fffbeb' },
  [VideoStatus.UPLOADING]: { label: 'Subiendo', icon: 'cloud-upload', color: '#6b7280', bg: '#f9fafb' },
  [VideoStatus.ERROR]: { label: 'Error', icon: 'alert-circle', color: '#dc2626', bg: '#fef2f2' },
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-semibold text-sm mb-1.5">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline={multiline}
        keyboardType={keyboardType}
        numberOfLines={multiline ? 4 : 1}
        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
        style={multiline ? { minHeight: 100, textAlignVertical: 'top' } : undefined}
      />
    </View>
  );
}

export default function EditClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [classItem, setClassItem] = useState<IClass | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.getClassById(id);
        setClassItem(data);
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setOrder(data.order != null ? String(data.order) : '');
        setIsPublic(data.isPublic ?? false);
      } catch {
        Alert.alert('Error', 'No se pudo cargar la clase');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'La descripción es requerida');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.updateClass(id, {
        title: title.trim(),
        description: description.trim(),
        order: order ? parseInt(order, 10) : undefined,
        isPublic,
      });
      Alert.alert('Guardado', 'Clase actualizada correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-amber-50 justify-center items-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  const videoStatus = classItem?.videoStatus ?? VideoStatus.UPLOADING;
  const statusConfig = VIDEO_STATUS_CONFIG[videoStatus];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 bg-amber-50" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Gestión de Clases</Text>
            <Text className="text-white text-xl font-bold" numberOfLines={1}>
              {classItem?.title ?? 'Editar Clase'}
            </Text>
          </View>
        </View>

        <View className="px-4 -mt-4">
          {/* Video status banner */}
          <View
            className="flex-row items-center rounded-2xl p-3 mb-4"
            style={{ backgroundColor: statusConfig.bg }}
          >
            <Ionicons name={statusConfig.icon as any} size={18} color={statusConfig.color} />
            <View className="ml-2 flex-1">
              <Text className="font-semibold text-sm" style={{ color: statusConfig.color }}>
                Video: {statusConfig.label}
              </Text>
              {classItem?.videoMetadata?.duration ? (
                <Text className="text-xs mt-0.5" style={{ color: statusConfig.color + 'cc' }}>
                  Duración: {Math.floor(classItem.videoMetadata.duration / 60)}:{String(classItem.videoMetadata.duration % 60).padStart(2, '0')} min
                </Text>
              ) : null}
              {classItem?.videoProcessingError ? (
                <Text className="text-xs mt-0.5 text-red-600">{classItem.videoProcessingError}</Text>
              ) : null}
            </View>
          </View>

          {/* Form */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-gray-900 font-bold text-base mb-4">Información de la Clase</Text>

            <FormField label="Título *" value={title} onChangeText={setTitle} placeholder="Título de la clase" />
            <FormField
              label="Descripción *"
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción detallada de la clase"
              multiline
            />
            <FormField
              label="Orden"
              value={order}
              onChangeText={setOrder}
              placeholder="Ej: 1, 2, 3..."
              keyboardType="numeric"
            />

            <View className="flex-row items-center justify-between py-3 border-t border-gray-100 mt-2">
              <View>
                <Text className="text-gray-800 font-semibold text-base">Clase pública</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Visible para todos los estudiantes</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: '#e5e7eb', true: '#fbbf24' }}
                thumbColor={isPublic ? '#f59e0b' : '#f3f4f6'}
              />
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="bg-amber-500 rounded-2xl py-4 items-center mb-4"
            style={{ opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Guardar Cambios</Text>
            )}
          </TouchableOpacity>

          <View className="h-4" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
import { ICourse } from '@inti/shared-types';

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
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
        numberOfLines={multiline ? 4 : 1}
        className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
        style={multiline ? { minHeight: 100, textAlignVertical: 'top' } : undefined}
      />
    </View>
  );
}

function ToggleField({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-3 border-t border-gray-100">
      <View className="flex-1 mr-4">
        <Text className="text-gray-800 font-semibold text-base">{label}</Text>
        <Text className="text-gray-500 text-xs mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e5e7eb', true: '#fbbf24' }}
        thumbColor={value ? '#f59e0b' : '#f3f4f6'}
      />
    </View>
  );
}

export default function EditCourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<ICourse | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.getCourseById(id);
        setCourse(data);
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setIsPublic((data as any).isPublic ?? false);
        setIsActive((data as any).isActive ?? true);
        setIsFeatured((data as any).isFeatured ?? false);
      } catch {
        Alert.alert('Error', 'No se pudo cargar el curso');
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
    setIsSaving(true);
    try {
      await apiClient.updateCourse(id, {
        title: title.trim(),
        description: description.trim(),
        isPublic,
        isActive,
        isFeatured,
      });
      Alert.alert('Guardado', 'Curso actualizado correctamente', [
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 bg-amber-50" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Gestión de Cursos</Text>
            <Text className="text-white text-xl font-bold" numberOfLines={1}>
              {course?.title ?? 'Editar Curso'}
            </Text>
          </View>
        </View>

        <View className="px-4 -mt-4">
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-gray-900 font-bold text-base mb-4">Información del Curso</Text>

            <FormField label="Título *" value={title} onChangeText={setTitle} placeholder="Título del curso" />
            <FormField label="Descripción" value={description} onChangeText={setDescription} placeholder="Descripción del curso" multiline />

            <Text className="text-gray-900 font-bold text-sm mt-2 mb-1">Configuración</Text>
            <ToggleField label="Curso público" description="Visible para todos los usuarios" value={isPublic} onValueChange={setIsPublic} />
            <ToggleField label="Curso activo" description="Disponible para inscripción" value={isActive} onValueChange={setIsActive} />
            <ToggleField label="Destacado" description="Aparece en secciones especiales" value={isFeatured} onValueChange={setIsFeatured} />
          </View>

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

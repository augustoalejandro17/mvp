import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import { ICourse } from '@inti/shared-types';
import ManageFormField from '@/components/manage/ManageFormField';
import ManageHeader from '@/components/manage/ManageHeader';
import ManageMediaField from '@/components/manage/ManageMediaField';
import ManageSummaryCard from '@/components/manage/ManageSummaryCard';
import ManageToggleField from '@/components/manage/ManageToggleField';
import { pickImageFromDevice } from '@/services/mediaPicker';

export default function EditCourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const courseId = Array.isArray(id) ? id[0] : id;

  const [course, setCourse] = useState<ICourse | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!courseId) {
        Alert.alert('Error', 'No se pudo identificar el curso.');
        router.back();
        setIsLoading(false);
        return;
      }
      try {
        const data = await apiClient.getCourseById(courseId);
        setCourse(data);
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setCoverImageUrl(
          typeof (data as any).coverImageUrl === 'string' ? (data as any).coverImageUrl : '',
        );
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
  }, [courseId, router]);

  const handlePickCoverImage = async () => {
    try {
      const file = await pickImageFromDevice();
      if (!file) return;
      setIsUploadingImage(true);
      const uploadedUrl = await apiClient.uploadImage(file);
      if (!uploadedUrl || typeof uploadedUrl !== 'string') {
        throw new Error('No se pudo obtener la URL de la imagen subida.');
      }
      setCoverImageUrl(uploadedUrl);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo subir la imagen';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!courseId) {
      Alert.alert('Error', 'No se pudo identificar el curso.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }
    setIsSaving(true);
    try {
      const safeCoverImageUrl =
        typeof coverImageUrl === 'string' ? coverImageUrl.trim() : '';
      await apiClient.updateCourse(courseId, {
        title: title.trim(),
        description: description.trim(),
        coverImageUrl: safeCoverImageUrl || undefined,
        isPublic,
        isActive,
        isFeatured,
      });
      Alert.alert('Guardado', 'Curso actualizado correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo guardar';
      Alert.alert('Error', Array.isArray(message) ? message.join('\n') : String(message));
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-amber-50"
    >
      <ScrollView
        className="flex-1 bg-amber-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <ManageHeader
          sectionLabel="Gestión de Cursos"
          title="Editar Curso"
          onBack={() => router.back()}
        />

        <View className="px-4 -mt-3">
          <ManageSummaryCard
            icon="book-outline"
            title={title || course?.title || 'Curso'}
            subtitle="Actualiza la información del curso"
          />

          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <Text className="text-gray-900 font-bold text-base mb-3">Información general</Text>
            <ManageFormField
              label="Título *"
              icon="text-outline"
              value={title}
              onChangeText={setTitle}
              placeholder="Título del curso"
            />
            <ManageFormField
              label="Descripción"
              icon="chatbubble-ellipses-outline"
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción del curso"
              multiline
            />
            <ManageMediaField
              label="Portada del curso"
              helperText="JPG, PNG, WEBP o GIF (máx. 5MB)"
              mediaType="image"
              previewUrl={coverImageUrl || undefined}
              selectedFileName={coverImageUrl ? 'Portada cargada' : undefined}
              isUploading={isUploadingImage}
              onPick={handlePickCoverImage}
              onClear={() => setCoverImageUrl('')}
            />

            <Text className="text-gray-900 font-bold text-base mb-3 mt-1">Configuración</Text>
            <ManageToggleField
              label="Curso público"
              description="Visible para todos los usuarios"
              value={isPublic}
              onValueChange={setIsPublic}
              icon="earth-outline"
            />
            <ManageToggleField
              label="Curso activo"
              description="Disponible para inscripción"
              value={isActive}
              onValueChange={setIsActive}
              icon="checkmark-circle-outline"
            />
            <ManageToggleField
              label="Destacado"
              description="Aparece en secciones especiales"
              value={isFeatured}
              onValueChange={setIsFeatured}
              icon="star-outline"
            />
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
              <View className="flex-row items-center">
                <Ionicons name="save-outline" size={18} color="white" />
                <Text className="text-white font-bold text-base ml-2">Guardar Cambios</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

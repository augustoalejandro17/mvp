import { useState } from 'react';
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
import ManageFormField from '@/components/manage/ManageFormField';
import ManageHeader from '@/components/manage/ManageHeader';
import ManageMediaField from '@/components/manage/ManageMediaField';
import ManageSummaryCard from '@/components/manage/ManageSummaryCard';
import ManageToggleField from '@/components/manage/ManageToggleField';
import { pickImageFromDevice } from '@/services/mediaPicker';

export default function NewCourseScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId?: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickCoverImage = async () => {
    try {
      const file = await pickImageFromDevice();
      if (!file) return;
      setIsUploadingImage(true);
      const uploadedUrl = await apiClient.uploadImage(file);
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

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }
    if (!schoolId) {
      Alert.alert('Error', 'No se pudo identificar la escuela. Vuelve atrás e intenta desde una escuela.');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.createCourse({
        title: title.trim(),
        description: description.trim(),
        schoolId,
        coverImageUrl: coverImageUrl || undefined,
        isPublic,
      });
      Alert.alert('Creado', 'Curso creado correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo crear el curso');
    } finally {
      setIsSaving(false);
    }
  };

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
          title="Nuevo Curso"
          onBack={() => router.back()}
        />

        <View className="px-4 -mt-3">
          <ManageSummaryCard
            icon="book-outline"
            title={title || 'Nuevo curso'}
            subtitle="Completa la información principal"
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

            <ManageToggleField
              icon="earth-outline"
              label="Curso público"
              description="Visible para todos los usuarios"
              value={isPublic}
              onValueChange={setIsPublic}
            />
          </View>

          <TouchableOpacity
            onPress={handleCreate}
            disabled={isSaving}
            className="bg-amber-500 rounded-2xl py-4 items-center mb-4"
            style={{ opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="save-outline" size={18} color="white" />
                <Text className="text-white font-bold text-base ml-2">Crear Curso</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import ManageFormField from '@/components/manage/ManageFormField';
import ManageHeader from '@/components/manage/ManageHeader';
import ManageMediaField from '@/components/manage/ManageMediaField';
import ManageSummaryCard from '@/components/manage/ManageSummaryCard';
import ManageToggleField from '@/components/manage/ManageToggleField';
import { pickImageFromDevice } from '@/services/mediaPicker';

export default function NewSchoolScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickLogo = async () => {
    try {
      const file = await pickImageFromDevice({ aspect: [1, 1] });
      if (!file) return;
      setIsUploadingImage(true);
      const uploadedUrl = await apiClient.uploadImage(file);
      if (!uploadedUrl || typeof uploadedUrl !== 'string') {
        throw new Error('No se pudo obtener la URL de la imagen subida.');
      }
      setLogoUrl(uploadedUrl);
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
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'La descripción es requerida');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.createSchool({
        name: name.trim(),
        description: description.trim(),
        logoUrl: logoUrl || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        isPublic,
      });
      Alert.alert('Creada', 'Escuela creada correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo crear la escuela';
      Alert.alert('Error', Array.isArray(message) ? message.join('\n') : String(message));
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
          sectionLabel="Gestión de Escuelas"
          title="Nueva Escuela"
          onBack={() => router.back()}
        />

        <View className="px-4 -mt-3">
          <ManageSummaryCard
            icon="school-outline"
            title={name || 'Nueva escuela'}
            subtitle="Completa la información principal"
          />

          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <Text className="text-gray-900 font-bold text-base mb-3">Información general</Text>
            <ManageFormField
              label="Nombre *"
              icon="text-outline"
              value={name}
              onChangeText={setName}
              placeholder="Nombre de la escuela"
            />
            <ManageFormField
              label="Descripción *"
              icon="chatbubble-ellipses-outline"
              value={description}
              onChangeText={setDescription}
              placeholder="Breve descripción de la escuela"
              multiline
            />
            <ManageMediaField
              label="Logo de la escuela"
              helperText="JPG, PNG, WEBP o GIF (máx. 5MB)"
              mediaType="image"
              previewUrl={logoUrl || undefined}
              selectedFileName={logoUrl ? 'Logo cargado' : undefined}
              isUploading={isUploadingImage}
              imagePreviewAspectRatio={1}
              imagePreviewResizeMode="cover"
              onPick={handlePickLogo}
              onClear={() => setLogoUrl('')}
            />

            <Text className="text-gray-900 font-bold text-base mb-3 mt-1">Contacto</Text>
            <ManageFormField
              label="Dirección"
              icon="location-outline"
              value={address}
              onChangeText={setAddress}
              placeholder="Dirección física"
            />
            <ManageFormField
              label="Teléfono"
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (000) 000-0000"
              keyboardType="phone-pad"
            />
            <ManageFormField
              label="Sitio Web"
              icon="globe-outline"
              value={website}
              onChangeText={setWebsite}
              placeholder="https://..."
              keyboardType="url"
            />

            <ManageToggleField
              icon="eye-outline"
              label="Escuela pública"
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
                <Text className="text-white font-bold text-base ml-2">Crear Escuela</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

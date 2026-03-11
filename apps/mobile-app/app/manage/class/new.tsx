import { useEffect, useState } from 'react';
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
import {
  apiClient,
  CreatorTermsStatus,
  NativeUploadFile,
} from '@/services/apiClient';
import ManageFormField from '@/components/manage/ManageFormField';
import ManageHeader from '@/components/manage/ManageHeader';
import ManageMediaField from '@/components/manage/ManageMediaField';
import ManageSummaryCard from '@/components/manage/ManageSummaryCard';
import ManageToggleField from '@/components/manage/ManageToggleField';
import { pickVideoFromDevice } from '@/services/mediaPicker';

export default function NewClassScreen() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<NativeUploadFile | null>(
    null,
  );
  const [creatorTermsStatus, setCreatorTermsStatus] =
    useState<CreatorTermsStatus | null>(null);
  const [acceptCreatorTermsChecked, setAcceptCreatorTermsChecked] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadCreatorTermsStatus = async () => {
      try {
        const status = await apiClient.getCreatorTermsStatus();
        if (!mounted) return;
        setCreatorTermsStatus(status);
      } catch {
        if (!mounted) return;
        setCreatorTermsStatus(null);
      }
    };
    loadCreatorTermsStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePickVideo = async () => {
    try {
      const file = await pickVideoFromDevice();
      if (!file) return;
      setSelectedVideo(file);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo seleccionar el video';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      Alert.alert('Error', 'La descripción debe tener al menos 10 caracteres');
      return;
    }
    if (!courseId) {
      Alert.alert('Error', 'No se pudo identificar el curso. Vuelve atrás e intenta desde un curso.');
      return;
    }
    if (selectedVideo && creatorTermsStatus && !creatorTermsStatus.accepted && !acceptCreatorTermsChecked) {
      Alert.alert(
        'Términos de creador',
        'Debes aceptar los términos de creador antes de subir videos.',
      );
      return;
    }
    setIsSaving(true);
    try {
      if (selectedVideo) {
        if (creatorTermsStatus && !creatorTermsStatus.accepted) {
          const accepted = await apiClient.acceptCreatorTerms(
            creatorTermsStatus.requiredVersion,
          );
          setCreatorTermsStatus(accepted);
        }

        await apiClient.createClassWithVideo(
          {
            title: title.trim(),
            description: description.trim(),
            courseId,
            order: order ? parseInt(order, 10) : undefined,
            isPublic,
          },
          selectedVideo,
        );
      } else {
        await apiClient.createClass({
          title: title.trim(),
          description: description.trim(),
          courseId,
          order: order ? parseInt(order, 10) : undefined,
          isPublic,
        });
      }
      Alert.alert('Creada', 'Clase creada correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : (msg ?? 'No se pudo crear la clase'));
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
          sectionLabel="Gestión de Clases"
          title="Nueva Clase"
          onBack={() => router.back()}
        />

        <View className="px-4 -mt-3">
          <ManageSummaryCard
            icon="videocam-outline"
            title={title || 'Nueva clase'}
            subtitle="Completa la información principal"
          />

          <View className="flex-row items-start bg-blue-50 border border-blue-100 rounded-2xl p-3 mb-4">
            <Ionicons name="information-circle-outline" size={18} color="#3b82f6" />
            <Text className="text-blue-700 text-xs ml-2 flex-1">
              Puedes crear la clase ahora y subir el video directamente desde móvil.
            </Text>
          </View>

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
              placeholder="Título de la clase"
            />
            <ManageFormField
              label="Descripción *"
              icon="chatbubble-ellipses-outline"
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción detallada de la clase (mín. 10 caracteres)"
              multiline
            />
            <Text className="text-gray-400 text-xs mt-[-8] mb-2 text-right">{description.length} / 10 min</Text>
            <ManageFormField
              label="Orden"
              icon="list-outline"
              value={order}
              onChangeText={setOrder}
              placeholder="Posición en el curso (ej: 1)"
              keyboardType="numeric"
            />
            <ManageMediaField
              label="Video de la clase"
              helperText="MP4, MOV, WEBM, AVI, MKV (máx. 200MB)"
              mediaType="video"
              selectedFileName={selectedVideo?.name}
              onPick={handlePickVideo}
              onClear={() => setSelectedVideo(null)}
            />

            {selectedVideo && creatorTermsStatus && !creatorTermsStatus.accepted ? (
              <TouchableOpacity
                onPress={() => setAcceptCreatorTermsChecked((prev) => !prev)}
                className="flex-row items-start bg-amber-50 border border-amber-200 rounded-xl px-3 py-3 mb-3"
              >
                <Ionicons
                  name={acceptCreatorTermsChecked ? 'checkbox' : 'square-outline'}
                  size={18}
                  color="#b45309"
                />
                <Text className="text-amber-800 text-xs ml-2 flex-1">
                  Confirmo que el contenido cumple políticas de comunidad y derechos de autor.
                  Se registrará aceptación de términos de creador versión {creatorTermsStatus.requiredVersion}.
                </Text>
              </TouchableOpacity>
            ) : null}

            <ManageToggleField
              icon="earth-outline"
              label="Clase pública"
              description="Visible para todos los estudiantes"
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
                <Text className="text-white font-bold text-base ml-2">Crear Clase</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

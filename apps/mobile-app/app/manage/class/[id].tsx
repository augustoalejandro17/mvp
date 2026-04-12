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
import {
  apiClient,
  CreatorTermsStatus,
  NativeUploadFile,
} from '@/services/apiClient';
import { IClass, VideoStatus } from '@inti/shared-types';
import ManageFormField from '@/components/manage/ManageFormField';
import ManageHeader from '@/components/manage/ManageHeader';
import ManageMediaField from '@/components/manage/ManageMediaField';
import ManageSummaryCard from '@/components/manage/ManageSummaryCard';
import ManageToggleField from '@/components/manage/ManageToggleField';
import { pickVideoFromDevice } from '@/services/mediaPicker';

const toAlertMessage = (value: any, fallback: string): string => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join('\n');
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  if (value && typeof value === 'object') {
    const nested = (value as any).message;
    if (Array.isArray(nested)) {
      return nested.map((item) => String(item)).join('\n');
    }
    if (typeof nested === 'string' && nested.trim().length > 0) {
      return nested;
    }
  }
  return fallback;
};

const VIDEO_STATUS_CONFIG: Record<
  VideoStatus,
  { label: string; icon: string; color: string; bg: string }
> = {
  [VideoStatus.NO_VIDEO]: { label: 'Sin video', icon: 'videocam-off', color: '#92400e', bg: '#fff7ed' },
  [VideoStatus.READY]: { label: 'Lista', icon: 'checkmark-circle', color: '#16a34a', bg: '#f0fdf4' },
  [VideoStatus.PROCESSING]: { label: 'Procesando', icon: 'time', color: '#d97706', bg: '#fffbeb' },
  [VideoStatus.UPLOADING]: { label: 'Subiendo', icon: 'cloud-upload', color: '#6b7280', bg: '#f9fafb' },
  [VideoStatus.ERROR]: { label: 'Error', icon: 'alert-circle', color: '#dc2626', bg: '#fef2f2' },
};

export default function EditClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const classId = Array.isArray(id) ? id[0] : id;

  const [classItem, setClassItem] = useState<IClass | null>(null);
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!classId) {
        Alert.alert('Error', 'No se pudo identificar la clase.');
        router.back();
        return;
      }
      try {
        const data = await apiClient.getClassById(classId);
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
  }, [classId]);

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

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    if (!classId) {
      Alert.alert('Error', 'No se pudo identificar la clase.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'La descripción es requerida');
      return;
    }
    if (selectedVideo && creatorTermsStatus && !creatorTermsStatus.accepted && !acceptCreatorTermsChecked) {
      Alert.alert(
        'Términos de creador',
        'Debes aceptar los términos de creador antes de subir videos.',
      );
      return;
    }

    const rawOrder = String(order || '').trim();
    const parsedOrder = rawOrder ? Number.parseInt(rawOrder, 10) : undefined;
    if (rawOrder && (!Number.isInteger(parsedOrder) || Number(parsedOrder) < 1)) {
      Alert.alert('Error', 'El orden debe ser un número entero mayor o igual a 1.');
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

        await apiClient.updateClassWithVideo(
          classId,
          {
            title: title.trim(),
            description: description.trim(),
            order: parsedOrder,
            isPublic,
          },
          selectedVideo,
        );
      } else {
        await apiClient.updateClass(classId, {
          title: title.trim(),
          description: description.trim(),
          order: parsedOrder,
          isPublic,
        });
      }
      Alert.alert('Guardado', 'Clase actualizada correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert(
        'Error',
        toAlertMessage(
          e?.response?.data?.message || e?.message,
          'No se pudo guardar',
        ),
      );
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

  const rawVideoStatus = String(
    classItem?.videoStatus ?? VideoStatus.NO_VIDEO,
  ) as VideoStatus;
  const statusConfig =
    VIDEO_STATUS_CONFIG[rawVideoStatus] ?? VIDEO_STATUS_CONFIG[VideoStatus.NO_VIDEO];

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
          title="Editar Clase"
          onBack={() => router.back()}
        />

        <View className="px-4 -mt-3">
          <ManageSummaryCard
            icon="videocam-outline"
            title={title || classItem?.title || 'Clase'}
            subtitle="Ajusta datos y visibilidad"
          />

          <View
            className="flex-row items-center rounded-2xl p-3 mb-4 border"
            style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.color + '33' }}
          >
            <Ionicons name={statusConfig.icon as any} size={18} color={statusConfig.color} />
            <View className="ml-2 flex-1">
              <Text className="font-semibold text-sm" style={{ color: statusConfig.color }}>
                Video: {statusConfig.label}
              </Text>
              {classItem?.videoMetadata?.duration ? (
                <Text className="text-xs mt-0.5" style={{ color: statusConfig.color + 'cc' }}>
                  Duración: {Math.floor(classItem.videoMetadata.duration / 60)}:
                  {String(classItem.videoMetadata.duration % 60).padStart(2, '0')} min
                </Text>
              ) : null}
              {classItem?.videoProcessingError ? (
                <Text className="text-xs mt-0.5 text-red-600">{classItem.videoProcessingError}</Text>
              ) : null}
            </View>
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
              placeholder="Descripción detallada de la clase"
              multiline
            />
            <ManageFormField
              label="Orden"
              icon="list-outline"
              value={order}
              onChangeText={setOrder}
              placeholder="Ej: 1, 2, 3..."
              keyboardType="numeric"
            />
            <ManageMediaField
              label="Reemplazar video"
              helperText="MP4, MOV, WEBM, AVI, MKV, M4V, MPEG, MPG, 3GP, OGV (máx. 200MB)"
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

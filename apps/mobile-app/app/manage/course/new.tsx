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
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import { IUser } from '@inti/shared-types';
import ManageFormField from '@/components/manage/ManageFormField';
import ManageHeader from '@/components/manage/ManageHeader';
import ManageMediaField from '@/components/manage/ManageMediaField';
import ManageSummaryCard from '@/components/manage/ManageSummaryCard';
import ManageToggleField from '@/components/manage/ManageToggleField';
import { pickImageFromDevice } from '@/services/mediaPicker';

const normalizeList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const candidates = [
      (value as any).items,
      (value as any).data,
      (value as any).results,
      (value as any).users,
      (value as any).teachers,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }
  return [];
};

const getEntityId = (entity: any): string => {
  const raw = entity?._id ?? entity?.id ?? entity;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.toString === 'function') {
    const value = String(raw.toString());
    return value === '[object Object]' ? '' : value;
  }
  return '';
};

export default function NewCourseScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId?: string }>();
  const router = useRouter();
  const normalizedSchoolId = Array.isArray(schoolId) ? schoolId[0] : schoolId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [teacherOptions, setTeacherOptions] = useState<IUser[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [additionalTeacherIds, setAdditionalTeacherIds] = useState<string[]>([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadTeachersForSchool = async () => {
      if (!normalizedSchoolId) {
        if (!mounted) return;
        setTeacherOptions([]);
        setTeacherId('');
        setAdditionalTeacherIds([]);
        return;
      }

      try {
        setIsLoadingTeachers(true);
        const [teachersData, currentUser] = await Promise.all([
          apiClient.getTeachersBySchool(normalizedSchoolId),
          apiClient.getCurrentUser().catch(() => null),
        ]);

        if (!mounted) return;

        const normalizedTeachers = normalizeList<IUser>(teachersData).filter(
          (entry) => !!getEntityId(entry),
        );
        setTeacherOptions(normalizedTeachers);

        if (normalizedTeachers.length === 0) {
          setTeacherId('');
          setAdditionalTeacherIds([]);
          return;
        }

        const currentUserId = getEntityId(currentUser);
        const hasSelectedTeacher = normalizedTeachers.some(
          (entry) => getEntityId(entry) === teacherId,
        );

        if (!hasSelectedTeacher) {
          const nextTeacherId =
            normalizedTeachers.find(
              (entry) => getEntityId(entry) === currentUserId,
            )?._id ||
            normalizedTeachers[0]?._id ||
            '';

          setTeacherId(getEntityId(nextTeacherId));
        }

        setAdditionalTeacherIds((prev) =>
          prev.filter((entryId) =>
            normalizedTeachers.some((entry) => getEntityId(entry) === entryId),
          ),
        );
      } catch {
        if (!mounted) return;
        setTeacherOptions([]);
        setTeacherId('');
        setAdditionalTeacherIds([]);
      } finally {
        if (mounted) {
          setIsLoadingTeachers(false);
        }
      }
    };

    loadTeachersForSchool();

    return () => {
      mounted = false;
    };
  }, [normalizedSchoolId]);

  const filteredTeacherOptions = teacherOptions.filter((entry) => {
    const term = teacherSearch.trim().toLowerCase();
    if (!term) return true;
    const nameValue = String(entry.name || '').toLowerCase();
    const emailValue = String(entry.email || '').toLowerCase();
    return nameValue.includes(term) || emailValue.includes(term);
  });

  const mainTeacher =
    teacherOptions.find((entry) => getEntityId(entry) === teacherId) || null;

  const handleSelectMainTeacher = (nextTeacherId: string) => {
    setTeacherId(nextTeacherId);
    setAdditionalTeacherIds((prev) =>
      prev.filter((entry) => entry !== nextTeacherId),
    );
  };

  const handleToggleAdditionalTeacher = (nextTeacherId: string) => {
    if (nextTeacherId === teacherId) {
      Alert.alert(
        'Profesor principal',
        'Ese profesor ya está asignado como principal.',
      );
      return;
    }

    setAdditionalTeacherIds((prev) => {
      if (prev.includes(nextTeacherId)) {
        return prev.filter((entry) => entry !== nextTeacherId);
      }
      if (prev.length >= 4) {
        Alert.alert(
          'Límite alcanzado',
          'Puedes agregar hasta 4 profesores adicionales.',
        );
        return prev;
      }
      return [...prev, nextTeacherId];
    });
  };

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

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }
    if (!normalizedSchoolId) {
      Alert.alert('Error', 'No se pudo identificar la escuela. Vuelve atrás e intenta desde una escuela.');
      return;
    }
    if (!teacherId) {
      Alert.alert(
        'Error',
        teacherOptions.length === 0
          ? 'Esta escuela aún no tiene profesores disponibles. Agrega o asigna un profesor primero.'
          : 'Debes seleccionar un profesor principal.',
      );
      return;
    }
    setIsSaving(true);
    try {
      const createdCourse = await apiClient.createCourse({
        title: title.trim(),
        description: description.trim(),
        schoolId: normalizedSchoolId,
        coverImageUrl: coverImageUrl || undefined,
        teacher: teacherId,
        teachers: [teacherId, ...additionalTeacherIds],
        isPublic,
      });
      const createdCourseId = getEntityId(createdCourse);
      Alert.alert('Creado', 'Curso creado correctamente', [
        { text: 'Volver', style: 'cancel', onPress: () => router.back() },
        createdCourseId
          ? {
              text: 'Crear clase',
              onPress: () =>
                router.replace(`/manage/class/new?courseId=${createdCourseId}`),
            }
          : { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo crear el curso';
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

            <Text className="text-gray-900 font-bold text-base mb-3 mt-1">Profesores</Text>
            <Text className="text-gray-500 text-sm mb-3">
              Selecciona el profesor principal del curso y, si hace falta, agrega profesores adicionales.
            </Text>

            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 mb-3">
              <Ionicons name="search-outline" size={18} color="#9ca3af" />
              <TextInput
                value={teacherSearch}
                onChangeText={setTeacherSearch}
                placeholder="Buscar profesor por nombre o email"
                placeholderTextColor="#9ca3af"
                className="flex-1 py-3 ml-2 text-gray-900 text-base"
              />
            </View>

            {mainTeacher ? (
              <View className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-3">
                <Text className="text-amber-900 font-semibold text-sm">Profesor principal</Text>
                <Text className="text-gray-900 font-bold text-base mt-1">
                  {mainTeacher.name}
                </Text>
                <Text className="text-gray-500 text-sm mt-0.5">{mainTeacher.email}</Text>
              </View>
            ) : (
              <View className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-3">
                <Text className="text-red-700 text-sm font-semibold">
                  Selecciona un profesor principal para crear el curso.
                </Text>
              </View>
            )}

            {additionalTeacherIds.length > 0 && (
              <View className="mb-3">
                <Text className="text-gray-700 font-semibold text-sm mb-2">
                  Profesores adicionales
                </Text>
                <View className="flex-row flex-wrap">
                  {additionalTeacherIds.map((entryId) => {
                    const teacherEntry = teacherOptions.find(
                      (entry) => getEntityId(entry) === entryId,
                    );
                    return (
                      <View
                        key={entryId}
                        className="flex-row items-center bg-sky-50 border border-sky-100 rounded-full px-3 py-2 mr-2 mb-2"
                      >
                        <Text className="text-sky-800 text-xs font-semibold mr-2">
                          {teacherEntry?.name || 'Profesor'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleToggleAdditionalTeacher(entryId)}
                        >
                          <Ionicons name="close-circle" size={16} color="#0284c7" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View className="rounded-2xl overflow-hidden border border-gray-100 mb-3">
              {isLoadingTeachers ? (
                <View className="px-4 py-4 bg-gray-50 flex-row items-center">
                  <ActivityIndicator size="small" color="#f59e0b" />
                  <Text className="text-gray-500 text-sm ml-3">
                    Cargando profesores de la escuela...
                  </Text>
                </View>
              ) : filteredTeacherOptions.length === 0 ? (
                <View className="px-4 py-4 bg-gray-50">
                  <Text className="text-gray-500 text-sm">
                    {normalizedSchoolId
                      ? 'No encontramos profesores para esta escuela. Agrega o asigna uno primero.'
                      : 'No se pudo identificar la escuela del curso.'}
                  </Text>
                </View>
              ) : (
                filteredTeacherOptions.map((entry, index) => {
                  const entryId = getEntityId(entry);
                  const isMain = entryId === teacherId;
                  const isAdditional = additionalTeacherIds.includes(entryId);

                  return (
                    <View
                      key={entryId || `${entry.email}-${index}`}
                      className="px-4 py-3 bg-white"
                      style={{
                        borderBottomWidth:
                          index === filteredTeacherOptions.length - 1 ? 0 : 1,
                        borderBottomColor: '#f3f4f6',
                      }}
                    >
                      <View className="flex-row items-center">
                        <View className="flex-1 pr-3">
                          <Text className="text-gray-900 font-semibold text-sm">
                            {entry.name}
                          </Text>
                          <Text className="text-gray-500 text-xs mt-0.5">
                            {entry.email}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleSelectMainTeacher(entryId)}
                          className="px-3 py-2 rounded-xl mr-2"
                          style={{ backgroundColor: isMain ? '#f59e0b' : '#f3f4f6' }}
                        >
                          <Text
                            className="text-xs font-bold"
                            style={{ color: isMain ? '#ffffff' : '#4b5563' }}
                          >
                            Principal
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleToggleAdditionalTeacher(entryId)}
                          className="px-3 py-2 rounded-xl"
                          style={{ backgroundColor: isAdditional ? '#0284c7' : '#eff6ff' }}
                        >
                          <Text
                            className="text-xs font-bold"
                            style={{ color: isAdditional ? '#ffffff' : '#1d4ed8' }}
                          >
                            {isAdditional ? 'Quitar' : 'Agregar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

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

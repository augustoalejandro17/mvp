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
import { ICourse, IUser } from '@inti/shared-types';
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
  const [schoolId, setSchoolId] = useState('');
  const [teacherOptions, setTeacherOptions] = useState<IUser[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [additionalTeacherIds, setAdditionalTeacherIds] = useState<string[]>([]);

  const loadTeachersForSchool = async (
    targetSchoolId: string,
    mainTeacherId?: string,
    additionalIds?: string[],
  ) => {
    if (!targetSchoolId) {
      setTeacherOptions([]);
      return;
    }

    try {
      const teachersData = await apiClient.getTeachersBySchool(targetSchoolId);
      const normalizedTeachers = normalizeList<IUser>(teachersData);
      const ids = new Set<string>([
        ...(mainTeacherId ? [mainTeacherId] : []),
        ...((additionalIds || []).filter(Boolean)),
      ]);

      normalizedTeachers.forEach((entry) => {
        const entryId = getEntityId(entry);
        if (entryId) ids.add(entryId);
      });

      const nextOptions = Array.from(ids)
        .map((entryId) => {
          const existing = normalizedTeachers.find(
            (entry) => getEntityId(entry) === entryId,
          );
          if (existing) return existing;
          return {
            _id: entryId,
            name: 'Profesor asignado',
            email: '',
            role: 'teacher',
          } as IUser;
        })
        .filter((entry) => !!getEntityId(entry));

      setTeacherOptions(nextOptions);
    } catch {
      setTeacherOptions([]);
    }
  };

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
        const normalizedSchoolId = getEntityId((data as any).school);
        const normalizedTeacherId = getEntityId((data as any).teacher);
        const normalizedAdditionalTeacherIds = Array.isArray((data as any).teachers)
          ? (data as any).teachers
              .map((entry: any) => getEntityId(entry))
              .filter((entryId: string) => entryId && entryId !== normalizedTeacherId)
          : [];

        setSchoolId(normalizedSchoolId);
        setTeacherId(normalizedTeacherId);
        setAdditionalTeacherIds(normalizedAdditionalTeacherIds);

        await loadTeachersForSchool(
          normalizedSchoolId,
          normalizedTeacherId,
          normalizedAdditionalTeacherIds,
        );
      } catch {
        Alert.alert('Error', 'No se pudo cargar el curso');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [courseId, router]);

  const filteredTeacherOptions = teacherOptions.filter((entry) => {
    const term = teacherSearch.trim().toLowerCase();
    if (!term) return true;
    const nameValue = String(entry.name || '').toLowerCase();
    const emailValue = String(entry.email || '').toLowerCase();
    return nameValue.includes(term) || emailValue.includes(term);
  });

  const mainTeacher = teacherOptions.find((entry) => getEntityId(entry) === teacherId) || null;

  const handleSelectMainTeacher = (nextTeacherId: string) => {
    setTeacherId(nextTeacherId);
    setAdditionalTeacherIds((prev) => prev.filter((entry) => entry !== nextTeacherId));
  };

  const handleToggleAdditionalTeacher = (nextTeacherId: string) => {
    if (nextTeacherId === teacherId) {
      Alert.alert('Profesor principal', 'Ese profesor ya está asignado como principal.');
      return;
    }

    setAdditionalTeacherIds((prev) => {
      if (prev.includes(nextTeacherId)) {
        return prev.filter((entry) => entry !== nextTeacherId);
      }
      if (prev.length >= 4) {
        Alert.alert('Límite alcanzado', 'Puedes agregar hasta 4 profesores adicionales.');
        return prev;
      }
      return [...prev, nextTeacherId];
    });
  };

  const handlePickCoverImage = async () => {
    try {
      const file = await pickImageFromDevice({ aspect: [16, 9] });
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
    if (!teacherId) {
      Alert.alert('Error', 'Debes seleccionar un profesor principal.');
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
        teacher: teacherId,
        teachers: [teacherId, ...additionalTeacherIds],
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
            subtitle="Actualiza la información general del curso"
          />

          <TouchableOpacity
            onPress={() => router.push(`/manage/course/${courseId}/students`)}
            className="bg-white rounded-2xl px-4 py-4 mb-4 flex-row items-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <View className="w-11 h-11 rounded-2xl bg-sky-50 items-center justify-center mr-3">
              <Ionicons name="people-outline" size={20} color="#0284c7" />
            </View>
            <View className="flex-1 pr-3">
              <Text className="text-gray-900 font-bold text-base">Gestionar alumnos</Text>
              <Text className="text-gray-500 text-xs mt-1">
                Matricula o retira usuarios sin entrar al formulario del curso.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

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
              imagePreviewAspectRatio={16 / 9}
              imagePreviewResizeMode="cover"
              onPick={handlePickCoverImage}
              onClear={() => setCoverImageUrl('')}
            />

            <Text className="text-gray-900 font-bold text-base mb-3 mt-1">Profesores</Text>
            <Text className="text-gray-500 text-sm mb-3">
              Edita el profesor principal y los profesores adicionales del curso.
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
                <Text className="text-gray-900 font-bold text-base mt-1">{mainTeacher.name}</Text>
                <Text className="text-gray-500 text-sm mt-0.5">{mainTeacher.email}</Text>
              </View>
            ) : (
              <View className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-3">
                <Text className="text-red-700 text-sm font-semibold">
                  Selecciona un profesor principal para guardar.
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
                        <TouchableOpacity onPress={() => handleToggleAdditionalTeacher(entryId)}>
                          <Ionicons name="close-circle" size={16} color="#0284c7" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View className="rounded-2xl overflow-hidden border border-gray-100 mb-1">
              {filteredTeacherOptions.length === 0 ? (
                <View className="px-4 py-4 bg-gray-50">
                  <Text className="text-gray-500 text-sm">
                    {schoolId
                      ? 'No encontramos profesores para esta escuela.'
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

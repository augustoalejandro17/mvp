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
import { ICourse, IUser } from '@inti/shared-types';
import {
  apiClient,
  SeatPolicyCapabilities,
} from '@/services/apiClient';
import ManageHeader from '@/components/manage/ManageHeader';
import ManageSummaryCard from '@/components/manage/ManageSummaryCard';

const DEFAULT_CAPABILITIES: SeatPolicyCapabilities = {
  canViewSeatManagementModule: false,
  canOpenEnrollFlow: false,
  canAssignCourseSeatPermit: false,
  canSetOwnerQuota: false,
  canReadOwnerQuota: false,
  canSetOwnerQuotaForTarget: false,
  canReadOwnerQuotaForTarget: false,
  canEnrollStudentInCourse: false,
  canUnenrollStudentFromCourse: false,
  canAddStudentToCourse: false,
  canRemoveStudentFromCourse: false,
};

const getEntityId = (entity: any): string => {
  if (!entity) return '';

  const raw = entity?._id ?? entity?.id;
  if (typeof raw === 'string') {
    return raw;
  }
  if (raw && typeof raw === 'object') {
    if (typeof raw.$oid === 'string') {
      return raw.$oid;
    }
    if (typeof raw.toString === 'function') {
      const value = String(raw.toString());
      return value === '[object Object]' ? '' : value;
    }
  }
  return '';
};

const getCourseSchoolId = (course: ICourse | null): string => {
  if (!course) return '';
  const rawSchool = (course as any).school;
  if (typeof rawSchool === 'string') {
    return rawSchool;
  }
  return getEntityId(rawSchool);
};

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

const normalizeRoleLabel = (role: string | undefined): string => {
  switch (String(role || '').toLowerCase()) {
    case 'student':
      return 'Estudiante';
    case 'teacher':
      return 'Profesor';
    case 'administrative':
      return 'Administrativo';
    case 'school_owner':
      return 'Propietario';
    case 'admin':
      return 'Admin';
    case 'super_admin':
      return 'Super Admin';
    case 'unregistered':
      return 'Asistente';
    default:
      return 'Usuario';
  }
};

export default function CourseStudentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const courseId = Array.isArray(id) ? id[0] : id;

  const [course, setCourse] = useState<ICourse | null>(null);
  const [seatCapabilities, setSeatCapabilities] = useState<SeatPolicyCapabilities>(
    DEFAULT_CAPABILITIES,
  );
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<IUser[]>([]);
  const [hasSearchedStudents, setHasSearchedStudents] = useState(false);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStudentMutationId, setActiveStudentMutationId] = useState('');

  const courseSchoolId = getCourseSchoolId(course);
  const enrolledStudents = Array.isArray((course as any)?.students)
    ? ((course as any).students as IUser[]).filter(
        (student) => !!student && typeof student === 'object' && !!getEntityId(student),
      )
    : [];

  useEffect(() => {
    const load = async () => {
      if (!courseId) {
        Alert.alert('Error', 'No se pudo identificar el curso.');
        router.back();
        setIsLoading(false);
        return;
      }

      try {
        const [data, policy] = await Promise.all([
          apiClient.getCourseById(courseId),
          apiClient.getSeatPolicy({ courseId }).catch(() => null),
        ]);
        setCourse(data);
        if (policy?.capabilities) {
          setSeatCapabilities(policy.capabilities);
        }
      } catch {
        Alert.alert('Error', 'No se pudo cargar la matrícula del curso');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [courseId, router]);

  const refreshCourse = async () => {
    if (!courseId) return;

    const [data, policy] = await Promise.all([
      apiClient.getCourseById(courseId),
      apiClient.getSeatPolicy({ courseId }).catch(() => null),
    ]);

    setCourse(data);
    if (policy?.capabilities) {
      setSeatCapabilities(policy.capabilities);
    }
  };

  const handleSearchStudents = async () => {
    const query = studentSearch.trim();
    if (!query || query.length < 3) {
      Alert.alert('Búsqueda muy corta', 'Escribe al menos 3 caracteres del email.');
      return;
    }
    if (!courseSchoolId) {
      Alert.alert('Error', 'No se pudo identificar la escuela del curso.');
      return;
    }

    setIsSearchingStudents(true);
    setHasSearchedStudents(true);
    try {
      const results = await apiClient.searchUsersByEmail(query, courseSchoolId);
      const filtered = results.filter(
        (candidate) => String(candidate.role || '').toLowerCase() !== 'unregistered',
      );
      setSearchResults(filtered);
    } catch (error: any) {
      setSearchResults([]);
      Alert.alert(
        'Error',
        toAlertMessage(
          error?.response?.data?.message || error?.message,
          'No se pudo buscar usuarios para matricular',
        ),
      );
    } finally {
      setIsSearchingStudents(false);
    }
  };

  const handleEnrollStudent = async (student: IUser) => {
    const studentId = getEntityId(student);
    if (!courseId || !studentId || !courseSchoolId) {
      Alert.alert('Error', 'No se pudo identificar el usuario o el curso.');
      return;
    }

    const alreadyEnrolled = enrolledStudents.some(
      (candidate) => getEntityId(candidate) === studentId,
    );
    if (alreadyEnrolled) {
      Alert.alert('Ya inscrito', 'Este usuario ya está inscrito en el curso.');
      return;
    }

    setActiveStudentMutationId(studentId);
    try {
      const policy = await apiClient.getSeatPolicy({ courseId });
      if (!policy.capabilities?.canEnrollStudentInCourse) {
        throw new Error('No tienes permisos para matricular en este curso.');
      }

      if (policy.capabilities?.canAssignCourseSeatPermit) {
        await apiClient.assignCourseSeatPermit(studentId, courseSchoolId, courseId);
      }

      await apiClient.enrollStudentInCourse(courseId, studentId);
      await refreshCourse();
      Alert.alert('Listo', 'Usuario matriculado correctamente.');
    } catch (error: any) {
      Alert.alert(
        'Error',
        toAlertMessage(
          error?.response?.data?.message || error?.message,
          'No se pudo matricular al usuario',
        ),
      );
    } finally {
      setActiveStudentMutationId('');
    }
  };

  const handleUnenrollStudent = (student: IUser) => {
    const studentId = getEntityId(student);
    if (!courseId || !studentId) {
      Alert.alert('Error', 'No se pudo identificar al estudiante.');
      return;
    }

    Alert.alert(
      'Retirar del curso',
      `¿Quieres retirar a ${student.name || student.email} de este curso?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Retirar',
          style: 'destructive',
          onPress: async () => {
            setActiveStudentMutationId(studentId);
            try {
              await apiClient.unenrollStudentFromCourse(courseId, studentId);
              await refreshCourse();
              Alert.alert('Listo', 'Estudiante retirado del curso.');
            } catch (error: any) {
              Alert.alert(
                'Error',
                toAlertMessage(
                  error?.response?.data?.message || error?.message,
                  'No se pudo retirar al estudiante',
                ),
              );
            } finally {
              setActiveStudentMutationId('');
            }
          },
        },
      ],
    );
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
          title="Alumnos del Curso"
          onBack={() => router.back()}
        />

        <View className="px-4 -mt-3">
          <ManageSummaryCard
            icon="people-outline"
            title={course?.title || 'Curso'}
            subtitle="Matricula o retira estudiantes desde un flujo dedicado"
          />

          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 pr-3">
                <Text className="text-gray-900 font-bold text-base">Matrícula</Text>
                <Text className="text-gray-500 text-xs mt-1">
                  Busca cualquier usuario registrado por email para agregarlo a este curso.
                </Text>
              </View>
              <View className="bg-amber-50 px-3 py-2 rounded-xl">
                <Text className="text-amber-700 font-bold text-base">
                  {enrolledStudents.length}
                </Text>
                <Text className="text-amber-700 text-[11px]">inscritos</Text>
              </View>
            </View>

            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 mb-3">
              <Ionicons name="search-outline" size={18} color="#9ca3af" />
              <TextInput
                value={studentSearch}
                onChangeText={setStudentSearch}
                onSubmitEditing={handleSearchStudents}
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="email-address"
                className="flex-1 py-3 ml-2 text-gray-900 text-base"
                returnKeyType="search"
              />
              {studentSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setStudentSearch('');
                    setSearchResults([]);
                    setHasSearchedStudents(false);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={handleSearchStudents}
              disabled={isSearchingStudents}
              className="bg-amber-500 rounded-xl py-3 items-center mb-4"
              style={{ opacity: isSearchingStudents ? 0.7 : 1 }}
            >
              {isSearchingStudents ? (
                <ActivityIndicator color="white" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="person-add-outline" size={18} color="white" />
                  <Text className="text-white font-bold ml-2">Buscar usuarios</Text>
                </View>
              )}
            </TouchableOpacity>

            {searchResults.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-700 font-semibold text-sm mb-2">
                  Resultados
                </Text>
                {searchResults.map((student) => {
                  const studentId = getEntityId(student);
                  const isBusy = activeStudentMutationId === studentId;
                  const alreadyEnrolled = enrolledStudents.some(
                    (candidate) => getEntityId(candidate) === studentId,
                  );

                  return (
                    <View
                      key={studentId}
                      className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-3 mb-2"
                    >
                      <View className="flex-row items-center">
                        <View className="flex-1 pr-3">
                          <Text className="text-gray-900 font-semibold text-sm">
                            {student.name || '(sin nombre)'}
                          </Text>
                          <Text className="text-gray-500 text-xs mt-0.5">
                            {student.email}
                          </Text>
                          <Text className="text-gray-400 text-[11px] mt-1 uppercase">
                            {normalizeRoleLabel(String(student.role || ''))}
                          </Text>
                        </View>
                        {alreadyEnrolled ? (
                          <View className="bg-emerald-100 px-3 py-2 rounded-xl">
                            <Text className="text-emerald-700 font-semibold text-xs">
                              Ya inscrito
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleEnrollStudent(student)}
                            disabled={isBusy || !seatCapabilities.canEnrollStudentInCourse}
                            className="bg-sky-600 px-3 py-2 rounded-xl"
                            style={{
                              opacity:
                                isBusy || !seatCapabilities.canEnrollStudentInCourse ? 0.7 : 1,
                            }}
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color="white" />
                            ) : (
                              <Text className="text-white font-semibold text-xs">
                                Matricular
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {hasSearchedStudents && !isSearchingStudents && searchResults.length === 0 && (
              <View className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl px-4 py-4 mb-4">
                <Text className="text-gray-600 text-sm">
                  No encontramos usuarios registrados con ese email.
                </Text>
              </View>
            )}

            <Text className="text-gray-700 font-semibold text-sm mb-2">
              Estudiantes inscritos
            </Text>
            {enrolledStudents.length === 0 ? (
              <View className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl px-4 py-4">
                <Text className="text-gray-500 text-sm">
                  Todavía no hay estudiantes inscritos en este curso.
                </Text>
              </View>
            ) : (
              enrolledStudents.map((student) => {
                const studentId = getEntityId(student);
                const isBusy = activeStudentMutationId === studentId;

                return (
                  <View
                    key={studentId}
                    className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-3 mb-2"
                  >
                    <View className="flex-row items-center">
                      <View className="flex-1 pr-3">
                        <Text className="text-gray-900 font-semibold text-sm">
                          {student.name || '(sin nombre)'}
                        </Text>
                        <Text className="text-gray-500 text-xs mt-0.5">
                          {student.email}
                        </Text>
                        <Text className="text-gray-400 text-[11px] mt-1">
                          {String((student as any).status || 'active').toLowerCase() === 'active'
                            ? 'Activo'
                            : 'Con estado restringido'}
                        </Text>
                      </View>
                      {seatCapabilities.canUnenrollStudentFromCourse && (
                        <TouchableOpacity
                          onPress={() => handleUnenrollStudent(student)}
                          disabled={isBusy}
                          className="bg-red-50 px-3 py-2 rounded-xl"
                          style={{ opacity: isBusy ? 0.7 : 1 }}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#dc2626" />
                          ) : (
                            <Text className="text-red-600 font-semibold text-xs">
                              Retirar
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

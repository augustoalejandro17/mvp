import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ICourse, ISchool, IUser } from '@inti/shared-types';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiClient,
  SeatPolicyCapabilities,
} from '@/services/apiClient';

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

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: '#dc2626', bg: '#fef2f2' },
  ADMIN: { label: 'Admin', color: '#9333ea', bg: '#faf5ff' },
  SCHOOL_OWNER: { label: 'Propietario', color: '#ea580c', bg: '#fff7ed' },
  TEACHER: { label: 'Profesor', color: '#2563eb', bg: '#eff6ff' },
  STUDENT: { label: 'Estudiante', color: '#16a34a', bg: '#f0fdf4' },
  UNREGISTERED: { label: 'Asistente', color: '#64748b', bg: '#f1f5f9' },
};

const ROLE_CHOICES = [
  { value: 'student', label: 'Estudiante' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'administrative', label: 'Administrativo' },
  { value: 'school_owner', label: 'Propietario' },
  { value: 'admin', label: 'Admin' },
];

const normalizeList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as any).items)
  ) {
    return (value as any).items as T[];
  }
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as any).data)
  ) {
    return (value as any).data as T[];
  }
  return [];
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
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

function UserRow({
  user,
  canOpenEnrollFlow,
  canOpenManageFlow,
  onOpenEnroll,
  onOpenManage,
}: {
  user: IUser;
  canOpenEnrollFlow: boolean;
  canOpenManageFlow: boolean;
  onOpenEnroll: (user: IUser) => void;
  onOpenManage: (user: IUser) => void;
}) {
  const role = ROLE_CONFIG[String(user.role || '').toUpperCase()] ?? {
    label: String(user.role || 'usuario'),
    color: '#6b7280',
    bg: '#f9fafb',
  };
  const normalizedStatus = String((user as any).status || 'active').toLowerCase();
  const isUserActive =
    (user as any).isActive !== false &&
    normalizedStatus !== 'suspended' &&
    normalizedStatus !== 'inactive';
  const initials = (user.name ?? user.email ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const isRegistered = String(user.role || '').toLowerCase() !== 'unregistered';

  return (
    <View
      className="flex-row items-center bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}
    >
      <View className="w-11 h-11 rounded-full bg-amber-100 justify-center items-center mr-3">
        <Text className="text-amber-700 font-bold text-base">{initials}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 font-semibold text-base" numberOfLines={1}>
          {user.name ?? '(sin nombre)'}
        </Text>
        <Text className="text-gray-500 text-sm" numberOfLines={1}>
          {user.email}
        </Text>
      </View>
      {canOpenEnrollFlow && isRegistered && (
        <TouchableOpacity
          onPress={() => onOpenEnroll(user)}
          className="p-2.5 rounded-xl mr-2"
          style={{ backgroundColor: '#dbeafe' }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="person-add-outline" size={16} color="#1d4ed8" />
        </TouchableOpacity>
      )}
      {canOpenManageFlow && (
        <TouchableOpacity
          onPress={() => onOpenManage(user)}
          className="p-2.5 rounded-xl mr-2"
          style={{ backgroundColor: '#f3f4f6' }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color="#4b5563" />
        </TouchableOpacity>
      )}
      <View
        className="px-2.5 py-1 rounded-full mr-2"
        style={{ backgroundColor: isUserActive ? '#ecfdf5' : '#fef2f2' }}
      >
        <Text
          className="text-xs font-semibold"
          style={{ color: isUserActive ? '#15803d' : '#b91c1c' }}
        >
          {isUserActive ? 'Activo' : 'Suspendido'}
        </Text>
      </View>
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: role.bg }}>
        <Text className="text-xs font-semibold" style={{ color: role.color }}>
          {role.label}
        </Text>
      </View>
    </View>
  );
}

export default function UsersScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();

  const [users, setUsers] = useState<IUser[]>([]);
  const [filtered, setFiltered] = useState<IUser[]>([]);
  const [schools, setSchools] = useState<ISchool[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [seatCapabilities, setSeatCapabilities] = useState<SeatPolicyCapabilities>(
    DEFAULT_CAPABILITIES,
  );

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [schoolCourses, setSchoolCourses] = useState<ICourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showManageUserModal, setShowManageUserModal] = useState(false);
  const [manageUserTarget, setManageUserTarget] = useState<IUser | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const currentUserId =
    (authUser as any)?._id || (authUser as any)?.id || (authUser as any)?.sub || '';
  const currentRole = String((authUser as any)?.role || '').toLowerCase();
  const canManageUsers = ['super_admin', 'admin', 'school_owner', 'administrative'].includes(currentRole);
  const canChangeRoles = currentRole === 'super_admin';
  const canOpenPlatformModule = currentRole === 'super_admin' || currentRole === 'admin';

  const loadUsers = useCallback(async () => {
    try {
      const [data, policy, schoolsData] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getSeatPolicy().catch(() => null),
        apiClient.getAllSchools().catch(() => [] as ISchool[]),
      ]);
      const list = normalizeList<IUser>(
        Array.isArray(data) ? data : (data as any).users ?? data,
      );
      const normalizedSchools = normalizeList<ISchool>(schoolsData);
      setUsers(list);
      setFiltered(list);
      setSchools(normalizedSchools);
      if (policy?.capabilities) {
        setSeatCapabilities(policy.capabilities);
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar la lista de usuarios');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(users);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      users.filter(
        (u) =>
          String(u.name || '')
            .toLowerCase()
            .includes(q) ||
          String(u.email || '')
            .toLowerCase()
            .includes(q) ||
          String(u.role || '')
            .toLowerCase()
            .includes(q),
      ),
    );
  }, [search, users]);

  useEffect(() => {
    const loadCourses = async () => {
      if (!showEnrollModal || !selectedSchoolId) {
        setSchoolCourses([]);
        return;
      }
      setIsLoadingCourses(true);
      try {
        const data = await apiClient.getCoursesBySchool(selectedSchoolId);
        const courses = normalizeList<ICourse>(data).filter(
          (course) => getEntityId(course).length > 0,
        );
        setSchoolCourses(courses);
      } catch {
        setSchoolCourses([]);
      } finally {
        setIsLoadingCourses(false);
      }
    };
    loadCourses();
  }, [showEnrollModal, selectedSchoolId]);

  const openEnrollModal = (target: IUser) => {
    setSelectedUser(target);
    setSelectedCourseId('');
    setSchoolCourses([]);
    const firstSchoolId = getEntityId(schools[0]);
    setSelectedSchoolId(firstSchoolId);
    setShowEnrollModal(true);
  };

  const closeEnrollModal = () => {
    setShowEnrollModal(false);
    setSelectedUser(null);
    setSelectedSchoolId('');
    setSelectedCourseId('');
    setSchoolCourses([]);
  };

  const openManageModal = (target: IUser) => {
    setManageUserTarget(target);
    setShowManageUserModal(true);
  };

  const applyUserPatch = (updated: IUser) => {
    setUsers((prev) =>
      prev.map((item) =>
        getEntityId(item) === getEntityId(updated) ? { ...item, ...updated } : item,
      ),
    );
  };

  const handleChangeUserStatus = async (
    status: 'active' | 'inactive' | 'suspended',
  ) => {
    const target = manageUserTarget;
    const targetId = getEntityId(target);
    if (!targetId) return;
    if (targetId === currentUserId) {
      Alert.alert(
        'Acción no permitida',
        'No puedes modificar tu propio estado desde esta pantalla.',
      );
      return;
    }
    setIsUpdatingUser(true);
    try {
      const updated = await apiClient.updateUserStatus(targetId, status);
      applyUserPatch(updated);
      Alert.alert('Listo', `Estado actualizado a ${status}.`);
      setShowManageUserModal(false);
      setManageUserTarget(null);
    } catch (error: any) {
      Alert.alert(
        'Error',
        toAlertMessage(
          error?.response?.data?.message || error?.message,
          'No se pudo actualizar el estado',
        ),
      );
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleChangeUserRole = async (role: string) => {
    const target = manageUserTarget;
    const targetId = getEntityId(target);
    if (!targetId) return;
    if (targetId === currentUserId) {
      Alert.alert(
        'Acción no permitida',
        'No puedes modificar tu propio rol desde esta pantalla.',
      );
      return;
    }
    setIsUpdatingUser(true);
    try {
      const updated = await apiClient.updateUserRole(targetId, role);
      applyUserPatch(updated);
      Alert.alert('Listo', `Rol actualizado a ${role}.`);
      setShowManageUserModal(false);
      setManageUserTarget(null);
    } catch (error: any) {
      Alert.alert(
        'Error',
        toAlertMessage(
          error?.response?.data?.message || error?.message,
          'No se pudo actualizar el rol',
        ),
      );
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleEnroll = async () => {
    const studentId = getEntityId(selectedUser);
    const safeSchoolId = String(selectedSchoolId || '').trim();
    const safeCourseId = String(selectedCourseId || '').trim();

    if (!studentId || !safeSchoolId || !safeCourseId) {
      Alert.alert('Error', 'Selecciona escuela y curso');
      return;
    }

    const selectedSchoolExists = schools.some(
      (school) => getEntityId(school) === safeSchoolId,
    );
    const selectedCourseExists = schoolCourses.some(
      (course) => getEntityId(course) === safeCourseId,
    );
    if (!selectedSchoolExists || !selectedCourseExists) {
      Alert.alert(
        'Error',
        'La escuela o el curso seleccionado no es válido. Vuelve a seleccionarlos.',
      );
      return;
    }

    setIsEnrolling(true);
    try {
      const policy = await apiClient.getSeatPolicy({
        schoolId: safeSchoolId,
        courseId: safeCourseId,
      });
      if (!policy.capabilities?.canEnrollStudentInCourse) {
        throw new Error('No tienes permisos para matricular en este curso');
      }

      if (policy.capabilities?.canAssignCourseSeatPermit) {
        await apiClient.assignCourseSeatPermit(
          studentId,
          safeSchoolId,
          safeCourseId,
        );
      }

      await apiClient.enrollStudentInCourse(safeCourseId, studentId);

      try {
        const updatedCourses = await apiClient.getEnrolledCoursesByUser(studentId);
        const updatedCourseIds = normalizeList<ICourse>(updatedCourses)
          .map((course) => getEntityId(course))
          .filter(Boolean);
        setUsers((prev) =>
          prev.map((row) =>
            getEntityId(row) === studentId
              ? {
                  ...row,
                  enrolledCourses: updatedCourseIds,
                }
              : row,
          ),
        );
      } catch {
        // non-blocking local refresh
      }

      let successMessage = 'Usuario matriculado correctamente.';
      if (currentRole === 'school_owner' && currentUserId) {
        try {
          const ownerQuota = await apiClient.getOwnerSeatQuota(
            currentUserId,
            safeSchoolId,
          );
          successMessage = `${successMessage} Cupos disponibles: ${ownerQuota.availableSeats}.`;
        } catch {
          // ignore quota fetch errors in success flow
        }
      }

      Alert.alert('Listo', successMessage);
      closeEnrollModal();
    } catch (error: any) {
      Alert.alert(
        'Error',
        toAlertMessage(
          error?.response?.data?.message || error?.message,
          'No se pudo matricular',
        ),
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <View className="flex-1 bg-amber-50">
      <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-xs opacity-80 mb-1">Gestión</Text>
          <Text className="text-white text-xl font-bold">Usuarios</Text>
        </View>
        <View className="bg-white/20 px-3 py-1.5 rounded-full">
          <Text className="text-white font-bold text-sm">{users.length}</Text>
        </View>
      </View>

      <View className="px-4 -mt-4 mb-3">
        {seatCapabilities.canViewSeatManagementModule && (
          <TouchableOpacity
            onPress={() => router.push('/manage/seats' as any)}
            className="bg-white rounded-2xl px-4 py-3 mb-3 flex-row items-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <Ionicons name="speedometer-outline" size={18} color="#0284c7" />
            <Text className="ml-2 text-gray-800 font-semibold flex-1">
              Gestión de Cupos
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}

        {canOpenPlatformModule && (
          <TouchableOpacity
            onPress={() => router.push('/manage/platform' as any)}
            className="bg-white rounded-2xl px-4 py-3 mb-3 flex-row items-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#334155" />
            <Text className="ml-2 text-gray-800 font-semibold flex-1">
              Control de plataforma
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}

        <View
          className="flex-row items-center bg-white rounded-2xl px-4 py-3 shadow-sm"
          style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
        >
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre, email o rol..."
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-2 text-gray-900 text-base"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u, index) =>
            getEntityId(u) || String(u.email || `${u.name || 'user'}-${index}`)
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              canOpenEnrollFlow={seatCapabilities.canOpenEnrollFlow}
              canOpenManageFlow={canManageUsers}
              onOpenEnroll={openEnrollModal}
              onOpenManage={openManageModal}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadUsers();
              }}
              tintColor="#f59e0b"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <Ionicons name="people-outline" size={48} color="#fbbf24" />
              <Text className="text-gray-500 mt-3 text-center">
                {search ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showEnrollModal}
        transparent
        animationType="slide"
        onRequestClose={closeEnrollModal}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={closeEnrollModal}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
              <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-4" />
              <Text className="text-base font-bold text-gray-900 mb-1">Matricular Usuario</Text>
              <Text className="text-xs text-gray-500 mb-4" numberOfLines={1}>
                {selectedUser?.name || selectedUser?.email}
              </Text>

              <Text className="text-gray-700 font-semibold text-sm mb-2">Escuela</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {schools.map((school) => {
                  const schoolId = getEntityId(school);
                  if (!schoolId) return null;
                  const active = selectedSchoolId === schoolId;
                  return (
                    <TouchableOpacity
                      key={schoolId}
                      onPress={() => {
                        setSelectedSchoolId(schoolId);
                        setSelectedCourseId('');
                      }}
                      className="px-3 py-2 rounded-xl mr-2"
                      style={{ backgroundColor: active ? '#f59e0b' : '#f3f4f6' }}
                    >
                      <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                        {school.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text className="text-gray-700 font-semibold text-sm mb-2">Curso</Text>
              {isLoadingCourses ? (
                <View className="py-3">
                  <ActivityIndicator color="#f59e0b" />
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  {schoolCourses.map((course) => {
                    const courseId = getEntityId(course);
                    if (!courseId) return null;
                    const active = selectedCourseId === courseId;
                    return (
                      <TouchableOpacity
                        key={courseId}
                        onPress={() => setSelectedCourseId(courseId)}
                        className="px-3 py-2 rounded-xl mr-2"
                        style={{ backgroundColor: active ? '#111827' : '#f3f4f6' }}
                      >
                        <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                          {course.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {schoolCourses.length === 0 && (
                    <View className="py-2">
                      <Text className="text-gray-400">No hay cursos en esta escuela.</Text>
                    </View>
                  )}
                </ScrollView>
              )}

              <TouchableOpacity
                disabled={!selectedSchoolId || !selectedCourseId || isEnrolling}
                onPress={handleEnroll}
                className="bg-amber-500 rounded-xl py-3 items-center"
                style={{
                  opacity:
                    !selectedSchoolId || !selectedCourseId || isEnrolling ? 0.6 : 1,
                }}
              >
                {isEnrolling ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">Matricular</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={closeEnrollModal}
                className="mt-3 py-3 bg-gray-100 rounded-xl items-center"
              >
                <Text className="text-gray-600 font-semibold">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showManageUserModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManageUserModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setShowManageUserModal(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
              <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-4" />
              <Text className="text-base font-bold text-gray-900 mb-1">Gestionar usuario</Text>
              <Text className="text-xs text-gray-500 mb-4" numberOfLines={1}>
                {manageUserTarget?.name || manageUserTarget?.email}
              </Text>

              <Text className="text-gray-700 font-semibold text-sm mb-2">Estado</Text>
              <View className="flex-row mb-4">
                <TouchableOpacity
                  disabled={isUpdatingUser}
                  onPress={() => handleChangeUserStatus('active')}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: '#ecfdf5' }}
                >
                  <Text style={{ color: '#166534', fontWeight: '600' }}>Activar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={isUpdatingUser}
                  onPress={() => handleChangeUserStatus('suspended')}
                  className="px-3 py-2 rounded-xl"
                  style={{ backgroundColor: '#fef2f2' }}
                >
                  <Text style={{ color: '#b91c1c', fontWeight: '600' }}>Suspender</Text>
                </TouchableOpacity>
              </View>

              {canChangeRoles ? (
                <>
                  <Text className="text-gray-700 font-semibold text-sm mb-2">Rol</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                    {ROLE_CHOICES.map((roleChoice) => (
                      <TouchableOpacity
                        key={roleChoice.value}
                        disabled={isUpdatingUser}
                        onPress={() => handleChangeUserRole(roleChoice.value)}
                        className="px-3 py-2 rounded-xl mr-2"
                        style={{ backgroundColor: '#f3f4f6' }}
                      >
                        <Text style={{ color: '#1f2937', fontWeight: '600' }}>
                          {roleChoice.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <TouchableOpacity
                onPress={() => setShowManageUserModal(false)}
                className="py-3 bg-gray-100 rounded-xl items-center"
              >
                <Text className="text-gray-600 font-semibold">Cerrar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

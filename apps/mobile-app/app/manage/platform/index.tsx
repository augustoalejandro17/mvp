import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ICourse, ISchool, IUser } from '@inti/shared-types';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, OwnerSeatQuota } from '@/services/apiClient';

const ROLE_OPTIONS = [
  { value: 'school_owner', label: 'Propietario' },
  { value: 'admin', label: 'Admin Escuela' },
  { value: 'administrative', label: 'Administrativo' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'student', label: 'Estudiante' },
];

const normalizeList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === 'object') {
    const candidates = [
      (value as any).items,
      (value as any).data,
      (value as any).results,
      (value as any).users,
      (value as any).schools,
      (value as any).courses,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }
  return [];
};

const getEntityId = (entity: any): string => {
  const raw = entity?._id ?? entity?.id;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.toString === 'function') {
    const value = String(raw.toString());
    return value === '[object Object]' ? '' : value;
  }
  return '';
};

const getCourseSchoolId = (course: ICourse): string => {
  const schoolValue = (course as any).school ?? (course as any).schoolId;
  if (typeof schoolValue === 'string') return schoolValue;
  if (schoolValue && typeof schoolValue === 'object') {
    return getEntityId(schoolValue);
  }
  return '';
};

const toErrorMessage = (error: any, fallback: string): string => {
  const message = error?.response?.data?.message || error?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string' && message.trim().length > 0) return message;
  return fallback;
};

export default function PlatformManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const currentRole = String((user as any)?.role || '').toLowerCase();
  const canManagePlatform = currentRole === 'super_admin' || currentRole === 'admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<IUser[]>([]);
  const [schools, setSchools] = useState<ISchool[]>([]);
  const [courses, setCourses] = useState<ICourse[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [search, setSearch] = useState('');

  const [selectedRoleUserId, setSelectedRoleUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('administrative');

  const [selectedTransferOwnerId, setSelectedTransferOwnerId] = useState('');

  const [selectedQuotaOwnerId, setSelectedQuotaOwnerId] = useState('');
  const [quotaValue, setQuotaValue] = useState('0');
  const [ownerQuota, setOwnerQuota] = useState<OwnerSeatQuota | null>(null);

  const [selectedSeatUserId, setSelectedSeatUserId] = useState('');
  const [selectedSeatCourseId, setSelectedSeatCourseId] = useState('');
  const [selectedSeatOwnerId, setSelectedSeatOwnerId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [usersData, schoolsData, coursesData] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getAllSchools(),
        apiClient.getCourses(),
      ]);

      const normalizedUsers = normalizeList<IUser>(usersData);
      const normalizedSchools = normalizeList<ISchool>(schoolsData);
      const normalizedCourses = normalizeList<ICourse>(coursesData);

      setUsers(normalizedUsers);
      setSchools(normalizedSchools);
      setCourses(normalizedCourses);

      if (!selectedSchoolId && normalizedSchools.length > 0) {
        const firstSchool = getEntityId(normalizedSchools[0]);
        setSelectedSchoolId(firstSchool);
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el módulo de plataforma');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedSchool = useMemo(
    () => schools.find((school) => getEntityId(school) === selectedSchoolId) || null,
    [schools, selectedSchoolId],
  );

  const currentOwnerId = useMemo(() => {
    const adminValue = (selectedSchool as any)?.admin;
    if (!adminValue) return '';
    if (typeof adminValue === 'string') return adminValue;
    return getEntityId(adminValue);
  }, [selectedSchool]);

  const schoolCourses = useMemo(
    () => courses.filter((course) => getCourseSchoolId(course) === selectedSchoolId),
    [courses, selectedSchoolId],
  );

  const schoolUsers = useMemo(() => {
    if (!selectedSchoolId) return [];
    return users.filter((row) => {
      const inSchools = row.schools?.some((id: any) => String(id) === selectedSchoolId);
      const inRoles = row.schoolRoles?.some(
        (item: any) => String(item.schoolId) === selectedSchoolId,
      );
      const asOwner = row.ownedSchools?.some((id: any) => String(id) === selectedSchoolId);
      const asAdmin = row.administratedSchools?.some(
        (id: any) => String(id) === selectedSchoolId,
      );
      return !!(inSchools || inRoles || asOwner || asAdmin);
    });
  }, [users, selectedSchoolId]);

  const searchableUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = schoolUsers.length > 0 ? schoolUsers : users;
    if (!term) return base;
    return base.filter((row) => {
      const name = String(row.name || '').toLowerCase();
      const email = String(row.email || '').toLowerCase();
      const role = String(row.role || '').toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }, [users, schoolUsers, search]);

  const ownerCandidates = useMemo(
    () => searchableUsers.filter((row) => String(row.role || '') !== 'unregistered'),
    [searchableUsers],
  );

  const ownersInSchool = useMemo(
    () =>
      users.filter((row) => {
        const isOwnerRole = String(row.role || '').toLowerCase() === 'school_owner';
        if (!isOwnerRole) return false;
        const inOwned = row.ownedSchools?.some((id: any) => String(id) === selectedSchoolId);
        const inSchoolRoles = row.schoolRoles?.some(
          (item: any) =>
            String(item.schoolId) === selectedSchoolId &&
            String(item.role || '').toLowerCase() === 'school_owner',
        );
        return !!(inOwned || inSchoolRoles);
      }),
    [users, selectedSchoolId],
  );

  const studentCandidates = useMemo(
    () =>
      searchableUsers.filter((row) => {
        const role = String(row.role || '').toLowerCase();
        return role === 'student' || role === 'unregistered';
      }),
    [searchableUsers],
  );

  useEffect(() => {
    const exists = ownerCandidates.some(
      (row) => getEntityId(row) === selectedTransferOwnerId,
    );
    if (!exists) {
      setSelectedTransferOwnerId(
        ownerCandidates.length > 0 ? getEntityId(ownerCandidates[0]) : '',
      );
    }
  }, [ownerCandidates, selectedTransferOwnerId]);

  useEffect(() => {
    const exists = searchableUsers.some(
      (row) => getEntityId(row) === selectedRoleUserId,
    );
    if (!exists) {
      setSelectedRoleUserId(
        searchableUsers.length > 0 ? getEntityId(searchableUsers[0]) : '',
      );
    }
  }, [searchableUsers, selectedRoleUserId]);

  useEffect(() => {
    const exists = ownersInSchool.some(
      (row) => getEntityId(row) === selectedQuotaOwnerId,
    );
    if (!exists) {
      setSelectedQuotaOwnerId(
        ownersInSchool.length > 0 ? getEntityId(ownersInSchool[0]) : '',
      );
    }
  }, [ownersInSchool, selectedQuotaOwnerId]);

  useEffect(() => {
    const exists = studentCandidates.some(
      (row) => getEntityId(row) === selectedSeatUserId,
    );
    if (!exists) {
      setSelectedSeatUserId(
        studentCandidates.length > 0 ? getEntityId(studentCandidates[0]) : '',
      );
    }
  }, [studentCandidates, selectedSeatUserId]);

  useEffect(() => {
    const exists = schoolCourses.some(
      (row) => getEntityId(row) === selectedSeatCourseId,
    );
    if (!exists) {
      setSelectedSeatCourseId(
        schoolCourses.length > 0 ? getEntityId(schoolCourses[0]) : '',
      );
    }
  }, [schoolCourses, selectedSeatCourseId]);

  useEffect(() => {
    const loadQuota = async () => {
      if (!selectedQuotaOwnerId || !selectedSchoolId) {
        setOwnerQuota(null);
        setQuotaValue('0');
        return;
      }
      try {
        const quota = await apiClient.getOwnerSeatQuota(selectedQuotaOwnerId, selectedSchoolId);
        setOwnerQuota(quota);
        setQuotaValue(String(quota.totalSeats || 0));
      } catch {
        setOwnerQuota(null);
        setQuotaValue('0');
      }
    };
    loadQuota();
  }, [selectedQuotaOwnerId, selectedSchoolId]);

  const handleTransferOwner = async () => {
    if (!selectedSchoolId || !selectedTransferOwnerId) {
      Alert.alert('Error', 'Selecciona escuela y nuevo propietario');
      return;
    }
    setSaving(true);
    try {
      await apiClient.assignSchoolOwner(selectedSchoolId, selectedTransferOwnerId);
      Alert.alert('Listo', 'Propietario de escuela actualizado');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', toErrorMessage(error, 'No se pudo transferir propietario'));
    } finally {
      setSaving(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedSchoolId || !selectedRoleUserId || !selectedRole) {
      Alert.alert('Error', 'Selecciona escuela, usuario y rol');
      return;
    }
    setSaving(true);
    try {
      await apiClient.assignRoleInSchool(selectedRoleUserId, selectedSchoolId, selectedRole);
      Alert.alert('Listo', 'Rol asignado correctamente');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', toErrorMessage(error, 'No se pudo asignar el rol'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRole = async () => {
    if (!selectedSchoolId || !selectedRoleUserId || !selectedRole) {
      Alert.alert('Error', 'Selecciona escuela, usuario y rol');
      return;
    }
    setSaving(true);
    try {
      await apiClient.removeRoleInSchool(selectedRoleUserId, selectedSchoolId, selectedRole);
      Alert.alert('Listo', 'Rol removido correctamente');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', toErrorMessage(error, 'No se pudo remover el rol'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuota = async () => {
    if (!selectedQuotaOwnerId || !selectedSchoolId) {
      Alert.alert('Error', 'Selecciona escuela y propietario');
      return;
    }
    const totalSeats = Number(quotaValue || 0);
    if (!Number.isFinite(totalSeats) || totalSeats < 0) {
      Alert.alert('Error', 'Cantidad de cupos inválida');
      return;
    }
    setSaving(true);
    try {
      const updated = await apiClient.setOwnerSeatQuota(
        selectedQuotaOwnerId,
        selectedSchoolId,
        Math.floor(totalSeats),
      );
      setOwnerQuota(updated);
      setQuotaValue(String(updated.totalSeats));
      Alert.alert('Listo', 'Cuota de cupos actualizada');
    } catch (error: any) {
      Alert.alert('Error', toErrorMessage(error, 'No se pudo actualizar la cuota'));
    } finally {
      setSaving(false);
    }
  };

  const handleAssignSeat = async () => {
    if (!selectedSchoolId || !selectedSeatUserId || !selectedSeatCourseId) {
      Alert.alert('Error', 'Selecciona escuela, estudiante y curso');
      return;
    }
    setSaving(true);
    try {
      await apiClient.assignCourseSeatPermit(
        selectedSeatUserId,
        selectedSchoolId,
        selectedSeatCourseId,
        selectedSeatOwnerId || undefined,
      );
      Alert.alert('Listo', 'Seat asignado correctamente');
    } catch (error: any) {
      Alert.alert('Error', toErrorMessage(error, 'No se pudo asignar el seat'));
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSeat = async () => {
    if (!selectedSchoolId || !selectedSeatUserId || !selectedSeatCourseId) {
      Alert.alert('Error', 'Selecciona escuela, estudiante y curso');
      return;
    }
    setSaving(true);
    try {
      await apiClient.revokeCourseSeatPermit(
        selectedSeatUserId,
        selectedSchoolId,
        selectedSeatCourseId,
      );
      Alert.alert('Listo', 'Seat revocado correctamente');
    } catch (error: any) {
      Alert.alert('Error', toErrorMessage(error, 'No se pudo revocar el seat'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-amber-50 justify-center items-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!canManagePlatform) {
    return (
      <View className="flex-1 bg-amber-50">
        <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Gestión</Text>
            <Text className="text-white text-xl font-bold">Plataforma</Text>
          </View>
        </View>
        <View className="px-4 py-6">
          <View className="bg-white rounded-2xl p-4">
            <Text className="text-gray-900 font-semibold">
              Solo super admin o admin pueden usar este módulo.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-amber-50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor="#f59e0b"
        />
      }
    >
      <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-xs opacity-80 mb-1">Gestión</Text>
          <Text className="text-white text-xl font-bold">Plataforma</Text>
        </View>
      </View>

      <View className="px-4 -mt-4 pb-8">
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-3">Escuela</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {schools.map((school) => {
              const schoolId = getEntityId(school);
              const active = schoolId === selectedSchoolId;
              return (
                <TouchableOpacity
                  key={schoolId}
                  onPress={() => setSelectedSchoolId(schoolId)}
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
        </View>

        <View
          className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-4"
          style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}
        >
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar usuario por nombre/email..."
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-2 text-gray-900 text-base"
          />
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Transferir School Owner</Text>
          <Text className="text-xs text-gray-500 mb-3">
            Owner actual:{' '}
            <Text className="font-semibold text-gray-700">
              {users.find((row) => getEntityId(row) === currentOwnerId)?.name || 'Sin owner'}
            </Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {ownerCandidates.map((row) => {
              const id = getEntityId(row);
              const active = id === selectedTransferOwnerId;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setSelectedTransferOwnerId(id)}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: active ? '#111827' : '#f3f4f6' }}
                >
                  <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                    {row.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            onPress={handleTransferOwner}
            disabled={!selectedTransferOwnerId || saving}
            className="bg-amber-500 rounded-xl py-3 items-center"
            style={{ opacity: !selectedTransferOwnerId || saving ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">Transferir Propietario</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">
            Asignar / Quitar Rol por Escuela
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {searchableUsers.map((row) => {
              const id = getEntityId(row);
              const active = id === selectedRoleUserId;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setSelectedRoleUserId(id)}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: active ? '#111827' : '#f3f4f6' }}
                >
                  <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                    {row.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {ROLE_OPTIONS.map((option) => {
              const active = option.value === selectedRole;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setSelectedRole(option.value)}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: active ? '#f59e0b' : '#f3f4f6' }}
                >
                  <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View className="flex-row">
            <TouchableOpacity
              onPress={handleAssignRole}
              disabled={!selectedRoleUserId || saving}
              className="flex-1 bg-amber-500 rounded-xl py-3 items-center mr-2"
              style={{ opacity: !selectedRoleUserId || saving ? 0.6 : 1 }}
            >
              <Text className="text-white font-bold">Asignar Rol</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRemoveRole}
              disabled={!selectedRoleUserId || saving}
              className="flex-1 bg-gray-200 rounded-xl py-3 items-center"
              style={{ opacity: !selectedRoleUserId || saving ? 0.6 : 1 }}
            >
              <Text className="text-gray-800 font-bold">Quitar Rol</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Cuotas de Seats por Owner</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {ownersInSchool.map((owner) => {
              const ownerId = getEntityId(owner);
              const active = ownerId === selectedQuotaOwnerId;
              return (
                <TouchableOpacity
                  key={ownerId}
                  onPress={() => setSelectedQuotaOwnerId(ownerId)}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: active ? '#111827' : '#f3f4f6' }}
                >
                  <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                    {owner.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text className="text-xs text-gray-500 mb-1">
            Total: {ownerQuota?.totalSeats ?? 0} | Usados: {ownerQuota?.usedSeats ?? 0} |
            Disponibles: {ownerQuota?.availableSeats ?? 0}
          </Text>
          <TextInput
            keyboardType="numeric"
            value={quotaValue}
            onChangeText={setQuotaValue}
            placeholder="Total de cupos"
            placeholderTextColor="#9ca3af"
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base mb-3"
          />
          <TouchableOpacity
            onPress={handleSaveQuota}
            disabled={!selectedQuotaOwnerId || saving}
            className="bg-amber-500 rounded-xl py-3 items-center"
            style={{ opacity: !selectedQuotaOwnerId || saving ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">Guardar Cuota</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-2xl p-4">
          <Text className="text-gray-900 font-bold text-base mb-2">
            Asignar / Revocar Seat a Estudiante
          </Text>
          <Text className="text-xs text-gray-500 mb-2">
            Esta acción controla cupos por curso para matrículas.
          </Text>

          <Text className="text-xs text-gray-600 mb-1">Estudiante</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {studentCandidates.map((row) => {
              const id = getEntityId(row);
              const active = id === selectedSeatUserId;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setSelectedSeatUserId(id)}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: active ? '#111827' : '#f3f4f6' }}
                >
                  <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                    {row.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text className="text-xs text-gray-600 mb-1">Curso</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {schoolCourses.map((course) => {
              const id = getEntityId(course);
              const active = id === selectedSeatCourseId;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setSelectedSeatCourseId(id)}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: active ? '#f59e0b' : '#f3f4f6' }}
                >
                  <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                    {course.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text className="text-xs text-gray-600 mb-1">Owner (opcional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <TouchableOpacity
              onPress={() => setSelectedSeatOwnerId('')}
              className="px-3 py-2 rounded-xl mr-2"
              style={{ backgroundColor: selectedSeatOwnerId ? '#f3f4f6' : '#111827' }}
            >
              <Text
                style={{
                  color: selectedSeatOwnerId ? '#374151' : 'white',
                  fontWeight: '600',
                }}
              >
                Automático
              </Text>
            </TouchableOpacity>
            {ownersInSchool.map((owner) => {
              const ownerId = getEntityId(owner);
              const active = ownerId === selectedSeatOwnerId;
              return (
                <TouchableOpacity
                  key={ownerId}
                  onPress={() => setSelectedSeatOwnerId(ownerId)}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: active ? '#111827' : '#f3f4f6' }}
                >
                  <Text style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}>
                    {owner.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View className="flex-row">
            <TouchableOpacity
              onPress={handleAssignSeat}
              disabled={!selectedSeatUserId || !selectedSeatCourseId || saving}
              className="flex-1 bg-amber-500 rounded-xl py-3 items-center mr-2"
              style={{
                opacity: !selectedSeatUserId || !selectedSeatCourseId || saving ? 0.6 : 1,
              }}
            >
              <Text className="text-white font-bold">Asignar Seat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRevokeSeat}
              disabled={!selectedSeatUserId || !selectedSeatCourseId || saving}
              className="flex-1 bg-gray-200 rounded-xl py-3 items-center"
              style={{
                opacity: !selectedSeatUserId || !selectedSeatCourseId || saving ? 0.6 : 1,
              }}
            >
              <Text className="text-gray-800 font-bold">Revocar Seat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

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
import { ISchool, IUser } from '@inti/shared-types';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/apiClient';

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

  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [search, setSearch] = useState('');

  const [selectedRoleUserId, setSelectedRoleUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('administrative');

  const [selectedTransferOwnerId, setSelectedTransferOwnerId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [usersData, schoolsData] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getAllSchools(),
      ]);

      const normalizedUsers = normalizeList<IUser>(usersData);
      const normalizedSchools = normalizeList<ISchool>(schoolsData);

      setUsers(normalizedUsers);
      setSchools(normalizedSchools);

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

  const searchableUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = users;
    if (!term) return base;
    return base.filter((row) => {
      const name = String(row.name || '').toLowerCase();
      const email = String(row.email || '').toLowerCase();
      const role = String(row.role || '').toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }, [users, search]);

  const ownerCandidates = useMemo(
    () => searchableUsers.filter((row) => String(row.role || '') !== 'unregistered'),
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

        <TouchableOpacity
          onPress={() => router.push('/manage/seats' as any)}
          className="bg-white rounded-2xl p-4 mb-4 flex-row items-center"
          style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}
        >
          <View
            className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
            style={{ backgroundColor: '#fef3c7' }}
          >
            <Ionicons name="speedometer-outline" size={20} color="#d97706" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-bold text-base">Gestión de Cupos</Text>
            <Text className="text-gray-500 text-xs mt-1">
              Cuotas, asignación, revocación y distribución de seats ahora viven solo aquí.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Transferir School Owner</Text>
          <Text className="text-xs text-gray-500 mb-3">
            Owner actual:{' '}
            <Text className="font-semibold text-gray-700">
              {users.find((row) => getEntityId(row) === currentOwnerId)?.name || 'Sin owner'}
            </Text>
          </Text>
          <Text className="text-xs text-gray-500 mb-3">
            Puedes seleccionar cualquier usuario del sistema. Si no pertenece a esta escuela,
            se vinculara automaticamente al transferir la propiedad.
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
          <Text className="text-xs text-gray-500 mb-3">
            La asignacion agrega al usuario a la escuela si todavia no pertenece a ella.
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
      </View>
    </ScrollView>
  );
}

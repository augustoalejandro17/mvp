import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IUser, ISchool } from '@inti/shared-types';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiClient,
  OwnerSeatQuota,
  SeatPolicyCapabilities,
} from '@/services/apiClient';

type ExtendedUser = IUser & {
  courseSeatGrants?: Array<{
    schoolId?: string;
    courseId?: string;
    assignedBy?: string;
    isActive?: boolean;
    isConsumed?: boolean;
  }>;
};

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

const normalizeList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === 'object') {
    const candidates = [
      (value as any).items,
      (value as any).data,
      (value as any).results,
      (value as any).schools,
      (value as any).users,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }
  }
  return [];
};

export default function SeatsManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const currentUserId =
    (user as any)?._id || (user as any)?.id || (user as any)?.sub || '';
  const currentRole = String((user as any)?.role || '').toLowerCase();

  const [schools, setSchools] = useState<ISchool[]>([]);
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [quota, setQuota] = useState<OwnerSeatQuota | null>(null);
  const [quotaValue, setQuotaValue] = useState('0');
  const [capabilities, setCapabilities] = useState<SeatPolicyCapabilities>(
    DEFAULT_CAPABILITIES,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingQuota, setSavingQuota] = useState(false);

  const loadBaseData = useCallback(async () => {
    try {
      const [schoolsData, usersData] = await Promise.all([
        apiClient.getAllSchools(),
        apiClient.getUsers(),
      ]);
      const normalizedSchools = normalizeList<ISchool>(schoolsData);
      const normalizedUsers = normalizeList<ExtendedUser>(usersData);

      setSchools(normalizedSchools);
      setUsers(normalizedUsers);

      if (normalizedSchools.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(String((normalizedSchools[0] as any)._id || ''));
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el módulo de cupos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        const policy = await apiClient.getSeatPolicy({
          schoolId: selectedSchoolId || undefined,
        });
        setCapabilities(policy.capabilities || DEFAULT_CAPABILITIES);
      } catch {
        setCapabilities(DEFAULT_CAPABILITIES);
      }
    };
    loadPolicy();
  }, [selectedSchoolId]);

  const ownersForSchool = useMemo(() => {
    if (!selectedSchoolId) return [];
    const list = users.filter((row) => {
      const role = String(row.role || '').toLowerCase();
      if (role !== 'school_owner') return false;
      const inOwnedSchools =
        row.ownedSchools?.some((id) => String(id) === selectedSchoolId) || false;
      const inSchoolRoles =
        row.schoolRoles?.some(
          (item) =>
            String(item.schoolId) === selectedSchoolId &&
            String(item.role || '').toLowerCase() === 'school_owner',
        ) || false;
      return inOwnedSchools || inSchoolRoles;
    });
    return list;
  }, [users, selectedSchoolId]);

  useEffect(() => {
    if (!selectedSchoolId) {
      setSelectedOwnerId('');
      return;
    }

    if (currentRole === 'school_owner' && currentUserId) {
      setSelectedOwnerId(currentUserId);
      return;
    }

    if (!selectedOwnerId && ownersForSchool.length > 0) {
      setSelectedOwnerId(String(ownersForSchool[0]._id || ''));
    }
  }, [
    currentRole,
    currentUserId,
    selectedSchoolId,
    selectedOwnerId,
    ownersForSchool,
  ]);

  useEffect(() => {
    const loadQuota = async () => {
      if (!selectedSchoolId || !selectedOwnerId) {
        setQuota(null);
        setQuotaValue('0');
        return;
      }

      if (!capabilities.canReadOwnerQuota) {
        setQuota(null);
        setQuotaValue('0');
        return;
      }

      try {
        const data = await apiClient.getOwnerSeatQuota(
          selectedOwnerId,
          selectedSchoolId,
        );
        setQuota(data);
        setQuotaValue(String(data.totalSeats || 0));
      } catch {
        setQuota(null);
        setQuotaValue('0');
      }
    };

    loadQuota();
  }, [selectedSchoolId, selectedOwnerId, capabilities.canReadOwnerQuota]);

  const distributionRows = useMemo(() => {
    if (!selectedSchoolId || !selectedOwnerId) return [];
    return users
      .map((target) => {
        const grants = (target.courseSeatGrants || []).filter(
          (grant) =>
            grant?.isActive === true &&
            String(grant.schoolId || '') === selectedSchoolId &&
            String(grant.assignedBy || '') === selectedOwnerId,
        );
        if (grants.length === 0) return null;
        return {
          userId: String(target._id || ''),
          userName: target.name || '(sin nombre)',
          permits: grants.length,
          consumedSeats: grants.filter((grant) => grant.isConsumed === true)
            .length,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.consumedSeats - a.consumedSeats);
  }, [users, selectedSchoolId, selectedOwnerId]);

  const onSaveQuota = async () => {
    if (!selectedOwnerId || !selectedSchoolId) return;
    if (!capabilities.canSetOwnerQuota) {
      Alert.alert('Sin permisos', 'No puedes configurar cupos');
      return;
    }

    const totalSeats = Math.max(0, Number(quotaValue || 0));
    if (!Number.isFinite(totalSeats)) {
      Alert.alert('Error', 'Total de cupos inválido');
      return;
    }

    try {
      setSavingQuota(true);
      const updated = await apiClient.setOwnerSeatQuota(
        selectedOwnerId,
        selectedSchoolId,
        totalSeats,
      );
      setQuota(updated);
      setQuotaValue(String(updated.totalSeats || 0));
      Alert.alert('Listo', 'Cupos actualizados');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'No se pudo actualizar la cuota',
      );
    } finally {
      setSavingQuota(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-amber-50 justify-center items-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!capabilities.canViewSeatManagementModule) {
    return (
      <View className="flex-1 bg-amber-50">
        <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Gestión</Text>
            <Text className="text-white text-xl font-bold">Cupos</Text>
          </View>
        </View>
        <View className="px-5 py-8">
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-base font-semibold text-gray-900">
              No tienes permisos para este módulo.
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
            loadBaseData();
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
          <Text className="text-white text-xl font-bold">Cupos</Text>
        </View>
      </View>

      <View className="px-4 -mt-4 pb-6">
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-3">Escuela</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {schools.map((school) => {
              const schoolId = String((school as any)._id || '');
              const active = schoolId === selectedSchoolId;
              return (
                <TouchableOpacity
                  key={schoolId}
                  onPress={() => setSelectedSchoolId(schoolId)}
                  className="px-3 py-2 rounded-xl mr-2"
                  style={{ backgroundColor: active ? '#f59e0b' : '#f3f4f6' }}
                >
                  <Text
                    style={{ color: active ? 'white' : '#374151', fontWeight: '600' }}
                  >
                    {school.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-3">
            Dueño de Escuela
          </Text>
          {ownersForSchool.length === 0 ? (
            <Text className="text-gray-500">No hay dueños para esta escuela.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {ownersForSchool.map((owner) => {
                const ownerId = String(owner._id || '');
                const active = ownerId === selectedOwnerId;
                return (
                  <TouchableOpacity
                    key={ownerId}
                    onPress={() => setSelectedOwnerId(ownerId)}
                    className="px-3 py-2 rounded-xl mr-2"
                    style={{ backgroundColor: active ? '#111827' : '#f3f4f6' }}
                  >
                    <Text
                      style={{
                        color: active ? 'white' : '#374151',
                        fontWeight: '600',
                      }}
                    >
                      {owner.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {capabilities.canReadOwnerQuota && (
          <View className="bg-white rounded-2xl p-4 mb-4">
            <Text className="text-gray-900 font-bold text-base mb-3">
              Estado de Cupos
            </Text>
            <Text className="text-gray-700 mb-1">
              Total: <Text className="font-bold">{quota?.totalSeats ?? 0}</Text>
            </Text>
            <Text className="text-gray-700 mb-1">
              Usados: <Text className="font-bold">{quota?.usedSeats ?? 0}</Text>
            </Text>
            <Text className="text-gray-700">
              Disponibles:{' '}
              <Text className="font-bold">{quota?.availableSeats ?? 0}</Text>
            </Text>
          </View>
        )}

        {capabilities.canSetOwnerQuota && (
          <View className="bg-white rounded-2xl p-4 mb-4">
            <Text className="text-gray-900 font-bold text-base mb-3">
              Configurar Cuota
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
              disabled={!selectedOwnerId || !selectedSchoolId || savingQuota}
              onPress={onSaveQuota}
              className="bg-amber-500 rounded-xl py-3 items-center"
              style={{
                opacity:
                  !selectedOwnerId || !selectedSchoolId || savingQuota ? 0.6 : 1,
              }}
            >
              {savingQuota ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold">Guardar Cupos</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View className="bg-white rounded-2xl p-4">
          <Text className="text-gray-900 font-bold text-base mb-3">
            Distribución de Cupos
          </Text>
          {distributionRows.length === 0 ? (
            <Text className="text-gray-500">
              No hay cupos repartidos para este dueño.
            </Text>
          ) : (
            <View>
              {distributionRows.map((row: any) => (
                <View
                  key={row.userId}
                  className="py-3 border-b border-gray-100 flex-row items-center"
                >
                  <View className="flex-1">
                    <Text className="text-gray-900 font-medium">{row.userName}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-gray-500">
                      Permisos: <Text className="font-semibold">{row.permits}</Text>
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Consumidos:{' '}
                      <Text className="font-semibold">{row.consumedSeats}</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

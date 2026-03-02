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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import { IUser } from '@inti/shared-types';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: '#dc2626', bg: '#fef2f2' },
  ADMIN: { label: 'Admin', color: '#9333ea', bg: '#faf5ff' },
  SCHOOL_OWNER: { label: 'Propietario', color: '#ea580c', bg: '#fff7ed' },
  TEACHER: { label: 'Profesor', color: '#2563eb', bg: '#eff6ff' },
  STUDENT: { label: 'Estudiante', color: '#16a34a', bg: '#f0fdf4' },
};

function UserRow({ user }: { user: IUser }) {
  const role = ROLE_CONFIG[user.role ?? ''] ?? { label: user.role, color: '#6b7280', bg: '#f9fafb' };
  const initials = (user.name ?? user.email ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
  const [users, setUsers] = useState<IUser[]>([]);
  const [filtered, setFiltered] = useState<IUser[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiClient.getUsers();
      const list = Array.isArray(data) ? data : (data as any).users ?? [];
      setUsers(list);
      setFiltered(list);
    } catch (e: any) {
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
    } else {
      const q = search.toLowerCase();
      setFiltered(
        users.filter(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.role?.toLowerCase().includes(q),
        ),
      );
    }
  }, [search, users]);

  return (
    <View className="flex-1 bg-amber-50">
      {/* Header */}
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
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
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
          keyExtractor={(u) => u._id ?? u.email ?? Math.random().toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => <UserRow user={item} />}
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
    </View>
  );
}

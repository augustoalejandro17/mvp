import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/contexts/AuthContext';

interface StatCard {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  bg: string;
}

function StatCard({ label, value, icon, color, bg }: StatCard) {
  return (
    <View className="flex-1 rounded-2xl p-4 mr-3 mb-3" style={{ backgroundColor: bg, minWidth: 140 }}>
      <View className="w-10 h-10 rounded-xl justify-center items-center mb-3" style={{ backgroundColor: color + '22' }}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500 mt-1">{label}</Text>
    </View>
  );
}

function QuickAction({ label, icon, onPress, color }: { label: string; icon: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center bg-white rounded-2xl p-4 mb-3 shadow-sm"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}
    >
      <View className="w-10 h-10 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: color + '15' }}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text className="flex-1 text-gray-800 font-medium text-base">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </TouchableOpacity>
  );
}

export default function AdminPanelScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiClient.getAdminStats();
      setStats(data);
    } catch (e) {
      // fail silently - stats are extra info
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadStats();
  };

  const statsCards: StatCard[] = [
    {
      label: 'Usuarios',
      value: stats.totalUsers ?? stats.users ?? '—',
      icon: 'people',
      color: '#3b82f6',
      bg: '#eff6ff',
    },
    {
      label: 'Estudiantes',
      value: stats.totalStudents ?? stats.students ?? '—',
      icon: 'school',
      color: '#8b5cf6',
      bg: '#f5f3ff',
    },
    {
      label: 'Profesores',
      value: stats.totalTeachers ?? stats.teachers ?? '—',
      icon: 'person',
      color: '#ec4899',
      bg: '#fdf2f8',
    },
    {
      label: 'Escuelas',
      value: stats.totalSchools ?? stats.schools ?? '—',
      icon: 'business',
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      label: 'Cursos',
      value: stats.totalCourses ?? stats.courses ?? '—',
      icon: 'book',
      color: '#10b981',
      bg: '#ecfdf5',
    },
    {
      label: 'Clases',
      value: stats.totalClasses ?? stats.classes ?? '—',
      icon: 'videocam',
      color: '#ef4444',
      bg: '#fef2f2',
    },
  ];

  return (
    <ScrollView
      className="flex-1 bg-amber-50"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
    >
      {/* Header */}
      <View className="bg-amber-500 px-5 pt-5 pb-8">
        <Text className="text-white text-xs font-medium opacity-80 mb-1">Panel de Control</Text>
        <Text className="text-white text-2xl font-bold">Bienvenido, {user?.name?.split(' ')[0]}</Text>
        <Text className="text-amber-100 text-sm mt-1 capitalize">{user?.role?.replace('_', ' ')}</Text>
      </View>

      <View className="px-4 -mt-4">
        {/* Stats */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
          <Text className="text-gray-900 font-bold text-base mb-3">Resumen General</Text>
          {isLoading ? (
            <ActivityIndicator color="#f59e0b" className="py-4" />
          ) : (
            <View className="flex-row flex-wrap -mr-3">
              {statsCards.map((card) => (
                <View key={card.label} style={{ width: '47%', marginRight: '3%', marginBottom: 10 }}>
                  <StatCard {...card} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Manage Schools */}
        <Text className="text-gray-700 font-bold text-sm uppercase tracking-wide mb-2 mt-1 px-1">Gestión de Escuelas</Text>
        <QuickAction
          label="Ver todas las escuelas"
          icon="business-outline"
          color="#f59e0b"
          onPress={() => router.push('/(tabs)/home')}
        />
        <QuickAction
          label="Crear nueva escuela"
          icon="add-circle-outline"
          color="#10b981"
          onPress={() => router.push('/manage/school/new')}
        />

        {/* Manage Courses */}
        <Text className="text-gray-700 font-bold text-sm uppercase tracking-wide mb-2 mt-3 px-1">Gestión de Cursos</Text>
        <QuickAction
          label="Explorar cursos"
          icon="book-outline"
          color="#8b5cf6"
          onPress={() => router.push('/(tabs)/home')}
        />

        {/* Manage Users */}
        <Text className="text-gray-700 font-bold text-sm uppercase tracking-wide mb-2 mt-3 px-1">Usuarios</Text>
        <QuickAction
          label="Ver usuarios"
          icon="people-outline"
          color="#3b82f6"
          onPress={() => router.push('/manage/users')}
        />
        <QuickAction
          label="Moderar denuncias"
          icon="flag-outline"
          color="#dc2626"
          onPress={() => router.push('/manage/reports' as any)}
        />
        <QuickAction
          label="Moderar denuncias de usuarios"
          icon="person-remove-outline"
          color="#7c3aed"
          onPress={() => router.push('/manage/user-reports' as any)}
        />

        <View className="h-8" />
      </View>
    </ScrollView>
  );
}

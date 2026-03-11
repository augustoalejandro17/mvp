import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, CourseProgressSummary } from '@/services/apiClient';
import { ICourse } from '@inti/shared-types';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const normalizeList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === 'object') {
    const candidates = [
      (value as any).items,
      (value as any).data,
      (value as any).results,
      (value as any).progress,
      (value as any).courses,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }
  }
  return [];
};

function ProgressBar({ percentage, color = '#d97706' }: { percentage: number; color?: string }) {
  const barWidth = (width - 64) * Math.min(percentage / 100, 1);
  return (
    <View className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
      <View
        style={{ width: barWidth, backgroundColor: color, height: 8, borderRadius: 4 }}
      />
    </View>
  );
}

function StatChip({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <View className="items-center flex-1">
      <Ionicons name={icon as any} size={18} color="#d97706" />
      <Text className="text-gray-900 font-bold text-base mt-0.5">{value}</Text>
      <Text className="text-gray-500 text-xs">{label}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const { user } = useAuth();
  const userId = (user as any)?.id || (user as any)?._id;
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState<CourseProgressSummary[]>([]);
  const [coursesMap, setCoursesMap] = useState<Record<string, ICourse>>({});

  const loadData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    try {
      const [progressData, enrolledCourses] = await Promise.all([
        apiClient.getUserCoursesProgress(userId),
        apiClient.getEnrolledCourses(),
      ]);
      setProgress(normalizeList<CourseProgressSummary>(progressData));
      const map: Record<string, ICourse> = {};
      normalizeList<ICourse>(enrolledCourses).forEach((c) => {
        if (c._id) map[c._id] = c;
      });
      setCoursesMap(map);
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalCompleted = progress.reduce((acc, p) => acc + p.completedClasses, 0);
  const totalClasses = progress.reduce((acc, p) => acc + p.totalClasses, 0);
  const overallPct = totalClasses > 0 ? Math.round((totalCompleted / totalClasses) * 100) : 0;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-amber-50">
        <ActivityIndicator size="large" color="#d97706" />
        <Text className="mt-3 text-gray-500">Cargando progreso...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-amber-50"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => { setIsRefreshing(true); loadData(); }}
          tintColor="#d97706"
        />
      }
    >
      {/* Header */}
      <View className="bg-white px-5 pt-5 pb-4 border-b border-amber-100">
        <Text className="text-2xl font-bold text-gray-900">Tu Progreso</Text>
        <Text className="text-gray-500 mt-0.5">
          {progress.length} {progress.length === 1 ? 'curso' : 'cursos'} con actividad
        </Text>
      </View>

      {progress.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8 pt-20">
          <Ionicons name="stats-chart-outline" size={64} color="#d97706" />
          <Text className="text-xl font-semibold text-gray-700 mt-4 text-center">
            Sin progreso registrado
          </Text>
          <Text className="text-gray-500 mt-2 text-center">
            Comienza a ver las clases de tus cursos para ver tu avance aquí
          </Text>
        </View>
      ) : (
        <View className="px-4 py-4">
          {/* Overall Stats Card */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-amber-100">
            <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
              Resumen General
            </Text>
            <View className="flex-row">
              <StatChip icon="book-outline" value={progress.length} label="Cursos" />
              <View className="w-px bg-gray-100" />
              <StatChip icon="checkmark-circle-outline" value={totalCompleted} label="Completadas" />
              <View className="w-px bg-gray-100" />
              <StatChip icon="trending-up-outline" value={`${overallPct}%`} label="Avance" />
            </View>
            <View className="mt-3">
              <ProgressBar percentage={overallPct} />
            </View>
          </View>

          {/* Per-course progress */}
          {progress.map((item) => {
            const course = coursesMap[item.courseId];
            const courseName = course?.title || `Curso`;
            const pct = Math.round(item.completionPercentage);
            const videoPct = Math.round(item.averageVideoWatchPercentage);
            const isCompleted = item.isCompleted;

            return (
              <View key={item.courseId} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
                {/* Course Header */}
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-bold text-gray-900" numberOfLines={2}>
                      {courseName}
                    </Text>
                    <Text className="text-gray-500 text-xs mt-0.5">
                      Última actividad: {new Date(item.lastActivityAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  {isCompleted && (
                    <View className="bg-green-100 px-2 py-1 rounded-full">
                      <Text className="text-green-700 text-xs font-medium">Completado</Text>
                    </View>
                  )}
                </View>

                {/* Progress: Classes */}
                <View className="mb-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-gray-600">Clases completadas</Text>
                    <Text className="text-sm font-semibold text-gray-800">
                      {item.completedClasses}/{item.totalClasses}
                    </Text>
                  </View>
                  <ProgressBar percentage={pct} />
                  <Text className="text-xs text-amber-600 font-medium mt-0.5">{pct}%</Text>
                </View>

                {/* Progress: Video */}
                <View className="mb-3">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-gray-600">Video promedio</Text>
                    <Text className="text-sm font-semibold text-gray-800">{videoPct}%</Text>
                  </View>
                  <ProgressBar percentage={videoPct} color="#3b82f6" />
                </View>

                {/* Stats Row */}
                <View className="flex-row pt-3 border-t border-gray-50">
                  <View className="flex-row items-center flex-1">
                    <Ionicons name="flame-outline" size={14} color="#d97706" />
                    <Text className="text-xs text-gray-500 ml-1">Racha: <Text className="font-semibold text-gray-700">{item.streak} días</Text></Text>
                  </View>
                  <View className="flex-row items-center flex-1">
                    <Ionicons name="people-outline" size={14} color="#6b7280" />
                    <Text className="text-xs text-gray-500 ml-1">Asistencias: <Text className="font-semibold text-gray-700">{item.attendedClasses}</Text></Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

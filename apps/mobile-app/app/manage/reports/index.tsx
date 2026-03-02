import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  apiClient,
  ContentReport,
  ReportStatus,
} from '@/services/apiClient';

const STATUS_OPTIONS: Array<{ value: ReportStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'under_review', label: 'En revisión' },
  { value: 'action_taken', label: 'Acción tomada' },
  { value: 'dismissed', label: 'Descartadas' },
];

const STATUS_STYLE: Record<ReportStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: '#b45309', bg: '#fffbeb' },
  under_review: { label: 'En revisión', color: '#0369a1', bg: '#f0f9ff' },
  action_taken: { label: 'Acción tomada', color: '#166534', bg: '#f0fdf4' },
  dismissed: { label: 'Descartada', color: '#6b7280', bg: '#f9fafb' },
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Acoso',
  hate: 'Odio',
  sexual: 'Sexual',
  violence: 'Violencia',
  misinformation: 'Desinformación',
  copyright: 'Copyright',
  other: 'Otro',
};

export default function ContentReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | 'all'>('pending');

  const loadReports = useCallback(async (status: ReportStatus | 'all') => {
    try {
      const data = await apiClient.getContentReports({
        status: status === 'all' ? undefined : status,
        page: 1,
        limit: 50,
      });
      setReports(data.reports);
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      Alert.alert(
        'Error',
        Array.isArray(msg)
          ? msg.join('\n')
          : msg || 'No se pudieron cargar las denuncias.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports(selectedStatus);
  }, [selectedStatus, loadReports]);

  const updateStatus = (report: ContentReport) => {
    Alert.alert('Actualizar estado', 'Selecciona el nuevo estado', [
      {
        text: 'Pendiente',
        onPress: () => handleStatusUpdate(report._id, 'pending'),
      },
      {
        text: 'En revisión',
        onPress: () => handleStatusUpdate(report._id, 'under_review'),
      },
      {
        text: 'Acción tomada',
        onPress: () => handleStatusUpdate(report._id, 'action_taken'),
      },
      {
        text: 'Descartar',
        onPress: () => handleStatusUpdate(report._id, 'dismissed'),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleStatusUpdate = async (reportId: string, status: ReportStatus) => {
    try {
      await apiClient.updateContentReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((r) =>
          r._id === reportId ? { ...r, status, reviewedAt: new Date().toISOString() } : r,
        ),
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      Alert.alert(
        'Error',
        Array.isArray(msg)
          ? msg.join('\n')
          : msg || 'No se pudo actualizar el estado de la denuncia.',
      );
    }
  };

  const renderReport = ({ item }: { item: ContentReport }) => {
    const statusStyle = STATUS_STYLE[item.status];
    const created = new Date(item.createdAt).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-gray-900 font-bold text-base">
              {item.contentTitle || `${item.contentType} #${item.contentId.slice(0, 6)}`}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5">
              {item.contentType.toUpperCase()} • {created}
            </Text>
          </View>
          <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg }}>
            <Text className="text-xs font-semibold" style={{ color: statusStyle.color }}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        <View className="mt-3">
          <Text className="text-sm text-gray-700">
            Motivo: <Text className="font-semibold">{REASON_LABELS[item.reason] || item.reason}</Text>
          </Text>
          {item.details ? (
            <Text className="text-sm text-gray-500 mt-1" numberOfLines={3}>
              {item.details}
            </Text>
          ) : null}
          <Text className="text-xs text-gray-400 mt-2">
            Reportado por: {item.reporter?.email || 'usuario'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => updateStatus(item)}
          className="mt-3 bg-amber-500 rounded-xl py-2.5 items-center"
        >
          <Text className="text-white font-semibold">Actualizar estado</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-amber-50">
      <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-xs opacity-80 mb-1">Moderación</Text>
          <Text className="text-white text-xl font-bold">Denuncias de Contenido</Text>
        </View>
      </View>

      <View className="px-4 -mt-4 mb-2">
        <FlatList
          horizontal
          data={STATUS_OPTIONS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4 }}
          renderItem={({ item }) => {
            const selected = selectedStatus === item.value;
            return (
              <TouchableOpacity
                onPress={() => setSelectedStatus(item.value)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  selected ? 'bg-amber-500' : 'bg-white border border-gray-200'
                }`}
              >
                <Text className={selected ? 'text-white font-semibold' : 'text-gray-600'}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={renderReport}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadReports(selectedStatus);
              }}
              tintColor="#f59e0b"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="checkmark-circle-outline" size={56} color="#f59e0b" />
              <Text className="text-gray-500 mt-3">No hay denuncias en este filtro</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

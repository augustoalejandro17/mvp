import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { apiClient, ReportStatus, UserReport } from '@/services/apiClient';

const STATUS_OPTIONS: Array<{ value: ReportStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'under_review', label: 'En revisión' },
  { value: 'action_taken', label: 'Acción tomada' },
  { value: 'dismissed', label: 'Descartadas' },
  { value: 'all', label: 'Todas' },
];

const STATUS_STYLE: Record<ReportStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: '#9a3412', bg: '#ffedd5' },
  under_review: { label: 'En revisión', color: '#1d4ed8', bg: '#dbeafe' },
  action_taken: { label: 'Acción tomada', color: '#166534', bg: '#dcfce7' },
  dismissed: { label: 'Descartada', color: '#374151', bg: '#e5e7eb' },
};

export default function UserReportsManagementScreen() {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | 'all'>('pending');

  const loadReports = useCallback(async (status: ReportStatus | 'all') => {
    try {
      const data = await apiClient.getUserReports({
        status: status === 'all' ? undefined : status,
        page: 1,
        limit: 50,
      });
      setReports(data.reports);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudieron cargar las denuncias de usuario.';
      Alert.alert('Error', Array.isArray(message) ? message.join('\n') : String(message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadReports(selectedStatus);
  }, [selectedStatus, loadReports]);

  const handleStatusUpdate = async (reportId: string, status: ReportStatus) => {
    try {
      await apiClient.updateUserReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((r) =>
          r._id === reportId ? { ...r, status, reviewedAt: new Date().toISOString() } : r,
        ),
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo actualizar la denuncia.';
      Alert.alert('Error', Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const openStatusActions = (report: UserReport) => {
    Alert.alert('Actualizar estado', 'Selecciona un nuevo estado para esta denuncia.', [
      { text: 'Pendiente', onPress: () => handleStatusUpdate(report._id, 'pending') },
      { text: 'En revisión', onPress: () => handleStatusUpdate(report._id, 'under_review') },
      { text: 'Acción tomada', onPress: () => handleStatusUpdate(report._id, 'action_taken') },
      { text: 'Descartada', onPress: () => handleStatusUpdate(report._id, 'dismissed') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const renderReport = ({ item }: { item: UserReport }) => {
    const statusMeta = STATUS_STYLE[item.status];

    return (
      <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text className="text-base font-bold text-gray-900">
              Usuario reportado: {item.reportedUser?.name || item.reportedUser?.email || 'Usuario'}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              Reportado por: {item.reporter?.email || 'usuario'}
            </Text>
          </View>
          <View style={{ backgroundColor: statusMeta.bg }} className="px-2.5 py-1 rounded-full">
            <Text style={{ color: statusMeta.color }} className="text-xs font-semibold">
              {statusMeta.label}
            </Text>
          </View>
        </View>

        <Text className="mt-3 text-sm font-semibold text-gray-900">
          Motivo: <Text className="font-normal text-gray-700">{item.reason}</Text>
        </Text>

        {item.details ? (
          <Text className="mt-2 text-sm text-gray-700">{item.details}</Text>
        ) : null}

        <Text className="mt-3 text-xs text-gray-500">
          Creado: {new Date(item.createdAt).toLocaleString()}
        </Text>
        {item.reviewedAt ? (
          <Text className="mt-1 text-xs text-gray-500">
            Revisado: {new Date(item.reviewedAt).toLocaleString()}
          </Text>
        ) : null}

        <TouchableOpacity
          className="mt-3 bg-gray-900 rounded-xl py-2.5 items-center"
          onPress={() => openStatusActions(item)}
        >
          <Text className="text-white font-semibold">Actualizar estado</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <Stack.Screen options={{ title: 'Denuncias de usuarios' }} />

      <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200">
        <Text className="text-lg font-bold text-gray-900">Moderación de usuarios</Text>
        <Text className="text-sm text-gray-600 mt-1">
          Revisa denuncias de comportamiento de docentes o estudiantes.
        </Text>
      </View>

      <View className="px-3 py-3 bg-white border-b border-gray-200">
        <FlatList
          horizontal
          data={STATUS_OPTIONS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const selected = selectedStatus === item.value;
            return (
              <Pressable
                onPress={() => setSelectedStatus(item.value)}
                className={`mr-2 px-3 py-2 rounded-full border ${
                  selected ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'
                }`}
              >
                <Text className={selected ? 'text-white font-semibold' : 'text-gray-700'}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#111827" />
          <Text className="text-gray-600 mt-3">Cargando denuncias...</Text>
        </View>
      ) : (
        <FlatList
          className="flex-1 px-4 pt-4"
          data={reports}
          keyExtractor={(item) => item._id}
          renderItem={renderReport}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadReports(selectedStatus);
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-base font-semibold text-gray-700">Sin denuncias</Text>
              <Text className="text-sm text-gray-500 mt-1">
                No hay denuncias para el filtro seleccionado.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

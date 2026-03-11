import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { ContentReport, UserReport, apiClient } from '@/services/apiClient';

type ReportTab = 'content' | 'users';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  under_review: 'En revisión',
  action_taken: 'Acción tomada',
  dismissed: 'Descartada',
};

export default function MyReportsScreen() {
  const [tab, setTab] = useState<ReportTab>('content');
  const [contentReports, setContentReports] = useState<ContentReport[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const [contentData, userData] = await Promise.all([
        apiClient.getMyContentReports(1, 30),
        apiClient.getMyUserReports(1, 30),
      ]);
      setContentReports(contentData.reports || []);
      setUserReports(userData.reports || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const renderContentReport = ({ item }: { item: ContentReport }) => (
    <View className="bg-white border border-gray-100 rounded-xl p-4 mb-3">
      <Text className="text-gray-900 font-bold">
        {item.contentTitle || `${item.contentType} #${item.contentId.slice(-6)}`}
      </Text>
      <Text className="text-sm text-gray-600 mt-1">Motivo: {item.reason}</Text>
      <Text className="text-sm text-gray-600 mt-1">
        Estado: {STATUS_LABEL[item.status] || item.status}
      </Text>
      <Text className="text-xs text-gray-500 mt-2">
        {new Date(item.createdAt).toLocaleString()}
      </Text>
    </View>
  );

  const renderUserReport = ({ item }: { item: UserReport }) => (
    <View className="bg-white border border-gray-100 rounded-xl p-4 mb-3">
      <Text className="text-gray-900 font-bold">
        Usuario: {item.reportedUser?.name || item.reportedUser?.email || 'N/D'}
      </Text>
      <Text className="text-sm text-gray-600 mt-1">Motivo: {item.reason}</Text>
      <Text className="text-sm text-gray-600 mt-1">
        Estado: {STATUS_LABEL[item.status] || item.status}
      </Text>
      <Text className="text-xs text-gray-500 mt-2">
        {new Date(item.createdAt).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-amber-50">
      <Stack.Screen options={{ title: 'Mis denuncias' }} />

      <View className="px-4 pt-4 pb-2">
        <View className="bg-white rounded-xl p-1 flex-row border border-gray-100">
          <Pressable
            className={`flex-1 rounded-lg py-2 items-center ${tab === 'content' ? 'bg-amber-500' : ''}`}
            onPress={() => setTab('content')}
          >
            <Text className={tab === 'content' ? 'text-white font-semibold' : 'text-gray-700'}>
              Contenido
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-lg py-2 items-center ${tab === 'users' ? 'bg-amber-500' : ''}`}
            onPress={() => setTab('users')}
          >
            <Text className={tab === 'users' ? 'text-white font-semibold' : 'text-gray-700'}>
              Usuarios
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#d97706" />
          <Text className="text-gray-500 mt-2">Cargando denuncias...</Text>
        </View>
      ) : (
        tab === 'content' ? (
          <FlatList
            className="px-4 pt-2"
            data={contentReports}
            keyExtractor={(item) => item._id}
            renderItem={renderContentReport}
            ListEmptyComponent={
              <View className="items-center justify-center py-16">
                <Text className="text-gray-700 font-semibold">Sin denuncias</Text>
                <Text className="text-gray-500 mt-1 text-sm">Aún no has enviado denuncias.</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadReports();
                }}
                tintColor="#d97706"
              />
            }
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        ) : (
          <FlatList
            className="px-4 pt-2"
            data={userReports}
            keyExtractor={(item) => item._id}
            renderItem={renderUserReport}
            ListEmptyComponent={
              <View className="items-center justify-center py-16">
                <Text className="text-gray-700 font-semibold">Sin denuncias</Text>
                <Text className="text-gray-500 mt-1 text-sm">Aún no has enviado denuncias.</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadReports();
                }}
                tintColor="#d97706"
              />
            }
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )
      )}
    </View>
  );
}

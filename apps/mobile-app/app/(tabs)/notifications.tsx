import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, AppNotification } from '@/services/apiClient';
import { Ionicons } from '@expo/vector-icons';

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  high: { color: '#dc2626', bg: '#fef2f2' },
  medium: { color: '#d97706', bg: '#fffbeb' },
  low: { color: '#6b7280', bg: '#f9fafb' },
};

function NotificationItem({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: () => void;
}) {
  const priority = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.low;
  const date = new Date(item.createdAt);
  const isToday = new Date().toDateString() === date.toDateString();
  const dateStr = isToday
    ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`rounded-xl mb-2 overflow-hidden border ${
        item.isRead ? 'border-gray-100 bg-white' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <View className="flex-row p-4">
        {/* Indicator */}
        <View
          className="w-1 rounded-full mr-3 self-stretch"
          style={{ backgroundColor: item.isRead ? '#e5e7eb' : priority.color }}
        />
        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <Text
              className={`flex-1 text-sm font-semibold mr-2 ${
                item.isRead ? 'text-gray-700' : 'text-gray-900'
              }`}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">{dateStr}</Text>
          </View>
          <Text className="text-gray-500 text-sm mt-0.5" numberOfLines={2}>
            {item.message}
          </Text>
          {!item.isRead && (
            <View className="flex-row items-center mt-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
              <Text className="text-amber-600 text-xs font-medium">Nuevo</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiClient.getNotifications(1, 30);
      setNotifications(data.notifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await apiClient.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n)),
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-amber-50">
        <ActivityIndicator size="large" color="#d97706" />
        <Text className="mt-3 text-gray-500">Cargando notificaciones...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-amber-50"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => { setIsRefreshing(true); loadNotifications(); }}
          tintColor="#d97706"
        />
      }
    >
      {/* Header */}
      <View className="bg-white px-5 pt-5 pb-4 border-b border-amber-100 flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Avisos</Text>
          <Text className="text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllAsRead}
            className="flex-row items-center bg-amber-500 rounded-full px-3 py-1.5"
          >
            <Ionicons name="checkmark-done" size={14} color="white" />
            <Text className="text-white text-xs font-semibold ml-1">Marcar todo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="px-4 pt-4 pb-6">
        {notifications.length === 0 ? (
          <View className="items-center pt-16">
            <Ionicons name="notifications-off-outline" size={56} color="#d97706" />
            <Text className="text-lg font-semibold text-gray-700 mt-4">Sin notificaciones</Text>
            <Text className="text-gray-500 mt-1 text-center">
              Te avisaremos cuando haya novedades
            </Text>
          </View>
        ) : (
          notifications.map((item) => (
            <NotificationItem
              key={item._id}
              item={item}
              onPress={() => !item.isRead && markAsRead(item._id)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

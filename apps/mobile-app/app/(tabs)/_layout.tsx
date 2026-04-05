import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@inti/shared-types';
import { apiClient } from '@/services/apiClient';

const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.SCHOOL_OWNER,
];

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  return <Ionicons name={name as any} size={size} color={color} />;
}

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const [canViewSeatManagementModule, setCanViewSeatManagementModule] =
    useState(false);
  const isAdminByRole =
    !!user?.role && ADMIN_ROLES.includes(user.role as UserRole);
  const isAdmin = isAdminByRole || canViewSeatManagementModule;
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const tabBarHeight = 54 + bottomInset;

  useEffect(() => {
    const loadPolicy = async () => {
      if (!user) {
        setCanViewSeatManagementModule(false);
        return;
      }
      try {
        const policy = await apiClient.getSeatPolicy();
        setCanViewSeatManagementModule(
          policy?.capabilities?.canViewSeatManagementModule === true,
        );
      } catch {
        setCanViewSeatManagementModule(false);
      }
    };
    loadPolicy();
  }, [user]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#b45309',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarHideOnKeyboard: true,
        tabBarButton: (props) => (
          <TouchableOpacity
            {...(props as any)}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 8, left: 8, right: 8 }}
          />
        ),
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#fde68a',
          borderTopWidth: 1,
          paddingBottom: bottomInset,
          paddingTop: 6,
          height: tabBarHeight,
        },
        tabBarItemStyle: { minHeight: 44 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle: { backgroundColor: '#f59e0b' },
        headerTintColor: '#1f2937',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          href: null,
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Panel',
          href: isAdmin ? undefined : null, // hide if not admin
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Avisos',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'notifications' : 'notifications-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

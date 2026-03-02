import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@inti/shared-types';

const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.SCHOOL_OWNER,
];

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  return <Ionicons name={name as any} size={size} color={color} />;
}

export default function TabsLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role && ADMIN_ROLES.includes(user.role as UserRole);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#b45309',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#fde68a',
          borderTopWidth: 1,
          paddingBottom: 10,
          paddingTop: 8,
          height: 68,
        },
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

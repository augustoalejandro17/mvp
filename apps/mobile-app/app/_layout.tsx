import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import '../global.css';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f59e0b',
          },
          headerTintColor: '#111827',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="player/[id]" 
          options={{ 
            title: 'Reproducir Video',
            presentation: 'modal'
          }} 
        />
        <Stack.Screen
          name="report-content"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="report-user"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="manage/user-reports/index"
          options={{
            title: 'Denuncias de usuarios',
          }}
        />
        <Stack.Screen
          name="privacy-policy"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="community-guidelines"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </AuthProvider>
  );
}

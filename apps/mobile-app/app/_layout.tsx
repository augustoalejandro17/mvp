import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { AuthProvider } from '@/contexts/AuthContext';
import '../global.css';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    }).catch(() => {});
  }, []);

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
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_right',
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
          name="terms-and-conditions"
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
        <Stack.Screen
          name="edit-profile"
          options={{
            title: 'Editar perfil',
          }}
        />
        <Stack.Screen
          name="change-password"
          options={{
            title: 'Cambiar contraseña',
          }}
        />
        <Stack.Screen
          name="about"
          options={{
            title: 'Acerca de Inti',
          }}
        />
        <Stack.Screen
          name="my-reports"
          options={{
            title: 'Mis denuncias',
          }}
        />
      </Stack>
    </AuthProvider>
  );
}

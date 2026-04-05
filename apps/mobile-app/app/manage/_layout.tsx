import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ManageLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f59e0b' }} edges={['top']}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </SafeAreaView>
  );
}

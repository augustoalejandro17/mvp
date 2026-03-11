import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';

export default function AboutScreen() {
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const appName = Constants.expoConfig?.name || 'Inti';

  return (
    <View className="flex-1 bg-amber-50">
      <Stack.Screen options={{ title: `Acerca de ${appName}` }} />
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <Text className="text-gray-900 font-bold text-lg">{appName}</Text>
          <Text className="text-gray-500 mt-1">Versión {appVersion}</Text>
          <Text className="text-gray-700 mt-3 leading-6">
            Plataforma educativa para gestión de escuelas, cursos y contenido en video.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <Text className="text-gray-900 font-semibold mb-2">Información legal</Text>
          <Text className="text-gray-700 leading-6">
            Consulta en el perfil los enlaces de Política de Privacidad, Términos y Condiciones,
            y Normas de Contenido para conocer reglas de uso, moderación y tratamiento de datos.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

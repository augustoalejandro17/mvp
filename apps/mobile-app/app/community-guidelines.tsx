import { Alert, ScrollView, Text, TouchableOpacity, View, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RULES = [
  'No contenido de odio, discriminación o acoso.',
  'No contenido sexual explícito ni explotación.',
  'No amenazas, violencia gráfica ni incitación al daño.',
  'No spam, estafas ni contenido engañoso.',
  'Respeta derechos de autor y propiedad intelectual.',
  'Mantén el enfoque educativo y profesional.',
];

export default function CommunityGuidelinesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appExtra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const guidelinesUrl = appExtra?.communityGuidelinesUrl;
  const supportEmail = appExtra?.supportEmail || 'support@intihubs.com';

  const openFullGuidelines = async () => {
    if (!guidelinesUrl) {
      Alert.alert('No disponible', 'La URL de normas de contenido no está configurada.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(guidelinesUrl);
      if (!canOpen) {
        Alert.alert('No disponible', 'No fue posible abrir la URL.');
        return;
      }
      await Linking.openURL(guidelinesUrl);
    } catch {
      Alert.alert('Error', 'No se pudo abrir la página de normas.');
    }
  };

  return (
    <View className="flex-1 bg-amber-50">
      <View className="bg-amber-500 px-5 pb-8" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 p-1"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Moderación UGC</Text>
            <Text className="text-white text-xl font-bold">Normas de Contenido</Text>
          </View>
        </View>
      </View>

      <ScrollView className="px-4 -mt-4">
        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-3">Contenido no permitido</Text>
          {RULES.map((rule) => (
            <View key={rule} className="flex-row items-start mb-2">
              <Ionicons name="ellipse" size={8} color="#d97706" style={{ marginTop: 7 }} />
              <Text className="text-gray-600 ml-2 flex-1 leading-6">{rule}</Text>
            </View>
          ))}
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Cómo reportar</Text>
          <Text className="text-gray-600 leading-6">
            Si encuentras contenido que incumple estas normas, usa el botón
            {' '}<Text className="font-semibold">Denunciar contenido</Text>{' '}
            desde el reproductor.
          </Text>
          <Text className="text-gray-600 leading-6 mt-2">
            Nuestro equipo revisa reportes y toma acciones de moderación.
          </Text>
          <Text className="text-gray-600 mt-2">Contacto: {supportEmail}</Text>
        </View>

        <TouchableOpacity
          onPress={openFullGuidelines}
          className="bg-amber-500 rounded-2xl py-4 items-center mb-8"
        >
          <Text className="text-white font-bold text-base">Ver Normas Completas</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

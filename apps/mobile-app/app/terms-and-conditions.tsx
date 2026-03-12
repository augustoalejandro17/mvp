import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsAndConditionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appExtra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const termsUrl = appExtra?.termsConditionsUrl;
  const supportEmail = appExtra?.supportEmail || 'support@intihubs.com';

  const openFullTerms = async () => {
    if (!termsUrl) {
      Alert.alert('No disponible', 'La URL de términos y condiciones no está configurada.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(termsUrl);
      if (!canOpen) {
        Alert.alert('No disponible', 'No fue posible abrir la URL.');
        return;
      }
      await Linking.openURL(termsUrl);
    } catch {
      Alert.alert('Error', 'No se pudo abrir la página de términos y condiciones.');
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
            <Text className="text-white text-xs opacity-80 mb-1">Legal</Text>
            <Text className="text-white text-xl font-bold">Términos y Condiciones</Text>
          </View>
        </View>
      </View>

      <ScrollView className="px-4 -mt-4">
        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Uso de la plataforma</Text>
          <Text className="text-gray-600 leading-6">
            Al usar Inti aceptas nuestras reglas de contenido, moderación y uso responsable de la
            cuenta. El incumplimiento puede resultar en restricciones o suspensión de acceso.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Contenido y propiedad intelectual</Text>
          <Text className="text-gray-600 leading-6">
            Los creadores son responsables de contar con derechos sobre el material que publican.
            No se permite subir contenido con copyright sin autorización.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Soporte legal</Text>
          <Text className="text-gray-600">Correo: {supportEmail}</Text>
        </View>

        <TouchableOpacity
          onPress={openFullTerms}
          className="bg-amber-500 rounded-2xl py-4 items-center mb-8"
        >
          <Text className="text-white font-bold text-base">Ver Términos Completos</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

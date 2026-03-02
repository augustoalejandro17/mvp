import { Alert, ScrollView, Text, TouchableOpacity, View, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const appExtra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const privacyPolicyUrl = appExtra?.privacyPolicyUrl;
  const supportEmail = appExtra?.supportEmail || 'support@intihubs.com';

  const openFullPolicy = async () => {
    if (!privacyPolicyUrl) {
      Alert.alert('No disponible', 'La URL de política de privacidad no está configurada.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(privacyPolicyUrl);
      if (!canOpen) {
        Alert.alert('No disponible', 'No fue posible abrir la URL.');
        return;
      }
      await Linking.openURL(privacyPolicyUrl);
    } catch {
      Alert.alert('Error', 'No se pudo abrir la política de privacidad.');
    }
  };

  return (
    <View className="flex-1 bg-amber-50">
      <View className="bg-amber-500 px-5 pt-6 pb-8">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Legal</Text>
            <Text className="text-white text-xl font-bold">Política de Privacidad</Text>
          </View>
        </View>
      </View>

      <ScrollView className="px-4 -mt-4">
        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Resumen</Text>
          <Text className="text-gray-600 leading-6">
            Recopilamos datos de cuenta (nombre, correo y rol), datos de uso dentro de cursos
            y eventos técnicos mínimos para seguridad y funcionamiento de la plataforma.
          </Text>
          <Text className="text-gray-600 leading-6 mt-2">
            Tus datos se usan para autenticación, progreso académico, notificaciones y soporte.
            No vendemos tu información personal.
          </Text>
          <Text className="text-gray-600 leading-6 mt-2">
            Puedes solicitar eliminación de tu cuenta desde la sección de Perfil en esta app.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <Text className="text-gray-900 font-bold text-base mb-2">Contacto de Privacidad</Text>
          <Text className="text-gray-600">Correo: {supportEmail}</Text>
        </View>

        <TouchableOpacity
          onPress={openFullPolicy}
          className="bg-amber-500 rounded-2xl py-4 items-center mb-8"
        >
          <Text className="text-white font-bold text-base">Ver Política Completa</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

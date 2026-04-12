import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { LoginDto } from '@inti/shared-types';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginDto>({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const appExtra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const privacyPolicyUrl = appExtra?.privacyPolicyUrl;
  const termsConditionsUrl = appExtra?.termsConditionsUrl;

  const handleForgotPassword = async () => {
    const supportEmail = appExtra?.supportEmail;
    if (!supportEmail) {
      Alert.alert('Soporte', 'Contacta al administrador para recuperar tu cuenta.');
      return;
    }

    const mailto = `mailto:${supportEmail}?subject=Recuperación de contraseña`;

    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        Alert.alert('Soporte', `Escríbenos a ${supportEmail}`);
        return;
      }
      await Linking.openURL(mailto);
    } catch {
      Alert.alert('Soporte', `Escríbenos a ${supportEmail}`);
    }
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos');
      return;
    }
    setIsLoading(true);
    try {
      await login(formData);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error de acceso', error.message || 'Credenciales incorrectas');
    } finally {
      setIsLoading(false);
    }
  };

  const openExternalUrl = async (url?: string) => {
    if (!url) {
      Alert.alert('No disponible', 'Este enlace no está configurado.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('No disponible', 'No se pudo abrir el enlace.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el enlace.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top amber band */}
        <View className="bg-amber-500 h-48 justify-end pb-8 items-center">
          <View className="w-16 h-16 bg-white rounded-2xl justify-center items-center shadow-md">
            <Text style={{ fontSize: 34, fontWeight: '800', color: '#d97706', lineHeight: 36 }}>
              I
            </Text>
          </View>
        </View>

        <View className="flex-1 px-6 pt-8 pb-10">
          {/* Title */}
          <Text className="text-3xl font-bold text-gray-900 text-center">Inti</Text>
          <Text className="text-gray-500 text-center mt-1 mb-8">Inicia sesión para continuar</Text>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Correo electrónico</Text>
            <View className="h-14 flex-row items-center border border-gray-200 rounded-xl bg-gray-50 px-4">
              <Ionicons name="mail-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 pl-3 text-base text-gray-900"
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
              />
            </View>
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Contraseña</Text>
            <View className="h-14 flex-row items-center border border-gray-200 rounded-xl bg-gray-50 px-4">
              <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 pl-3 text-base text-gray-900"
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${isLoading ? 'bg-amber-300' : 'bg-amber-500'}`}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <View className="flex-row items-center">
                <Ionicons name="refresh" size={18} color="white" />
                <Text className="text-white font-bold text-base ml-2">Iniciando sesión...</Text>
              </View>
            ) : (
              <Text className="text-white font-bold text-base">Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity className="mt-5 items-center" onPress={handleForgotPassword}>
            <Text className="text-amber-600 font-medium">¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity className="mt-4 items-center" onPress={() => router.push('/(auth)/register')}>
            <Text className="text-gray-700">
              ¿No tienes cuenta? <Text className="text-amber-600 font-semibold">Regístrate</Text>
            </Text>
          </TouchableOpacity>

          <View className="mt-7 items-center">
            <Text className="text-gray-400 text-xs text-center">
              Al continuar aceptas nuestros términos y política de privacidad.
            </Text>
            <View className="flex-row items-center mt-2">
              <TouchableOpacity onPress={() => openExternalUrl(termsConditionsUrl)}>
                <Text className="text-amber-600 text-xs font-semibold">Términos</Text>
              </TouchableOpacity>
              <Text className="text-gray-300 mx-2">•</Text>
              <TouchableOpacity onPress={() => openExternalUrl(privacyPolicyUrl)}>
                <Text className="text-amber-600 text-xs font-semibold">Privacidad</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 22,
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
  },
});

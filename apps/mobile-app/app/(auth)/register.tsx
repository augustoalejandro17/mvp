import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RegisterDto } from '@inti/shared-types';
import { useAuth } from '@/contexts/AuthContext';

type RegisterForm = RegisterDto & {
  confirmPassword: string;
  ageText: string;
};

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    ageText: '',
  });

  const parsedAge = useMemo(() => {
    const raw = String(form.ageText || '').trim();
    if (!raw) return undefined;
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) return Number.NaN;
    return value;
  }, [form.ageText]);

  const handleSubmit = async () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Campos requeridos', 'Completa nombre, correo y contraseña.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña inválida', 'Debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Contraseñas', 'Las contraseñas no coinciden.');
      return;
    }
    if (parsedAge !== undefined) {
      if (Number.isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        Alert.alert('Edad inválida', 'La edad debe estar entre 1 y 120.');
        return;
      }
    }

    setIsLoading(true);
    try {
      await register({
        name,
        email,
        password,
        age: parsedAge,
      });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('No se pudo crear la cuenta', error?.message || 'Intenta nuevamente.');
    } finally {
      setIsLoading(false);
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
        <View className="bg-amber-500 h-44 justify-end pb-7 items-center">
          <View className="w-14 h-14 bg-white rounded-2xl justify-center items-center shadow-md">
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#d97706', lineHeight: 34 }}>
              I
            </Text>
          </View>
        </View>

        <View className="flex-1 px-6 pt-7 pb-10">
          <Text className="text-3xl font-bold text-gray-900 text-center">Crear cuenta</Text>
          <Text className="text-gray-500 text-center mt-1 mb-7">
            Te registraremos como estudiante
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Nombre completo</Text>
            <View className="h-14 flex-row items-center border border-gray-200 rounded-xl bg-gray-50 px-4">
              <Ionicons name="person-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 pl-3 text-base text-gray-900"
                style={styles.input}
                placeholder="Tu nombre"
                placeholderTextColor="#9ca3af"
                value={form.name}
                onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
              />
            </View>
          </View>

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
                autoComplete="email"
                textContentType="emailAddress"
                value={form.email}
                onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Edad (opcional)</Text>
            <View className="h-14 flex-row items-center border border-gray-200 rounded-xl bg-gray-50 px-4">
              <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 pl-3 text-base text-gray-900"
                style={styles.input}
                placeholder="Ej: 24"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={form.ageText}
                onChangeText={(text) => setForm((prev) => ({ ...prev, ageText: text }))}
              />
            </View>
          </View>

          <View className="mb-4">
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
                autoComplete="new-password"
                textContentType="newPassword"
                value={form.password}
                onChangeText={(text) => setForm((prev) => ({ ...prev, password: text }))}
              />
              <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Confirmar contraseña</Text>
            <View className="h-14 flex-row items-center border border-gray-200 rounded-xl bg-gray-50 px-4">
              <Ionicons name="shield-checkmark-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 pl-3 text-base text-gray-900"
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                value={form.confirmPassword}
                onChangeText={(text) => setForm((prev) => ({ ...prev, confirmPassword: text }))}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${isLoading ? 'bg-amber-300' : 'bg-amber-500'}`}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <View className="flex-row items-center">
                <Ionicons name="refresh" size={18} color="white" />
                <Text className="text-white font-bold text-base ml-2">Creando cuenta...</Text>
              </View>
            ) : (
              <Text className="text-white font-bold text-base">Crear Cuenta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="mt-5 items-center" onPress={() => router.push('/(auth)/login')}>
            <Text className="text-amber-600 font-medium">¿Ya tienes cuenta? Inicia sesión</Text>
          </TouchableOpacity>
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

import { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/apiClient';

export default function ChangePasswordScreen() {
  const { user } = useAuth();
  const userAny = user as any;
  const userId = useMemo(
    () => userAny?.id || userAny?._id || '',
    [userAny?.id, userAny?._id],
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const normalizeChangePasswordError = (message?: string | string[]) => {
    const raw = Array.isArray(message) ? message.join('\n') : message || '';
    const normalized = raw.trim().toLowerCase();

    if (
      normalized.includes('does not have a local password yet') ||
      normalized.includes('aún no tiene una contraseña local')
    ) {
      return 'Esta cuenta aún no tiene una contraseña local configurada. Si fue creada con acceso externo o por un administrador, primero debemos habilitar el flujo para definir una contraseña.';
    }

    if (normalized.includes('current password is incorrect')) {
      return 'La contraseña actual es incorrecta.';
    }

    if (normalized.includes('nueva contraseña debe ser diferente')) {
      return 'La nueva contraseña debe ser diferente a la actual.';
    }

    return raw || 'Revisa tus datos e intenta nuevamente.';
  };

  const validate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Campos requeridos', 'Completa todos los campos.');
      return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validación', 'La nueva contraseña y la confirmación no coinciden.');
      return false;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validación', 'La nueva contraseña debe tener al menos 8 caracteres.');
      return false;
    }
    if (!userId) {
      Alert.alert('Error', 'No se pudo identificar al usuario autenticado.');
      return false;
    }
    return true;
  };

  const handleChangePassword = async () => {
    if (!validate()) return;

    try {
      setSaving(true);
      await apiClient.changeMyPassword(userId, {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Contraseña actualizada', 'Tu contraseña fue actualizada correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      Alert.alert(
        'No se pudo actualizar',
        normalizeChangePasswordError(msg),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-amber-50 px-4 pt-4">
      <Stack.Screen
        options={{
          title: 'Cambiar contraseña',
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-2">
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />

      <View className="bg-white rounded-2xl p-4 border border-gray-100">
        <Text className="text-sm font-semibold text-gray-700 mb-1.5">Contraseña actual</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 mb-4"
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />

        <Text className="text-sm font-semibold text-gray-700 mb-1.5">Nueva contraseña</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 mb-4"
          secureTextEntry
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor="#9ca3af"
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <Text className="text-sm font-semibold text-gray-700 mb-1.5">Confirmar nueva contraseña</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
          secureTextEntry
          placeholder="Repite la nueva contraseña"
          placeholderTextColor="#9ca3af"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>

      <TouchableOpacity
        className={`rounded-2xl py-4 items-center mt-4 ${saving ? 'bg-amber-300' : 'bg-amber-500'}`}
        onPress={handleChangePassword}
        disabled={saving}
      >
        <View className="flex-row items-center">
          <Ionicons name={saving ? 'refresh' : 'key-outline'} size={18} color="white" />
          <Text className="text-white font-bold ml-2">
            {saving ? 'Actualizando...' : 'Actualizar contraseña'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

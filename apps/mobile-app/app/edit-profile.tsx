import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/apiClient';

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const userAny = user as any;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstName(userAny?.firstName ?? '');
    setLastName(userAny?.lastName ?? '');
    setPhone(userAny?.phone ?? '');
    setBio(userAny?.bio ?? '');
  }, [userAny?.firstName, userAny?.lastName, userAny?.phone, userAny?.bio]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.updateMyProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      await refreshUser();
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      Alert.alert(
        'No se pudo guardar',
        Array.isArray(msg) ? msg.join('\n') : msg || 'Intenta nuevamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-amber-50">
      <Stack.Screen options={{ title: 'Editar perfil' }} />

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Nombres</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
              placeholder="Nombres"
              placeholderTextColor="#9ca3af"
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Apellidos</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
              placeholder="Apellidos"
              placeholderTextColor="#9ca3af"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Teléfono</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
              placeholder="+593..."
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View className="mb-2">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Bio</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 min-h-[110px]"
              placeholder="Cuéntanos un poco sobre ti"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              maxLength={300}
              value={bio}
              onChangeText={setBio}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className={`mt-4 rounded-2xl py-4 items-center ${saving ? 'bg-amber-300' : 'bg-amber-500'}`}
        >
          <View className="flex-row items-center">
            <Ionicons name={saving ? 'refresh' : 'save-outline'} size={18} color="white" />
            <Text className="text-white font-bold ml-2">{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

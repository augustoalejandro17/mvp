import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/services/apiClient';
import { ISchool } from '@inti/shared-types';

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'url' | 'phone-pad';
}) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-semibold text-sm mb-1.5">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline={multiline}
        keyboardType={keyboardType}
        numberOfLines={multiline ? 4 : 1}
        className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
        style={multiline ? { minHeight: 100, textAlignVertical: 'top' } : undefined}
      />
    </View>
  );
}

export default function EditSchoolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [school, setSchool] = useState<ISchool | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.getSchoolById(id);
        setSchool(data);
        setName(data.name ?? '');
        setDescription(data.description ?? '');
        setAddress(data.address ?? '');
        setPhone((data as any).phone ?? '');
        setWebsite((data as any).website ?? '');
        setIsPublic((data as any).isPublic ?? true);
      } catch {
        Alert.alert('Error', 'No se pudo cargar la escuela');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.updateSchool(id, {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        phone: phone.trim(),
        website: website.trim(),
        isPublic,
      });
      Alert.alert('Guardado', 'Escuela actualizada correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-amber-50 justify-center items-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 bg-amber-50" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-amber-500 px-5 pt-5 pb-8 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xs opacity-80 mb-1">Gestión de Escuelas</Text>
            <Text className="text-white text-xl font-bold" numberOfLines={1}>
              {school?.name ?? 'Editar Escuela'}
            </Text>
          </View>
        </View>

        <View className="px-4 -mt-4">
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-gray-900 font-bold text-base mb-4">Información de la Escuela</Text>

            <FormField label="Nombre *" value={name} onChangeText={setName} placeholder="Nombre de la escuela" />
            <FormField label="Descripción" value={description} onChangeText={setDescription} placeholder="Breve descripción de la escuela" multiline />
            <FormField label="Dirección" value={address} onChangeText={setAddress} placeholder="Dirección física" />
            <FormField label="Teléfono" value={phone} onChangeText={setPhone} placeholder="+1 (000) 000-0000" keyboardType="phone-pad" />
            <FormField label="Sitio Web" value={website} onChangeText={setWebsite} placeholder="https://..." keyboardType="url" />

            {/* Toggle público */}
            <View className="flex-row items-center justify-between py-3 border-t border-gray-100 mt-2">
              <View>
                <Text className="text-gray-800 font-semibold text-base">Escuela pública</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Visible para todos los usuarios</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: '#e5e7eb', true: '#fbbf24' }}
                thumbColor={isPublic ? '#f59e0b' : '#f3f4f6'}
              />
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="bg-amber-500 rounded-2xl py-4 items-center mb-4"
            style={{ opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Guardar Cambios</Text>
            )}
          </TouchableOpacity>

          <View className="h-4" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
